"use client";

import clsx from "clsx";
import { BookOpen, ChartColumn, Dumbbell, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Mascot } from "@/components/mascot/Mascot";
import { DailyGoalCard, LevelCard, LevelChip, StreakChip, WeakTopicsCard, XpChip } from "./Widgets";

const NAV: { href: string; key: DictKey; icon: typeof BookOpen; ai?: boolean }[] = [
  { href: "/learn", key: "nav.learn", icon: BookOpen },
  { href: "/practice", key: "nav.practice", icon: Dumbbell },
  { href: "/tutor", key: "nav.tutor", icon: Sparkles, ai: true },
  { href: "/notes", key: "nav.notes", icon: NotebookPen },
  { href: "/stats", key: "nav.stats", icon: ChartColumn },
];

function Avatar({ size = 36 }: { size?: number }) {
  const name = useApp((s) => s.profile.name);
  return (
    <span
      className="flex items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function Logo() {
  return (
    <Link href="/learn" className="flex items-center gap-2">
      <Mascot size={34} />
      <span className="text-lg font-black tracking-tight text-primary">Informatica</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh">
      {/* Десктоп: боковое меню */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-2 border-r-2 border-border bg-surface px-4 py-6 lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        {NAV.map(({ href, key, icon: Icon, ai }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex h-12 items-center gap-3 rounded-2xl border-2 px-3 font-extrabold transition-colors",
              active(href)
                ? ai
                  ? "border-ai/40 bg-ai-soft text-ai"
                  : "border-primary/40 bg-primary-soft text-primary"
                : "border-transparent text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon size={22} /> {t(key)}
          </Link>
        ))}
        <div className="flex-1" />
        <Link
          href="/profile"
          className={clsx(
            "flex h-12 items-center gap-3 rounded-2xl border-2 px-3 font-extrabold",
            active("/profile") ? "border-primary/40 bg-primary-soft text-primary" : "border-transparent text-muted hover:bg-surface-2",
          )}
        >
          <Avatar size={28} /> {t("nav.profile")}
        </Link>
      </aside>

      <div className="lg:pl-64">
        {/* Телефон: верхняя панель */}
        <header className="sticky top-0 z-20 border-b-2 border-border bg-bg/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4 pt-[env(safe-area-inset-top)]">
            <Logo />
            <div className="flex-1" />
            <StreakChip />
            <XpChip />
            <Link href="/profile" aria-label={t("nav.profile")}>
              <Avatar size={32} />
            </Link>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <main className="mx-auto w-full min-w-0 max-w-2xl flex-1">{children}</main>
          <aside className="sticky top-8 hidden h-fit w-80 shrink-0 flex-col gap-4 xl:flex">
            <div className="flex items-center justify-end gap-5 px-1">
              <StreakChip />
              <XpChip />
              <LevelChip />
            </div>
            <LevelCard />
            <DailyGoalCard />
            <WeakTopicsCard />
          </aside>
        </div>

        {/* Телефон: нижняя навигация */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {NAV.map(({ href, key, icon: Icon, ai }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition-colors",
                  active(href) ? (ai ? "text-ai" : "text-primary") : "text-muted",
                )}
              >
                <span className={clsx("flex h-8 w-12 items-center justify-center rounded-xl", active(href) && (ai ? "bg-ai-soft" : "bg-primary-soft"))}>
                  <Icon size={22} />
                </span>
                <span className="max-w-full truncate px-0.5">{t(key)}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
