"use client";

import clsx from "clsx";
import { cn } from "@/lib/cn";
import { Calculator } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { StreakChipAnimated, XpChipAnimated } from "@/components/motion/AnimatedChips";
import { easeOut } from "@/components/motion/presets";
import { DailyGoalCard, LevelCard, LevelChip, WeakTopicsCard } from "./Widgets";
import { Avatar } from "./Avatar";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { ChipsChip, HeartsChip } from "@/components/economy/HeaderChips";
import { useToolbox } from "@/components/tools/useToolbox";
import { NAV_GROUPS, groupOf, normalizePath, subOf, underPath } from "./nav";
import { SectionTabs, SubLink } from "./SectionTabs";

/** Аватар ученика из профиля (буква, рисованный или фото). */
function ProfileAvatar({ size = 36 }: { size?: number }) {
  const name = useApp((s) => s.profile.name);
  const config = useApp((s) => s.profile.avatar);
  return <Avatar config={config} name={name} size={size} />;
}

function Logo() {
  return (
    <Link href="/learn" className="flex items-center gap-2">
      <Mascot size={34} />
      {/* На телефонах название скрываем — остаётся маскот, шапке нужно место (серия, сердечки, чипы). */}
      <span className="hidden text-lg font-black tracking-tight text-primary min-[600px]:inline lg:inline">Informatica</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const group = groupOf(pathname);
  const sub = subOf(pathname);
  const path = normalizePath(pathname);
  // «page» — ровно эта страница; «true» — внутри группы (например, /tutor/123 или /exam/result/1).
  const current = (href: string, on: boolean) => (path === href ? "page" : on ? "true" : undefined);
  const activeIndex = NAV_GROUPS.findIndex((g) => g.id === group);
  // Чат и практикум кода — широкие экраны: на компьютере без правой колонки виджетов.
  const wide = underPath(pathname, "/tutor") || underPath(pathname, "/code");

  return (
    <div className="min-h-dvh">
      {/* Десктоп: боковое меню */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-2 border-r-2 border-border bg-surface px-4 py-6 lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <nav aria-label={t("nav2.mainNav")} className="flex flex-col gap-2">
          {NAV_GROUPS.map((g) => {
            const on = g.id === group;
            const Icon = g.icon;
            return (
              <div key={g.id} className="flex flex-col gap-1">
                <Link
                  href={g.href}
                  aria-current={sub ? undefined : current(g.href, on)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-2xl border-2 px-3 font-extrabold transition-colors",
                    on
                      ? g.ai
                        ? "border-ai/40 bg-ai-soft text-ai"
                        : "border-primary/40 bg-primary-soft text-primary"
                      : "border-transparent text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <Icon size={22} aria-hidden /> {t(g.label)}
                </Link>
                {/* У активной группы раскрыт список подразделов. */}
                {on && g.subs.length > 0 && (
                  <div className="ml-5 flex flex-col gap-0.5 border-l-2 border-border pl-2">
                    {g.subs.map((s) => (
                      <SubLink
                        key={s.id}
                        sub={s}
                        active={s.id === sub}
                        iconSize={18}
                        className={cn(
                          "flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary",
                          s.id === sub ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
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
            underPath(pathname, "/profile") ? "border-primary/40 bg-primary-soft text-primary" : "border-transparent text-muted hover:bg-surface-2",
          )}
        >
          <ProfileAvatar size={28} /> {t("nav.profile")}
        </Link>
      </aside>

      <div className="lg:pl-64">
        {/* Телефон: верхняя панель */}
        <header className="sticky top-0 z-20 border-b-2 border-border bg-bg/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 pt-[env(safe-area-inset-top)] min-[400px]:gap-3 min-[400px]:px-4">
            <Logo />
            <div className="flex-1" />
            <StreakChipAnimated />
            {/* Сердечки и чипы ведут в магазин. XP на самых узких телефонах прячем — он есть в «Прогрессе». */}
            <HeartsChip />
            <ChipsChip />
            <span className="hidden min-[520px]:flex">
              <XpChipAnimated />
            </span>
            <ToolboxButton variant="icon" />
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <main className={clsx("mx-auto w-full min-w-0 flex-1", wide ? "max-w-5xl" : "max-w-2xl")}>
            <SectionTabs />
            {/* Страница мягко проявляется при каждой смене маршрута. */}
            <m.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: easeOut }}>
              {children}
            </m.div>
          </main>
          <aside className={clsx("sticky top-8 hidden h-fit w-80 shrink-0 flex-col gap-4", !wide && "xl:flex")}>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-1">
              <StreakChipAnimated />
              <HeartsChip />
              <ChipsChip />
              <XpChipAnimated />
              <LevelChip />
            </div>
            <LevelCard />
            <DailyGoalCard />
            <WeakTopicsCard />
          </aside>
        </div>

        {/* Телефон: нижняя навигация. Подсветка активной вкладки — одна «таблетка», которая скользит между вкладками. */}
        <nav aria-label={t("nav2.mainNav")} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="relative mx-auto grid max-w-2xl grid-cols-5">
            <m.span
              aria-hidden
              className="pointer-events-none absolute left-0 top-[7px] flex w-1/5 justify-center"
              initial={false}
              animate={{ x: `${Math.max(activeIndex, 0) * 100}%`, opacity: activeIndex >= 0 ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            >
              <span className={clsx("h-8 w-12 rounded-xl transition-colors duration-200", NAV_GROUPS[activeIndex]?.ai ? "bg-ai-soft" : "bg-primary-soft")} />
            </m.span>
            {NAV_GROUPS.map(({ id, href, label, icon: Icon, ai }) => (
              <Link
                key={id}
                href={href}
                aria-current={current(href, id === group)}
                className={clsx(
                  "relative flex h-16 flex-col items-center justify-start gap-0.5 pt-[7px] text-[11px] font-extrabold transition-colors",
                  id === group ? (ai ? "text-ai" : "text-primary") : "text-muted",
                )}
              >
                <m.span
                  className="flex h-8 w-12 items-center justify-center"
                  initial={false}
                  animate={id === group ? { y: [0, -5, 0], scale: [1, 1.15, 1] } : { y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                >
                  <Icon size={22} aria-hidden />
                </m.span>
                <span className="max-w-full truncate px-0.5">{t(label)}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
