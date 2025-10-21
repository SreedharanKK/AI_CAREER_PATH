import os
import json
import jwt
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from db_config import get_db_connection
from config import SECRET_KEY
from datetime import datetime # 1. Import the datetime library

user_details_bp = Blueprint("user_details", __name__)

# === File Storage Paths ===
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
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

    try:
        # --- Fetch Existing Details First ---
        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        existing_details = cursor.fetchone() or {}

        # --- 2. NEW LOGIC: Handle Date Formatting ---
        dob_from_form = request.form.get("dob")
        final_dob = dob_from_form if dob_from_form else existing_details.get("dob")

        if dob_from_form:
            try:
                # First, try to parse the complex format: 'Mon, 22 Nov 2004 00:00:00 GMT'
                dt_object = datetime.strptime(dob_from_form, '%a, %d %b %Y %H:%M:%S %Z')
                final_dob = dt_object.strftime('%Y-%m-%d')
            except ValueError:
                # If it fails, the date is likely already in the correct 'YYYY-MM-DD' format
                final_dob = dob_from_form
        else:
            # If no new date was submitted, keep the existing one
            final_dob = existing_details.get("dob")
        
        # --- Merge New Data with Existing Data ---
        updated_data = {
            "dob": final_dob, # Use the correctly formatted date
            "place": request.form.get("place") or existing_details.get("place"),
            "degree": request.form.get("degree") or existing_details.get("degree"),
            "stream": request.form.get("stream") or existing_details.get("stream"),
            "college": request.form.get("college") or existing_details.get("college"),
            "year": request.form.get("year") or existing_details.get("year"),
            "skills": request.form.get("skills") or json.dumps(existing_details.get("skills", [])),
            "domain": request.form.get("domain") or json.dumps(existing_details.get("domain", [])),
            "resume_path": existing_details.get("resume_path"),
            "extracted_path": existing_details.get("extracted_path")
        }

        # Handle Resume File Upload
        resume_file = request.files.get("resume")
        if resume_file:
            filename = secure_filename(f"{user_id}_{resume_file.filename}")
            resume_save_path = os.path.join(UPLOAD_FOLDER, filename)
            resume_file.save(resume_save_path)
            
            updated_data["resume_path"] = f"uploads/resumes/{filename}"

            extracted_text = extract_resume_text(resume_save_path)
            extracted_filename = os.path.splitext(filename)[0] + "_extracted.txt"
            extracted_file_path = os.path.join(EXTRACT_FOLDER, extracted_filename)

            with open(extracted_file_path, "w", encoding="utf-8") as f:
                f.write(extracted_text)
            
            updated_data["extracted_path"] = f"uploads/extracted/{extracted_filename}"

        # Decide whether to INSERT or UPDATE
        if 'id' in existing_details:
            query = """
                UPDATE user_details
                SET dob=%s, place=%s, degree=%s, stream=%s,
                    skills=%s, domain=%s, college=%s, year=%s,
                    resume_path=%s, extracted_path=%s
                WHERE user_id=%s
            """
            cursor.execute(
                query,
                (
                    updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                    updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                    updated_data["resume_path"], updated_data["extracted_path"], user_id,
                ),
            )
        else:
            query = """
                INSERT INTO user_details (
                    user_id, dob, place, degree, stream,
                    skills, domain, college, year, resume_path, extracted_path
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(
                query,
                (
                    user_id, updated_data["dob"], updated_data["place"], updated_data["degree"], updated_data["stream"],
                    updated_data["skills"], updated_data["domain"], updated_data["college"], updated_data["year"],
                    updated_data["resume_path"], updated_data["extracted_path"],
                ),
            )

        conn.commit()
        return jsonify({"success": True, "message": "User details updated successfully"}), 200

    except Exception as e:
        print(f"❌ Error updating user details: {e}")
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


def extract_resume_text(file_path):
    """Extract basic text from PDF resumes"""
    extracted_text = ""
    try:
        if file_path.lower().endswith(".pdf"):
            reader = PdfReader(file_path)
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        else:
            extracted_text = "Unsupported file format."
    except Exception as e:
        extracted_text = f"Error extracting resume: {e}"

    return extracted_text

