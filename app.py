import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file

from services.cusip_lookup import lookup_cusip, lookup_ticker
from services.enrichment import enrich_security
from services.vendor import submit_to_vendor
from db.database import init_db, save_submission, get_submissions, get_stats

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/lookup", methods=["POST"])
def lookup():
    data = request.get_json()
    query = (data.get("cusip") or data.get("query") or "").strip().upper()

    if not query:
        return jsonify({"error": "Enter a CUSIP (9 characters) or a ticker symbol."}), 400

    is_cusip = len(query) == 9

    if is_cusip:
        figi_data = lookup_cusip(query)
        cusip = query
        label = f"CUSIP {query}"
    else:
        figi_data = lookup_ticker(query)
        cusip = ""   # unknown from ticker search — user can fill in manually
        label = f"ticker {query}"

    if not figi_data:
        return jsonify({"error": f"No security found for {label}."}), 404

    enriched = enrich_security(cusip, figi_data)
    return jsonify(enriched)


@app.route("/api/submit", methods=["POST"])
def submit():
    security = (request.get_json() or {}).get("security")
    if not security:
        return jsonify({"error": "No security data provided."}), 400

    result = submit_to_vendor(security)
    result["submission_id"] = save_submission(security, result)
    return jsonify(result)


@app.route("/api/submissions", methods=["GET"])
def submissions():
    return jsonify(get_submissions())


@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify(get_stats())


@app.route("/api/export", methods=["GET"])
def export():
    rows = get_submissions()
    fields = ["submission_id", "cusip", "isin", "ticker", "name", "asset_class", "status", "submitted_at", "vendor_ref"]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    filename = f"submissions_{datetime.now().strftime('%Y%m%d')}.csv"
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
