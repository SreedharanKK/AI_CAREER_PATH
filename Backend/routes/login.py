from flask import Blueprint, request, jsonify, make_response
from db_config import get_db_connection
from werkzeug.security import check_password_hash
import random, datetime, subprocess, json, jwt, threading
from config import SECRET_KEY
from utils.skill_extractor import trigger_skill_extraction


login_bp = Blueprint("login", __name__)
    
# Step 1: Login and send OTP
@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT * FROM users_auth WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        # Generate 4-digit OTP
        otp = str(random.randint(1000, 9999))
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=5)

        cursor.execute(
            "UPDATE users_auth SET otp = %s, otp_expiry = %s WHERE email = %s",
            (otp, expiry, email)
        )
        conn.commit()

        # ✅ Call Node.js mailer script using JSON stdin
        try:
            subprocess.Popen(
                ["node", "mailer.js"],
                stdin=subprocess.PIPE,
                text=True,
            ).communicate(json.dumps({"email":email, "otp":otp}))
        except Exception as e:
            print("❌ Error calling mailer:", e)

        return jsonify({"message": "OTP sent to your email"}), 200

    except Exception as e:
        print("❌ Login error:", e)
        return jsonify({"error": "Server error"}), 500

    finally:
        cursor.close()
        conn.close()


# Step 2: Verify OTP
@login_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    email = data.get("email")
    otp_entered = data.get("otp", "").strip()  # ✅ trim whitespace

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id, full_name, otp, otp_expiry FROM users_auth WHERE email = %s", (email,))
        record = cursor.fetchone()

        if not record or (record["otp"] or "").strip() != otp_entered:  # ✅ safe strip
            return jsonify({"error": "Wrong OTP"}), 400

        if datetime.datetime.now() > record["otp_expiry"]:
            return jsonify({"error": "OTP expired"}), 400

        # ✅ Clear OTP after success
        cursor.execute("UPDATE users_auth SET otp = NULL, otp_expiry = NULL WHERE email = %s", (email,))
        conn.commit()

        # --- 2. THE FIX: RUN SKILL EXTRACTION IN A BACKGROUND THREAD ---
        # This creates a new thread to run our slow function.
        # The 'args' tuple passes the user_id to the function.
        extraction_thread = threading.Thread(
            target=trigger_skill_extraction, 
            args=(record["id"],)
        )
        # This starts the thread. The code below will NOT wait for it to finish.
        extraction_thread.start()

        # ✅ Generate JWT
        token = jwt.encode(
            {"user_id": record["id"], "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)},
            SECRET_KEY,
            algorithm="HS256"
        )

        # ✅ Send token in HttpOnly cookie
        resp = make_response({"message": "OTP verified, login success"})
        resp.set_cookie("token", token, httponly=True, max_age=7200, path="/")

        return resp

    except Exception as e:
        print("❌ OTP verify error:", e)
        return jsonify({"error": "Server error"}), 500

    finally:
        cursor.close()
        conn.close()

# Add at the end of login.py
@login_bp.route("/logout", methods=["POST"])
def logout():
    resp = make_response(jsonify({"message": "Successfully logged out"}))
    # Setting the cookie with an expired date and max_age=0 effectively deletes it
    resp.set_cookie("token", "", expires=0, max_age=0, httponly=True, path="/")
    return resp, 200