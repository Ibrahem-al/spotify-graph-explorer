"use client";

import { CircleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="bg-[#1E293B] rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
        <CircleAlert size={40} className="text-red-400" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-[#F8FAFC]">Something went wrong</h1>
        <p className="text-sm text-[#94A3B8]">{error.message ?? "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl text-sm font-medium transition-colors duration-150"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
