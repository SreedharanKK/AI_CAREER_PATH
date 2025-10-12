from flask import Blueprint, request, jsonify
import jwt
import json
from db_config import get_db_connection
from config import SECRET_KEY

# A single blueprint for all dashboard preview data
dashboard_previews_bp = Blueprint('dashboard_previews', __name__)


@dashboard_previews_bp.route('/roadmap/latest', methods=['GET'])
def get_latest_roadmap():
    """
    Finds and returns a summary of the most recent roadmap created
    by the currently authenticated user.
    """
    # --- Securely identify the user via JWT token ---
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    # --- Fetch the latest record from the database ---
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # Query the roadmaps table, ordering by creation date to find the newest one
        cur.execute(
            """
            SELECT domain, roadmap 
            FROM roadmaps 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            (user_id,)
        )
        latest_record = cur.fetchone()

        if not latest_record:
            return jsonify({"message": "No roadmap found."}), 200

        # Parse the roadmap JSON to create a summary
        if latest_record['roadmap']:
            roadmap_data = json.loads(latest_record['roadmap'])
            
            # For the summary, we'll send the domain and the title of the very first stage
            first_stage_title = ""
            if roadmap_data.get('roadmap') and len(roadmap_data['roadmap']) > 0:
                first_stage_title = roadmap_data['roadmap'][0].get('stage_title', 'First Steps')
            
            summary = {
                "domain": latest_record['domain'],
                "first_stage": first_stage_title
            }
            return jsonify({"roadmap": summary}), 200
        else:
            return jsonify({"message": "No roadmap found."}), 200

    except Exception as e:
        print(f"❌ Error fetching latest roadmap: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()


@dashboard_previews_bp.route('/skill-gap/latest', methods=['GET'])
def get_latest_analysis():
    """
    Finds and returns the most recent skill gap analysis record
    for the currently authenticated user.
    """
    # --- Securely identify the user via JWT token ---
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    # --- Fetch the latest record from the database ---
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        # Query the analysis table, ordering by creation date to find the newest one
        cur.execute(
            """
            SELECT interested_domain, missing_skills 
            FROM skill_gap_analysis 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            (user_id,)
        )
        latest_record = cur.fetchone()

        if not latest_record:
            # It's okay if a user hasn't run an analysis yet
            return jsonify({"message": "No analysis found for this user."}), 200

        # The missing_skills are stored as a JSON string, so we need to parse it
        if latest_record['missing_skills']:
            latest_record['missing_skills'] = json.loads(latest_record['missing_skills'])
        else:
            latest_record['missing_skills'] = []
            
        return jsonify({"analysis": latest_record}), 200

    except Exception as e:
        print(f"❌ Error fetching latest analysis: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()


@dashboard_previews_bp.route('/learning-recommendations/latest', methods=['GET'])
def get_latest_recommendations_summary():
    """
    Finds and returns a summary (list of topics) of the most recent
    learning recommendations for the authenticated user.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT recommendations FROM learning_recommendations WHERE user_id = %s ORDER BY generated_at DESC LIMIT 1",
            (user_id,)
        )
        latest_record = cur.fetchone()

        if not latest_record or not latest_record['recommendations']:
            return jsonify({"message": "No recommendations found."}), 200

        # Parse the JSON and extract just the topic titles for the summary
        recommendations_list = json.loads(latest_record['recommendations'])
        topics = [rec.get('topic', 'N/A') for rec in recommendations_list]

        return jsonify({"recommendations_summary": {"topics": topics}}), 200

    except Exception as e:
        print(f"❌ Error fetching latest recommendations summary: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()


@dashboard_previews_bp.route('/achievements/summary', methods=['GET'])
def get_achievements_summary():
    """
    Calculates and returns a summary of the user's achievements,
    including completed courses and total analyses performed.
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
        # Count the number of completed courses
        cur.execute(
            "SELECT COUNT(*) as completed_count FROM user_roadmap_progress WHERE user_id = %s AND is_completed = TRUE",
            (user_id,)
        )
        completed_courses = cur.fetchone()

        # Count the number of skill gap analyses run
        cur.execute(
            "SELECT COUNT(*) as analysis_count FROM skill_gap_analysis WHERE user_id = %s",
            (user_id,)
        )
        skill_analyses = cur.fetchone()

        summary = {
            "completed_courses": completed_courses['completed_count'] or 0,
            "skill_analyses_count": skill_analyses['analysis_count'] or 0
        }
        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"❌ Error fetching achievements summary: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()
