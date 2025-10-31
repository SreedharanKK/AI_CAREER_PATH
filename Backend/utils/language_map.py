# backend/utils/language_map.py
import requests
import re

JUDGE0_LANGUAGE_MAP = {}
JUDGE0_LANGUAGES_ENDPOINT = "https://ce.judge0.com/languages"

def fetch_and_build_map():
    """
    Fetches all languages from Judge0 and builds a simplified
    map (e.g., "python" -> 71).
    This is called once when the server starts.
    """
    global JUDGE0_LANGUAGE_MAP
    
    try:
        print("Fetching Judge0 language list...")
        response = requests.get(JUDGE0_LANGUAGES_ENDPOINT, timeout=10)
        response.raise_for_status()
        languages = response.json()
        
        temp_map = {}
        for lang in languages:
            if not isinstance(lang, dict) or 'id' not in lang or 'name' not in lang:
                continue

            match = re.match(r"^\s*([a-zA-Z#+]+)", lang['name'])
            if match:
                simple_name = match.group(1).lower()
                
                if simple_name == "c++": simple_name = "cpp"
                if simple_name == "c#": simple_name = "csharp"

                if simple_name not in temp_map:
                    temp_map[simple_name] = lang['id']
                    
                if "node.js" in lang['name'].lower():
                    temp_map["javascript"] = lang['id']
                    
            full_name_lower = lang['name'].lower()
            if full_name_lower not in temp_map:
                temp_map[full_name_lower] = lang['id']

        # Add manual aliases for convenience
        if "python" in temp_map: temp_map["py"] = temp_map["python"]
        if "javascript" in temp_map: temp_map["js"] = temp_map["javascript"]
        
        # --- REMOVED HTML/CSS/SQL MAPPINGS ---
        # We will let these fail the lookup

        # Manually add common ones if fetch fails or they're missed
        if "cpp" not in temp_map: temp_map["cpp"] = 54
        if "java" not in temp_map: temp_map["java"] = 62
        if "python" not in temp_map: temp_map["python"] = 71
        if "javascript" not in temp_map: temp_map["javascript"] = 63


        JUDGE0_LANGUAGE_MAP = temp_map
        print(f"✅ Judge0 Language Map built successfully with {len(JUDGE0_LANGUAGE_MAP)} entries.")

    except requests.exceptions.RequestException as e:
        print(f"❌ CRITICAL: Failed to fetch Judge0 languages: {e}. Falling back to minimal map.")
        # Fallback map NO LONGER includes html/css
        JUDGE0_LANGUAGE_MAP = {
            "python": 71, "javascript": 63, "java": 62, "c++": 54, "c": 50,
            "cpp": 54, "js": 63, "py": 71
        }
    except Exception as e:
         print(f"❌ CRITICAL: Error building language map: {e}")
         JUDGE0_LANGUAGE_MAP = {}

def get_language_id(lang_name: str):
    """
    Gets the Judge0 ID for a simplified language name.
    """
    if not lang_name:
        return None
    
    lang_key = lang_name.lower().strip()

    # Try direct match
    if lang_key in JUDGE0_LANGUAGE_MAP:
        return JUDGE0_LANGUAGE_MAP[lang_key]
        
    # Try C++ alias
    if lang_key == "c++":
         return JUDGE0_LANGUAGE_MAP.get("cpp")
            
    print(f"Warning: Could not find Judge0 ID for language '{lang_name}'")
    return None # Will return None for 'html', 'css', 'sql'

# --- Run the fetch function ONCE when this module is imported (server start) ---
fetch_and_build_map()