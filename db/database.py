import sqlite3
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config


def get_conn():
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                cusip       TEXT NOT NULL,
                isin        TEXT,
                ticker      TEXT,
                name        TEXT,
                asset_class TEXT,
                vendor_ref  TEXT,
                status      TEXT DEFAULT 'submitted',
                submitted_at TEXT,
                security_data TEXT
            )
        """)
        conn.commit()


def save_submission(security: dict, result: dict) -> int:
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO submissions
                (cusip, isin, ticker, name, asset_class, vendor_ref, status, submitted_at, security_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                security.get("cusip"),
                security.get("isin"),
                security.get("ticker"),
                security.get("name"),
                security.get("asset_class"),
                result.get("vendor_ref"),
                result.get("status"),
                result.get("submitted_at"),
                json.dumps(security),
            ),
        )
        conn.commit()
        return cursor.lastrowid


def get_submissions() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id as submission_id, cusip, isin, ticker, name,
                   asset_class, vendor_ref, status, submitted_at
            FROM submissions
            ORDER BY submitted_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]
