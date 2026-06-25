"""Claude enrichment (Phase 2a).

Turns a raw saved item (title + URL + captured text) into a clean
summary, a few topical tags, and a single topic label. Uses Haiku 4.5 —
cheap ($1/$5 per Mtok) and fast, which suits high-volume per-item calls.
The structured output is validated against a Pydantic schema by the SDK.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

# Load ANTHROPIC_API_KEY from backend/.env if present. In the packaged
# consumer app there is no .env — the key arrives at runtime from the desktop
# app (which stores it in the OS keychain) via POST /config/api-key.
load_dotenv(Path(__file__).parent / ".env")

MODEL = "claude-haiku-4-5"

_client: anthropic.Anthropic | None = None
_lock = threading.Lock()


def configure(api_key: str) -> None:
    """Set or replace the Anthropic key used for enrichment, at runtime."""
    global _client
    with _lock:
        _client = anthropic.Anthropic(api_key=api_key)


def reset() -> None:
    """Forget the configured key (used when the user signs out)."""
    global _client
    with _lock:
        _client = None


def is_configured() -> bool:
    return _client is not None


def validate_key(api_key: str) -> None:
    """Raise if the key can't authenticate against the Anthropic API.

    Uses a lightweight models list call so we don't spend tokens just to
    verify the key during onboarding.
    """
    anthropic.Anthropic(api_key=api_key).models.list(limit=1)


def _get_client() -> anthropic.Anthropic:
    global _client
    with _lock:
        if _client is None:
            # Dev convenience: fall back to ANTHROPIC_API_KEY from the env/.env.
            if os.getenv("ANTHROPIC_API_KEY"):
                _client = anthropic.Anthropic()
            else:
                raise RuntimeError(
                    "No Anthropic API key configured. Add one in Stash settings."
                )
        return _client


class Enrichment(BaseModel):
    summary: str
    tags: list[str]
    topic: str


PROMPT = """You are organizing a personal library of saved web content.
Given a saved item, produce:
- summary: 1-2 plain sentences on what this is actually about. Ignore site
  chrome/navigation noise (e.g. "Skip navigation", "Subscribe", view counts).
- tags: 3-5 lowercase topical tags (single words or short phrases).
- topic: one short, broad topic label to group this with similar saves
  (e.g. "machine learning", "startups", "cooking").

Title: {title}
URL: {url}

Captured text (may be noisy):
{content}
"""


def enrich(title: str, url: str, content: str) -> Enrichment:
    """Call Claude and return validated enrichment. Raises on API failure."""
    prompt = PROMPT.format(
        title=title or "(untitled)",
        url=url,
        content=(content or "")[:8000],
    )
    response = _get_client().messages.parse(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        output_format=Enrichment,
    )
    return response.parsed_output
