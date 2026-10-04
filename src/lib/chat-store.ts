import { del, get, set } from "idb-keyval";
import { MAX_MESSAGES, type ChatMsg, type QuizSummary } from "./chats";
import type { EntTopicId } from "./types";

// Сообщения чатов — в IndexedDB (localStorage мал для переписки). Ключ: informatica:chat:v1:msgs:<id>.
// Если IndexedDB недоступна (приватный режим, тесты) — держим в памяти до перезагрузки.
// Вызывать из обработчиков и асинхронно (не синхронно в эффектах).

const PREFIX = "informatica:chat:v1:msgs:";
const memory = new Map<string, ChatMsg[]>();

/** Предел длины одного сообщения при проверке данных (ответ ИИ — до ~4000 знаков, запас вдвое). */
export const MSG_CONTENT_MAX = 8000;
const QUIZ_TEXT_MAX = 600;
const QUIZ_MISTAKES_MAX = 20;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function sanitizeQuiz(raw: unknown): QuizSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const q = raw as Record<string, unknown>;
  if (!num(q.correct) || !num(q.total) || (q.grade !== 2 && q.grade !== 3 && q.grade !== 4 && q.grade !== 5)) return undefined;
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, QUIZ_TEXT_MAX) : "");
  const mistakes = (Array.isArray(q.mistakes) ? q.mistakes : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .slice(0, QUIZ_MISTAKES_MAX)
    .map((m) => ({ prompt: text(m.prompt), given: text(m.given), expected: text(m.expected) }));
  return {
    ...(typeof q.topic === "string" && /^t\d{2}$/.test(q.topic) ? { topic: q.topic as EntTopicId } : {}),
    correct: Math.max(0, Math.floor(q.correct)),
    total: Math.max(0, Math.floor(q.total)),
    grade: q.grade,
    mistakes,
  };
}

/** Сообщения из файла копии или хранилища — недоверенные: оставляем корректные, не больше MAX_MESSAGES (новые). */
export function sanitizeMessages(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMsg[] = [];
  for (const r of raw.slice(-MAX_MESSAGES)) {
    if (!r || typeof r !== "object") continue;
    const m = r as Record<string, unknown>;
    if (typeof m.id !== "string" || !m.id || m.id.length > 80 || (m.role !== "user" && m.role !== "assistant")) continue;
    const quiz = sanitizeQuiz(m.quiz);
    out.push({
      id: m.id,
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, MSG_CONTENT_MAX) : "",
      ...(m.hadImage === true ? { hadImage: true } : {}),
      ...(m.voice === true ? { voice: true } : {}),
      ...(quiz ? { quiz } : {}),
      at: num(m.at) ? m.at : 0,
    });
  }
  return out;
}

/**
 * Сообщения чата и признак сбоя чтения: failed — IndexedDB есть, но прочитать не вышло, а в памяти ничего нет
 * (значит, сообщения могли быть, но мы их не видим). Для экспорта: пустой чат при сбое — не то же, что пустой чат.
 */
export async function loadMessagesChecked(chatId: string): Promise<{ messages: ChatMsg[]; failed: boolean }> {
  const key = PREFIX + chatId;
  try {
    const v = await get<ChatMsg[]>(key);
    if (Array.isArray(v)) {
      memory.set(key, v);
      return { messages: v, failed: false };
    }
    return { messages: memory.get(key) ?? [], failed: false };
  } catch {
    // IndexedDB недоступна или не читается
    const mem = memory.get(key);
    return { messages: mem ?? [], failed: mem === undefined && typeof indexedDB !== "undefined" };
  }
}

export async function loadMessages(chatId: string): Promise<ChatMsg[]> {
  return (await loadMessagesChecked(chatId)).messages;
}

/** Сохраняет сообщения. true — записано в IndexedDB; false — осталось только в памяти (не переживёт перезагрузку). */
export async function saveMessages(chatId: string, messages: ChatMsg[]): Promise<boolean> {
  const key = PREFIX + chatId;
  const trimmed = messages.slice(-MAX_MESSAGES);
  memory.set(key, trimmed);
  try {
    await set(key, trimmed);
    return true;
  } catch {
    // остаётся в памяти
    return false;
  }
}

export async function deleteMessages(chatId: string): Promise<void> {
  const key = PREFIX + chatId;
  memory.delete(key);
  try {
    await del(key);
  } catch {
    // нечего удалять
  }
}
