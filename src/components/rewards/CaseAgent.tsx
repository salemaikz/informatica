"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { isPublicPath } from "@/lib/public-paths";
import { tourBlocking } from "@/lib/tour";
import { useApp } from "@/lib/store";
import { LevelCase } from "./LevelCase";

/** Где кейс не показываем: урок, тест, игра, практикум, диагностика, оформление тарифа — человек занят делом. */
const BUSY_PREFIXES = ["/lesson", "/drill", "/exam", "/game", "/code", "/diagnostic", "/onboarding", "/plans"];

export function caseBlockedPath(pathname: string): boolean {
  return isPublicPath(pathname) || BUSY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Невидимый «агент»: когда в `pendingCases` есть неоткрытый кейс, а ученик не в уроке, тесте или игре —
 * открывает кейс за уровень (после итогов урока: ученик вышел на карту, и кейс уже ждёт). «Позже» — до следующего запуска
 * приложения не навязываем (кейс остаётся в карточке «Кейс ждёт»). Вставляется в `Providers`.
 */
export function CaseAgent() {
  const pathname = usePathname();
  const onboarded = useApp((s) => s.onboarded);
  const pending = useApp((s) => s.pendingCases);
  // Пока идёт проводник первого входа (#104), кейс не перебивает его.
  const touring = useApp((s) => tourBlocking(s.tips));
  const [later, setLater] = useState<number[]>([]);
  // Кейс, который ученик уже открыл: после выдачи приза его нет в очереди, но окно с призом должно остаться.
  const [active, setActive] = useState<number | null>(null);

  if (!onboarded || touring || caseBlockedPath(pathname)) return null;
  const level = active ?? pending.find((l) => !later.includes(l));
  if (level === undefined) return null;
  return (
    <LevelCase
      key={level}
      level={level}
      onOpened={() => setActive(level)}
      onClose={() => {
        setActive(null);
        setLater((a) => [...a, level]);
      }}
    />
  );
}
