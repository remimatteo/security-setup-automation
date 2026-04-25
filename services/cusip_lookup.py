import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests
import config


def lookup_cusip(cusip: str):
    headers = {"Content-Type": "application/json"}
    if config.OPENFIGI_API_KEY:
        headers["X-OPENFIGI-APIKEY"] = config.OPENFIGI_API_KEY

    payload = [{"idType": "ID_CUSIP", "idValue": cusip}]
    resp = requests.post(config.OPENFIGI_API_URL, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()

    results = resp.json()
    if not results or "data" not in results[0] or not results[0]["data"]:
        return None

    item = results[0]["data"][0]
    return {
        "figi": item.get("figi"),
        "name": item.get("name"),
        "ticker": item.get("ticker"),
        "exchange": item.get("exchCode"),
        "security_type": item.get("securityType"),
        "security_type2": item.get("securityType2"),
        "market_sector": item.get("marketSector"),
    }
