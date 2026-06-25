import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  getStatus,
  setApiKey,
  clearApiKeyOnBackend,
  type BackendStatus,
} from "./api";
import { loadStoredKey, storeKey, forgetKey } from "./keychain";
import Library from "./Library";
import Onboarding from "./Onboarding";
import Settings from "./Settings";

type Phase = "connecting" | "onboarding" | "ready";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const maskKey = (k: string) => `${k.slice(0, 7)}…${k.slice(-4)}`;

export default function App() {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [connectFailed, setConnectFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const booting = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getStatus());
    } catch {
      /* transient; polling will recover */
    }
  }, []);

  const activateKey = useCallback(async (key: string) => {
    // Validates against Anthropic on the backend; throws with a message if bad.
    await setApiKey(key);
    await storeKey(key);
    setKeyHint(maskKey(key));
    await refreshStatus();
    setPhase("ready");
  }, [refreshStatus]);

  const removeKey = useCallback(async () => {
    await clearApiKeyOnBackend();
    await forgetKey();
    setKeyHint(null);
    await refreshStatus();
  }, [refreshStatus]);

  const bootstrap = useCallback(async () => {
    if (booting.current) return;
    booting.current = true;
    setPhase("connecting");
    setConnectFailed(false);

    const stored = await loadStoredKey();
    if (stored) setKeyHint(maskKey(stored));

    // The bundled backend can take a moment to come up on first launch.
    let st: BackendStatus | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        st = await getStatus();
        break;
      } catch {
        await sleep(800);
      }
    }

    booting.current = false;

    if (!st) {
      setConnectFailed(true);
      return;
    }
    setStatus(st);

    if (st.key_configured) {
      setPhase("ready");
      return;
    }
    if (stored) {
      try {
        await setApiKey(stored);
        await refreshStatus();
        setPhase("ready");
        return;
      } catch {
        // Stored key was rejected (revoked/rotated) — fall through to onboarding.
        await forgetKey();
        setKeyHint(null);
      }
    }
    setPhase("onboarding");
  }, [refreshStatus]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Keep status fresh once we're in the app (pending counts, key state).
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setInterval(refreshStatus, 8000);
    return () => clearInterval(t);
  }, [phase, refreshStatus]);

  if (phase === "connecting") {
    return <Connecting failed={connectFailed} onRetry={bootstrap} />;
  }

  if (phase === "onboarding") {
    return <Onboarding onActivate={activateKey} />;
  }

  return (
    <>
      <Library status={status} onOpenSettings={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <Settings
          status={status}
          keyHint={keyHint}
          onClose={() => setSettingsOpen(false)}
          onActivateKey={activateKey}
          onRemoveKey={removeKey}
          onRefreshStatus={refreshStatus}
        />
      )}
    </>
  );
}

function Connecting({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div className="h-screen w-screen bg-[#FBFBFA] font-sans flex flex-col items-center justify-center select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid place-items-center w-12 h-12 rounded-2xl bg-[#37352F] text-white font-bold text-[20px] mb-6"
      >
        S
      </motion.div>

      {failed ? (
        <div className="flex flex-col items-center text-center max-w-sm px-6">
          <p className="text-[15px] font-semibold text-[#37352F]">Can't reach the Stash engine</p>
          <p className="text-[13px] text-[#787774] mt-1.5 leading-relaxed">
            The local backend didn't respond. It may still be starting up, or it failed to
            launch.
          </p>
          <button
            onClick={onRetry}
            className="mt-5 h-10 px-5 rounded-xl bg-[#37352F] text-white text-[13px] font-medium hover:bg-black transition-colors"
          >
            Try again
          </button>
          <p className="text-[11.5px] text-[#C4C3C0] mt-4 font-mono">
            dev: uvicorn main:app --port 8000
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-[#9B9A97]">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
          </svg>
          <span className="text-[13px]">Starting Stash…</span>
        </div>
      )}
    </div>
  );
}
