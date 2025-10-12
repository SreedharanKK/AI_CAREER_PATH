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


# --- Fetches the user's complete details for the profile view ---
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
    cursor = conn.cursor(dictionary=True)

    # 🔹 Step 1: Get basic user info
    cursor.execute("SELECT full_name, email FROM users_auth WHERE id = %s", (user_id,))
    user_auth = cursor.fetchone()

    if not user_auth:
        cursor.close()
        conn.close()
        return jsonify({"error": "User not found"}), 404

    # 🔹 Step 2: Get extra user details if available
    cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
    user_extra = cursor.fetchone()

    cursor.close()
    conn.close()

    # 🔹 Step 3: Merge both tables
    data = {
        "fullName": user_auth["full_name"],
        "email": user_auth["email"],
        "dob": user_extra["dob"] if user_extra else "",
        "place": user_extra["place"] if user_extra else "",
        "degree": user_extra["degree"] if user_extra else "",
        "stream": user_extra["stream"] if user_extra else "",
        "skills": json.loads(user_extra["skills"]) if user_extra and user_extra["skills"] else [],
        "domain": json.loads(user_extra["domain"]) if user_extra and user_extra["domain"] else [],
        "college": user_extra["college"] if user_extra else "",
        "year": user_extra["year"] if user_extra else "",
        "resume": user_extra["resume_path"] if user_extra else "",
    }

    return jsonify(data), 200
