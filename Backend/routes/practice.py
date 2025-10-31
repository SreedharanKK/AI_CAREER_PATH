# routes/practice.py
from flask import Blueprint, request, jsonify
import jwt
import json
import re
import requests # To call Judge0 API
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
import traceback
from datetime import datetime, timedelta
import hashlib

from google.api_core.exceptions import ResourceExhausted

# Import the language ID getter from your new utility file
try:
    from utils.language_map import get_language_id, JUDGE0_LANGUAGE_MAP
except ImportError:
    print("❌ CRITICAL: Could not import from utils.language_map.py. Please ensure the file exists in the utils folder.")
    def get_language_id(lang_name):
        return {"python": 71, "javascript": 63, "java": 62, "c++": 54, "c": 50, "html": 43, "css": 43, "cpp": 54, "sql": 82}.get(lang_name.lower())
    JUDGE0_LANGUAGE_MAP = {}


practice_bp = Blueprint('practice', __name__)

JUDGE0_API_URL = "https://ce.judge0.com"
QUESTION_CACHE_VALIDITY = timedelta(days=7) # Cache questions for 7 days

# --- /practice/question route (with Caching) ---
@practice_bp.route('/practice/question', methods=['POST'])
def get_practice_question():
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as jwt_error:
        print(f"JWT Error in get_practice_question: {jwt_error}")
        return jsonify({"error": "Invalid or expired session."}), 401

    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    req_data = request.get_json()
    skill = req_data.get('skill', '')
    difficulty = req_data.get('difficulty', '')

    if not skill or not difficulty:
        return jsonify({"error": "Skill and difficulty are required."}), 400

    identifier_string = f"{skill.strip().lower()}::{difficulty.strip().lower()}"
    question_identifier = hashlib.sha256(identifier_string.encode('utf-8')).hexdigest()

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor(dictionary=True)
        
        # 1. Check Cache
        now = datetime.now()
        cache_expiry_threshold = now - QUESTION_CACHE_VALIDITY

        cur.execute("""
            SELECT id, question_data
            FROM generated_practice_questions
            WHERE question_identifier = %s AND generated_at >= %s
            LIMIT 1
        """, (question_identifier, cache_expiry_threshold))
        cached_question = cur.fetchone()

        if cached_question and cached_question.get('question_data'):
            try:
                question_data = json.loads(cached_question['question_data'])
                if question_data.get("title") and question_data.get("description"):
                     print(f"✅ Returning cached practice question (ID: {cached_question['id']}) for: {identifier_string}")
                     cur.execute("UPDATE generated_practice_questions SET last_used_at = %s WHERE id = %s", (now, cached_question['id']))
                     conn.commit()
                     return jsonify(question_data), 200
            except (json.JSONDecodeError, TypeError):
                 print(f"⚠️ Found cached question but failed to parse JSON. Regenerating.")
        else:
             print(f"ℹ️ No valid cached question found for: {identifier_string}. Generating new.")

        # 2. Generate New Question if Cache Miss
        if not gemini_model:
            return jsonify({"error": "AI Model is not available."}), 503

        # --- Dynamic Prompt for SQL vs. Other ---
        is_sql = "sql" in skill.lower() or "mysql" in skill.lower()
        
        if is_sql:
            prompt = f"""
            You are an expert SQL instructor. Generate ONE SQL question for '{skill}' at '{difficulty}' difficulty.
            Your response MUST be a valid JSON object with keys:
            "title": (string) e.g., "Find Sales Department Employees".
            "description": (string) The problem statement, e.g., "Given the Employees table, select all employees in the 'Sales' department."
            "setup_script": (string) The SQL `CREATE TABLE...` and `INSERT INTO...` statements needed to create the sample data.
            "solution_query": (string) The correct solution, e.g., "SELECT * FROM Employees WHERE Department = 'Sales';"
            "examples": (list) A list with ONE object: {{"input": "Employees Table:\n| ID | Name | Dept | Salary |\n|...|", "output": "Result:\n| ID | Name | Dept | Salary |\n|...|" }}

            Generate the JSON object now. Do NOT include ```json markdown.
            """
        else:
            prompt = f"""
            You are an expert programming instructor. Generate ONE coding question
            suitable for practicing the skill '{skill}' at a '{difficulty}' difficulty level.
            Your response MUST be a valid JSON object with keys:
            "title", "description", "examples" (list of {{"input": "...", "output": "..."}}),
            "constraints" (string, can be empty), "default_stdin" (string, can be empty).
            Generate the JSON object now. Do NOT include ```json markdown.
            """

        question_data = {}
        try:
            print(f"⏳ Calling Gemini API to generate question for: {identifier_string}")
            response = gemini_model.generate_content(prompt)
            cleaned_response_text = re.sub(r'^```(json)?\s*|\s*```$', '', response.text, flags=re.MULTILINE | re.DOTALL).strip()
            
            question_data = json.loads(cleaned_response_text)
            
            # Validate based on type
            if is_sql:
                if not all(k in question_data for k in ["title", "description", "setup_script", "solution_query"]):
                     raise ValueError("SQL AI response missing required keys.")
            else:
                if not all(k in question_data for k in ["title", "description", "examples"]):
                     raise ValueError("Code AI response missing required keys.")
                question_data.setdefault("constraints", "")
                question_data.setdefault("default_stdin", "")

        except ResourceExhausted as rate_limit_error:
            print(f"❌ RATE LIMIT HIT for Gemini API: {rate_limit_error}")
            retry_seconds = 20
            match = re.search(r'retry in (\d+\.?\d*)s', str(rate_limit_error), re.IGNORECASE)
            if match:
                 try: retry_seconds = max(5, int(float(match.group(1)) + 1))
                 except ValueError: pass
            return jsonify({
                "error": f"AI is busy generating questions. Please try again in about {retry_seconds} seconds.",
                "retry_after": retry_seconds
            }), 429
        except (json.JSONDecodeError, ValueError) as json_error:
            print(f"❌ Error parsing AI question response for user {user_id}, skill '{skill}': {json_error}")
            print(f"--- Raw AI Response ---:\n{response.text if 'response' in locals() else 'N/A'}\n---")
            return jsonify({"error": "AI generated an invalid question format. Please try again."}), 500
        except Exception as e:
            print(f"❌ Error during AI question generation for user {user_id}, skill '{skill}': {e}")
            traceback.print_exc()
            return jsonify({"error": "An internal server error occurred generating the question."}), 500

        # 3. Store Newly Generated Question in Cache
        try:
            question_data_str = json.dumps(question_data)
            cur.execute("""
                INSERT INTO generated_practice_questions (question_identifier, question_data, generated_at, last_used_at)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    question_data = VALUES(question_data),
                    generated_at = VALUES(generated_at),
                    last_used_at = VALUES(last_used_at)
            """, (question_identifier, question_data_str, now, now))
            conn.commit()
            print(f"✅ Saved newly generated question to cache for: {identifier_string}")
        except Exception as db_error:
            conn.rollback()
            print(f"⚠️ WARNING: Failed to save generated question to cache: {db_error}")
        
        return jsonify(question_data), 200

    except Exception as e:
        print(f"❌ Unexpected error in get_practice_question: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- /practice/run route ---
@practice_bp.route('/practice/run', methods=['POST'])
def run_practice_code():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401
    
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    req_data = request.get_json()
    language = req_data.get('language')
    source_code = req_data.get('source_code')
    stdin_input = req_data.get('stdin', '')

    if not language or source_code is None:
        return jsonify({"error": "Language and source code are required."}), 400

    language_id = get_language_id(language)
    
    if not language_id:
        return jsonify({"error": f"Unsupported language for practice: '{language}'."}), 400

    print(f"Running code via Judge0 - Lang: {language} (ID: {language_id})")
    judge0_payload = {"language_id": language_id, "source_code": source_code, "stdin": stdin_input}

    try:
        submission_url = f"{JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true"
        headers = { "Content-Type": "application/json" }
        response = requests.post(submission_url, headers=headers, json=judge0_payload, timeout=20)
        response.raise_for_status()
        result = response.json()
        print(f"Judge0 Run Result: Status: {result.get('status', {}).get('description', 'N/A')}")
        
        return jsonify({
            "stdout": result.get("stdout"),
            "stderr": result.get("stderr"),
            "compile_output": result.get("compile_output"),
            "message": result.get("message"),
            "status": result.get("status", {}).get("description", "Unknown Status"),
            "time": result.get("time"), 
            "memory": result.get("memory")
        }), 200
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error calling Judge0 API during Run: {e}")
        return jsonify({"error": f"Could not execute code via Judge0."}), 503
    except Exception as e:
       print(f"❌ Unexpected error during Run Code: {e}")
       traceback.print_exc()
       return jsonify({"error": "An unexpected error occurred during code execution."}), 500


# --- *** MODIFIED: /practice/submit route *** ---
@practice_bp.route('/practice/submit', methods=['POST'])
def submit_practice_code():
    token = request.cookies.get("token")
    user_id = None
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400

    req_data = request.get_json()
    language = req_data.get('language')
    source_code = req_data.get('source_code') # This is the user's code
    question = req_data.get('question')
    difficulty = req_data.get('difficulty')
    skill = req_data.get('skill')

    if not all([language, source_code, question, difficulty, skill, user_id]):
        return jsonify({"error": "Missing required data."}), 400
    if not gemini_model: return jsonify({"error": "AI Model is not available."}), 503

    conn = None
    cur = None
    try:
        # --- 1. Get AI Analysis (With SQL-aware prompt) ---
        is_sql = "sql" in skill.lower() or "mysql" in skill.lower()

        if is_sql:
            prompt = f"""
            You are an expert SQL judge. Analyze the user's query based on the problem and schema.
            Problem Title: {question.get('title', 'N/A')}
            Problem Description: {question.get('description', 'N/A')}
            Schema Setup Script (to create tables):
            ```sql
            {question.get('setup_script', 'N/A')}
            ```
            Correct Solution Query:
            ```sql
            {question.get('solution_query', 'N/A')}
            ```
            User's SQL Query:
            ```sql
            {source_code}
            ```
            Your Task: Provide analysis and numerical scores.
            Response Format: Your response MUST be a valid JSON object with keys:
            * `overall_status`: (String) e.g., "Correct", "Incorrect", "Partially Correct".
            * `summary_feedback`: (String) 2-3 sentences.
            * `scores`: (Object) with keys: `correctness` (1-10), `efficiency` (1-10), `readability` (1-10), `robustness` (1-10).
            
            Generate the JSON object now. Do NOT include ```json markdown.
            """
        else:
            prompt = f"""
            You are an expert programming judge. Analyze the user's code based on the problem.
            Problem Title: {question.get('title', 'N/A')}
            Problem Difficulty: {difficulty}
            Target Skill: {skill}
            Problem Description: {question.get('description', 'N/A')}
            User's Code ({language}):
            ```
            {source_code}
            ```
            Your Task: Provide analysis and numerical scores.
            Response Format: Your response MUST be a valid JSON object with keys:
            * `overall_status`: (String) e.g., "Likely Correct", "Potential Issues Found".
            * `summary_feedback`: (String) 2-3 sentences.
            * `scores`: (Object) with keys: `correctness`, `efficiency`, `readability`, `robustness` (scores 1-10).
            
            Generate the JSON object now. Do NOT include ```json markdown.
            """
        
        analysis_data = {}
        try:
            print(f"⏳ Calling Gemini API to *analyze* practice submission for user {user_id}")
            response = gemini_model.generate_content(prompt)
            cleaned_response_text = re.sub(r'^```(json)?\s*|\s*```$', '', response.text, flags=re.MULTILINE | re.DOTALL).strip()
            
            analysis_data = json.loads(cleaned_response_text)
            
            # --- *** THIS IS THE FIX *** ---
            # Add the validation check back in
            if not ("overall_status" in analysis_data and "summary_feedback" in analysis_data and "scores" in analysis_data):
                raise ValueError("AI analysis response missing required keys (overall_status, summary_feedback, scores).")
            # --- *** END FIX *** ---

        except ResourceExhausted as rate_limit_error:
            print(f"❌ RATE LIMIT HIT for Gemini API (Analysis): {rate_limit_error}")
            return jsonify({"error": "AI Analyzer is busy, please try submitting again in a moment."}), 429
        except (json.JSONDecodeError, ValueError) as json_error:
            print(f"❌ Error parsing AI analysis response for user {user_id}: {json_error}")
            print(f"--- Raw AI Analysis Response ---:\n{cleaned_response_text}\n---")
            return jsonify({"error": "AI generated an invalid analysis format."}), 500
        except Exception as e:
             print(f"❌ Error during AI analysis call for user {user_id}: {e}")
             traceback.print_exc()
             return jsonify({"error": "An unexpected error occurred during AI analysis."}), 500
        
        # 2. Save attempt to practice_history table
        conn = get_db_connection()
        if not conn: return jsonify({"error": "Database connection failed."}), 500
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO practice_history
            (user_id, skill, difficulty, question_data, user_code, ai_analysis, overall_status, attempted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id, skill, difficulty,
            json.dumps(question), source_code, json.dumps(analysis_data),
            analysis_data.get('overall_status'), datetime.now()
        ))
        conn.commit()
        print(f"✅ Saved practice attempt for user {user_id}, skill {skill}")

        # 3. Return analysis data
        return jsonify(analysis_data), 200

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error during AI code submission/saving for user {user_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during code analysis."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# --- /practice/history route (Unchanged) ---
@practice_bp.route('/practice/history', methods=['GET'])
def get_practice_history():
    # ... (This function is correct) ...
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
        cur.execute("SELECT id, skill, difficulty, question_data, user_code, ai_analysis, overall_status, attempted_at FROM practice_history WHERE user_id = %s ORDER BY attempted_at DESC LIMIT 20", (user_id,))
        history_data = cur.fetchall()
        for item in history_data:
            try:
                if item.get('question_data'): item['question_data'] = json.loads(item['question_data'])
            except (json.JSONDecodeError, TypeError): item['question_data'] = {"title": "Error: Corrupt data"}
            try:
                if item.get('ai_analysis'): item['ai_analysis'] = json.loads(item['ai_analysis'])
            except (json.JSONDecodeError, TypeError): item['ai_analysis'] = {"summary_feedback": "Error: Corrupt data"}
            if item.get('attempted_at'):
                item['attempted_at'] = item['attempted_at'].strftime('%d %b %Y, %I:%M %p')
        return jsonify({"history": history_data}), 200
    except Exception as e:
        print(f"❌ Error fetching practice history for user {user_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred fetching history."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()