const BACKEND = "http://localhost:8000/items";

// ── Setup ─────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "save-page",      title: "Save page to Stash",      contexts: ["page", "frame"] });
  chrome.contextMenus.create({ id: "save-selection", title: "Save selection to Stash", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "save-link",      title: "Save link to Stash",      contexts: ["link"] });
});

// ── Page extraction (runs inside the page) ────────────────────────────────────

function extractPageData() {
  const selection = window.getSelection()?.toString() ?? "";
  return {
    url: location.href,
    title: document.title,
    selection,
    excerpt: (selection || document.body?.innerText || "").slice(0, 5000),
  };
}

// ── Toast (runs inside the page) ──────────────────────────────────────────────

function showToast(opts) {
  // opts = { state: "saving" | "saved" | "error", title?: string }
  const ID = "__stash_toast__";
  let el = document.getElementById(ID);
  const isNew = !el;

  if (isNew) {
    el = document.createElement("div");
    el.id = ID;
    el.style.cssText = [
      "position:fixed", "top:20px", "right:-320px", "z-index:2147483647",
      "display:flex", "align-items:center", "gap:9px",
      "padding:11px 16px", "border-radius:12px",
      "font:500 13px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif",
      "letter-spacing:.01em", "white-space:nowrap", "max-width:300px",
      "box-shadow:0 8px 28px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.14)",
      "pointer-events:none",
      "transition:right .32s cubic-bezier(.34,1.4,.64,1),opacity .3s ease,background .2s ease",
    ].join(";");
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.right = "20px"; }));
  }

  const { state, title = "" } = opts;
  const truncated = title.length > 38 ? title.slice(0, 38) + "…" : title;

  el.style.background = state === "error" ? "#b91c1c" : "#1a1a1a";
  el.style.color = "#fff";

  if (state === "saving") {
    el.innerHTML = `<span style="opacity:.7;font-size:14px">📥</span><span>Saving…</span>`;
  } else if (state === "saved") {
    el.innerHTML = `<span style="font-size:14px">✓</span><span>${truncated ? `Saved · <span style="opacity:.65">${truncated}</span>` : "Saved to Stash"}</span>`;
    _dismissToast(el, 2200);
  } else {
    el.innerHTML = `<span style="font-size:14px">✗</span><span>Stash — is the backend running?</span>`;
    _dismissToast(el, 3000);
  }
}

function _dismissToast(el, delay) {
  setTimeout(() => {
    el.style.right = "-320px";
    el.style.opacity = "0";
  }, delay);
  setTimeout(() => el?.remove(), delay + 380);
}

// ── Core save flow ────────────────────────────────────────────────────────────

async function savePage(tabId, overrides = {}) {
  // Immediate feedback.
  chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: [{ state: "saving" }] }).catch(() => {});

  // Extract page content.
  let data;
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageData });
    data = { ...result, ...overrides };
  } catch {
    const tab = await chrome.tabs.get(tabId);
    data = { url: tab.url ?? "", title: tab.title ?? "", selection: "", excerpt: "", ...overrides };
  }

  // Send to backend.
  let ok = false;
  try {
    const res = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    ok = res.ok;
  } catch {}

  // Update toast.
  chrome.scripting.executeScript({
    target: { tabId },
    func: showToast,
    args: [{ state: ok ? "saved" : "error", title: data.title }],
  }).catch(() => {});
}

// ── Triggers ──────────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) savePage(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "save-page" && tab.id) savePage(tab.id);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "save-link") {
    savePage(tab.id, { url: info.linkUrl ?? "", title: info.linkUrl ?? "", selection: "", excerpt: "" });
  } else if (info.menuItemId === "save-selection") {
    savePage(tab.id, { selection: info.selectionText ?? "" });
  } else {
    savePage(tab.id);
  }
});
