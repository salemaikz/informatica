import type { Level, QuestionStep, SkillId } from "../types";
import { seeded } from "../text";
import { NS_BANKS } from "./ns";
import { CURRICULUM_BANKS } from "./curriculum";
import type { Pair, Shape, ShortQuestion, SkillBank, Statement } from "./types";

export type { Pair, Shape, ShortQuestion, SkillBank, Statement } from "./types";

// Реестр банка заданий. Новая тема = новый файл с SkillBank[] + строка здесь.

const BANKS: Record<SkillId, SkillBank> = Object.fromEntries([...NS_BANKS, ...CURRICULUM_BANKS].map((b) => [b.skill, b]));

export function bankFor(skill: SkillId): SkillBank | undefined {
  return BANKS[skill];
}

export function hasShape(skill: SkillId, shape: Shape): boolean {
  const b = BANKS[skill];
  return !!b && typeof b[shape] === "function";
}

/** Навыки из списка, которые умеют выдавать задания нужной формы. */
export function skillsWithShape(skills: SkillId[], shape: Shape): SkillId[] {
  return skills.filter((s) => hasShape(s, shape));
}

type ShapeItem = { question: QuestionStep; statement: Statement; pair: Pair; short: ShortQuestion };

/** Ключ для отсева повторов (два одинаковых задания подряд скучны и нечестны). */
function dedupeKey(shape: Shape, item: ShapeItem[Shape]): string {
  switch (shape) {
    case "question":
      return (item as QuestionStep).id.split(":").slice(0, 4).join(":");
    case "statement":
      return (item as Statement).text.ru;
    case "pair": {
      const p = item as Pair;
      return `${typeof p.left === "string" ? p.left : p.left.ru}|${typeof p.right === "string" ? p.right : p.right.ru}`;
    }
    case "short":
      return (item as ShortQuestion).prompt.ru;
  }
}

export interface DrawOptions {
  skills: SkillId[];
  count: number;
  seed: number;
  /** Диапазон уровней (по умолчанию A…C). */
  minLevel?: Level;
  maxLevel?: Level;
  /** true (по умолчанию) — уровни растут от первого задания к последнему. */
  ramp?: boolean;
}

/** Уровень i-го задания из count при плавном росте от min до max. */
export function rampLevel(i: number, count: number, min: Level, max: Level): Level {
  if (count <= 1 || min === max) return min;
  const span = max - min + 1;
  return Math.min(max, min + Math.floor((i * span) / count)) as Level;
}

/**
 * Достаёт из банка count заданий нужной формы по указанным навыкам.
 * Навыки чередуются случайно, повторы отсеиваются, сложность растёт (ramp).
 * Если уникальных заданий не хватает — возвращает сколько получилось.
 */
export function draw<S extends Shape>(shape: S, opts: DrawOptions): ShapeItem[S][] {
  const min = opts.minLevel ?? 1;
  const max = opts.maxLevel ?? 3;
  const ramp = opts.ramp ?? true;
  const pool = skillsWithShape(opts.skills, shape);
  if (!pool.length || opts.count <= 0) return [];
  const rand = seeded(opts.seed);
  const out: ShapeItem[S][] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < opts.count && guard++ < opts.count * 25) {
    const level = ramp ? rampLevel(out.length, opts.count, min, max) : ((min + Math.floor(rand() * (max - min + 1))) as Level);
    const skill = pool[Math.floor(rand() * pool.length)];
    const make = BANKS[skill][shape] as (level: Level, seed: number) => ShapeItem[S];
    const item = make(level, Math.floor(rand() * 1e9));
    const key = dedupeKey(shape, item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
