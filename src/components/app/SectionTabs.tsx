"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { tabRowScroll } from "@/lib/tab-row";
import { useT } from "@/i18n/useT";
import { useToolbox } from "@/components/tools/useToolbox";
import { hubGroup, subOf, type NavSub } from "./nav";
import { useEntVisible } from "@/components/school/useEntVisible";

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
 * Затухание по краям ряда — с той стороны, где есть что прокрутить (иначе обрезанная «таблетка» похожа на ошибку).
 * Ширина 24 px — TAB_FADE в lib/tab-row.ts (по ней ряд прокручивается так, чтобы затухание не съедало буквы).
 */
const FADE = cn(
  "data-[fade=left]:[mask-image:linear-gradient(to_right,transparent,black_24px)]",
  "data-[fade=right]:[mask-image:linear-gradient(to_left,transparent,black_24px)]",
  "data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%_-_24px),transparent)]",
);

/**
 * Строка подразделов группы: горизонтальные «таблетки» над содержимым главной страницы подраздела.
 * Рисуется оболочкой на телефоне/планшете (на компьютере подразделы раскрыты в боковом меню).
 * Внутренние экраны (урок, задача, чат, заметка) — без неё.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const { t, lang } = useT();
  const group = hubGroup(pathname, useEntVisible());
  const current = subOf(pathname);
  const scroller = useRef<HTMLDivElement>(null);

  // При показе ряд — в начале, если активная таблетка видна и так; иначе ряд начинается с целой таблетки, а активная
  // видна целиком (tabRowScroll). Без setState: поле справа (если до нужного места не докрутить) — прямо в стиле ряда.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    box.style.paddingRight = "";
    const items = Array.from(box.children) as HTMLElement[];
    const active = items.findIndex((el) => el.getAttribute("aria-current") === "page");
    const max = box.scrollWidth - box.clientWidth;
    const { left, extra } = tabRowScroll(
      items.map((el) => ({ left: el.offsetLeft, width: el.offsetWidth })),
      active,
      box.clientWidth,
      max,
    );
    if (extra > 0) box.style.paddingRight = `${parseFloat(getComputedStyle(box).paddingRight) + extra}px`;
    box.scrollTo({ left, behavior: "auto" });
  }, [pathname, lang]);

  // С какой стороны ряд обрезан: data-fade на самом ряду (без setState) — по нему CSS рисует затухание.
  const groupId = group?.id;
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const update = () => {
      const left = box.scrollLeft > 1;
      const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
      box.dataset.fade = left && right ? "both" : left ? "left" : right ? "right" : "none";
    };
    update();
    box.addEventListener("scroll", update, { passive: true });
    // Ширина ряда и «таблеток» (смена языка меняет подписи) — пересчитать.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(box);
    for (const c of box.children) ro?.observe(c);
    return () => {
      box.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [groupId, pathname]);

  if (!group) return null;
  return (
    <nav aria-label={t("nav2.sections")} className="-mx-4 mb-4 sm:-mx-6 lg:hidden">
      <div ref={scroller} className={cn("relative flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden", FADE)}>
        {group.subs.map((sub) => {
          const active = sub.id === current;
          // Рамка, поле, иконка 18 и промежуток до букв — TAB_LEAD / TAB_TRAIL в lib/tab-row.ts (меняются вместе).
          return (
            <SubLink
              key={sub.id}
              sub={sub}
              active={active}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                active ? "border-primary/40 bg-primary-soft text-ink-primary" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-text",
              )}
            />
          );
        })}
      </div>
    </nav>
  );
}
