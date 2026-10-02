import type { EntTopicId, Lesson, LessonRef, Skill, Unit } from "@/lib/types";
import { DAY_MS, lessonXpFactor, REPLAY_XP, type LessonStat } from "@/lib/review";
import { MASTERED_FROM, WEAK_BELOW, type SkillStat } from "@/lib/mastery";

// Чистая логика карты курса (без React): состояния узлов, прогресс раздела, освоение тем ЕНТ,
// раскладка дороги. Покрыто тестами в tests/learn-map.test.ts.

export type NodeState = "done" | "due" | "recommended" | "available" | "soon";

/** Пора повторить: та же логика, что в lib/review.ts → dueLessons (старые сохранения — через день). */
export function isDue(stat: LessonStat | undefined, now: number): boolean {
  if (!stat || stat.completions <= 0) return false;
  return now >= (stat.dueAt ?? stat.lastAt + DAY_MS);
}

/** Рекомендуемый урок — первый непройденный готовый урок по порядку курса (свободный режим: остальные тоже открыты). */
export function recommendedLesson(units: Unit[], stats: Record<string, LessonStat>): { unit: Unit; ref: LessonRef } | undefined {
  for (const unit of units) for (const ref of unit.lessons) if (ref.status === "available" && (stats[ref.id]?.completions ?? 0) <= 0) return { unit, ref };
  return undefined;
}

export function nodeState(ref: LessonRef, stat: LessonStat | undefined, recommendedId: string | undefined, now: number): NodeState {
  if (ref.status === "soon") return "soon";
  if (stat && stat.completions > 0) return isDue(stat, now) ? "due" : "done";
  return ref.id === recommendedId ? "recommended" : "available";
}

/** Тёмный цвет раздела (относительная яркость по WCAG): на тёмной теме его нужно осветлять, иначе дорога не видна. */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
  return lum < 0.1;
}

/** Бейдж повторов: недоверенные данные из localStorage не должны раздувать узел. */
export function completionsBadge(n: number): string | null {
  if (!Number.isFinite(n) || n < 2) return null;
  return n > 99 ? "×99+" : `×${Math.floor(n)}`;
}

/** Лучший результат в процентах 0..100 (мусор из старых сохранений — 0). */
export function bestPercent(acc: number | undefined): number {
  if (typeof acc !== "number" || !Number.isFinite(acc)) return 0;
  return Math.round(Math.min(1, Math.max(0, acc)) * 100);
}

/** Пройден (в том числе «пора повторить»). */
export const isPassed = (s: NodeState) => s === "done" || s === "due";

export interface UnitProgress {
  done: number;
  ready: number;
  total: number;
}

export function unitProgress(unit: Unit, stats: Record<string, LessonStat>): UnitProgress {
  let done = 0;
  let ready = 0;
  for (const ref of unit.lessons) {
    if (ref.status === "available") ready++;
    if (stats[ref.id]?.completions) done++;
  }
  return { done, ready, total: unit.lessons.length };
}

/** «Сдать экстерном» имеет смысл, если в разделе есть готовые непройденные уроки. */
export function canExtern(unit: Unit, stats: Record<string, LessonStat>): boolean {
  return unit.lessons.some((r) => r.status === "available" && !stats[r.id]?.completions);
}

/** Навыки раздела: навыки его готовых уроков + навыки тем ЕНТ раздела. */
export function unitSkillIds(unit: Unit, lessons: Record<string, Lesson>, skills: Skill[]): string[] {
  const set = new Set<string>();
  for (const ref of unit.lessons) lessons[ref.id]?.skills.forEach((s) => set.add(s));
  const topics = new Set(unit.entTopics ?? []);
  for (const s of skills) if (s.ent && topics.has(s.ent)) set.add(s.id);
  return [...set];
}

/** Среднее освоение навыков (не тронутые — 0). */
export function averageMastery(skillIds: string[], stats: Record<string, SkillStat>): number {
  if (!skillIds.length) return 0;
  const sum = skillIds.reduce((a, id) => a + (stats[id]?.attempts ? stats[id].mastery : 0), 0);
  return Math.round((sum / skillIds.length) * 1000) / 1000;
}

export type TopicLevel = "none" | "weak" | "progress" | "mastered";

/**
 * Освоение темы ЕНТ:
 * - value — среднее по всем навыкам темы (не тронутые — 0), это и показываем в процентах;
 * - level — цвет плитки: нет попыток — none; среднее по тронутым навыкам < 0.6 — weak (тема реально западает);
 *   value ≥ 0.8 — mastered (освоена вся тема, а не один навык); иначе — progress.
 */
export function topicMastery(skillIds: string[], stats: Record<string, SkillStat>): { value: number; level: TopicLevel } {
  const touched = skillIds.filter((id) => (stats[id]?.attempts ?? 0) > 0);
  const value = averageMastery(skillIds, stats);
  if (!touched.length) return { value, level: "none" };
  const touchedAvg = touched.reduce((a, id) => a + stats[id].mastery, 0) / touched.length;
  if (touchedAvg < WEAK_BELOW) return { value, level: "weak" };
  if (value >= MASTERED_FROM) return { value, level: "mastered" };
  return { value, level: "progress" };
}

/**
 * Темы ЕНТ урока. Готовый урок — по `entTopics` или темам его навыков. Урок «скоро» — по навыку,
 * угаданному из id (`py-3-loops` → `py.loops`, `data-1-sheets` → `sheets.*`), иначе — темы раздела.
 */
export function lessonTopics(ref: LessonRef, unit: Unit, lesson: Lesson | undefined, skills: Skill[]): EntTopicId[] {
  const uniq = (xs: (EntTopicId | undefined)[]) => [...new Set(xs.filter((x): x is EntTopicId => !!x))];
  if (lesson) {
    if (lesson.entTopics?.length) return uniq(lesson.entTopics);
    const fromSkills = uniq(lesson.skills.map((id) => skills.find((s) => s.id === id)?.ent));
    if (fromSkills.length) return fromSkills;
  }
  const parts = ref.id.split("-");
  const prefix = parts[0];
  const slug = parts.slice(2).join("-");
  const guess =
    skills.find((s) => s.id === `${prefix}.${slug}`) ??
    skills.find((s) => slug && s.id.startsWith(`${slug}.`)) ??
    skills.find((s) => s.id.startsWith(`${prefix}.`));
  if (guess?.ent) return [guess.ent];
  return uniq(unit.entTopics ?? []);
}

/** Уроки темы ЕНТ по порядку курса. */
export function topicLessons(
  topic: EntTopicId,
  units: Unit[],
  lessons: Record<string, Lesson>,
  skills: Skill[],
): { unit: Unit; ref: LessonRef }[] {
  const out: { unit: Unit; ref: LessonRef }[] = [];
  for (const unit of units) for (const ref of unit.lessons) if (lessonTopics(ref, unit, lessons[ref.id], skills).includes(topic)) out.push({ unit, ref });
  return out;
}

/** Навыки темы ЕНТ. */
export const topicSkillIds = (topic: EntTopicId, skills: Skill[]) => skills.filter((s) => s.ent === topic).map((s) => s.id);

/** Через сколько дней повторить (0 — уже пора), null — урок не пройден. */
export function reviewInDays(stat: LessonStat | undefined, now: number): number | null {
  if (!stat || stat.completions <= 0) return null;
  const due = stat.dueAt ?? stat.lastAt + DAY_MS;
  return Math.max(0, Math.ceil((due - now) / DAY_MS));
}

export type XpKind = "first" | "review" | "second" | "later";

/** Какой XP даст прохождение сейчас (подпись в шторке урока). */
export function xpKind(stat: LessonStat | undefined, now: number): XpKind {
  const f = lessonXpFactor(stat, now);
  if (f === 1) return "first";
  if (f === REPLAY_XP.review) return "review";
  return f === REPLAY_XP.second ? "second" : "later";
}

/** Форма русского числительного: 1 урок, 2 урока, 5 уроков. */
export function pluralForm(n: number): "one" | "few" | "many" {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return "many";
  if (b === 1) return "one";
  if (b >= 2 && b <= 4) return "few";
  return "many";
}

// ---------- Раскладка дороги ----------

export interface PathPoint {
  /** Смещение от центра, px. */
  x: number;
  y: number;
}

export interface PathNode extends PathPoint {
  /** С какой стороны от узла подпись (со стороны центра — там больше места). */
  label: "left" | "right";
}

export interface PathSegment {
  d: string;
  /** Индексы узлов на концах; -1 — вход сверху / выход снизу (к «мостику»). */
  from: number;
  to: number;
}

export interface PathLayout {
  nodes: PathNode[];
  segments: PathSegment[];
  height: number;
  /** Ширина SVG (центр — x = 0). */
  width: number;
}

export const PATH = { step: 112, amp: 76, top: 64, bottom: 44 } as const;

/**
 * Узлы змейкой по синусоиде: x = amp·sin(30° + 60°·(i + phase)) — значения ±amp/2 и ±amp, узел никогда не стоит
 * ровно по центру (подписи всегда хватает места). Дорога — сплайн Катмулла — Рома через все узлы
 * плюс вход сверху и выход снизу по центру.
 */
export function pathLayout(count: number, phase = 0, opts: { step?: number; amp?: number; top?: number; bottom?: number } = {}): PathLayout {
  const step = opts.step ?? PATH.step;
  const amp = opts.amp ?? PATH.amp;
  const top = opts.top ?? PATH.top;
  const bottom = opts.bottom ?? PATH.bottom;
  const nodes: PathNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(amp * Math.sin(Math.PI / 6 + ((i + phase) * Math.PI) / 3));
    nodes.push({ x, y: top + i * step, label: x > 0 ? "left" : "right" });
  }
  const height = count ? top + (count - 1) * step + bottom : 0;
  const pts: PathPoint[] = count ? [{ x: 0, y: 0 }, ...nodes, { x: 0, y: height }] : [];
  const segments: PathSegment[] = [];
  const r = (v: number) => Math.round(v * 10) / 10;
  for (let k = 0; k + 1 < pts.length; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push({
      d: `M${r(p1.x)} ${r(p1.y)}C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`,
      from: k === 0 ? -1 : k - 1,
      to: k + 1 === pts.length - 1 ? -1 : k,
    });
  }
  return { nodes, segments, height, width: 2 * (amp + 60) };
}

/** Участок дороги «пройден», если пройдены оба его конца (вход/выход — по соседнему узлу). */
export function segmentDone(seg: PathSegment, passed: boolean[]): boolean {
  const a = seg.from < 0 ? passed[seg.to] : passed[seg.from];
  const b = seg.to < 0 ? passed[seg.from] : passed[seg.to];
  return !!a && !!b;
}
