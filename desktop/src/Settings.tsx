import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  enrichPending,
  rebuildIndex,
  openUrl,
  type BackendStatus,
} from "./api";
import { ApiKeyForm } from "./components/ApiKeyForm";

interface Props {
  status: BackendStatus | null;
  keyHint: string | null;
  onClose: () => void;
  onActivateKey: (key: string) => Promise<void>;
  onRemoveKey: () => Promise<void>;
  onRefreshStatus: () => void;
}

export default function Settings({
  status,
  keyHint,
  onClose,
  onActivateKey,
  onRemoveKey,
  onRefreshStatus,
}: Props) {
  const [replacing, setReplacing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const configured = status?.key_configured ?? false;
  const pending = status?.counts.pending ?? 0;
  const unindexed = status?.counts.unindexed ?? 0;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function activate(key: string) {
    await onActivateKey(key);
    setReplacing(false);
    flash("API key updated");
  }

  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 flex items-center justify-center p-6"
      >
        <motion.div
          key="sheet"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl font-sans"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/90 backdrop-blur flex items-center justify-between px-6 py-4 border-b border-[#EDECEA] z-10">
            <h2 className="text-[15px] font-semibold text-[#37352F]">Settings</h2>
            <button
              onClick={onClose}
              className="text-[#9B9A97] hover:text-[#37352F] transition-colors p-1 rounded-md hover:bg-[#F1F1EF]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-7">
            {/* ── AI engine ─────────────────────────────────────── */}
            <Section
              title="AI engine"
              subtitle={status ? `Claude · ${status.model}` : "Connecting…"}
            >
              <div className="flex items-center justify-between rounded-xl border border-[#EDECEA] px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      configured ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#37352F]">
                      {configured ? "API key connected" : "No API key"}
                    </p>
                    <p className="text-[12px] text-[#9B9A97] font-mono truncate">
                      {configured ? keyHint ?? "sk-ant-••••" : "Enrichment is paused"}
                    </p>
                  </div>
                </div>
                {configured && !replacing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setReplacing(true)}
                      className="text-[12.5px] font-medium text-[#37352F] hover:bg-[#F1F1EF] px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Replace
                    </button>
                    <button
                      onClick={async () => {
                        await onRemoveKey();
                        flash("API key removed");
                      }}
                      className="text-[12.5px] font-medium text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {(replacing || !configured) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <ApiKeyForm
                        onSubmit={activate}
                        submitLabel={configured ? "Save new key" : "Connect key"}
                        autoFocus={false}
                      />
                      {replacing && configured && (
                        <button
                          onClick={() => setReplacing(false)}
                          className="mt-2 w-full text-center text-[12px] text-[#9B9A97] hover:text-[#37352F]"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            {/* ── Library maintenance ───────────────────────────── */}
            <Section title="Library" subtitle={status ? `${status.counts.total} saves` : ""}>
              <ActionRow
                title="Re-run enrichment"
                detail={
                  pending > 0
                    ? `${pending} item${pending === 1 ? "" : "s"} waiting`
                    : "Everything is enriched"
                }
                actionLabel="Run"
                disabled={!configured || pending === 0}
                onAction={async () => {
                  const { queued } = await enrichPending();
                  onRefreshStatus();
                  flash(queued ? `Enriching ${queued} item${queued === 1 ? "" : "s"}…` : "Nothing to enrich");
                }}
              />
              <ActionRow
                title="Rebuild search index"
                detail={
                  unindexed > 0 ? `${unindexed} not yet indexed` : "Search index is up to date"
                }
                actionLabel="Rebuild"
                disabled={unindexed === 0}
                onAction={async () => {
                  const { queued } = await rebuildIndex();
                  onRefreshStatus();
                  flash(queued ? `Indexing ${queued} item${queued === 1 ? "" : "s"}…` : "Index up to date");
                }}
              />
            </Section>

            {/* ── Capture ───────────────────────────────────────── */}
            <Section title="Capture" subtitle="Save from your browser">
              <div className="rounded-xl border border-[#EDECEA] px-4 py-3.5">
                <p className="text-[12.5px] text-[#787774] leading-relaxed">
                  Install the Stash browser extension to save any page in one click, or press{" "}
                  <Kbd>⌘⇧S</Kbd> from anywhere.
                </p>
                <button
                  onClick={() => openUrl("https://github.com/")}
                  className="mt-3 text-[12.5px] font-medium text-[#37352F] hover:underline"
                >
                  Get the browser extension →
                </button>
              </div>
            </Section>
          </div>
        </motion.div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#37352F] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-lg z-50"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#9B9A97] uppercase tracking-widest">{title}</h3>
        {subtitle && <span className="text-[11.5px] text-[#C4C3C0]">{subtitle}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ActionRow({
  title,
  detail,
  actionLabel,
  disabled,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  disabled?: boolean;
  onAction: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#EDECEA] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#37352F]">{title}</p>
        <p className="text-[12px] text-[#9B9A97] truncate">{detail}</p>
      </div>
      <button
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onAction();
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 text-[12.5px] font-medium text-[#37352F] bg-[#F1F1EF] hover:bg-[#E8E8E6] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "…" : actionLabel}
      </button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-[#F1F1EF] text-[#37352F] font-sans text-[11px] border border-[#E8E8E6]">
      {children}
    </kbd>
  );
}
