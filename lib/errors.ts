import { NextResponse } from "next/server";

export enum ErrorCode {
  GENERATION_FAILED = "GENERATION_FAILED",
  VALIDATION_BLOCKED = "VALIDATION_BLOCKED",
  EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT",
  EXECUTION_FAILED = "EXECUTION_FAILED",
  RESULT_TOO_LARGE = "RESULT_TOO_LARGE",
  QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED",
  BAD_USER_KEY = "BAD_USER_KEY",
  RATE_LIMITED = "RATE_LIMITED",
}

const ERROR_META: Record<ErrorCode, { status: number; message: string; hint: string }> = {
  [ErrorCode.GENERATION_FAILED]: {
    status: 500,
    message: "Failed to generate a Cypher query.",
    hint: "Try rephrasing your question.",
  },
  [ErrorCode.VALIDATION_BLOCKED]: {
    status: 400,
    message: "Write clause detected in generated Cypher.",
    hint: "Try rephrasing as a read-only question.",
  },
  [ErrorCode.EXECUTION_TIMEOUT]: {
    status: 504,
    message: "Query took too long to execute.",
    hint: "Try a more specific question or add more filters.",
  },
  [ErrorCode.EXECUTION_FAILED]: {
    status: 500,
    message: "Query execution failed.",
    hint: "The query may reference something that doesn't exist in the graph.",
  },
  [ErrorCode.RESULT_TOO_LARGE]: {
    status: 400,
    message: "Result set too large.",
    hint: "Add a LIMIT or narrow your query.",
  },
  [ErrorCode.QUOTA_EXHAUSTED]: {
    status: 429,
    message: "Groq API quota exhausted.",
    hint: "Paste your own Groq API key to continue.",
  },
  [ErrorCode.BAD_USER_KEY]: {
    status: 401,
    message: "Invalid Groq API key.",
    hint: "Check your key at console.groq.com/keys and try again.",
  },
  [ErrorCode.RATE_LIMITED]: {
    status: 429,
    message: "Too many requests.",
    hint: "Wait a moment and try again.",
  },
};

export function errorResponse(code: ErrorCode, detail?: string) {
  const meta = ERROR_META[code];
  return NextResponse.json(
    {
      error: {
        code,
        message: detail ?? meta.message,
        hint: meta.hint,
      },
    },
    { status: meta.status }
  );
}

export function userFriendlyMessage(code: string): string {
  const meta = ERROR_META[code as ErrorCode];
  return meta ? meta.hint : "Something went wrong. Please try again.";
}
