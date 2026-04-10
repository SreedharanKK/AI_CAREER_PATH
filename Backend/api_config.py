import os, time
from dotenv import load_dotenv
try:
    from google import genai
    from google.genai.errors import ClientError
    from google.api_core.exceptions import ResourceExhausted
except ImportError:
    print("❌ CRITICAL ERROR: The 'google-genai' library is not installed.")
    print("👉 Please run: pip install google-genai")
    raise

load_dotenv()

keys_str = os.getenv("GEMINI_API_KEYS")
single_key = os.getenv("GEMINI_API_KEY")

if keys_str:
    API_KEYS = [k.strip() for k in keys_str.split(',') if k.strip()]
elif single_key:
    API_KEYS = [single_key]

# --- Error Handling ---
if not API_KEYS:
    raise ValueError("No Gemini API keys found. Please set GEMINI_API_KEYS (comma-separated) in your .env file.")

print(f"ℹ️ Loaded {len(API_KEYS)} Gemini API Key(s).")

class MultiKeyGeminiAdapter:
    def __init__(self, api_keys, model_name):
        self.clients = []
        self.model_name = model_name
        self.current_key_index = 0
        
        # Initialize a client for every key found
        for i, key in enumerate(api_keys):
            try:
                # We create the client instance but don't connect yet
                client = genai.Client(api_key=key)
                self.clients.append(client)
            except Exception as e:
                print(f"⚠️ Warning: Failed to initialize key #{i+1}: {e}")
        
        if not self.clients:
            raise ValueError("Failed to initialize any Gemini clients.")

    def _get_next_client(self):
        """Round-robin selection of clients to spread the load."""
        client = self.clients[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.clients)
        return client

    def generate_content(self, prompt):
        max_attempts = len(self.clients) * 2 
        if max_attempts < 3: max_attempts = 3 
        for attempt in range(max_attempts):
            client = self._get_next_client()
            try:
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                return response
            except ClientError as e:
                if e.code == 429:
                    print(f"⚠️ Rate limit hit on key index {self.current_key_index - 1}. Switching to next key...")
                    continue 
                else:
                    print(f"❌ ClientError (Code {e.code}): {e}")
                    raise e
            except Exception as e:
                print(f"❌ Unexpected error on key index {self.current_key_index - 1}: {e}")
                if attempt == max_attempts - 1:
                    raise ResourceExhausted(f"All API keys exhausted or failed. Last error: {e}")
                time.sleep(1) 

        raise ResourceExhausted("All API keys rate limited.")

# --- Initialize the Gemini Model ---
try:
    gemini_model = MultiKeyGeminiAdapter(API_KEYS, 'models/gemini-2.0-flash')
    print(f"✅ Gemini Model initialized successfully (Multi-Key Rotation Enabled).")
except Exception as e:
    print(f"❌ Error initializing Gemini Model: {e}")
    gemini_model = None

