"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  FileText,
  Loader2,
  AlertCircle,
  HardDrive,
  RefreshCw,
} from "lucide-react";

type CSVName =
  | "tracks.csv"
  | "artists.csv"
  | "albums.csv"
  | "genres.csv"
  | "rel_performed_by.csv"
  | "rel_belongs_to.csv"
  | "rel_has_genre.csv";

interface PreviewResponse {
  file: string;
  exists: boolean;
  sizeBytes: number;
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number | null;
  previewCount: number;
  modifiedAt: string;
}

const FILES: { name: CSVName; kind: "node" | "rel"; description: string }[] = [
  { name: "tracks.csv", kind: "node", description: "One row per unique track_id, with features and metadata." },
  { name: "artists.csv", kind: "node", description: "Distinct artist names, extracted and sorted from the semicolon-separated artists column." },
  { name: "albums.csv", kind: "node", description: "Distinct album names. Two real albums with the same name will merge — accepted by the brief." },
  { name: "genres.csv", kind: "node", description: "Distinct track_genre values from the cleaned base." },
  { name: "rel_performed_by.csv", kind: "rel", description: "track_id → artist_name. One row per (track, artist) pair." },
  { name: "rel_belongs_to.csv", kind: "rel", description: "track_id → album_name. One row per track." },
  { name: "rel_has_genre.csv", kind: "rel", description: "track_id → track_genre. One row per track (one chosen genre)." },
];

export function CSVBrowser() {
  const [active, setActive] = useState<CSVName>("tracks.csv");
  const [dataByFile, setDataByFile] = useState<Partial<Record<CSVName, PreviewResponse>>>({});
  const [errorByFile, setErrorByFile] = useState<Partial<Record<CSVName, string>>>({});
  const [loadingFile, setLoadingFile] = useState<CSVName | null>(null);

  const load = useCallback(async (file: CSVName, force = false) => {
    if (!force && dataByFile[file]) return;
    setLoadingFile(file);
    setErrorByFile((prev) => ({ ...prev, [file]: undefined }));
    try {
      const res = await fetch(
        `/api/assignment/csv-preview?file=${encodeURIComponent(file)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setErrorByFile((prev) => ({
          ...prev,
          [file]: json?.error ?? "Failed to load preview.",
        }));
        return;
      }
      setDataByFile((prev) => ({ ...prev, [file]: json }));
    } catch (e: unknown) {
      setErrorByFile((prev) => ({
        ...prev,
        [file]: (e as Error).message ?? "Network error",
      }));
    } finally {
      setLoadingFile(null);
    }
  }, [dataByFile]);

  useEffect(() => {
    load(active);
  }, [active, load]);

  const current = dataByFile[active];
  const err = errorByFile[active];
  const meta = FILES.find((f) => f.name === active);

  return (
    <div className="flex flex-col gap-5">
      {/* File tabs */}
      <div className="flex flex-wrap gap-2">
        {FILES.map((f) => {
          const isActive = f.name === active;
          return (
            <button
              key={f.name}
              onClick={() => setActive(f.name)}
              className={clsx(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-mono transition-colors whitespace-nowrap",
                "border",
                isActive
                  ? "bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]"
                  : "border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]"
              )}
            >
              <FileText size={13} aria-hidden="true" className="shrink-0" />
              <span>{f.name}</span>
              <span
                className={clsx(
                  "text-[10px] uppercase tracking-widest font-sans font-bold px-1.5 py-0.5 rounded shrink-0",
                  f.kind === "node"
                    ? "bg-violet-400/15 text-violet-300"
                    : "bg-orange-400/15 text-orange-300"
                )}
              >
                {f.kind}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description + metadata bar */}
      <div className="rounded-xl border border-[#334155] bg-[#0B1120] p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <code className="font-mono text-sm text-[#F8FAFC] font-semibold">
                {active}
              </code>
              {meta?.kind === "node" ? (
                <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-violet-400/15 text-violet-300">
                  Node CSV
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-orange-400/15 text-orange-300">
                  Relationship CSV
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8]">{meta?.description}</p>
          </div>

          <button
            onClick={() => load(active, true)}
            disabled={loadingFile === active}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] disabled:opacity-50 whitespace-nowrap"
            aria-label={`Refresh ${active}`}
          >
            <RefreshCw
              size={13}
              className={clsx("shrink-0", loadingFile === active ? "animate-spin" : "")}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>

        {current && (
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <Pill>
              <HardDrive size={10} aria-hidden="true" />
              {formatBytes(current.sizeBytes)}
            </Pill>
            {current.totalRows !== null && (
              <Pill>{current.totalRows.toLocaleString()} rows</Pill>
            )}
            <Pill>{current.columns.length} columns</Pill>
            <Pill>
              Preview: first {current.previewCount}
            </Pill>
          </div>
        )}
      </div>

      {/* Error */}
      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      )}

      {/* Loading */}
      {loadingFile === active && !current && (
        <div className="rounded-xl border border-[#334155] bg-[#0B1120] px-4 py-6 text-center text-sm text-[#94A3B8] flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading preview…
        </div>
      )}

      {/* Preview table */}
      {current && current.rows.length > 0 && (
        <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0B1120] border-b border-[#1E293B] z-10">
                <tr>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wider text-[#64748b] w-12">
                    #
                  </th>
                  {current.columns.map((col) => (
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
                {current.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={clsx(
                      "border-b border-[#1E293B]/50",
                      i % 2 === 0 ? "bg-transparent" : "bg-[#1E293B]/20"
                    )}
                  >
                    <td className="px-3 py-1.5 text-right text-[11px] text-[#475569] font-mono">
                      {i + 1}
                    </td>
                    {current.columns.map((col) => {
                      const v = row[col];
                      return (
                        <td
                          key={col}
                          className="px-4 py-1.5 whitespace-nowrap text-[#CBD5E1] text-[13px] font-mono"
                        >
                          {v === "" || v === undefined ? (
                            <span className="text-[#475569]">—</span>
                          ) : (
                            v
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1E293B] text-[#CBD5E1]">
      {children}
    </span>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
