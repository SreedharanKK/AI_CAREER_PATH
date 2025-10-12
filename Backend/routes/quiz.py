from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
from datetime import datetime

quiz_bp = Blueprint('quiz', __name__)

def _is_coding_topic(title):
    """Simple helper to check if a topic is likely about coding."""
    coding_keywords = ['python', 'java', 'javascript', 'c++', 'sql', 'html', 'css', 'react', 'flask', 'node.js', 'api']
    return any(keyword in title.lower() for keyword in coding_keywords)

@quiz_bp.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    """
    Generates a more advanced quiz (15-25 questions) with coding challenges
    for relevant topics using the Gemini API.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    course_title = req_data.get('course_title')
    course_description = req_data.get('course_description')

    if not course_title or not course_description:
        return jsonify({"error": "Course title and description are required."}), 400
    if not gemini_model:
        return jsonify({"error": "AI Model is not available."}), 503
    
    try:
        # --- Advanced AI Prompt for Quiz Generation ---
        coding_instructions = ""
        if _is_coding_topic(course_title):
            coding_instructions = """
            - **Coding Questions:** Since this is a coding topic, include at least 5 `coding` type questions. For these, provide a problem description and a simple example of the expected output. The `correct_answer` should be a functional block of code.
            """

        prompt = f"""
        You are an expert technical instructor. Create a comprehensive quiz with 15 to 25 questions for a learning step titled "{course_title}" with the description "{course_description}".

        RULES FOR THE QUIZ:
        1.  **JSON Format:** The quiz MUST be a valid JSON object.
        2.  **Question Types:** Use a mix of `multiple-choice`, `short-answer`, and where appropriate, `coding` questions.
        3.  **Correct Answer:** For each question, clearly indicate the `correct_answer`. For short-answer, include common abbreviations in parentheses, e.g., "Domain Name System (DNS)".
        {coding_instructions}
        
        The JSON structure MUST be:
        {{
          "quiz_title": "Quiz for {course_title}",
          "questions": [
            {{
              "question_text": "What is the primary function of HTML?",
              "type": "multiple-choice",
              "options": ["Styling web pages", "Structuring web content", "Adding interactivity"],
              "correct_answer": "Structuring web content"
            }},
            {{
              "question_text": "What does CSS stand for?",
              "type": "short-answer",
              "correct_answer": "Cascading Style Sheets"
            }},
            {{
              "question_text": "Write a Python function `add(a, b)` that returns the sum of two numbers.",
              "type": "coding",
              "correct_answer": "def add(a, b):\\n    return a + b"
            }}
          ]
        }}
        """

        response = gemini_model.generate_content(prompt)
        cleaned_response_text = re.sub(r'```(json)?|```', '', response.text).strip()
        quiz_data = json.loads(cleaned_response_text)
        
        return jsonify(quiz_data), 200

    except Exception as e:
        print(f"❌ Error generating quiz: {e}")
        return jsonify({"error": "Failed to generate quiz due to an internal error."}), 500

# --- NEW: Improved Normalization Function ---
def _normalize_answer(text):
    """
    Prepares an answer string for flexible comparison by removing all
    non-alphanumeric characters (spaces, punctuation, etc.) and lowercasing.
    """
    if not isinstance(text, str):
        return ""
    # Lowercase and remove anything that is not a letter or a number
    return re.sub(r'[^a-z0-9]', '', text.lower())

@quiz_bp.route('/submit-quiz', methods=['POST'])
def submit_quiz():
    """
    Evaluates quiz answers with smarter comparison, saves detailed history,
    updates user progress, and unlocks the next course.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    user_answers = req_data.get('user_answers')
    quiz_data = req_data.get('quiz_data')
    roadmap_id = req_data.get('roadmap_id')
    stage_index = req_data.get('stage_index')
    step_index = req_data.get('step_index')
    pass_percentage = 80

    if not all([user_answers, quiz_data, roadmap_id, stage_index is not None, step_index is not None]):
        return jsonify({"error": "Missing quiz submission data."}), 400

    score = 0
    total_questions = len(quiz_data['questions'])
    detailed_results = []

    for q in quiz_data['questions']:
        user_ans = next((a['answer'] for a in user_answers if a['question_text'] == q['question_text']), None)
        is_correct = False
        
        # --- NEW: Smarter Answer Evaluation Logic ---
        norm_user_ans = _normalize_answer(user_ans)
        norm_correct_ans = _normalize_answer(q['correct_answer'])

        if norm_user_ans and norm_correct_ans:
            # Check if one string contains the other. This handles cases like:
            # - "dns" vs "domainnamesystemdns" (acronym)
            # - "thedomainnamesystem" vs "domainnamesystem" (extra words)
            # - "hypertexttransferprotocol" vs "hypertexttransferprotocol" (spacing/capitalization)
            if norm_user_ans in norm_correct_ans or norm_correct_ans in norm_user_ans:
                is_correct = True

        if is_correct:
            score += 1
        
        detailed_results.append({
            "question": q['question_text'],
            "user_answer": user_ans,
            "correct_answer": q['correct_answer'],
            "is_correct": is_correct
        })

    percentage_score = (score / total_questions) * 100 if total_questions > 0 else 0
    passed = percentage_score >= pass_percentage

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id FROM user_roadmap_progress WHERE user_id = %s AND roadmap_id = %s AND stage_index = %s AND step_index = %s",
            (user_id, roadmap_id, stage_index, step_index)
        )
        progress_record = cur.fetchone()
        if not progress_record:
            return jsonify({"error": "Could not find progress record for this step."}), 404
        progress_id = progress_record['id']

        # Update the progress record
        cur.execute(
            "UPDATE user_roadmap_progress SET is_completed = %s, test_score = %s, completed_at = %s WHERE id = %s",
            (passed, percentage_score, datetime.now() if passed else None, progress_id)
        )
        
        # Save detailed quiz history
        cur.execute(
            "INSERT INTO quiz_history (user_id, progress_id, quiz_title, score, passed, quiz_data) VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, progress_id, quiz_data['quiz_title'], percentage_score, passed, json.dumps(detailed_results))
        )

        # Unlock the next step if the quiz was passed
        if passed:
            cur.execute("SELECT roadmap FROM roadmaps WHERE id = %s", (roadmap_id,))
            roadmap_data = cur.fetchone()['roadmap']
            full_roadmap = json.loads(roadmap_data)['roadmap']

            next_stage_index, next_step_index = stage_index, step_index + 1

            if next_step_index >= len(full_roadmap[stage_index]['steps']):
                next_stage_index, next_step_index = next_stage_index + 1, 0

            if next_stage_index < len(full_roadmap):
                cur.execute(
                    "INSERT INTO user_roadmap_progress (user_id, roadmap_id, stage_index, step_index, is_unlocked) VALUES (%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE is_unlocked = TRUE",
                    (user_id, roadmap_id, next_stage_index, next_step_index, True)
                )

        conn.commit()

        return jsonify({
            "success": True,
            "score": percentage_score,
            "passed": passed,
            "detailed_results": detailed_results
        }), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error submitting quiz: {e}")
        return jsonify({"error": "An error occurred while submitting the quiz."}), 500
    finally:
        cur.close()
        conn.close()

