from flask import Blueprint, request, jsonify
import os
import json
import re
import jwt
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model

skill_gap_bp = Blueprint('skill_gap', __name__)

# --- GET User Skills Route (FIXED) ---
@skill_gap_bp.route('/skill-gap/skills', methods=['GET'])
def get_user_skills():
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Not logged in"}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session"}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cur = conn.cursor(dictionary=True)
    try:
        manual_skills, extracted_skills = [], []
        
        # --- Query 1 for manual skills ---
        cur.execute("SELECT skills FROM user_details WHERE user_id = %s", (user_id,))
        # ✅ FIX: Use fetchall() to fully consume the results, then get the first item.
        user_details_rows = cur.fetchall()
        user_details = user_details_rows[0] if user_details_rows else None
        
        if user_details and user_details.get('skills'):
            # The 'skills' column might be a JSON string or already parsed
            skills_data = user_details['skills']
            if isinstance(skills_data, str):
                manual_skills = json.loads(skills_data)
            elif isinstance(skills_data, list):
                manual_skills = skills_data


        # --- Query 2 for extracted skills ---
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        # ✅ FIX: Use fetchall() again for the second query.
        extracted_details_rows = cur.fetchall()
        extracted_details = extracted_details_rows[0] if extracted_details_rows else None

        if extracted_details and extracted_details.get('skills'):
            skills_data = extracted_details['skills']
            if isinstance(skills_data, str):
                extracted_skills = json.loads(skills_data)
            elif isinstance(skills_data, list):
                extracted_skills = skills_data

        # Combine, deduplicate, and sort skills
        combined_skills = manual_skills + extracted_skills
        unique_skills_dict = {skill.lower(): skill for skill in reversed(combined_skills) if skill} # Ensure skill is not empty
        final_skills = sorted([s.title() for s in unique_skills_dict.values()])
        
        return jsonify({"skills": final_skills})
    except Exception as e:
        print(f"Error fetching combined skills: {e}")
        return jsonify({"error": "An error occurred while fetching skills"}), 500
    finally:
        cur.close()
        conn.close()

# --- Analyze Skill Gap Route (No changes needed) ---
@skill_gap_bp.route('/skill-gap/analyze', methods=['POST'])
def analyze_skill_gap():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Not logged in"}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session"}), 401

    req_data = request.get_json()
    current_skills = req_data.get('skills', [])
    domain = req_data.get('domain')

    if not domain: return jsonify({"error": "Domain is required"}), 400
    if not gemini_model: return jsonify({"error": "AI Model not available"}), 503

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed"}), 500
    
    cur = conn.cursor()
    try:
        prompt = f"""
        You are an expert career counselor for tech students. Analyze the skill gap for a student with these details:
        - Current Skills: {', '.join(current_skills)}
        - Desired Career Domain: {domain}
        Your response MUST be a valid JSON object with two keys: "missing_skills" and "recommendations".
        "missing_skills" should be a list of strings (skill names only).
        "recommendations" should be a list of strings (simple, beginner-friendly learning ideas).
        """
        response = gemini_model.generate_content(prompt)
        cleaned_response_text = re.sub(r'```(json)?|```', '', response.text).strip()
        analysis_result = json.loads(cleaned_response_text)
        
        missing = analysis_result.get("missing_skills", [])
        recommendations = analysis_result.get("recommendations", [])

        cur.execute("DELETE FROM skill_gap_analysis WHERE user_id = %s AND interested_domain = %s", (user_id, domain))
        cur.execute("""
            INSERT INTO skill_gap_analysis (user_id, current_skills, interested_domain, missing_skills, recommended_courses)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id, json.dumps(current_skills), domain,
            json.dumps(missing), json.dumps(recommendations)
        ))
        conn.commit()

        return jsonify({
            "interested_domain": domain,
            "missing_skills": missing,
            "recommendations": recommendations
        })
    except Exception as e:
        conn.rollback()
        print(f"Error during AI skill gap analysis: {e}")
        return jsonify({"error": "An error occurred during the analysis"}), 500
    finally:
        cur.close()
        conn.close()

# --- Get Latest Analysis Route (No changes needed) ---
@skill_gap_bp.route('/skill-gap/latest', methods=['GET'])
def get_latest_analysis():
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
        cur.execute(
            """
            SELECT interested_domain, missing_skills, recommended_courses 
            FROM skill_gap_analysis 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            (user_id,)
        )
        latest_record = cur.fetchone()

        if not latest_record:
            return jsonify({"message": "No analysis found."}), 200

        if latest_record.get('missing_skills'):
            latest_record['missing_skills'] = json.loads(latest_record['missing_skills'])
        else:
            latest_record['missing_skills'] = []
            
        if latest_record.get('recommended_courses'):
            latest_record['recommendations'] = json.loads(latest_record['recommended_courses'])
        else:
            latest_record['recommendations'] = []
            
        return jsonify({"analysis": latest_record}), 200

    except Exception as e:
        print(f"❌ Error fetching latest analysis: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()

# --- Get Last Domain Route (No changes needed) ---
@skill_gap_bp.route('/skill-gap/last-domain', methods=['GET'])
def get_last_analysis_domain():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required"}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session"}), 401
    
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed"}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT interested_domain FROM skill_gap_analysis WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user_id,)
        )
        record = cur.fetchone()
        if record:
            return jsonify({"last_domain": record['interested_domain']}), 200
        else:
            return jsonify({"last_domain": None}), 200
    except Exception as e:
        print(f"Error fetching last analysis domain: {e}")
        return jsonify({"error": "Could not fetch last domain"}), 500
    finally:
        cur.close()
        conn.close()
