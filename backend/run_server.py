"""Entry point for the packaged Stash backend (Tauri sidecar).

Runs the FastAPI app on a fixed local port. The desktop app spawns this
binary on launch and talks to it over http://localhost:8000. The DB location
is controlled by STASH_DATA_DIR (set by the desktop app to a writable
app-data directory).
"""

from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("STASH_PORT", "8000"))
    # Import lazily so PyInstaller's bootstrap finishes before heavy imports.
    from main import app

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
