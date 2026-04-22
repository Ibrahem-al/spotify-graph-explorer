"use client";

import { useReducer, useCallback } from "react";
import type { ShapedNode, ShapedEdge } from "@/lib/shape";

export type QueryStatus = "idle" | "thinking" | "success" | "error";

export type QueryMeta = {
  ms: number;
  nodeCount: number;
  edgeCount: number;
  rowCount: number;
  truncated: boolean;
};

export type QueryState =
  | { status: "idle" }
  | { status: "thinking"; question: string }
  | {
      status: "success";
      question: string;
      cypher: string;
      rationale: string;
      nodes: ShapedNode[];
      edges: ShapedEdge[];
      rows: Record<string, unknown>[];
      meta: QueryMeta;
    }
  | { status: "error"; question: string; code: string; message: string };

type Action =
  | { type: "SUBMIT"; question: string }
  | {
      type: "SUCCESS";
      question: string;
      cypher: string;
      rationale: string;
      nodes: ShapedNode[];
      edges: ShapedEdge[];
      rows: Record<string, unknown>[];
      meta: QueryMeta;
    }
  | { type: "ERROR"; question: string; code: string; message: string }
  | { type: "RESET" };

function reducer(state: QueryState, action: Action): QueryState {
  switch (action.type) {
    case "SUBMIT":
      return { status: "thinking", question: action.question };
    case "SUCCESS":
      return {
        status: "success",
        question: action.question,
        cypher: action.cypher,
        rationale: action.rationale,
        nodes: action.nodes,
        edges: action.edges,
        rows: action.rows,
        meta: action.meta,
      };
    case "ERROR":
      return { status: "error", question: action.question, code: action.code, message: action.message };
    case "RESET":
      return { status: "idle" };
    default:
      return state;
  }
}

export function useQuery(opts: { userKey: string | null }) {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  const submit = useCallback(
    async (question: string, prebuiltCypher?: string) => {
      dispatch({ type: "SUBMIT", question });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (opts.userKey) headers["x-user-groq-key"] = opts.userKey;

      const body: Record<string, string> = { question };
      if (prebuiltCypher) body.cypher = prebuiltCypher;

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          dispatch({
            type: "ERROR",
            question,
            code: data?.error?.code ?? "UNKNOWN",
            message: data?.error?.hint ?? data?.error?.message ?? "Something went wrong.",
          });
          return { error: data?.error };
        }

        dispatch({
          type: "SUCCESS",
          question,
          cypher: data.cypher,
          rationale: data.rationale,
          nodes: data.nodes ?? [],
          edges: data.edges ?? [],
          rows: data.rows ?? [],
          meta: data.meta,
        });
        return { error: null };
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? "Network error.";
        dispatch({ type: "ERROR", question, code: "NETWORK_ERROR", message: msg });
        return { error: { code: "NETWORK_ERROR", message: msg } };
      }
    },
    [opts.userKey]
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, submit, reset };
}
