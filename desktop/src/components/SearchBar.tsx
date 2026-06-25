interface Props {
  value: string;
  onChange: (v: string) => void;
  resultCount?: number;
}

export function SearchBar({ value, onChange, resultCount }: Props) {
  return (
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C4C3C0] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 pl-8 pr-3 bg-[#EFEFED] rounded-lg text-[12.5px] text-[#37352F] placeholder-[#C4C3C0] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#E8E8E6] transition-all duration-150"
      />
      {value && resultCount !== undefined && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#C4C3C0] tabular-nums pointer-events-none">
          {resultCount}
        </span>
      )}
    </div>
  );
}
