// Чистая логика экранов пробного ЕНТ: параметры адреса, ссылки, история, подписи ответов, разбор, данные для ИИ.
// Без React — покрыта тестами (tests/exam-store.test.ts).

import {
  EXAM_TIME_LIMIT_SEC,
  FULL_COUNTS,
  MINI_COUNTS,
  STRONG_FROM_RATIO,
  TOPIC_COUNTS,
  WEAK_BELOW_RATIO,
  contextQuestionOf,
  isAnswered,
  scoreQuestion,
  type ExamAnswer,
  type ExamAnswers,
  type ExamKind,
  type ExamNote,
  type ExamPaper,
  type ExamQuestion,
} from "@/lib/exam";
import { ENT_TOPICS } from "@/content/ent-topics";
import type { ExamSummary } from "@/lib/store";
import { plain, tx } from "@/lib/text";
import type { EntTopicId, Lang, Lesson, Text } from "@/lib/types";

const KINDS: readonly ExamKind[] = ["full", "mini", "topic"];
const TOPIC_IDS = new Set<string>(ENT_TOPICS.map((t) => t.id));

/** Сколько тем можно выбрать в «Тесте по теме». */
export const MAX_TOPIC_PICK = 3;

const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

/** Формат вариантов для карточек хаба: заданий, минут, баллов (контекстное задание — 5 вопросов, в полном). */
export const EXAM_FORMAT: Record<ExamKind, { questions: number; minutes: number; points: number }> = {
  mini: { questions: sum(MINI_COUNTS), minutes: EXAM_TIME_LIMIT_SEC.mini / 60, points: MINI_COUNTS.single + (MINI_COUNTS.multi + MINI_COUNTS.match) * 2 },
  full: {
    questions: sum(FULL_COUNTS) + 5,
    minutes: EXAM_TIME_LIMIT_SEC.full / 60,
    points: FULL_COUNTS.single + (FULL_COUNTS.multi + FULL_COUNTS.match) * 2 + 5,
  },
  topic: { questions: sum(TOPIC_COUNTS), minutes: EXAM_TIME_LIMIT_SEC.topic / 60, points: TOPIC_COUNTS.single + (TOPIC_COUNTS.multi + TOPIC_COUNTS.match) * 2 },
};

// ---------- Адрес ----------

export interface RunParams {
  kind: ExamKind;
  /** null — в адресе нет (корректного) seed; экран возьмёт случайный. */
  seed: number | null;
  topics: EntTopicId[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Темы из строки «t04,t05»: только известные, без повторов, не больше MAX_TOPIC_PICK. */
export function parseTopics(raw: string | undefined): EntTopicId[] {
  if (!raw) return [];
  const out: EntTopicId[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (TOPIC_IDS.has(t) && !out.includes(t as EntTopicId)) out.push(t as EntTopicId);
  }
  return out.slice(0, MAX_TOPIC_PICK);
}

/** Параметры /exam/run. null — адрес без вида (тогда экран продолжает начатую попытку или ведёт в хаб). */
export function parseRunParams(sp: Record<string, string | string[] | undefined>): RunParams | null {
  const kind = first(sp.kind);
  if (!KINDS.includes(kind as ExamKind)) return null;
  const rawSeed = first(sp.seed);
  const n = rawSeed && /^\d{1,10}$/.test(rawSeed) ? Number(rawSeed) : NaN;
  const topics = kind === "topic" ? parseTopics(first(sp.topics)) : [];
  return { kind: kind as ExamKind, seed: Number.isInteger(n) && n < 2 ** 32 ? n : null, topics };
}

/** Относительная ссылка на вариант. */
export function examLink(kind: ExamKind, seed: number, topics: EntTopicId[] = []): string {
  const q = new URLSearchParams({ kind, seed: String(seed >>> 0) });
  if (kind === "topic" && topics.length) q.set("topics", topics.join(","));
  return `/exam/run?${q.toString()}`;
}

/** Выбор тем чипами: включить/выключить, не больше MAX_TOPIC_PICK (лишний выбор игнорируется). */
export function toggleTopic(selected: EntTopicId[], id: EntTopicId): EntTopicId[] {
  if (selected.includes(id)) return selected.filter((t) => t !== id);
  return selected.length >= MAX_TOPIC_PICK ? selected : [...selected, id];
}

/** Случайный seed (uint32). */
export const randomSeed = (rand: () => number = Math.random) => Math.floor(rand() * 2 ** 32) >>> 0;

// ---------- Время ----------

/** «м:сс» или «ч:мм:сс». */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Осталось секунд (не меньше 0). */
export function remainingSec(limitSec: number, elapsedMs: number): number {
  return Math.max(0, Math.ceil(limitSec - (Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));
}

// ---------- Цвет по доле ----------

export type Tone = "danger" | "warning" | "success";

/** Семантика цветов: слабая тема — danger, в процессе — warning, освоено — success (пороги как в советах). */
export function toneOf(ratio: number): Tone {
  if (!(ratio >= WEAK_BELOW_RATIO)) return "danger";
  return ratio >= STRONG_FROM_RATIO ? "success" : "warning";
}

export const ratioOf = (points: number, max: number) => (max > 0 ? points / max : 0);

// ---------- История ----------

export interface HistoryPoint {
  id: string;
  at: number;
  kind: ExamKind;
  percent: number;
  points: number;
  maxPoints: number;
}

/** Последние `n` попыток мини/полного (тест по теме картину не показывает) — от старых к новым. */
export function historyPoints(exams: ExamSummary[], n = 10): HistoryPoint[] {
  return exams
    .filter((e) => e.kind !== "topic" && e.maxPoints > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, n)
    .reverse()
    .map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      percent: Math.round((Math.max(0, Math.min(e.maxPoints, e.points)) / e.maxPoints) * 100),
      points: e.points,
      maxPoints: e.maxPoints,
    }));
}

export interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  point: HistoryPoint;
}

/** Столбики графика в координатах viewBox: высота — доля баллов (0..100%). */
export function chartBars(points: HistoryPoint[], width: number, height: number, slots = 10): Bar[] {
  const gap = 6;
  const w = Math.max(4, (width - gap * (slots - 1)) / slots);
  return points.slice(-slots).map((p, i) => {
    const h = Math.max(3, (p.percent / 100) * height);
    return { x: i * (w + gap), y: height - h, w, h, point: p };
  });
}

// ---------- Подписи ответов и разбор ----------

export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export const letter = (i: number) => LETTERS[i] ?? String(i + 1);

/** Условие самого вопроса (у контекстного — вопрос внутри общего текста). */
export function questionPrompt(q: ExamQuestion, lang: Lang): string {
  const cq = contextQuestionOf(q);
  if (cq) return tx(cq.prompt, lang);
  return q.item.kind === "context" ? tx(q.item.text, lang) : tx(q.item.prompt, lang);
}

/** Варианты ответа вопроса (single, multi, вопрос контекстного). Для match — описания (choices). */
export function optionsOf(q: ExamQuestion): Text[] {
  const cq = contextQuestionOf(q);
  if (cq) return cq.options;
  switch (q.item.kind) {
    case "single":
    case "multi":
      return q.item.options;
    case "match":
      return q.item.choices;
    default:
      return [];
  }
}

/** Объяснение вопроса (бесплатный разбор). */
export function explanationOf(q: ExamQuestion, lang: Lang): string {
  const cq = contextQuestionOf(q);
  if (cq) return tx(cq.explanation, lang);
  return q.item.kind === "context" ? "" : tx(q.item.explanation, lang);
}

/** Разбор неверного варианта (только single с whyWrong): по выбранному индексу. */
export function whyWrongOf(q: ExamQuestion, a: ExamAnswer | undefined, lang: Lang): string | null {
  if (q.item.kind !== "single" || a?.choice === undefined || a.choice === q.item.correct) return null;
  const w = q.item.whyWrong?.[a.choice];
  return w ? tx(w, lang) : null;
}

/** Выбранные индексы вариантов (для single/context — один, для multi — несколько). */
export function chosenIndexes(q: ExamQuestion, a: ExamAnswer | undefined): number[] {
  if (!a || !isAnswered(q, a)) return [];
  if (q.item.kind === "multi") {
    const n = q.item.options.length;
    return [...new Set(a.multi ?? [])].filter((i) => Number.isInteger(i) && i >= 0 && i < n).sort((x, y) => x - y);
  }
  return a.choice === undefined ? [] : [a.choice];
}

/** Верные индексы вариантов (single/multi/context). */
export function correctIndexes(q: ExamQuestion): number[] {
  const cq = contextQuestionOf(q);
  if (cq) return [cq.correct];
  if (q.item.kind === "single") return [q.item.correct];
  if (q.item.kind === "multi") return [...q.item.correct];
  return [];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Ответ ученика одной строкой: «B) 1011₂», «A, C», «A–3, B–1»; пусто — «—». */
export function givenText(q: ExamQuestion, a: ExamAnswer | undefined, lang: Lang, max = 60): string {
  if (!isAnswered(q, a)) return "—";
  if (q.item.kind === "match") {
    const m = a?.match ?? [];
    return clip(q.item.items.map((_, i) => `${letter(i)}–${typeof m[i] === "number" ? (m[i] as number) + 1 : "?"}`).join(", "), max);
  }
  const opts = optionsOf(q);
  const idx = chosenIndexes(q, a);
  if (q.item.kind === "multi") return clip(idx.map(letter).join(", "), max);
  return clip(idx.map((i) => `${letter(i)}) ${tx(opts[i] ?? "", lang)}`).join("; "), max);
}

/** Верный ответ одной строкой. */
export function correctText(q: ExamQuestion, lang: Lang, max = 60): string {
  if (q.item.kind === "match") return clip(q.item.items.map((_, i) => `${letter(i)}–${(q.item as { answer: number[] }).answer[i] + 1}`).join(", "), max);
  const opts = optionsOf(q);
  const idx = correctIndexes(q);
  if (q.item.kind === "multi") return clip(idx.map(letter).join(", "), max);
  return clip(idx.map((i) => `${letter(i)}) ${tx(opts[i] ?? "", lang)}`).join("; "), max);
}

export type ReviewStatus = "correct" | "partial" | "wrong" | "skipped";

export interface ReviewRow {
  index: number;
  q: ExamQuestion;
  points: number;
  max: number;
  status: ReviewStatus;
}

export function reviewRows(paper: ExamPaper, answers: ExamAnswers): ReviewRow[] {
  return paper.items.map((q, index) => {
    const s = scoreQuestion(q, answers[q.key]);
    const status: ReviewStatus = s.correct ? "correct" : s.points > 0 ? "partial" : isAnswered(q, answers[q.key]) ? "wrong" : "skipped";
    return { index, q, points: s.points, max: s.max, status };
  });
}

/** Фильтр «только ошибки»: всё, что не набрано полностью (включая пропущенные). */
export const onlyMistakes = (rows: ReviewRow[]) => rows.filter((r) => r.status !== "correct");

/** Ошибки для запроса к ИИ: до `limit`, сначала где потеряно больше баллов, при равенстве — по порядку. */
export function aiMistakes(rows: ReviewRow[], answers: ExamAnswers, lang: Lang, limit = 8): { q: string; given: string; expected: string }[] {
  return onlyMistakes(rows)
    .map((r) => ({ r, lost: r.max - r.points }))
    .sort((a, b) => b.lost - a.lost || a.r.index - b.r.index)
    .slice(0, limit)
    .map(({ r }) => ({
      q: clip(plain(questionPrompt(r.q, lang)), 200),
      given: givenText(r.q, answers[r.q.key], lang),
      expected: correctText(r.q, lang),
    }));
}

/** Номера самых долгих заданий (1-based) с временем в секундах — по ключам из ExamResult.slowest. */
export function slowestRows(paper: ExamPaper, answers: ExamAnswers, keys: string[]): { number: number; key: string; sec: number }[] {
  return keys
    .map((key) => ({ number: paper.items.findIndex((q) => q.key === key) + 1, key, sec: Math.round((answers[key]?.timeMs ?? 0) / 1000) }))
    .filter((x) => x.number > 0);
}

// ---------- Заметки о нехватке заданий ----------

export type NoteVariant =
  /** Не хватило заданий вида во всём банке; заменили другими видами (вариант той же длины). */
  | "kind-replaced"
  /** Не хватило заданий вида во всём банке; вариант короче. */
  | "kind-short"
  /** В теме не хватило, добрали из соседних. */
  | "topic-filled"
  /** В теме не хватило и добрать не удалось: вариант короче. */
  | "topic-short"
  /** Контекстного задания (Python) нет в банке. */
  | "context-none"
  /** Контекстное задание взято не из Python. */
  | "context-other"
  /** В контекстном задании меньше 5 вопросов. */
  | "context-fewer";

/** hasContext — есть ли в варианте контекстные вопросы (иначе запись о «нехватке» значит, что задания нет вовсе). */
export function noteVariant(n: ExamNote, hasContext: boolean): NoteVariant {
  if (n.kind === "context") {
    if (n.filledFrom.length > 0) return "context-other";
    return hasContext ? "context-fewer" : "context-none";
  }
  if (n.topic === null) return n.unfilled > 0 ? "kind-short" : "kind-replaced";
  return n.unfilled > 0 ? "topic-short" : "topic-filled";
}

// ---------- Уроки по теме ----------

/** Готовые уроки темы ЕНТ: сначала те, где тема указана явно, затем те, чьи навыки относятся к теме. */
export function lessonsForTopic(lessons: Lesson[], topic: EntTopicId, skillTopic: (skillId: string) => EntTopicId | undefined): Lesson[] {
  const explicit = lessons.filter((l) => l.entTopics?.includes(topic));
  const bySkill = lessons.filter((l) => !explicit.includes(l) && l.skills.some((s) => skillTopic(s) === topic));
  return [...explicit, ...bySkill];
}
