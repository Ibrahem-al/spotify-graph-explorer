"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink, Key } from "lucide-react";
import { clsx } from "clsx";

interface ByoKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  onUseOllama?: () => void;
  isPhone: boolean;
  error?: string | null;
}

export function ByoKeyModal({
  isOpen,
  onClose,
  onSave,
  onUseOllama,
  isPhone,
  error,
}: ByoKeyModalProps) {
  const [key, setKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setKey("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative bg-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-10"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-[#22C55E]" aria-hidden="true" />
            <h2 id="modal-title" className="text-base font-semibold text-[#F8FAFC]">
              Free quota reached
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <ol className="flex flex-col gap-3 mb-5">
          {[
            {
              label: "Open Groq Console",
              href: "https://console.groq.com/keys",
            },
            {
              label: "Create a free API key",
              href: "https://console.groq.com/keys",
            },
            { label: "Paste it below", href: null },
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-[#CBD5E1]">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#334155] flex items-center justify-center text-xs font-semibold text-[#F8FAFC]">
                {i + 1}
              </span>
              {step.href ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#22C55E] underline underline-offset-2 inline-flex items-center gap-1 transition-colors"
                >
                  {step.label}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                <span>{step.label}</span>
              )}
            </li>
          ))}
        </ol>

        {/* Key input */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label htmlFor="groq-key" className="text-sm font-medium text-[#CBD5E1]">
            Your Groq API key
          </label>
          <input
            ref={inputRef}
            id="groq-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="gsk_..."
            autoComplete="off"
            className={clsx(
              "w-full px-4 py-2.5 rounded-xl text-sm",
              "bg-[#0F172A] border text-[#F8FAFC] placeholder-[#64748b]",
              "focus:outline-none focus:ring-2 focus:ring-[#22C55E]",
              error ? "border-red-500" : "border-[#475569]"
            )}
          />
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-[#64748b]">
              Stored only in your browser. Never sent to us.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className={clsx(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
              "bg-[#22C55E] hover:bg-[#16A34A] text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B]"
            )}
          >
            Save &amp; retry
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          >
            Cancel
          </button>

          {!isPhone && onUseOllama && (
            <button
              onClick={onUseOllama}
              className="w-full py-2 rounded-xl text-xs text-[#64748b] hover:text-[#94A3B8] transition-colors duration-150"
            >
              Use Ollama locally instead (desktop only)
            </button>
          )}

          {isPhone && (
            <p className="text-xs text-center text-[#64748b] px-2">
              Local models need a laptop. Try your own Groq key, or check back later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
