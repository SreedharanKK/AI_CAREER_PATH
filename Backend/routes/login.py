from flask import Blueprint, request, jsonify, make_response
from db_config import get_db_connection
from werkzeug.security import check_password_hash
import datetime, json, jwt, threading, sys, os
from config import SECRET_KEY
# No longer need skill_extractor, random, or subprocess

try:
    # Assuming news_feed.py is in the same 'routes' folder or accessible
    from .news_feed import clear_news_cache
except ImportError as e:
    print(f"⚠️ WARNING: Could not import clear_news_cache: {e}. Cache won't be cleared on logout.")
    clear_news_cache = None

login_bp = Blueprint("login", __name__)
    
# --- MODIFIED: Login Route ---
@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    print(f"🔍 Login attempt for: {email}") # Debug print
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT * FROM users_auth WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401
        
        if not user.get('is_verified', False):
            # This handles users who signed up but never verified
            return jsonify({"error": "Account not verified. Please check your email for the verification OTP."}), 403 # 403 Forbidden

        token = jwt.encode(
            {"user_id": user["id"], "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)},
            SECRET_KEY,
            algorithm="HS256"
        )

        # 4. Send token in HttpOnly cookie
        resp = make_response(jsonify({"message": "Login success"}))
        resp.set_cookie("token", token, httponly=True, max_age=7200, path="/")
        return resp

    except Exception as e:
        print("❌ Login error:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        cursor.close()
        conn.close()

# --- Logout route (unchanged) ---
@login_bp.route("/logout", methods=["POST"])
def logout():
    user_id = None
    token = request.cookies.get("token")
    if token:
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False}) # Allow expired tokens for logout
            user_id = data.get("user_id")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            print("Token invalid/expired during logout, cannot clear specific user cache.")
            pass # Proceed with logout anyway

    if user_id and clear_news_cache:
        clear_news_cache(user_id) # Call the imported function
    elif user_id:
        print("Logout: clear_news_cache function not available.")

    # Clear cookie
    resp = make_response(jsonify({"message": "Successfully logged out"}))
    resp.set_cookie("token", "", expires=0, max_age=0, httponly=True, path="/", samesite='Lax')
    return resp, 200