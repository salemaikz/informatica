import { SKILLS } from "@/content/skills";
import { LESSON_META } from "@/content/catalog.generated";
import { skillsWithShape } from "@/content/catalog";
import type { SkillId } from "../types";
import type { DuelBand, DuelTopic } from "./types";

// Темы дуэлей (docs/specs/duels.md §5): темы ЕНТ и разделы курса для режима «по теме», навыки полос для остальных.
// Лёгкий модуль (каталог, без банка): выбор темы на хабе и набор заданий (deck.ts) видят один и тот же список.

/** Темы ЕНТ, из которых берутся задания на каждой полосе (дальше — шире). */
export const BAND_ENT: Record<DuelBand, readonly string[]> = {
  1: ["t01", "t03", "t04"],
  2: ["t01", "t02", "t03", "t04", "t05", "t08"],
  3: ["t01", "t02", "t03", "t04", "t05", "t06", "t08", "t11", "t12", "t13"],
  4: ["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10", "t11", "t12", "t13"],
};

const ENT_IDS: ReadonlySet<string> = new Set(SKILLS.map((s) => s.ent ?? "").filter(Boolean));

/** Навыки темы ЕНТ (по content/skills). */
function entSkills(ent: string): SkillId[] {
  return SKILLS.filter((s) => s.ent === ent).map((s) => s.id);
}

/** Раздел курса → навыки его уроков (по лёгкому каталогу). */
function unitSkillMap(): Map<string, SkillId[]> {
  const map = new Map<string, Set<SkillId>>();
  for (const id of Object.keys(LESSON_META).sort()) {
    const meta = LESSON_META[id];
    let set = map.get(meta.unitId);
    if (!set) map.set(meta.unitId, (set = new Set()));
    for (const s of meta.skills) set.add(s);
  }
  return new Map([...map].map(([u, set]) => [u, [...set].sort()]));
}

let unitCache: Map<string, SkillId[]> | null = null;
const units = () => (unitCache ??= unitSkillMap());

/** Тема ЕНТ (`t01`…) или раздел курса. */
export const isEntTopic = (topic: DuelTopic): boolean => ENT_IDS.has(topic);

/** Все темы для режима «по теме»: темы ЕНТ и разделы курса, у которых есть задания обеих форм. */
export function duelTopics(): DuelTopic[] {
  return [...[...ENT_IDS].sort(), ...[...units().keys()].sort()].filter((t) => topicSkills(t).length > 0);
}

/** Навыки темы (тема ЕНТ или раздел курса), у которых есть и выбор, и утверждения. Неизвестная тема — []. */
export function topicSkills(topic: DuelTopic): SkillId[] {
  if (typeof topic !== "string" || topic.length > 32) return [];
  const raw = ENT_IDS.has(topic) ? entSkills(topic) : (units().get(topic) ?? []);
  return skillsWithShape(skillsWithShape(raw, "question"), "statement");
}

export function isDuelTopic(v: unknown): v is DuelTopic {
  return typeof v === "string" && topicSkills(v).length > 0;
}

/** Навыки полосы (режимы без темы). */
export function bandSkills(band: DuelBand): SkillId[] {
  const raw = BAND_ENT[band].flatMap(entSkills);
  return skillsWithShape(skillsWithShape(raw, "question"), "statement");
}
