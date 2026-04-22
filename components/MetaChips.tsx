"use client";

import { clsx } from "clsx";

interface MetaChipsProps {
  ms: number;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
}

function msColor(ms: number): string {
  if (ms < 500) return "text-green-400";
  if (ms < 2000) return "text-amber-400";
  return "text-red-400";
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
        "bg-[#334155]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function MetaChips({ ms, nodeCount, edgeCount, truncated }: MetaChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="status" aria-label="Query metadata">
      <Chip className={msColor(ms)}>{ms} ms</Chip>
      <Chip className="text-[#CBD5E1]">{nodeCount} nodes</Chip>
      <Chip className="text-[#CBD5E1]">{edgeCount} edges</Chip>
      {truncated && <Chip className="text-amber-400">truncated</Chip>}
    </div>
  );
}
