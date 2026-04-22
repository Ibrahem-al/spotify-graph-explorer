"use client";

import { clsx } from "clsx";

const SUGGESTIONS = [
  "List 20 tracks by Taylor Swift",
  "Show tracks with popularity over 85",
  "Find tracks with 'love' in the title",
  "Upbeat danceable tracks",
  "Average popularity by genre",
  "Top 10 genres by track count",
];

interface SuggestionChipsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function SuggestionChips({
  onSelect,
  disabled,
  size = "md",
}: SuggestionChipsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-none scroll-smooth"
      role="list"
      aria-label="Suggested queries"
    >
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          role="listitem"
          onClick={() => onSelect(s)}
          disabled={disabled}
          className={clsx(
            "shrink-0 rounded-full whitespace-nowrap border",
            size === "sm"
              ? "px-3 py-1.5 text-xs"
              : "px-4 py-2 text-sm",
            "bg-[#1E293B]/70 hover:bg-[#334155] border-[#334155] hover:border-[#475569]",
            "text-[#CBD5E1] hover:text-[#F8FAFC]",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
