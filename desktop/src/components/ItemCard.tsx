import { motion } from "framer-motion";
import type { Item } from "../types";
import { domain, relativeTime } from "../api";

interface Props {
  item: Item;
  index: number;
  onOpen: (item: Item) => void;
}

const AVATAR_COLORS: [string, string][] = [
  ["#dbeafe", "#1d4ed8"], ["#ede9fe", "#6d28d9"], ["#fce7f3", "#be185d"],
  ["#dcfce7", "#15803d"], ["#ffedd5", "#c2410c"], ["#e0f2fe", "#0369a1"],
  ["#fef9c3", "#a16207"], ["#f1f5f9", "#475569"],
];

function avatarStyle(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const [bg, fg] = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return { backgroundColor: bg, color: fg };
}

export function ItemCard({ item, index, onOpen }: Props) {
  const d = domain(item.url);
  const isYouTube = item.url.includes("youtube.com") || item.url.includes("youtu.be");
  const letter = isYouTube ? "▶" : (d[0]?.toUpperCase() ?? "?");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.24), ease: "easeOut" }}
      className="group flex items-start gap-3.5 px-3 py-3 rounded-xl hover:bg-[#F1F1EF] cursor-pointer transition-colors duration-100"
      onClick={() => onOpen(item)}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold select-none mt-0.5"
        style={avatarStyle(d)}
      >
        {letter}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <p className="text-[13.5px] font-medium text-[#37352F] leading-snug line-clamp-1 group-hover:text-black transition-colors">
            {item.title || item.url}
          </p>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {item.topic && (
              <span className="text-[10.5px] font-medium text-[#787774] bg-[#EFEFED] px-2 py-0.5 rounded-full capitalize whitespace-nowrap">
                {item.topic}
              </span>
            )}
            <span className="text-[11.5px] text-[#ACACAC] whitespace-nowrap tabular-nums">
              {relativeTime(item.created_at)}
            </span>
          </div>
        </div>

        {item.status === "pending" && (
          <p className="text-[12.5px] text-[#ACACAC] mt-0.5 italic">Enriching…</p>
        )}
        {item.status === "enriched" && item.summary && (
          <p className="text-[12.5px] text-[#9B9A97] leading-relaxed mt-0.5 line-clamp-1">
            {item.summary}
          </p>
        )}

        {item.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {item.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[11px] text-[#9B9A97] bg-[#F1F1EF] px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            <span className="text-[11px] text-[#C4C3C0] ml-auto">{d}</span>
            {item.score !== undefined && (
              <span className="text-[11px] text-indigo-400 tabular-nums">
                {Math.round(item.score * 100)}%
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
