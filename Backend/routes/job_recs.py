# job_recs.py
from flask import Blueprint, request, jsonify
import jwt
import json
import re
import requests
from db_config import get_db_connection
from config import SECRET_KEY, RAPIDAPI_KEY
from api_config import gemini_model
import traceback
import concurrent.futures # For concurrent API calls
from datetime import datetime # Import datetime for timestamp (if needed)

job_recs_bp = Blueprint('job_recs', __name__)

# --- JSearch API Configuration ---
JSEARCH_API_URL = "https://jsearch.p.rapidapi.com/search"
JSEARCH_API_HOST = "jsearch.p.rapidapi.com"
# ---------------------------------

@job_recs_bp.route('/get-profile-for-jobs', methods=['GET'])
def get_profile_for_jobs():
    """
    Fetches user's skills and completed courses (grouped by domain) to pre-fill the form.
    Handles case-insensitive skill deduplication and robust JSON parsing.
    """
    # ... (This function remains unchanged) ...
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500

        cur = conn.cursor(dictionary=True)
        manual_skills, extracted_skills = [], []

        # Fetch manual skills
        cur.execute("SELECT skills FROM user_details WHERE user_id = %s", (user_id,))
        user_details_rows = cur.fetchall()
        user_details = user_details_rows[0] if user_details_rows else None
        if user_details and user_details.get('skills'):
            skills_data = user_details['skills']
            if isinstance(skills_data, (bytes, bytearray)): skills_data = skills_data.decode('utf-8')
            if isinstance(skills_data, str):
                try:
                    manual_skills = json.loads(skills_data)
                    if not isinstance(manual_skills, list): manual_skills = []
                except json.JSONDecodeError: manual_skills = []
            elif isinstance(skills_data, list): manual_skills = skills_data

        # Fetch extracted skills
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        extracted_details_rows = cur.fetchall()
        extracted_details = extracted_details_rows[0] if extracted_details_rows else None
        if extracted_details and extracted_details.get('skills'):
            skills_data = extracted_details['skills']
            if isinstance(skills_data, (bytes, bytearray)): skills_data = skills_data.decode('utf-8')
            if isinstance(skills_data, str):
                try:
                    extracted_skills = json.loads(skills_data)
                    if not isinstance(extracted_skills, list): extracted_skills = []
                except json.JSONDecodeError: extracted_skills = []
            elif isinstance(skills_data, list): extracted_skills = skills_data

        combined_skills_raw = manual_skills + extracted_skills
        combined_skills_str = [str(skill).strip() for skill in combined_skills_raw if skill and str(skill).strip()]
        unique_skills_dict = {skill.lower(): skill.title() for skill in combined_skills_str}
        final_skills = sorted(list(unique_skills_dict.values()))

        # Fetch completed courses
        cur.execute("""
            SELECT r.domain, JSON_UNQUOTE(JSON_EXTRACT(r.roadmap, CONCAT('$.roadmap[', urp.stage_index, '].steps[', urp.step_index, '].title'))) AS course_title
            FROM user_roadmap_progress urp JOIN roadmaps r ON urp.roadmap_id = r.id
            WHERE urp.user_id = %s AND urp.is_completed = TRUE
        """, (user_id,))
        completed_courses_by_domain = {}
        all_courses = cur.fetchall()
        for row in all_courses:
            domain = row.get('domain')
            course_title = row.get('course_title')
            if domain and course_title:
                if domain not in completed_courses_by_domain: completed_courses_by_domain[domain] = []
                completed_courses_by_domain[domain].append(course_title)

        return jsonify({ "skills": final_skills, "completed_courses_by_domain": completed_courses_by_domain }), 200

    except Exception as e:
        print(f"❌ Error fetching profile for jobs: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


@job_recs_bp.route('/generate-job-query', methods=['POST'])
def generate_job_queries():
    """
    Uses AI to generate 2-3 simple BASE search query strings (skill + role, NO location).
    comma-separated, based on user skills/courses.
    """
    # ... (This function remains unchanged) ...
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    skills = req_data.get('skills', [])
    completed_courses = req_data.get('completed_courses', {})

    if not skills:
        return jsonify({"error": "Skills are required to generate queries."}), 400
    if not gemini_model:
        return jsonify({"error": "AI Model not available."}), 503

    try:
        profile_summary = f"Skills: {', '.join(skills)}. Completed Topics: {json.dumps(completed_courses)}"
        prompt = f"""
        You are an AI assistant generating concise BASE search query strings (skill + role ONLY) for a job API.
        User Profile: {profile_summary}

        Task:
        1. Identify the 2 or 3 most relevant potential job roles based on the user's primary skills (e.g., developer, engineer, analyst).
        2. For each role, pick the SINGLE most dominant programming language or core technology associated with it from the user's list.
        3. Create a simple query string for each identified role using ONLY the dominant skill and the role (e.g., "Java developer", "Python data analyst").
        4. Combine these 2-3 simple query strings into a SINGLE LINE, separated by commas.
        5. Strictly AVOID: Location names, "fresher", "junior", additional skills beyond the single dominant one per query, frameworks (unless dominant like React), "OR", "AND", parentheses, quotes within the queries.

        Good Examples Output (single line, comma-separated):
        - Skills: [Java, Python, MySQL, Spring, HTML] -> "Java developer, Python developer"
        - Skills: [HTML, CSS, JavaScript, React, Node.js] -> "React developer, Node.js developer"
        - Skills: [Python, SQL, Pandas, Scikit-learn, Tableau] -> "Python developer, Data analyst Python"

        Bad Examples Output:
        - "Java developer India, Python developer India" (Contains location)
        - "Java developer, Spring developer" (Spring isn't dominant skill here)
        - "Full stack developer Java Python" (Not comma-separated base queries)

        Return ONLY the generated comma-separated simple base query strings on a single line.
        """

        response = gemini_model.generate_content(prompt)
        base_queries_str = re.sub(r'[`\'"]', '', response.text).strip()
        base_queries_str = re.sub(r'^(json)?\s*', '', base_queries_str).strip()
        base_queries_list = [q.strip() for q in base_queries_str.split(',') if q.strip()]
        final_queries_str = ", ".join(base_queries_list)

        print(f"Generated BASE search queries: {final_queries_str}")

        if not final_queries_str: raise ValueError("AI failed to generate valid base query strings.")
        return jsonify({"base_queries": final_queries_str}), 200

    except Exception as e:
        print(f"❌ Error during AI base query generation: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred generating the base search queries."}), 500


def fetch_jobs_from_api(query):
    """Calls JSearch API for a given query with 'no_experience' filter."""
    # ... (This function remains unchanged) ...
    if not RAPIDAPI_KEY or RAPIDAPI_KEY == "PASTE_YOUR_API_KEY_HERE":
        print("❌ Error: RAPIDAPI_KEY is not configured for fetch_jobs_from_api.")
        return []
    querystring = {
        "query": query.strip(), "page": "1", "num_pages": "1",
        "employment_types": "FULLTIME,INTERN,CONTRACTOR",
        "job_requirements": "no_experience"
    }
    headers = { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": JSEARCH_API_HOST }
    try:
        print(f"Calling JSearch API with query: {query}")
        api_response = requests.get(JSEARCH_API_URL, headers=headers, params=querystring, timeout=15)
        api_response.raise_for_status()
        api_data = api_response.json()
        return api_data.get('data', []) if isinstance(api_data.get('data'), list) else []
    except requests.exceptions.Timeout:
        print(f"⚠️ JSearch API call timed out for query: {query}")
        return []
    except requests.exceptions.RequestException as e:
        print(f"❌ Error calling JSearch API for query '{query}': {e}")
        return []
    except Exception as e:
        print(f"❌ Unexpected error fetching jobs for query '{query}': {e}")
        return []


@job_recs_bp.route('/search-jobs', methods=['POST'])
def search_jobs_multi_query_location():
    """
    Takes multiple base queries and locations, runs concurrent searches,
    merges/deduplicates results, and saves the result to the database.
    """
    token = request.cookies.get("token")
    user_id = None # <-- *** NEW: Initialize user_id ***
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        # --- *** NEW: Get user_id from token *** ---
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"] # <-- *** NEW: Assign user_id ***
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    # --- Database connection variables for saving history ---
    conn = None
    cur = None
    
    try:
        req_data = request.get_json()
        base_queries_str = req_data.get('base_queries')
        locations = req_data.get('locations', []) # This is a Python list from JSON

        if not base_queries_str:
            return jsonify({"error": "Base search query strings are required."}), 400
        if not isinstance(locations, list) or not locations:
            locations = ["India"] # Default if none provided

        base_query_list = [q.strip() for q in base_queries_str.split(',') if q.strip()]
        location_list = [loc.strip() for loc in locations if loc.strip()]

        if not base_query_list: return jsonify({"error": "Valid base queries are required."}), 400
        if not location_list: return jsonify({"error": "Valid locations are required."}), 400

        combined_search_queries = [f"{bq} {loc}" for bq in base_query_list for loc in location_list]
        if not combined_search_queries: return jsonify({"error": "Could not generate combined search queries."}), 400

        print(f"Generated {len(combined_search_queries)} combined queries for JSearch.")

        all_job_data = []
        max_workers = min(len(combined_search_queries), 10)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_query = {executor.submit(fetch_jobs_from_api, query): query for query in combined_search_queries}
            for future in concurrent.futures.as_completed(future_to_query):
                query = future_to_query[future]
                try:
                    results = future.result()
                    if results:
                        print(f"✅ Received {len(results)} results for query: {query}")
                        all_job_data.extend(results)
                    else:
                        print(f"ℹ️ No results found for query: {query}")
                except Exception as exc:
                    print(f'❌ Query {query} generated an exception during processing: {exc}')

        print(f"Total raw results fetched: {len(all_job_data)}")

        # Deduplicate and Format Results
        processed_jobs = {}
        for job in all_job_data:
            job_id = job.get('job_id')
            if not job_id or job_id in processed_jobs: continue

            job_url = job.get('job_apply_link') or job.get('job_google_link') or job.get('job_linkedin_link')
            if not job_url: continue

            salary_text = "Not specified"
            if job.get('job_min_salary') and job.get('job_salary_period'): salary_text = f"{job.get('job_min_salary')} {job.get('job_salary_currency')} / {job.get('job_salary_period').lower()}"
            elif job.get('job_min_salary'): salary_text = f"{job.get('job_min_salary')} {job.get('job_salary_currency')}"

            city = job.get('job_city'); state = job.get('job_state'); country = job.get('job_country')
            location_parts = [part for part in [city, state, country] if part]
            location = ", ".join(location_parts) if location_parts else "N/A"
            if job.get('job_is_remote'): location = "Remote"

            formatted_job = {
                "job_id": job_id,
                "job_title": job.get('job_title', 'N/A'),
                "company_name": job.get('employer_name', 'N/A'),
                "location": location,
                "job_url": job_url,
                "source": job.get('job_publisher') or JSEARCH_API_HOST,
                "estimated_salary_lpa": salary_text,
                "recommendation_reason": "Matched via multi-query/location search (entry-level focus)"
            }
            processed_jobs[job_id] = formatted_job

        final_job_list = list(processed_jobs.values())
        print(f"Returning {len(final_job_list)} unique jobs after deduplication.")

        # --- *** NEW: Save to Database *** ---
        # Only save if we have a valid user and found at least one job
        if user_id and final_job_list:
            try:
                conn = get_db_connection()
                if conn:
                    cur = conn.cursor()
                    cur.execute("""
                        INSERT INTO job_recommendation_history
                        (user_id, base_queries, locations, recommendations, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (
                        user_id,
                        base_queries_str, # The original comma-separated string
                        json.dumps(location_list), # The list of locations used
                        json.dumps(final_job_list), # The final list of jobs
                        datetime.now()
                    ))
                    conn.commit()
                    print(f"✅ Saved {len(final_job_list)} job recommendations to history for user {user_id}.")
                else:
                    print("❌ Could not get DB connection to save job history.")
            except Exception as db_e:
                if conn: conn.rollback()
                print(f"❌ Error saving job recommendation history: {db_e}")
                traceback.print_exc() # Log the full DB error
            finally:
                if cur: cur.close()
                if conn: conn.close()
        elif not final_job_list:
             print("ℹ️ No jobs found, not saving to history.")
        # --- *** END NEW SECTION *** ---
        
        return jsonify({"jobs": final_job_list}), 200

    except Exception as e:
        # This is the main exception handler for the whole route
        print(f"❌ Unexpected error in search_jobs_multi_query_location: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during job search."}), 500
    finally:
        # This finally block is part of the new DB save try/except
        # It's already handled above
        pass

@job_recs_bp.route('/job-history/latest', methods=['GET'])
def get_latest_job_history():
    """Fetches the MOST RECENT job recommendation search for the user."""
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor(dictionary=True)
        
        cur.execute("""
            SELECT base_queries, locations, created_at
            FROM job_recommendation_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        latest_history = cur.fetchone()
        
        if not latest_history:
            return jsonify({"latest_recommendation": None}), 200 # No history found

        # Parse locations JSON
        if latest_history.get('locations'):
            try:
                latest_history['locations'] = json.loads(latest_history['locations'])
            except json.JSONDecodeError:
                latest_history['locations'] = [] # Default to empty list on parse error

        # Format timestamp
        if latest_history.get('created_at'):
             latest_history['created_at'] = latest_history['created_at'].strftime('%d %b %Y, %I:%M %p')

        return jsonify({"latest_recommendation": latest_history}), 200
    except Exception as e:
        print(f"❌ Error fetching latest job history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()
# --- *** END NEW ROUTE *** ---


# --- *** NEW ROUTE: Get All Job History *** ---
@job_recs_bp.route('/job-history', methods=['GET'])
def get_all_job_history():
    """Fetches ALL job recommendation searches for the user."""
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor(dictionary=True)
        
        cur.execute("""
            SELECT id, base_queries, locations, recommendations, created_at
            FROM job_recommendation_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,)) # Limit to last 20 searches for performance
        
        history_list = cur.fetchall()
        
        if not history_list:
            return jsonify({"history": []}), 200 # No history found

        # Parse JSON and format dates
        for item in history_list:
            try:
                if item.get('locations'): item['locations'] = json.loads(item['locations'])
            except json.JSONDecodeError: item['locations'] = []
            try:
                if item.get('recommendations'): item['recommendations'] = json.loads(item['recommendations'])
            except json.JSONDecodeError: item['recommendations'] = []
            
            if item.get('created_at'):
                item['created_at'] = item['created_at'].strftime('%d %b %Y, %I:%M %p')

        return jsonify({"history": history_list}), 200
    except Exception as e:
        print(f"❌ Error fetching all job history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()