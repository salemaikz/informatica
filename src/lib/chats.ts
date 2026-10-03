import type { EntTopicId } from "./types";

// ИИ-чат 2.0: список чатов, режимы (решение #37). Чистая логика без React.
// Метаданные чатов — в сторе (AppState.chats), сами сообщения — в IndexedDB (lib/chat-store.ts).

/** Режим чата: свободный, «Объясни тему», «Дай задачи» (задания выдаёт код), «Проверь решение» (фото), «Готовимся к ЕНТ». */
export type ChatMode = "free" | "explain" | "tasks" | "check" | "ent";

export const CHAT_MODES: ChatMode[] = ["free", "explain", "tasks", "check", "ent"];

export interface ChatMeta {
  id: string;
  title: string;
  mode: ChatMode;
  /** Тема ЕНТ режима «Объясни тему» / «Дай задачи». */
  topic?: EntTopicId;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Начало последнего сообщения — для списка и поиска. */
  preview: string;
  /** Сколько сообщений. */
  count: number;
}

/** Итог «Дай задачи» в чате (карточка в ленте). */
export interface QuizSummary {
  topic?: EntTopicId;
  correct: number;
  total: number;
  /** Оценка по пятибалльной шкале (2–5). */
  grade: 2 | 3 | 4 | 5;
  /** Ошибки: условие, ответ ученика, верный ответ. */
  mistakes: { prompt: string; given: string; expected: string }[];
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Было ли приложено фото (само фото не храним). */
  hadImage?: boolean;
  /** Голосовой вопрос (расшифровка в content). */
  voice?: boolean;
  /** Карточка итога «Дай задачи». */
  quiz?: QuizSummary;
  at: number;
}

export const MAX_CHATS = 50;
export const MAX_MESSAGES = 120;
export const PREVIEW_LEN = 90;
export const TITLE_LEN = 60;

/** Закреплённые сверху, дальше — по последнему сообщению. */
export function sortChats(list: ChatMeta[]): ChatMeta[] {
  return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
}

/** Поиск по названию и последнему сообщению (без учёта регистра и «ё»). */
export function searchChats(list: ChatMeta[], query: string): ChatMeta[] {
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();
  const q = norm(query);
  if (!q) return list;
  return list.filter((c) => norm(c.title).includes(q) || norm(c.preview).includes(q));
}

/** Название чата по первому вопросу: первые слова без разметки, до TITLE_LEN символов. */
export function autoTitle(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= TITLE_LEN) return plain;
  const cut = plain.slice(0, TITLE_LEN);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 20 ? cut.slice(0, sp) : cut).trim()}…`;
}

export function previewOf(text: string): string {
  return autoTitle(text).slice(0, PREVIEW_LEN);
}

/** Оценка за «Дай задачи»: ≥ 90% — 5, ≥ 70% — 4, ≥ 50% — 3, иначе 2. */
export function quizGrade(correct: number, total: number): 2 | 3 | 4 | 5 {
  if (total <= 0) return 2;
  const r = correct / total;
  return r >= 0.9 ? 5 : r >= 0.7 ? 4 : r >= 0.5 ? 3 : 2;
}

export function sanitizeChats(raw: unknown): ChatMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMeta[] = [];
  for (const r of raw.slice(0, MAX_CHATS)) {
    if (!r || typeof r !== "object") continue;
    const c = r as Partial<ChatMeta>;
    if (typeof c.id !== "string" || !CHAT_MODES.includes(c.mode as ChatMode)) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    out.push({
      id: c.id,
      title: typeof c.title === "string" ? c.title.slice(0, TITLE_LEN + 1) : "",
      mode: c.mode as ChatMode,
      topic: typeof c.topic === "string" ? (c.topic as EntTopicId) : undefined,
      pinned: c.pinned ? true : undefined,
      createdAt: num(c.createdAt),
      updatedAt: num(c.updatedAt),
      preview: typeof c.preview === "string" ? c.preview.slice(0, PREVIEW_LEN) : "",
      count: Math.max(0, Math.floor(num(c.count))),
    });
  }
  return out;
}
