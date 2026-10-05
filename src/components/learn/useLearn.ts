"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { LessonRef, Unit } from "@/lib/types";
import { UNITS } from "@/content/course-map";
import { dueLessons } from "@/lib/review";
import { useApp } from "@/lib/store";
import { isDarkColor, pluralForm, recommendedLesson } from "./map";
import type { DictKey } from "@/i18n/dict";

/** «Сейчас» на время жизни экрана: стабильно между рендерами (расписание повторения не дёргается). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

/** Где урок на карте. */
export function findLessonRef(id: string): { unit: Unit; ref: LessonRef; unitIndex: number } | undefined {
  for (let i = 0; i < UNITS.length; i++) {
    const ref = UNITS[i].lessons.find((r) => r.id === id);
    if (ref) return { unit: UNITS[i], ref, unitIndex: i };
  }
  return undefined;
}

/** Общие данные главной: рекомендуемый урок, уроки к повторению. */
export function useLearnData() {
  const lessons = useApp((s) => s.lessons);
  const now = useNow();
  // Знает основы (выбор в онбординге) — раздел «Старт: компьютер с нуля» первым не предлагаем.
  const skipBasics = useApp((s) => s.profile.skipBasics);
  const recommended = useMemo(() => recommendedLesson(skipBasics ? UNITS.filter((u) => u.id !== "u0") : UNITS, lessons), [lessons, skipBasics]);
  // К повторению — только уроки, которые есть на карте курса.
  const due = useMemo(() => dueLessons(lessons, now).filter((d) => !!findLessonRef(d.id)), [lessons, now]);
  return { lessons, now, recommended, due };
}

/**
 * CSS-переменные цвета раздела. Оттенки собираются через color-mix с токенами темы,
 * поэтому сами подстраиваются под светлую и тёмную тему:
 * --u — цвет раздела, --u-ink — текст (темнее в светлой теме, светлее в тёмной), --u-soft — фон,
 * --u-fill — заливка кнопок, --u-edge — объёмный низ.
 */
export function unitVars(color: string): CSSProperties {
  return {
    // Очень тёмный цвет раздела (u9 — #334155) на тёмной теме почти не виден: подмешиваем цвет текста —
    // в светлой теме он чуть темнеет, в тёмной — светлеет.
    "--u": isDarkColor(color) ? `color-mix(in srgb, ${color} 62%, var(--text))` : color,
    "--u-ink": `color-mix(in srgb, ${color} 64%, var(--text))`,
    "--u-soft": `color-mix(in srgb, ${color} 12%, var(--surface))`,
    "--u-fill": `color-mix(in srgb, ${color} 88%, var(--text))`,
    "--u-edge": `color-mix(in srgb, ${color} 62%, #000)`,
  } as CSSProperties;
}

/** Ключ словаря с русской формой числительного (у казахского формы совпадают). */
export function pluralKey<P extends string>(prefix: P, n: number): DictKey {
  return `${prefix}.${pluralForm(n)}` as DictKey;
}

/** Короткое имя раздела для полосы разделов. */
export function unitShortKey(unitId: string): DictKey | undefined {
  const key = `learn2.short.${unitId}`;
  return /^learn2\.short\.u[1-9]$/.test(key) ? (key as DictKey) : undefined;
}
