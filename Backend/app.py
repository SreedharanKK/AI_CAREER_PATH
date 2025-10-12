from flask import Flask, send_from_directory
from flask_cors import CORS
import os

# Import your routes (separate files you will create)
from routes.signup import signup_bp
from routes.login import login_bp
from routes.user_profile import user_profile_bp
from routes.user_details import user_details_bp
from routes.skill_gap import skill_gap_bp
from routes.extract import extract_bp
from routes.dashboard_previews import dashboard_previews_bp
from routes.roadmap import roadmap_bp
from routes.quiz import quiz_bp
from routes.learning_recs import learning_recs_bp
from routes.achievements import achievements_bp
from routes.job_recs import job_recs_bp

app = Flask(__name__)
CORS(app, 
     supports_credentials=True, 
     origins=["http://localhost:5173"])  # allow frontend React to connect

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    """
    Serves files from the 'uploads' directory.
    The <path:filename> part is crucial to handle subdirectories like 'resumes/'.
    """
    return send_from_directory(UPLOAD_FOLDER, filename)

# Register Blueprints (each route file will have its own blueprint)
app.register_blueprint(signup_bp, url_prefix="/api/auth")
app.register_blueprint(login_bp, url_prefix="/api/auth")
app.register_blueprint(user_profile_bp, url_prefix="/api/user")
app.register_blueprint(user_details_bp, url_prefix="/api/user")
app.register_blueprint(skill_gap_bp, url_prefix="/api/user")
app.register_blueprint(extract_bp, url_prefix="/api/user/extract-skills")
app.register_blueprint(dashboard_previews_bp, url_prefix='/api/user')
app.register_blueprint(roadmap_bp, url_prefix="/api/user")
app.register_blueprint(quiz_bp, url_prefix="/api/user")
app.register_blueprint(learning_recs_bp, url_prefix='/api/user')
app.register_blueprint(achievements_bp, url_prefix="/api/user")
app.register_blueprint(job_recs_bp, url_prefix="/api/user")

if __name__ == "__main__":
    app.run(debug=True, port=5000, host="localhost")


