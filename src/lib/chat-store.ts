import { del, get, set } from "idb-keyval";
import { MAX_MESSAGES, type ChatMsg } from "./chats";

// Сообщения чатов — в IndexedDB (localStorage мал для переписки). Ключ: informatica:chat:v1:msgs:<id>.
// Если IndexedDB недоступна (приватный режим, тесты) — держим в памяти до перезагрузки.
// Вызывать из обработчиков и асинхронно (не синхронно в эффектах).

const PREFIX = "informatica:chat:v1:msgs:";
const memory = new Map<string, ChatMsg[]>();

export async function loadMessages(chatId: string): Promise<ChatMsg[]> {
  const key = PREFIX + chatId;
  try {
    const v = await get<ChatMsg[]>(key);
    if (Array.isArray(v)) {
      memory.set(key, v);
      return v;
    }
  } catch {
    // IndexedDB недоступна или не читается — отдаём то, что в памяти
  }
  return memory.get(key) ?? [];
}

/** Сохраняет сообщения. Не записалось в IndexedDB — остаются в памяти (до перезагрузки). */
export async function saveMessages(chatId: string, messages: ChatMsg[]): Promise<void> {
  const key = PREFIX + chatId;
  const trimmed = messages.slice(-MAX_MESSAGES);
  memory.set(key, trimmed);
  try {
    await set(key, trimmed);
  } catch {
    // остаётся в памяти
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
