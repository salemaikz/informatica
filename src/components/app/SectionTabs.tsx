"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { useToolbox } from "@/components/tools/useToolbox";
import { hubGroup, subOf, type NavSub } from "./nav";

/** Открыть «Инструменты» на вкладке «Шпаргалка». Уровень инструментов экрана не трогаем. */
export function openCheatSheet() {
  const tb = useToolbox.getState();
  tb.setTab("cheat");
  tb.setOpen(true);
}

/** Пункт подраздела: ссылка или (у «Шпаргалки») кнопка, открывающая инструменты. */
export function SubLink({ sub, active, className, iconSize = 18 }: { sub: NavSub; active: boolean; className?: string; iconSize?: number }) {
  const { t } = useT();
  const Icon = sub.icon;
  const content = (
    <>
      <Icon size={iconSize} aria-hidden className="shrink-0" />
      <span className="truncate">{t(sub.label)}</span>
    </>
  );
  if (sub.action === "cheat" || !sub.href) {
    return (
      <button type="button" onClick={openCheatSheet} aria-haspopup="dialog" className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href={sub.href} aria-current={active ? "page" : undefined} className={className}>
      {content}
    </Link>
  );
}

/**
 * Строка подразделов группы: горизонтальные «таблетки» над содержимым главной страницы подраздела.
 * Рисуется оболочкой на телефоне/планшете (на компьютере подразделы раскрыты в боковом меню).
 * Внутренние экраны (урок, задача, чат, заметка) — без неё.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const { t } = useT();
  const group = hubGroup(pathname);
  const current = subOf(pathname);
  const scroller = useRef<HTMLDivElement>(null);

  // Активную таблетку подвозим в видимую область (без setState, прокрутка только по горизонтали).
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "auto" });
  }, [pathname]);

  if (!group) return null;
  return (
    <nav aria-label={t("nav2.sections")} className="-mx-4 mb-4 sm:-mx-6 lg:hidden">
      <div ref={scroller} className="relative flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {group.subs.map((sub) => {
          const active = sub.id === current;
          return (
            <SubLink
              key={sub.id}
              sub={sub}
              active={active}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-text",
              )}
            />
          );
        })}
      </div>
    </nav>
  );
}
