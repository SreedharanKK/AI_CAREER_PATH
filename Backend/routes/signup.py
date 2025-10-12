from flask import Blueprint, request, jsonify
from db_config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash

signup_bp = Blueprint("signup", __name__)

# Signup Route
@signup_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not full_name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        # Check if email already exists
        cursor.execute("SELECT * FROM users_auth WHERE email = %s", (email,))
        existing = cursor.fetchone()
        if existing:
            return jsonify({"error": "Email already registered"}), 400

        # Hash password before saving
        hashed_password = generate_password_hash(password)

        # Insert new user
        cursor.execute(
            "INSERT INTO users_auth (full_name, email, password) VALUES (%s, %s, %s)",
            (full_name, email, hashed_password)
        )
        conn.commit()

        return jsonify({"message": "User registered successfully"}), 201

    except Exception as e:
        print("❌ Error in signup:", e)
        return jsonify({"error": "Server error"}), 500

    finally:
        cursor.close()
        conn.close()
