import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchItems, searchItems, type BackendStatus } from "./api";
import type { Item } from "./types";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { ItemCard } from "./components/ItemCard";
import { InstallPrompt } from "./components/InstallPrompt";
import { DetailPanel } from "./components/DetailPanel";

const POLL_MS = 8000;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  status: BackendStatus | null;
  onOpenSettings: () => void;
}

export default function Library({ status, onOpenSettings }: Props) {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [searchResults, setSearchResults] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const debouncedQuery = useDebounce(query, 280);

  const loadItems = useCallback(async () => {
    try {
      const items = await fetchItems();
      setAllItems(items);
      setError(null);
    } catch {
      setError("Lost connection to the Stash engine — reconnecting…");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    const t = setInterval(loadItems, POLL_MS);
    return () => clearInterval(t);
  }, [loadItems]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults(null);
      return;
    }
    searchItems(debouncedQuery).then(setSearchResults).catch(() => setSearchResults([]));
  }, [debouncedQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the open panel in sync as polling refreshes items (pending → enriched).
  useEffect(() => {
    if (!selectedItem) return;
    const fresh = allItems.find((i) => i.id === selectedItem.id);
    if (fresh && fresh !== selectedItem) setSelectedItem(fresh);
  }, [allItems, selectedItem]);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allItems) {
      if (item.topic) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allItems]);

  const displayItems = useMemo<Item[]>(() => {
    if (searchResults !== null) return searchResults;
    if (selectedTopic) return allItems.filter((i) => i.topic === selectedTopic);
    return allItems;
  }, [searchResults, allItems, selectedTopic]);

  const isSearching = query.trim().length > 0;
  const pending = status?.counts.pending ?? 0;
  const keyMissing = status ? !status.key_configured : false;

  const heading = isSearching ? `"${query}"` : selectedTopic ? selectedTopic : "All saves";

  return (
    <div className="relative flex h-screen bg-white font-sans overflow-hidden select-none">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!isSearching && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 224, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="shrink-0 bg-[#FBFBFA] border-r border-[#EDECEA] flex flex-col py-5 px-2 overflow-hidden"
          >
            {/* Wordmark */}
            <div className="flex items-center gap-2 px-3 mb-6">
              <span className="grid place-items-center w-6 h-6 rounded-lg bg-[#37352F] text-white text-[12px]">
                S
              </span>
              <span className="font-semibold text-[14px] text-[#37352F] tracking-tight">Stash</span>
            </div>

            <Sidebar
              topics={topics}
              selected={selectedTopic}
              onSelect={(t) => {
                setSelectedTopic(t);
                setQuery("");
              }}
              totalCount={allItems.length}
            />

            <div className="mt-auto space-y-1">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-left text-[13px] font-medium text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFED] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
                {keyMissing && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" title="API key needed" />
                )}
              </button>
              <InstallPrompt compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[#EDECEA]">
          {isSearching && (
            <motion.button
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={() => setQuery("")}
              className="text-[#C4C3C0] hover:text-[#787774] transition-colors p-1 -ml-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
          )}

          <motion.h1 layout className="text-[13px] font-medium text-[#37352F] capitalize truncate">
            {heading}
          </motion.h1>

          {!isSearching && pending > 0 && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#9B9A97]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {pending} enriching
            </span>
          )}

          <div className="ml-auto w-52 shrink-0">
            <SearchBar
              value={query}
              onChange={(v) => {
                setQuery(v);
                if (v.trim()) setSelectedTopic(null);
              }}
              resultCount={isSearching ? displayItems.length : undefined}
            />
          </div>
        </div>

        {/* Key-missing banner */}
        <AnimatePresence>
          {keyMissing && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={onOpenSettings}
              className="mx-5 mt-3 flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[12.5px] text-amber-700 text-left hover:bg-amber-100/70 transition-colors"
            >
              <span className="text-[14px]">✨</span>
              <span>
                Add your Anthropic API key to start summarizing, tagging, and organizing saves
                automatically.
              </span>
              <span className="ml-auto font-medium whitespace-nowrap">Add key →</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12.5px] text-red-500"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <SkeletonList />
          ) : displayItems.length === 0 ? (
            <EmptyState isSearching={isSearching} />
          ) : (
            <AnimatePresence mode="popLayout">
              <div key={isSearching ? "search" : selectedTopic ?? "all"}>
                {displayItems.map((item, i) => (
                  <ItemCard key={item.id} item={item} index={i} onOpen={setSelectedItem} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Detail panel ────────────────────────────────────────── */}
      <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3.5 px-3 py-3">
          <div
            className="w-8 h-8 rounded-lg bg-[#F1F1EF] shrink-0 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
          <div className="flex-1 space-y-2 pt-0.5">
            <div
              className="h-3 bg-[#F1F1EF] rounded-full animate-pulse w-3/4"
              style={{ animationDelay: `${i * 60}ms` }}
            />
            <div
              className="h-3 bg-[#F1F1EF] rounded-full animate-pulse w-1/2"
              style={{ animationDelay: `${i * 60 + 30}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isSearching }: { isSearching: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full pb-16"
    >
      {isSearching ? (
        <>
          <p className="text-[15px] font-medium text-[#787774]">No results</p>
          <p className="text-[13px] text-[#C4C3C0] mt-1">Try a different phrase</p>
        </>
      ) : (
        <InstallPrompt />
      )}
    </motion.div>
  );
}
