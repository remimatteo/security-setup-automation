CREATE TABLE IF NOT EXISTS submissions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cusip         TEXT NOT NULL,
    isin          TEXT,
    ticker        TEXT,
    name          TEXT,
    asset_class   TEXT,          -- BOND | EQUITY
    vendor_ref    TEXT,          -- Phase 3 reference number
    status        TEXT DEFAULT 'submitted',
    submitted_at  TEXT,          -- ISO-8601 UTC
    security_data TEXT           -- Full JSON snapshot of the security at submission time
);

CREATE INDEX IF NOT EXISTS idx_cusip ON submissions(cusip);
CREATE INDEX IF NOT EXISTS idx_submitted_at ON submissions(submitted_at DESC);
