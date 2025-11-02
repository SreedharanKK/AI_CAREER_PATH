# routes/saved_jobs.py
from flask import Blueprint, request, jsonify
import jwt
import json
import traceback
from db_config import get_db_connection
from config import SECRET_KEY
from datetime import datetime

saved_jobs_bp = Blueprint('saved_jobs', __name__)

# --- Route 1: Get ALL saved jobs (full data) ---
@saved_jobs_bp.route('/saved-jobs', methods=['GET'])
def get_saved_jobs():
    """Fetches all full job data for the user's saved jobs."""
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
        cur.execute("""
            SELECT job_data, saved_at FROM saved_jobs
            WHERE user_id = %s
            ORDER BY saved_at DESC
        """, (user_id,))
        
        saved_jobs = cur.fetchall()
        
        # Extract the job_data JSON from each row
        job_list = []
        for item in saved_jobs:
            if item.get('job_data'):
                try:
                    job_data = json.loads(item['job_data'])
                    job_data['saved_at_timestamp'] = item['saved_at'].strftime('%d %b %Y, %I:%M %p')
                    job_list.append(job_data)
                except (json.JSONDecodeError, TypeError):
                    print(f"Warning: Could not parse job_data for saved job ID {item.get('id')}")

        return jsonify({"saved_jobs": job_list}), 200

    except Exception as e:
        print(f"❌ Error fetching saved jobs: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

# --- Route 2: Get ONLY the IDs of saved jobs ---
@saved_jobs_bp.route('/saved-jobs/ids', methods=['GET'])
def get_saved_job_ids():
    """Fetches a lightweight list of just the job_ids the user has saved."""
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
        cur.execute("SELECT job_id FROM saved_jobs WHERE user_id = %s", (user_id,))
        rows = cur.fetchall()
        # Create a Set for fast lookup on the frontend
        id_set = {row['job_id'] for row in rows}
        return jsonify({"saved_job_ids": list(id_set)}), 200
    except Exception as e:
        print(f"❌ Error fetching saved job IDs: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

# --- Route 3: Save a job ---
@saved_jobs_bp.route('/save-job', methods=['POST'])
def save_job():
    """Saves a new job to the user's list."""
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401
        
    job_data = request.get_json()
    if not job_data or not job_data.get('job_id'):
        return jsonify({"error": "Invalid job data provided."}), 400

    job_id = job_data.get('job_id')
    job_data_json = json.dumps(job_data) # Store the whole object

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO saved_jobs (user_id, job_id, job_data)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE job_data = VALUES(job_data)
        """, (user_id, job_id, job_data_json))
        
        conn.commit()
        return jsonify({"success": True, "job_id": job_id, "action": "saved"}), 201

    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving job: {e}")
        return jsonify({"error": "An error occurred while saving."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

# --- Route 4: Unsave a job ---
@saved_jobs_bp.route('/unsave-job/<job_id>', methods=['DELETE'])
def unsave_job(job_id):
    """Removes a job from the user's saved list."""
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401
        
    if not job_id:
        return jsonify({"error": "Job ID is required."}), 400

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM saved_jobs WHERE user_id = %s AND job_id = %s
        """, (user_id, job_id))
        
        conn.commit()
        
        if cur.rowcount > 0:
            return jsonify({"success": True, "job_id": job_id, "action": "unsaved"}), 200
        else:
            # This can happen if they spam click, it's not a real error
            return jsonify({"success": False, "message": "Job not found or already unsaved."}), 404

    except Exception as e:
        conn.rollback()
        print(f"❌ Error unsaving job: {e}")
        return jsonify({"error": "An error occurred while unsaving."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()
