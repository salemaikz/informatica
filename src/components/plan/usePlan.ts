"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { checkpointOf, useEntPool } from "@/components/exam/checkpoint";
import { useMinuteClock } from "@/components/goals/useClock";
import { buildPlan, parseAnchor, resolveAnchor, type Plan, type PlanUnit, type SavedAnchor } from "@/lib/plan";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

// День начала плана хранится в браузере (поле в сторе не заводим): без якоря план «ехал» бы каждый день.
// Всё чтение и запись localStorage — в try/catch: в приватном режиме якоря нет, план просто начинается сегодня.

const KEY = "informatica:plan:v1";
const EVENT = "informatica:plan-anchor";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function parseSaved(raw: string | null): SavedAnchor | null {
  if (!raw) return null;
  try {
    return parseAnchor(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Урок «доступен» на карте, но ещё не добавлен в курс (пишется параллельно) — для плана он «скоро»: ссылка вела бы в 404.
const PLAN_UNITS: PlanUnit[] = UNITS.map((u) => ({
  id: u.id,
  lessons: u.lessons.map((r) => ({ id: r.id, status: r.status === "available" && LESSONS[r.id] ? "available" : "soon" })),
}));

/** План подготовки ученика; null, пока часы не готовы (первый кадр на клиенте) или грузится банк ЕНТ (нужен для контрольных). */
export function usePlan(): Plan | null {
  const examDate = useApp((s) => s.profile.examDate);
  const skipBasics = useApp((s) => s.profile.skipBasics);
  const lessons = useApp((s) => s.lessons);
  const exams = useApp((s) => s.exams);
  const days = useApp((s) => s.days);
  const now = useMinuteClock();
  const today = now ? todayKey(new Date(now)) : "";

  const pool = useEntPool();
  // Контрольная есть не у каждого раздела: нужны готовые уроки и не меньше UNIT_MIN_ITEMS заданий ЕНТ.
  const checkpoints = useMemo(
    () => (pool ? new Set(UNITS.filter((u) => checkpointOf(u, LESSONS, SKILLS, pool)).map((u) => u.id)) : null),
    [pool],
  );

  const raw = useSyncExternalStore(subscribe, read, () => null);
  const saved = useMemo(() => parseSaved(raw), [raw]);
  const start = today ? resolveAnchor(saved, examDate, today) : "";
  const exam = examDate ?? null;

  // Запоминаем якорь (не setState): первый вход, смена даты ЕНТ или новый цикл.
  useEffect(() => {
    if (!start) return;
    if (saved && saved.start === start && saved.exam === exam) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ start, exam }));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* хранилище недоступно — план начинается сегодня */
    }
  }, [start, exam, saved]);

  return useMemo(
    () =>
      today && checkpoints
        ? buildPlan({ units: PLAN_UNITS, today, start, examDate, skipBasics, lessons, exams, days, checkpoints })
        : null,
    [today, start, examDate, skipBasics, lessons, exams, days, checkpoints],
  );
}
