let currentSecurity = null;

// ── Helpers ──────────────────────────────────────────────

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span>${label}` : label;
}

function formatKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Bond / Equity field ordering ─────────────────────────

const BOND_FIELDS = [
  "ticker", "exchange", "bond_type", "maturity_date", "coupon_rate",
  "yield_to_maturity", "face_value", "credit_rating", "payment_frequency",
  "day_count", "currency", "isin", "figi",
];

const EQUITY_FIELDS = [
  "ticker", "exchange", "sector", "market_cap_category", "dividend_yield",
  "shares_outstanding", "lot_size", "currency", "isin", "figi",
];

const SKIP_FIELDS = new Set([
  "name", "cusip", "asset_class", "security_type", "security_type2", "market_sector",
]);

// ── CUSIP Lookup ──────────────────────────────────────────

function setAndLookup(cusip) {
  document.getElementById("cusip-input").value = cusip;
  lookupCusip();
}

async function lookupCusip() {
  const cusip = document.getElementById("cusip-input").value.trim().toUpperCase();
  const errEl = document.getElementById("lookup-error");
  errEl.style.display = "none";
  document.getElementById("detail-card").style.display = "none";
  document.getElementById("submit-result").style.display = "none";
  currentSecurity = null;

  if (cusip.length !== 9) {
    errEl.textContent = "Please enter a valid 9-character CUSIP.";
    errEl.style.display = "block";
    return;
  }

  setLoading("lookup-btn", true, "Looking up…");

  try {
    const res = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cusip }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || "Lookup failed.";
      errEl.style.display = "block";
      return;
    }

    currentSecurity = data;
    renderDetail(data);
  } catch (e) {
    errEl.textContent = "Network error — is the server running?";
    errEl.style.display = "block";
  } finally {
    setLoading("lookup-btn", false, "Look Up");
  }
}

function renderDetail(sec) {
  document.getElementById("sec-name").textContent = sec.name || "Unknown Security";
  document.getElementById("sec-meta").textContent =
    `CUSIP: ${sec.cusip}  ·  ISIN: ${sec.isin || "—"}`;

  const badge = document.getElementById("asset-badge");
  badge.textContent = sec.asset_class;
  badge.className = `asset-badge badge-${sec.asset_class.toLowerCase()}`;

  const grid = document.getElementById("fields-grid");
  grid.innerHTML = "";

  const ordered = sec.asset_class === "BOND" ? BOND_FIELDS : EQUITY_FIELDS;
  const shown = new Set();

  for (const key of ordered) {
    if (SKIP_FIELDS.has(key) || !(key in sec)) continue;
    addField(grid, key, sec[key]);
    shown.add(key);
  }
  // Any remaining fields not in the ordered list
  for (const [key, val] of Object.entries(sec)) {
    if (shown.has(key) || SKIP_FIELDS.has(key)) continue;
    addField(grid, key, val);
  }

  document.getElementById("detail-card").style.display = "block";
  document.getElementById("submit-btn").disabled = false;
}

function addField(grid, key, value) {
  const div = document.createElement("div");
  div.className = "field-item";
  div.innerHTML = `
    <span class="field-label">${formatKey(key)}</span>
    <span class="field-value">${value ?? "—"}</span>
  `;
  grid.appendChild(div);
}

// ── Vendor Submission ─────────────────────────────────────

async function submitSecurity() {
  if (!currentSecurity) return;

  setLoading("submit-btn", true, "Submitting…");
  document.getElementById("submit-result").style.display = "none";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ security: currentSecurity }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || "Submission failed.", "error");
      return;
    }

    const resultEl = document.getElementById("submit-result");
    resultEl.innerHTML = `
      <div class="result-title">&#10003; Successfully submitted to Phase 3 Securities</div>
      <div class="result-ref">Reference: ${data.vendor_ref} &nbsp;·&nbsp; ${new Date(data.submitted_at).toLocaleString()}</div>
    `;
    resultEl.style.display = "block";

    document.getElementById("submit-btn").disabled = true;
    toast(`${currentSecurity.cusip} submitted — Ref: ${data.vendor_ref}`);
    loadHistory();
  } catch (e) {
    toast("Network error during submission.", "error");
  } finally {
    setLoading("submit-btn", false, "Submit to Phase 3 Securities");
  }
}

// ── Submission History ────────────────────────────────────

async function loadHistory() {
  try {
    const res = await fetch("/api/submissions");
    const rows = await res.json();
    renderHistory(rows);
  } catch (e) {
    // silent fail — history is non-critical
  }
}

function renderHistory(rows) {
  const container = document.getElementById("history-body");

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No submissions yet. Look up a CUSIP and submit to get started.</div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>CUSIP</th>
        <th>ISIN</th>
        <th>Ticker</th>
        <th>Name</th>
        <th>Type</th>
        <th>Status</th>
        <th>Submitted</th>
        <th>Vendor Ref</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const dt = row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—";
    tr.innerHTML = `
      <td>${row.submission_id}</td>
      <td class="mono">${row.cusip}</td>
      <td class="mono">${row.isin || "—"}</td>
      <td><strong>${row.ticker || "—"}</strong></td>
      <td>${row.name || "—"}</td>
      <td><span class="asset-badge badge-${(row.asset_class || "").toLowerCase()}" style="font-size:.72rem;padding:.15rem .6rem;">${row.asset_class || "—"}</span></td>
      <td><span class="status-pill status-${row.status}">${row.status}</span></td>
      <td>${dt}</td>
      <td class="mono">${row.vendor_ref || "—"}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

function exportCsv() {
  window.location.href = "/api/export";
}

// ── Init ──────────────────────────────────────────────────

document.getElementById("cusip-input").addEventListener("keydown", e => {
  if (e.key === "Enter") lookupCusip();
});

loadHistory();
