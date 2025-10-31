# routes/quiz.py
from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
from datetime import datetime, timedelta # Import timedelta
import traceback
import hashlib # Import hashlib for creating identifiers

# Import specific Google API error
from google.api_core.exceptions import ResourceExhausted

quiz_bp = Blueprint('quiz', __name__)

# --- Configuration ---
QUIZ_RETRY_COOLDOWN = timedelta(hours=1) # Set cooldown period (e.g., 1 hour)
PASS_PERCENTAGE = 80 # Define pass percentage
QUIZ_CACHE_VALIDITY = timedelta(days=2) # Cache quiz for 7 days
# ---------------------

def _is_coding_topic(title):
    """Simple helper to check if a topic is likely about coding."""
    coding_keywords = ['python', 'java', 'javascript', 'c++', 'sql', 'html', 'css', 'react', 'flask', 'node.js', 'api']
    return any(keyword in title.lower() for keyword in coding_keywords)

def _normalize_answer(text):
    """Prepares an answer string for flexible comparison."""
    if not isinstance(text, str):
        return ""
    return re.sub(r'[^a-z0-9]', '', text.lower())

# --- MODIFIED: /generate-quiz route with Caching ---
@quiz_bp.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    """
    Generates or retrieves a cached quiz for a learning step.
    Handles Gemini API rate limits by caching results.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    course_title = req_data.get('course_title')
    course_description = req_data.get('course_description')

    if not course_title or not course_description:
        return jsonify({"error": "Course title and description are required."}), 400

    # Create a unique identifier for this quiz topic
    identifier_string = f"{course_title.strip().lower()}::{course_description.strip().lower()}"
    course_identifier = hashlib.sha256(identifier_string.encode('utf-8')).hexdigest()

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor(dictionary=True)

        # --- 1. Check Cache ---
        now = datetime.now()
        cache_expiry_threshold = now - QUIZ_CACHE_VALIDITY

        cur.execute("""
            SELECT id, quiz_title, questions, generated_at
            FROM generated_quizzes
            WHERE course_identifier = %s AND generated_at >= %s
            ORDER BY generated_at DESC
            LIMIT 1
        """, (course_identifier, cache_expiry_threshold))
        cached_quiz = cur.fetchone()

        if cached_quiz and cached_quiz.get('questions'):
            try:
                quiz_questions = json.loads(cached_quiz['questions'])
                if isinstance(quiz_questions, list) and len(quiz_questions) > 0:
                     print(f"✅ Returning cached quiz (ID: {cached_quiz['id']}) for identifier: {course_identifier}")
                     # Update last_used_at timestamp
                     cur.execute("UPDATE generated_quizzes SET last_used_at = %s WHERE id = %s", (now, cached_quiz['id']))
                     conn.commit()
                     return jsonify({
                         "quiz_title": cached_quiz.get('quiz_title', f"Quiz for {course_title}"),
                         "questions": quiz_questions
                     }), 200
                else:
                    print(f"⚠️ Found cached quiz (ID: {cached_quiz['id']}) but questions are invalid/empty. Will regenerate.")
            except (json.JSONDecodeError, TypeError):
                 print(f"⚠️ Found cached quiz (ID: {cached_quiz['id']}) but failed to parse questions JSON. Will regenerate.")
        else:
             print(f"ℹ️ No valid cached quiz found for identifier: {course_identifier}. Will generate new.")
        # --- End Cache Check ---

        # --- 2. Generate New Quiz if Cache Miss ---
        if not gemini_model:
            return jsonify({"error": "AI Model is not available."}), 503

        # AI Prompt
        coding_instructions = ""
        if _is_coding_topic(course_title):
            coding_instructions = """
            - **Coding Questions:** Since this is a coding topic, include at least 5 `coding` type questions. For these, provide a problem description and a simple example of the expected output. The `correct_answer` should be a functional block of code.
            """
        prompt = f"""
        You are an expert technical instructor. Create a comprehensive quiz with 15 to 25 questions for a learning step titled "{course_title}" with the description "{course_description}".
        RULES:
        1.  **JSON Format:** MUST be a valid JSON object.
        2.  **Question Types:** Mix of `multiple-choice`, `short-answer`, and `coding` (if applicable).
        3.  **Correct Answer:** Provide `correct_answer` for ALL questions. For short-answer, include common abbreviations in parentheses.
        {coding_instructions}
        JSON structure MUST be:
        {{
          "quiz_title": "Quiz for {course_title}",
          "questions": [ {{ "question_text": "...", "type": "...", "options": [...], "correct_answer": "..." }}, ... ]
        }}
        Generate ONLY the JSON object.
        """

        try:
            print(f"⏳ Calling Gemini API to generate quiz for: {course_title}")
            response = gemini_model.generate_content(prompt)
            cleaned_response_text = re.sub(r'^```(json)?\s*|\s*```$', '', response.text, flags=re.MULTILINE | re.DOTALL).strip()

            quiz_data = json.loads(cleaned_response_text)
            if ("quiz_title" not in quiz_data or
                "questions" not in quiz_data or
                not isinstance(quiz_data['questions'], list) or
                len(quiz_data['questions']) == 0):
                raise ValueError("AI response missing required keys or questions list is empty/invalid.")

            for q in quiz_data['questions']:
                if not q.get('question_text') or q.get('correct_answer') is None or not q.get('type'):
                    raise ValueError(f"Malformed question found: {q}")
                if q['type'] == 'multiple-choice' and not isinstance(q.get('options'), list):
                     raise ValueError(f"Multiple-choice question missing options: {q.get('question_text')}")

        # Handle Specific Rate Limit Error
        except ResourceExhausted as rate_limit_error:
            print(f"❌ RATE LIMIT HIT for Gemini API: {rate_limit_error}")
            retry_seconds = 30 # Default
            match = re.search(r'retry in (\d+\.?\d*)s', str(rate_limit_error), re.IGNORECASE)
            if match:
                 try: retry_seconds = max(5, int(float(match.group(1)) + 1))
                 except ValueError: pass
            return jsonify({
                "error": f"Quiz generation is busy due to high demand. Please try again in about {retry_seconds} seconds.",
                "retry_after": retry_seconds
            }), 429 # Too Many Requests
        # Handle JSON/Validation Errors
        except (json.JSONDecodeError, ValueError) as json_error:
            print(f"❌ Error parsing AI quiz response for '{course_title}': {json_error}")
            print(f"--- Raw AI Response ---:\n{response.text if 'response' in locals() else 'N/A'}\n--- End Raw AI Response ---")
            return jsonify({"error": "AI generated an invalid quiz format. Cannot proceed."}), 500
        # Handle Other Gemini/General Errors
        except Exception as e:
            print(f"❌ Error generating quiz via API for '{course_title}': {e}")
            traceback.print_exc()
            return jsonify({"error": "Failed to generate quiz due to an unexpected AI error."}), 500

        # --- 3. Store Newly Generated Quiz in Cache ---
        try:
            quiz_title_to_save = quiz_data.get('quiz_title', f"Quiz for {course_title}")
            questions_to_save = json.dumps(quiz_data['questions'])

            cur.execute("""
                INSERT INTO generated_quizzes (course_identifier, quiz_title, questions, generated_at, last_used_at)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    quiz_title = VALUES(quiz_title),
                    questions = VALUES(questions),
                    generated_at = VALUES(generated_at),
                    last_used_at = VALUES(last_used_at)
            """, (course_identifier, quiz_title_to_save, questions_to_save, now, now))
            conn.commit()
            print(f"✅ Saved newly generated quiz to cache for identifier: {course_identifier}")

        except Exception as db_error:
            conn.rollback()
            print(f"⚠️ WARNING: Failed to save generated quiz to cache: {db_error}")

        # --- 4. Return the Newly Generated Quiz ---
        return jsonify(quiz_data), 200

    except Exception as e:
        print(f"❌ Unexpected error in generate_quiz endpoint: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- NEW ROUTE: Check Quiz Eligibility ---
@quiz_bp.route('/check-quiz-eligibility', methods=['POST'])
def check_quiz_eligibility():
    """
    Checks if a user can attempt/reattempt a quiz for a specific roadmap step.
    Considers pass status and cooldown period for failed attempts.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    roadmap_id = req_data.get('roadmap_id')
    stage_index = req_data.get('stage_index')
    step_index = req_data.get('step_index')

    if roadmap_id is None or stage_index is None or step_index is None:
        return jsonify({"error": "Missing roadmap details (ID, stage, step)."}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor(dictionary=True)

        # 1. Check if the step is already marked as completed in progress table
        cur.execute("""
            SELECT id, is_completed
            FROM user_roadmap_progress
            WHERE user_id = %s AND roadmap_id = %s AND stage_index = %s AND step_index = %s
        """, (user_id, roadmap_id, stage_index, step_index))
        progress_record = cur.fetchone()

        if progress_record and progress_record['is_completed']:
            return jsonify({"eligible": False, "reason": "already_completed"}), 200

        # 2. Find the *most recent* attempt for this specific step in quiz_history
        if not progress_record:
             # This means the step is unlocked, but no progress record exists yet.
             return jsonify({"eligible": True}), 200

        progress_id = progress_record['id']

        cur.execute("""
            SELECT passed, attempted_at
            FROM quiz_history
            WHERE progress_id = %s
            ORDER BY attempted_at DESC
            LIMIT 1
        """, (progress_id,))
        last_attempt = cur.fetchone()

        if not last_attempt:
            return jsonify({"eligible": True}), 200 # No previous attempts, eligible

        if last_attempt['passed']:
            return jsonify({"eligible": False, "reason": "already_passed"}), 200

        # Last attempt was a failure, check cooldown
        now = datetime.now()
        retry_allowed_after = last_attempt['attempted_at'] + QUIZ_RETRY_COOLDOWN

        if now >= retry_allowed_after:
            return jsonify({"eligible": True}), 200 # Cooldown passed
        else:
            time_remaining = retry_allowed_after - now
            minutes_remaining = max(1, round(time_remaining.total_seconds() / 60))
            return jsonify({
                "eligible": False,
                "reason": "cooldown_active",
                "retry_after_timestamp": retry_allowed_after.isoformat(),
                "minutes_remaining": minutes_remaining
            }), 200

    except Exception as e:
        print(f"❌ Error checking quiz eligibility: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred checking eligibility."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- MODIFIED: /submit-quiz route (Uses PASS_PERCENTAGE, adds attempted_at) ---
@quiz_bp.route('/submit-quiz', methods=['POST'])
def submit_quiz():
    """
    Evaluates quiz answers, saves history, updates progress, unlocks next step.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
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

    if not all([user_answers, quiz_data, roadmap_id, stage_index is not None, step_index is not None]):
        return jsonify({"error": "Missing quiz submission data."}), 400

    questions = quiz_data.get('questions')
    if not isinstance(questions, list) or len(questions) == 0:
        print(f"❌ Invalid or empty questions list received in submit_quiz for user {user_id}")
        return jsonify({"error": "Invalid quiz data received."}), 400
    
    # Calculate total questions, skipping any malformed ones
    total_questions = 0
    valid_questions = []
    for q in questions:
        if q and q.get('question_text') and q.get('correct_answer') is not None:
            valid_questions.append(q)
            total_questions += 1
        else:
            print(f"⚠️ Skipping malformed question during submit: {q}")

    if total_questions == 0:
        return jsonify({"error": "No valid questions found in quiz data."}), 400

    score = 0
    detailed_results = []
    current_time = datetime.now()

    for q in valid_questions: # Iterate over valid questions only
        q_text = q['question_text']
        correct_ans = q['correct_answer']
        
        user_ans = next((a.get('answer') for a in user_answers if a.get('question_text') == q_text), None)
        is_correct = False
        
        norm_user_ans = _normalize_answer(user_ans)
        norm_correct_ans = _normalize_answer(correct_ans)

        if norm_user_ans and norm_correct_ans:
            if norm_user_ans in norm_correct_ans or norm_correct_ans in norm_user_ans:
                is_correct = True

        if is_correct:
            score += 1
        
        detailed_results.append({
            "question": q_text,
            "user_answer": user_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct
        })

    percentage_score = (score / total_questions) * 100
    passed = percentage_score >= PASS_PERCENTAGE

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # Find or create the progress record ID
        cur.execute(
            "SELECT id FROM user_roadmap_progress WHERE user_id = %s AND roadmap_id = %s AND stage_index = %s AND step_index = %s",
            (user_id, roadmap_id, stage_index, step_index)
        )
        progress_record = cur.fetchone()
        
        if not progress_record:
             cur.execute(
                 """INSERT INTO user_roadmap_progress (user_id, roadmap_id, stage_index, step_index, is_unlocked)
                    VALUES (%s, %s, %s, %s, %s)""",
                 (user_id, roadmap_id, stage_index, step_index, True)
             )
             progress_id = cur.lastrowid
             print(f"INFO: Created missing progress record (ID: {progress_id}) for user {user_id} on quiz submit.")
        else:
            progress_id = progress_record['id']

        # Update the progress record
        cur.execute(
            "UPDATE user_roadmap_progress SET is_completed = %s, test_score = %s, completed_at = %s WHERE id = %s",
            (passed, percentage_score, current_time if passed else None, progress_id)
        )
        
        # Save detailed quiz history with attempt time
        cur.execute(
            "INSERT INTO quiz_history (user_id, progress_id, quiz_title, score, passed, quiz_data, attempted_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (user_id, progress_id, quiz_data.get('quiz_title', "Quiz"), percentage_score, passed, json.dumps(detailed_results), current_time)
        )

        # Unlock the next step if the quiz was passed
        if passed:
            cur.execute("SELECT roadmap FROM roadmaps WHERE id = %s", (roadmap_id,))
            roadmap_record = cur.fetchone()
            if roadmap_record and roadmap_record.get('roadmap'):
                roadmap_data = roadmap_record['roadmap']
                full_roadmap_data = json.loads(roadmap_data)
                
                if isinstance(full_roadmap_data, dict) and 'roadmap' in full_roadmap_data and isinstance(full_roadmap_data['roadmap'], list):
                    full_roadmap = full_roadmap_data['roadmap']

                    if stage_index < len(full_roadmap) and isinstance(full_roadmap[stage_index], dict) and 'steps' in full_roadmap[stage_index] and isinstance(full_roadmap[stage_index]['steps'], list):
                        
                        next_stage_index, next_step_index = stage_index, step_index + 1
                        
                        if next_step_index >= len(full_roadmap[stage_index]['steps']):
                            next_stage_index, next_step_index = next_stage_index + 1, 0
                        
                        if next_stage_index < len(full_roadmap):
                             if (next_stage_index < len(full_roadmap) and
                                 isinstance(full_roadmap[next_stage_index], dict) and
                                 'steps' in full_roadmap[next_stage_index] and
                                 isinstance(full_roadmap[next_stage_index]['steps'], list) and
                                 next_step_index < len(full_roadmap[next_stage_index]['steps'])):

                                cur.execute(
                                    "INSERT INTO user_roadmap_progress (user_id, roadmap_id, stage_index, step_index, is_unlocked) VALUES (%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE is_unlocked = TRUE",
                                    (user_id, roadmap_id, next_stage_index, next_step_index, True)
                                )
                             else:
                                 print(f"⚠️ Warning: Next step ({next_stage_index}, {next_step_index}) seems invalid. Not unlocking.")
                        else:
                             print(f"✅ User {user_id} completed the last step of the roadmap.")
                    else:
                        print(f"⚠️ Warning: Roadmap structure seems invalid or stage_index {stage_index} out of bounds.")
                else:
                    print(f"⚠️ Warning: Roadmap JSON for ID {roadmap_id} is missing 'roadmap' key or is not a list.")
            else:
                 print(f"⚠️ Warning: Could not find roadmap data for ID {roadmap_id} to unlock next step.")

        conn.commit()

        return jsonify({
            "success": True, "score": percentage_score,
            "passed": passed, "detailed_results": detailed_results
        }), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error submitting quiz: {e}")
        traceback.print_exc()
        return jsonify({"error": "An error occurred while submitting the quiz."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()