import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import type { Item } from "./types";

const BASE = "http://localhost:8000";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface BackendStatus {
  ok: boolean;
  version: string;
  model: string;
  key_configured: boolean;
  counts: { total: number; pending: number; unindexed: number };
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${BASE}/items`);
  if (!res.ok) throw new Error(`fetch /items: ${res.status}`);
  return res.json();
}

export async function searchItems(q: string): Promise<Item[]> {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=50`);
  if (!res.ok) throw new Error(`fetch /search: ${res.status}`);
  return res.json();
}

/** Backend health + configuration snapshot, polled on launch. */
export async function getStatus(signal?: AbortSignal): Promise<BackendStatus> {
  const res = await fetch(`${BASE}/status`, { signal });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

/** Validate an Anthropic key and configure the backend to use it. */
export async function setApiKey(
  apiKey: string,
): Promise<{ ok: boolean; key_configured: boolean; requeued: number }> {
  const res = await fetch(`${BASE}/config/api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    let detail = "Couldn't save the API key. Please try again.";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Tell the backend to forget the key (used when signing out). */
export async function clearApiKeyOnBackend(): Promise<void> {
  await fetch(`${BASE}/config/api-key`, { method: "DELETE" }).catch(() => {});
}

/** Re-run enrichment for anything pending or previously failed. */
export async function enrichPending(): Promise<{ queued: number }> {
  const res = await fetch(`${BASE}/enrich-pending`, { method: "POST" });
  if (!res.ok) throw new Error("enrich-pending failed");
  return res.json();
}

/** Rebuild the search index for enriched items missing an embedding. */
export async function rebuildIndex(): Promise<{ queued: number }> {
  const res = await fetch(`${BASE}/embed-pending`, { method: "POST" });
  if (!res.ok) throw new Error("embed-pending failed");
  return res.json();
}

export function openUrl(url: string) {
  // Inside the Tauri webview, window.open is a no-op — use the opener plugin
  // to hand the URL to the system browser. Fall back to window.open in dev/web.
  if (isTauri) {
    tauriOpenUrl(url).catch((err) => console.error("openUrl failed", err));
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
