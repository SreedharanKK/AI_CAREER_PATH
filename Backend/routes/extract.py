from flask import Blueprint, request, jsonify
import os
import json
import re
import jwt
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model  # Import the initialized Gemini model

extract_bp = Blueprint('extract', __name__)

@extract_bp.route('/extract-skills', methods=['POST'])
def extract_and_store_skills():
    """
    Extracts technical skills from a user's resume using the Gemini API
    and stores them in the database.
    """
    # --- Step 1: Securely identify the user via JWT token ---
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required. Not logged in."}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session. Please log in again."}), 401

    # --- Step 2: Get the path to the user's extracted resume text ---
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500

    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT extracted_path FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()

        if not user_details or not user_details['extracted_path']:
            return jsonify({"error": "No resume found for this user. Please upload one first."}), 404

        # --- Step 3: Read the resume content from the file ---
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(base_dir, user_details['extracted_path'])

        if not os.path.exists(file_path):
            return jsonify({"error": "Extracted resume file not found on server."}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            resume_content = f.read()

        # --- Step 4: Use Gemini API to extract skills ---
        if not gemini_model:
            return jsonify({"error": "AI Model is not available at the moment."}), 503

        # Construct a precise prompt for the AI
        prompt = f"""
        Analyze the following resume text and extract all technical skills.
        Focus on programming languages, frameworks, libraries, databases, cloud technologies, and software tools.
        Return the skills as a single, comma-separated string. Do not include any explanation or introductory text.
        
        Example output: Python, React, Node.js, Express, MongoDB, Docker, AWS, Git, Figma

        Resume Text:
        ---
        {resume_content}
        ---
        """

        response = gemini_model.generate_content(prompt)
        
        # Clean up the AI's response to get a clean list
        # Removes potential markdown formatting and leading/trailing spaces
        skills_text = re.sub(r'```(json|python)?|```', '', response.text).strip()
        skills_list = [skill.strip() for skill in skills_text.split(',') if skill.strip()]

        if not skills_list:
            return jsonify({"message": "No specific technical skills were identified in the resume."}), 200

        # --- Step 5: Store the extracted skills in the new table ---
        # First, delete any old skills for this user to avoid duplicates
        cur.execute("DELETE FROM extract_skills WHERE user_id = %s", (user_id,))

        # Then, insert the new list of skills
        cur.execute(
            "INSERT INTO extract_skills (user_id, skills) VALUES (%s, %s)",
            (user_id, json.dumps(skills_list))
        )
        conn.commit()

        return jsonify({
            "success": True,
            "message": f"Successfully extracted {len(skills_list)} skills.",
            "extracted_skills": skills_list
        }), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error during skill extraction: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()
