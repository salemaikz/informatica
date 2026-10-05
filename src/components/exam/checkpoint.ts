"use client";

import { useMemo } from "react";
import { LESSON_META, entUnitPaperSize } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import { SKILLS } from "@/content/skills";
import { checkpointSkillIds } from "@/components/learn/map";
import type { DictKey } from "@/i18n/dict";
import { UNIT_MIN_ITEMS, type ExamKind } from "@/lib/exam";
import type { LessonInfo, Skill, Text, Unit } from "@/lib/types";

// Контрольная по разделу: есть ли она у раздела и какие навыки в неё входят.
// Размер считается по лёгкому каталогу (число заданий ЕНТ на навык): карта и план не грузят банк ЕНТ (этап 16).
// Сверку с unitPaperSize(ENT_POOL, …) держит tests/catalog.test.ts.

export interface Checkpoint {
  unitId: string;
  /** Навыки раздела: из них берутся задания. */
  skillIds: string[];
  /** Сколько заданий войдёт в контрольную (до 15). */
  size: number;
}

/** Контрольная раздела; null — нет готовых уроков или заданий меньше UNIT_MIN_ITEMS. */
export function checkpointOf(unit: Unit, lessons: Record<string, LessonInfo> = LESSON_META, skills: Skill[] = SKILLS): Checkpoint | null {
  const skillIds = checkpointSkillIds(unit, lessons, skills);
  if (!skillIds.length) return null;
  const size = entUnitPaperSize(skillIds);
  return size >= UNIT_MIN_ITEMS ? { unitId: unit.id, skillIds, size } : null;
}

/** Контрольная раздела по id (запуск по ссылке): null — раздела нет или контрольной у него нет. */
export function checkpointById(unitId: string | undefined): Checkpoint | null {
  const unit = unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  return unit ? checkpointOf(unit) : null;
}

/** Название попытки: у контрольной — «Контрольная: <раздел>», у остальных — вид теста. */
export function examTitle(
  kind: ExamKind,
  unitId: string | undefined,
  t: (key: DictKey, params?: Record<string, string | number>) => string,
  l: (text: Text) => string,
): string {
  const unit = kind === "unit" && unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  return unit ? t("exam.unit.title", { unit: l(unit.title) }) : t(`exam.mode.${kind}` as DictKey);
}

/** Контрольная раздела для карты: null — контрольной нет. */
export function useCheckpoint(unit: Unit): Checkpoint | null {
  return useMemo(() => checkpointOf(unit), [unit]);
}
