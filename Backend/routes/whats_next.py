# In a new file, e.g., routes/whats_next.py
from flask import Blueprint, jsonify, request
import jwt, json
from db_config import get_db_connection
from config import SECRET_KEY

whats_next_bp = Blueprint('whats_next', __name__)

@whats_next_bp.route('/whats-next', methods=['GET'])
def get_whats_next():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except:
        return jsonify({"error": "Invalid or expired session."}), 401

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database connection failed."}), 500
    cur = conn.cursor(dictionary=True)
    
    try:
        # --- Priority 1: Check for an active, incomplete roadmap step ---
        cur.execute("""
            SELECT 
                r.domain,
                JSON_UNQUOTE(JSON_EXTRACT(r.roadmap, CONCAT('$.roadmap[', urp.stage_index, '].steps[', urp.step_index, '].title'))) AS next_step_title
            FROM user_roadmap_progress urp
            JOIN roadmaps r ON urp.roadmap_id = r.id
            WHERE urp.user_id = %s 
              AND urp.is_unlocked = TRUE 
              AND urp.is_completed = FALSE
            ORDER BY urp.stage_index, urp.step_index
            LIMIT 1
        """, (user_id,))
        
        next_step = cur.fetchone()
        if next_step:
            return jsonify({
                "type": "ROADMAP_STEP",
                "payload": {
                    "title": next_step['next_step_title'],
                    "link": "/Roadmap"
                }
            }), 200

        # --- Priority 2: Check for missing skills from the last analysis ---
        cur.execute("""
            SELECT interested_domain, missing_skills
            FROM skill_gap_analysis
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        last_analysis = cur.fetchone()
        if last_analysis and last_analysis['missing_skills']:
            missing_skills_list = json.loads(last_analysis['missing_skills'])
            # Filter for skills that are "practiceable"
            practiceable_skills = [skill for skill in missing_skills_list if is_practiceable(skill)]
            
            if practiceable_skills:
                return jsonify({
                    "type": "PRACTICE_SKILLS",
                    "payload": {
                        "skill": practiceable_skills[0], # Suggest the first one
                        "link": "/PracticePage"
                    }
                }), 200

        # --- Priority 3: Default action - Run a skill gap analysis ---
        cur.execute("SELECT domain FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()
        if user_details and user_details['domain']:
            user_domains = json.loads(user_details['domain'])
            if user_domains:
                return jsonify({
                    "type": "RUN_ANALYSIS",
                    "payload": {
                        "domain": user_domains[0], # Suggest their primary domain
                        "link": "/SkillGapAnalysis"
                    }
                }), 200
                
        # --- Priority 4: Welcome / Fallback ---
        return jsonify({
            "type": "WELCOME",
            "payload": {
                "title": "Welcome!",
                "message": "Start by setting up your profile or generating your first roadmap.",
                "link": "/UpdateDetails" # Or /Roadmap
            }
        }), 200

    except Exception as e:
        print(f"Error in /whats-next: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        cur.close()
        conn.close()

# Helper function (you can put this in a utils file)
def is_practiceable(skill):
    if not skill: return False
    lower_skill = skill.lower().strip()
    PRACTICEABLE_LANGUAGES = ['python', 'java', 'javascript', 'c++', 'cpp', 'c', 'react', 'node', 'js', 'sql']
    return any(lang in lower_skill for lang in PRACTICEABLE_LANGUAGES)