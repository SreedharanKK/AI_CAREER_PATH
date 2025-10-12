import os
from dotenv import load_dotenv

# Load variables from the .env file into the environment
load_dotenv()

# Securely fetch the SECRET_KEY from the environment
SECRET_KEY = os.getenv("SECRET_KEY")

# --- Error Handling ---
# It's critical that the app doesn't run without a secret key.
if not SECRET_KEY:
    raise ValueError("SECRET_KEY not found in .env file. The application cannot start securely.")
