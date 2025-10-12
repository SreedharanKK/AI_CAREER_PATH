from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model

learning_recs_bp = Blueprint('learning_recs', __name__)

def _generate_and_save_recommendations(user_id, cur, conn):
    """
    A helper function that contains the logic to generate, save,
    and return new, more detailed learning recommendations.
    """
    # Fetch user details to generate new recommendations
    cur.execute("SELECT degree, stream FROM user_details WHERE user_id = %s", (user_id,))
    user_details = cur.fetchone()
    if not user_details or not user_details.get('degree') or not user_details.get('stream'):
        return {"error": "Your Degree and Stream must be set in your profile to get recommendations."}, 404
    
    degree = user_details['degree']
    stream = user_details['stream']

    if not gemini_model:
        return {"error": "AI Model is not available."}, 503

    # --- UPDATED & STRICTER AI Prompt Engineering ---
    prompt = f"""
    You are an expert academic and career advisor for technology students in India.
    A student has the following profile:
    - Degree: {degree}
    - Stream: {stream}

    Your task is to provide a list of 3 to 5 key learning recommendations tailored to this profile.

    **CRITICAL RULES:**
    1. Your response MUST be a single, valid JSON object with a key "recommendations", which is a list of objects.
    2. FOR EACH recommendation object in the list, you MUST include ALL EIGHT of the following fields: `topic`, `skills_to_learn`, `current_scope`, `future_scope`, `getting_started`, `estimated_time`, `project_idea`, and `interview_question`.
    3. Do NOT omit any fields. Every recommendation must be complete.

    Here is an example of a single, PERFECT recommendation object structure:
    {{
      "topic": "Cloud-Native DevOps",
      "skills_to_learn": ["Docker", "Kubernetes", "CI/CD Pipelines", "Terraform", "Prometheus"],
      "current_scope": "Extremely high demand. Most tech companies require developers to have at least basic knowledge of containerization and orchestration for scalable applications.",
      "future_scope": "Will become a fundamental skill, as essential as Git. The focus will shift towards serverless containers and multi-cloud management.",
      "getting_started": "Start by installing Docker on your machine and containerizing a simple 'Hello, World' web application you've already built.",
      "estimated_time": "4-6 weeks",
      "project_idea": "Create a CI/CD pipeline using GitHub Actions that automatically builds, tests, and deploys a simple web application to a cloud service.",
      "interview_question": "Explain the difference between a Docker container and a virtual machine. When would you use one over the other?"
    }}
    
    Now, generate the full JSON response containing the list of recommendations.
    """

    response = gemini_model.generate_content(prompt)
    # Added robust cleaning to handle potential markdown in the AI response
    cleaned_response_text = re.sub(r'^```(json)?|```$', '', response.text, flags=re.MULTILINE).strip()
    recommendations_data = json.loads(cleaned_response_text)

    # Save the newly generated recommendations to the database
    cur.execute(
        "INSERT INTO learning_recommendations (user_id, degree, stream, recommendations) VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE degree=VALUES(degree), stream=VALUES(stream), recommendations=VALUES(recommendations)",
        (user_id, degree, stream, json.dumps(recommendations_data['recommendations']))
    )
    conn.commit()

    return {
        "degree": degree,
        "stream": stream,
        "recommendations": recommendations_data['recommendations']
    }, 200

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

