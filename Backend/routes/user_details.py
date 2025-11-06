import os
import json
import jwt
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from db_config import get_db_connection
from config import SECRET_KEY
from datetime import datetime
import traceback
import threading # <-- Import threading

# --- NEW: Import the skill extraction function ---
try:
    # Assuming utils/skill_extractor.py is accessible
    from utils.skill_extractor import trigger_skill_extraction
except ImportError:
    print("⚠️ WARNING: utils.skill_extractor.py not found or cannot be imported. Skill extraction on resume update will be skipped.")
    trigger_skill_extraction = None # Set to None if import fails
# --------------------------------------------------
try:
    from routes.news_feed import clear_news_cache
except ImportError:
    print("⚠️ WARNING: Could not import clear_news_cache. Cache won't be cleared on profile update.")
    clear_news_cache = None

user_details_bp = Blueprint("user_details", __name__)

# === File Storage Paths ===
BASE_DIR = os.path.abspath(os.path.dirname(os.path.abspath(__file__)))
# Navigate up one level ('..') from 'routes' directory to the project root
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads", "resumes")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@user_details_bp.route("/update", methods=["POST"])
def update_user_details():
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Not logged in"}), 401

    user_id = None
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session"}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    new_resume_processed = False # Flag to trigger skill extraction

    try:
        # Fetch Existing Details
        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        existing_details = cursor.fetchone() or {}

        # Handle Date Formatting
        dob_from_form = request.form.get("dob")
        final_dob = None
        if dob_from_form:
            try:
                dt_object = datetime.strptime(dob_from_form, '%Y-%m-%d')
                final_dob = dt_object.strftime('%Y-%m-%d')
            except ValueError:
                try:
                    dt_object = datetime.strptime(dob_from_form, '%a, %d %b %Y %H:%M:%S %Z')
                    final_dob = dt_object.strftime('%Y-%m-%d')
                except ValueError:
                    print(f"Warning: Could not parse DOB string: {dob_from_form}")
                    final_dob = existing_details.get("dob")
        else:
            final_dob = existing_details.get("dob")

        # Safely parse JSON strings from form or use existing lists
        def parse_json_list_from_form(form_key, existing_db_value):
            form_value = request.form.get(form_key)
            if form_value is not None:
                try:
                    parsed = json.loads(form_value)
                    if isinstance(parsed, list):
                        return json.dumps(parsed)
                except (json.JSONDecodeError, TypeError):
                    items = [v.strip() for v in form_value.split(",") if v.strip()]
                    return json.dumps(items)
            
            # Handle existing value (from DB or default dict)
            if existing_db_value:
                if isinstance(existing_db_value, list): return json.dumps(existing_db_value)
                # Check if it's a valid JSON string before returning
                try: 
                    json.loads(existing_db_value)
                    return existing_db_value
                except (json.JSONDecodeError, TypeError):
                    return json.dumps([]) # It was invalid, return empty list
            return json.dumps([])

        # Merge New Data with Existing Data
        updated_data = {
            "dob": final_dob,
            "place": request.form.get("place") or existing_details.get("place"),
            "degree": request.form.get("degree") or existing_details.get("degree"),
            "stream": request.form.get("stream") or existing_details.get("stream"),
            "college": request.form.get("college") or existing_details.get("college"),
            "year": request.form.get("year") or existing_details.get("year"),
            "skills": parse_json_list_from_form("skills", existing_details.get("skills")),
            "domain": parse_json_list_from_form("domain", existing_details.get("domain")),
            "resume_path": existing_details.get("resume_path"),
            "extracted_path": existing_details.get("extracted_path")
        }

        # --- Handle Resume File Upload ---
        resume_file = request.files.get("resume")
        if resume_file and resume_file.filename:
            try:
                # 1. Save the resume
                filename = secure_filename(f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{resume_file.filename}")
                resume_save_path = os.path.join(UPLOAD_FOLDER, filename)
                resume_file.save(resume_save_path)
                
                updated_data["resume_path"] = f"uploads/resumes/{filename}" # Set relative path
                print(f"Saved new resume to: {resume_save_path}")

                # --- *** THIS IS THE FIX *** ---
                # Set the flag to True HERE, right after saving the file.
                # This ensures the skill extraction thread runs
                # even if text extraction fails.
                new_resume_processed = True
                # --- *** END FIX *** ---

                # 2. Extract text from the new resume
                extracted_text = extract_resume_text(resume_save_path)
                
                if "Error" in extracted_text or "Unsupported" in extracted_text:
                    print(f"Warning: Issue extracting text from {filename}: {extracted_text}")
                    # Save NULL to the text table
                    cursor.execute(
                        "INSERT INTO extracted_resume_text (user_id, extracted_text) VALUES (%s, %s) ON DUPLICATE KEY UPDATE extracted_text = %s",
                        (user_id, None, None)
                    )
                else:
                    # Save extracted text to DATABASE
                    cursor.execute(
                        "INSERT INTO extracted_resume_text (user_id, extracted_text) VALUES (%s, %s) ON DUPLICATE KEY UPDATE extracted_text = %s",
                        (user_id, extracted_text, extracted_text)   
                    )
                    print(f"Saved extracted text to DATABASE for user {user_id}")
                    # --- REMOVED: new_resume_processed = True (moved up) ---

            except Exception as file_error:
                print(f"❌ Error processing uploaded resume file: {file_error}")
                traceback.print_exc()
                # Do not change paths, keep the old ones
                updated_data["resume_path"] = existing_details.get("resume_path")

        # Decide whether to INSERT or UPDATE
        if 'id' in existing_details:
            query = """
                UPDATE user_details SET dob=%s, place=%s, degree=%s, stream=%s,
                                skills=%s, domain=%s, college=%s, year=%s,
                                resume_path=%s
                WHERE user_id=%s
            """
            params = (
                updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                updated_data["resume_path"], 
                user_id,
            )
        else:
            query = """
                INSERT INTO user_details (user_id, dob, place, degree, stream, skills,
                                          domain, college, year, resume_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            params = (
                user_id, updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                updated_data["resume_path"],
            )

        cursor.execute(query, params)
        conn.commit()
        # This log will now show the path that was *actually* saved
        print(f"✅ Successfully saved user_details for user {user_id}.")
        if clear_news_cache:
            clear_news_cache(user_id)
            print(f"✅ Cleared news cache for user {user_id} after profile update.")

        # Trigger Skill Extraction in background if new resume was processed
        if new_resume_processed and trigger_skill_extraction:
            extraction_thread = threading.Thread(
                target=trigger_skill_extraction,
                args=(user_id,),
                name=f"SkillExtractThread-User{user_id}"
            )
            extraction_thread.start()
            print(f"✅ Started background skill extraction for user_id: {user_id} after resume update.")
        
        return jsonify({"success": True, "message": "User details updated successfully"}), 200

    except Exception as e:
        print(f"❌ Error updating user details (User ID: {user_id}): {e}")
        traceback.print_exc()
        conn.rollback()
        return jsonify({"success": False, "error": "An internal server error occurred during update."}), 500

    finally:
        cursor.close()
        conn.close()


def extract_resume_text(file_path):
    """Extract basic text from PDF resumes"""
    extracted_text = ""
    try:
        if file_path and file_path.lower().endswith(".pdf"): # Check if path exists
            reader = PdfReader(file_path)
            for page in reader.pages:
                extracted_text += page.extract_text() or "" # Handle pages that might return None
            if not extracted_text.strip():
                extracted_text = "Could not extract text (PDF might be image-based or empty)."
        elif file_path:
            extracted_text = "Unsupported file format (only PDF supported)."
        else:
            extracted_text = "No file path provided."
    except Exception as e:
        print(f"Error during PDF text extraction ({file_path}): {e}")
        extracted_text = f"Error extracting resume: {e}"

    return extracted_text

# --- Route to GET details remains unchanged ---
@user_details_bp.route("/details", methods=["GET"])
def get_details():
    # ... (Keep existing code for GET /details) ...
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Not logged in"}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except jwt.ExpiredSignatureError: return jsonify({"error": "Session expired"}), 401
    except jwt.InvalidTokenError: return jsonify({"error": "Invalid token"}), 401

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT full_name, email FROM users_auth WHERE id = %s", (user_id,))
        user_auth_rows = cursor.fetchall()
        user_auth = user_auth_rows[0] if user_auth_rows else None
        if not user_auth: return jsonify({"error": "User not found"}), 404

        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        user_extra_rows = cursor.fetchall()
        user_extra = user_extra_rows[0] if user_extra_rows else None

        # Helper to safely load JSON or return empty list
        def safe_json_load(data):
            if data:
                try:
                    if isinstance(data, (bytes, bytearray)): data = data.decode('utf-8')
                    loaded = json.loads(data)
                    return loaded if isinstance(loaded, list) else []
                except (json.JSONDecodeError, TypeError):
                    return []
            return []

        data = {
            "fullName": user_auth.get("full_name"),
            "email": user_auth.get("email"),
            "dob": user_extra.get("dob") if user_extra else None, # Return None if not set
            "place": user_extra.get("place") if user_extra else "",
            "degree": user_extra.get("degree") if user_extra else "",
            "stream": user_extra.get("stream") if user_extra else "",
            "skills": safe_json_load(user_extra.get("skills")) if user_extra else [],
            "domain": safe_json_load(user_extra.get("domain")) if user_extra else [], # Assuming domain is also JSON list now
            "college": user_extra.get("college") if user_extra else "",
            "year": user_extra.get("year") if user_extra else "",
            "resume": user_extra.get("resume_path") if user_extra else "",
        }
        return jsonify(data), 200
    except Exception as e:
        print(f"❌ Error in get_details: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cursor.close()
        conn.close()
