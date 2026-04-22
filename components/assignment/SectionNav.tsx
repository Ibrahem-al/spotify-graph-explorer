"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  BookOpen,
  Database,
  FileCode2,
  FileText,
  ListChecks,
  Tag,
  Timer,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Database,
  FileCode2,
  FileText,
  ListChecks,
  Tag,
  Timer,
  CheckCircle2,
};

export type NavIconName = keyof typeof ICONS;

export interface NavItem {
  id: string;
  label: string;
  icon?: NavIconName;
}

interface SectionNavProps {
  items: NavItem[];
}

export function SectionNav({ items }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      aria-label="Assignment sections"
      className="flex flex-col gap-0.5 text-sm"
    >
      {items.map((item) => {
        const Icon = item.icon ? ICONS[item.icon] : undefined;
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            aria-current={active ? "true" : undefined}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              active
                ? "bg-[#22C55E]/12 text-[#22C55E] font-semibold"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]"
            )}
          >
            {Icon && (
              <Icon
                size={15}
                aria-hidden="true"
                className={active ? "text-[#22C55E]" : "text-[#64748b]"}
              />
            )}
            <span className="truncate">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
