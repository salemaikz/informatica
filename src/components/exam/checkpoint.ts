"use client";

import { useEffect, useMemo, useState } from "react";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { checkpointSkillIds } from "@/components/learn/map";
import type { DictKey } from "@/i18n/dict";
import { unitPaperSize, UNIT_MIN_ITEMS, type ExamKind } from "@/lib/exam";
import type { Lesson, EntItem, Skill, Text, Unit } from "@/lib/types";

// Контрольная по разделу: есть ли она у раздела и какие навыки в неё входят.
// Банк заданий ЕНТ тяжёлый — карта курса подгружает его отдельным куском уже после показа.

export interface Checkpoint {
  unitId: string;
  /** Навыки раздела: из них берутся задания. */
  skillIds: string[];
  /** Сколько заданий войдёт в контрольную (до 15). */
  size: number;
}

/** Контрольная раздела; null — нет готовых уроков или заданий меньше UNIT_MIN_ITEMS. */
export function checkpointOf(unit: Unit, lessons: Record<string, Lesson>, skills: Skill[], pool: readonly EntItem[]): Checkpoint | null {
  const skillIds = checkpointSkillIds(unit, lessons, skills);
  if (!skillIds.length) return null;
  const size = unitPaperSize(pool, skillIds);
  return size >= UNIT_MIN_ITEMS ? { unitId: unit.id, skillIds, size } : null;
}

/** Контрольная раздела по id (запуск по ссылке): null — раздела нет или контрольной у него нет. */
export function checkpointById(unitId: string | undefined, pool: readonly EntItem[]): Checkpoint | null {
  const unit = unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  return unit ? checkpointOf(unit, LESSONS, SKILLS, pool) : null;
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

let loaded: readonly EntItem[] | null = null;
let loading: Promise<readonly EntItem[]> | null = null;

function loadPool(): Promise<readonly EntItem[]> {
  loading ??= import("@/content/ent").then((m) => (loaded = m.ENT_POOL));
  return loading;
}

/** Банк заданий ЕНТ, загруженный отдельным куском; null — ещё грузится. */
export function useEntPool(): readonly EntItem[] | null {
  const [pool, setPool] = useState<readonly EntItem[] | null>(loaded);
  useEffect(() => {
    if (pool) return;
    let off = false;
    loadPool().then((p) => {
      if (!off) setPool(p);
    });
    return () => {
      off = true;
    };
  }, [pool]);
  return pool;
}

/** Контрольная раздела для карты: "loading" — банк ещё грузится; null — контрольной нет. */
export function useCheckpoint(unit: Unit): Checkpoint | null | "loading" {
  const pool = useEntPool();
  return useMemo(() => {
    if (!checkpointSkillIds(unit, LESSONS, SKILLS).length) return null;
    return pool ? checkpointOf(unit, LESSONS, SKILLS, pool) : "loading";
  }, [unit, pool]);
}
