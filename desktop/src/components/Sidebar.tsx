import { motion, AnimatePresence } from "framer-motion";

interface TopicEntry { name: string; count: number; }
interface Props {
  topics: TopicEntry[];
  selected: string | null;
  onSelect: (topic: string | null) => void;
  totalCount: number;
}

export function Sidebar({ topics, selected, onSelect, totalCount }: Props) {
  return (
    <motion.aside
      className="w-52 shrink-0 flex flex-col overflow-hidden"
      initial={false}
    >
      <p className="px-3 mb-1.5 text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest">
        Library
      </p>

      <NavItem label="All saves" count={totalCount} active={selected === null} onClick={() => onSelect(null)} />

      <AnimatePresence>
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-3 mt-5 mb-1.5 text-[10.5px] font-semibold text-[#C4C3C0] uppercase tracking-widest">
              Topics
            </p>
            {topics.map(({ name, count }) => (
              <NavItem
                key={name}
                label={name}
                count={count}
                active={selected === name}
                onClick={() => onSelect(name)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

function NavItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-left text-[13px] font-medium transition-colors duration-100 capitalize"
      style={{ color: active ? "#37352F" : "#9B9A97" }}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-[#E8E8E6]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative truncate">{label}</span>
      <span className="relative text-[11px] ml-2 shrink-0 tabular-nums" style={{ color: active ? "#787774" : "#C4C3C0" }}>
        {count}
      </span>
    </button>
  );
}
