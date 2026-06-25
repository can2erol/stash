import { motion } from "framer-motion";
import { ApiKeyForm } from "./components/ApiKeyForm";
import { isTauri } from "./api";

interface Props {
  onActivate: (key: string) => Promise<void>;
}

const FEATURES = [
  { icon: "✍️", title: "Auto-summarized", body: "Every save gets a clean summary, tags, and a topic." },
  { icon: "🎬", title: "Real transcripts", body: "YouTube saves capture the full spoken transcript." },
  { icon: "🔎", title: "Meaning-aware search", body: "Find anything by idea, not just exact words." },
];

export default function Onboarding({ onActivate }: Props) {
  return (
    <div className="h-screen w-screen bg-[#FBFBFA] font-sans flex overflow-hidden select-none">
      {/* ── Left: brand / value ─────────────────────────────────── */}
      <div className="hidden md:flex flex-col justify-between w-[44%] max-w-[560px] p-12 bg-gradient-to-br from-[#37352F] to-[#1A1916] text-white relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.07] blur-2xl"
          style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}
        />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2.5 relative"
        >
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-white text-[#37352F] font-bold text-[15px]">
            S
          </span>
          <span className="font-semibold text-[17px] tracking-tight">Stash</span>
        </motion.div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-[30px] leading-[1.15] font-semibold tracking-tight"
          >
            Obsidian for
            <br />
            your content.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="text-[14px] text-white/55 mt-4 leading-relaxed max-w-sm"
          >
            Save anything from the web and let Stash organize, summarize, and make it
            searchable — automatically.
          </motion.p>

          <div className="mt-9 space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + i * 0.08 }}
                className="flex items-start gap-3"
              >
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-white/[0.06] text-[15px] shrink-0">
                  {f.icon}
                </span>
                <div>
                  <p className="text-[13.5px] font-medium">{f.title}</p>
                  <p className="text-[12.5px] text-white/45 leading-snug">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11.5px] text-white/35 relative"
        >
          Powered by Claude · runs entirely on your machine
        </motion.p>
      </div>

      {/* ── Right: API key entry ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[380px]"
        >
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-[#37352F] text-white font-bold text-[15px]">
              S
            </span>
            <span className="font-semibold text-[17px] text-[#37352F] tracking-tight">Stash</span>
          </div>

          <h2 className="text-[22px] font-semibold text-[#37352F] tracking-tight">
            Connect your Claude key
          </h2>
          <p className="text-[13.5px] text-[#787774] mt-2 leading-relaxed">
            Stash uses your own Anthropic API key to enrich saves. You only pay Anthropic
            for what you use — there's no Stash subscription.
          </p>

          <div className="mt-7">
            <ApiKeyForm onSubmit={onActivate} submitLabel="Set up Stash" />
          </div>

          <div className="mt-7 flex items-start gap-2.5 rounded-xl bg-[#F4F4F2] px-3.5 py-3">
            <svg className="w-4 h-4 text-[#9B9A97] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[12px] text-[#787774] leading-relaxed">
              {isTauri ? (
                <>
                  Your key is stored in your Mac's <strong className="font-medium text-[#37352F]">Keychain</strong> and
                  never leaves your device except to call Anthropic.
                </>
              ) : (
                <>Your key stays on this device and is only ever sent to Anthropic.</>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
