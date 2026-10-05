// Лёгкий каталог курса (этап 16, скорость): npm run catalog → src/content/catalog.generated.ts.
// Карта, профиль, статистика, меню и ИИ-контекст берут отсюда названия, навыки и число шагов уроков,
// а не импортируют содержимое всех уроков, банков и заданий ЕНТ (~20 МБ JS на каждой странице).
// Сверку каталога с уроками держит tests/catalog.test.ts: забыли перегенерировать — тест подскажет.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LESSONS } from "../src/content/lessons/all";
import { SKILLS } from "../src/content/skills";
import { bankSkills, hasShape } from "../src/lib/bank";
import type { Shape } from "../src/lib/bank/types";
import { lessonStepCount } from "../src/lib/lesson-size";
import { readingStats } from "../src/lib/theory";
import type { EntTopicId, Lesson, LessonMeta, SkillId } from "../src/lib/types";
import { collectWorked } from "../src/games/build/logic";
import { ENT_POOL } from "../src/content/ent";
import { ENT_TOPICS } from "../src/content/ent-topics";

export const CATALOG_FILE = join(import.meta.dirname, "..", "src", "content", "catalog.generated.ts");
export const CONSPECTS_FILE = join(import.meta.dirname, "..", "src", "content", "conspects.generated.ts");

const SHAPES: readonly Shape[] = ["question", "statement", "pair", "short"];

export interface Catalog {
  lessons: Record<string, LessonMeta>;
  bankShapes: Record<SkillId, Shape[]>;
  workedSkills: SkillId[];
  /** Задания ЕНТ навыка: [обычные (не контекстные), контекстные с вопросами]. */
  entSkillCounts: Record<SkillId, [number, number]>;
  /** Задания ЕНТ темы (вопросы контекстных — по одному). */
  entTopicCounts: Record<EntTopicId, number>;
}

export function buildCatalog(): Catalog {
  const lessons: Record<string, LessonMeta> = {};
  for (const lesson of Object.values(LESSONS)) {
    const rest: Partial<Lesson> = { ...lesson };
    delete rest.steps;
    delete rest.conspect;
    const reading = { ru: readingStats(lesson, "ru"), kk: readingStats(lesson, "kk") };
    lessons[lesson.id] = { ...(rest as Omit<Lesson, "steps" | "conspect">), stepCount: lessonStepCount(lesson), reading };
  }
  const bankShapes: Record<SkillId, Shape[]> = {};
  for (const skill of bankSkills().sort()) bankShapes[skill] = SHAPES.filter((sh) => hasShape(skill, sh));
  const allSkills = [...new Set([...SKILLS.map((s) => s.id), ...Object.values(LESSONS).flatMap((l) => l.skills)])].sort();
  const workedSkills = allSkills.filter((s) => collectWorked([s]).length > 0);
  const entSkillCounts: Record<SkillId, [number, number]> = {};
  const entTopicCounts = Object.fromEntries(ENT_TOPICS.map((tp) => [tp.id, 0])) as Record<EntTopicId, number>;
  for (const it of ENT_POOL) {
    const c = (entSkillCounts[it.skill] ??= [0, 0]);
    if (it.kind !== "context") c[0]++;
    else if (it.questions.length > 0) c[1]++;
    entTopicCounts[it.topic] += it.kind === "context" ? it.questions.length : 1;
  }
  const sortedSkillCounts = Object.fromEntries(Object.entries(entSkillCounts).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { lessons, bankShapes, workedSkills, entSkillCounts: sortedSkillCounts, entTopicCounts };
}

export function renderCatalog(cat: Catalog): string {
  const lessonLines = Object.values(cat.lessons).map((m) => `  ${JSON.stringify(m.id)}: ${JSON.stringify(m)},`);
  const shapeLines = Object.entries(cat.bankShapes).map(([s, sh]) => `  ${JSON.stringify(s)}: ${JSON.stringify(sh)},`);
  return [
    "// Сгенерировано scripts/catalog.ts — не править руками: npm run catalog.",
    "// Лёгкий каталог курса: уроки без шагов и конспектов, формы банков, навыки с пошаговыми разборами.",
    "",
    'import type { Shape } from "@/lib/bank/types";',
    'import type { EntTopicId, LessonMeta, SkillId } from "@/lib/types";',
    "",
    "export const LESSON_META: Record<string, LessonMeta> = {",
    ...lessonLines,
    "};",
    "",
    "/** Формы заданий, которые умеет выдавать банк навыка (нет навыка — нет банка). */",
    "export const BANK_SHAPES: Record<SkillId, readonly Shape[]> = {",
    ...shapeLines,
    "};",
    "",
    "/** Навыки, по которым в уроках есть пошаговые разборы (игра «Собери решение»). */",
    `export const WORKED_SKILLS: readonly SkillId[] = ${JSON.stringify(cat.workedSkills)};`,
    "",
    "/** Задания ЕНТ навыка: [обычные, контекстные с вопросами] — размер контрольной без загрузки банка ЕНТ. */",
    `export const ENT_SKILL_COUNTS: Record<SkillId, readonly [number, number]> = ${JSON.stringify(cat.entSkillCounts)};`,
    "",
    "/** Задания ЕНТ по темам (вопросы контекстных — по одному). */",
    `export const ENT_TOPIC_COUNTS: Record<EntTopicId, number> = ${JSON.stringify(cat.entTopicCounts)};`,
    "",
  ].join("\n");
}

/** Шпаргалки всех уроков — отдельный файл: поиск в «Конспектах» подгружает его только при поиске. */
export function renderConspects(): string {
  const lines = Object.values(LESSONS).map((l) => `  ${JSON.stringify(l.id)}: ${JSON.stringify(l.conspect)},`);
  return [
    "// Сгенерировано scripts/catalog.ts — не править руками: npm run catalog.",
    "// Шпаргалки уроков для поиска в «Конспектах» (грузится по требованию, этап 16).",
    "",
    'import type { L } from "@/lib/types";',
    "",
    "export const CONSPECTS: Record<string, L> = {",
    ...lines,
    "};",
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const cat = buildCatalog();
  writeFileSync(CATALOG_FILE, renderCatalog(cat));
  writeFileSync(CONSPECTS_FILE, renderConspects());
  console.log(`каталог: уроков ${Object.keys(cat.lessons).length}, банков ${Object.keys(cat.bankShapes).length}, навыков с разборами ${cat.workedSkills.length}`);
}
