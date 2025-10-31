import os
import json
import jwt
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from db_config import get_db_connection
from config import SECRET_KEY
from datetime import datetime
import threading # <-- Import threading

# --- NEW: Import the skill extraction function ---
try:
    # Assuming utils/skill_extractor.py is accessible
    from utils.skill_extractor import trigger_skill_extraction
except ImportError:
    print("⚠️ WARNING: utils.skill_extractor.py not found or cannot be imported. Skill extraction on resume update will be skipped.")
    trigger_skill_extraction = None # Set to None if import fails
# --------------------------------------------------

user_details_bp = Blueprint("user_details", __name__)

# === File Storage Paths ===
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Navigate up one level ('..') from 'routes' directory to the project root
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads", "resumes")
EXTRACT_FOLDER = os.path.join(BASE_DIR, "..", "uploads", "extracted")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXTRACT_FOLDER, exist_ok=True)


@user_details_bp.route("/update", methods=["POST"])
def update_user_details():
    # ✅ Step 1: Verify Token
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Not logged in"}), 401

    user_id = None # Initialize user_id
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session"}), 401

    # ✅ Step 2: Connect to Database
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    new_resume_processed = False # --- Flag to track if a new resume was handled ---

    try:
        # Fetch Existing Details
        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        existing_details = cursor.fetchone() or {}

        # Handle Date Formatting
        dob_from_form = request.form.get("dob")
        final_dob = None
        if dob_from_form:
            try: # Try specific format first if necessary
                 dt_object = datetime.strptime(dob_from_form, '%a, %d %b %Y %H:%M:%S %Z')
                 final_dob = dt_object.strftime('%Y-%m-%d')
            except ValueError: # Assume YYYY-MM-DD
                 final_dob = dob_from_form
        else:
            final_dob = existing_details.get("dob") # Keep existing if none provided

        # Safely parse JSON strings from form or use existing lists
        def parse_json_list_from_form(form_key, existing_list):
            form_value = request.form.get(form_key)
            if form_value is not None: # Check if the key exists in the form data
                try:
                    # Attempt to parse assuming it might be JSON from frontend state
                    parsed = json.loads(form_value)
                    if isinstance(parsed, list):
                        return json.dumps(parsed) # Re-stringify for DB
                except (json.JSONDecodeError, TypeError):
                    # If parsing fails or it's not JSON, treat as comma-separated
                    items = [v.strip() for v in form_value.split(",") if v.strip()]
                    return json.dumps(items) # Stringify the list
            # If not in form, return the stringified existing list or empty list
            return json.dumps(existing_list or [])

        # Merge New Data with Existing Data
        updated_data = {
            "dob": final_dob,
            "place": request.form.get("place") or existing_details.get("place"),
            "degree": request.form.get("degree") or existing_details.get("degree"),
            "stream": request.form.get("stream") or existing_details.get("stream"),
            "college": request.form.get("college") or existing_details.get("college"),
            "year": request.form.get("year") or existing_details.get("year"),
            # --- Use helper to handle skills/domain ---
            "skills": parse_json_list_from_form("skills", existing_details.get("skills")),
            "domain": parse_json_list_from_form("domain", existing_details.get("domain")),
            # ----------------------------------------
            "resume_path": existing_details.get("resume_path"), # Start with existing paths
            "extracted_path": existing_details.get("extracted_path")
        }

        # --- Handle Resume File Upload ---
        resume_file = request.files.get("resume")
        if resume_file and resume_file.filename: # Check if a file was actually uploaded
            try:
                # Securely save the resume
                filename = secure_filename(f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{resume_file.filename}")
                resume_save_path = os.path.join(UPLOAD_FOLDER, filename)
                resume_file.save(resume_save_path)
                updated_data["resume_path"] = f"uploads/resumes/{filename}" # Relative path for serving
                print(f"Saved new resume to: {resume_save_path}")

                # Extract text from the new resume
                extracted_text = extract_resume_text(resume_save_path)
                if "Error extracting resume" in extracted_text or "Unsupported file format" in extracted_text:
                     print(f"Warning: Issue extracting text from {filename}: {extracted_text}")
                     updated_data["extracted_path"] = None # Indicate extraction failure
                else:
                    extracted_filename = os.path.splitext(filename)[0] + "_extracted.txt"
                    extracted_file_path = os.path.join(EXTRACT_FOLDER, extracted_filename)
                    with open(extracted_file_path, "w", encoding="utf-8") as f:
                        f.write(extracted_text)
                    updated_data["extracted_path"] = f"uploads/extracted/{extracted_filename}" # Relative path
                    print(f"Saved extracted text to: {extracted_file_path}")
                    new_resume_processed = True # --- Set flag indicating success ---

            except Exception as file_error:
                print(f"❌ Error processing uploaded resume file: {file_error}")
                # Don't update resume/extracted paths if saving/extraction failed
                updated_data["resume_path"] = existing_details.get("resume_path")
                updated_data["extracted_path"] = existing_details.get("extracted_path")
                # Optionally return an error to the user:
                # conn.rollback()
                # cursor.close()
                # conn.close()
                # return jsonify({"success": False, "error": "Failed to process uploaded resume."}), 500


        # Decide whether to INSERT or UPDATE
        if 'id' in existing_details:
            # UPDATE existing record
            query = """
                UPDATE user_details SET dob=%s, place=%s, degree=%s, stream=%s,
                       skills=%s, domain=%s, college=%s, year=%s,
                       resume_path=%s, extracted_path=%s
                WHERE user_id=%s
            """
            params = (
                updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                updated_data["resume_path"], updated_data["extracted_path"], user_id,
            )
        else:
            # INSERT new record
            query = """
                INSERT INTO user_details (user_id, dob, place, degree, stream, skills,
                                          domain, college, year, resume_path, extracted_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            params = (
                user_id, updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                updated_data["resume_path"], updated_data["extracted_path"],
            )

        cursor.execute(query, params)
        conn.commit() # Commit database changes

        # --- *** NEW: Trigger Skill Extraction if New Resume Processed *** ---
        if new_resume_processed and trigger_skill_extraction:
            extraction_thread = threading.Thread(
                target=trigger_skill_extraction,
                args=(user_id,),
                name=f"SkillExtractThread-User{user_id}" # Optional thread name
            )
            extraction_thread.start()
            print(f"✅ Started background skill extraction for user_id: {user_id} after resume update.")
        elif new_resume_processed:
            print("ℹ️ New resume processed, but skill extractor function not available. Skipping background extraction.")
        # ------------------------------------------------------------------

        return jsonify({"success": True, "message": "User details updated successfully"}), 200

    except Exception as e:
        print(f"❌ Error updating user details (User ID: {user_id}): {e}")
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