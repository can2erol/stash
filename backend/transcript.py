"""YouTube transcript extraction (Phase 2b).

Returns the plain-text transcript for a YouTube URL, or None if unavailable
(private video, no captions, non-YouTube URL, etc.).
"""

from __future__ import annotations

import re

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound


_YT_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?.*v=|youtu\.be/)([A-Za-z0-9_-]{11})"),
]

_api = YouTubeTranscriptApi()


def _video_id(url: str) -> str | None:
    for pat in _YT_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


def fetch(url: str) -> str | None:
    """Return a single string transcript, or None if not available."""
    vid = _video_id(url)
    if not vid:
        return None
    try:
        # Prefer English; fall back to any available transcript.
        try:
            result = _api.fetch(vid, languages=["en", "en-US"])
        except NoTranscriptFound:
            listing = _api.list(vid)
            tx_obj = next(iter(listing), None)
            if tx_obj is None:
                return None
            result = tx_obj.fetch()
        return " ".join(seg.text for seg in result)
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except Exception:
        return None
