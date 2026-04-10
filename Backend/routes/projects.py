from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
from google.api_core.exceptions import ResourceExhausted

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/generate-project', methods=['POST'])
def generate_project():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except:
        return jsonify({"error": "Invalid session."}), 401

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # 1. Get User Context (Skills & Domain)
        cur.execute("SELECT skills, domain FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()
        
        user_skills = "General Programming"
        user_domain = "Software Engineering"

        if user_details:
            if user_details.get('skills'):
                # Handle potentially JSON-encoded skills
                try: 
                    s = json.loads(user_details['skills']) 
                    user_skills = ", ".join(s) if isinstance(s, list) else user_details['skills']
                except: user_skills = user_details['skills']
            
            if user_details.get('domain'):
                try:
                    d = json.loads(user_details['domain'])
                    user_domain = d[0] if isinstance(d, list) and len(d) > 0 else "Software Engineer"
                except: user_domain = "Software Engineer"

        # 2. AI Prompt
        prompt = f"""
        You are a Senior Tech Lead assigning a practice project to a junior developer.
        
        **Developer Profile:**
        - Role: {user_domain}
        - Current Skills: {user_skills}

        **Your Task:**
        Generate a unique, practical, and impressive "Mini-Project" idea that uses their specific skills.
        Do NOT suggest generic To-Do lists or Calculators. Suggest something that solves a real problem or looks good on a resume.

        **Output Format:**
        Return ONLY a valid JSON object with this structure:
        {{
            "title": "Project Name (e.g., Sentiment Analysis Dashboard)",
            "difficulty": "Beginner/Intermediate/Advanced",
            "description": "A 2-sentence summary of what the app does.",
            "tech_stack": ["Python", "Flask", "NLTK"],
            "steps": [
                "Step 1: Scrape data from...",
                "Step 2: Clean the data using...",
                "Step 3: Build the API..."
            ],
            "bonus_challenge": "Deploy to Render or add User Auth."
        }}
        """

        print(f"⏳ Generating project for {user_domain}...")
        response = gemini_model.generate_content(prompt)
        cleaned_text = re.sub(r'```(json)?|```', '', response.text).strip()
        project_data = json.loads(cleaned_text)

        # 3. Save to DB
        cur.execute(
            "INSERT INTO generated_projects (user_id, domain, project_data) VALUES (%s, %s, %s)",
            (user_id, user_domain, json.dumps(project_data))
        )
        conn.commit()
        
        # Return the new project AND the list of old ones (for the UI)
        return get_user_projects_internal(user_id, cur)

    except Exception as e:
        print(f"❌ Error generating project: {e}")
        return jsonify({"error": "Failed to generate project."}), 500
    finally:
        cur.close()
        conn.close()

@projects_bp.route('/get-projects', methods=['GET'])
def get_projects():
    token = request.cookies.get("token")
    if not token: return jsonify({"error": "Authentication required."}), 401
    
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except:
        return jsonify({"error": "Invalid session."}), 401

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    try:
        return get_user_projects_internal(user_id, cur)
    finally:
        cur.close()
        conn.close()

def get_user_projects_internal(user_id, cur):
    """Helper to fetch projects"""
    cur.execute("SELECT id, domain, project_data, created_at FROM generated_projects WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    rows = cur.fetchall()
    
    projects = []
    for row in rows:
        p_data = json.loads(row['project_data'])
        p_data['id'] = row['id'] # Add DB ID to object
        p_data['date'] = row['created_at'].strftime('%d %b %Y')
        projects.append(p_data)
        
    return jsonify(projects), 200

