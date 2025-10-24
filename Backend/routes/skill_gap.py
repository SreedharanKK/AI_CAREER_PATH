from flask import Blueprint, request, jsonify
import os
import json
import re
import jwt
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
import traceback # Import traceback for detailed error logging

skill_gap_bp = Blueprint('skill_gap', __name__)

# --- GET User Skills Route (No changes needed from previous version) ---
@skill_gap_bp.route('/skill-gap/skills', methods=['GET'])
def get_user_skills():
    token = request.cookies.get("token")
    user_id = None # Initialize user_id
    if not token:
        return jsonify({"error": "Authentication required. Not logged in."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as jwt_error:
        print(f"JWT Error in get_user_skills: {jwt_error}")
        return jsonify({"error": "Invalid or expired session. Please log in again."}), 401

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
            print("Error: Database connection failed in get_user_skills")
            return jsonify({"error": "Database connection failed"}), 500

        cur = conn.cursor(dictionary=True)
        manual_skills, extracted_skills = [], []

        # --- Query 1 for manual skills ---
        cur.execute("SELECT skills FROM user_details WHERE user_id = %s", (user_id,))
        user_details_rows = cur.fetchall()
        user_details = user_details_rows[0] if user_details_rows else None

        if user_details and user_details.get('skills') is not None:
            skills_data = user_details['skills']
            if isinstance(skills_data, (bytes, bytearray)):
                skills_data = skills_data.decode('utf-8')
            if isinstance(skills_data, str):
                try:
                    manual_skills = json.loads(skills_data)
                    if not isinstance(manual_skills, list):
                         print(f"Warning: Manual skills JSON for user {user_id} decoded to non-list type: {type(manual_skills)}")
                         manual_skills = []
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode manual skills JSON for user {user_id}. Data: '{skills_data}'")
                    manual_skills = []
            elif isinstance(skills_data, list):
                manual_skills = skills_data
            else:
                 print(f"Warning: Manual skills data for user {user_id} is unexpected type: {type(skills_data)}")
                 manual_skills = []


        # --- Query 2 for extracted skills ---
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        extracted_details_rows = cur.fetchall()
        extracted_details = extracted_details_rows[0] if extracted_details_rows else None

        if extracted_details and extracted_details.get('skills') is not None:
            skills_data = extracted_details['skills']
            if isinstance(skills_data, (bytes, bytearray)):
                 skills_data = skills_data.decode('utf-8')
            if isinstance(skills_data, str):
                try:
                    extracted_skills = json.loads(skills_data)
                    if not isinstance(extracted_skills, list):
                         print(f"Warning: Extracted skills JSON for user {user_id} decoded to non-list type: {type(extracted_skills)}")
                         extracted_skills = []
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode extracted skills JSON for user {user_id}. Data: '{skills_data}'")
                    extracted_skills = []
            elif isinstance(skills_data, list):
                extracted_skills = skills_data
            else:
                 print(f"Warning: Extracted skills data for user {user_id} is unexpected type: {type(skills_data)}")
                 extracted_skills = []

        combined_skills_raw = manual_skills + extracted_skills
        combined_skills_str = [str(skill).strip() for skill in combined_skills_raw if skill is not None and str(skill).strip()]

        unique_skills_dict = {skill.lower(): skill for skill in reversed(combined_skills_str)}
        final_skills = sorted([s.title() for s in unique_skills_dict.values()])

        return jsonify({"skills": final_skills})

    except Exception as e:
        print(f"❌ Error fetching combined skills for user {user_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An error occurred while fetching skills"}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- Analyze Skill Gap Route (UPDATED PROMPT) ---
@skill_gap_bp.route('/skill-gap/analyze', methods=['POST'])
def analyze_skill_gap():
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required. Not logged in."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as jwt_error:
        print(f"JWT Error in analyze_skill_gap: {jwt_error}")
        return jsonify({"error": "Invalid or expired session. Please log in again."}), 401

    if not request.is_json:
         return jsonify({"error": "Request must be JSON"}), 400

    req_data = request.get_json()
    current_skills = req_data.get('skills', [])
    domain = req_data.get('domain')

    if not domain: return jsonify({"error": "Domain is required"}), 400
    if not isinstance(current_skills, list):
        return jsonify({"error": "'skills' must be a list"}), 400
    if not gemini_model:
        print("Error: Gemini model not initialized in analyze_skill_gap")
        return jsonify({"error": "AI Model is not available at the moment."}), 503

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
            print("Error: Database connection failed in analyze_skill_gap")
            return jsonify({"error": "Database connection failed"}), 500

        cur = conn.cursor(dictionary=True)
        completed_roadmap_topics = []

        # Step 1: Fetch completed roadmap steps
        cur.execute("""
            SELECT JSON_UNQUOTE(JSON_EXTRACT(r.roadmap, CONCAT('$.roadmap[', urp.stage_index, '].steps[', urp.step_index, '].title'))) AS completed_title
            FROM user_roadmap_progress urp
            JOIN roadmaps r ON urp.roadmap_id = r.id
            WHERE urp.user_id = %s AND r.domain = %s AND urp.is_completed = TRUE
        """, (user_id, domain))
        completed_steps_rows = cur.fetchall()
        completed_roadmap_topics = [str(row['completed_title']) for row in completed_steps_rows if row.get('completed_title')]
        print(f"Found completed topics for domain '{domain}' (User {user_id}): {completed_roadmap_topics}")

        # --- Step 2: Prepare and send prompt to AI ---
        current_skills_str = ', '.join(map(str, current_skills)) if current_skills else "None listed"
        completed_topics_str = ', '.join(completed_roadmap_topics) if completed_roadmap_topics else "None yet"

        # --- UPDATED PROMPT ---
        prompt = f"""
        You are an expert career counselor and technical instructor analyzing a user's profile for the '{domain}' career path in India's current tech market.

        User's Profile:
        - Stated Skills (from profile/resume): {current_skills_str}
        - Completed Learning Topics (from roadmap): {completed_topics_str}

        Your Task:
        1. Identify a comprehensive list of skills (technical, tools, methodologies) typically required or highly beneficial for an entry-level '{domain}' role today.
        2. Compare these required skills against BOTH the user's stated skills AND their completed learning topics.
        3. Determine which relevant skills the user seems to be 'missing'. Aim for a reasonably detailed list (e.g., 5-10 skills if applicable).
        4. Determine which relevant skills the user has likely 'acquired' (present in either stated skills or completed topics).
        5. Provide several detailed and actionable 'recommendations' (e.g., 3-5 suggestions) for learning the most important missing skills. Recommendations could include specific types of resources (e.g., "official documentation for X", "interactive tutorials on platform Y", "build a small project focusing on Z"), key concepts to grasp, or specific tools to practice.

        Response Format:
        Your response MUST be a valid JSON object with exactly three keys: "missing_skills", "acquired_skills", and "recommendations".
        - "missing_skills": A list of strings (skill names the user still needs). Aim for 5-10 relevant skills if appropriate for the gap.
        - "acquired_skills": A list of strings (skill names the user likely possesses relevant to the domain).
        - "recommendations": A list of strings (3-5 detailed, actionable learning suggestions for the missing skills).

        Example:
        {{
          "missing_skills": ["Kubernetes", "Terraform", "CI/CD Pipelines (e.g., Jenkins, GitHub Actions)", "Monitoring Tools (e.g., Prometheus, Grafana)", "Cloud Networking Basics", "Shell Scripting"],
          "acquired_skills": ["Python", "Docker", "Git", "Basic Linux Commands", "AWS Fundamentals"],
          "recommendations": [
            "Begin with Kubernetes basics through interactive labs on platforms like Katacoda or KodeKloud.",
            "Follow the official Terraform 'Get Started' guide on their website to understand Infrastructure as Code.",
            "Set up a simple CI/CD pipeline for a personal project using GitHub Actions to automate build and test.",
            "Learn basic shell scripting (Bash) for automation tasks using online tutorials.",
            "Explore cloud provider documentation (e.g., AWS VPC basics) to understand fundamental networking concepts."
          ]
        }}
        """
        # --- END UPDATED PROMPT ---

        response = gemini_model.generate_content(prompt)
        cleaned_response_text = re.sub(r'^```(json)?\s*|\s*```$', '', response.text, flags=re.MULTILINE | re.DOTALL).strip()

        # Step 3: Parse AI response
        analysis_result = json.loads(cleaned_response_text)
        missing = analysis_result.get("missing_skills")
        acquired = analysis_result.get("acquired_skills")
        recommendations = analysis_result.get("recommendations")

        # Robust type checking and conversion
        if not isinstance(missing, list): missing = list(missing) if missing is not None else []
        if not isinstance(acquired, list): acquired = list(acquired) if acquired is not None else []
        if not isinstance(recommendations, list): recommendations = list(recommendations) if recommendations is not None else []

        missing = [str(item) for item in missing if item is not None]
        acquired = [str(item) for item in acquired if item is not None]
        recommendations = [str(item) for item in recommendations if item is not None]

        # Step 4: Save analysis result
        cur.execute("""
            INSERT INTO skill_gap_analysis
                (user_id, interested_domain, current_skills, missing_skills, acquired_skills, recommended_courses, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                current_skills = VALUES(current_skills),
                missing_skills = VALUES(missing_skills),
                acquired_skills = VALUES(acquired_skills),
                recommended_courses = VALUES(recommended_courses),
                created_at = NOW()
        """, (
            user_id, domain,
            json.dumps(current_skills),
            json.dumps(missing),
            json.dumps(acquired),
            json.dumps(recommendations)
        ))
        conn.commit()

        # Step 5: Return enhanced result
        return jsonify({
            "interested_domain": domain,
            "missing_skills": missing,
            "acquired_skills": acquired,
            "recommendations": recommendations
        })

    except (json.JSONDecodeError, ValueError) as json_error:
        if conn: conn.rollback()
        print(f"❌ Error parsing AI response for user {user_id}, domain '{domain}': {json_error}")
        raw_response = "N/A"
        if 'cleaned_response_text' in locals(): raw_response = cleaned_response_text
        elif 'response' in locals() and hasattr(response, 'text'): raw_response = response.text
        print(f"--- Raw AI Response ---:\n{raw_response}\n--- End Raw AI Response ---")
        return jsonify({"error": "AI generated an invalid response format. Please try again."}), 500
    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error during AI skill gap analysis for user {user_id}, domain '{domain}': {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during the analysis"}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

# --- Get Latest Analysis Route (No changes needed from previous version) ---
@skill_gap_bp.route('/skill-gap/latest', methods=['GET'])
def get_latest_analysis():
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as jwt_error:
        print(f"JWT Error in get_latest_analysis: {jwt_error}")
        return jsonify({"error": "Invalid or expired session."}), 401

    domain_filter = request.args.get('domain') # Optional domain filter

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
             print("Error: Database connection failed in get_latest_analysis")
             return jsonify({"error": "Database connection failed."}), 500

        cur = conn.cursor(dictionary=True)

        query = """
            SELECT interested_domain, missing_skills, acquired_skills, recommended_courses, created_at
            FROM skill_gap_analysis
            WHERE user_id = %s
        """
        params = [user_id]

        if domain_filter:
            query += " AND interested_domain = %s"
            params.append(domain_filter)
            print(f"Fetching latest analysis for user {user_id}, domain: {domain_filter}")
        else:
             print(f"Fetching absolute latest analysis for user {user_id} (no domain specified)")

        query += " ORDER BY created_at DESC LIMIT 1"

        cur.execute(query, tuple(params))
        latest_record_rows = cur.fetchall()
        latest_record = latest_record_rows[0] if latest_record_rows else None

        if not latest_record:
            message = f"No analysis found for domain: {domain_filter}." if domain_filter else "No analysis found for this user yet."
            return jsonify({"analysis": None, "message": message}), 200

        # Parse JSON fields safely, including acquired_skills
        missing_skills = []
        acquired_skills = [] # Initialize
        recommendations = []

        def safe_json_load(data, field_name):
             try:
                 value = data.get(field_name)
                 if isinstance(value, (bytes, bytearray)): value = value.decode('utf-8')
                 if isinstance(value, str): loaded_value = json.loads(value)
                 elif isinstance(value, list): loaded_value = value
                 else: loaded_value = []
                 return [str(item) for item in loaded_value if item is not None] if isinstance(loaded_value, list) else []
             except (json.JSONDecodeError, TypeError):
                 print(f"Warning: Could not decode JSON for {field_name} in latest analysis for user {user_id}")
                 return []

        missing_skills = safe_json_load(latest_record, 'missing_skills')
        acquired_skills = safe_json_load(latest_record, 'acquired_skills')
        recommendations = safe_json_load(latest_record, 'recommended_courses')

        analysis_data = {
             "interested_domain": latest_record.get('interested_domain', domain_filter or 'Unknown'),
             "missing_skills": missing_skills,
             "acquired_skills": acquired_skills,
             "recommendations": recommendations,
             "created_at": latest_record['created_at'].isoformat() if latest_record.get('created_at') else None
        }

        return jsonify({"analysis": analysis_data}), 200

    except Exception as e:
        print(f"❌ Error fetching latest analysis (User: {user_id}, Domain: {domain_filter}): {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred fetching latest analysis."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- Get Last Domain Route (No changes needed from previous version) ---
@skill_gap_bp.route('/skill-gap/last-domain', methods=['GET'])
def get_last_analysis_domain():
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required"}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as jwt_error:
        print(f"JWT Error in get_last_analysis_domain: {jwt_error}")
        return jsonify({"error": "Invalid or expired session"}), 401

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
            print("Error: Database connection failed in get_last_analysis_domain")
            return jsonify({"error": "Database connection failed"}), 500

        cur = conn.cursor(dictionary=True)

        # First, try to get the most recent analysis domain
        cur.execute(
            "SELECT interested_domain FROM skill_gap_analysis WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user_id,)
        )
        record_rows = cur.fetchall()
        record = record_rows[0] if record_rows else None

        if record and record.get('interested_domain'):
            return jsonify({"last_domain": record['interested_domain']}), 200

        # If no analysis, fallback to user_details primary domain
        print(f"No analysis found for user {user_id}, falling back to user_details domain.")
        cur.execute("SELECT domain FROM user_details WHERE user_id = %s", (user_id,))
        details_rows = cur.fetchall()
        details = details_rows[0] if details_rows else None
        primary_domain = None
        if details and details.get('domain') is not None:
            domain_data = details['domain']
            if isinstance(domain_data, (bytes, bytearray)): domain_data = domain_data.decode('utf-8')
            try:
                 domain_list = json.loads(domain_data) if isinstance(domain_data, str) else domain_data
                 if isinstance(domain_list, list) and domain_list:
                      first_domain = str(domain_list[0]).strip()
                      if first_domain: primary_domain = first_domain
            except (json.JSONDecodeError, IndexError, TypeError) as e:
                 print(f"Warning: Could not parse primary domain for user {user_id}: {e}")

        return jsonify({"last_domain": primary_domain}), 200 # Return first domain from list or None

    except Exception as e:
        print(f"❌ Error fetching last analysis domain for user {user_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not fetch last domain"}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

