"use client";

import { useMemo } from "react";
import { Table2 } from "lucide-react";
import { clsx } from "clsx";

interface ResultsTableProps {
  rows: Record<string, unknown>[];
  maxRows?: number;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toString() : v.toFixed(3).replace(/\.?0+$/, "");
  }
  if (typeof v === "boolean") return v.toString();
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("__node" in obj) return `(${String(obj.__node)})`;
    if ("__edge" in obj) return `[${String(obj.__edge)}]`;
    return JSON.stringify(v);
  }
  return String(v);
}

export function ResultsTable({ rows, maxRows = 100 }: ResultsTableProps) {
  const { columns, displayRows, truncatedBy } = useMemo(() => {
    if (rows.length === 0) {
      return { columns: [] as string[], displayRows: [], truncatedBy: 0 };
    }
    const cols = Array.from(
      new Set(rows.flatMap((r) => Object.keys(r)))
    );
    const capped = rows.slice(0, maxRows);
    return {
      columns: cols,
      displayRows: capped,
      truncatedBy: Math.max(0, rows.length - maxRows),
    };
  }, [rows, maxRows]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#1E293B]/50">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Table2 size={13} aria-hidden="true" />
          <span className="font-mono uppercase tracking-wider">
            Results · {rows.length.toLocaleString()} row
            {rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0B1120] border-b border-[#1E293B] z-10">
            <tr>
              {columns.map((col) => (
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
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-b border-[#1E293B]/50",
                  i % 2 === 0 ? "bg-transparent" : "bg-[#1E293B]/20"
                )}
              >
                {columns.map((col) => {
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

      {truncatedBy > 0 && (
        <div className="px-4 py-2 text-xs text-[#64748b] border-t border-[#1E293B] bg-[#1E293B]/30 text-center">
          Showing first {maxRows.toLocaleString()} rows · {truncatedBy.toLocaleString()} more hidden
        </div>
      )}
    </div>
  );
}
