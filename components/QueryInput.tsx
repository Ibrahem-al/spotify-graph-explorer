"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  defaultValue?: string;
}

export function QueryInput({ onSubmit, isLoading, defaultValue = "" }: QueryInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultValue) setValue(defaultValue);
  }, [defaultValue]);

  // Focus input on "/" keypress from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement !== inputRef.current &&
        !["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName ?? "")
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q || isLoading) return;
    onSubmit(q);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <div
        className={clsx(
          "flex items-center gap-2 px-4 rounded-2xl border transition-all duration-150",
          "bg-[#1E293B]/80 backdrop-blur-md",
          "border-[#475569]",
          "focus-within:border-[#22C55E] focus-within:shadow-[0_0_20px_rgba(34,197,94,0.25)]",
          "h-14 lg:h-14"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about the Spotify graph…"
          disabled={isLoading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Graph query"
          className={clsx(
            "flex-1 bg-transparent text-[#F8FAFC] placeholder-[#94A3B8]",
            "text-base focus:outline-none min-w-0",
            "disabled:opacity-50"
          )}
        />
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          aria-label="Submit query"
          className={clsx(
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            "bg-[#22C55E] hover:bg-[#16A34A] transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          )}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-white" aria-hidden="true" />
          ) : (
            <ArrowUp size={18} className="text-white" aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
