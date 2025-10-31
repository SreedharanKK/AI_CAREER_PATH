# routes/news_feed.py
from flask import Blueprint, request, jsonify
import jwt
import json
import requests
from db_config import get_db_connection
from config import SECRET_KEY, NEWS_API_KEY
import traceback
from urllib.parse import quote_plus
from datetime import datetime, timedelta # Import timedelta

news_feed_bp = Blueprint('news_feed', __name__)

# --- NewsAPI Configuration ---
NEWS_API_ENDPOINT = "https://newsapi.org/v2/everything"
MAX_ARTICLES = 4
# --- NEW: Cache Configuration ---
news_feed_cache = {} # In-memory cache { user_id: {'data': [...], 'timestamp': datetime} }
CACHE_DURATION = timedelta(hours=1) # Cache news feed for 1 hour
# -----------------------------

@news_feed_bp.route('/news-feed', methods=['GET'])
def get_news_feed_via_api():
    """
    Fetches user's news feed, using an in-memory cache with expiry.
    """
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Authentication required."}), 401

    try:
        user_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = user_data["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({"error": "Invalid or expired session."}), 401

    # --- NEW: Check Cache ---
    now = datetime.now()
    if user_id in news_feed_cache:
        cached_entry = news_feed_cache[user_id]
        if now - cached_entry['timestamp'] < CACHE_DURATION:
            print(f"✅ Returning cached news feed for User {user_id}")
            return jsonify({"news_feed": cached_entry['data']}), 200
        else:
            print(f"ℹ️ Cache expired for User {user_id}. Fetching fresh news.")
            # Remove expired entry
            news_feed_cache.pop(user_id, None)
    else:
        print(f"ℹ️ No cache found for User {user_id}. Fetching fresh news.")
    # --- END Cache Check ---

    # --- Proceed with fetching if cache missed or expired ---

    if not NEWS_API_KEY:
        print("❌ NEWS_API_KEY not configured. Cannot fetch news feed.")
        return jsonify({"news_feed": [], "message": "News feed service is not configured."}), 200

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed."}), 500

        cur = conn.cursor(dictionary=True)

        # --- Fetch User Topics (Same as before) ---
        topics = set()
        # 1. Roadmap Domains
        cur.execute("SELECT domain FROM roadmaps WHERE user_id = %s", (user_id,))
        roadmap_rows = cur.fetchall()
        for row in roadmap_rows: topics.add(row['domain'].strip()) if row.get('domain') else None
        # 2. User Details (Skills & Domain)
        cur.execute("SELECT skills, domain FROM user_details WHERE user_id = %s", (user_id,))
        details_row = cur.fetchone()
        skills_list = []
        if details_row:
            if details_row.get('domain'):
                 try:
                     domain_data = details_row['domain']
                     if isinstance(domain_data, (bytes, bytearray)): domain_data = domain_data.decode('utf-8')
                     domain_list = json.loads(domain_data) if isinstance(domain_data, str) else domain_data
                     if isinstance(domain_list, list):
                         for d in domain_list: topics.add(d.strip()) if d and isinstance(d, str) else None
                 except (json.JSONDecodeError, TypeError): pass
            if details_row.get('skills'):
                 try:
                     skill_data = details_row['skills']
                     if isinstance(skill_data, (bytes, bytearray)): skill_data = skill_data.decode('utf-8')
                     loaded = json.loads(skill_data) if isinstance(skill_data, str) else skill_data
                     if isinstance(loaded, list): skills_list.extend([str(s).strip() for s in loaded if s and str(s).strip()])
                 except (json.JSONDecodeError, TypeError): pass
        # 3. Extracted Skills
        cur.execute("SELECT skills FROM extract_skills WHERE user_id = %s", (user_id,))
        extracted_row = cur.fetchone()
        if extracted_row and extracted_row.get('skills'):
            try:
                skill_data = extracted_row['skills']
                if isinstance(skill_data, (bytes, bytearray)): skill_data = skill_data.decode('utf-8')
                loaded = json.loads(skill_data) if isinstance(skill_data, str) else skill_data
                if isinstance(loaded, list): skills_list = [str(s).strip() for s in loaded if s and str(s).strip()]
            except (json.JSONDecodeError, TypeError): pass
        # Add top skills
        for skill in skills_list[:5]: topics.add(skill)
        # --- End Fetch User Topics ---

        if not topics:
            # Cache the empty result so we don't keep hitting the DB/API
            news_feed_cache[user_id] = {'data': [], 'timestamp': now}
            print(f"No relevant topics found for User {user_id}. Caching empty result.")
            return jsonify({"news_feed": [], "message": "No relevant topics found in your profile."}), 200

        # --- Construct News API Query (Same as before) ---
        query_terms = sorted(list(topics), key=len, reverse=True)
        search_query = " OR ".join([f'"{term}"' if ' ' in term else term for term in query_terms])
        print(f"Constructed News API query for User {user_id}: {search_query}")

        # --- Call News API (Same as before) ---
        headers = {'X-Api-Key': NEWS_API_KEY}
        params = { 'q': search_query, 'language': 'en', 'sortBy': 'relevancy', 'pageSize': 10 }
        api_response_data = None # To store successful response data
        try:
            response = requests.get(NEWS_API_ENDPOINT, headers=headers, params=params, timeout=15)
            response.raise_for_status()
            news_api_data = response.json()
        except requests.exceptions.Timeout:
            print(f"❌ News API call timed out for user {user_id}")
            # Don't cache errors, just return error response
            return jsonify({"error": "News feed service timed out."}), 408
        except requests.exceptions.RequestException as e:
            print(f"❌ Error calling News API for user {user_id}: {e}")
            error_detail = str(e); status_code = 503
            if e.response is not None:
                status_code = e.response.status_code
                try: error_detail = e.response.json().get('message', str(e.response.text))
                except json.JSONDecodeError: error_detail = str(e.response.text)
                if status_code == 401: error_detail = "Invalid News API Key."
                if status_code == 429: error_detail = "News API rate limit exceeded."
            # Don't cache errors
            return jsonify({"error": f"Could not fetch news: {error_detail}"}), status_code

        # --- Process and Format Results (Same as before) ---
        if news_api_data.get('status') != 'ok' or not news_api_data.get('articles'):
            print(f"News API returned status '{news_api_data.get('status')}' or no articles for user {user_id}.")
            # Cache the empty result
            news_feed_cache[user_id] = {'data': [], 'timestamp': now}
            return jsonify({"news_feed": [], "message": "No relevant news found at this time."}), 200

        formatted_feed = []
        for article in news_api_data['articles']:
            if not article.get('description') or article.get('title') == '[Removed]': continue
            formatted_feed.append({
                "title": article.get('title', 'No Title'),
                "link": article.get('url', '#'),
                "summary": (article['description'][:150] + '...') if len(article['description']) > 153 else article['description']
            })
            if len(formatted_feed) >= MAX_ARTICLES: break

        # --- NEW: Store successful result in cache ---
        news_feed_cache[user_id] = {'data': formatted_feed, 'timestamp': now}
        print(f"📰 Cached {len(formatted_feed)} news items for user {user_id}.")
        # ---------------------------------------------

        return jsonify({"news_feed": formatted_feed}), 200

    except Exception as e:
        print(f"❌ Unexpected error fetching news feed for user {user_id}: {e}")
        traceback.print_exc()
        # Don't cache unexpected errors
        return jsonify({"error": "An internal server error occurred fetching news feed."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

# --- NEW: Function to clear cache for a user ---
def clear_news_cache(user_id):
    """Removes a user's news feed from the in-memory cache."""
    if user_id in news_feed_cache:
        del news_feed_cache[user_id]
        print(f"Cleared news feed cache for user_id: {user_id}")