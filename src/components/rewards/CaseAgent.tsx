"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LevelCaseRoll } from "@/lib/level-case";
import { tourBlocking } from "@/lib/guide";
import { useApp } from "@/lib/store";
import { useGuideUi } from "@/components/guide/guide-state";
import { LevelCase } from "./LevelCase";

/**
 * Где кейс открывается сам: только «спокойные» страницы — карта, профиль, статистика. Белый список (а не чёрный):
 * любая страница, где ученик чем-то занят (урок, квиз в чате, игра, практикум, оформление тарифа…) и любая будущая — кейс не перебивает.
 */
const CASE_PREFIXES = ["/learn", "/profile", "/stats"];

export function caseAllowedPath(pathname: string): boolean {
  return CASE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Обратное к `caseAllowedPath` (для тестов и читаемости). */
export const caseBlockedPath = (pathname: string): boolean => !caseAllowedPath(pathname);

/**
 * Невидимый «агент»: когда в `pendingCases` есть неоткрытый кейс, а ученик на карте, в профиле или статистике —
 * открывает кейс за уровень (после итогов урока: ученик вышел на карту, и кейс уже ждёт). «Позже» — до следующего запуска
 * приложения не навязываем ни этот кейс, ни остальные из очереди (они остаются в карточке «Кейс ждёт»). Вставляется в `Providers`.
 */
export function CaseAgent() {
  const pathname = usePathname();
  const onboarded = useApp((s) => s.onboarded);
  const pending = useApp((s) => s.pendingCases);
  // Пока идёт проводник первого входа (#104), кейс не перебивает его.
  const touring = useApp((s) => tourBlocking(s.tips));
  // Открыта чат-панель Бита: кейс не ложится поверх неё и выходит, когда панель закрыли (пока кейс на экране, кнопка Бита спрятана).
  const chatOpen = useGuideUi((s) => s.chatOpen);
  const [later, setLater] = useState<number[]>([]);
  // Уже открытый кейс (приз выдан, кейса нет в очереди): хранится выданный бросок, чтобы после перемонтирования окна
  // (кнопка «назад», смена страницы) показать приз, а не закрытый кейс заново.
  const [opened, setOpened] = useState<{ level: number; roll: LevelCaseRoll } | null>(null);

  if (!onboarded || touring || !caseAllowedPath(pathname)) return null;
  const level = opened?.level ?? pending.find((l) => !later.includes(l));
  if (level === undefined) return null;
  // Приз уже выдан (`opened`) — окно не прячем, пока ученик его не закроет.
  if (chatOpen && !opened) return null;
  return (
    <LevelCase
      key={level}
      level={level}
      initialRoll={opened?.roll}
      onOpened={(roll) => setOpened({ level, roll })}
      onClose={() => {
        // «Позже» на закрытом кейсе откладывает всю очередь; «Отлично» после приза — только закрывает окно.
        setLater((a) => (opened ? [...a, level] : [...a, level, ...pending]));
        setOpened(null);
      }}
    />
  );
}
