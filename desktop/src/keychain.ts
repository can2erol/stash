import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./api";

// In the packaged app the key lives in the OS keychain (via Rust commands).
// In the browser dev preview there's no keychain, so we degrade to
// localStorage purely so the flow is testable outside Tauri.
const LS_FALLBACK = "stash.anthropic_api_key";

export async function loadStoredKey(): Promise<string | null> {
  if (isTauri) {
    try {
      return await invoke<string | null>("get_api_key");
    } catch {
      return null;
    }
  }
  return localStorage.getItem(LS_FALLBACK);
}

export async function storeKey(key: string): Promise<void> {
  if (isTauri) {
    await invoke("save_api_key", { key });
    return;
  }
  localStorage.setItem(LS_FALLBACK, key);
}

export async function forgetKey(): Promise<void> {
  if (isTauri) {
    await invoke("delete_api_key").catch(() => {});
    return;
  }
  localStorage.removeItem(LS_FALLBACK);
}
