from flask import Blueprint, request, jsonify
from db_config import get_db_connection
import jwt
import json
from config import SECRET_KEY

# A single blueprint for all user profile and detail related routes
user_profile_bp = Blueprint("user_profile", __name__)

# --- Fetches the user's full name for the dashboard sidebar ---
@user_profile_bp.route("/profile", methods=["GET"])
def get_profile():
    token = request.cookies.get("token")

    if not token:
        return jsonify({"error": "Not logged in"}), 401

    try:
        # 🔑 Decode JWT
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]

        # 🔎 Fetch user from DB
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT full_name FROM users_auth WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"fullName": user["full_name"]})

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Session expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


# --- Fetches the user's complete details for the profile view (FIXED) ---
@user_profile_bp.route("/details", methods=["GET"])
def get_details():
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Not logged in"}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Session expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    cursor = conn.cursor(dictionary=True)

    try:
        # 🔹 Step 1: Get basic user info
        cursor.execute("SELECT full_name, email FROM users_auth WHERE id = %s", (user_id,))
        # ✅ FIX: Use fetchall() to fully consume the results
        user_auth_rows = cursor.fetchall()
        user_auth = user_auth_rows[0] if user_auth_rows else None

        if not user_auth:
            return jsonify({"error": "User not found"}), 404

        # 🔹 Step 2: Get extra user details if available
        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        # ✅ FIX: Use fetchall() again for the second query
        user_extra_rows = cursor.fetchall()
        user_extra = user_extra_rows[0] if user_extra_rows else None

        # 🔹 Step 3: Merge both tables
        data = {
            "fullName": user_auth.get("full_name"),
            "email": user_auth.get("email"),
            "dob": user_extra.get("dob") if user_extra else "",
            "place": user_extra.get("place") if user_extra else "",
            "degree": user_extra.get("degree") if user_extra else "",
            "stream": user_extra.get("stream") if user_extra else "",
            "skills": json.loads(user_extra["skills"]) if user_extra and user_extra.get("skills") else [],
            "domain": json.loads(user_extra["domain"]) if user_extra and user_extra.get("domain") else [],
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
