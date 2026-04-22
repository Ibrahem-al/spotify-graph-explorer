"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Sparkles, GraduationCap } from "lucide-react";

interface PageTabsProps {
  current: "explorer" | "assignment";
}

export function PageTabs({ current }: PageTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="App sections"
      className="inline-flex items-center gap-1 p-1 rounded-xl border border-[#334155] bg-[#0B1120]"
    >
      <TabLink
        href="/"
        active={current === "explorer"}
        icon={<Sparkles size={14} aria-hidden="true" className="shrink-0" />}
        label="Explorer"
      />
      <TabLink
        href="/assignment"
        active={current === "assignment"}
        icon={<GraduationCap size={14} aria-hidden="true" className="shrink-0" />}
        label="Assignment"
      />
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={clsx(
        "inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold transition-colors whitespace-nowrap",
        active
          ? "bg-[#22C55E]/15 text-[#22C55E] shadow-[inset_0_0_0_1px_rgba(34,197,94,0.35)]"
          : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
