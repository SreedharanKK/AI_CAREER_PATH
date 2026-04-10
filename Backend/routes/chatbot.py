from flask import Blueprint, request, jsonify
import jwt
import json
from db_config import get_db_connection
from config import SECRET_KEY
from api_config import gemini_model
import traceback

chatbot_bp = Blueprint('chatbot', __name__)

@chatbot_bp.route('/chat', methods=['POST'])
def chat_with_ai():
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except:
        return jsonify({"error": "Invalid session."}), 401

    req_data = request.get_json()
    user_message = req_data.get('message')
    history = req_data.get('history', []) # List of previous messages

    if not user_message:
        return jsonify({"error": "Message is empty."}), 400

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # 1. Fetch User Context (Make the bot smart)
        cur.execute("SELECT full_name FROM users_auth WHERE id = %s", (user_id,))
        user_auth = cur.fetchone()
        user_name = user_auth['full_name'] if user_auth else "Student"

        cur.execute("SELECT domain, skills FROM user_details WHERE id = %s", (user_id,))
        user_details = cur.fetchone()
        
        user_domain = "Tech"
        user_skills = "General"

        if user_details:
             # Try to parse domain
            try:
                d_json = json.loads(user_details['domain'])
                user_domain = ", ".join(d_json) if isinstance(d_json, list) else user_details['domain']
            except: user_domain = user_details.get('domain', "Tech")
            
            # Try to parse skills
            try:
                s_json = json.loads(user_details['skills'])
                user_skills = ", ".join(s_json) if isinstance(s_json, list) else user_details['skills']
            except: user_skills = user_details.get('skills', "General")

        # 2. Construct the Prompt with History
        # We format the history into a string the AI can read
        history_text = ""
        for msg in history[-6:]: # Keep last 6 messages for context to save tokens
            role = "User" if msg['sender'] == 'user' else "Mentor"
            history_text += f"{role}: {msg['text']}\n"

        system_prompt = f"""
        You are an expert AI Career Mentor for a student named {user_name}.
        
        **User Profile:**
        - Target Domain: {user_domain}
        - Current Skills: {user_skills}
        
        **Your Goal:**
        Help them with technical doubts, career advice, or explaining complex concepts in their domain.
        Be encouraging, concise, and practical. If they ask for code, provide it.
        
        **Conversation History:**
        {history_text}
        
        **Current User Question:**
        {user_message}
        
        **Reply:**
        """

        # 3. Call AI
        response = gemini_model.generate_content(system_prompt)
        ai_reply = response.text.strip()
        
        return jsonify({"reply": ai_reply}), 200

    except Exception as e:
        print(f"❌ Chatbot Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "I'm having trouble thinking right now. Try again."}), 500
    finally:
        cur.close()
        conn.close()