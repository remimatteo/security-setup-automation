import os

OPENFIGI_API_URL = "https://api.openfigi.com/v3/mapping"
OPENFIGI_API_KEY = os.environ.get("OPENFIGI_API_KEY", "")

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "submissions.db")

VENDOR_NAME = "Security Master"
VENDOR_SUBMISSION_DELAY = 1.2
