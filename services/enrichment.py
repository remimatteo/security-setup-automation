import hashlib
import random
from datetime import date, timedelta


def _rng(cusip: str) -> random.Random:
    seed = int(hashlib.md5(cusip.encode()).hexdigest(), 16)
    return random.Random(seed)


def compute_isin(cusip: str, country: str = "US") -> str:
    isin_base = country + cusip
    numeric = ""
    for ch in isin_base:
        if ch.isdigit():
            numeric += ch
        else:
            numeric += str(ord(ch) - ord("A") + 10)

    digits = [int(d) for d in numeric]
    n = len(digits)
    for i in range(n):
        if (n - 1 - i) % 2 == 0:
            digits[i] *= 2
            if digits[i] > 9:
                digits[i] -= 9

    check = (10 - sum(digits) % 10) % 10
    return isin_base + str(check)


def enrich_bond(cusip: str, figi_data: dict) -> dict:
    rng = _rng(cusip)
    today = date.today()

    years = rng.randint(2, 30)
    maturity = today + timedelta(days=years * 365)
    coupon = round(rng.uniform(1.5, 8.5), 3)
    ytm = round(coupon + rng.uniform(-0.5, 1.5), 3)

    ratings = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB"]
    rating_weights = [5, 8, 10, 10, 12, 12, 10, 10, 8, 6, 5, 4]
    rating = rng.choices(ratings, weights=rating_weights)[0]

    bond_types = ["Corporate Bond", "Government Bond", "Municipal Bond", "Agency Bond"]
    bond_weights = [50, 25, 15, 10]

    return {
        **figi_data,
        "cusip": cusip,
        "isin": compute_isin(cusip),
        "asset_class": "BOND",
        "bond_type": rng.choices(bond_types, weights=bond_weights)[0],
        "maturity_date": maturity.strftime("%Y-%m-%d"),
        "coupon_rate": f"{coupon}%",
        "face_value": "$1,000.00",
        "yield_to_maturity": f"{ytm}%",
        "credit_rating": rating,
        "payment_frequency": rng.choice(["Semi-Annual", "Annual", "Quarterly"]),
        "day_count": rng.choice(["30/360", "ACT/360", "ACT/ACT"]),
        "currency": "USD",
    }


def enrich_equity(cusip: str, figi_data: dict) -> dict:
    rng = _rng(cusip)

    sectors = [
        "Technology", "Financials", "Healthcare", "Consumer Discretionary",
        "Industrials", "Energy", "Materials", "Utilities",
        "Real Estate", "Communication Services", "Consumer Staples",
    ]
    caps = ["Large Cap", "Mid Cap", "Small Cap"]
    cap_weights = [50, 30, 20]

    return {
        **figi_data,
        "cusip": cusip,
        "isin": compute_isin(cusip),
        "asset_class": "EQUITY",
        "sector": rng.choice(sectors),
        "market_cap_category": rng.choices(caps, weights=cap_weights)[0],
        "dividend_yield": f"{round(rng.uniform(0.0, 4.5), 2)}%",
        "shares_outstanding": f"{rng.randint(50, 15000)}M",
        "lot_size": rng.choice([1, 10, 100]),
        "currency": "USD",
    }


def enrich_security(cusip: str, figi_data: dict) -> dict:
    sector = figi_data.get("market_sector", "")
    stype = figi_data.get("security_type", "") or ""

    is_bond = sector in {"Corp", "Govt", "Muni", "Agency"} or any(
        kw in stype for kw in ("Note", "Bond", "Bill", "Treasury", "Debenture")
    )

    if is_bond:
        return enrich_bond(cusip, figi_data)
    return enrich_equity(cusip, figi_data)
