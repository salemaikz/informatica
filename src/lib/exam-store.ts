// Попытка пробного ЕНТ в IndexedDB: вариант (бумага) и ответы. В localStorage (store.ts) лежит только итог (ExamSummary).
// Бумага пишется один раз, состояние (ответы, текущий вопрос, время) — часто и маленькими записями.
// В приватном режиме IndexedDB может бросать ошибки — тогда работаем из памяти (до закрытия вкладки).
// Всё, что читаем из хранилища, — недоверенное: sanitize* оставляют только корректное.

import { del, get, set } from "idb-keyval";
import { ENT_TOPICS } from "@/content/ent-topics";
import { EXAM_TIME_LIMIT_SEC, isAnswered, scoreExam, scoreQuestion, type ExamAnswer, type ExamAnswers, type ExamKind, type ExamPaper, type ExamQuestion } from "./exam";
import type { ExamSummary } from "./store";
import type { EntTopicId } from "./types";

const PREFIX = "informatica:exam:v1:";
const ACTIVE_KEY = `${PREFIX}active`;
const INDEX_KEY = `${PREFIX}index`;
/** Сколько попыток держим в IndexedDB (как MAX_EXAMS в store.ts). */
export const MAX_ATTEMPTS = 50;

const KINDS: readonly ExamKind[] = ["full", "mini", "topic"];
const ITEM_KINDS = ["single", "multi", "match", "context"];
const TOPIC_IDS = new Set<string>(ENT_TOPICS.map((t) => t.id));

/** Отзыв ИИ по попытке («Разбор от Бита»): хранится в попытке, повторно не запрашивается. */
export interface ExamAiReview {
  feedback: string;
  focus: string[];
  at: number;
}

export interface ExamAttempt {
  id: string;
  kind: ExamKind;
  seed: number;
  topics?: EntTopicId[];
  paper: ExamPaper;
  answers: ExamAnswers;
  /** Индекс текущего вопроса. */
  current: number;
  startedAt: number;
  /** Сколько времени ученик провёл в попытке, мс. Пока вкладка закрыта, время стоит. */
  elapsedMs: number;
  finishedAt?: number;
  review?: ExamAiReview;
}

/** Всё, кроме бумаги: часто пишется. */
export type ExamAttemptState = Omit<ExamAttempt, "paper">;

// ---------- Чистая часть: проверка данных ----------

const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isIdx = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64;

/** Ответ ученика: только корректные индексы и неотрицательное время. */
export function sanitizeAnswer(raw: unknown): ExamAnswer | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const out: ExamAnswer = { timeMs: fin(a.timeMs) ? Math.max(0, a.timeMs) : 0 };
  if (isIdx(a.choice)) out.choice = a.choice;
  if (Array.isArray(a.multi)) out.multi = [...new Set(a.multi.filter(isIdx))];
  if (Array.isArray(a.match)) out.match = a.match.slice(0, 8).map((x) => (isIdx(x) ? x : null));
  if (a.flagged === true) out.flagged = true;
  return out;
}

/** Ответы по ключам вопросов бумаги; чужие ключи отбрасываем. */
export function sanitizeAnswers(raw: unknown, paper: ExamPaper): ExamAnswers {
  const out: ExamAnswers = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const q of paper.items) {
    const a = sanitizeAnswer(src[q.key]);
    if (a) out[q.key] = a;
  }
  return out;
}

/** Бумага из хранилища: оставляем только вопросы с ключом и известным видом задания. */
export function sanitizePaper(raw: unknown): ExamPaper | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!KINDS.includes(p.kind as ExamKind) || !fin(p.seed) || !Array.isArray(p.items)) return null;
  const keys = new Set<string>();
  const items: ExamQuestion[] = [];
  for (const it of p.items) {
    if (!it || typeof it !== "object") continue;
    const q = it as Record<string, unknown>;
    const item = q.item as Record<string, unknown> | undefined;
    if (typeof q.key !== "string" || keys.has(q.key) || !item || typeof item !== "object") continue;
    if (!ITEM_KINDS.includes(item.kind as string) || !TOPIC_IDS.has(item.topic as string)) continue;
    if (item.kind === "context" && !(Number.isInteger(q.sub) && Array.isArray(item.questions) && item.questions[q.sub as number])) continue;
    if (!fin(q.maxPoints)) continue;
    keys.add(q.key);
    items.push(it as unknown as ExamQuestion);
  }
  if (!items.length) return null;
  return {
    kind: p.kind as ExamKind,
    seed: p.seed,
    items,
    maxPoints: fin(p.maxPoints) ? p.maxPoints : items.reduce((s, q) => s + q.maxPoints, 0),
    timeLimitSec: fin(p.timeLimitSec) && p.timeLimitSec > 0 ? p.timeLimitSec : EXAM_TIME_LIMIT_SEC[p.kind as ExamKind],
    notes: Array.isArray(p.notes) ? (p.notes as ExamPaper["notes"]) : [],
  };
}

export function sanitizeReview(raw: unknown): ExamAiReview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.feedback !== "string" || !r.feedback.trim()) return undefined;
  return {
    feedback: r.feedback.slice(0, 4000),
    focus: Array.isArray(r.focus) ? r.focus.filter((x): x is string => typeof x === "string").slice(0, 8).map((x) => x.slice(0, 120)) : [],
    at: fin(r.at) ? r.at : 0,
  };
}

/** Состояние попытки (без бумаги). null — запись повреждена. */
export function sanitizeState(raw: unknown, paper: ExamPaper): ExamAttemptState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id) return null;
  const topics = Array.isArray(s.topics) ? s.topics.filter((t): t is EntTopicId => TOPIC_IDS.has(t as string)) : [];
  return {
    id: s.id,
    kind: paper.kind,
    seed: paper.seed,
    topics: topics.length ? topics : undefined,
    answers: sanitizeAnswers(s.answers, paper),
    current: Number.isInteger(s.current) ? Math.max(0, Math.min(paper.items.length - 1, s.current as number)) : 0,
    startedAt: fin(s.startedAt) ? s.startedAt : 0,
    elapsedMs: fin(s.elapsedMs) ? Math.max(0, s.elapsedMs) : 0,
    finishedAt: fin(s.finishedAt) ? s.finishedAt : undefined,
    review: sanitizeReview(s.review),
  };
}

/** Целая попытка из двух записей. null — что-то повреждено или нет бумаги. */
export function sanitizeAttempt(rawPaper: unknown, rawState: unknown): ExamAttempt | null {
  const paper = sanitizePaper(rawPaper);
  if (!paper) return null;
  const state = sanitizeState(rawState, paper);
  return state ? { ...state, paper } : null;
}

/** Идентификатор попытки: время + случайный хвост. */
export function newAttemptId(now: number, rand: () => number = Math.random): string {
  return `ex-${now.toString(36)}-${Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0")}`;
}

/** Корректный id (приходит из адресной строки). */
export const isAttemptId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(s);

/** Список id: новая попытка первая, повторов нет; что не поместилось — на удаление. */
export function pruneIndex(index: string[], addId: string, max: number = MAX_ATTEMPTS): { keep: string[]; drop: string[] } {
  const all = [addId, ...index.filter((x) => x !== addId)];
  return { keep: all.slice(0, max), drop: all.slice(max) };
}

// ---------- Чистая часть: ответы ----------

/** Копия ответов, где у вопроса `key` применён patch. */
export function patchAnswer(answers: ExamAnswers, key: string, patch: Partial<ExamAnswer>): ExamAnswers {
  const prev = answers[key] ?? { timeMs: 0 };
  return { ...answers, [key]: { ...prev, ...patch } };
}

/** «Один верный»: повторный выбор того же варианта снимает ответ. */
export function pickSingle(answers: ExamAnswers, key: string, index: number): ExamAnswers {
  const same = answers[key]?.choice === index;
  const prev = answers[key] ?? { timeMs: 0 };
  const next: ExamAnswer = { ...prev };
  if (same) delete next.choice;
  else next.choice = index;
  return { ...answers, [key]: next };
}

/** «Несколько верных»: включить/выключить вариант. */
export function toggleMulti(answers: ExamAnswers, key: string, index: number): ExamAnswers {
  const cur = answers[key]?.multi ?? [];
  const multi = cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index].sort((a, b) => a - b);
  return patchAnswer(answers, key, { multi });
}

/** «Соответствие»: пункту item — описание choice (повторный выбор снимает). */
export function pickMatch(answers: ExamAnswers, key: string, item: number, choice: number, items: number): ExamAnswers {
  const cur = answers[key]?.match ?? [];
  const match: (number | null)[] = Array.from({ length: items }, (_, i) => cur[i] ?? null);
  match[item] = match[item] === choice ? null : choice;
  return patchAnswer(answers, key, { match });
}

export function toggleFlag(answers: ExamAnswers, key: string): ExamAnswers {
  const prev = answers[key] ?? { timeMs: 0 };
  const next: ExamAnswer = { ...prev };
  if (prev.flagged) delete next.flagged;
  else next.flagged = true;
  return { ...answers, [key]: next };
}

/** Добавляет время к заданию (мс, без отрицательных и мусора). */
export function addTime(answers: ExamAnswers, key: string, ms: number): ExamAnswers {
  if (!fin(ms) || ms <= 0) return answers;
  const prev = answers[key] ?? { timeMs: 0 };
  return { ...answers, [key]: { ...prev, timeMs: prev.timeMs + ms } };
}

// ---------- Чистая часть: итоги ----------

/** Оценки по навыкам (0..1 за каждое задание) — для освоения: доля набранных баллов. */
export function skillScoresOf(paper: ExamPaper, answers: ExamAnswers): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const q of paper.items) {
    const s = scoreQuestion(q, answers[q.key]);
    (out[q.item.skill] ??= []).push(s.max > 0 ? s.points / s.max : 0);
  }
  return out;
}

/** Итог попытки для store.recordExam. Темы без заданий в варианте не попадают в byTopic. */
export function buildSummary(attempt: ExamAttempt, finishedAt: number): ExamSummary {
  const r = scoreExam(attempt.paper, attempt.answers);
  const byTopic: ExamSummary["byTopic"] = {};
  for (const [t, v] of Object.entries(r.byTopic)) if (v.max > 0) byTopic[t as EntTopicId] = { points: v.points, max: v.max };
  return {
    id: attempt.id,
    kind: attempt.kind,
    seed: attempt.seed,
    at: finishedAt,
    points: r.points,
    maxPoints: r.maxPoints,
    durationSec: Math.round(attempt.elapsedMs / 1000),
    byTopic,
    topics: attempt.kind === "topic" ? attempt.topics : undefined,
  };
}

/** Сколько заданий без ответа и сколько отмечено флажком. */
export function progressOf(paper: ExamPaper, answers: ExamAnswers) {
  let answered = 0;
  let flagged = 0;
  for (const q of paper.items) {
    if (isAnswered(q, answers[q.key])) answered++;
    if (answers[q.key]?.flagged) flagged++;
  }
  return { answered, unanswered: paper.items.length - answered, flagged };
}

// ---------- IndexedDB ----------

/** Запасное хранилище, если IndexedDB недоступна. */
const memory = new Map<string, unknown>();

async function read(key: string): Promise<unknown> {
  try {
    const v = await get(key);
    if (v !== undefined) {
      memory.set(key, v);
      return v;
    }
  } catch {
    // IndexedDB недоступна — берём из памяти.
  }
  return memory.get(key);
}

async function write(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    await set(key, value);
  } catch {
    // остаёмся в памяти
  }
}

async function remove(key: string): Promise<void> {
  memory.delete(key);
  try {
    await del(key);
  } catch {
    // нечего удалять
  }
}

const paperKey = (id: string) => `${PREFIX}paper:${id}`;
const stateKey = (id: string) => `${PREFIX}state:${id}`;

/** Создаёт попытку: бумага пишется один раз; id попадает в список (старые сверх лимита удаляются). */
export async function createAttempt(attempt: ExamAttempt): Promise<void> {
  const { paper, ...state } = attempt;
  await write(paperKey(attempt.id), paper);
  await write(stateKey(attempt.id), state);
  const raw = await read(INDEX_KEY);
  const index = Array.isArray(raw) ? raw.filter(isAttemptId) : [];
  const { keep, drop } = pruneIndex(index, attempt.id);
  await write(INDEX_KEY, keep);
  for (const id of drop) await deleteAttempt(id, false);
}

/** Сохраняет состояние (ответы, текущий вопрос, время, отзыв ИИ). */
export async function saveAttemptState(attempt: ExamAttemptState): Promise<void> {
  await write(stateKey(attempt.id), attempt);
}

export async function loadAttempt(id: string): Promise<ExamAttempt | null> {
  if (!isAttemptId(id)) return null;
  return sanitizeAttempt(await read(paperKey(id)), await read(stateKey(id)));
}

export async function deleteAttempt(id: string, fromIndex = true): Promise<void> {
  await remove(paperKey(id));
  await remove(stateKey(id));
  if (fromIndex) {
    const raw = await read(INDEX_KEY);
    if (Array.isArray(raw)) await write(INDEX_KEY, raw.filter((x) => x !== id));
  }
}

/** Попытка, которую начали и не закончили (одна на устройство). */
export async function setActiveAttempt(id: string | null): Promise<void> {
  if (id) await write(ACTIVE_KEY, id);
  else await remove(ACTIVE_KEY);
}

export async function loadActiveAttempt(): Promise<ExamAttempt | null> {
  const id = await read(ACTIVE_KEY);
  if (!isAttemptId(id)) return null;
  const a = await loadAttempt(id);
  if (!a || a.finishedAt) {
    await setActiveAttempt(null);
    return null;
  }
  return a;
}
