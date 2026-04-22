"use client";

import { useState } from "react";
import { Play, Loader2, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Terminal } from "./Terminal";

interface RunResponse {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  usedCommand: string;
  truncated: boolean;
  timedOut: boolean;
  scriptPath?: string;
}

export function PythonRunner({
  endpoint,
  scriptLabel,
  commandPreview,
}: {
  endpoint: string;
  scriptLabel: string;
  commandPreview: string;
}) {
  const [state, setState] = useState<"idle" | "running" | "success" | "error">(
    "idle"
  );
  const [data, setData] = useState<RunResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setNetworkError(null);
    setData(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json: RunResponse = await res.json();
      setData(json);
      setState(json.ok ? "success" : "error");
    } catch (e: unknown) {
      setNetworkError((e as Error).message ?? "Network error");
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={state === "running"}
          className={clsx(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap",
            "bg-[#22C55E] text-[#052e16] hover:bg-[#16A34A] transition-colors",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          )}
        >
          {state === "running" ? (
            <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" />
          ) : state === "success" || state === "error" ? (
            <RefreshCw size={16} className="shrink-0" aria-hidden="true" />
          ) : (
            <Play size={16} className="shrink-0" aria-hidden="true" />
          )}
          <span>
            {state === "running"
              ? `Running ${scriptLabel}…`
              : state === "idle"
              ? `Run ${scriptLabel}`
              : `Re-run ${scriptLabel}`}
          </span>
        </button>

        <span className="text-xs text-[#64748b]">
          Executes locally on this machine · cloud graph is never touched
        </span>
      </div>

      {networkError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {networkError}
        </div>
      )}

      <Terminal
        state={state === "running" ? "running" : state === "success" ? "success" : state === "error" ? "error" : "idle"}
        label={`Output · ${scriptLabel}`}
        command={data?.usedCommand || commandPreview}
        stdout={data?.stdout ?? ""}
        stderr={data?.stderr ?? ""}
        durationMs={data?.durationMs}
        exitCode={data?.exitCode}
        truncated={data?.truncated}
        timedOut={data?.timedOut}
      />
    </div>
  );
}
