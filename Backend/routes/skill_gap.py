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

# --- GET User Skills Route ---
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

        cur = conn.cursor(dictionary=True) # Use dictionary cursor throughout
        manual_skills, extracted_skills = [], []

        # --- Query 1 for manual skills ---
        cur.execute("SELECT skills FROM user_details WHERE user_id = %s", (user_id,))
        user_details_rows = cur.fetchall() # Fetch all results
        user_details = user_details_rows[0] if user_details_rows else None

        if user_details and user_details.get('skills') is not None: # Check explicitly for None
            skills_data = user_details['skills']
            if isinstance(skills_data, (bytes, bytearray)):
                skills_data = skills_data.decode('utf-8') # Decode if bytes
            if isinstance(skills_data, str):
                try:
                    loaded_skills = json.loads(skills_data)
                    # Ensure it's a list after loading
                    if isinstance(loaded_skills, list):
                         manual_skills = loaded_skills
                    else:
                         print(f"Warning: Manual skills JSON for user {user_id} decoded to non-list type: {type(loaded_skills)}")
                         manual_skills = [] # Default to empty list if not a list
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode manual skills JSON for user {user_id}. Data: '{skills_data}'")
                    manual_skills = [] # Default to empty list on decode error
            elif isinstance(skills_data, list):
                manual_skills = skills_data
            else:
                 print(f"Warning: Manual skills data for user {user_id} is unexpected type: {type(skills_data)}")
                 manual_skills = []


        # --- Query 2 for extracted skills ---
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        extracted_details_rows = cur.fetchall() # Fetch all results
        extracted_details = extracted_details_rows[0] if extracted_details_rows else None

        if extracted_details and extracted_details.get('skills') is not None:
            skills_data = extracted_details['skills']
            if isinstance(skills_data, (bytes, bytearray)):
                 skills_data = skills_data.decode('utf-8')
            if isinstance(skills_data, str):
                try:
                    loaded_skills = json.loads(skills_data)
                    if isinstance(loaded_skills, list):
                         extracted_skills = loaded_skills
                    else:
                         print(f"Warning: Extracted skills JSON for user {user_id} decoded to non-list type: {type(loaded_skills)}")
                         extracted_skills = []
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode extracted skills JSON for user {user_id}. Data: '{skills_data}'")
                    extracted_skills = []
            elif isinstance(skills_data, list):
                extracted_skills = skills_data
            else:
                 print(f"Warning: Extracted skills data for user {user_id} is unexpected type: {type(skills_data)}")
                 extracted_skills = []

        # Combine, ensure strings, deduplicate (case-insensitive), title case, and sort
        combined_skills_raw = manual_skills + extracted_skills
        # Filter out None or empty strings robustly AFTER converting to string
        combined_skills_str = [str(skill).strip() for skill in combined_skills_raw if skill is not None]
        # Filter again for non-empty strings after stripping
        combined_skills_clean = [skill for skill in combined_skills_str if skill]

        unique_skills_dict = {skill.lower(): skill for skill in reversed(combined_skills_clean)} # Keep last occurrence casing
        final_skills = sorted([s.title() for s in unique_skills_dict.values()]) # Title case after deduplication

        print(f"Returning skills for user {user_id}: {final_skills}") # Log returned skills
        return jsonify({"skills": final_skills})

    except Exception as e:
        print(f"❌ Error fetching combined skills for user {user_id}: {e}")
        traceback.print_exc() # Print detailed traceback
        return jsonify({"error": "An error occurred while fetching skills"}), 500
    finally:
        # Close cursor and connection if they were successfully opened
        if cur: cur.close()
        if conn: conn.close()

# --- Analyze Skill Gap Route (Keep as is) ---
@skill_gap_bp.route('/skill-gap/analyze', methods=['POST'])
def analyze_skill_gap():
    # ... (code remains the same as previous correct version) ...
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

        # Step 2: Prepare and send prompt to AI
        current_skills_str = ', '.join(map(str, current_skills)) if current_skills else "None listed"
        completed_topics_str = ', '.join(completed_roadmap_topics) if completed_roadmap_topics else "None yet"

        prompt = f"""
        You are an expert career counselor analyzing a user's skills for the '{domain}' career path in India's current tech market.

        User's Profile:
        - Stated Skills (from profile/resume): {current_skills_str}
        - Completed Learning Topics (from roadmap): {completed_topics_str}

        Your Task:
        1. Identify a comprehensive list of essential skills for an entry-level '{domain}' role.
        2. Compare these essential skills against the user's 'Stated Skills' AND 'Completed Learning Topics'. Determine which essential skills the user is still 'missing'. Aim for a reasonably detailed list (e.g., 5-10 skills if applicable).
        3. Determine which essential skills the user has likely 'acquired' based *ONLY* on the list of 'Completed Learning Topics'. List the relevant skills implied by these completed topics.
        4. Provide several detailed and actionable 'recommendations' (e.g., 3-5 suggestions) for learning the most important missing skills.

        Response Format:
        Your response MUST be a valid JSON object with exactly three keys: "missing_skills", "acquired_skills", and "recommendations".
        - "missing_skills": A list of strings (essential skill names the user still needs, considering BOTH inputs).
        - "acquired_skills": A list of strings (essential skill names the user likely possesses *based ONLY on the Completed Learning Topics*).
        - "recommendations": A list of strings (3-5 detailed, actionable learning suggestions for the missing skills).

        Example (If Completed Topics were 'HTML Basics', 'CSS Fundamentals', 'Intro to JavaScript'):
        {{
          "missing_skills": ["React", "Node.js", "REST APIs", "Git", "Databases (e.g., SQL or NoSQL)"],
          "acquired_skills": ["HTML", "CSS", "JavaScript Fundamentals"],
          "recommendations": [
            "Start learning React with the official tutorial or a comprehensive course on Udemy/Coursera.",
            "Set up a basic Node.js server with Express to understand backend concepts.",
            "Learn about RESTful APIs and how frontend and backend communicate.",
            "Practice Git version control for all your projects using GitHub."
          ]
        }}
        """

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

# --- Get Latest Analysis Route (No changes needed) ---
@skill_gap_bp.route('/skill-gap/latest', methods=['GET'])
def get_latest_analysis():
    # ... (code remains the same as previous correct version) ...
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
             "acquired_skills": acquired_skills, # Add acquired skills to response
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


# --- Get Last Domain Route (No changes needed) ---
@skill_gap_bp.route('/skill-gap/last-domain', methods=['GET'])
def get_last_analysis_domain():
    # ... (code remains the same as previous correct version) ...
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

@skill_gap_bp.route('/skill-gap/history', methods=['GET'])
def get_skill_gap_history():
    """
    Fetches the history of skill gap analysis (count of missing skills)
    for a specific domain for the current user, sorted by date.
    """
    token = request.cookies.get("token")
    if not token: 
        return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    # Get the domain from the query parameter
    domain_filter = request.args.get('domain')
    if not domain_filter:
        return jsonify({"error": "A 'domain' query parameter is required."}), 400

    conn = get_db_connection()
    if not conn: 
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # Select the date and the missing_skills JSON
        # IMPORTANT: Order by created_at ASC (Ascending) for the chart's X-axis
        cur.execute("""
            SELECT created_at, missing_skills
            FROM skill_gap_analysis
            WHERE user_id = %s AND interested_domain = %s
            ORDER BY created_at ASC
        """, (user_id, domain_filter))
        
        history = cur.fetchall()
        
        chart_data = []
        if not history:
            return jsonify(chart_data), 200 # Return empty list if no history

        # Process the data
        for record in history:
            missing_skills_list = []
            if record.get('missing_skills'):
                try:
                    # Robust JSON parsing
                    skills_data = record['missing_skills']
                    if isinstance(skills_data, (bytes, bytearray)):
                        skills_data = skills_data.decode('utf-8')
                    if isinstance(skills_data, str):
                        missing_skills_list = json.loads(skills_data)
                    elif isinstance(skills_data, list):
                        missing_skills_list = skills_data
                except (json.JSONDecodeError, TypeError):
                    pass # Keep list empty if error
            
            chart_data.append({
                "date": record['created_at'].strftime('%d %b %Y'), # Format the date
                "count": len(missing_skills_list) # Get the number of missing skills
            })
        
        return jsonify(chart_data), 200

    except Exception as e:
        print(f"❌ Error fetching skill gap history for user {user_id}, domain {domain_filter}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred fetching history."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()