import { create } from "zustand";
import type { TutorTurn } from "./useTutor";

// Нити шторки ИИ (#119): переписка «подсказка / разбор / вопрос» по шагу хранится, пока ученик в уроке (тренировке,
// теме теории, задаче практикума), — закрыл шторку и открыл снова на том же шаге, вопросы и ответы на месте; ответ,
// пришедший после закрытия, тоже сохраняется. Только в памяти (без localStorage): в «Все чаты» вопросы урока не пишем —
// там нет защиты от выдачи ответа к заданию. Тест — tests/ai-threads.test.ts.

/** Сколько последних реплик держим в одной нити (сервер всё равно берёт хвост истории). */
export const THREAD_MAX_TURNS = 40;

/** Ключ нити: `${scope}:${stepKey}:${mode}`; scope — id урока, `drill:<ключ>`, `theory:<id>`, `ide:<задача>`. */
export function threadKey(scope: string, stepKey: string, mode: string): string {
  return `${scope}:${stepKey}:${mode}`;
}

interface ThreadsState {
  threads: Record<string, TutorTurn[]>;
}

export const useAiThreads = create<ThreadsState>(() => ({ threads: {} }));

/** Нить по ключу (пустая — undefined). */
export function getThread(key: string): TutorTurn[] | undefined {
  return useAiThreads.getState().threads[key];
}

/** Чистит реплики: без пустых заготовок ответа («Загрузка…»), не длиннее THREAD_MAX_TURNS. */
export function cleanTurns(turns: readonly TutorTurn[]): TutorTurn[] {
  return turns
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .slice(-THREAD_MAX_TURNS);
}

/** Сохраняет нить после завершённого ответа (в том числе когда шторку уже закрыли). Пустая — удаляет ключ. */
export function saveThread(key: string, turns: readonly TutorTurn[]): void {
  const clean = cleanTurns(turns);
  useAiThreads.setState((s) => {
    const threads = { ...s.threads };
    if (clean.length > 0) threads[key] = clean;
    else delete threads[key];
    return { threads };
  });
}

/** Забывает все нити области (итоги урока, «Начать заново», новый заход в тему или задачу). */
export function clearThreads(scope: string): void {
  const prefix = `${scope}:`;
  const cur = useAiThreads.getState().threads;
  if (!Object.keys(cur).some((k) => k.startsWith(prefix))) return;
  useAiThreads.setState({ threads: Object.fromEntries(Object.entries(cur).filter(([k]) => !k.startsWith(prefix))) });
}
