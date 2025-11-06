from flask import Blueprint, request, jsonify, make_response
from db_config import get_db_connection
from werkzeug.security import generate_password_hash
# --- Added imports ---
import threading
import subprocess, random, datetime
import json
from config import SECRET_KEY
#---------------------

signup_bp = Blueprint("signup", __name__)

def send_verification_email(email, otp):
    """Runs the Node.js mailer in a background thread for verification."""
    print(f"--- Starting verification email thread for {email} ---")
    try:
        # Note: We send 'otp' here, not 'fullName'.
        # mailer.js will see 'otp' and send the OTP email template.
        payload = json.dumps({"email": email, "otp": otp})
        process = subprocess.Popen(
            ["node", "mailer.js"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        stdout, stderr = process.communicate(payload)
        if process.returncode == 0:
            print(f"✅ Verification mailer success for {email}: {stdout.strip()}")
        else:
            print(f"❌ Verification mailer error for {email}: {stderr.strip()}")
    except Exception as e:
        print(f"❌ Verification mailer thread exception: {e}")

# --- Added Helper Function (similar to login.py) ---
def send_welcome_email(email, full_name):
    """Runs the Node.js mailer in a background thread for welcome emails."""
    print(f"--- Starting welcome email thread for {email} ---")
    try:
        process = subprocess.Popen(
            ["node", "mailer.js"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8' # Ensure consistent encoding
        )
        # Pass fullName instead of otp
        payload = json.dumps({"email": email, "fullName": full_name})
        stdout, stderr = process.communicate(payload)

        if process.returncode == 0:
            if stdout and stdout.strip():
                print(f"✅ Welcome mailer success for {email}: {stdout.strip()}")
            else:
                print(f"✅ Welcome mailer completed for {email}.")
        else:
            if stderr and stderr.strip():
                print(f"❌ Welcome mailer error for {email}: {stderr.strip()}")
            else:
                print(f"❌ Welcome mailer failed for {email} (Code: {process.returncode}).")

    except FileNotFoundError:
        print(f"❌ Welcome mailer error: 'node' command not found.")
    except Exception as e:
        print(f"❌ Welcome mailer thread exception: {e}")
#----------------------------------------------------

# Signup Route
@signup_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not full_name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    # --- Added: Basic validation ---
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400
    #-------------------------------

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id, is_verified FROM users_auth WHERE email = %s", (email,))
        existing_user = cursor.fetchone()
        if existing_user and existing_user['is_verified']:
            return jsonify({"error": "Email already registered and verified."}), 400
        
        hashed_password = generate_password_hash(password)
        otp = str(random.randint(1000, 9999))
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=10) # 10 min expiry

        if existing_user:
            # User exists but is not verified, update their record
            cursor.execute(
                """
                UPDATE users_auth 
                SET full_name = %s, password = %s, otp = %s, otp_expiry = %s, is_verified = FALSE
                WHERE id = %s
                """,
                (full_name, hashed_password, otp, expiry, existing_user['id'])
            )
        else:
            # New user, insert them
            cursor.execute(
                """
                INSERT INTO users_auth (full_name, email, password, otp, otp_expiry, is_verified) 
                VALUES (%s, %s, %s, %s, %s, FALSE)
                """,
                (full_name, email, hashed_password, otp, expiry)
            )
        
        conn.commit()

        # Start the email sending in a background thread
        mail_thread = threading.Thread(
            target=send_verification_email,
            args=(email, otp) 
        )
        mail_thread.start()
        return jsonify({"message": "Signup successful. Please check your email to verify your account."}), 201

    except Exception as e:
        conn.rollback() # Rollback DB changes on error
        print(f"❌ Error in signup: {e}")
        return jsonify({"error": "Server error during registration"}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@signup_bp.route("/verify-account", methods=["POST"])
def verify_account():
    data = request.get_json()
    email = data.get("email")
    otp_entered = data.get("otp", "").strip()

    if not email or not otp_entered:
        return jsonify({"error": "Email and OTP are required."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, full_name, otp, otp_expiry, is_verified FROM users_auth WHERE email = %s", (email,))
        record = cursor.fetchone()

        if not record:
            return jsonify({"error": "Account not found."}), 404
        
        if record['is_verified']:
            return jsonify({"error": "Account already verified. Please log in."}), 400

        if (record["otp"] or "").strip() != otp_entered:
            return jsonify({"error": "Wrong OTP."}), 400

        if datetime.datetime.now() > record["otp_expiry"]:
            return jsonify({"error": "OTP expired. Please sign up again to get a new one."}), 400

        # --- Success! Verify the user ---
        cursor.execute(
            "UPDATE users_auth SET is_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE email = %s",
            (email,)
        )
        conn.commit()

        # Start sending the welcome email in a background thread
        mail_thread = threading.Thread(
            target=send_welcome_email,
            args=(email, record["full_name"])
        )
        mail_thread.start()

        return jsonify({"message": "Account verified successfully! You can now log in."}), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error in verify-account: {e}")
        return jsonify({"error": "Server error during verification"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()