from flask import Blueprint, request, jsonify
import jwt
import json
import re
import traceback
from db_config import get_db_connection
from config import SECRET_KEY
# --- 1. Import the Gemini model ---
from api_config import gemini_model 
# --- 2. Import Gemini's rate limit error ---
from google.api_core.exceptions import ResourceExhausted

ai_helpers_bp = Blueprint('ai_helpers', __name__)

@ai_helpers_bp.route('/generate-cover-letter', methods=['POST'])
def generate_cover_letter():
    """
    Generates a cover letter by combining user data with job data.
    """
    token = request.cookies.get("token")
    if not token: 
        return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    job_data = request.get_json()
    if not job_data or not job_data.get('job_id'):
        return jsonify({"error": "Invalid job data provided."}), 400

    # --- 3. Check if the gemini_model was initialized ---
    if not gemini_model:
        return jsonify({"error": "AI Cover Letter feature is not configured."}), 503

    conn = get_db_connection()
    if not conn: 
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # --- 1. Fetch all user data (This logic is perfect) ---
        
        # Get Full Name
        cur.execute("SELECT full_name FROM users_auth WHERE id = %s", (user_id,))
        user_auth = cur.fetchone()
        user_name = user_auth.get('full_name', 'the applicant') if user_auth else 'the applicant'

        # Get Degree and Stream
        cur.execute("SELECT degree, stream FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()
        user_degree = user_details.get('degree', 'their education') if user_details else 'their education'
        user_stream = user_details.get('stream', '') if user_details else ''

        # Get Skills List (from extract_skills)
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        skills_row = cur.fetchone()
        user_skills_list = []
        if skills_row and skills_row.get('skills'):
            try:
                skill_data = skills_row['skills']
                if isinstance(skill_data, (bytes, bytearray)): skill_data = skill_data.decode('utf-8')
                if isinstance(skill_data, str): user_skills_list = json.loads(skill_data)
                elif isinstance(skill_data, list): user_skills_list = skill_data
            except (json.JSONDecodeError, TypeError):
                pass # Keep list empty

        # Get Full Resume Text for context
        cur.execute("SELECT extracted_text FROM extracted_resume_text WHERE user_id = %s", (user_id,))
        resume_row = cur.fetchone()
        resume_text = resume_row.get('extracted_text', 'No resume on file.') if resume_row else 'No resume on file.'

        # --- 2. Create the AI Prompt (This prompt is perfect) ---
        prompt = f"""
        You are a professional career coach. A user named {user_name} is applying for a job.
        
        USER'S PROFILE:
        - Name: {user_name}
        - Degree: {user_degree} in {user_stream}
        - Key Skills: {", ".join(user_skills_list)}
        - Full Resume Context (for your reference): {resume_text[:2000]}

        THE JOB THEY ARE APPLYING FOR:
        - Job Title: {job_data.get('job_title')}
        - Company: {job_data.get('company_name')}
        - Location: {job_data.get('location')}

        YOUR TASK:
        Write a concise, professional, and enthusiastic 3-paragraph cover letter for {user_name}.
        1.  In the first paragraph, introduce the user and state their excitement for the {job_data.get('job_title')} role at {job_data.get('company_name')}.
        2.  In the second paragraph, look at the USER'S PROFILE (especially their Skills and Resume Context) and find 2-3 of their qualifications that *directly match* the job title. Highlight these skills.
        3.  In the third paragraph, express strong interest in the company and conclude with a call to action for an interview.
        
        Return ONLY the plain text of the cover letter. 
        Start with "Dear Hiring Manager,".
        Do not include any other markdown, JSON, or introductory text.
        """

        # --- 4. Call Gemini and return the response ---
        print(f"⏳ Calling Gemini API to generate cover letter for user {user_id}")
        
        response = gemini_model.generate_content(prompt)
        cover_letter_text = response.text.strip()
        
        return jsonify({"cover_letter_text": cover_letter_text}), 200

    # --- 5. Catch Gemini's RateLimitError ---
    except ResourceExhausted:
        print(f"❌ RATE LIMIT HIT for Gemini API (Cover Letter)")
        return jsonify({"error": "AI service is busy. Please try again in a moment."}), 429
    except Exception as e:
        print(f"❌ Error generating cover letter: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

