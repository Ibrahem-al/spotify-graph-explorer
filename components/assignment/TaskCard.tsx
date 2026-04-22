"use client";

import { useState } from "react";
import { Play, Timer, AlertCircle, Loader2, Sparkles, ShieldOff } from "lucide-react";
import { clsx } from "clsx";
import { CodeCard } from "./CodeCard";
import { ResultsTable } from "./ResultsTable";
import type { TaskDefinition } from "@/lib/assignment/tasks";

interface TaskRunResponse {
  id: number;
  title: string;
  kind: "read" | "write";
  query: string;
  simulated: boolean;
  simulatedQuery?: string | null;
  simulatedFrom?: Record<string, unknown> | null;
  artistFound?: boolean;
  rows: Record<string, unknown>[];
  columns: string[];
  ms: number;
  truncated: boolean;
  note: string | null;
}

interface TimingResponse {
  id: number;
  simulated: boolean;
  runs: number;
  times: number[];
  avgMs: number;
  minMs: number;
  maxMs: number;
  queryTimed: string;
  note: string | null;
}

interface TaskCardProps {
  task: TaskDefinition;
}

export function TaskCard({ task }: TaskCardProps) {
  const [runState, setRunState] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [timeState, setTimeState] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [runData, setRunData] = useState<TaskRunResponse | null>(null);
  const [timeData, setTimeData] = useState<TimingResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const runOnce = async () => {
    setRunState("running");
    setRunError(null);
    try {
      const res = await fetch("/api/assignment/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Query failed");
      setRunData(json);
      setRunState("done");
    } catch (e: unknown) {
      setRunError((e as Error).message ?? "Query failed");
      setRunState("error");
    }
  };

  const runTiming = async () => {
    setTimeState("running");
    setTimeError(null);
    try {
      const res = await fetch("/api/assignment/timing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, runs: 10 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Timing failed");
      setTimeData(json);
      setTimeState("done");
    } catch (e: unknown) {
      setTimeError((e as Error).message ?? "Timing failed");
      setTimeState("error");
    }
  };

  const isWrite = task.kind === "write";

  return (
    <article
      id={`task-${task.id}`}
      className="rounded-xl border border-[#334155] bg-[#0B1120]/60 p-5 sm:p-6 flex flex-col gap-5 scroll-mt-24"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center text-[11px] font-black uppercase tracking-widest text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2.5 py-1 rounded-full whitespace-nowrap">
            Task {task.id}
          </span>
          {isWrite && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              <ShieldOff size={11} aria-hidden="true" />
              Simulated write
            </span>
          )}
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-[#F8FAFC] leading-snug">
          {task.title}
        </h3>
        <p className="text-sm text-[#94A3B8] leading-relaxed">{task.summary}</p>
      </header>

      <CodeCard
        code={task.query}
        lang="cypher"
        label="Cypher"
        filename={`Q${task.id}.cypher`}
        maxHeight={240}
      />

      <div className="flex flex-wrap items-center gap-3">
        <RunPill
          icon={runState === "running" ? Loader2 : Play}
          spinning={runState === "running"}
          disabled={runState === "running"}
          onClick={runOnce}
          variant="brand"
        >
          {runState === "running" ? "Running…" : isWrite ? "Simulate query" : "Run query"}
        </RunPill>

        <RunPill
          icon={timeState === "running" ? Loader2 : Timer}
          spinning={timeState === "running"}
          disabled={timeState === "running"}
          onClick={runTiming}
          variant="ghost"
        >
          {timeState === "running" ? "Timing 10 runs…" : "Time 10 runs"}
        </RunPill>

        {runState === "done" && runData && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[#94A3B8] whitespace-nowrap">
            <Sparkles size={13} className="text-[#22C55E]" aria-hidden="true" />
            {runData.ms} ms · {runData.rows.length} row
            {runData.rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {runError && (
        <ErrorBanner message={runError} />
      )}

      {runState === "done" && runData && (
        <div className="flex flex-col gap-3">
          {runData.note && (
            <div
              className={clsx(
                "rounded-lg border px-3 py-2 text-xs",
                runData.simulated
                  ? "bg-amber-400/5 border-amber-400/30 text-amber-200"
                  : "bg-sky-400/5 border-sky-400/30 text-sky-200"
              )}
            >
              {runData.note}
            </div>
          )}

          {runData.simulated && runData.simulatedFrom && (
            <div className="text-xs text-[#94A3B8]">
              <span className="font-semibold text-[#CBD5E1]">Current value in graph:</span>{" "}
              <code className="font-mono text-[#22C55E]">
                {JSON.stringify(runData.simulatedFrom)}
              </code>
            </div>
          )}

          <ResultsTable
            rows={runData.rows}
            columns={runData.columns}
            simulated={runData.simulated}
            maxRows={50}
          />
        </div>
      )}

      {timeError && <ErrorBanner message={timeError} />}

      {timeState === "done" && timeData && (
        <TimingBlock data={timeData} />
      )}
    </article>
  );
}

function RunPill({
  icon: Icon,
  spinning,
  disabled,
  onClick,
  variant = "brand",
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  spinning?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: "brand" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
        variant === "brand"
          ? "bg-[#22C55E] text-[#052e16] hover:bg-[#16A34A]"
          : "border border-[#334155] text-[#CBD5E1] hover:bg-[#1E293B]"
      )}
    >
      <Icon
        size={15}
        aria-hidden
        className={clsx("shrink-0", spinning ? "animate-spin" : undefined)}
      />
      <span>{children}</span>
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
      <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function TimingBlock({ data }: { data: TimingResponse }) {
  const max = Math.max(...data.times, 1);
  return (
    <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#1E293B]/50">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Timer size={13} aria-hidden="true" />
          <span className="font-mono uppercase tracking-wider">
            Timing · {data.runs} runs
          </span>
        </div>
        {data.simulated && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
            Simulated
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Average" value={`${data.avgMs.toFixed(2)} ms`} accent />
          <Metric label="Min" value={`${data.minMs.toFixed(2)} ms`} />
          <Metric label="Max" value={`${data.maxMs.toFixed(2)} ms`} />
        </div>

        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {data.times.map((t, i) => (
            <div key={i} className="flex flex-col gap-1 items-center">
              <div
                className="w-full rounded-sm bg-[#22C55E]/40 border-t-2 border-[#22C55E]"
                style={{
                  height: `${Math.max(6, Math.round((t / max) * 80))}px`,
                }}
                title={`Run ${i + 1}: ${t.toFixed(2)} ms`}
                aria-label={`Run ${i + 1}: ${t.toFixed(2)} ms`}
              />
              <div className="text-[9px] text-[#64748b] font-mono">
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[#1E293B] bg-[#05080F] overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B]">
                <th className="text-left px-3 py-1.5 text-[#64748b] font-semibold">Run</th>
                <th className="text-right px-3 py-1.5 text-[#64748b] font-semibold">Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {data.times.map((t, i) => (
                <tr key={i} className="border-b border-[#1E293B]/40 last:border-0">
                  <td className="px-3 py-1 text-[#94A3B8]">Run {i + 1}</td>
                  <td className="px-3 py-1 text-right text-[#22C55E]">
                    {t.toFixed(3)}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#22C55E]/5">
                <td className="px-3 py-1.5 text-[#CBD5E1] font-semibold">Average</td>
                <td className="px-3 py-1.5 text-right text-[#22C55E] font-bold">
                  {data.avgMs.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {data.note && (
          <p className="text-[11px] text-amber-300/90">{data.note}</p>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2",
        accent
          ? "border-[#22C55E]/30 bg-[#22C55E]/10"
          : "border-[#334155] bg-[#0B1120]"
      )}
    >
      <div className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">
        {label}
      </div>
      <div
        className={clsx(
          "font-mono text-base font-bold",
          accent ? "text-[#22C55E]" : "text-[#CBD5E1]"
        )}
      >
        {value}
      </div>
    </div>
  );
}
