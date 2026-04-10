from flask import Blueprint, request, jsonify, make_response
from db_config import get_db_connection
from werkzeug.security import check_password_hash
import datetime, json, jwt, threading, sys, os, random, subprocess
from config import SECRET_KEY
from werkzeug.security import generate_password_hash
# No longer need skill_extractor, random, or subprocess

try:
    # Assuming news_feed.py is in the same 'routes' folder or accessible
    from .news_feed import clear_news_cache
except ImportError as e:
    print(f"⚠️ WARNING: Could not import clear_news_cache: {e}. Cache won't be cleared on logout.")
    clear_news_cache = None

login_bp = Blueprint("login", __name__)

def send_email_node(data):
    """
    Executes the node mailer script in a separate thread.
    Expects data to be a dict like {"email": "...", "type": "...", "otp": "..."}
    """
    try:
        process = subprocess.Popen(
            ["node", "mailer.js"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        stdout, stderr = process.communicate(json.dumps(data))
        
        if process.returncode == 0:
            # Check if stdout has content before printing
            if stdout and stdout.strip():
                print(f"✅ Mailer output: {stdout.strip()}")
        else:
            print(f"❌ Mailer error: {stderr.strip()}")
            
    except Exception as e:
        print(f"❌ Mailer thread exception: {e}")
    
# --- MODIFIED: Login Route ---
@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. Fetch user including is_admin status
        cursor.execute("SELECT id, password, full_name, is_admin, is_verified FROM users_auth WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401
        
        if not user.get('is_verified', False):
            return jsonify({"error": "Account not verified. Please check your email for the verification OTP."}), 403

        # 2. Encode JWT with user_id AND is_admin
        token = jwt.encode(
            {
                "user_id": user["id"], 
                "is_admin": user["is_admin"], # Added for permission checking
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
            },
            SECRET_KEY,
            algorithm="HS256"
        )

        # 3. Include is_admin in the JSON response for immediate frontend state updates
        resp = make_response(jsonify({
            "message": "Login success",
            "is_admin": user["is_admin"],
            "fullName": user["full_name"]
        }))
        
        resp.set_cookie("token", token, httponly=True, max_age=7200, path="/", samesite='Lax')
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


# --- ADD THESE ROUTES TO routes/login.py ---

@login_bp.route("/forgot-password-send-otp", methods=["POST"])
def forgot_password_send_otp():
    data = request.get_json()
    email = data.get("email")
    if not email: return jsonify({"error": "Email is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users_auth WHERE email = %s", (email,))
        if not cursor.fetchone(): return jsonify({"error": "Email not found."}), 404

        otp = str(random.randint(1000, 9999))
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=10)
        cursor.execute("UPDATE users_auth SET otp = %s, otp_expiry = %s WHERE email = %s", (otp, expiry, email))
        conn.commit()

        # Helper to send email (ensure send_email_node helper is defined at top of file)
        threading.Thread(target=send_email_node, args=({"email": email, "otp": otp, "type": "reset_otp"},)).start()
        return jsonify({"message": "OTP sent."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@login_bp.route("/forgot-password-verify-otp", methods=["POST"])
def forgot_password_verify_otp():
    data = request.get_json()
    email = data.get("email")
    otp_entered = data.get("otp", "").strip()
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT otp, otp_expiry FROM users_auth WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user or (user["otp"] or "").strip() != otp_entered: return jsonify({"error": "Invalid OTP"}), 400
        if datetime.datetime.now() > user["otp_expiry"]: return jsonify({"error": "OTP Expired"}), 400
        return jsonify({"message": "Verified"}), 200
    finally:
        cursor.close()
        conn.close()

@login_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    email = data.get("email")
    new_password = data.get("new_password")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        hashed_pw = generate_password_hash(new_password)
        cursor.execute("UPDATE users_auth SET password = %s, otp = NULL WHERE email = %s", (hashed_pw, email))
        conn.commit()
        # Optional: Send success email
        threading.Thread(target=send_email_node, args=({"email": email, "type": "reset_success"},)).start()
        return jsonify({"message": "Password reset success"}), 200
    finally:
        cursor.close()
        conn.close()