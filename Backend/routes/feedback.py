# routes/feedback.py
from flask import Blueprint, request, jsonify
import jwt
from db_config import get_db_connection
from config import SECRET_KEY
import traceback
from datetime import datetime

feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/submit', methods=['POST'])
def submit_feedback():
    """Receives and stores user feedback on AI-generated content."""
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    req_data = request.get_json()
    feedback_type = req_data.get('type') # e.g., 'roadmap', 'recommendation', 'quiz'
    item_id = req_data.get('itemId')     # e.g., roadmap_id, quiz_history_id
    rating = req_data.get('rating')     # e.g., 1, 2, 3, 4, 5
    comment = req_data.get('comment', None) # Optional comment

    # --- Basic Validation ---
    if not feedback_type or not item_id or rating is None:
        return jsonify({"error": "Missing required feedback data (type, itemId, rating)."}), 400

    if not isinstance(rating, int) or not (1 <= rating <= 5):
         return jsonify({"error": "Rating must be an integer between 1 and 5."}), 400

    # Optional: Validate feedback_type against allowed types
    allowed_types = ['roadmap', 'recommendation', 'quiz', 'skill_analysis', 'practice_question', 'job_query']
    if feedback_type not in allowed_types:
        return jsonify({"error": f"Invalid feedback type. Allowed types: {', '.join(allowed_types)}"}), 400

    # --- Store in Database ---
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed."}), 500

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ai_feedback (user_id, feedback_type, item_id, rating, comment, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, feedback_type, str(item_id), rating, comment, datetime.now())) # Ensure item_id is stored correctly (might need str())

        conn.commit()
        print(f"✅ Feedback stored: User {user_id}, Type: {feedback_type}, Item: {item_id}, Rating: {rating}")
        return jsonify({"success": True, "message": "Feedback submitted successfully!"}), 201

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error storing feedback: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred while saving feedback."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()