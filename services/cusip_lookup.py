import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests
import config

_PREFERRED_EXCHANGES = {"UW", "UN", "US", "UA", "UR"}


def _parse_item(item: dict) -> dict:
    return {
        "figi":          item.get("figi"),
        "name":          item.get("name"),
        "ticker":        item.get("ticker"),
        "exchange":      item.get("exchCode"),
        "security_type": item.get("securityType"),
        "security_type2":item.get("securityType2"),
        "market_sector": item.get("marketSector"),
    }


def _call_openfigi(payload: list) -> list:
    headers = {"Content-Type": "application/json"}
    if config.OPENFIGI_API_KEY:
        headers["X-OPENFIGI-APIKEY"] = config.OPENFIGI_API_KEY
    resp = requests.post(config.OPENFIGI_API_URL, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


def lookup_cusip(cusip: str):
    results = _call_openfigi([{"idType": "ID_CUSIP", "idValue": cusip}])
    if not results or "data" not in results[0] or not results[0]["data"]:
        return None
    return _parse_item(results[0]["data"][0])


def lookup_ticker(ticker: str):
    results = _call_openfigi([{"idType": "TICKER", "idValue": ticker.upper()}])
    if not results or "data" not in results[0] or not results[0]["data"]:
        return None

    data = results[0]["data"]

    # Prefer common stock / ETF on major US exchanges
    equities = [d for d in data if d.get("marketSector") == "Equity"
                and d.get("securityType") in ("Common Stock", "ETP", "ETF")]
    us = [d for d in equities if d.get("exchCode") in _PREFERRED_EXCHANGES]

    item = us[0] if us else (equities[0] if equities else data[0])
    return _parse_item(item)
