"""Local embeddings (Phase 2c).

Uses fastembed + BAAI/bge-small-en-v1.5 (~130 MB download on first use,
384-dim L2-normalised vectors). Model loads lazily on first call.
"""

from __future__ import annotations

import numpy as np
from fastembed import TextEmbedding

_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(_MODEL_NAME)
    return _model


def embed(text: str) -> bytes:
    """Return a float32 embedding as raw bytes for SQLite BLOB storage."""
    vec = next(_get_model().embed([text]))
    return vec.astype(np.float32).tobytes()


def cosine(a: bytes, b: bytes) -> float:
    """Cosine similarity. Both vectors are L2-normalised so this is a dot product."""
    va = np.frombuffer(a, dtype=np.float32)
    vb = np.frombuffer(b, dtype=np.float32)
    return float(np.dot(va, vb))
