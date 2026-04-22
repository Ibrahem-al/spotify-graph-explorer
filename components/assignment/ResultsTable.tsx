"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { Table2 } from "lucide-react";

interface ResultsTableProps {
  rows: Record<string, unknown>[];
  columns?: string[];
  maxRows?: number;
  title?: string;
  simulated?: boolean;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? v.toString()
      : v.toFixed(4).replace(/\.?0+$/, "");
  }
  if (typeof v === "boolean") return v.toString();
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ResultsTable({
  rows,
  columns,
  maxRows = 50,
  title = "Results",
  simulated,
}: ResultsTableProps) {
  const { cols, display, extra } = useMemo(() => {
    if (rows.length === 0) return { cols: [] as string[], display: [], extra: 0 };
    const c =
      columns && columns.length > 0
        ? columns
        : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const capped = rows.slice(0, maxRows);
    return {
      cols: c,
      display: capped,
      extra: Math.max(0, rows.length - maxRows),
    };
  }, [rows, columns, maxRows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#334155] bg-[#0B1120] px-4 py-6 text-center">
        <p className="text-[#94A3B8] text-sm">
          No rows returned.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#1E293B]/50">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Table2 size={13} aria-hidden="true" />
          <span className="font-mono uppercase tracking-wider">
            {title} · {rows.length.toLocaleString()} row
            {rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {simulated && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
            Simulated
          </span>
        )}
      </div>

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0B1120] border-b border-[#1E293B] z-10">
            <tr>
              {cols.map((col) => (
                <th
                  key={col}
                  className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-[#64748b] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-b border-[#1E293B]/50",
                  i % 2 === 0 ? "bg-transparent" : "bg-[#1E293B]/20"
                )}
              >
                {cols.map((col) => {
                  const v = row[col];
                  const isNum = typeof v === "number";
                  return (
                    <td
                      key={col}
                      className={clsx(
                        "px-4 py-2 whitespace-nowrap",
                        isNum
                          ? "font-mono text-[#22C55E] text-right"
                          : "text-[#CBD5E1]"
                      )}
                    >
                      {formatValue(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {extra > 0 && (
        <div className="px-4 py-2 text-xs text-[#64748b] border-t border-[#1E293B] bg-[#1E293B]/30 text-center">
          Showing first {maxRows.toLocaleString()} · {extra.toLocaleString()} more hidden
        </div>
      )}
    </div>
  );
}
