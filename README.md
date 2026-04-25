# Security Setup Automation

A full-stack web application that automates the securities onboarding workflow for bonds and equities. Enter a CUSIP, retrieve enriched security data from Bloomberg's OpenFIGI API, and submit to a vendor in a single click — replacing a previously manual, multi-step process.

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey)
![OpenFIGI](https://img.shields.io/badge/API-Bloomberg%20OpenFIGI-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## The Problem

In fixed income and equity operations, adding a new security for trading requires:

1. Looking up the CUSIP across multiple systems to pull maturity, coupon, ISIN, ticker, and ratings data
2. Manually entering that data into a vendor portal (e.g. a prime broker or custodian platform)
3. Waiting for confirmation before the security can be traded

This process is error-prone and slow when done by hand — especially at scale across bond and equity desks.

## The Solution

This tool condenses that workflow to a single page:

- **CUSIP → Full Security Profile** in one lookup via Bloomberg's OpenFIGI API
- **Asset-class-aware enrichment** — bonds surface maturity date, coupon, yield, credit rating, day count; equities surface sector, market cap tier, dividend yield, shares outstanding
- **One-click vendor submission** with a generated reference number and audit trail
- **Submission history** with CSV export for reconciliation and reporting

---

## Features

- **Real Bloomberg data** via [OpenFIGI](https://www.openfigi.com/) (free, no key required for basic use)
- **ISIN computation** from CUSIP using the standard Luhn check-digit algorithm
- **Deterministic enrichment** — the same CUSIP always returns the same bond/equity detail set (seeded from CUSIP hash)
- **Persistent audit log** stored in SQLite with full JSON snapshot of each security at submission time
- **CSV export** of full submission history
- **Clean, finance-style UI** — no heavy framework, just fast vanilla JS

---

## Demo

### Try these CUSIPs out of the box

| CUSIP       | Security              | Type   |
|-------------|-----------------------|--------|
| `037833100` | Apple Inc             | Equity |
| `594918104` | Microsoft Corp        | Equity |
| `023135106` | Amazon.com Inc        | Equity |
| `88160R101` | Tesla Inc             | Equity |
| `912828YX3` | US Treasury Note      | Bond   |

> Bond CUSIPs (like Treasuries) automatically display maturity, coupon, yield-to-maturity, credit rating, and payment frequency. Equities display sector, market cap category, dividend yield, and shares outstanding.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Python 3.9+, Flask 3.0            |
| Database   | SQLite (zero-config, file-based)  |
| Market Data| Bloomberg OpenFIGI REST API       |
| Frontend   | Vanilla JS, HTML5, CSS3           |
| ISIN Calc  | Luhn algorithm (standard)         |

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/your-username/security-setup-automation.git
cd security-setup-automation
```

**2. Create a virtual environment and install dependencies**
```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**3. (Optional) Set an OpenFIGI API key for higher rate limits**

Without a key you get 10 requests/minute — plenty for local use.
Register free at [openfigi.com](https://www.openfigi.com/api).

```bash
export OPENFIGI_API_KEY=your_key_here   # Windows: set OPENFIGI_API_KEY=your_key_here
```

**4. Run the app**
```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser. The SQLite database is created automatically on first launch.

---

## Project Structure

```
security-setup-automation/
├── app.py                     # Flask routes
├── config.py                  # Config (API URL, DB path, vendor settings)
├── requirements.txt
├── schema.sql                 # DB schema (reference)
├── services/
│   ├── cusip_lookup.py        # Bloomberg OpenFIGI integration
│   ├── enrichment.py          # Bond/equity enrichment + ISIN calculation
│   └── vendor.py              # Vendor submission handler (Phase 3)
├── db/
│   └── database.py            # SQLite — init, save, query
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## API Endpoints

| Method | Endpoint           | Description                              |
|--------|--------------------|------------------------------------------|
| POST   | `/api/lookup`      | Fetch security details by CUSIP          |
| POST   | `/api/submit`      | Submit security to vendor, log to DB     |
| GET    | `/api/submissions` | Return full submission history as JSON   |
| GET    | `/api/export`      | Download submission history as CSV       |

**Lookup request:**
```json
POST /api/lookup
{ "cusip": "037833100" }
```

**Lookup response (equity):**
```json
{
  "cusip": "037833100",
  "isin": "US0378331005",
  "ticker": "AAPL",
  "name": "APPLE INC",
  "asset_class": "EQUITY",
  "exchange": "UW",
  "sector": "Technology",
  "market_cap_category": "Large Cap",
  "dividend_yield": "0.52%",
  "currency": "USD"
}
```

---

## How It Works

1. **CUSIP input** → POST to `/api/lookup`
2. **OpenFIGI** returns FIGI, ticker, name, exchange, and market sector
3. **Enrichment layer** detects asset class (bond vs equity) from OpenFIGI's `marketSector` and `securityType` fields, then appends the relevant detail set
4. **ISIN** is computed client-free using the standard algorithm: `US` + CUSIP + Luhn check digit
5. **Submit** → POST to `/api/submit` → vendor handler generates a reference ID, saves a full snapshot to SQLite, returns confirmation
6. **History table** updates live after each submission

---

## License

MIT
