import os
from dotenv import load_dotenv

# Load variables from the .env file into the environment
load_dotenv()

# Securely fetch the SECRET_KEY from the environment
SECRET_KEY = os.getenv("SECRET_KEY")

# Securely fetch the RapidAPI Key
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
# --- Error Handling ---
# It's critical that the app doesn't run without a secret key.
if not SECRET_KEY:
    raise ValueError("SECRET_KEY not found in .env file. The application cannot start securely.")

if not RAPIDAPI_KEY:
    print("Warning: RAPIDAPI_KEY not found in .env file. Job search will fail.")
    # We'll allow the app to run but job search will error out

if not NEWS_API_KEY:
    print("Warning: NEWS_API_KEY not found in .env file. News feed feature will likely fail.")