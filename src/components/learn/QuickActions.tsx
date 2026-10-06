"use client";

import { BookOpen, ClipboardCheck, Code2, History, Play, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { useEntVisible } from "@/components/school/useEntVisible";

// Быстрые действия: горизонтальный ряд крупных чипов (на телефоне прокручивается).
// «Пробный ЕНТ» — только в треке ЕНТ (в школьном его нет, #52).

interface Action {
  href: string;
  icon: LucideIcon;
  label: string;
  tone: "main" | "streak" | "primary";
}

export function QuickActions({ continueId, dueCount, firstTime, resuming }: { continueId?: string; dueCount: number; firstTime?: boolean; resuming?: boolean }) {
  const { t } = useT();
  const ent = useEntVisible();
  const actions: Action[] = [
    ...(continueId ? [{ href: `/lesson/${continueId}`, icon: Play, label: firstTime && !resuming ? t("learn2.hero.start") : t("learn2.quick.continue"), tone: "main" as const }] : []),
    ...(dueCount > 0 ? [{ href: "/drill?mode=review", icon: History, label: t("learn2.quick.review", { n: dueCount }), tone: "streak" as const }] : []),
    ...(ent ? [{ href: "/exam", icon: ClipboardCheck, label: t("learn2.quick.exam"), tone: "primary" as const }] : []),
    { href: "/theory", icon: BookOpen, label: t("learn2.quick.theory"), tone: "primary" },
    { href: "/code", icon: Code2, label: t("learn2.quick.code"), tone: "primary" },
    { href: "/search", icon: Search, label: t("learn2.quick.search"), tone: "primary" },
  ];
  return (
    <nav aria-label={t("learn2.quick.label")} className="-mx-4 sm:-mx-6">
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 sm:px-6">
        {actions.map(({ href, icon: Icon, label, tone }, i) => (
          <li key={href} className="shrink-0 animate-rise-in" style={{ animationDelay: `${i * 40}ms` }}>
            <Link
              href={href}
              className={cn(
                "flex h-12 items-center gap-2 rounded-2xl pl-1.5 pr-4 text-[15px] font-extrabold transition-[translate,box-shadow] duration-75 active:translate-y-[3px] active:shadow-none",
                tone === "main"
                  ? "bg-action-primary text-white shadow-[0_4px_0_var(--action-primary-edge)]"
                  : "border-2 border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  tone === "main" && "bg-white/20",
                  tone === "streak" && "bg-streak-soft text-streak",
                  tone === "primary" && "bg-primary-soft text-primary",
                )}
              >
                <Icon size={19} fill={tone === "main" ? "currentColor" : "none"} />
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
