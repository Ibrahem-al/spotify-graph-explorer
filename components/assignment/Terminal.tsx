"use client";

import { clsx } from "clsx";
import { Terminal as TerminalIcon } from "lucide-react";

interface TerminalProps {
  stdout: string;
  stderr?: string;
  state: "idle" | "running" | "success" | "error";
  label?: string;
  command?: string;
  durationMs?: number;
  truncated?: boolean;
  timedOut?: boolean;
  exitCode?: number | null;
  className?: string;
}

export function Terminal({
  stdout,
  stderr,
  state,
  label = "Terminal",
  command,
  durationMs,
  truncated,
  timedOut,
  exitCode,
  className,
}: TerminalProps) {
  if (state === "idle") return null;

  return (
    <div
      className={clsx(
        "rounded-xl border border-[#334155] bg-[#05080F] overflow-hidden font-mono",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#0B1120]">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <TerminalIcon size={13} aria-hidden="true" />
          <span className="uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {state === "running" && (
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              running
            </span>
          )}
          {state === "success" && (
            <span className="text-green-400">● exit 0</span>
          )}
          {state === "error" && (
            <span className="text-red-400">
              ● {timedOut ? "timeout" : `exit ${exitCode ?? "?"}`}
            </span>
          )}
          {typeof durationMs === "number" && (
            <span className="text-[#64748b]">· {formatDuration(durationMs)}</span>
          )}
        </div>
      </div>

      {command && (
        <div className="px-4 py-2 text-xs text-[#64748b] border-b border-[#1E293B]/70">
          <span className="text-[#22C55E]">$</span>{" "}
          <span className="text-[#CBD5E1]">{command}</span>
        </div>
      )}

      <pre className="px-4 py-3 text-[12.5px] leading-relaxed text-[#CBD5E1] overflow-auto max-h-[360px] whitespace-pre-wrap break-words">
        {stdout || (state === "running" ? "(no output yet)" : "")}
        {stderr && (
          <>
            {stdout ? "\n\n" : ""}
            <span className="text-red-400">{stderr}</span>
          </>
        )}
      </pre>

      {(truncated || timedOut) && (
        <div className="px-4 py-2 border-t border-[#1E293B] bg-[#1E293B]/30 text-[11px] text-amber-300">
          {timedOut && "Process timed out after 2 minutes. "}
          {truncated && "Output truncated to 256 KB."}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
