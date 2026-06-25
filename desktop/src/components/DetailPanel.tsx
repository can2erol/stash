import { motion, AnimatePresence } from "framer-motion";
import type { Item } from "../types";
import { openUrl, domain, relativeTime } from "../api";

interface Props {
  item: Item | null;
  onClose: () => void;
}

export function DetailPanel({ item, onClose }: Props) {
  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/10 z-20"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute top-0 right-0 h-full w-[440px] max-w-[85%] bg-white border-l border-[#EFEFED] z-30 flex flex-col shadow-[-8px_0_28px_rgba(0,0,0,0.06)]"
          >
            {/* Header actions */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#EFEFED]">
              <button
                onClick={onClose}
                className="text-[#9B9A97] hover:text-[#37352F] transition-colors p-1 -ml-1 rounded-md hover:bg-[#F1F1EF]"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={() => openUrl(item.url)}
                className="flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-[#1a1a1a] hover:bg-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors"
              >
                Open original
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Meta row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {item.topic && (
                  <span className="text-[11px] font-medium text-[#787774] bg-[#EFEFED] px-2 py-0.5 rounded-full capitalize">
                    {item.topic}
                  </span>
                )}
                <span className="text-[11.5px] text-[#9B9A97]">{domain(item.url)}</span>
                <span className="text-[11.5px] text-[#C4C3C0]">·</span>
                <span className="text-[11.5px] text-[#9B9A97]">{relativeTime(item.created_at)}</span>
              </div>

              {/* Title */}
              <h2 className="text-[19px] font-semibold text-[#37352F] leading-snug mb-4">
                {item.title || item.url}
              </h2>

              {/* Summary */}
              {item.status === "enriched" && item.summary && (
                <div className="mb-5">
                  <p className="text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest mb-1.5">
                    Summary
                  </p>
                  <p className="text-[14px] text-[#37352F] leading-relaxed">{item.summary}</p>
                </div>
              )}

              {item.status === "pending" && (
                <p className="text-[13px] text-[#9B9A97] italic mb-5">Enriching… check back in a moment.</p>
              )}
              {item.status === "error" && (
                <p className="text-[13px] text-red-500 mb-5">Enrichment failed for this item.</p>
              )}

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest mb-1.5">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[12px] text-[#787774] bg-[#F1F1EF] px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlighted selection */}
              {item.selection && (
                <div className="mb-5">
                  <p className="text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest mb-1.5">
                    Your highlight
                  </p>
                  <blockquote className="text-[13.5px] text-[#37352F] leading-relaxed border-l-2 border-[#E8E8E6] pl-3 italic">
                    {item.selection}
                  </blockquote>
                </div>
              )}

              {/* Full text / transcript */}
              {(item.transcript || item.excerpt) && (
                <div>
                  <p className="text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest mb-1.5">
                    {item.transcript ? "Transcript" : "Captured text"}
                  </p>
                  <p className="text-[13px] text-[#787774] leading-relaxed whitespace-pre-wrap">
                    {item.transcript || item.excerpt}
                  </p>
                </div>
              )}
            </div>

            {/* Footer URL */}
            <div className="shrink-0 px-6 py-3 border-t border-[#EFEFED]">
              <button
                onClick={() => openUrl(item.url)}
                className="text-[12px] text-[#9B9A97] hover:text-[#787774] transition-colors truncate block w-full text-left"
                title={item.url}
              >
                {item.url}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
