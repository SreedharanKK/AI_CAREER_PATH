from flask import Blueprint, request, jsonify
import jwt
import json
import re
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model

roadmap_bp = Blueprint('roadmap', __name__)

# --- NEW: Helper function to calculate completion percentage ---
def _get_roadmap_completion(user_id, roadmap_id, roadmap_data, cur):
    """Calculates the completion percentage for a given roadmap."""
    total_steps = 0
    if not isinstance(roadmap_data, dict) or 'roadmap' not in roadmap_data:
        return 0 # Invalid roadmap structure
    
    for stage in roadmap_data.get('roadmap', []):
        total_steps += len(stage.get('steps', []))

    if total_steps == 0:
        return 0 # No steps in the roadmap

    try:
        cur.execute(
            "SELECT COUNT(*) as completed_count FROM user_roadmap_progress WHERE user_id = %s AND roadmap_id = %s AND is_completed = 1",
            (user_id, roadmap_id)
        )
        result = cur.fetchone()
        completed_steps = result['completed_count'] if result else 0
        
        return round((completed_steps / total_steps) * 100)
    except Exception as e:
        print(f"Error calculating completion: {e}")
        return 0

# --- Helper function to apply progress to a roadmap (Unchanged) ---
def _apply_progress_to_roadmap(user_id, roadmap_id, roadmap_data, cur, conn): 
    """
    Fetches user's progress for a given roadmap and merges it into the roadmap structure.
    Also ensures the first step of the first stage is always unlocked if no progress exists.
    """
    
    # Check if the roadmap_data has a 'roadmap' key and is a list
    if not isinstance(roadmap_data, dict) or 'roadmap' not in roadmap_data or not isinstance(roadmap_data['roadmap'], list):
        print("Warning: Invalid roadmap_data structure provided to _apply_progress_to_roadmap.")
        return {'roadmap': []} # Return empty if structure is bad

    all_progress = {}
    cur.execute(
        "SELECT stage_index, step_index, is_unlocked, is_completed, test_score FROM user_roadmap_progress WHERE user_id = %s AND roadmap_id = %s",
        (user_id, roadmap_id)
    )
    for p in cur.fetchall():
        key = f"{p['stage_index']}-{p['step_index']}"
        all_progress[key] = p

    # Deep copy the roadmap data to avoid modifying the original
    roadmap_with_progress = json.loads(json.dumps(roadmap_data)) # Efficient deep copy

    is_first_step_in_overall_roadmap = True
    overall_progress_exists = False # Flag to check if any progress exists for this roadmap at all

    for stage_idx, stage in enumerate(roadmap_with_progress['roadmap']):
        for step_idx, step in enumerate(stage['steps']):
            key = f"{stage_idx}-{step_idx}"
            progress = all_progress.get(key)

            if progress:
                step['is_unlocked'] = bool(progress['is_unlocked'])
                step['is_completed'] = bool(progress['is_completed'])
                step['test_score'] = progress['test_score']
                overall_progress_exists = True # At least one progress entry was found
            else:
                step['is_unlocked'] = False
                step['is_completed'] = False
                step['test_score'] = None
            
            if is_first_step_in_overall_roadmap and not overall_progress_exists:
                step['is_unlocked'] = True
                try:
                    cur.execute(
                        "INSERT INTO user_roadmap_progress (user_id, roadmap_id, stage_index, step_index, is_unlocked) VALUES (%s, %s, %s, %s, %s)",
                        (user_id, roadmap_id, stage_idx, step_idx, True)
                    )
                    conn.commit()
                except Exception as e:
                    if "Duplicate entry" not in str(e): 
                        print(f"Warning: Could not insert initial unlocked status for step {key}: {e}")
                    conn.rollback() # Rollback on error if it's not a duplicate
            
            is_first_step_in_overall_roadmap = False
    
    return {
        "id": roadmap_id,
        "roadmap": roadmap_with_progress['roadmap']
    }


# --- MODIFIED: /generate-roadmap ---
@roadmap_bp.route('/generate-roadmap', methods=['POST'])
def generate_roadmap():
    """
    Generates a new roadmap if one doesn't exist, or refreshes an existing one.
    Enforces a limit of 2 total roadmaps per user.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    domain = req_data.get('domain')
    if not domain:
        return jsonify({"error": "A domain is required to generate a roadmap."}), 400

    if not gemini_model:
        return jsonify({"error": "AI Model is not available."}), 503

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True) # Use dictionary cursor
    try:
        # --- Check if a roadmap already exists for this user and domain ---
        cur.execute(
            "SELECT id, roadmap FROM roadmaps WHERE user_id = %s AND domain = %s",
            (user_id, domain)
        )
        existing_roadmap_record = cur.fetchone()

        if existing_roadmap_record:
            roadmap_id = existing_roadmap_record['id']
            existing_roadmap_data = json.loads(existing_roadmap_record['roadmap'])
            # If exists, apply current progress and return
            return jsonify(_apply_progress_to_roadmap(user_id, roadmap_id, existing_roadmap_data, cur, conn)), 200

        # --- If it doesn't exist, check if user is at their 2-roadmap limit ---
        cur.execute("SELECT COUNT(*) as count FROM roadmaps WHERE user_id = %s", (user_id,))
        roadmap_count = cur.fetchone()['count']
        
        if roadmap_count >= 2:
            return jsonify({"error": "You can only have 2 active roadmaps at a time. Please delete one to add another."}), 403 # 403 Forbidden

        # --- AI Prompt Engineering (Unchanged) ---
        prompt = f"""
        You are a senior technical curriculum designer who creates world-class learning roadmaps similar to those found on roadmap.sh.
        Your task is to generate a detailed, step-by-step learning roadmap for an aspiring '{domain}'.

        RULES FOR THE ROADMAP:
        1.  **Structure:** The roadmap must be broken down into logical stages (e.g., "Foundations", "Core Concepts", "Advanced Topics", "Specializations").
        2.  **Content:** Each stage must contain a list of specific, actionable learning steps.
        3.  **Study Links:** For EVERY step, you MUST provide a high-quality, real, and publicly accessible "study_link". These links should point to official documentation, renowned educational YouTube channels (like freeCodeCamp, Traversy Media), MDN Web Docs, or top-tier technical blogs. Do NOT use placeholder links.
        4.  **JSON Format:** Your response MUST be a valid JSON object. The root object should have one key: "roadmap". The value of "roadmap" is a list of stage objects.

        Each step object within a stage MUST have four keys:
        - "title": The name of the skill or concept.
        - "description": A brief, one-sentence explanation of why this step is important.
        - "resource_type": (e.g., "Documentation", "Video Tutorial", "Interactive Course", "Project Idea", "Book").
        - "study_link": A valid, direct URL to a learning resource for the step.

        Here is the required JSON structure and a perfect example:
        {{
          "roadmap": [
            {{
              "stage_title": "Stage 1: The Foundations",
              "steps": [
                {{
                  "title": "Learn HTML Basics",
                  "description": "Understand the fundamental structure of all web pages.",
                  "resource_type": "Documentation",
                  "study_link": "https://developer.mozilla.org/en-US/docs/Web/HTML"
                }}
              ]
            }}
          ]
        }}
        """

        # --- Call the AI and process the response (Unchanged) ---
        response = gemini_model.generate_content(prompt)
        cleaned_response_text = re.sub(r'```(json)?|```', '', response.text).strip()
        roadmap_data = json.loads(cleaned_response_text)

        # --- Save the newly generated roadmap to the database (Unchanged) ---
        cur.execute(
            "INSERT INTO roadmaps (user_id, domain, roadmap) VALUES (%s, %s, %s)",
            (user_id, domain, json.dumps(roadmap_data))
        )
        conn.commit()
        
        roadmap_id = cur.lastrowid # Get the ID of the new roadmap

        # Apply initial progress (unlock first step) and return
        return jsonify(_apply_progress_to_roadmap(user_id, roadmap_id, roadmap_data, cur, conn)), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error in generate_roadmap: {e}")
        # Check for unique constraint violation (from our new SQL rule)
        if "Duplicate entry" in str(e):
             return jsonify({"error": f"A roadmap for {domain} already exists."}), 409 # 409 Conflict
        return jsonify({"error": "Failed to generate roadmap due to an internal error."}), 500
    finally:
        cur.close()
        conn.close()


# --- Endpoint /get-user-roadmap (Unchanged) ---
@roadmap_bp.route('/get-user-roadmap', methods=['GET'])
def get_user_roadmap():
    """
    Fetches a user's saved roadmap for a *specific domain* and merges it with their progress.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    domain = request.args.get('domain')
    if not domain:
        return jsonify({"error": "Domain parameter is required to fetch a roadmap."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed."}), 500
    
    cur = conn.cursor(dictionary=True) # Use dictionary cursor
    try:
        cur.execute(
            "SELECT id, roadmap FROM roadmaps WHERE user_id = %s AND domain = %s",
            (user_id, domain)
        )
        roadmap_record = cur.fetchone()

        if not roadmap_record:
            return jsonify({"roadmap": None}), 200 # No roadmap found

        roadmap_id = roadmap_record['id']
        roadmap_data = json.loads(roadmap_record['roadmap'])

        return jsonify(_apply_progress_to_roadmap(user_id, roadmap_id, roadmap_data, cur, conn)), 200

    except Exception as e:
        print(f"❌ Error fetching user roadmap: {e}")
        return jsonify({"error": "An error occurred while fetching your roadmap."}), 500
    finally:
        cur.close()
        conn.close()


# --- NEW: Endpoint to get all active roadmaps with completion % ---
@roadmap_bp.route('/get-all-active-roadmaps', methods=['GET'])
def get_all_active_roadmaps():
    """
    Fetches all roadmaps for the user, along with their completion percentage.
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
            "SELECT id, domain, roadmap FROM roadmaps WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        all_roadmaps = cur.fetchall()
        
        roadmap_summaries = []
        for r in all_roadmaps:
            # Need to load the JSON to count total steps
            roadmap_data = json.loads(r['roadmap']) 
            completion_percentage = _get_roadmap_completion(user_id, r['id'], roadmap_data, cur)
            
            roadmap_summaries.append({
                "id": r['id'],
                "domain": r['domain'],
                "completion_percentage": completion_percentage
            })

        return jsonify(roadmap_summaries), 200

    except Exception as e:
        print(f"❌ Error fetching all active roadmaps: {e}")
        return jsonify({"error": "An error occurred while fetching your roadmaps."}), 500
    finally:
        cur.close()
        conn.close()