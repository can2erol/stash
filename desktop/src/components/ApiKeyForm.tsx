import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { openUrl } from "../api";

interface Props {
  onSubmit: (key: string) => Promise<void>;
  submitLabel?: string;
  autoFocus?: boolean;
}

export function ApiKeyForm({ onSubmit, submitLabel = "Continue", autoFocus = true }: Props) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksValid = value.trim().startsWith("sk-ant-");

  async function submit() {
    const key = value.trim();
    if (!key || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 transition-colors ${
          error ? "border-red-300" : "border-[#E3E2E0] focus-within:border-[#37352F]"
        }`}
      >
        <input
          type={reveal ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          placeholder="sk-ant-..."
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="flex-1 h-11 bg-transparent text-[13.5px] text-[#37352F] placeholder-[#C4C3C0] focus:outline-none font-mono tracking-tight"
        />
        {value && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="text-[#9B9A97] hover:text-[#37352F] transition-colors p-1"
            title={reveal ? "Hide" : "Show"}
          >
            {reveal ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[12px] text-red-500 mt-2 px-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={submit}
        disabled={!looksValid || busy}
        className="mt-4 w-full h-11 rounded-xl bg-[#37352F] text-white text-[13.5px] font-medium flex items-center justify-center gap-2 transition-all hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Spinner /> Verifying with Anthropic…
          </>
        ) : (
          submitLabel
        )}
      </button>

      <button
        onClick={() => openUrl("https://console.anthropic.com/settings/keys")}
        className="mt-3 w-full text-center text-[12.5px] text-[#9B9A97] hover:text-[#37352F] transition-colors"
      >
        Don't have a key? Get one from the Anthropic Console →
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}
