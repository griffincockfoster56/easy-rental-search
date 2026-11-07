import { extractListing } from "./extract.js";
import { textSearches, imageSearches, mapLink } from "./tools.js";
import { deepSearch } from "./ai.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const show = (id, on = true) => $(id).classList.toggle("hidden", !on);

let listing = null;
let settings = { apiKey: "", model: "claude-opus-5-5" };
let controller = null;
let currentTabId = null;

// ---------------- settings ----------------
async function loadSettings() {
  const s = await chrome.storage.local.get(["apiKey", "model"]);
  settings = { apiKey: s.apiKey || "", model: s.model || "claude-opus-5-5" };
  $("apiKey").value = settings.apiKey;
  $("model").value = settings.model;
  updateDeepHint();
}
$("settingsBtn").onclick = () => $("settings").classList.toggle("hidden");
$("saveSettings").onclick = async () => {
  settings.apiKey = $("apiKey").value.trim();
  settings.model = $("model").value;
  await chrome.storage.local.set(settings);
  show("savedMsg");
  setTimeout(() => {
    show("savedMsg", false);
    show("settings", false);
  }, 900);
  updateDeepHint();
};
function updateDeepHint() {
  $("deepHint").innerHTML = settings.apiKey
    ? "AI agent reads the photos + details and searches the web for the property's own site."
    : 'AI Deep Search needs your Anthropic API key — <a href="#" id="addKey">add it in settings</a>. The free tools below work without one.';
  const a = document.getElementById("addKey");
  if (a) a.onclick = (e) => { e.preventDefault(); show("settings"); $("apiKey").focus(); };
}

// ---------------- listing extraction ----------------
async function readTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractListing });
  return result;
}

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTabId = tab.id;
  let data = null;
  try {
    data = await readTab(tab.id);
    // Listing pages hydrate late; give them a moment if they look empty.
    for (let i = 0; i < 4 && data && (!data.title || data.photos.length < 3); i++) {
      await new Promise((r) => setTimeout(r, 1200));
      if (tab.id !== currentTabId) return;
      data = await readTab(tab.id);
    }
  } catch (_) {
    data = null; // page we don't have access to (chrome://, unsupported site)
  }
  show("loading", false);
  const looksLikeListing = data && data.title && (data.photos.length || data.description);
  if (!looksLikeListing) {
    listing = null;
    show("listing", false);
    show("empty");
    return;
  }
  if (listing && listing.url === data.url) return;
  listing = data;
  show("empty", false);
  renderListing();
  const saved = (await chrome.storage.session.get(listing.url))[listing.url];
  if (saved) renderResults(saved);
}

function renderListing() {
  const l = listing;
  show("listing");
  $("heroImg").src = l.photos[0] || "icons/icon128.png";
  $("photoCount").textContent = `${l.photos.length} photos`;
  $("siteBadge").textContent = l.site;
  $("lTitle").textContent = l.title;
  $("lSub").textContent = [l.subtitle, l.address].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const chips = [];
  (l.facts || []).slice(0, 4).forEach((f) => chips.push(esc(f)));
  if (l.hostName) chips.push(`Host: <b>${esc(l.hostName)}</b>`);
  if (l.checkIn) chips.push(`📅 ${esc(l.checkIn)} → ${esc(l.checkOut)}`);
  if (l.total || l.price) chips.push(`<b>${esc(l.total || l.price)}</b>`);
  $("lMeta").innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join("");

  // reverse image search grid
  $("photoGrid").innerHTML = l.photos
    .slice(0, 12)
    .map((p, i) => `<button data-i="${i}" title="Search this photo"><img src="${esc(p)}" loading="lazy" alt=""></button>`)
    .join("");
  show("engineMenu", false);
  $("photoGrid").querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      const active = b.classList.contains("active");
      $("photoGrid").querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      if (active) return show("engineMenu", false);
      b.classList.add("active");
      const engines = imageSearches(l.photos[+b.dataset.i]);
      $("engineMenu").innerHTML = engines.map((e) => `<a href="${esc(e.url)}" target="_blank" rel="noopener">🔍 ${esc(e.label)}</a>`).join("");
      show("engineMenu");
    };
  });

  const searches = textSearches(l);
  const map = mapLink(l);
  $("textSearches").innerHTML =
    searches
      .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">🌐 <span><span class="lb">${esc(s.label)}</span><span class="q">${esc(s.q)}</span></span></a>`)
      .join("") + (map ? `<a href="${esc(map)}" target="_blank" rel="noopener">📍 <span><span class="lb">See the area on Google Maps</span><span class="q">Spot the house, then search its street</span></span></a>` : "");

  show("progress", false);
  show("results", false);
  $("deepBtn").disabled = false;
}

// ---------------- deep search ----------------
$("deepBtn").onclick = async () => {
  if (!settings.apiKey) {
    show("settings");
    $("apiKey").focus();
    return;
  }
  const l = listing;
  controller = new AbortController();
  $("deepBtn").disabled = true;
  show("results", false);
  show("progress");
  $("steps").innerHTML = "";
  addStep("👀", `Studying ${Math.min(l.photos.length, 8)} photos and the listing details`);
  try {
    const out = await deepSearch({
      listing: l,
      apiKey: settings.apiKey,
      model: settings.model,
      signal: controller.signal,
      onStep: (s) => addStep(s.kind === "search" ? "🔎" : "📄", s.kind === "search" ? s.text : prettyUrl(s.text)),
    });
    await chrome.storage.session.set({ [l.url]: out });
    if (listing && listing.url === l.url) renderResults(out);
  } catch (err) {
    if (listing && listing.url === l.url) {
      show("results");
      $("results").innerHTML = `<div class="error">${esc(err.name === "AbortError" || /abort/i.test(err.message) ? "Search cancelled." : friendlyError(err))}</div>`;
    }
  } finally {
    show("progress", false);
    $("deepBtn").disabled = false;
    controller = null;
  }
};
$("cancelBtn").onclick = () => controller && controller.abort();

function addStep(k, t) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="k">${k}</span><span class="t" title="${esc(t)}">${esc(t)}</span>`;
  $("steps").appendChild(li);
  $("steps").scrollTop = $("steps").scrollHeight;
}
const prettyUrl = (u) => { try { const x = new URL(u); return "Reading " + x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/$/, ""); } catch (_) { return u; } };
function friendlyError(err) {
  const m = String(err.message || err);
  if (/401|authentication|invalid x-api-key/i.test(m)) return "Your Anthropic API key was rejected. Check it in settings.";
  if (/429|rate/i.test(m)) return "Rate limited by the API. Wait a minute and try again.";
  if (/credit|billing/i.test(m)) return "Your Anthropic account is out of credits.";
  return "Something went wrong: " + m.slice(0, 300);
}

function renderResults(out) {
  const r = out.result || {};
  const v = ["found", "possible", "not_found"].includes(r.verdict) ? r.verdict : "not_found";
  const head = {
    found: ["🎉", "Found its own website!"],
    possible: ["🤔", "Possible match"],
    not_found: ["🫥", "No direct site found"],
  }[v];
  let html = `<div class="verdict ${v}"><div class="emoji">${head[0]}</div><div><h2>${head[1]}</h2><p>${esc(r.summary || "")}</p></div></div>`;

  for (const m of r.matches || []) {
    const c = Math.max(0, Math.min(100, +m.confidence || 0));
    const cls = c >= 75 ? "" : c >= 45 ? "mid" : "low";
    const kind = { owner_site: "Owner's site", property_manager: "Property manager", direct_booking_platform: "Direct booking site", other: "Other" }[m.kind] || "";
    html += `<div class="card match">
      <div class="m-head"><div class="m-name">${esc(m.name || "Website")}</div><span class="conf ${cls}">${c}% match</span></div>
      <div class="m-url">${esc(kind)}${kind ? " · " : ""}${esc(m.url)}</div>
      <div class="bar"><i style="width:${c}%"></i></div>
      ${m.evidence?.length ? `<ul class="evidence">${m.evidence.slice(0, 5).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      ${m.price_note ? `<div class="price-note">💵 ${esc(m.price_note)}</div>` : ""}
      <a class="btn primary small" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">Open site →</a>
    </div>`;
  }
  if ((r.matches || []).length && listing) {
    const total = parseFloat(String(listing.total || "").replace(/[^\d.]/g, ""));
    html += `<div class="card savings">💡 ${listing.site} typically adds a guest service fee of around 14%${total ? ` — on ${esc(listing.total)}, that's roughly <b>$${Math.round(total * 0.14).toLocaleString()}</b>` : ""}. Booking direct usually skips it. Compare the final price before you book.</div>`;
  }
  if (r.leads?.length) html += `<div class="card"><h3>Leads</h3><ul class="evidence">${r.leads.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  if (out.cost != null) html += `<div class="cost muted">${out.searches || 0} web searches · ≈ $${out.cost.toFixed(2)} in API usage</div>`;
  $("results").innerHTML = html;
  show("results");
}
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "#");

// ---------------- wiring ----------------
chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && (info.status === "complete" || info.url)) refresh();
});
loadSettings();
refresh();
