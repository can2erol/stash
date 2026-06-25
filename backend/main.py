"""Stash — local backend.

Phase 1: the browser extension POSTs a saved page here; it's stored in SQLite.
Phase 2a: on save, Claude (Haiku) enriches each item with a summary, tags, and
a topic, in the background. The bare list now shows the enriched view.
"""

from __future__ import annotations

import json
import os
import sqlite3
import traceback
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import anthropic
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import embeddings as embeddings_mod
import enrichment
import transcript as transcript_mod

# The packaged sidecar stores its SQLite DB in a writable app-data dir passed by
# the desktop app; fall back to the source tree for local development.
DB_PATH = Path(os.getenv("STASH_DATA_DIR", Path(__file__).parent)) / "stash.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Stash", version="0.2.0")

# Local, single-user tool — allow the extension origin without friction.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                url        TEXT NOT NULL,
                title      TEXT,
                selection  TEXT,
                excerpt    TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        # Phase 2a/2c columns — added idempotently so existing DBs upgrade in place.
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(items)")}
        for col in ("summary", "tags", "topic", "status", "error", "transcript"):
            if col not in existing:
                conn.execute(f"ALTER TABLE items ADD COLUMN {col} TEXT")
        if "embedding" not in existing:
            conn.execute("ALTER TABLE items ADD COLUMN embedding BLOB")
        # FTS5 virtual table for keyword search.
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
                title, summary, tags_text, content,
                tokenize='porter ascii'
            )
            """
        )


init_db()

# Dev convenience: if a key is present in the environment/.env, configure the
# client up front so /status reports it as ready without a round-trip.
if os.getenv("ANTHROPIC_API_KEY"):
    enrichment.configure(os.environ["ANTHROPIC_API_KEY"])


class ItemIn(BaseModel):
    url: str
    title: str | None = None
    selection: str | None = None
    excerpt: str | None = None


class ApiKeyIn(BaseModel):
    api_key: str


class Item(ItemIn):
    id: int
    created_at: str
    summary: str | None = None
    tags: list[str] = []
    topic: str | None = None
    status: str = "pending"
    error: str | None = None
    transcript: str | None = None


def _row_to_item(row: sqlite3.Row) -> Item:
    data = dict(row)
    data["tags"] = json.loads(data["tags"]) if data.get("tags") else []
    data.pop("embedding", None)  # BLOB — not part of the API model
    return Item(**data)


def enrich_item(item_id: int) -> None:
    """Background task: enrich one item and write the result back."""
    with db() as conn:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return

    # For YouTube URLs, fetch the real transcript instead of noisy DOM text.
    tx = transcript_mod.fetch(row["url"])
    content = tx or row["selection"] or row["excerpt"] or ""

    try:
        result = enrichment.enrich(row["title"], row["url"], content)
        with db() as conn:
            conn.execute(
                "UPDATE items SET summary=?, tags=?, topic=?, status='enriched', "
                "error=NULL, transcript=? WHERE id=?",
                (result.summary, json.dumps(result.tags), result.topic, tx, item_id),
            )
        _index_item(item_id, row["title"], result.summary, result.tags, result.topic,
                    tx or row["excerpt"] or "")
    except Exception:
        with db() as conn:
            conn.execute(
                "UPDATE items SET status='error', error=? WHERE id=?",
                (traceback.format_exc(limit=2), item_id),
            )


def _index_item(
    item_id: int,
    title: str | None,
    summary: str | None,
    tags: list[str],
    topic: str | None,
    full_content: str,
) -> None:
    """Compute embedding + populate FTS5 for one enriched item."""
    embed_text = " ".join(filter(None, [topic, summary, " ".join(tags)]))
    vec = embeddings_mod.embed(embed_text)

    fts_content = " ".join(filter(None, [
        title, summary, " ".join(tags), full_content[:1500],
    ]))
    with db() as conn:
        conn.execute("UPDATE items SET embedding=? WHERE id=?", (vec, item_id))
        conn.execute(
            "INSERT OR REPLACE INTO items_fts(rowid, title, summary, tags_text, content) "
            "VALUES (?, ?, ?, ?, ?)",
            (item_id, title or "", summary or "", " ".join(tags), fts_content),
        )


@app.get("/status")
def status() -> dict:
    """Health + configuration snapshot the desktop app polls on launch."""
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM items").fetchone()["c"]
        pending = conn.execute(
            "SELECT COUNT(*) AS c FROM items WHERE status IS NULL OR status != 'enriched'"
        ).fetchone()["c"]
        unindexed = conn.execute(
            "SELECT COUNT(*) AS c FROM items WHERE status='enriched' AND embedding IS NULL"
        ).fetchone()["c"]
    return {
        "ok": True,
        "version": app.version,
        "model": enrichment.MODEL,
        "key_configured": enrichment.is_configured(),
        "counts": {"total": total, "pending": pending, "unindexed": unindexed},
    }


@app.post("/config/api-key")
def set_api_key(body: ApiKeyIn, background: BackgroundTasks) -> dict:
    """Validate an Anthropic key, then keep it in memory for enrichment.

    On success we re-queue anything that failed or never got enriched (e.g.
    saved before a key was configured), so the library fills in on its own.
    """
    key = body.api_key.strip()
    if not key:
        raise HTTPException(400, "API key is required")
    try:
        enrichment.validate_key(key)
    except anthropic.AuthenticationError:
        raise HTTPException(401, "That API key was rejected by Anthropic.")
    except anthropic.APIError as exc:
        raise HTTPException(502, f"Couldn't reach Anthropic to verify the key: {exc}")
    enrichment.configure(key)

    with db() as conn:
        rows = conn.execute(
            "SELECT id FROM items WHERE status IS NULL OR status != 'enriched'"
        ).fetchall()
    for r in rows:
        background.add_task(enrich_item, r["id"])

    return {"ok": True, "key_configured": True, "requeued": len(rows)}


@app.delete("/config/api-key")
def clear_api_key() -> dict:
    enrichment.reset()
    return {"ok": True, "key_configured": False}


@app.post("/items", response_model=Item)
def create_item(item: ItemIn, background: BackgroundTasks) -> Item:
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO items (url, title, selection, excerpt, created_at, status) "
            "VALUES (?, ?, ?, ?, ?, 'pending')",
            (item.url, item.title, item.selection, item.excerpt, created_at),
        )
        item_id = cur.lastrowid
    background.add_task(enrich_item, item_id)
    return Item(id=item_id, created_at=created_at, **item.model_dump())


@app.get("/items", response_model=list[Item])
def list_items() -> list[Item]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY created_at DESC").fetchall()
    return [_row_to_item(r) for r in rows]


@app.post("/items/{item_id}/enrich", response_model=Item)
def reenrich(item_id: int, background: BackgroundTasks) -> Item:
    with db() as conn:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "item not found")
    background.add_task(enrich_item, item_id)
    return _row_to_item(row)


@app.post("/enrich-pending")
def enrich_pending(background: BackgroundTasks) -> dict:
    """Enrich every item not yet successfully enriched (pending or errored)."""
    with db() as conn:
        rows = conn.execute(
            "SELECT id FROM items WHERE status IS NULL OR status != 'enriched'"
        ).fetchall()
    for r in rows:
        background.add_task(enrich_item, r["id"])
    return {"queued": len(rows)}


@app.get("/search")
def search(q: str, limit: int = 20) -> list[dict]:
    """Hybrid search: FTS5 keyword + cosine vector similarity, combined score."""
    if not q.strip():
        return []

    q_vec = embeddings_mod.embed(q)

    # FTS5 BM25 scores (rank is negative; negate so higher = better).
    with db() as conn:
        fts_rows = conn.execute(
            "SELECT rowid, rank FROM items_fts WHERE items_fts MATCH ? ORDER BY rank LIMIT 100",
            (q,),
        ).fetchall()
    fts_raw = {r["rowid"]: -r["rank"] for r in fts_rows}

    # Cosine similarity against all embedded items.
    with db() as conn:
        emb_rows = conn.execute(
            "SELECT id, embedding FROM items WHERE embedding IS NOT NULL"
        ).fetchall()
    vec_scores = {
        r["id"]: sim
        for r in emb_rows
        if (sim := embeddings_mod.cosine(q_vec, r["embedding"])) > 0.25
    }

    all_ids = set(fts_raw) | set(vec_scores)
    if not all_ids:
        return []

    max_fts = max(fts_raw.values(), default=1) or 1
    scored = sorted(
        (
            (
                item_id,
                0.4 * (fts_raw.get(item_id, 0) / max_fts) + 0.6 * vec_scores.get(item_id, 0),
            )
            for item_id in all_ids
        ),
        key=lambda x: x[1],
        reverse=True,
    )[:limit]

    top_ids = [item_id for item_id, _ in scored]
    placeholders = ",".join("?" * len(top_ids))
    with db() as conn:
        rows = conn.execute(
            f"SELECT * FROM items WHERE id IN ({placeholders})", top_ids
        ).fetchall()

    id_to_row = {r["id"]: r for r in rows}
    return [
        {**_row_to_item(id_to_row[item_id]).model_dump(), "score": round(score, 3)}
        for item_id, score in scored
        if item_id in id_to_row
    ]


@app.post("/embed-pending")
def embed_pending(background: BackgroundTasks) -> dict:
    """Compute embeddings + FTS index for enriched items that don't have one yet."""
    with db() as conn:
        rows = conn.execute(
            "SELECT id FROM items WHERE status='enriched' AND embedding IS NULL"
        ).fetchall()
    for r in rows:
        background.add_task(_backfill_index, r["id"])
    return {"queued": len(rows)}


def _backfill_index(item_id: int) -> None:
    with db() as conn:
        row = conn.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
    if row is None or row["status"] != "enriched":
        return
    tags = json.loads(row["tags"]) if row["tags"] else []
    _index_item(
        item_id, row["title"], row["summary"], tags, row["topic"],
        row["transcript"] or row["excerpt"] or "",
    )


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY created_at DESC").fetchall()

    def card(r: sqlite3.Row) -> str:
        tags = json.loads(r["tags"]) if r["tags"] else []
        tag_html = "".join(f"<span class='tag'>{t}</span>" for t in tags)
        topic = f"<span class='topic'>{r['topic']}</span>" if r["topic"] else ""
        if r["status"] == "enriched":
            body = r["summary"] or ""
        elif r["status"] == "error":
            body = "<em class='err'>enrichment failed — check backend logs</em>"
        else:
            body = "<em class='pending'>enriching…</em>"
        return f"""
        <li class="card">
          <div class="head">{topic}{tag_html}</div>
          <a href="{r['url']}" target="_blank">{r['title'] or r['url']}</a>
          <div class="url">{r['url']}</div>
          <p>{body}</p>
          <time>{r['created_at']}</time>
        </li>
        """

    cards = "\n".join(card(r) for r in rows)
    empty = "<p class='empty'>Nothing stashed yet. Save a page from the extension.</p>"
    return f"""
    <!doctype html><html><head><meta charset="utf-8"><title>Stash</title>
    <meta http-equiv="refresh" content="8">
    <style>
      body {{ font: 15px/1.5 -apple-system, system-ui, sans-serif;
             max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }}
      h1 {{ font-size: 22px; }}
      ul {{ list-style: none; padding: 0; }}
      .card {{ border: 1px solid #eee; border-radius: 12px; padding: 16px;
               margin-bottom: 12px; }}
      .head {{ margin-bottom: 6px; }}
      .topic {{ background: #1a1a1a; color: #fff; font-size: 11px; padding: 2px 8px;
                border-radius: 999px; margin-right: 6px; }}
      .tag {{ background: #eef6f1; color: #2a7; font-size: 11px; padding: 2px 8px;
              border-radius: 999px; margin-right: 4px; }}
      .card a {{ font-weight: 600; color: #111; text-decoration: none; font-size: 16px; }}
      .url {{ color: #2a7; font-size: 12px; margin: 2px 0 8px; word-break: break-all; }}
      .card p {{ color: #444; margin: 0 0 8px; }}
      .pending {{ color: #999; }} .err {{ color: #c33; }}
      time {{ color: #999; font-size: 12px; }}
      .empty {{ color: #999; }}
    </style></head>
    <body><h1>📥 Stash <span style="color:#999;font-weight:400">— {len(rows)} saved</span></h1>
    <ul>{cards or empty}</ul></body></html>
    """
