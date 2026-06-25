# Stash

**Obsidian for your content.** Save anything from the web — articles, videos, links — and have it automatically organized, summarized, and searchable. One click. No friction.

---

## What it does

- **One-click save** from any browser — Chrome, Arc, Brave, Edge, Firefox, Safari
- **AI enrichment** — every save gets a summary, tags, and a topic label automatically (Claude Haiku)
- **YouTube transcripts** — saves the full spoken transcript, not page noise
- **Hybrid search** — keyword + semantic so you find things by meaning, not just exact words
- **Native desktop library** — a fast, clean Tauri app that lives in your dock

---

## Stack

| Layer | Tech |
|---|---|
| Capture | MV3 browser extension · Safari Web Extension |
| Backend | Python · FastAPI · SQLite |
| AI | Claude Haiku 4.5 · fastembed (local embeddings) |
| Search | SQLite FTS5 + cosine similarity hybrid |
| Desktop | Tauri · React · TypeScript · Tailwind CSS |

---

## Using Stash

Stash ships as a single desktop app — no terminal, no config files.

1. Launch **Stash**. The app starts its local engine automatically.
2. On first run you're asked for your **Anthropic API key** ([get one here](https://console.anthropic.com/settings/keys)).
3. The key is verified, then stored in your **OS keychain** — it never leaves your device except to call Anthropic. You only pay Anthropic for what you use; there's no Stash subscription.
4. Install the browser extension and start saving.

You can replace or remove your key any time from **Settings**, along with re-running enrichment and rebuilding the search index.

---

## Development setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For local dev you can put a key in `backend/.env` (gitignored) so the engine is pre-configured:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Otherwise, just launch the desktop app and enter the key in the onboarding screen — it's pushed to the backend at runtime via `POST /config/api-key`.

Run it directly during development:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Browser extension

**Chrome / Arc / Brave / Edge / Firefox:**

1. Go to your browser's extensions page (`chrome://extensions` or `about:debugging`)
2. Enable Developer mode
3. Load unpacked → select the `extension/` folder
4. Click the Stash icon on any page, or press `Cmd+Shift+S`

**Safari:**

1. Open `Stash/Stash.xcodeproj` in Xcode
2. Run the `Stash (macOS)` scheme (`Cmd+R`)
3. Safari → Settings → Extensions → enable Stash
4. Click the toolbar icon or press `Cmd+Shift+S`

### 3. Desktop app

Requires [Rust](https://rustup.rs).

```bash
cd desktop
npm install
npm run tauri:dev   # native desktop app
# or: npm run dev   # browser preview at localhost:5173
```

### Building a shippable app

The Python backend is bundled into the app as a Tauri **sidecar** so end users never run `uvicorn` themselves. Build the sidecar binary, then the app:

```bash
cd desktop
npm run build:backend   # PyInstaller → src-tauri/binaries/stash-backend-<target-triple>
npm run tauri:build     # produces the distributable .app / installer
```

`tauri:build` runs `build:backend` automatically. At runtime the app spawns the sidecar, points its SQLite DB at the per-user app-data directory (`STASH_DATA_DIR`), and shuts it down on quit.

---

## Saving

Three ways to save anything, all instant:

| Action | Result |
|---|---|
| Click the toolbar icon | Saves the current page |
| `Cmd+Shift+S` | Saves from anywhere on the page |
| Right-click | Save page · Save selection · Save link |

A toast confirms each save. Claude enriches it in the background — no waiting at capture time.

---

## Search

Type anything in the desktop app search bar. It combines:

- **Keyword** (FTS5 full-text across titles, summaries, tags, transcripts)
- **Semantic** (local embeddings — finds related content without exact word matches)

To index existing saves: `POST http://localhost:8000/embed-pending`

---

## Project layout

```
stash/
  backend/     FastAPI + SQLite brain
  extension/   MV3 extension (Chrome, Arc, Brave, Edge, Firefox)
  Stash/       Safari Web Extension (Xcode)
  desktop/     Tauri + React library UI
```

---

## License

MIT
