// Незаконченный урок (решение #41): сохраняем прохождение, чтобы звонок посреди урока не отбрасывал в начало.
// Чистые функции без React; хранится в сторе (lessonRuns), плеер — components/lesson/LessonPlayer.tsx.
//
// Правила:
// - сохраняется только урок в режиме «Учиться» (kind "lesson", via learn); «Проверить себя» собирается заново каждый раз;
// - до RUN_MAX уроков, каждый — не дольше RUN_TTL_MS с последнего действия;
// - шаги урока изменились (другой отпечаток sig) — сохранение сбрасывается;
// - вход оплачивается при открытии урока (этап 16Г, #120; lib/economy.ts → ENTRY_COST, lib/entry-paid.ts); возврат в урок
//   не позже RUN_GRACE_MS с последнего действия (перезагрузка, случайный выход) — повторно не списывается.

import type { AnswerRecord, Step } from "./types";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Сколько незаконченных уроков храним (самые свежие). */
export const RUN_MAX = 5;
/** Сколько живёт сохранение без действий. */
export const RUN_TTL_MS = 14 * DAY;
/** Вернулся не позже этого — вход уже оплачен, второй раз не списываем. */
export const RUN_GRACE_MS = 20 * MINUTE;
/** Ответов в сохранении не больше (защита от раздувания localStorage). */
const MAX_RECORDS = 80;

/** Элемент очереди плеера: id шага урока и пометка «повтор ошибки в конце». */
export interface RunQueueItem {
  id: string;
  retry: boolean;
}

export interface LessonRun {
  lessonId: string;
  /** Отпечаток шагов урока на момент старта (lessonSig). */
  sig: string;
  queue: RunQueueItem[];
  /** Индекс следующего непройденного шага в queue (0…queue.length). */
  pos: number;
  /** Пройдено шагов (для полоски прогресса). */
  done: number;
  records: AnswerRecord[];
  xp: number;
  combo: number;
  maxCombo: number;
  skipped: number;
  /** Время в уроке до сохранения, мс (durationSec в итогах). */
  activeMs: number;
  /** Множитель XP, зафиксированный на входе (повтор урока даёт меньше). */
  xpFactor: number;
  /** Чипов заработано в этом прохождении до сохранения (итоги показывают сумму за весь урок). */
  chipsEarned: number;
  /** Цена входа в сердечках (1 или 2) — для подписи «Продолжить». */
  cost: number;
  startedAt: number;
  /** Последнее действие (сохранение). */
  updatedAt: number;
  /** Когда оплачен вход; null — не списан («Безлимит», бесплатный вход или сохранение до этапа 16Г). */
  paidAt: number | null;
}

/** Отпечаток шагов урока: id и тип каждого шага (FNV-1a, 32 бита). Изменился урок — сохранение не подходит. */
export function lessonSig(steps: readonly Pick<Step, "id" | "type">[]): string {
  let h = 0x811c9dc5;
  const text = steps.map((s) => `${s.id}:${s.type}`).join("|");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${steps.length}-${h.toString(36)}`;
}

/** Вход уже оплачен и с последнего действия прошло не больше RUN_GRACE_MS — продолжение бесплатно. */
export function runPaid(run: Pick<LessonRun, "paidAt" | "updatedAt">, now: number): boolean {
  return run.paidAt !== null && now - run.updatedAt >= 0 && now - run.updatedAt <= RUN_GRACE_MS;
}

/**
 * Сохранение, с которого можно продолжить урок, или null: не тот урок, другой отпечаток, просрочено,
 * шаг из очереди пропал, ещё ничего не пройдено и вход не оплачен (pos = 0 без оплаты — продолжать нечего, просто начинаем).
 * pos = 0 с оплатой — вход списан, а шаг не пройден (например, фото не прочиталось): продолжаем, чтобы не платить снова.
 */
export function usableRun(
  run: LessonRun | undefined,
  lesson: { id: string; steps: readonly Pick<Step, "id" | "type">[] },
  now: number,
): LessonRun | null {
  if (!run || run.lessonId !== lesson.id) return null;
  if (run.sig !== lessonSig(lesson.steps)) return null;
  if (now - run.updatedAt > RUN_TTL_MS) return null;
  if (run.pos < 0 || run.pos > run.queue.length || (run.pos === 0 && run.paidAt === null)) return null;
  const ids = new Set(lesson.steps.map((s) => s.id));
  if (!run.queue.every((q) => ids.has(q.id))) return null;
  return run;
}

/** Очередь плеера из сохранения: шаги берём из урока по id (null — шага нет). */
export function restoreQueue<S extends { id: string }>(run: LessonRun, steps: readonly S[]): { step: S; retry: boolean; key: string }[] | null {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const out: { step: S; retry: boolean; key: string }[] = [];
  for (const q of run.queue) {
    const step = byId.get(q.id);
    if (!step) return null;
    out.push({ step, retry: q.retry, key: q.retry ? `${q.id}:retry` : q.id });
  }
  return out;
}

/** Без просроченных и не больше RUN_MAX самых свежих. */
export function pruneRuns(runs: Record<string, LessonRun>, now: number): Record<string, LessonRun> {
  const alive = Object.values(runs)
    .filter((r) => now - r.updatedAt <= RUN_TTL_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RUN_MAX);
  if (alive.length === Object.keys(runs).length && alive.every((r) => runs[r.lessonId] === r)) return runs;
  return Object.fromEntries(alive.map((r) => [r.lessonId, r]));
}

/** Положить (заменить) сохранение урока и подрезать список. */
export function putRun(runs: Record<string, LessonRun>, run: LessonRun, now: number): Record<string, LessonRun> {
  return pruneRuns({ ...runs, [run.lessonId]: run }, now);
}

/** Убрать сохранение урока (урок пройден или начат заново). */
export function dropRun(runs: Record<string, LessonRun>, lessonId: string): Record<string, LessonRun> {
  if (!runs[lessonId]) return runs;
  const next = { ...runs };
  delete next[lessonId];
  return next;
}

// ---------- проверка данных из localStorage (недоверенные) ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
const str = (v: unknown, max = 2000): string | null => (typeof v === "string" ? v.slice(0, max) : null);

function cleanRecord(raw: unknown): AnswerRecord | null {
  if (!isObj(raw)) return null;
  const stepId = str(raw.stepId, 200);
  const score = num(raw.score, 0, 1);
  if (!stepId || typeof raw.correct !== "boolean" || score === null) return null;
  const rec: AnswerRecord = {
    stepId,
    correct: raw.correct,
    score,
    given: str(raw.given) ?? "",
    expected: str(raw.expected) ?? "",
    prompt: str(raw.prompt) ?? "",
    retry: raw.retry === true,
    timeMs: num(raw.timeMs) ?? 0,
  };
  const skill = str(raw.skill, 100);
  if (skill) rec.skill = skill;
  // Флаги честной точности (#66): ответ с подсказкой и пропуск.
  if (raw.hinted === true) rec.hinted = true;
  if (raw.skipped === true) rec.skipped = true;
  return rec;
}

function cleanRun(id: string, raw: unknown): LessonRun | null {
  if (!isObj(raw) || raw.lessonId !== id || typeof raw.sig !== "string" || !Array.isArray(raw.queue)) return null;
  const queue: RunQueueItem[] = [];
  for (const q of raw.queue.slice(0, 200)) {
    if (!isObj(q) || typeof q.id !== "string") return null;
    queue.push({ id: q.id.slice(0, 200), retry: q.retry === true });
  }
  const pos = num(raw.pos, 0, queue.length);
  const updatedAt = num(raw.updatedAt);
  const startedAt = num(raw.startedAt);
  if (pos === null || updatedAt === null || startedAt === null) return null;
  const records = Array.isArray(raw.records) ? raw.records.slice(0, MAX_RECORDS).map(cleanRecord) : [];
  if (records.some((r) => r === null)) return null;
  const paidAt = raw.paidAt === null || raw.paidAt === undefined ? null : num(raw.paidAt);
  return {
    lessonId: id,
    sig: raw.sig.slice(0, 64),
    queue,
    pos: Math.floor(pos),
    done: Math.floor(num(raw.done, 0, queue.length) ?? 0),
    records: records as AnswerRecord[],
    xp: Math.floor(num(raw.xp, 0, 100_000) ?? 0),
    combo: Math.floor(num(raw.combo, 0, 1000) ?? 0),
    maxCombo: Math.floor(num(raw.maxCombo, 0, 1000) ?? 0),
    skipped: Math.floor(num(raw.skipped, 0, 1000) ?? 0),
    activeMs: num(raw.activeMs, 0, DAY) ?? 0,
    xpFactor: num(raw.xpFactor, 0, 1) ?? 1,
    chipsEarned: Math.floor(num(raw.chipsEarned, 0, 100_000) ?? 0),
    cost: raw.cost === 2 ? 2 : 1,
    startedAt,
    updatedAt,
    paidAt,
  };
}

// ---------- «Продолжить» ведёт в начатый урок (этап 16Б, P5) ----------

export interface ResumeTarget {
  lessonId: string;
  /** Номер текущего шага (с 1). */
  step: number;
  /** Всего шагов в очереди. */
  total: number;
}

/**
 * Самый свежий действительный незаконченный урок или null. Содержимого урока на клиенте нет, поэтому проверяем то, что видно
 * из сохранения: не просрочено, что-то пройдено или вход оплачен, шаги ещё остались. `accept` — фильтр трека
 * (школьный урок — только в школьном треке, урок карты ЕНТ — только в ЕНТ); точную проверку отпечатка делает экран урока.
 */
export function resumeTarget(
  runs: Record<string, LessonRun>,
  now: number,
  accept?: (lessonId: string) => boolean,
  lessons?: Record<string, { firstAt?: number } | undefined>,
): ResumeTarget | null {
  let best: LessonRun | null = null;
  for (const run of Object.values(runs)) {
    if (now - run.updatedAt > RUN_TTL_MS) continue;
    if (run.queue.length === 0 || run.pos >= run.queue.length) continue;
    if (run.pos === 0 && run.paidAt === null) continue;
    if (accept && !accept(run.lessonId)) continue;
    // Урок засчитан уже после последнего шага (тестом раздела и т.п.) — продолжать нечего.
    const first = lessons?.[run.lessonId]?.firstAt;
    if (first !== undefined && first > run.updatedAt) continue;
    if (!best || run.updatedAt > best.updatedAt) best = run;
  }
  if (!best) return null;
  return { lessonId: best.lessonId, step: Math.min(best.pos + 1, best.queue.length), total: best.queue.length };
}

/** Сохранения незаконченных уроков из localStorage: только корректные записи, не больше RUN_MAX. */
export function sanitizeLessonRuns(raw: unknown, now = Date.now()): Record<string, LessonRun> {
  if (!isObj(raw)) return {};
  const out: Record<string, LessonRun> = {};
  for (const [id, v] of Object.entries(raw).slice(0, 50)) {
    if (!/^[\w-]{1,80}$/.test(id)) continue;
    const run = cleanRun(id, v);
    if (run) out[id] = run;
  }
  return pruneRuns(out, now);
}
