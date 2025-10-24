from flask import Blueprint, request, jsonify
from db_config import get_db_connection
from werkzeug.security import generate_password_hash
# --- Added imports ---
import threading
import subprocess
import json
#---------------------

signup_bp = Blueprint("signup", __name__)

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
    # Add email format validation if desired
    #-------------------------------

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    # Use dictionary=True only if needed, otherwise default cursor is fine
    cursor = conn.cursor(dictionary=True)

    try:
        # Check if email already exists
        cursor.execute("SELECT id FROM users_auth WHERE email = %s", (email,))
        # Use fetchall for robustness, like in login.py
        existing_results = cursor.fetchall()
        if existing_results:
            return jsonify({"error": "Email already registered"}), 400

        # Hash password before saving
        hashed_password = generate_password_hash(password)

        # Insert new user
        cursor.execute(
            "INSERT INTO users_auth (full_name, email, password) VALUES (%s, %s, %s)",
            (full_name, email, hashed_password)
        )
        conn.commit()

        # --- Added: Trigger Welcome Email ---
        # Start the email sending in a background thread
        mail_thread = threading.Thread(
            target=send_welcome_email,
            args=(email, full_name) # Pass name and email
        )
        mail_thread.start()
        #------------------------------------

        # Return success immediately, email sends in background
        return jsonify({"message": "User registered successfully"}), 201

    except Exception as e:
        conn.rollback() # Rollback DB changes on error
        print(f"❌ Error in signup: {e}")
        return jsonify({"error": "Server error during registration"}), 500

    finally:
        # Ensure cursor and connection are closed
        if cursor:
            cursor.close()
        if conn:
            conn.close()
