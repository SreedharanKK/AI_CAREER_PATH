import json
import string
import random
import jwt
from flask import Blueprint, request, jsonify
from db_config import get_db_connection
from config import SECRET_KEY

certificates_bp = Blueprint('certificates', __name__)

def get_user_id(token):
    """Helper to decode JWT and return user_id."""
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return data["user_id"]
    except Exception as e:
        print(f"JWT Decode Error: {e}")
        return None

def generate_random_id(length=8):
    """Generates a random 8-character string of uppercase letters and numbers."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@certificates_bp.route('/certificates/claim/<int:roadmap_id>', methods=['POST'])
def claim_certificate(roadmap_id):
    """
    Verifies completion using the Absolute Check method and issues 
    a unique 8-character certificate ID.
    """
    token = request.cookies.get("token")
    user_id = get_user_id(token)
    
    if not user_id:
        return jsonify({"error": "Unauthorized access"}), 401

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # --- STEP 1: Absolute Completion Check ---
        # Fetch the roadmap definition to calculate the absolute total number of steps
        cur.execute("SELECT domain, roadmap FROM roadmaps WHERE id = %s", (roadmap_id,))
        roadmap_record = cur.fetchone()

        if not roadmap_record or not roadmap_record['roadmap']:
            return jsonify({"error": "Roadmap definition not found"}), 404

        domain_name = roadmap_record['domain']
        roadmap_json = json.loads(roadmap_record['roadmap'])
        
        # Calculate how many steps the roadmap ACTUALLY has
        absolute_total_steps = 0
        if 'roadmap' in roadmap_json and isinstance(roadmap_json['roadmap'], list):
            for stage in roadmap_json['roadmap']:
                absolute_total_steps += len(stage.get('steps', []))

        if absolute_total_steps == 0:
            return jsonify({"error": "Roadmap contains no steps to complete"}), 400

        # Now, check how many steps the user has successfully finished in the progress table
        cur.execute("""
            SELECT COUNT(*) as completed_count 
            FROM user_roadmap_progress 
            WHERE user_id = %s AND roadmap_id = %s AND is_completed = TRUE
        """, (user_id, roadmap_id))
        user_progress = cur.fetchone()
        completed_steps = user_progress['completed_count'] if user_progress else 0

        # Logic Gate: Do they match?
        if completed_steps < absolute_total_steps:
            return jsonify({
                "error": "Roadmap is not fully completed",
                "progress_details": {
                    "completed": completed_steps,
                    "required": absolute_total_steps,
                    "percentage": round((completed_steps / absolute_total_steps) * 100, 2)
                }
            }), 400

        # --- STEP 2: Duplicate Prevention ---
        cur.execute("""
            SELECT certificate_hash FROM certificates 
            WHERE user_id = %s AND roadmap_id = %s
        """, (user_id, roadmap_id))
        existing = cur.fetchone()
        if existing:
            return jsonify({
                "message": "Certificate already exists", 
                "hash": existing['certificate_hash']
            }), 200

        # --- STEP 3: Generate Unique ID ---
        unique_hash = ""
        while True:
            unique_hash = generate_random_id(8)
            cur.execute("SELECT id FROM certificates WHERE certificate_hash = %s", (unique_hash,))
            if not cur.fetchone():
                break

        # --- STEP 4: Issue Certificate ---
        cur.execute("""
            INSERT INTO certificates (user_id, roadmap_id, domain_name, certificate_hash) 
            VALUES (%s, %s, %s, %s)
        """, (user_id, roadmap_id, domain_name, unique_hash))
        
        conn.commit()

        return jsonify({
            "message": "Success! Certificate generated.", 
            "hash": unique_hash,
            "domain": domain_name
        }), 201

    except Exception as e:
        print(f"Error in claim_certificate: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        cur.close()
        conn.close()

@certificates_bp.route('/certificates/my', methods=['GET'])
def get_user_certificates():
    """Retrieves all certificates earned by the logged-in user."""
    token = request.cookies.get("token")
    user_id = get_user_id(token)
    
    if not user_id:
        return jsonify({"error": "Unauthorized access"}), 401

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        cur.execute("""
            SELECT id, domain_name, certificate_hash, issued_at 
            FROM certificates 
            WHERE user_id = %s 
            ORDER BY issued_at DESC
        """, (user_id,))
        certs = cur.fetchall()
        
        for cert in certs:
            if cert['issued_at']:
                cert['issued_at'] = cert['issued_at'].strftime('%Y-%m-%d %H:%M:%S')
                
        return jsonify(certs), 200
    except Exception as e:
        print(f"Error in get_user_certificates: {e}")
        return jsonify({"error": "Could not fetch certificates"}), 500
    finally:
        cur.close()
        conn.close()