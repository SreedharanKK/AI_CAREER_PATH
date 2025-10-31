# link_validator.py
import requests
import json
from db_config import get_db_connection
from api_config import gemini_model # Import Gemini model
from datetime import datetime
import time
import os
import portalocker
import traceback
import re # Import regex

# --- Configuration ---
CHECK_TIMEOUT = 10
USER_AGENT = "AI Career Guider Link Checker/1.0"
LOG_FILE = "link_validation_log.txt"
LOCK_FILE = "link_validator.lock"
# --- NEW: AI Config ---
AI_REPLACEMENT_ENABLED = True # Set to False to disable AI replacement attempts
AI_RETRY_DELAY_SECONDS = 2 # Small delay between AI calls

# --- Helper Functions ---
def log_message(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    full_message = f"[{timestamp}] {message}\n"
    print(full_message.strip())
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(full_message)
    except Exception as e:
        print(f"    ERROR: Could not write to log file: {e}")

def check_url(url):
    """Checks URL validity. Returns (is_valid: bool, status_code_or_error: str)"""
    # ... (Keep existing check_url function - no changes needed) ...
    try:
        headers = {'User-Agent': USER_AGENT}
        response = requests.head(url, timeout=CHECK_TIMEOUT, headers=headers, allow_redirects=True)
        status = str(response.status_code) # Ensure status is string
        if 200 <= response.status_code < 400:
            return True, status
        else:
            log_message(f"    INVALID Status: {status} for URL: {url}")
            return False, status
    except requests.exceptions.Timeout:
        log_message(f"    TIMEOUT Error for URL: {url}")
        return False, "Timeout"
    except requests.exceptions.RequestException as e:
        # Try to get more specific error
        error_str = f"Request Error ({type(e).__name__})"
        log_message(f"    {error_str} for URL: {url} - {e}")
        return False, error_str
    except Exception as e:
        error_str = f"Other Error ({type(e).__name__})"
        log_message(f"    UNEXPECTED Error checking URL {url}: {e}")
        return False, error_str


# --- NEW: AI Link Replacement Function ---
def find_replacement_link(original_url, step_title, step_description, domain):
    """Uses Gemini AI to find a replacement for a broken study link."""
    if not gemini_model:
        log_message("    AI_REPLACE: Gemini model not available. Skipping replacement.")
        return None, None, None # Return None for url, prompt, response

    prompt = f"""
    You are an expert curriculum designer tasked with fixing a broken learning resource link.

    Context:
    - Target Career Path (Domain): {domain}
    - Learning Step Title: {step_title}
    - Learning Step Description: {step_description}
    - Broken URL: {original_url}

    Task:
    Find a SINGLE, high-quality, publicly accessible, and currently valid URL that serves as the best possible replacement for the broken link, matching the learning step's title and description for the target domain.

    Prioritize links from these sources if relevant:
    1. Official documentation (e.g., python.org, react.dev, developer.mozilla.org)
    2. Reputable educational platforms (e.g., freeCodeCamp.org, GeeksforGeeks, W3Schools, Khan Academy)
    3. Well-known technical blogs or tutorial sites (e.g., DigitalOcean, Real Python)

    Requirements:
    - The replacement URL must be directly accessible and relevant.
    - Do NOT suggest generic search engine results.
    - Do NOT suggest paid course platforms unless it's a specific, highly relevant free article/tutorial on them.
    - Verify the link seems active if possible (understand you can't browse live).

    Output Format:
    Return ONLY the valid replacement URL. Do not include any explanation, introductory text, markdown formatting, or surrounding quotes. Just the URL. If you cannot find a suitable replacement, return the text "NO_REPLACEMENT_FOUND".
    """

    try:
        log_message(f"    AI_REPLACE: Asking AI for replacement for: {original_url} (Step: {step_title})")
        response = gemini_model.generate_content(prompt)
        ai_response_text = response.text.strip()
        # Clean potential markdown, quotes, etc.
        potential_url = re.sub(r'[`\'"]', '', ai_response_text).strip()

        # Basic validation
        if not potential_url or "NO_REPLACEMENT_FOUND" in potential_url.upper() or ' ' in potential_url:
            log_message(f"    AI_REPLACE: AI indicated no suitable replacement found.")
            return None, prompt, ai_response_text # Return None if AI couldn't find one or format is wrong
        if not (potential_url.startswith('http://') or potential_url.startswith('https://')):
            log_message(f"    AI_REPLACE: AI returned invalid-looking URL: {potential_url}")
            return None, prompt, ai_response_text # Return None if it doesn't look like a URL

        log_message(f"    AI_REPLACE: AI suggested: {potential_url}")
        return potential_url, prompt, ai_response_text # Return the potential URL, prompt, and raw response

    except Exception as e:
        log_message(f"    AI_REPLACE: Error during Gemini API call: {e}")
        traceback.print_exc()
        return None, prompt, f"Error: {e}" # Return None on error, but include prompt/error


# --- Main Validation Logic (Modified) ---
def validate_roadmap_links():
    """Fetches unique study_links, checks validity, logs invalid ones,
       and attempts AI replacement and DB update."""

    lock_file_path = os.path.join(os.path.dirname(__file__), LOCK_FILE)
    lock_handle = None

    try:
        lock_handle = open(lock_file_path, 'a+')
        portalocker.lock(lock_handle, portalocker.LOCK_EX | portalocker.LOCK_NB)
        log_message("--- Starting Roadmap Link Validation (Lock Acquired) ---")
    except (portalocker.LockException, IOError, OSError) as e:
        log_message(f"--- Link Validation already in progress or lock error ({e}). Skipping this run. ---")
        if lock_handle: 
            try: lock_handle.close()
            except Exception: pass
        return

    conn = None
    cur = None
    # --- Store link locations: {url: [(roadmap_id, domain, stage_idx, step_idx, title, desc), ...]} ---
    link_locations = {}

    try:
        conn = get_db_connection()
        if not conn: log_message("❌ Database connection failed. Aborting."); return
        cur = conn.cursor(dictionary=True) # Use dictionary cursor

        log_message("Fetching roadmaps from database...")
        cur.execute("SELECT id, domain, roadmap FROM roadmaps")
        roadmaps = cur.fetchall()
        log_message(f"Found {len(roadmaps)} roadmaps.")

        # Extract unique links and their locations
        for r_data in roadmaps:
            roadmap_id = r_data['id']
            domain = r_data['domain']
            try:
                roadmap_json = json.loads(r_data['roadmap'])
                if isinstance(roadmap_json, dict) and 'roadmap' in roadmap_json:
                     for stage_idx, stage in enumerate(roadmap_json.get('roadmap', [])):
                         for step_idx, step in enumerate(stage.get('steps', [])):
                             link = step.get('study_link')
                             title = step.get('title', 'N/A')
                             desc = step.get('description', 'N/A')
                             if link and isinstance(link, str) and link.startswith('http'):
                                 if link not in link_locations:
                                     link_locations[link] = []
                                 link_locations[link].append((roadmap_id, domain, stage_idx, step_idx, title, desc))
            except (json.JSONDecodeError, TypeError) as e:
                log_message(f"    WARNING: Could not parse roadmap JSON for ID {roadmap_id}, Domain {domain}: {e}")

        unique_links = set(link_locations.keys())
        log_message(f"Extracted {len(unique_links)} unique study links.")

        invalid_links_count = 0
        valid_links_count = 0
        replaced_count = 0
        ai_failed_count = 0

        if not unique_links:
            log_message("No links found to validate.")
        else:
            log_message("Starting URL checks...")
            link_list = list(unique_links)
            for i, link in enumerate(link_list):
                log_message(f"  Checking link {i+1}/{len(link_list)}: {link}")
                is_valid, status = check_url(link)

                if not is_valid:
                    invalid_links_count += 1
                    # Process each occurrence of the invalid link
                    if link in link_locations:
                        for roadmap_id, domain, stage_idx, step_idx, title, desc in link_locations[link]:
                            try:
                                # Check if this exact instance is already logged and UNRESOLVED
                                cur.execute("""
                                    SELECT id FROM invalid_study_links
                                    WHERE roadmap_id = %s AND stage_index = %s AND step_index = %s
                                    AND original_url = %s AND resolved_at IS NULL
                                """, (roadmap_id, stage_idx, step_idx, link))
                                existing_invalid = cur.fetchone()

                                if not existing_invalid:
                                    log_message(f"    INVALID link found: {link} in Roadmap ID {roadmap_id}, Stage {stage_idx}, Step {step_idx}")
                                    # Log the newly found invalid link instance
                                    cur.execute("""
                                        INSERT INTO invalid_study_links
                                        (roadmap_id, stage_index, step_index, original_url, status_code, checked_at)
                                        VALUES (%s, %s, %s, %s, %s, %s)
                                    """, (roadmap_id, stage_idx, step_idx, link, status, datetime.now()))
                                    invalid_link_db_id = cur.lastrowid # Get the ID of the new record
                                    conn.commit()
                                    log_message(f"      Logged invalid link instance (ID: {invalid_link_db_id}).")

                                    # --- Attempt AI Replacement ---
                                    if AI_REPLACEMENT_ENABLED:
                                        time.sleep(AI_RETRY_DELAY_SECONDS) # Wait before calling AI
                                        new_url, ai_prompt, ai_response = find_replacement_link(link, title, desc, domain)

                                        # Update log with AI details regardless of success
                                        cur.execute("""
                                            UPDATE invalid_study_links SET ai_prompt = %s, ai_response = %s
                                            WHERE id = %s
                                            """, (ai_prompt, ai_response, invalid_link_db_id))
                                        conn.commit()


                                        if new_url:
                                            # --- Update Roadmap JSON ---
                                            log_message(f"      Attempting to update roadmap JSON for ID {roadmap_id} with new URL: {new_url}")
                                            # Use FOR UPDATE to lock the row during read/modify/write
                                            cur.execute("SELECT roadmap FROM roadmaps WHERE id = %s FOR UPDATE", (roadmap_id,))
                                            current_roadmap_record = cur.fetchone()
                                            if current_roadmap_record:
                                                try:
                                                    current_roadmap_json = json.loads(current_roadmap_record['roadmap'])
                                                    # Navigate and update (with checks)
                                                    if (isinstance(current_roadmap_json, dict) and
                                                        'roadmap' in current_roadmap_json and
                                                        isinstance(current_roadmap_json['roadmap'], list) and
                                                        stage_idx < len(current_roadmap_json['roadmap']) and
                                                        isinstance(current_roadmap_json['roadmap'][stage_idx], dict) and
                                                        'steps' in current_roadmap_json['roadmap'][stage_idx] and
                                                        isinstance(current_roadmap_json['roadmap'][stage_idx]['steps'], list) and
                                                        step_idx < len(current_roadmap_json['roadmap'][stage_idx]['steps']) and
                                                        isinstance(current_roadmap_json['roadmap'][stage_idx]['steps'][step_idx], dict) and
                                                        current_roadmap_json['roadmap'][stage_idx]['steps'][step_idx].get('study_link') == link): # Verify original link still matches

                                                        current_roadmap_json['roadmap'][stage_idx]['steps'][step_idx]['study_link'] = new_url
                                                        updated_roadmap_str = json.dumps(current_roadmap_json) # Convert back to string

                                                        # Update the database
                                                        cur.execute("UPDATE roadmaps SET roadmap = %s WHERE id = %s", (updated_roadmap_str, roadmap_id))
                                                        # Mark as resolved in invalid_links table
                                                        cur.execute("""
                                                            UPDATE invalid_study_links SET new_url = %s, resolved_at = %s
                                                            WHERE id = %s
                                                        """, (new_url, datetime.now(), invalid_link_db_id))

                                                        conn.commit() # Commit both updates together
                                                        replaced_count += 1
                                                        log_message(f"        SUCCESS: Replaced link in Roadmap ID {roadmap_id}, Stage {stage_idx}, Step {step_idx}.")

                                                    else:
                                                         log_message(f"        SKIPPED UPDATE: Roadmap structure changed or original link mismatch for Roadmap ID {roadmap_id}, Stage {stage_idx}, Step {step_idx}.")
                                                         conn.rollback() # Rollback if structure changed or link mismatch

                                                except (json.JSONDecodeError, TypeError, IndexError) as json_e:
                                                    log_message(f"        ERROR updating JSON for Roadmap ID {roadmap_id}: {json_e}")
                                                    conn.rollback() # Rollback on JSON processing error
                                            else:
                                                 log_message(f"        ERROR: Could not re-fetch roadmap ID {roadmap_id} for update.")
                                                 conn.rollback() # Rollback if roadmap disappeared
                                        else:
                                            ai_failed_count += 1
                                            log_message(f"      AI failed to find replacement for instance (ID: {invalid_link_db_id}).")
                                            # No commit needed here, just logging failure
                                    else:
                                        log_message("      AI replacement disabled. Skipping.")
                                else:
                                    log_message(f"    Invalid link already logged and unresolved: {link} in Roadmap ID {roadmap_id}, Stage {stage_idx}, Step {step_idx}")

                            except Exception as db_err:
                                log_message(f"    ERROR processing invalid link instance for Roadmap ID {roadmap_id}: {db_err}")
                                traceback.print_exc()
                                conn.rollback() # Rollback on error processing instance

                else: # Link is valid
                    valid_links_count += 1
                    # --- OPTIONAL: Mark previously invalid links as resolved if they are now valid ---
                    if link in link_locations:
                         for roadmap_id, domain, stage_idx, step_idx, title, desc in link_locations[link]:
                             cur.execute("""
                                UPDATE invalid_study_links
                                SET resolved_at = %s, status_code = %s, new_url = 'NOW_VALID'
                                WHERE roadmap_id = %s AND stage_index = %s AND step_index = %s
                                AND original_url = %s AND resolved_at IS NULL
                             """, (datetime.now(), status, roadmap_id, stage_idx, step_idx, link))
                         if cur.rowcount > 0:
                              log_message(f"    Marked previously invalid link as NOW_VALID: {link} in Roadmap ID {roadmap_id}, Stage {stage_idx}, Step {step_idx}")
                              conn.commit() # Commit the resolution
                    # ---------------------------------------------------------------------------------

                time.sleep(0.5) # Be polite between URL checks

            log_message(f"Finished URL checks. Valid: {valid_links_count}, Invalid: {invalid_links_count}, AI Replaced: {replaced_count}, AI Failed: {ai_failed_count}")

    except Exception as e:
        log_message(f"❌ An unexpected error occurred during validation process: {e}")
        traceback.print_exc()
        if conn: conn.rollback() # Rollback any partial transaction
    finally:
        # Cleanup DB
        if cur: cur.close()
        if conn: conn.close()
        log_message("--- Roadmap Link Validation Finished ---")
        # Release Lock
        if lock_handle:
            try:
                portalocker.unlock(lock_handle)
                lock_handle.close()
                if os.path.exists(lock_file_path): os.remove(lock_file_path)
                log_message("    Lock released and file removed.")
            except (OSError, portalocker.LockException, FileNotFoundError) as e:
                log_message(f"    WARNING: Could not release lock or remove lock file: {e}")

# --- Run the validation ---
if __name__ == "__main__":
    validate_roadmap_links()