// Попытка пробного ЕНТ в IndexedDB: вариант (бумага) и ответы. В localStorage (store.ts) лежит только итог (ExamSummary).
// Бумага пишется один раз, состояние (ответы, текущий вопрос, время) — часто и маленькими записями.
// В приватном режиме IndexedDB может бросать ошибки — тогда работаем из памяти (до закрытия вкладки).
// Всё, что читаем из хранилища, — недоверенное: sanitize* оставляют только корректное.

import { del, get, set } from "idb-keyval";
import { ENT_TOPICS } from "@/content/ent-topics";
import { EXAM_TIME_LIMIT_SEC, isAnswered, scoreExam, scoreQuestion, type ExamAnswer, type ExamAnswers, type ExamKind, type ExamPaper, type ExamQuestion } from "./exam";
import { sanitizeChallenge, type Challenge } from "./challenge";
import type { ExamSummary } from "./store";
import type { EntTopicId } from "./types";

const PREFIX = "informatica:exam:v1:";
const ACTIVE_KEY = `${PREFIX}active`;
const INDEX_KEY = `${PREFIX}index`;
/** Сколько попыток держим в IndexedDB (как MAX_EXAMS в store.ts). */
export const MAX_ATTEMPTS = 50;

const KINDS: readonly ExamKind[] = ["full", "mini", "topic", "unit"];
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
  /** Тест по разделу: id раздела. */
  unit?: string;
  paper: ExamPaper;
  answers: ExamAnswers;
  /** Индекс текущего вопроса. */
  current: number;
  startedAt: number;
  /** Сколько времени ученик провёл в попытке, мс. Пока вкладка закрыта, время стоит. */
  elapsedMs: number;
  finishedAt?: number;
  review?: ExamAiReview;
  /** Тест по разделу сдан: уроки, засчитанные за него (id по порядку курса). Нет поля — уроки не засчитывались. */
  credited?: string[];
  /** Тег банка заданий, на котором собран вариант (`currentPoolTag`, #73): им делятся в вызове другу. */
  pool?: string;
  /** Вызов друга, с которым начата попытка (#73): баннер и сравнение переживают перезагрузку. */
  challenge?: Challenge;
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

/** Текст задания: строка или { ru, kk }. */
const isText = (x: unknown): boolean =>
  typeof x === "string" || (!!x && typeof x === "object" && typeof (x as Record<string, unknown>).ru === "string" && typeof (x as Record<string, unknown>).kk === "string");
const textList = (x: unknown, min: number): x is unknown[] => Array.isArray(x) && x.length >= min && x.length <= 8 && x.every(isText);
const inRange = (v: unknown, n: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;

/** Структура задания по виду: варианты — тексты, верные индексы — в пределах (иначе экран упадёт или посчитает неверно). */
function isValidItem(item: Record<string, unknown>, sub: unknown): boolean {
  if (typeof item.id !== "string" || typeof item.skill !== "string" || ![1, 2, 3].includes(item.level as number)) return false;
  switch (item.kind) {
    case "single":
      return isText(item.prompt) && textList(item.options, 2) && inRange(item.correct, (item.options as unknown[]).length);
    case "multi":
      return (
        isText(item.prompt) &&
        textList(item.options, 2) &&
        Array.isArray(item.correct) &&
        item.correct.length > 0 &&
        item.correct.every((c) => inRange(c, (item.options as unknown[]).length))
      );
    case "match":
      return (
        isText(item.prompt) &&
        textList(item.items, 1) &&
        textList(item.choices, 2) &&
        Array.isArray(item.answer) &&
        item.answer.length === (item.items as unknown[]).length &&
        item.answer.every((c) => inRange(c, (item.choices as unknown[]).length))
      );
    case "context": {
      if (!isText(item.text) || !Array.isArray(item.questions) || !inRange(sub, item.questions.length)) return false;
      const cq = item.questions[sub as number] as Record<string, unknown> | null;
      return !!cq && typeof cq === "object" && isText(cq.prompt) && textList(cq.options, 2) && inRange(cq.correct, (cq.options as unknown[]).length);
    }
    default:
      return false;
  }
}

const KIND_SET = new Set(["single", "multi", "match", "context"]);

/** Записи о нехватке заданий: только корректные (их тексты подставляются в интерфейс). */
export function sanitizeNotes(raw: unknown): ExamPaper["notes"] {
  if (!Array.isArray(raw)) return [];
  const out: ExamPaper["notes"] = [];
  for (const x of raw.slice(0, 64)) {
    if (!x || typeof x !== "object") continue;
    const n = x as Record<string, unknown>;
    if (!KIND_SET.has(n.kind as string)) continue;
    if (n.topic !== null && !TOPIC_IDS.has(n.topic as string)) continue;
    const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 99) : 0);
    out.push({
      topic: n.topic as EntTopicId | null,
      kind: n.kind as ExamPaper["notes"][number]["kind"],
      missing: count(n.missing),
      unfilled: count(n.unfilled),
      filledFrom: Array.isArray(n.filledFrom) ? n.filledFrom.filter((t): t is EntTopicId => TOPIC_IDS.has(t as string)) : [],
    });
  }
  return out;
}

/** Бумага из хранилища: оставляем только вопросы с ключом, известным видом и целой структурой задания. */
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
    if (!TOPIC_IDS.has(item.topic as string)) continue;
    if (!isValidItem(item, q.sub)) continue;
    if (!fin(q.maxPoints) || q.maxPoints < 0 || q.maxPoints > 2) continue;
    keys.add(q.key);
    items.push(it as unknown as ExamQuestion);
  }
  if (!items.length) return null;
  return {
    kind: p.kind as ExamKind,
    seed: p.seed,
    items,
    // Всегда по оставшимся вопросам: если битые отброшены, максимум не должен остаться прежним.
    maxPoints: items.reduce((s, q) => s + q.maxPoints, 0),
    timeLimitSec: fin(p.timeLimitSec) && p.timeLimitSec > 0 ? p.timeLimitSec : EXAM_TIME_LIMIT_SEC[p.kind as ExamKind],
    notes: sanitizeNotes(p.notes),
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

/** id засчитанных уроков: короткие строки без лишних знаков, не больше 40 штук. Пустой список сохраняется (сдан, засчитывать нечего); не массив — undefined (старая попытка). */
export function sanitizeCredited(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = [...new Set(raw.filter((x): x is string => typeof x === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(x)))].slice(0, 40);
  return out;
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
    unit: paper.kind === "unit" && isUnitId(s.unit) ? s.unit : undefined,
    answers: sanitizeAnswers(s.answers, paper),
    current: Number.isInteger(s.current) ? Math.max(0, Math.min(paper.items.length - 1, s.current as number)) : 0,
    startedAt: fin(s.startedAt) ? s.startedAt : 0,
    elapsedMs: fin(s.elapsedMs) ? Math.max(0, s.elapsedMs) : 0,
    finishedAt: fin(s.finishedAt) ? s.finishedAt : undefined,
    review: sanitizeReview(s.review),
    credited: paper.kind === "unit" ? sanitizeCredited(s.credited) : undefined,
    pool: isPoolTag(s.pool) ? s.pool : undefined,
    // Вызов — только для полного, мини и теста по теме (тестом по разделу не делятся, #73).
    challenge: paper.kind !== "unit" ? (sanitizeChallenge(s.challenge) ?? undefined) : undefined,
  };
}

/** Тег банка заданий: 4 знака [a-z0-9] (lib/challenge.ts → poolTag). */
export const isPoolTag = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]{4}$/.test(s);

/** Целая попытка из двух записей. null — что-то повреждено или нет бумаги. */
export function sanitizeAttempt(rawPaper: unknown, rawState: unknown): ExamAttempt | null {
  const paper = sanitizePaper(rawPaper);
  if (!paper) return null;
  const state = sanitizeState(rawState, paper);
  return state ? { ...state, paper } : null;
}

/** Корректный id раздела (приходит из адреса и хранилища). */
export const isUnitId = (s: unknown): s is string => typeof s === "string" && /^[a-z][a-z0-9]{0,15}$/.test(s);

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

/**
 * Оценки по навыкам (0..1 за каждое задание) — для освоения: доля набранных баллов.
 * Только задания с ответом: пропуск (не успел, не открывал) ничего не говорит о навыке, а пустая попытка
 * иначе обнулила бы освоение десятков навыков и засчитала день серии (recordExam считает оценки как ответы).
 */
export function skillScoresOf(paper: ExamPaper, answers: ExamAnswers): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const q of paper.items) {
    if (!isAnswered(q, answers[q.key])) continue;
    const s = scoreQuestion(q, answers[q.key]);
    (out[q.item.skill] ??= []).push(s.max > 0 ? s.points / s.max : 0);
  }
  return out;
}

/**
 * Итог попытки для store.recordExam. Темы без заданий в варианте не попадают в byTopic.
 * title — название для истории тестов (контрольная: «Контрольная: <раздел>»).
 */
export function buildSummary(attempt: ExamAttempt, finishedAt: number, title?: string): ExamSummary {
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
    unit: attempt.kind === "unit" ? attempt.unit : undefined,
    title: attempt.kind === "unit" && title ? title : undefined,
    // Знаменатель точности дня (#66): весь вариант, пропущенные — со счётом 0.
    questions: attempt.paper.items.length,
    pool: isPoolTag(attempt.pool) ? attempt.pool : undefined,
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
