"use client";

import clsx from "clsx";
import { BookOpen, Calculator, ChartColumn, Dumbbell, NotebookPen, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HeartChip } from "@/components/economy/HeartGate";
import { ProfileAvatar } from "@/components/economy/ProfileAvatar";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Mascot } from "@/components/mascot/Mascot";
import { StreakChipAnimated, XpChipAnimated } from "@/components/motion/AnimatedChips";
import { easeOut } from "@/components/motion/presets";
import { DailyGoalCard, LevelCard, LevelChip, WeakTopicsCard } from "./Widgets";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { useToolbox } from "@/components/tools/useToolbox";

const NAV: { href: string; key: DictKey; icon: typeof BookOpen; ai?: boolean }[] = [
  { href: "/learn", key: "nav.learn", icon: BookOpen },
  { href: "/practice", key: "nav.practice", icon: Dumbbell },
  { href: "/tutor", key: "nav.tutor", icon: Sparkles, ai: true },
  { href: "/notes", key: "nav.notes", icon: NotebookPen },
  { href: "/stats", key: "nav.stats", icon: ChartColumn },
];

function Logo() {
  return (
    <Link href="/learn" className="flex items-center gap-2">
      <Mascot size={34} />
      <span className="hidden text-lg font-black tracking-tight text-primary min-[400px]:inline">Informatica</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeIndex = NAV.findIndex((n) => active(n.href));

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
            aria-current={active(href) ? "page" : undefined}
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
        <Link href="/shop" aria-current={active("/shop") ? "page" : undefined} className="flex h-12 items-center gap-3 rounded-2xl px-3 font-extrabold text-danger hover:bg-surface-2"><HeartChip /> {t("economy.shop")}</Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => useToolbox.getState().toggle()}
          className="flex h-12 items-center gap-3 rounded-2xl border-2 border-transparent px-3 font-extrabold text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Calculator size={22} /> {t("tools.open")}
        </button>
        <Link
          href="/profile"
          className={clsx(
            "flex h-12 items-center gap-3 rounded-2xl border-2 px-3 font-extrabold",
            active("/profile") ? "border-primary/40 bg-primary-soft text-primary" : "border-transparent text-muted hover:bg-surface-2",
          )}
        >
          <ProfileAvatar size={28} /> {t("nav.profile")}
        </Link>
      </aside>

      <div className="lg:pl-64">
        {/* Телефон: верхняя панель */}
        <header className="sticky top-0 z-20 border-b-2 border-border bg-bg/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-3 pt-[env(safe-area-inset-top)]">
            <Logo />
            <div className="flex-1" />
            <StreakChipAnimated />
            <Link href="/shop" aria-label={t("economy.shop")}><HeartChip /></Link>
            <ToolboxButton variant="icon" />
            <Link href="/profile" aria-label={t("nav.profile")}>
              <ProfileAvatar size={32} />
            </Link>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <main className="mx-auto w-full min-w-0 max-w-2xl flex-1">
            {/* Страница мягко проявляется при каждой смене маршрута. */}
            <m.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: easeOut }}>
              {children}
            </m.div>
          </main>
          <aside className="sticky top-8 hidden h-fit w-80 shrink-0 flex-col gap-4 xl:flex">
            <div className="flex items-center justify-end gap-5 px-1">
              <StreakChipAnimated />
              <XpChipAnimated />
              <LevelChip />
              <Link href="/shop" aria-label={t("economy.shop")}><HeartChip /></Link>
            </div>
            <LevelCard />
            <DailyGoalCard />
            <WeakTopicsCard />
          </aside>
        </div>

        {/* Телефон: нижняя навигация. Подсветка активной вкладки — одна «таблетка», которая скользит между вкладками. */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="relative mx-auto grid max-w-2xl grid-cols-5">
            <m.span
              aria-hidden
              className="pointer-events-none absolute left-0 top-[7px] flex w-1/5 justify-center"
              initial={false}
              animate={{ x: `${Math.max(activeIndex, 0) * 100}%`, opacity: activeIndex >= 0 ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            >
              <span className={clsx("h-8 w-12 rounded-xl transition-colors duration-200", NAV[activeIndex]?.ai ? "bg-ai-soft" : "bg-primary-soft")} />
            </m.span>
            {NAV.map(({ href, key, icon: Icon, ai }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={clsx(
                  "relative flex h-16 flex-col items-center justify-start gap-0.5 pt-[7px] text-[11px] font-extrabold transition-colors",
                  active(href) ? (ai ? "text-ai" : "text-primary") : "text-muted",
                )}
              >
                <m.span
                  className="flex h-8 w-12 items-center justify-center"
                  initial={false}
                  animate={active(href) ? { y: [0, -5, 0], scale: [1, 1.15, 1] } : { y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                >
                  <Icon size={22} />
                </m.span>
                <span className="max-w-full truncate px-0.5">{t(key)}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
