#!/usr/bin/env bash
# Build the Python backend into a single-file binary and drop it into
# src-tauri/binaries/ with the Rust target-triple suffix Tauri expects for a
# sidecar (e.g. stash-backend-aarch64-apple-darwin).
#
# Run from anywhere: `npm run build:backend` (see package.json).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DESKTOP_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BIN_DIR="$DESKTOP_DIR/src-tauri/binaries"

# The triple Tauri appends to externalBin names on this host.
TARGET_TRIPLE="$(rustc -Vv | sed -n 's/host: //p')"
if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "could not determine rust target triple (is rustc installed?)" >&2
  exit 1
fi

echo "▸ Building Stash backend for $TARGET_TRIPLE"

cd "$BACKEND_DIR"

# Use a dedicated venv so PyInstaller doesn't have to live in the dev env.
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt pyinstaller

rm -rf build dist
pyinstaller --clean --noconfirm stash-backend.spec

mkdir -p "$BIN_DIR"
cp "dist/stash-backend" "$BIN_DIR/stash-backend-$TARGET_TRIPLE"
chmod +x "$BIN_DIR/stash-backend-$TARGET_TRIPLE"

echo "✓ Sidecar ready: src-tauri/binaries/stash-backend-$TARGET_TRIPLE"
