/* ============================================================
   aePeach Cart — APP LOGIC
   Fetches the Google Sheet tabs listed in config.js, parses them,
   and powers the search + dashboard. No build step needed.
   ============================================================ */

let ALL_ORDERS = [];
let LAST_MATCHES = [];

const els = {
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchMeta: document.getElementById("searchMeta"),
  recentSearches: document.getElementById("recentSearches"),
  recentChips: document.getElementById("recentChips"),
  clearRecent: document.getElementById("clearRecent"),
  announcements: document.getElementById("announcements"),
  filterRow: document.getElementById("filterRow"),
  statusFilter: document.getElementById("statusFilter"),
  dashboard: document.getElementById("dashboard"),
  results: document.getElementById("results"),
  syncStatus: document.getElementById("syncStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
  statTotal: document.getElementById("statTotal"),
  statSecured: document.getElementById("statSecured"),
  statTransit: document.getElementById("statTransit"),
  statPostage: document.getElementById("statPostage"),
  statComplete: document.getElementById("statComplete"),
  statCancel: document.getElementById("statCancel"),
  themeToggle: document.getElementById("themeToggle"),
};

/* ---------------- Dark mode ---------------- */
// The <head> script already applies a saved/system theme before first
// paint (see index.html) — this just wires up the toggle button.
const THEME_KEY = "aepeach-theme";
function setThemeButtonLabel(theme) {
  els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  els.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}
setThemeButtonLabel(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
els.themeToggle.addEventListener("click", () => {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  setThemeButtonLabel(next);
});

/* ---------------- Logo fallback ---------------- */
const logoImg = document.getElementById("logoImg");
if (logoImg) {
  logoImg.addEventListener("error", () => {
    const fallback = document.createElement("div");
    fallback.className = "hero__logo hero__logo--fallback";
    fallback.textContent = "🍑";
    logoImg.replaceWith(fallback);
  });
}

/* ---------------- Announcement boxes ---------------- */
// Reads CONFIG.announcements (from config.js) and builds one box per
// entry. Add, remove, or edit entries in config.js — not here.
// Colors cycle through 4 flat tones defined in style.css.
const announcementsContainer = document.getElementById("announcements");
(CONFIG.announcements || []).forEach((item, i) => {
  const box = document.createElement("div");
  box.className = `announcement-box announcement-box--c${(i % 4) + 1}`;

  const emoji = document.createElement("span");
  emoji.className = "announcement-box__emoji";
  emoji.textContent = item.emoji || "";

  const text = document.createElement("p");
  text.className = "announcement-box__text";
  text.textContent = item.text || "";

  box.append(emoji, text);
  announcementsContainer.appendChild(box);
});

/* ---------------- Recent searches ---------------- */
// Stored in the visitor's own browser (localStorage) so their last
// few searched usernames are one click away next time.
const RECENT_KEY = "aepeach-recent-searches";
const MAX_RECENT = 6;

function getRecentSearches() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(username) {
  let list = getRecentSearches().filter((u) => u !== username);
  list.unshift(username);
  list = list.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  renderRecentSearches();
}

function renderRecentSearches() {
  const list = getRecentSearches();
  els.recentSearches.hidden = list.length === 0;
  els.recentChips.innerHTML = list
    .map(
      (u) =>
        `<button type="button" class="recent-chip" data-username="${escapeHtml(
          u
        )}">@${escapeHtml(u)}</button>`
    )
    .join("");
}

els.recentChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".recent-chip");
  if (!btn) return;
  const username = btn.dataset.username;
  els.searchInput.value = username;
  doSearch(username);
});

els.clearRecent.addEventListener("click", () => {
  localStorage.removeItem(RECENT_KEY);
  renderRecentSearches();
});

renderRecentSearches();

// Smoothly hides the logo and announcement boxes while a search is
// active, so the results have more room. Queries the logo live since
// it may have been swapped for the fallback emoji div (see error
// listener below).
function setHeroCollapsed(collapsed) {
  const logo = document.querySelector(".hero__logo");
  if (logo) logo.classList.toggle("is-collapsed", collapsed);
  if (els.announcements) els.announcements.classList.toggle("is-collapsed", collapsed);
}

// Handles quoted fields containing commas/newlines, per RFC4180-ish CSV
// (this is what Google's gviz CSV export produces).
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\r") {
        // skip
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }
  // last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---------------- Column detection ---------------- */
// Finds the header row (the row containing "TAG") and maps the columns
// we care about by matching header text, so the site keeps working even
// if you insert/reorder columns in the sheet later.
function findHeaderAndMap(rows) {
  const wanted = {
    tag: ["tag"],
    username: ["username"],
    item: ["item name", "item"],
    qty: ["qty", "quantity"],
    ems: ["ems"],
    price: ["price"],
    payment: ["payment"],
    status: ["status"],
  };

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map((c) => (c || "").trim().toLowerCase());
    const hasTag = cells.some((c) => c === "tag");
    const hasUsername = cells.some((c) => c.startsWith("username"));
    if (hasTag && hasUsername) {
      const colMap = {};
      for (const key in wanted) {
        const idx = cells.findIndex((c) =>
          wanted[key].some((w) => c === w || c.startsWith(w))
        );
        colMap[key] = idx;
      }
      return { headerRow: r, colMap };
    }
  }
  return null;
}

/* ---------------- Status normalization ---------------- */
// Groups whatever text is in the STATUS column into the 5 tracked
// categories the dashboard shows. Falls back to "Other" so nothing
// from your sheet silently disappears.
function normalizeStatus(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("cancel")) return "Cancel";
  if (s.includes("complete") || s.includes("done") || s.includes("collected"))
    return "Complete";
  if (s.includes("transit") || s.includes("ship")) return "In Transit";
  if (s.includes("postage") || s.includes("ready")) return "Ready for Postage";
  if (s.includes("secure") || s.includes("paid") || s.includes("confirm"))
    return "Secured";
  return "Other";
}

const STATUS_META = {
  Secured: { emoji: "🌱", cls: "secured" },
  "In Transit": { emoji: "🚚", cls: "transit" },
  "Ready for Postage": { emoji: "📦", cls: "postage" },
  Complete: { emoji: "🍑", cls: "complete" },
  Cancel: { emoji: "❌", cls: "cancel" },
  Other: { emoji: "✨", cls: "other" },
  Unknown: { emoji: "❔", cls: "other" },
};

const STAGE_ORDER = ["Secured", "In Transit", "Ready for Postage", "Complete"];

/* ---------------- Fetching ---------------- */
function tabUrl(sheetId, tabName) {
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=` +
    encodeURIComponent(tabName)
  );
}

async function fetchTab(sheetId, tabName) {
  const res = await fetch(tabUrl(sheetId, tabName), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load tab "${tabName}" (HTTP ${res.status})`);
  }
  const text = await res.text();
  const rows = parseCSV(text);
  const found = findHeaderAndMap(rows);
  if (!found) {
    console.warn(`Tab "${tabName}": couldn't find a TAG/USERNAME header row.`);
    return [];
  }
  const { headerRow, colMap } = found;
  const orders = [];

  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (key) =>
      colMap[key] > -1 ? (cells[colMap[key]] || "").trim() : "";

    const tag = get("tag");
    const username = get("username");
    const item = get("item");

    // Stop treating rows as data once we hit a fully blank row group,
    // but keep scanning a little in case of stray blank rows.
    if (!tag && !username && !item) continue;

    orders.push({
      batch: tabName,
      tag,
      username,
      item,
      qty: get("qty"),
      ems: get("ems"),
      price: get("price"),
      payment: get("payment"),
      statusRaw: get("status"),
      status: normalizeStatus(get("status")),
    });
  }
  return orders;
}

async function loadAllOrders() {
  els.syncStatus.textContent = "Connecting to masterlist…";
  els.refreshBtn.disabled = true;
  try {
    const results = await Promise.all(
      CONFIG.tabs.map((tab) =>
        fetchTab(CONFIG.sheetId, tab).catch((err) => {
          console.error(err);
          return [];
        })
      )
    );
    ALL_ORDERS = results.flat();
    const now = new Date();
    els.syncStatus.textContent = `Synced with masterlist · ${now.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )} · ${ALL_ORDERS.length} order lines loaded`;
  } catch (err) {
    console.error(err);
    els.syncStatus.textContent =
      "⚠️ Couldn't load the masterlist right now. Please refresh, or check back shortly.";
  } finally {
    els.refreshBtn.disabled = false;
  }
}

/* ---------------- Search + rendering ---------------- */
function normalizeUsername(u) {
  return (u || "").trim().toLowerCase().replace(/^@/, "");
}

function renderStepper(status) {
  if (status === "Cancel") {
    return `<div class="stepper stepper--cancelled">
      <span class="stepper__wilted">❌ Order cancelled</span>
    </div>`;
  }
  const currentIdx = STAGE_ORDER.indexOf(status);
  return `<div class="stepper">
    ${STAGE_ORDER.map((stage, i) => {
      const meta = STATUS_META[stage];
      const state =
        currentIdx === -1
          ? "pending"
          : i < currentIdx
          ? "done"
          : i === currentIdx
          ? "current"
          : "pending";
      return `<div class="stepper__step stepper__step--${state}">
        <span class="stepper__dot">${meta.emoji}</span>
        <span class="stepper__label">${stage}</span>
      </div>`;
    }).join('<span class="stepper__line" aria-hidden="true"></span>')}
  </div>`;
}

function renderResults(orders) {
  if (orders.length === 0) {
    const filterActive = els.statusFilter.value !== "all";
    els.results.innerHTML = filterActive
      ? `
      <div class="empty-state">
        <span class="empty-state__emoji">🍑</span>
        <p>No orders match "${escapeHtml(els.statusFilter.value)}" right now.</p>
        <p class="muted">Try a different status, or select "All Statuses" to see everything.</p>
      </div>`
      : `
      <div class="empty-state">
        <span class="empty-state__emoji">🍑</span>
        <p>No orders found under that username yet.</p>
        <p class="muted">Double-check the spelling, or message us if you think this is a mistake.</p>
      </div>`;
    playFadeIn(els.results);
    return;
  }

  const byTag = {};
  orders.forEach((o) => {
    const key = o.tag || "No Tag";
    (byTag[key] = byTag[key] || []).push(o);
  });

  els.results.innerHTML = Object.entries(byTag)
    .map(([tag, group]) => {
      const rowsHtml = group
        .map((o) => {
          const meta = STATUS_META[o.status];
          return `
          <div class="order-row">
            <div class="order-row__main">
              <span class="order-row__tag">${escapeHtml(o.tag || "—")}</span>
              <span class="order-row__item">${escapeHtml(o.item || "—")}</span>
              <span class="order-row__qty">Qty: ${escapeHtml(o.qty || "—")}</span>
              <span class="order-row__qty">EMS: ${escapeHtml(o.ems || "—")}</span>
              <span class="badge badge--${meta.cls}">${meta.emoji} ${escapeHtml(
            o.status
          )}</span>
            </div>
            ${renderStepper(o.status)}
          </div>`;
        })
        .join("");

      return `
        <div class="order-group card">
          <div class="order-group__header">
            <span class="order-group__tag">Batch tag ${escapeHtml(tag)}</span>
            <span class="order-group__batch">${escapeHtml(group[0].batch)}</span>
          </div>
          ${rowsHtml}
        </div>`;
    })
    .join("");
  playFadeIn(els.results);
}

function renderDashboard(orders) {
  const counts = {
    Secured: 0,
    "In Transit": 0,
    "Ready for Postage": 0,
    Complete: 0,
    Cancel: 0,
  };
  orders.forEach((o) => {
    if (counts[o.status] !== undefined) counts[o.status]++;
  });

  els.statTotal.textContent = orders.length;
  els.statSecured.textContent = counts.Secured;
  els.statTransit.textContent = counts["In Transit"];
  els.statPostage.textContent = counts["Ready for Postage"];
  els.statComplete.textContent = counts.Complete;
  els.statCancel.textContent = counts.Cancel;

  els.dashboard.hidden = false;
  playFadeIn(els.dashboard);
}

// Re-triggers a CSS fade-in animation on an element (removing then
// re-adding the class forces the browser to replay it).
function playFadeIn(el) {
  el.classList.remove("fade-in");
  void el.offsetWidth;
  el.classList.add("fade-in");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function doSearch(rawInput) {
  const query = normalizeUsername(rawInput);
  if (!query) {
    els.searchMeta.hidden = true;
    els.filterRow.hidden = true;
    els.dashboard.hidden = true;
    els.results.innerHTML = "";
    LAST_MATCHES = [];
    setHeroCollapsed(false);
    return;
  }

  const matches = ALL_ORDERS.filter(
    (o) => normalizeUsername(o.username) === query
  );
  LAST_MATCHES = matches;

  els.searchMeta.hidden = false;
  els.searchMeta.textContent = `Showing results for @${query}`;
  els.filterRow.hidden = matches.length === 0;
  els.statusFilter.value = "all";

  setHeroCollapsed(true);
  saveRecentSearch(query);
  renderDashboard(matches);
  applyStatusFilter();

  // Give the browser a moment to lay out the newly shown dashboard
  // before smooth-scrolling to it.
  requestAnimationFrame(() => {
    els.dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Applies the "Filter by status" dropdown to the last search's matches.
// The dashboard totals above always reflect ALL of the customer's
// orders — the filter only narrows which order cards are listed below.
function applyStatusFilter() {
  const val = els.statusFilter.value;
  const filtered =
    val === "all" ? LAST_MATCHES : LAST_MATCHES.filter((o) => o.status === val);
  renderResults(filtered);
}

els.statusFilter.addEventListener("change", applyStatusFilter);

els.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  doSearch(els.searchInput.value);
});

els.refreshBtn.addEventListener("click", async () => {
  await loadAllOrders();
  if (els.searchInput.value.trim()) {
    doSearch(els.searchInput.value);
  }
});

/* ---------------- Init ---------------- */
loadAllOrders();
