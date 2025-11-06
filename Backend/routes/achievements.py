from flask import Blueprint, request, jsonify
import jwt
import json
from db_config import get_db_connection
from config import SECRET_KEY
import traceback # Import for error logging

achievements_bp = Blueprint('achievements', __name__)

@achievements_bp.route('/achievements', methods=['GET'])
def get_achievements():
    """
    Gathers all of a user's achievements: completed roadmap courses,
    skill gap analysis history, and practice history.
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
        achievements = {
            "completed_courses": [],
            "skill_analyses": [],
            "practice_history": [], # --- NEW ---
            "practice_skill_count": 0 # --- NEW ---
        }

        # --- 1. Fetch Completed Roadmap Courses and Quiz History ---
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
            
        # --- 3. NEW: Fetch Practice History ---
        cur.execute("""
            SELECT id, skill, difficulty, overall_status, attempted_at, question_data, user_code, ai_analysis
            FROM practice_history
            WHERE user_id = %s
            ORDER BY attempted_at DESC
            LIMIT 5 
        """, (user_id,))
        
        practice_attempts = cur.fetchall()
        practiced_skills = set()
        
        for attempt in practice_attempts:
            achievements["practice_history"].append({
                "id": attempt['id'],
                "skill": attempt['skill'],
                "difficulty": attempt['difficulty'],
                "status": attempt['overall_status'],
                "date": attempt['attempted_at'].strftime('%d %b %Y'),
                # We need to re-serialize the JSON for the modal
                "details": {
                    "skill": attempt['skill'],
                    "difficulty": attempt['difficulty'],
                    "question_data": json.loads(attempt['question_data']) if attempt['question_data'] else None,
                    "user_code": attempt['user_code'],
                    "ai_analysis": json.loads(attempt['ai_analysis']) if attempt['ai_analysis'] else None,
                    "attempted_at": attempt['attempted_at'].strftime('%d %b %Y, %I:%M %p')
                }
            })
            practiced_skills.add(attempt['skill']) # Add to set for unique count
            
        # --- 4. NEW: Add the count of unique skills practiced ---
        achievements["practice_skill_count"] = len(practiced_skills)
        

        return jsonify(achievements), 200

    except Exception as e:
        print(f"❌ Error fetching achievements: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500
    finally:
        cur.close()
        conn.close()