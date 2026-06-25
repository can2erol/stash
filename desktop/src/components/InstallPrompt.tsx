interface Props {
  compact?: boolean;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-[#F1F1EF] text-[#37352F] font-sans text-[11px] border border-[#E8E8E6]">
      {children}
    </kbd>
  );
}

export function InstallPrompt({ compact = false }: Props) {
  if (compact) {
    return (
      <div className="px-3 py-3 border-t border-[#EFEFED]">
        <p className="text-[11px] text-[#9B9A97] leading-relaxed">
          Save any page with <Kbd>⌘⇧S</Kbd>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center max-w-xs">
      <div className="w-12 h-12 rounded-2xl bg-[#F1F1EF] flex items-center justify-center text-[22px] mb-4">
        📥
      </div>
      <p className="text-[15px] font-semibold text-[#37352F] mb-1">Nothing saved yet</p>
      <p className="text-[13px] text-[#787774] leading-relaxed mb-5">
        Install the Stash browser extension, then save any page in one click — or
        press <Kbd>⌘⇧S</Kbd> from anywhere.
      </p>
      <ol className="text-left text-[12.5px] text-[#787774] space-y-2 w-full">
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#EFEFED] text-[#787774] text-[11px] font-semibold flex items-center justify-center">1</span>
          <span>Install the Stash extension in your browser</span>
        </li>
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#EFEFED] text-[#787774] text-[11px] font-semibold flex items-center justify-center">2</span>
          <span>Open any article or video</span>
        </li>
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#EFEFED] text-[#787774] text-[11px] font-semibold flex items-center justify-center">3</span>
          <span>Click the Stash icon or press <Kbd>⌘⇧S</Kbd></span>
        </li>
      </ol>
    </div>
  );
}
