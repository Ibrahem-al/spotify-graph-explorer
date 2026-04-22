"use client";

import { useEffect } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { clsx } from "clsx";

export type ToastVariant = "error" | "success" | "info";

export type ToastData = {
  id: string;
  variant: ToastVariant;
  message: string;
};

const ICONS = {
  error: CircleAlert,
  success: CircleCheck,
  info: Info,
};

const STYLES = {
  error: "bg-red-500/10 border-red-500/50 text-red-200",
  success: "bg-green-500/10 border-green-500/50 text-green-200",
  info: "bg-sky-400/10 border-sky-400/30 text-sky-200",
};

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = ICONS[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss(toast.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full",
        "transition-all duration-200",
        STYLES[toast.variant]
      )}
    >
      <Icon className="shrink-0 mt-0.5" size={16} aria-hidden="true" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-44 left-4 right-4 lg:bottom-auto lg:top-6 lg:left-auto lg:right-6 z-50 flex flex-col gap-2 items-end"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
