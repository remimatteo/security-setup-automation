import time
import uuid
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config


def submit_to_vendor(security: dict) -> dict:
    time.sleep(config.VENDOR_SUBMISSION_DELAY)

    ref_id = f"PH3-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "status": "submitted",
        "vendor_ref": ref_id,
        "vendor": config.VENDOR_NAME,
        "submitted_at": now,
        "message": (
            f"Security {security['cusip']} successfully submitted to "
            f"{config.VENDOR_NAME}. Reference: {ref_id}"
        ),
    }
