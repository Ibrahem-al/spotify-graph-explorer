"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import { MetaChips } from "./MetaChips";
import type { QueryMeta } from "@/hooks/useQuery";
import { codeToHtml } from "shiki";

interface CypherPanelProps {
  cypher: string;
  rationale: string;
  meta: QueryMeta;
  isPhone: boolean;
}

function CypherCode({ cypher }: { cypher: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    codeToHtml(cypher, {
      lang: "sql",
      theme: "github-dark",
    })
      .then(setHtml)
      .catch(() => setHtml(`<pre class="shiki-fallback">${escapeHtml(cypher)}</pre>`));
  }, [cypher]);

  if (!html) {
    return (
      <pre className="font-mono text-sm text-[#CBD5E1] whitespace-pre-wrap break-all">
        {cypher}
      </pre>
    );
  }

  return (
    <div
      className="[&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:text-sm [&_pre]:font-mono [&_pre]:whitespace-pre-wrap [&_pre]:break-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function CypherPanel({ cypher, rationale, meta, isPhone }: CypherPanelProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(cypher);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isPhone) {
    return (
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-30",
          "bg-[#1E293B] border-t border-[#475569]",
          "transition-all duration-300 ease-out",
          expanded ? "max-h-[85vh]" : "max-h-16"
        )}
      >
        {/* Peek / drag handle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 h-16 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          aria-label={expanded ? "Collapse Cypher panel" : "Expand Cypher panel"}
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#F8FAFC]">Cypher</span>
            <MetaChips {...meta} />
          </div>
          <ChevronUp
            size={18}
            className={clsx(
              "text-[#94A3B8] transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>

        {expanded && (
          <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: "calc(85vh - 64px)" }}>
            <PanelContent cypher={cypher} rationale={rationale} meta={meta} copied={copied} onCopy={copy} />
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="Cypher panel"
      className="flex flex-col gap-4 overflow-y-auto h-full"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Generated Cypher</h2>
        <MetaChips {...meta} />
      </div>
      <PanelContent cypher={cypher} rationale={rationale} meta={meta} copied={copied} onCopy={copy} />
    </aside>
  );
}

function PanelContent({
  cypher,
  rationale,
  copied,
  onCopy,
}: {
  cypher: string;
  rationale: string;
  meta: QueryMeta;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Rationale */}
      <div className="bg-sky-400/10 border border-sky-400/30 rounded-lg p-3">
        <p className="text-sm text-sky-200">{rationale}</p>
      </div>

      {/* Code block */}
      <div className="relative bg-[#1E293B] rounded-xl p-4">
        <button
          onClick={onCopy}
          aria-label={copied ? "Copied!" : "Copy Cypher to clipboard"}
          className={clsx(
            "absolute top-3 right-3 p-1.5 rounded-lg transition-colors duration-150",
            "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]",
            "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B]"
          )}
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
        <CypherCode cypher={cypher} />
      </div>
    </div>
  );
}
