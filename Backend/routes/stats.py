from flask import Blueprint, request, jsonify
import jwt
import json
from db_config import get_db_connection
from config import SECRET_KEY
from datetime import datetime, timedelta
import traceback

stats_bp = Blueprint('stats', __name__)

def parse_count(raw_data):
    """
    Safely counts items in a JSON list or a comma-separated string.
    Ensures new users with no data return 0.
    """
    if not raw_data:
        return 0
    try:
        # Try JSON parsing (Standard for our AI outputs)
        parsed = json.loads(raw_data)
        if isinstance(parsed, list):
            return len(parsed)
        return 1 if parsed else 0
    except:
        # Fallback for plain text or manual entries "React, Node, SQL"
        if isinstance(raw_data, str) and raw_data.strip():
            # Filter out empty strings from splitting
            return len([s for s in raw_data.split(',') if s.strip()])
        return 0

@stats_bp.route('/stats', methods=['GET'])
def get_user_stats():
    # --- Authentication ---
    token = request.cookies.get("token")
    if not token:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except Exception:
        return jsonify({"error": "Invalid session"}), 401

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # Initial structure with actual 0s for new users
    response_data = {
        "skillRatio": [
            {"name": "Acquired", "value": 0, "color": "#4CC9F0"},
            {"name": "Missing", "value": 0, "color": "#F72585"}
        ],
        "weeklyActivity": [],
        "roadmapProgress": [
            {"stage": "Phase 1", "progress": 0}, 
            {"stage": "Phase 2", "progress": 0},
            {"stage": "Phase 3", "progress": 0}, 
            {"stage": "Phase 4", "progress": 0}
        ]
    }

    try:
        # --- 1. SKILL RATIO (Pie Chart) ---
        # Fetch acquired skills from user profile
        cur.execute("SELECT skills FROM user_details WHERE id = %s", (user_id,))
        details_row = cur.fetchone()
        
        # Fetch missing skills from the most recent AI analysis
        cur.execute("""
            SELECT missing_skills FROM skill_gap_analysis 
            WHERE user_id = %s ORDER BY id DESC LIMIT 1
        """, (user_id,))
        gap_row = cur.fetchone()

        acquired_count = parse_count(details_row['skills'] if details_row else None)
        missing_count = parse_count(gap_row['missing_skills'] if gap_row else None)

        response_data["skillRatio"] = [
            {"name": "Acquired", "value": acquired_count, "color": "#4CC9F0"},
            {"name": "Missing", "value": missing_count, "color": "#F72585"}
        ]

        # --- 2. WEEKLY ACTIVITY (Area/Line Chart) ---
        # Get learning activity for the last 7 days
        try:
            for i in range(6, -1, -1):
                target_date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
                day_name = (datetime.now() - timedelta(days=i)).strftime('%a')
                
                # Count quiz submissions per day
                cur.execute("""
                    SELECT COUNT(*) as count FROM quiz_history 
                    WHERE user_id = %s AND DATE(created_at) = %s
                """, (user_id, target_date))
                res = cur.fetchone()
                count = res['count'] if res else 0
                
                # Scale up for visual impact in the chart
                response_data["weeklyActivity"].append({"day": day_name, "score": count * 20})
        except Exception:
            # Fallback if created_at column doesn't exist yet
            response_data["weeklyActivity"] = [{"day": d, "score": 0} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]

        # --- 3. ROADMAP PROGRESS (Bar Chart) ---
        try:
            # Find latest roadmap
            cur.execute("SELECT id FROM roadmaps WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
            latest_rd = cur.fetchone()
            
            if latest_rd:
                # Calculate progress based on YOUR TABLE SCHEMA: is_completed (tinyint)
                cur.execute("""
                    SELECT is_completed, COUNT(*) as count 
                    FROM user_roadmap_progress 
                    WHERE user_id = %s AND roadmap_id = %s 
                    GROUP BY is_completed
                """, (user_id, latest_rd['id']))
                
                progress_rows = cur.fetchall()
                # Aggregate where is_completed is 1 (True)
                completed_tasks = sum(r['count'] for r in progress_rows if r['is_completed'] == 1)
                total_tasks = sum(r['count'] for r in progress_rows)
                
                if total_tasks > 0:
                    total_perc = (completed_tasks / total_tasks * 100)
                    # Distribute progress across 4 Phase bars
                    response_data["roadmapProgress"] = [
                        {"stage": "Phase 1", "progress": min(total_perc * 2, 100)},
                        {"stage": "Phase 2", "progress": max(0, min((total_perc - 25) * 2, 100))},
                        {"stage": "Phase 3", "progress": max(0, min((total_perc - 50) * 2, 100))},
                        {"stage": "Phase 4", "progress": max(0, min((total_perc - 75) * 2, 100))}
                    ]
        except Exception as e:
            print(f"Roadmap Stat Error: {e}")

        return jsonify(response_data), 200

    except Exception as e:
        print("❌ DASHBOARD STATS LOGIC CRASHED:")
        traceback.print_exc()
        # Return default 0-data object to prevent frontend "Internal Server Error" alerts
        return jsonify(response_data), 200
    finally:
        cur.close()
        conn.close()