import os
import google.generativeai as genai
from dotenv import load_dotenv

# --- Load Environment Variables ---
load_dotenv()

# --- Get the API Key ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- Error Handling ---
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found. Please set it in your .env file.")

# --- Configure the Generative AI Client ---
genai.configure(api_key=GEMINI_API_KEY)

# --- Initialize the Gemini Model ---
# Use 'gemini-pro' as it is the standard and most stable model for this task.
try:
    gemini_model = genai.GenerativeModel('gemini-2.5-pro')
    print("✅ Gemini Model initialized successfully with 'gemini-2.5-pro'.")
except Exception as e:
    print(f"❌ Error initializing Gemini Model: {e}")
    gemini_model = None

