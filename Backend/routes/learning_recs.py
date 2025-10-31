from flask import Blueprint, request, jsonify
import jwt
import json, traceback
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
from google.api_core.exceptions import ResourceExhausted
from datetime import datetime
import os
from google.api_core.exceptions import ResourceExhausted

learning_recs_bp = Blueprint('learning_recs', __name__)

def _generate_and_save_recommendations(user_id, cur, conn):
    """
    A helper function that contains the logic to generate, save,
    and return new, more detailed learning recommendations.
    """
    # Fetch user details to generate new recommendations
    cur.execute("SELECT degree, stream FROM user_details WHERE user_id = %s", (user_id,))
    details_row = cur.fetchone()
    cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
    skills_row = cur.fetchone()
    
    resume_text = None
    cur.execute("SELECT extracted_text FROM extracted_resume_text WHERE user_id = %s", (user_id,))
    text_row = cur.fetchone()
    if text_row and text_row.get('extracted_text'):
        resume_text = text_row['extracted_text']
        print(f"✅ Successfully read {len(resume_text)} chars from resume text in DB for user {user_id}.")
    else:
        print(f"ℹ️ No resume text found in DB for user {user_id}.")
    
    known_degree = details_row.get('degree') if details_row else None
    known_stream = details_row.get('stream') if details_row else None
    
    skills_list = []
    skills_list = []
    if skills_row and skills_row.get('skills'):
        try:
            skill_data = skills_row['skills']
            if isinstance(skill_data, (bytes, bytearray)): skill_data = skill_data.decode('utf-8')
            skills_list = json.loads(skill_data) if isinstance(skill_data, str) else skill_data
            if not isinstance(skills_list, list): skills_list = []
        except (json.JSONDecodeError, TypeError): 
            skills_list = []
    
    if not skills_list and details_row and details_row.get('skills'):
        try:
            skill_data = details_row['skills']
            if isinstance(skill_data, (bytes, bytearray)): skill_data = skill_data.decode('utf-8')
            skills_list = json.loads(skill_data) if isinstance(skill_data, str) else skill_data
            if not isinstance(skills_list, list): skills_list = []
        except (json.JSONDecodeError, TypeError):
            skills_list = []

    # Check if we have *any* data to work with
    if not known_degree and not known_stream and not resume_text:
        print(f"User {user_id} has no profile details or resume text. Cannot generate recs.")
        return {"error": "Please update your profile (degree/stream) or upload a resume first."}, 404
    
    if not gemini_model:
        return {"error": "AI Model is not available."}, 503

    # --- UPDATED & STRICTER AI Prompt Engineering ---
    prompt = f"""
    You are an expert AI career advisor. Your task is to analyze a student's profile and provide personalized learning recommendations.

    Here is the student's data:
    1.  **Known Degree:** "{known_degree or 'N/A'}"
    2.  **Known Stream:** "{known_stream or 'N/A'}"
    3.  **Known Skills:** {json.dumps(skills_list)}
    4.  **Full Resume Text:** "{resume_text or 'No resume text available'}"

    Your multi-step task:

    **Step 1: Determine Profile.**
    - First, determine the student's degree and stream.
    - If 'Known Degree' and 'Known Stream' are present and not 'N/A', use them.
    - If they are 'N/A', you MUST infer the degree (e.g., "B.Tech", "BSc") and stream (e.g., "Computer Science", "Electronics") from the 'Full Resume Text'.
    - If no text is available and no details are set, use "Unknown" for both.

    **Step 2: Analyze Context.**
    - Analyze the 'Known Skills' list AND the 'Full Resume Text'.
    - Identify key technologies, projects, and programming languages the user is comfortable with.
    - Look for gaps. For example:
        - If they list 'React' and 'Node.js' but no database, recommend 'SQL' or 'MongoDB'.
        - If they list 'Python' and 'Flask' projects, recommend 'Docker' or 'REST API Design'.
        - If their resume shows only beginner projects, recommend a more complex project.

    **Step 3: Generate Recommendations.**
    - Based on the *complete profile* (inferred degree/stream + skills + projects), generate 3-4 specific, actionable learning recommendations.
    - These recommendations must be the *next logical step* for someone with their *exact* profile, not generic beginner advice (unless they are clearly a beginner).

    **Step 4: Format the Output.**
    - Return a SINGLE valid JSON object.
    - The JSON MUST have three keys: "degree", "stream", and "recommendations".
    - "degree" and "stream" should be the values you determined in Step 1.
    - "recommendations" must be a list of objects.
    - FOR EACH object in the "recommendations" list, you MUST include ALL EIGHT of the following string keys: "topic", "skills_to_learn" (as a comma-separated string or list), "current_scope", "future_scope", "getting_started", "estimated_time", "project_idea", and "interview_question".
    - Do NOT omit any of the 8 keys from any recommendation object.

    Example of a single recommendation object:
    {{
      "topic": "Containerization with Docker",
      "skills_to_learn": "Dockerfile, Docker Compose, Image Registry",
      "current_scope": "Highly in-demand for backend development to ensure consistent environments.",
      "future_scope": "Essential for microservices, cloud deployment, and DevOps roles.",
      "getting_started": "Start by containerizing your existing Flask application with a Dockerfile.",
      "estimated_time": "1-2 weeks",
      "project_idea": "Create a multi-container app using Docker Compose with your Flask API and a database.",
      "interview_question": "What is the difference between a Docker image and a Docker container?"
    }}

    Generate the full JSON response now. Do NOT include ```json markdown.
    """

    try:
        print(f"⏳ Calling Gemini API to generate SMART recommendations for user {user_id}")
        response = gemini_model.generate_content(prompt)
        cleaned_response_text = re.sub(r'^```(json)?\s*|\s*```$', '', response.text, flags=re.MULTILINE | re.DOTALL).strip()

        # Parse the AI's response
        data = json.loads(cleaned_response_text)
        
        # Validate the AI's response
        if not all(k in data for k in ["degree", "stream", "recommendations"]) or not isinstance(data["recommendations"], list):
            raise ValueError("AI response missing required keys or 'recommendations' is not a list.")
        
        # --- Validate each recommendation item ---
        validated_recs = []
        for item in data["recommendations"]:
            if not isinstance(item, dict) or not all(k in item for k in ["topic", "skills_to_learn", "current_scope", "future_scope", "getting_started", "estimated_time", "project_idea", "interview_question"]):
                print(f"⚠️ AI returned a malformed recommendation, skipping: {item}")
                continue # Skip this item
            # Convert skills_to_learn to string if it's a list (for consistency, though JSON can handle lists)
            if isinstance(item["skills_to_learn"], list):
                item["skills_to_learn"] = ", ".join(item["skills_to_learn"])
            validated_recs.append(item)

        if not validated_recs:
             raise ValueError("AI returned recommendations, but all were malformed.")
             
        data["recommendations"] = validated_recs # Use the validated list

        # Save the newly generated recommendations to the database
        cur.execute(
            """
            INSERT INTO learning_recommendations (user_id, degree, stream, recommendations, generated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                degree=VALUES(degree), 
                stream=VALUES(stream), 
                recommendations=VALUES(recommendations),
                generated_at=VALUES(generated_at)
            """,
            (user_id, data["degree"], data["stream"], json.dumps(data["recommendations"]), datetime.now())
        )
        conn.commit()
        print(f"✅ Saved new SMART recommendations for user {user_id}")

        # Return the full data to the frontend
        return data, 200

    # Handle Specific Rate Limit Error
    except ResourceExhausted as rate_limit_error:
        print(f"❌ RATE LIMIT HIT for Gemini API (Learning Recs): {rate_limit_error}")
        return {"error": "AI service is busy. Please try again in a moment."}, 429
    # Handle JSON/Validation Errors
    except (json.JSONDecodeError, ValueError) as json_error:
        print(f"❌ Error parsing AI recommendation response for user {user_id}: {json_error}")
        print(f"--- Raw AI Response ---:\n{response.text if 'response' in locals() else 'N/A'}\n---")
        return {"error": "AI generated an invalid response. Please try again."}, 500
    # Handle Other Errors
    except Exception as e:
        print(f"❌ Error in _generate_and_save_recommendations: {e}")
        traceback.print_exc()
        return {"error": "Failed to generate recommendations due to an internal error."}, 500

@learning_recs_bp.route('/learning-recommendations', methods=['GET'])
def get_learning_recommendations():
    """
    Fetches existing learning recommendations. If none are found, it automatically
    generates them for the first time.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # Check for existing recommendations
        cur.execute("SELECT degree, stream, recommendations FROM learning_recommendations WHERE user_id = %s", (user_id,))
        existing_recs = cur.fetchone()
        if existing_recs and existing_recs['recommendations']:
            # Validate that the stored JSON is not empty
            recs_json = json.loads(existing_recs['recommendations'])
            if recs_json:
                return jsonify({
                    "degree": existing_recs['degree'],
                    "stream": existing_recs['stream'],
                    "recommendations": recs_json
                }), 200
        
        # If no recommendations exist or they are empty, generate them
        response, status_code = _generate_and_save_recommendations(user_id, cur, conn)
        return jsonify(response), status_code

    except Exception as e:
        print(f"❌ Error in get_learning_recommendations: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()

@learning_recs_bp.route('/learning-recommendations/generate', methods=['POST'])
def generate_new_learning_recommendations():
    """
    Forces the generation of new learning recommendations, overwriting any old ones.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        response, status_code = _generate_and_save_recommendations(user_id, cur, conn)
        return jsonify(response), status_code
    except Exception as e:
        conn.rollback()
        print(f"❌ Error in generate_new_learning_recommendations: {e}")
        return jsonify({"error": "Failed to generate new recommendations."}), 500
    finally:
        cur.close()
        conn.close()

@learning_recs_bp.route('/learning-recommendations/latest', methods=['GET'])
def get_latest_recommendations_summary():
    """
    Finds and returns a summary (list of topics) of the most recent
    learning recommendations for the authenticated user.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT recommendations FROM learning_recommendations WHERE user_id = %s ORDER BY generated_at DESC LIMIT 1",
            (user_id,)
        )
        latest_record = cur.fetchone()

        if not latest_record or not latest_record['recommendations']:
            return jsonify({"message": "No recommendations found."}), 200

        # Parse the JSON and extract just the topic titles for the summary
        recommendations_list = json.loads(latest_record['recommendations'])
        topics = [rec.get('topic', 'N/A') for rec in recommendations_list if isinstance(rec, dict)]

        return jsonify({"recommendations_summary": {"topics": topics}}), 200

    except Exception as e:
        print(f"❌ Error fetching latest recommendations summary: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()