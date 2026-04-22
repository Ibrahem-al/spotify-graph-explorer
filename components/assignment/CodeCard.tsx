"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { clsx } from "clsx";
import { codeToHtml } from "shiki";

type SupportedLang = "python" | "cypher" | "sql" | "typescript" | "bash";

interface CodeCardProps {
  code: string;
  lang?: SupportedLang;
  label?: string;
  filename?: string;
  maxHeight?: number | null;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shikiLang(lang: SupportedLang): string {
  if (lang === "cypher") return "sql";
  return lang;
}

export function CodeCard({
  code,
  lang = "python",
  label,
  filename,
  maxHeight = 380,
  className,
}: CodeCardProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    codeToHtml(code, {
      lang: shikiLang(lang),
      theme: "github-dark",
    })
      .then(setHtml)
      .catch(() =>
        setHtml(`<pre class="shiki-fallback">${escapeHtml(code)}</pre>`)
      );
  }, [code, lang]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={clsx(
        "relative rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E293B] bg-[#1E293B]/50 gap-3">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
          <span className="font-mono uppercase tracking-wider shrink-0">
            {label ?? lang}
          </span>
          {filename && (
            <span className="font-mono text-[#64748b] truncate">· {filename}</span>
          )}
        </div>
        <button
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code to clipboard"}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors shrink-0 whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400 shrink-0" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} className="shrink-0" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div
        className={clsx(
          "px-4 py-3 overflow-auto",
          "[&_pre]:!bg-transparent [&_pre]:!m-0",
          "[&_pre]:text-[13px] [&_pre]:font-mono",
          "[&_pre]:whitespace-pre"
        )}
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="text-[13px] font-mono text-[#CBD5E1] whitespace-pre">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}
