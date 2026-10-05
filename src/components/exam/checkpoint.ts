"use client";

import { useMemo } from "react";
import { LESSON_META, entUnitPaperSize } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import { SKILLS } from "@/content/skills";
import { checkpointSkillIds } from "@/components/learn/map";
import type { DictKey } from "@/i18n/dict";
import { lessonsToCredit, UNIT_MIN_ITEMS, type ExamKind, type ExamPaper } from "@/lib/exam";
import type { LessonInfo, Skill, Text, Unit } from "@/lib/types";

// Тест по разделу: есть ли он у раздела, какие навыки в него входят и какие уроки он засчитывает.
// Размер считается по лёгкому каталогу (число заданий ЕНТ на навык): карта и план не грузят банк ЕНТ (этап 16).
// Сверку с unitPaperSize(ENT_POOL, …) держит tests/catalog.test.ts.

export interface Checkpoint {
  unitId: string;
  /** Навыки раздела: из них берутся задания. */
  skillIds: string[];
  /** Сколько заданий войдёт в тест (до 20). */
  size: number;
}

/** Тест раздела; null — нет готовых уроков или заданий меньше UNIT_MIN_ITEMS. */
export function checkpointOf(unit: Unit, lessons: Record<string, LessonInfo> = LESSON_META, skills: Skill[] = SKILLS): Checkpoint | null {
  const skillIds = checkpointSkillIds(unit, lessons, skills);
  if (!skillIds.length) return null;
  const size = entUnitPaperSize(skillIds);
  return size >= UNIT_MIN_ITEMS ? { unitId: unit.id, skillIds, size } : null;
}

/** Тест раздела по id (запуск по ссылке): null — раздела нет или теста у него нет. */
export function checkpointById(unitId: string | undefined): Checkpoint | null {
  const unit = unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  return unit ? checkpointOf(unit) : null;
}

/** Название попытки: у теста по разделу — «Тест по разделу: <раздел>», у остальных — вид теста. */
export function examTitle(
  kind: ExamKind,
  unitId: string | undefined,
  t: (key: DictKey, params?: Record<string, string | number>) => string,
  l: (text: Text) => string,
): string {
  const unit = kind === "unit" && unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  return unit ? t("exam.unit.title", { unit: l(unit.title) }) : t(`exam.mode.${kind}` as DictKey);
}

/** Тест раздела для карты: null — теста нет. */
export function useCheckpoint(unit: Unit): Checkpoint | null {
  return useMemo(() => checkpointOf(unit), [unit]);
}

type DoneMap = Record<string, { completions?: number } | undefined>;
const isDone = (done: DoneMap, id: string) => (done[id]?.completions ?? 0) > 0;

/** Готовые уроки раздела (есть на карте как «доступен» и найдены в курсе), в порядке курса. */
function readyOf(unitId: string): { id: string; skills: string[] }[] {
  const unit = UNITS.find((u) => u.id === unitId);
  if (!unit) return [];
  return unit.lessons.filter((r) => r.status === "available" && LESSON_META[r.id]).map((r) => ({ id: r.id, skills: LESSON_META[r.id].skills }));
}

/** Уроки, которые засчитает сданный тест раздела: непройденные готовые, чьи навыки все были в варианте. */
export function unitCreditIds(unitId: string, paper: Pick<ExamPaper, "items">, done: DoneMap): string[] {
  return lessonsToCredit(paper, readyOf(unitId), (id) => isDone(done, id));
}

/**
 * Навыки готовых непройденных уроков раздела: тест покрывает их в первую очередь, чтобы засчитать как можно больше уроков
 * (у раздела с навыков больше, чем заданий, повторная попытка берёт навыки ещё не засчитанных уроков).
 */
export function unitPrioritySkills(unitId: string, done: DoneMap): string[] {
  const set = new Set<string>();
  for (const x of readyOf(unitId)) if (!isDone(done, x.id)) x.skills.forEach((sk) => set.add(sk));
  return [...set];
}

/** Сколько готовых уроков раздела ещё не пройдено (и не засчитано). */
export function unitPendingCount(unitId: string, done: DoneMap): number {
  return readyOf(unitId).filter((x) => !isDone(done, x.id)).length;
}

/** С какого урока начать, если тест не сдан: первый готовый непройденный урок раздела. */
export function unitStartLesson(unitId: string, done: DoneMap): string | undefined {
  return readyOf(unitId).find((x) => !isDone(done, x.id))?.id;
}
