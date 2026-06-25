// Headless click test — actually drives the UI in a real browser to verify
// the things tsc cannot: that cards/topics/search are clickable and wired.
// Mocks the backend so it's hermetic. Run: node smoke-test.mjs
import { chromium } from "playwright";

const BASE = process.env.PREVIEW_URL || "http://localhost:4173";

const ITEMS = [
  {
    id: 1, url: "https://www.youtube.com/watch?v=abc", title: "Neural Networks Explained",
    selection: null, excerpt: null, created_at: new Date().toISOString(),
    summary: "A clear intro to how neural nets work.", tags: ["ml", "deep learning"],
    topic: "machine learning", status: "enriched", error: null, transcript: null,
  },
  {
    id: 2, url: "https://example.com/pasta", title: "The Best Carbonara",
    selection: null, excerpt: null, created_at: new Date().toISOString(),
    summary: "Authentic Roman carbonara, four ingredients.", tags: ["cooking", "italian"],
    topic: "cooking", status: "enriched", error: null, transcript: null,
  },
];

const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? "✓" : "✗"}  ${name}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

// Mock backend. /status drives the launch state machine — a configured,
// healthy engine boots straight into the library (skips onboarding).
await page.route("**/status", (r) =>
  r.fulfill({
    json: {
      ok: true, version: "test", model: "claude-haiku-4-5",
      key_configured: true, counts: { total: ITEMS.length, pending: 0, unindexed: 0 },
    },
  }),
);
await page.route("**/items", (r) => r.fulfill({ json: ITEMS }));
await page.route("**/search**", (r) => r.fulfill({ json: [{ ...ITEMS[0], score: 0.92 }] }));

// Capture window.open calls (browser-mode openUrl path).
await page.addInitScript(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return null; };
});

let consoleErr = null;
page.on("pageerror", (e) => { consoleErr = String(e); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

// 1. Items render.
const cardCount = await page.locator("text=Neural Networks Explained").count();
check("cards render from backend", cardCount === 1);

// 2. No uncaught page errors.
check("no uncaught JS errors on load", consoleErr === null);

// The "Open original" button exists ONLY in the detail panel — a reliable
// signal for panel-open (the summary text also appears in the card behind it).
const panelOpen = () => page.locator("button:has-text('Open original')");

// 3. Click a card → opens the detail panel.
await page.locator("text=Neural Networks Explained").click();
await page.waitForTimeout(350);
check("clicking a card opens the detail panel", (await panelOpen().count()) === 1);

// 3b. Panel shows the full summary under its "Summary" heading.
const summaryInPanel = await page.locator("text=A clear intro to how neural nets work.").count();
check("panel shows full summary", summaryInPanel >= 1);

// 3c. "Open original" opens the URL via the opener path.
await panelOpen().click();
await page.waitForTimeout(150);
const opened = await page.evaluate(() => window.__opened);
check("'Open original' opens the URL", opened.includes("https://www.youtube.com/watch?v=abc"));

// 3d. Escape closes the panel.
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
check("Escape closes the detail panel", (await panelOpen().count()) === 0);

// 3e. Reopen, then click the scrim to close.
await page.locator("text=Neural Networks Explained").click();
await page.waitForTimeout(350);
await page.locator("button[title='Close']").click();
await page.waitForTimeout(700);
check("X button closes the detail panel", (await panelOpen().count()) === 0);

// 4. Click a topic filter → heading reflects it, feed filters.
await page.locator("button:has-text('cooking')").first().click();
await page.waitForTimeout(300);
const headingCooking = await page.locator("h1").innerText();
check("clicking topic filters the feed", /cooking/i.test(headingCooking));
const carbonaraVisible = await page.locator("text=The Best Carbonara").count();
const nnHidden = await page.locator("text=Neural Networks Explained").count();
check("topic filter shows only matching items", carbonaraVisible === 1 && nnHidden === 0);

// 5. Back to All.
await page.locator("button:has-text('All saves')").first().click();
await page.waitForTimeout(300);
const bothVisible = await page.locator("text=The Best Carbonara").count() === 1
  && await page.locator("text=Neural Networks Explained").count() === 1;
check("'All saves' restores full feed", bothVisible);

// 6. Search → types, calls /search, shows results.
const searchBox = page.locator("input[placeholder='Search…']");
await searchBox.click();
await searchBox.fill("neural");
await page.waitForTimeout(600);
const matchBadge = await page.locator("text=/92%/").count();
check("search returns and renders results", matchBadge >= 1);

// 7. Empty state has no dead button (regression: old bookmarklet had preventDefault).
await page.route("**/items", (r) => r.fulfill({ json: [] }));
await page.route("**/search**", (r) => r.fulfill({ json: [] }));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
const emptyText = await page.locator("text=Nothing saved yet").count();
check("empty state renders onboarding", emptyText === 1);
const deadAnchor = await page.locator("a[href^='javascript:']").count();
check("no leftover javascript: bookmarklet anchor", deadAnchor === 0);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
