"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Code2 } from "lucide-react";
import { clsx } from "clsx";
import { codeToHtml } from "shiki";

interface CypherBlockProps {
  cypher: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function CypherBlock({ cypher }: CypherBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    codeToHtml(cypher, {
      lang: "sql",
      theme: "github-dark",
    })
      .then(setHtml)
      .catch(() =>
        setHtml(`<pre class="shiki-fallback">${escapeHtml(cypher)}</pre>`)
      );
  }, [cypher]);

  const copy = async () => {
    await navigator.clipboard.writeText(cypher);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#1E293B]/50">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Code2 size={13} aria-hidden="true" />
          <span className="font-mono uppercase tracking-wider">Cypher</span>
        </div>
        <button
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy Cypher to clipboard"}
          className={clsx(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
            "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]",
            "transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120]"
          )}
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div
        className={clsx(
          "px-4 py-3 overflow-x-auto",
          "[&_pre]:!bg-transparent [&_pre]:!m-0",
          "[&_pre]:text-[13px] [&_pre]:font-mono",
          "[&_pre]:whitespace-pre [&_pre]:break-normal"
        )}
        aria-label="Cypher query"
      >
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="text-sm font-mono text-[#CBD5E1] whitespace-pre">
            {cypher}
          </pre>
        )}
      </div>
    </div>
  );
}
