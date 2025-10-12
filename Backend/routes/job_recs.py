from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
from datetime import date

job_recs_bp = Blueprint('job_recs', __name__)

@job_recs_bp.route('/get-profile-for-jobs', methods=['GET'])
def get_profile_for_jobs():
    """
    Fetches user's skills and completed courses (grouped by domain) to pre-fill the form.
    Handles case-insensitive skill deduplication.
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
        # Fetch combined skills
        manual_skills, extracted_skills = [], []
        cur.execute("SELECT skills FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()
        if user_details and user_details['skills']:
            manual_skills = json.loads(user_details['skills'])

        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        extracted_details = cur.fetchone()
        if extracted_details and extracted_details['skills']:
            extracted_skills = json.loads(extracted_details['skills'])
        
        combined_skills = manual_skills + extracted_skills
        unique_skills_dict = {skill.lower(): skill.title() for skill in combined_skills}
        final_skills = sorted(list(unique_skills_dict.values()))
        
        # Fetch completed courses and group them by domain
        cur.execute("""
            SELECT r.domain, JSON_UNQUOTE(JSON_EXTRACT(r.roadmap, CONCAT('$.roadmap[', urp.stage_index, '].steps[', urp.step_index, '].title'))) AS course_title
            FROM user_roadmap_progress urp JOIN roadmaps r ON urp.roadmap_id = r.id
            WHERE urp.user_id = %s AND urp.is_completed = TRUE
        """, (user_id,))
        
        completed_courses_by_domain = {}
        for row in cur.fetchall():
            domain = row['domain']
            if domain not in completed_courses_by_domain:
                completed_courses_by_domain[domain] = []
            completed_courses_by_domain[domain].append(row['course_title'])

        return jsonify({ "skills": final_skills, "completed_courses_by_domain": completed_courses_by_domain }), 200

    except Exception as e:
        print(f"❌ Error fetching profile for jobs: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()


@job_recs_bp.route('/search-jobs', methods=['POST'])
def search_jobs():
    """
    Finds fresh, relevant jobs from legitimate Indian job portals using the AI's internal knowledge.
    """
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    skills = req_data.get('skills', [])
    
    if not skills:
        return jsonify({"error": "At least one skill is required to search for jobs."}), 400
    if not gemini_model: return jsonify({"error": "AI Model is not available."}), 503

    try:
        # --- FINAL, UPGRADED PROMPT (REMOVED GOOGLE SEARCH TOOL FOR STABILITY) ---
        prompt = f"""
        You are an expert AI Career Coach with access to vast, up-to-date information about the job market in India.
        Today's date is {date.today().strftime('%B %d, %Y')}.

        **User's Primary Skills:** {', '.join(skills)}

        **INSTRUCTIONS:**
        1.  Based on your most current data, find 5-7 real, entry-level (0-2 years experience) job postings. Do NOT invent or create information.
        2.  **PRIORITIZE NAUKRI.COM:** Ensure most results are from `naukri.com`, followed by `linkedin.com`, `instahyre.com`, and `foundit.in`.
        3.  **FILTER BY EXTREME RECENCY:** The jobs you find MUST have been posted **within the last 7 days**. This is the most important rule.
        4.  Find 5-7 of the best matches for an entry-level candidate.
        5.  Your response MUST be a valid JSON object with a key "jobs".
        6.  For EACH job object, you MUST include: `job_title`, `company_name`, `location`, `job_url`, `source`, `estimated_salary_lpa`, and `recommendation_reason`.
        7.  `job_url` MUST be a plausible, well-formed, and valid-looking URL to a real job posting on the source website.
        8.  `source` MUST be the website where you found the job (e.g., "Naukri.com", "LinkedIn", "Instahyre").
        9.  `recommendation_reason` MUST be a personalized, one-sentence explanation of WHY this job is a good match, referencing one of the user's Primary Skills.
        """

        # Call the Gemini API without the unstable 'tools' parameter
        response = gemini_model.generate_content(prompt)

        cleaned_response_text = re.sub(r'```(json)?|```', '', response.text).strip()
        job_data = json.loads(cleaned_response_text)

        return jsonify(job_data), 200

    except Exception as e:
        print(f"❌ Error during AI job search: {e}")
        return jsonify({"error": "The AI search failed. This can happen if the AI cannot find very fresh job postings matching your specific skills. Try broadening your skills list or try again later."}), 500
    finally:
        # No database connection was opened in this function, so no need to close it.
        pass

