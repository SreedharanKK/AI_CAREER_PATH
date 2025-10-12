import os
import json
import re
from db_config import get_db_connection
from api_config import gemini_model

def trigger_skill_extraction(user_id):
    """
    Connects to the DB, reads a user's resume, uses Gemini to extract skills,
    and saves them to the extract_skills table.
    """
    print(f"--- Starting skill extraction for user_id: {user_id} ---")
    
    conn = get_db_connection()
    if not conn:
        print(f"❌ DB connection failed for user_id: {user_id}. Aborting skill extraction.")
        return

    cur = conn.cursor(dictionary=True)
    try:
        # Step 1: Get the path to the user's extracted resume text
        cur.execute("SELECT extracted_path FROM user_details WHERE user_id = %s", (user_id,))
        user_details = cur.fetchone()

        if not user_details or not user_details['extracted_path']:
            print(f"✅ No resume found for user_id: {user_id}. Skipping extraction.")
            return

        # Step 2: Read the resume content from the file
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(base_dir, user_details['extracted_path'])

        if not os.path.exists(file_path):
            print(f"❌ Extracted resume file not found at {file_path} for user_id: {user_id}.")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            resume_content = f.read()
        
        if not resume_content.strip():
            print(f"✅ Resume for user_id: {user_id} is empty. Skipping extraction.")
            return

        # Step 3: Use Gemini API with the NEW, more intelligent prompt
        if not gemini_model:
            print("❌ Gemini Model not available. Aborting skill extraction.")
            return

        # --- UPDATED AND MORE SPECIFIC PROMPT ---
        # This new prompt tells the AI to be much more selective.
        prompt = f"""
        You are an expert technical recruiter analyzing a resume for an entry-level developer role.
        Your task is to identify and extract **only the core, hands-on programming languages and fundamental database/web technologies**.

        **Instructions:**
        1.  Scan the resume text provided below.
        2.  Identify the main programming languages (e.g., Java, Python).
        3.  Identify fundamental web technologies (e.g., HTML, CSS).
        4.  Identify core database technologies (e.g., MYSQL).
        5.  **You MUST IGNORE the following:**
            - Company or brand names (e.g., Salesforce, L&T).
            - Software tools or IDEs (e.g., VSCode, Eclipse, GitHub).
            - Specific, niche frameworks unless they are fundamental (e.g., ignore LWC).
            - Broad concepts (e.g., IoT, NLP, APIs).
        6.  Return the final, focused list of skills as a single, comma-separated string.
        7.  Do not include any introductory text or explanations.

        **Example output based on the user's core skills:** Java, Python, MYSQL, HTML, CSS

        **Resume Text to Analyze:**
        ---
        {resume_content}
        ---
        """
        
        response = gemini_model.generate_content(prompt)
        skills_text = re.sub(r'```(json|python)?|```', '', response.text).strip()
        # Added an extra filter to remove any single-letter skills that might sneak in
        skills_list = [skill.strip() for skill in skills_text.split(',') if skill.strip() and len(skill.strip()) > 1]


        if not skills_list:
            print(f"✅ AI found no specific skills for user_id: {user_id}.")
            return

        # Step 4: Store the extracted skills in the database
        cur.execute("DELETE FROM extract_skills WHERE user_id = %s", (user_id,))
        cur.execute(
            "INSERT INTO extract_skills (user_id, skills) VALUES (%s, %s)",
            (user_id, json.dumps(skills_list))
        )
        conn.commit()
        print(f"✅ Successfully extracted and stored {len(skills_list)} skills for user_id: {user_id}.")

    except Exception as e:
        conn.rollback()
        print(f"❌ An error occurred during skill extraction for user_id {user_id}: {e}")
    finally:
        cur.close()
        conn.close()

