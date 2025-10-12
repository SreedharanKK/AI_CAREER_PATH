from flask import Blueprint, request, jsonify
import jwt
import json
from db_config import get_db_connection
from config import SECRET_KEY

achievements_bp = Blueprint('achievements', __name__)

@achievements_bp.route('/achievements', methods=['GET'])
def get_achievements():
    """
    Gathers all of a user's achievements: completed roadmap courses with scores,
    detailed quiz history, and the latest skill gap analysis.
    """
    # --- Securely identify the user ---
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
        achievements = {
            "completed_courses": [],
            "skill_analyses": []
        }

        # --- 1. Fetch Completed Roadmap Courses and Quiz History ---
        # This query joins all necessary tables to get course titles, scores, and detailed quiz data
        cur.execute("""
            SELECT 
                r.domain, 
                JSON_UNQUOTE(JSON_EXTRACT(r.roadmap, CONCAT('$.roadmap[', urp.stage_index, '].steps[', urp.step_index, '].title'))) AS course_title,
                urp.test_score,
                qh.quiz_data
            FROM user_roadmap_progress urp
            JOIN roadmaps r ON urp.roadmap_id = r.id
            LEFT JOIN quiz_history qh ON urp.id = qh.progress_id
            WHERE urp.user_id = %s AND urp.is_completed = TRUE
            ORDER BY r.domain, urp.completed_at DESC
        """, (user_id,))
        
        completed_courses = cur.fetchall()
        for course in completed_courses:
            achievements["completed_courses"].append({
                "domain": course['domain'],
                "course_title": course['course_title'],
                "score": course['test_score'],
                "quiz_details": json.loads(course['quiz_data']) if course['quiz_data'] else None
            })

        # --- 2. Fetch All Skill Gap Analyses ---
        cur.execute(
            "SELECT interested_domain, missing_skills, recommended_courses, created_at FROM skill_gap_analysis WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        analyses = cur.fetchall()
        for analysis in analyses:
            achievements["skill_analyses"].append({
                "domain": analysis['interested_domain'],
                "missing_skills": json.loads(analysis['missing_skills']) if analysis['missing_skills'] else [],
                "recommendations": json.loads(analysis['recommended_courses']) if analysis['recommended_courses'] else [],
                "date": analysis['created_at'].strftime('%d %b %Y')
            })

        return jsonify(achievements), 200

    except Exception as e:
        print(f"❌ Error fetching achievements: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()
