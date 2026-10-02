import { CONTEXT_TOPIC, ENT_TOPICS } from "@/content/ent-topics";
import { multiPoints } from "./ent";
import { hashString, seeded, shuffle } from "./text";
import type { EntContext, EntItem, EntMatch, EntMulti, EntSingle, EntTopicId, Level, Text } from "./types";

// Пробный ЕНТ: сборка варианта из банка, подсчёт баллов, советы по результату.
// Чистая логика без React. Формат ЕНТ — docs/ENT.md, раздел 1.

export type ExamKind = "full" | "mini" | "topic";
export type EntKind = EntItem["kind"];

/** Явные ограничения формата. */
export const FULL_COUNTS = { single: 25, multi: 5, match: 5 } as const;
export const MINI_COUNTS = { single: 11, multi: 2, match: 2 } as const; // 9 + 2 «без контекста»
export const TOPIC_COUNTS = { single: 6, multi: 2, match: 2 } as const;
/** Время: 2 минуты на задание (как в спецификации ЕНТ). */
export const SEC_PER_QUESTION = 120;
export const EXAM_TIME_LIMIT_SEC: Record<ExamKind, number> = { full: 80 * 60, mini: 30 * 60, topic: 20 * 60 };
/** Доли уровней A/B/C в варианте: 50/30/20. */
const LEVEL_SHARE: readonly [number, number, number] = [0.5, 0.3, 0.2];
/** Вопросов в контекстном задании. */
const CONTEXT_QUESTIONS = 5;

/** Запись о том, чего не хватило в банке (не молчим). */
export interface ExamNote {
  /** Тема, где не хватило заданий; null — не хватило вообще по виду (в мини/по теме). */
  topic: EntTopicId | null;
  kind: EntKind;
  /** Сколько заданий не нашлось в самой теме. */
  missing: number;
  /** Из каких соседних тем добрали. */
  filledFrom: EntTopicId[];
  /** Сколько так и не нашли (вариант получился короче). */
  unfilled: number;
}

/** Плоский вопрос варианта. Для контекстного задания item — общий, sub — номер вопроса. */
export interface ExamQuestion {
  key: string;
  item: EntItem;
  sub?: number;
  maxPoints: number;
}

export interface ExamPaper {
  kind: ExamKind;
  seed: number;
  items: ExamQuestion[];
  maxPoints: number;
  timeLimitSec: number;
  notes: ExamNote[];
}

export interface BuildExamOpts {
  kind: ExamKind;
  seed: number;
  pool: EntItem[];
  /** Для kind = "topic": выбранные темы. */
  topics?: EntTopicId[];
}

// ---------- Темы и соседи ----------

const ALL_TOPICS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);
const EXAM_COUNT = new Map<EntTopicId, number>(ENT_TOPICS.map((t) => [t.id, t.examCount]));

/** Разделы спецификации; t08 (ПО) близка к разделу «Компьютерные системы», поэтому в одной группе с t01–t02. */
const GROUPS: EntTopicId[][] = [
  ["t01", "t02", "t08"],
  ["t03", "t04", "t05"],
  ["t06", "t07"],
  ["t09", "t10", "t11"],
  ["t12", "t13"],
];
const groupOf = (t: EntTopicId) => GROUPS.findIndex((g) => g.includes(t));
const topicNum = (t: EntTopicId) => Number(t.slice(1));

/** Соседние темы: сначала тот же раздел, потом остальные; внутри — по близости номера. */
function neighbors(topic: EntTopicId, allowed: EntTopicId[]): EntTopicId[] {
  const g = groupOf(topic);
  return allowed
    .filter((t) => t !== topic)
    .sort((a, b) => {
      const ga = groupOf(a) === g ? 0 : 1;
      const gb = groupOf(b) === g ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const da = Math.abs(topicNum(a) - topicNum(topic));
      const db = Math.abs(topicNum(b) - topicNum(topic));
      return da - db || topicNum(a) - topicNum(b);
    });
}

// ---------- Случайность ----------

function pickWeighted<T>(items: T[], weight: (x: T) => number, rand: () => number): T | null {
  const ws = items.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Распределение n по уровням 50/30/20 (метод наибольших остатков) в случайном порядке. */
function levelPlan(n: number, rand: () => number): Level[] {
  const raw = LEVEL_SHARE.map((s) => s * n);
  const base = raw.map(Math.floor);
  let rest = n - base.reduce((a, b) => a + b, 0);
  const order = [0, 1, 2].sort((a, b) => raw[b] - base[b] - (raw[a] - base[a]) || a - b);
  for (const i of order) {
    if (rest <= 0) break;
    base[i]++;
    rest--;
  }
  const out: Level[] = [];
  base.forEach((c, i) => {
    for (let k = 0; k < c; k++) out.push((i + 1) as Level);
  });
  return shuffle(out, rand);
}

// ---------- Перемешивание вариантов ----------

/** Перестановка: order[новый индекс] = старый индекс. */
function permute<T>(arr: readonly T[], order: number[]): T[] {
  return order.map((o) => arr[o]);
}

function shuffleOrder(n: number, rand: () => number): number[] {
  return shuffle(Array.from({ length: n }, (_, i) => i), rand);
}

function shuffleOptions<O extends { options: Text[]; correct: number }>(
  q: O,
  rand: () => number,
): { options: Text[]; correct: number; order: number[] } {
  const order = shuffleOrder(q.options.length, rand);
  return { options: permute(q.options, order), correct: order.indexOf(q.correct), order };
}

/** Перемешивает варианты по seed с пересчётом correct/answer/whyWrong. Исходное задание не меняется. */
export function shuffleEntItem(item: EntItem, seed: number): EntItem {
  const rand = seeded((seed ^ hashString(item.id)) >>> 0);
  switch (item.kind) {
    case "single": {
      const { options, correct, order } = shuffleOptions(item, rand);
      const out: EntSingle = { ...item, options, correct };
      if (item.whyWrong) out.whyWrong = permute(item.whyWrong, order);
      return out;
    }
    case "multi": {
      const order = shuffleOrder(item.options.length, rand);
      const out: EntMulti = {
        ...item,
        options: permute(item.options, order),
        correct: item.correct.map((c) => order.indexOf(c)).sort((a, b) => a - b),
      };
      return out;
    }
    case "match": {
      const order = shuffleOrder(item.choices.length, rand);
      const out: EntMatch = {
        ...item,
        choices: permute(item.choices, order),
        answer: item.answer.map((a) => order.indexOf(a)),
      };
      return out;
    }
    case "context": {
      const out: EntContext = {
        ...item,
        questions: item.questions.map((q) => {
          const qr = seeded((seed ^ hashString(q.id)) >>> 0);
          const { options, correct } = shuffleOptions(q, qr);
          return { ...q, options, correct };
        }),
      };
      return out;
    }
  }
}

// ---------- Сборка варианта ----------

interface Slot {
  topic: EntTopicId;
  kind: Exclude<EntKind, "context">;
  level: Level;
}

type PlainKind = Slot["kind"];
const PLAIN_KINDS: PlainKind[] = ["single", "multi", "match"];

/** Полный вариант: multi/match — взвешенно по examCount, остальное — single (всего ровно examCount на тему). */
function planFull(rand: () => number): { topic: EntTopicId; kind: PlainKind }[] {
  const cap = new Map(EXAM_COUNT);
  const plan: { topic: EntTopicId; kind: PlainKind }[] = [];
  for (const kind of ["multi", "match"] as const) {
    for (let i = 0; i < FULL_COUNTS[kind]; i++) {
      const t = pickWeighted(ALL_TOPICS, (x) => (cap.get(x)! > 0 ? EXAM_COUNT.get(x)! : 0), rand);
      if (!t) break;
      cap.set(t, cap.get(t)! - 1);
      plan.push({ topic: t, kind });
    }
  }
  for (const t of ALL_TOPICS) for (let i = 0; i < cap.get(t)!; i++) plan.push({ topic: t, kind: "single" });
  return plan;
}

/** Мини и «по теме»: темы, где есть задания; вес темы падает с каждым выбором — охват шире. */
function planFlexible(
  target: Record<PlainKind, number>,
  topics: EntTopicId[],
  pool: EntItem[],
  rand: () => number,
): { plan: { topic: EntTopicId; kind: PlainKind }[]; shortage: Record<PlainKind, number> } {
  const cap = new Map<string, number>();
  const totalAvail: Record<PlainKind, number> = { single: 0, multi: 0, match: 0 };
  for (const it of pool) {
    if (it.kind === "context" || !topics.includes(it.topic)) continue;
    const k = `${it.topic}|${it.kind}`;
    cap.set(k, (cap.get(k) ?? 0) + 1);
    totalAvail[it.kind]++;
  }
  // Недостающее по виду переносим на другие виды (сначала single).
  const n: Record<PlainKind, number> = {
    single: Math.min(target.single, totalAvail.single),
    multi: Math.min(target.multi, totalAvail.multi),
    match: Math.min(target.match, totalAvail.match),
  };
  let deficit = PLAIN_KINDS.reduce((s, k) => s + target[k], 0) - PLAIN_KINDS.reduce((s, k) => s + n[k], 0);
  for (const k of PLAIN_KINDS) {
    const add = Math.min(deficit, totalAvail[k] - n[k]);
    n[k] += add;
    deficit -= add;
  }
  const picks = new Map<EntTopicId, number>();
  const plan: { topic: EntTopicId; kind: PlainKind }[] = [];
  for (const kind of ["multi", "match", "single"] as const) {
    for (let i = 0; i < n[kind]; i++) {
      const t = pickWeighted(
        topics,
        (x) => ((cap.get(`${x}|${kind}`) ?? 0) > 0 ? EXAM_COUNT.get(x)! / (1 + (picks.get(x) ?? 0)) : 0),
        rand,
      );
      if (!t) break;
      cap.set(`${t}|${kind}`, cap.get(`${t}|${kind}`)! - 1);
      picks.set(t, (picks.get(t) ?? 0) + 1);
      plan.push({ topic: t, kind });
    }
  }
  const shortage: Record<PlainKind, number> = { single: 0, multi: 0, match: 0 };
  // Остаток дефицита записываем на single (общий недобор).
  shortage.single = deficit;
  return { plan, shortage };
}

function nearestLevelPick<T extends { level: Level }>(cands: T[], want: Level, rand: () => number): T {
  const best = Math.min(...cands.map((c) => Math.abs(c.level - want)));
  const tied = cands.filter((c) => Math.abs(c.level - want) === best);
  return tied[Math.floor(rand() * tied.length)];
}

function expand(item: EntItem): ExamQuestion[] {
  if (item.kind === "context") {
    return item.questions.map((_, sub) => ({ key: `${item.id}#${sub}`, item, sub, maxPoints: 1 }));
  }
  return [{ key: item.id, item, maxPoints: item.kind === "single" ? 1 : 2 }];
}

/** Собирает вариант детерминированно: один seed → один вариант. */
export function buildExam(opts: BuildExamOpts): ExamPaper {
  const { kind, seed, pool } = opts;
  const rand = seeded(seed);
  const notes: ExamNote[] = [];

  const topicScope: EntTopicId[] =
    kind === "topic"
      ? (opts.topics?.length ? ALL_TOPICS.filter((t) => opts.topics!.includes(t)) : ALL_TOPICS)
      : kind === "mini"
        ? ALL_TOPICS.filter((t) => pool.some((i) => i.topic === t))
        : ALL_TOPICS;

  const plain = pool.filter((i): i is Exclude<EntItem, EntContext> => i.kind !== "context");
  const used = new Set<string>();

  // 1. План: какие (тема, вид) нужны.
  let plan: { topic: EntTopicId; kind: PlainKind }[];
  if (kind === "full") {
    plan = planFull(rand);
  } else {
    const target = kind === "mini" ? MINI_COUNTS : TOPIC_COUNTS;
    const r = planFlexible(target, topicScope, plain, rand);
    plan = r.plan;
    if (r.shortage.single > 0) notes.push({ topic: null, kind: "single", missing: r.shortage.single, filledFrom: [], unfilled: r.shortage.single });
  }

  // 2. Уровни: 50/30/20 по каждому виду отдельно.
  const slots: Slot[] = [];
  for (const k of PLAIN_KINDS) {
    const ofKind = plan.filter((p) => p.kind === k);
    const levels = levelPlan(ofKind.length, rand);
    ofKind.forEach((p, i) => slots.push({ topic: p.topic, kind: k, level: levels[i] }));
  }

  // 3. Выбор заданий; добор из соседних тем с записью в notes.
  const noteMap = new Map<string, ExamNote>();
  const noteFor = (topic: EntTopicId, k: EntKind) => {
    const key = `${topic}|${k}`;
    let n = noteMap.get(key);
    if (!n) {
      n = { topic, kind: k, missing: 0, filledFrom: [], unfilled: 0 };
      noteMap.set(key, n);
    }
    return n;
  };
  const chosen: Record<PlainKind, EntItem[]> = { single: [], multi: [], match: [] };
  for (const s of slots) {
    const own = plain.filter((i) => i.kind === s.kind && i.topic === s.topic && !used.has(i.id));
    let picked: (typeof plain)[number] | null = own.length ? nearestLevelPick(own, s.level, rand) : null;
    if (!picked) {
      const n = noteFor(s.topic, s.kind);
      n.missing++;
      for (const t of neighbors(s.topic, topicScope)) {
        const c = plain.filter((i) => i.kind === s.kind && i.topic === t && !used.has(i.id));
        if (c.length) {
          picked = nearestLevelPick(c, s.level, rand);
          if (!n.filledFrom.includes(t)) n.filledFrom.push(t);
          break;
        }
      }
      if (!picked) n.unfilled++;
    }
    if (picked) {
      used.add(picked.id);
      chosen[s.kind].push(picked);
    }
  }
  notes.push(...noteMap.values());

  // 4. Контекстное задание (только в полном).
  let context: EntContext | null = null;
  if (kind === "full") {
    const ctxs = pool.filter((i): i is EntContext => i.kind === "context");
    const preferred = ctxs.filter((c) => c.topic === CONTEXT_TOPIC);
    const from = preferred.length ? preferred : ctxs;
    if (from.length) {
      context = from[Math.floor(rand() * from.length)];
      if (context.questions.length < CONTEXT_QUESTIONS) {
        notes.push({ topic: CONTEXT_TOPIC, kind: "context", missing: CONTEXT_QUESTIONS - context.questions.length, filledFrom: [], unfilled: CONTEXT_QUESTIONS - context.questions.length });
      } else if (!preferred.length) {
        notes.push({ topic: CONTEXT_TOPIC, kind: "context", missing: 1, filledFrom: [context.topic], unfilled: 0 });
      }
    } else {
      notes.push({ topic: CONTEXT_TOPIC, kind: "context", missing: 1, filledFrom: [], unfilled: 1 });
    }
  }

  // 5. Порядок как в ЕНТ: один верный → контекст → несколько верных → соответствие.
  const ordered: EntItem[] = [
    ...shuffle(chosen.single, rand),
    ...(context ? [context] : []),
    ...shuffle(chosen.multi, rand),
    ...shuffle(chosen.match, rand),
  ];
  const items = ordered.flatMap((it) => expand(shuffleEntItem(it, seed)));
  const maxPoints = items.reduce((s, q) => s + q.maxPoints, 0);
  return { kind, seed, items, maxPoints, timeLimitSec: EXAM_TIME_LIMIT_SEC[kind], notes };
}

// ---------- Ответы и баллы ----------

export type ExamAnswer = { choice?: number; multi?: number[]; match?: (number | null)[] } & {
  timeMs: number;
  flagged?: boolean;
};

/** Ответы ученика по ключу вопроса (`ExamQuestion.key`). */
export type ExamAnswers = Record<string, ExamAnswer | undefined>;

export interface QuestionScore {
  points: number;
  max: number;
  correct: boolean;
}

/** Вопрос контекстного задания по `q.sub`. */
export function contextQuestionOf(q: ExamQuestion) {
  return q.item.kind === "context" && q.sub !== undefined ? q.item.questions[q.sub] : undefined;
}

export function isAnswered(q: ExamQuestion, a: ExamAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.item.kind) {
    case "single":
    case "context":
      return a.choice !== undefined && a.choice !== null;
    case "multi":
      return !!a.multi && a.multi.length > 0;
    case "match":
      return !!a.match && a.match.some((x) => x !== null && x !== undefined);
  }
}

export function scoreQuestion(q: ExamQuestion, a: ExamAnswer | undefined): QuestionScore {
  const item = q.item;
  let points = 0;
  if (a) {
    switch (item.kind) {
      case "single":
        points = a.choice === item.correct ? 1 : 0;
        break;
      case "context": {
        const cq = contextQuestionOf(q);
        points = cq && a.choice === cq.correct ? 1 : 0;
        break;
      }
      case "multi":
        points = multiPoints(item.correct, a.multi ?? []);
        break;
      case "match": {
        const right = item.answer.filter((x, i) => a.match?.[i] === x).length;
        points = right === item.answer.length ? 2 : right > 0 ? 1 : 0;
        break;
      }
    }
  }
  return { points, max: q.maxPoints, correct: points === q.maxPoints };
}

type Tally = { points: number; max: number };

export interface ExamResult {
  points: number;
  maxPoints: number;
  /** 0..100, целое. */
  percent: number;
  byTopic: Record<EntTopicId, { points: number; max: number; count: number }>;
  byKind: Record<"single" | "multi" | "match" | "context", Tally>;
  byLevel: Record<Level, Tally>;
  timeSec: number;
  avgSecPerQuestion: number;
  /** До трёх самых долгих вопросов (ключи). */
  slowest: string[];
  unanswered: number;
  /** Разбор «нескольких верных»: с лишним неверным / без лишних, но не все верные. */
  multi: { extra: number; missed: number };
}

export function scoreExam(paper: ExamPaper, answers: ExamAnswers): ExamResult {
  const byTopic = Object.fromEntries(ALL_TOPICS.map((t) => [t, { points: 0, max: 0, count: 0 }])) as ExamResult["byTopic"];
  const byKind: ExamResult["byKind"] = {
    single: { points: 0, max: 0 },
    multi: { points: 0, max: 0 },
    match: { points: 0, max: 0 },
    context: { points: 0, max: 0 },
  };
  const byLevel: ExamResult["byLevel"] = { 1: { points: 0, max: 0 }, 2: { points: 0, max: 0 }, 3: { points: 0, max: 0 } };
  let points = 0;
  let unanswered = 0;
  let timeMs = 0;
  const multi = { extra: 0, missed: 0 };

  for (const q of paper.items) {
    const a = answers[q.key];
    const s = scoreQuestion(q, a);
    points += s.points;
    const t = byTopic[q.item.topic];
    t.points += s.points;
    t.max += s.max;
    t.count++;
    byKind[q.item.kind].points += s.points;
    byKind[q.item.kind].max += s.max;
    byLevel[q.item.level].points += s.points;
    byLevel[q.item.level].max += s.max;
    if (!isAnswered(q, a)) unanswered++;
    timeMs += Math.max(0, a?.timeMs ?? 0);
    if (q.item.kind === "multi" && a?.multi?.length && s.points < s.max) {
      const right = new Set(q.item.correct);
      const wrong = [...new Set(a.multi)].filter((i) => !right.has(i)).length;
      if (wrong > 0) multi.extra++;
      else multi.missed++;
    }
  }

  const n = paper.items.length;
  const timeSec = Math.round(timeMs / 1000);
  const slowest = paper.items
    .map((q) => ({ key: q.key, ms: answers[q.key]?.timeMs ?? 0 }))
    .filter((x) => x.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .map((x) => x.key);

  return {
    points,
    maxPoints: paper.maxPoints,
    percent: paper.maxPoints ? Math.round((points / paper.maxPoints) * 100) : 0,
    byTopic,
    byKind,
    byLevel,
    timeSec,
    avgSecPerQuestion: n ? Math.round((timeSec / n) * 10) / 10 : 0,
    slowest,
    unanswered,
    multi,
  };
}

// ---------- Советы ----------

/** Коды советов; тексты — в UI (i18n). */
export type AdviceId =
  | "no-doubtful-options" // в «нескольких верных» лишний вариант стоит балла
  | "find-all-correct" // верные есть, но не все — ищи каждый
  | "check-units" // единицы информации и скорость — слабая тема
  | "trace-code" // Python/алгоритмы — прогоняй программу по шагам
  | "skip-and-return" // слишком медленно — отложи трудное и вернись
  | "read-carefully" // слишком быстро и много ошибок — перечитывай условие
  | "answer-everything"; // были пропуски — пустой ответ = 0 баллов

export const WEAK_BELOW_RATIO = 0.5;
export const STRONG_FROM_RATIO = 0.8;

export interface ExamAdvice {
  weakTopics: EntTopicId[];
  strongTopics: EntTopicId[];
  pace: "fast" | "ok" | "slow";
  tips: AdviceId[];
}

export function examAdvice(result: ExamResult): ExamAdvice {
  const ratio = (t: EntTopicId) => {
    const x = result.byTopic[t];
    return x.max ? x.points / x.max : 0;
  };
  const withData = ALL_TOPICS.filter((t) => result.byTopic[t].max > 0);
  const weakTopics = withData.filter((t) => ratio(t) < WEAK_BELOW_RATIO).sort((a, b) => ratio(a) - ratio(b));
  const strongTopics = withData.filter((t) => ratio(t) >= STRONG_FROM_RATIO).sort((a, b) => ratio(b) - ratio(a));

  const avg = result.avgSecPerQuestion;
  const pace: ExamAdvice["pace"] = avg > SEC_PER_QUESTION ? "slow" : avg > 0 && avg < SEC_PER_QUESTION / 2 ? "fast" : "ok";
  const accuracy = result.maxPoints ? result.points / result.maxPoints : 0;

  const tips: AdviceId[] = [];
  if (result.multi.extra > 0) tips.push("no-doubtful-options");
  if (result.multi.missed > 0) tips.push("find-all-correct");
  const unitsWeak = (["t03", "t04"] as const).some((t) => result.byTopic[t].max >= 2 && ratio(t) < 0.6);
  if (unitsWeak) tips.push("check-units");
  const codeWeak = (["t06", "t07"] as const).some((t) => result.byTopic[t].max >= 2 && ratio(t) < 0.6);
  const ctx = result.byKind.context;
  if (codeWeak || (ctx.max > 0 && ctx.points / ctx.max < 0.5)) tips.push("trace-code");
  if (pace === "slow") tips.push("skip-and-return");
  if (pace === "fast" && accuracy < 0.6) tips.push("read-carefully");
  if (result.unanswered > 0) tips.push("answer-everything");
  return { weakTopics, strongTopics, pace, tips };
}
