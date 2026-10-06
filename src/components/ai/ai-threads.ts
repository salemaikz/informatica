import { create } from "zustand";
import { hashString } from "@/lib/text";
import type { TutorTurn } from "./useTutor";

// Нити шторки ИИ (#119): переписка «подсказка / разбор / вопрос» по шагу хранится, пока ученик в уроке (тренировке,
// теме теории, задаче практикума), — закрыл шторку и открыл снова на том же шаге, вопросы и ответы на месте; ответ,
// пришедший после закрытия, тоже сохраняется. Только в памяти (без localStorage): в «Все чаты» вопросы урока не пишем —
// там нет защиты от выдачи ответа к заданию. Тест — tests/ai-threads.test.ts.
//
// Запрос пишет в нить сразу (startThread: вопрос + `pending`), по ходу ответа (streamThread) и в конце (finishThread).
// Шторку закрыли и открыли снова, пока ответ идёт, — новая шторка видит `pending` и ответ по мере прихода, второй раз
// вопрос не уходит (не списывается). Каждый запуск получает свой `rev`: запись чужого (устаревшего) запуска не
// затирает более новую переписку, а нить, очищенная «Начать заново», не воскресает от позднего ответа.

/** Сколько последних реплик держим в одной нити (сервер всё равно берёт хвост истории). */
export const THREAD_MAX_TURNS = 40;

/**
 * Сколько ждём ответ, прежде чем снять `pending` (запрос завис): шторка снова даёт спросить, вопрос без ответа —
 * «Ответ не пришёл» и «Повторить». Поздний ответ этого же запуска всё равно сохранится, если нового запроса не было.
 */
export const THREAD_PENDING_MAX_MS = 120_000;

/** Ключ нити: `${scope}:${stepKey}:${mode}`; scope — id урока, `drill:<ключ>`, `theory:<id>`, `ide:<задача>`. */
export function threadKey(scope: string, stepKey: string, mode: string): string {
  return `${scope}:${stepKey}:${mode}`;
}

/**
 * Шаг нити ИИ практикума: «Спросить Бита» — одна нить на задачу; «Объясни ошибку» — своя нить на каждую ошибку
 * (короткий хэш её текста): исправили код и получили другую ошибку — объяснение прошлой не выдаётся за новое.
 */
export function ideThreadStep(taskKey: string, mode: "ask" | "explain", error: string | null | undefined): string {
  return mode === "explain" ? `${taskKey}:e${hashString(error ?? "").toString(36)}` : taskKey;
}

export interface AiThread {
  turns: TutorTurn[];
  /** Ответ ещё идёт (возможно, в уже закрытой шторке). */
  pending: boolean;
  /** Номер запуска, который последним писал в нить. */
  rev: number;
}

interface ThreadsState {
  threads: Record<string, AiThread>;
}

export const useAiThreads = create<ThreadsState>(() => ({ threads: {} }));

// Сквозной счётчик запусков: ключ, удалённый и созданный заново, не получит старый номер.
let lastRev = 0;

/** Нить по ключу (нет — undefined). */
export function getThread(key: string): AiThread | undefined {
  return useAiThreads.getState().threads[key];
}

/** Чистит реплики: без пустых заготовок ответа («Загрузка…»), не длиннее THREAD_MAX_TURNS. */
export function cleanTurns(turns: readonly TutorTurn[]): TutorTurn[] {
  return turns
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .slice(-THREAD_MAX_TURNS);
}

function put(key: string, thread: AiThread | null): void {
  useAiThreads.setState((s) => {
    const threads = { ...s.threads };
    if (thread) threads[key] = thread;
    else delete threads[key];
    return { threads };
  });
}

/** Сохраняет нить целиком, без запроса в пути (пустая — удаляет ключ). */
export function saveThread(key: string, turns: readonly TutorTurn[]): void {
  const clean = cleanTurns(turns);
  put(key, clean.length > 0 ? { turns: clean, pending: false, rev: ++lastRev } : null);
}

/** Запрос ушёл: нить — история с вопросом, ответ в пути. Возвращает номер запуска для streamThread / finishThread. */
export function startThread(key: string, history: readonly TutorTurn[]): number {
  const rev = ++lastRev;
  put(key, { turns: cleanTurns(history), pending: true, rev });
  // Запрос завис — не держим шторку без возможности спросить вечно.
  setTimeout(() => {
    const cur = getThread(key);
    if (cur && cur.rev === rev && cur.pending) put(key, cur.turns.length > 0 ? { ...cur, pending: false } : null);
  }, THREAD_PENDING_MAX_MS);
  return rev;
}

/** Кусок ответа по ходу потока (только для своего запуска). */
export function streamThread(key: string, rev: number, turns: readonly TutorTurn[]): void {
  const cur = getThread(key);
  if (!cur || cur.rev !== rev) return;
  put(key, { ...cur, turns: cleanTurns(turns) });
}

/**
 * Запрос завершён: итоговая нить (с ответом или с вопросом без ответа). Пишет, только если нить всё ещё принадлежит этому
 * запуску; false — запись отброшена (был более новый запрос или нить очищена).
 */
export function finishThread(key: string, rev: number, turns: readonly TutorTurn[]): boolean {
  const cur = getThread(key);
  if (!cur || cur.rev !== rev) return false;
  const clean = cleanTurns(turns);
  put(key, clean.length > 0 ? { turns: clean, pending: false, rev } : null);
  return true;
}

/** Забывает одну нить (шторка без ключа нити — при закрытии). */
export function dropThread(key: string): void {
  if (getThread(key)) put(key, null);
}

/** Забывает все нити области (итоги урока, «Начать заново», новый заход в тему или задачу). */
export function clearThreads(scope: string): void {
  const prefix = `${scope}:`;
  const cur = useAiThreads.getState().threads;
  if (!Object.keys(cur).some((k) => k.startsWith(prefix))) return;
  useAiThreads.setState({ threads: Object.fromEntries(Object.entries(cur).filter(([k]) => !k.startsWith(prefix))) });
}
