"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, User } from "lucide-react";
import { QueryInput } from "@/components/QueryInput";
import { SuggestionChips } from "@/components/SuggestionChips";
import { CypherBlock } from "@/components/CypherBlock";
import { MetaChips } from "@/components/MetaChips";
import { ByoKeyModal } from "@/components/ByoKeyModal";
import { ResultsTable } from "@/components/ResultsTable";
import { ToastContainer, type ToastData } from "@/components/Toast";
import { PageTabs } from "@/components/assignment/PageTabs";
import { useQuery } from "@/hooks/useQuery";
import { useUserKey } from "@/hooks/useUserKey";
import { useIsPhone } from "@/hooks/useIsPhone";
import { generateCypherOllama } from "@/lib/ollama";

const GraphCanvas = dynamic(() => import("@/components/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A] rounded-xl">
      <div className="w-6 h-6 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function HomePage() {
  const { userKey, setUserKey } = useUserKey();
  const isPhone = useIsPhone();
  const { state, submit } = useQuery({ userKey });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [useOllamaMode, setUseOllamaMode] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastSeqRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new result or when thinking
  useEffect(() => {
    if (state.status !== "idle") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [state.status]);

  const addToast = useCallback((variant: ToastData["variant"], message: string) => {
    const id = `toast-${toastSeqRef.current++}`;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSubmit = useCallback(
    async (question: string) => {
      if (useOllamaMode) {
        try {
          const { cypher } = await generateCypherOllama({ question });
          const result = await submit(question, cypher);
          if (result?.error) {
            addToast("error", result.error.message ?? "Query failed.");
          }
        } catch (e: unknown) {
          addToast("error", (e as Error).message ?? "Ollama request failed.");
        }
        return;
      }

      const result = await submit(question);
      if (result?.error) {
        const code = result.error.code;
        if (code === "QUOTA_EXHAUSTED") {
          setPendingQuestion(question);
          setModalError(null);
          setModalOpen(true);
        } else if (code === "BAD_USER_KEY") {
          setPendingQuestion(question);
          setModalError(result.error.message ?? "Invalid API key.");
          setModalOpen(true);
        }
      }
    },
    [submit, useOllamaMode, addToast]
  );

  const handleModalSave = useCallback(
    async (key: string) => {
      setUserKey(key);
      setModalOpen(false);
      setModalError(null);

      if (pendingQuestion) {
        const result = await submit(pendingQuestion);
        if (result?.error && result.error.code === "BAD_USER_KEY") {
          setModalError(result.error.message ?? "Invalid API key.");
          setModalOpen(true);
        }
        setPendingQuestion(null);
      }
    },
    [pendingQuestion, setUserKey, submit]
  );

  const handleUseOllama = useCallback(() => {
    setUseOllamaMode(true);
    setModalOpen(false);
    addToast(
      "info",
      "Ollama mode enabled. Make sure Ollama is running with llama3.1 pulled."
    );
  }, [addToast]);

  const isLoading = state.status === "thinking";

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-[#F8FAFC]">
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-[#1E293B] bg-[#0F172A]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/15 flex items-center justify-center">
              <span className="text-[#22C55E] text-lg font-bold">⬡</span>
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="font-semibold text-sm text-[#F8FAFC] truncate">
                Spotify Graph Explorer
              </h1>
              <p className="text-xs text-[#64748b] truncate hidden md:block">
                Ask in plain English, get a Neo4j graph back
              </p>
            </div>
          </div>

          <PageTabs current="explorer" />

          <div className="flex items-center gap-1 shrink-0">
            {useOllamaMode && (
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
                Ollama
              </span>
            )}
            {userKey && !useOllamaMode && (
              <span className="text-xs bg-[#22C55E]/15 text-[#22C55E] px-2 py-1 rounded-full">
                Your key
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable conversation area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
          {/* Empty state */}
          {state.status === "idle" && (
            <div className="flex flex-col items-center text-center gap-5 py-8 sm:py-16">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/15 flex items-center justify-center">
                <Sparkles className="text-[#22C55E]" size={28} aria-hidden="true" />
              </div>
              <div className="max-w-md">
                <h2 className="text-[28px] font-bold tracking-tight mb-2">
                  Explore the Spotify graph
                </h2>
                <p className="text-[#94A3B8] text-[15px] leading-relaxed">
                  Ask a natural-language question about 90k tracks, 30k
                  artists, 46k albums, and 113 genres. Get back an interactive
                  graph plus the exact Cypher that was run.
                </p>
              </div>
            </div>
          )}

          {/* Conversation turns */}
          {state.status !== "idle" && (
            <>
              {/* User's question bubble */}
              <div className="flex gap-3 items-start animate-[fadeIn_200ms_ease-out]">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center">
                  <User size={14} className="text-[#CBD5E1]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-[#F8FAFC] text-[15px] leading-relaxed">
                    {(state as { question: string }).question}
                  </p>
                </div>
              </div>

              {/* Assistant response */}
              <div className="flex gap-3 items-start animate-[fadeIn_300ms_ease-out]">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#22C55E]/15 flex items-center justify-center">
                  <Sparkles size={14} className="text-[#22C55E]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">
                  {state.status === "thinking" && (
                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                      <div className="w-4 h-4 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
                      <span>Thinking…</span>
                    </div>
                  )}

                  {state.status === "error" && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                      {state.message}
                    </div>
                  )}

                  {state.status === "success" && (
                    <>
                      {/* Rationale */}
                      <p className="text-[#CBD5E1] text-[15px] leading-relaxed">
                        {state.rationale}
                      </p>

                      {/* Meta chips */}
                      <MetaChips {...state.meta} />

                      {/* Graph card — only when we actually have nodes */}
                      {state.nodes.length > 0 && (
                        <div className="relative w-full rounded-xl border border-[#334155] overflow-hidden h-[240px] sm:h-[420px]">
                          <GraphCanvas
                            nodes={state.nodes}
                            edges={state.edges}
                            isLoading={false}
                          />
                        </div>
                      )}

                      {/* Tabular results — for aggregates / scalar projections */}
                      {state.rows.length > 0 && state.nodes.length === 0 && (
                        <ResultsTable rows={state.rows} />
                      )}

                      {/* Both empty — genuine no-data result */}
                      {state.nodes.length === 0 && state.rows.length === 0 && (
                        <div className="rounded-xl border border-[#334155] bg-[#0B1120] px-4 py-6 text-center">
                          <p className="text-[#94A3B8] text-sm">
                            The query ran successfully but returned no results.
                          </p>
                        </div>
                      )}

                      {/* Cypher block */}
                      <CypherBlock cypher={state.cypher} />
                    </>
                  )}
                </div>
              </div>

            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Sticky footer: single-line suggestions + input */}
      <div className="shrink-0 border-t border-[#1E293B] bg-[#0F172A]/95 backdrop-blur-md">
        <div
          className="max-w-4xl mx-auto px-4 pt-2"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {/* Single-line horizontally-scrollable chips */}
          <div className="mb-2 -mx-1 px-1">
            <SuggestionChips
              onSelect={handleSubmit}
              disabled={isLoading}
              size="sm"
            />
          </div>
          <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />
          <p className="text-[10px] text-[#475569] text-center mt-2">
            Read-only Cypher · Press &quot;/&quot; to focus · Powered by Groq + Neo4j Aura
          </p>
        </div>
      </div>

      {/* BYO Key Modal */}
      <ByoKeyModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalError(null);
        }}
        onSave={handleModalSave}
        onUseOllama={handleUseOllama}
        isPhone={isPhone}
        error={modalError}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
