// ── State ────────────────────────────────────────────────
let currentSecurity = null;   // raw data from last lookup
let originalSecurity = null;  // copy to allow reset
let allSubmissions = [];       // cached for filtering
let breakdownChart = null;

// ── Tabs ─────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = "block";

    if (btn.dataset.tab === "registry") loadRegistry();
    if (btn.dataset.tab === "dashboard") loadDashboard();
  });
});

// ── Helpers ──────────────────────────────────────────────

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.style.display = "block";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, 3500);
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span>${label}` : label;
}

function formatKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(isoStr) {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(isoStr).toLocaleDateString();
}

// ── Field ordering ───────────────────────────────────────

const BOND_FIELDS = [
  "ticker", "exchange", "bond_type", "maturity_date", "coupon_rate",
  "yield_to_maturity", "face_value", "credit_rating", "payment_frequency",
  "day_count", "currency",
];
const EQUITY_FIELDS = [
  "ticker", "exchange", "sector", "market_cap_category", "dividend_yield",
  "shares_outstanding", "lot_size", "currency",
];
const READONLY_FIELDS = new Set(["cusip", "isin", "figi", "asset_class", "security_type", "security_type2", "market_sector", "name"]);
const SKIP_FIELDS = new Set(["asset_class", "security_type", "security_type2", "market_sector"]);

// ── Lookup ───────────────────────────────────────────────

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
  originalSecurity = null;

  if (!cusip || cusip.length > 9) {
    errEl.textContent = "Enter a CUSIP (9 characters) or a ticker symbol (e.g. AAPL).";
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
    originalSecurity = { ...data };
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
  document.getElementById("sec-meta").textContent = sec.cusip
    ? `CUSIP: ${sec.cusip}  ·  ISIN: ${sec.isin || "—"}`
    : `Ticker: ${sec.ticker || "—"}  ·  FIGI: ${sec.figi || "—"}`;

  const badge = document.getElementById("asset-badge");
  badge.textContent = sec.asset_class;
  badge.className = `asset-badge badge-${sec.asset_class.toLowerCase()}`;

  const hint = document.getElementById("edit-hint");
  hint.textContent = sec.cusip
    ? "Fields are editable — review and correct before submitting. Identifiers (CUSIP, ISIN, FIGI) are locked."
    : "Looked up by ticker — CUSIP and ISIN are blank. Enter the CUSIP if known before submitting to Security Master.";

  renderFieldsGrid("fields-grid", sec, true);

  document.getElementById("detail-card").style.display = "block";
  document.getElementById("submit-btn").disabled = false;
}

function renderFieldsGrid(gridId, sec, editable = false) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = "";

  // always show name as read-only first
  addField(grid, "name", sec.name, false);

  const ordered = sec.asset_class === "BOND" ? BOND_FIELDS : EQUITY_FIELDS;
  const shown = new Set(["name"]);

  for (const key of ordered) {
    if (SKIP_FIELDS.has(key) || !(key in sec)) continue;
    const ro = !editable || READONLY_FIELDS.has(key);
    addField(grid, key, sec[key], !ro);
    shown.add(key);
  }
  // identifiers at the end
  for (const key of ["isin", "cusip", "figi"]) {
    if (key in sec) {
      addField(grid, key, sec[key], false);
      shown.add(key);
    }
  }
}

function addField(grid, key, value, isEditable) {
  const div = document.createElement("div");
  div.className = "field-item";

  if (isEditable) {
    div.innerHTML = `
      <label class="field-label" for="field-${key}">${formatKey(key)}</label>
      <input class="field-input" id="field-${key}" data-key="${key}" value="${(value ?? "").toString().replace(/"/g, "&quot;")}" />
    `;
  } else {
    const cls = ["cusip","isin","figi"].includes(key) ? "field-readonly mono" : "field-value";
    div.innerHTML = `
      <span class="field-label">${formatKey(key)}</span>
      <span class="${cls}">${value ?? "—"}</span>
    `;
  }
  grid.appendChild(div);
}

function resetFields() {
  if (!originalSecurity) return;
  currentSecurity = { ...originalSecurity };
  renderDetail(originalSecurity);
  document.getElementById("submit-result").style.display = "none";
  document.getElementById("submit-btn").disabled = false;
}

// ── Submit ───────────────────────────────────────────────

async function submitSecurity() {
  if (!currentSecurity) return;

  // collect edited values from inputs
  const edited = { ...currentSecurity };
  document.querySelectorAll("#fields-grid .field-input").forEach(input => {
    edited[input.dataset.key] = input.value;
  });

  setLoading("submit-btn", true, "Submitting…");
  document.getElementById("submit-result").style.display = "none";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ security: edited }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Submission failed.", "error"); return; }

    const resultEl = document.getElementById("submit-result");
    resultEl.innerHTML = `
      <div class="result-title">&#10003; Added to Security Master</div>
      <div class="result-ref">Reference: ${data.vendor_ref} &nbsp;·&nbsp; ${new Date(data.submitted_at).toLocaleString()}</div>
    `;
    resultEl.style.display = "block";
    document.getElementById("submit-btn").disabled = true;
    toast(`${edited.cusip} added to Security Master — ${data.vendor_ref}`);
  } catch (e) {
    toast("Network error during submission.", "error");
  } finally {
    setLoading("submit-btn", false, "Add to Security Master");
  }
}

// ── Registry tab ─────────────────────────────────────────

async function loadRegistry() {
  try {
    const res = await fetch("/api/submissions");
    allSubmissions = await res.json();
    renderRegistry(allSubmissions);
  } catch (e) { /* silent */ }
}

function filterRegistry() {
  const q = document.getElementById("search-input").value.toLowerCase();
  const cls = document.getElementById("class-filter").value;
  const filtered = allSubmissions.filter(r => {
    const matchClass = !cls || r.asset_class === cls;
    const matchSearch = !q || [r.cusip, r.ticker, r.name].some(v => (v||"").toLowerCase().includes(q));
    return matchClass && matchSearch;
  });
  renderRegistry(filtered);
}

function renderRegistry(rows) {
  const container = document.getElementById("registry-body");
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No securities match your filter.</div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead><tr>
      <th>#</th><th>CUSIP</th><th>ISIN</th><th>Ticker</th>
      <th>Name</th><th>Type</th><th>Status</th><th>Added</th><th>Ref</th><th></th>
    </tr></thead>
  `;
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.submission_id}</td>
      <td class="mono">${row.cusip}</td>
      <td class="mono">${row.isin || "—"}</td>
      <td><strong>${row.ticker || "—"}</strong></td>
      <td>${row.name || "—"}</td>
      <td><span class="asset-badge badge-${(row.asset_class||"").toLowerCase()}" style="font-size:.72rem;padding:.15rem .55rem;">${row.asset_class||"—"}</span></td>
      <td><span class="status-pill status-${row.status}">${row.status}</span></td>
      <td>${timeAgo(row.submitted_at)}</td>
      <td class="mono" style="font-size:.78rem;">${row.vendor_ref||"—"}</td>
      <td><button class="view-btn" onclick="openModal(${row.submission_id})">View</button></td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

function exportCsv() { window.location.href = "/api/export"; }

// ── Dashboard tab ─────────────────────────────────────────

async function loadDashboard() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    document.getElementById("stat-total").textContent    = data.total;
    document.getElementById("stat-bonds").textContent    = data.bonds;
    document.getElementById("stat-equities").textContent = data.equities;

    renderChart(data.bonds, data.equities);
    renderRecent(data.recent || []);
  } catch (e) { /* silent */ }
}

function renderChart(bonds, equities) {
  const canvas = document.getElementById("breakdown-chart");
  const emptyEl = document.getElementById("chart-empty");

  if (bonds === 0 && equities === 0) {
    canvas.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }
  canvas.style.display = "block";
  emptyEl.style.display = "none";

  if (breakdownChart) breakdownChart.destroy();

  breakdownChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Bonds", "Equities"],
      datasets: [{
        data: [bonds, equities],
        backgroundColor: ["#1d4ed8", "#059669"],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 20, font: { size: 13 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / (bonds + equities) * 100)}%)`,
          },
        },
      },
    },
  });
}

function renderRecent(recent) {
  const el = document.getElementById("recent-body");
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state">No recent activity.</div>`;
    return;
  }
  el.innerHTML = recent.map(r => `
    <div class="recent-item">
      <span class="asset-badge badge-${(r.asset_class||"").toLowerCase()}" style="font-size:.72rem;padding:.15rem .55rem;">${r.asset_class||"—"}</span>
      <span class="recent-ticker">${r.ticker || r.cusip}</span>
      <span class="recent-name">${r.name || "—"}</span>
      <span class="recent-time">${timeAgo(r.submitted_at)}</span>
    </div>
  `).join("");
}

// ── Detail Modal ──────────────────────────────────────────

async function openModal(submissionId) {
  // find in cached submissions first
  const row = allSubmissions.find(r => r.submission_id === submissionId);
  if (!row) return;

  // fetch full security data from API (submission row doesn't have all fields)
  // use what we have from the registry row to populate the modal header
  document.getElementById("modal-title").textContent = row.name || row.cusip;
  document.getElementById("modal-sub").textContent =
    `CUSIP: ${row.cusip}  ·  ISIN: ${row.isin || "—"}  ·  Ref: ${row.vendor_ref}`;

  // render the fields we do have
  const grid = document.getElementById("modal-fields");
  grid.innerHTML = "";

  const fields = [
    ["cusip", row.cusip], ["isin", row.isin], ["ticker", row.ticker],
    ["asset_class", row.asset_class], ["status", row.status],
    ["submitted_at", row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"],
    ["vendor_ref", row.vendor_ref],
  ];
  for (const [key, val] of fields) {
    addField(grid, key, val, false);
  }

  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal(e) {
  if (!e || e.target === document.getElementById("modal-overlay") || e.currentTarget.classList.contains("modal-close")) {
    document.getElementById("modal-overlay").style.display = "none";
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.getElementById("modal-overlay").style.display = "none";
});

// ── Init ──────────────────────────────────────────────────

document.getElementById("cusip-input").addEventListener("keydown", e => {
  if (e.key === "Enter") lookupCusip();
});
