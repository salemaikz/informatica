// Чаты с ИИ-наставником (чат 2.0): несколько чатов, закрепление, поиск, задания «Дай задачи» в ленте.
// Отдельное хранилище (localStorage, ключ informatica-chats) — не раздувает основной прогресс useApp.
// Всё, что читаем из хранилища и импорта, — недоверенное: sanitize* оставляют только корректное.

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { ENT_TOPICS } from "@/content/ent-topics";
import type { ChatQuiz, QuizAnswer } from "./chat-quiz";
import type { ChatMessage as LegacyChatMessage } from "./store";
import type { EntTopicId, Level } from "./types";
import { plainText } from "./text";

export const MAX_CHATS = 50;
export const MAX_MESSAGES = 200;
export const MAX_TITLE = 60;
/** Сообщение длиннее не храним целиком (ответы ИИ короче). */
const MAX_CONTENT = 20_000;
/**
 * Бюджет размера всех чатов в символах JSON. localStorage общий с прогрессом (около 5 млн символов):
 * чаты не должны вытеснить useApp, иначе запись прогресса упадёт с QuotaExceededError.
 */
export const MAX_STORE_CHARS = 1_000_000;

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Было ли приложено фото (само фото не храним). */
  hadImage?: boolean;
  at: number;
  /** «Дай задачи»: набор заданий в ленте (content пустой). */
  quiz?: ChatQuiz;
}

export interface Chat {
  id: string;
  /** Пустая строка — «Новый чат» (заголовок появится из первого сообщения). */
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

export interface ChatsState {
  chats: Chat[];
  activeId: string | null;
}

export interface ChatsActions {
  /** Новый чат (пустой активный переиспользуется). Возвращает id. */
  newChat: () => string;
  setActive: (id: string) => void;
  rename: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  remove: (id: string) => void;
  /**
   * Добавить сообщение в чат (по умолчанию — в активный; нет такого — создаётся и становится активным).
   * titleHint — заголовок пустого чата, если первое сообщение не от ученика (например, набор заданий).
   */
  addMessage: (msg: Omit<ChatMsg, "id" | "at">, opts?: { chatId?: string; titleHint?: string }) => { chatId: string; msgId: string };
  /** Ответ на задание набора «Дай задачи». */
  answerQuiz: (chatId: string, msgId: string, quiz: ChatQuiz) => void;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Чистая часть ----------

/** Заголовок из первого сообщения ученика: первая строка, до MAX_TITLE символов по границе слова. */
export function titleFromText(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= MAX_TITLE) return line;
  const cut = line.slice(0, MAX_TITLE - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX_TITLE / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Порядок списка: закреплённые сверху, внутри — по последнему изменению. */
export function sortChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

const norm = (s: string) => s.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
/** Текст сообщения без Markdown (заголовки, списки, **жирный**, `код`) — для поиска и отрывка. */
const plain = (md: string) => plainText(md.replace(/^\s*(?:#{1,6}|[-*+]|\d+\.)\s+/gm, "")).replace(/\s+/g, " ").trim();

/** Поиск по названиям и тексту сообщений (без регистра). Пустой запрос — все чаты. */
export function searchChats(chats: Chat[], query: string): Chat[] {
  const q = norm(query);
  if (!q) return sortChats(chats);
  return sortChats(chats.filter((c) => norm(c.title).includes(q) || c.messages.some((m) => norm(plain(m.content)).includes(q))));
}

/** Кусок текста сообщения вокруг совпадения (для списка результатов поиска); null — совпало только название. */
export function matchSnippet(chat: Chat, query: string, radius = 30): string | null {
  const q = norm(query);
  if (!q || norm(chat.title).includes(q)) return null;
  for (const m of chat.messages) {
    const text = plain(m.content);
    const i = norm(text).indexOf(q);
    if (i < 0) continue;
    const from = Math.max(0, i - radius);
    const to = Math.min(text.length, i + q.length + radius);
    return `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
  }
  return null;
}

/** Лимит чатов: лишние — самые старые незакреплённые (а если все закреплены — самые старые). */
export function capChats(chats: Chat[], keepId?: string | null): Chat[] {
  if (chats.length <= MAX_CHATS) return chats;
  const drop = new Set<string>();
  const order = [...chats].filter((c) => c.id !== keepId).sort((a, b) => Number(a.pinned) - Number(b.pinned) || a.updatedAt - b.updatedAt);
  for (const c of order) {
    if (chats.length - drop.size <= MAX_CHATS) break;
    drop.add(c.id);
  }
  return chats.filter((c) => !drop.has(c.id));
}

/**
 * Лимит общего размера: сначала удаляем самые старые незакреплённые чаты (кроме keepId),
 * потом закреплённые, в последнюю очередь — старые сообщения оставшегося чата.
 */
export function capSize(chats: Chat[], keepId?: string | null, budget = MAX_STORE_CHARS): Chat[] {
  const size = (c: Chat) => JSON.stringify(c).length + 1;
  let total = chats.reduce((n, c) => n + size(c), 2);
  if (total <= budget) return chats;
  const drop = new Set<string>();
  const order = chats.filter((c) => c.id !== keepId).sort((a, b) => Number(a.pinned) - Number(b.pinned) || a.updatedAt - b.updatedAt);
  for (const c of order) {
    if (total <= budget) break;
    drop.add(c.id);
    total -= size(c);
  }
  return chats
    .filter((c) => !drop.has(c.id))
    .map((c) => {
      if (total <= budget || c.messages.length <= 1) return c;
      const messages = [...c.messages];
      while (messages.length > 1 && total > budget) total -= JSON.stringify(messages.shift()).length + 1;
      return { ...c, messages };
    });
}

const emptyChat = (now: number): Chat => ({ id: uid(), title: "", pinned: false, createdAt: now, updatedAt: now, messages: [] });

/** Добавить сообщение: обрезка истории до MAX_MESSAGES, заголовок из первого сообщения ученика. */
export function appendMessage(chat: Chat, msg: ChatMsg, titleHint?: string): Chat {
  const messages = [...chat.messages, msg].slice(-MAX_MESSAGES);
  let title = chat.title;
  if (!title && msg.role === "user" && msg.content.trim()) title = titleFromText(msg.content);
  else if (!title && titleHint) title = titleFromText(titleHint);
  return { ...chat, title, messages, updatedAt: msg.at };
}

/** Сколько последних сообщений уходит ИИ (сервер всё равно берёт не больше 12). */
export const AI_HISTORY = 12;

/**
 * История для ИИ: обычные сообщения как есть, набор заданий — короткой сводкой от лица помощника
 * (задания целиком не уходят). Пустые сообщения отбрасываются.
 */
export function historyForAi(messages: ChatMsg[], describeQuiz: (quiz: ChatQuiz) => string, limit = AI_HISTORY): { role: "user" | "assistant"; content: string }[] {
  return messages
    .map((m) => (m.quiz ? { role: "assistant" as const, content: describeQuiz(m.quiz) } : { role: m.role, content: m.content }))
    .filter((m) => m.content.trim() !== "")
    .slice(-limit);
}

// ---------- Проверка данных (хранилище, импорт) ----------

const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown, max: number): string => (typeof x === "string" ? x.slice(0, max) : "");
const isIdx = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64;
const TOPIC_IDS = new Set<string>(ENT_TOPICS.map((t) => t.id));

function sanitizeQuizAnswer(raw: unknown): QuizAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.type === "choice" && isIdx(a.index)) return { type: "choice", index: a.index };
  if (a.type === "multi" && Array.isArray(a.indices)) {
    const indices = [...new Set(a.indices.filter(isIdx))];
    return indices.length ? { type: "multi", indices } : null;
  }
  if (a.type === "input" && typeof a.value === "string") return { type: "input", value: a.value.slice(0, 100) };
  return null;
}

export function sanitizeQuiz(raw: unknown): ChatQuiz | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = raw as Record<string, unknown>;
  const src = q.source as Record<string, unknown> | undefined;
  const source =
    src?.kind === "lessons"
      ? ({ kind: "lessons" } as const)
      : src?.kind === "topic" && typeof src.topic === "string" && TOPIC_IDS.has(src.topic)
        ? ({ kind: "topic", topic: src.topic as EntTopicId } as const)
        : null;
  if (!source || !(q.level === 1 || q.level === 2 || q.level === 3) || !fin(q.seed)) return undefined;
  if (!Array.isArray(q.skills) || !Array.isArray(q.ids) || !Array.isArray(q.answers)) return undefined;
  const skills = q.skills.filter((s): s is string => typeof s === "string").slice(0, 40);
  const ids = q.ids.filter((s): s is string => typeof s === "string").slice(0, 10);
  if (!skills.length || !ids.length) return undefined;
  const rawAnswers = q.answers as unknown[];
  const answers = ids.map((_, i) => sanitizeQuizAnswer(rawAnswers[i]));
  return { source, level: q.level as Level, seed: q.seed, skills, ids, answers };
}

function sanitizeMessage(raw: unknown): ChatMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.role !== "user" && m.role !== "assistant") return null;
  const quiz = sanitizeQuiz(m.quiz);
  const content = str(m.content, MAX_CONTENT);
  if (!content && !quiz) return null;
  const out: ChatMsg = { id: str(m.id, 40) || uid(), role: m.role, content, at: fin(m.at) ? m.at : Date.now() };
  if (m.hadImage === true) out.hadImage = true;
  if (quiz) out.quiz = quiz;
  return out;
}

function sanitizeChat(raw: unknown): Chat | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const messages = (Array.isArray(c.messages) ? c.messages : []).map(sanitizeMessage).filter((m): m is ChatMsg => !!m).slice(-MAX_MESSAGES);
  // id сообщений уникальны внутри чата (по ним записываются ответы на задания).
  const ids = new Set<string>();
  for (const m of messages) {
    if (ids.has(m.id)) m.id = uid();
    ids.add(m.id);
  }
  const now = Date.now();
  const createdAt = fin(c.createdAt) ? c.createdAt : (messages[0]?.at ?? now);
  return {
    id: str(c.id, 40) || uid(),
    title: str(c.title, MAX_TITLE * 2).trim(),
    pinned: c.pinned === true,
    createdAt,
    updatedAt: fin(c.updatedAt) ? c.updatedAt : (messages.at(-1)?.at ?? createdAt),
    messages,
  };
}

/** Список чатов из недоверенных данных: проверка полей, уникальные id, лимиты. */
export function sanitizeChats(raw: unknown): Chat[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Chat[] = [];
  for (const r of raw.slice(0, MAX_CHATS * 2)) {
    const c = sanitizeChat(r);
    if (!c) continue;
    if (seen.has(c.id)) c.id = uid();
    seen.add(c.id);
    out.push(c);
  }
  return capSize(capChats(out));
}

/** Чат из старого единственного чата useApp (перенос при первом запуске). */
export function chatFromLegacy(legacy: LegacyChatMessage[]): Chat | null {
  const messages = legacy.map(sanitizeMessage).filter((m): m is ChatMsg => !!m).slice(-MAX_MESSAGES);
  if (!messages.length) return null;
  const firstUser = messages.find((m) => m.role === "user");
  return {
    id: uid(),
    title: firstUser ? titleFromText(firstUser.content) : "",
    pinned: false,
    createdAt: messages[0].at,
    updatedAt: messages.at(-1)!.at,
    messages,
  };
}

// ---------- Хранилище ----------

/** localStorage без исключений при записи: переполнение квоты не должно ронять отправку сообщения. */
function safeLocalStorage(): StateStorage {
  const ls = window.localStorage;
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => {
      try {
        ls.setItem(k, v);
      } catch {
        // квота переполнена — чаты останутся в памяти до перезагрузки
      }
    },
    removeItem: (k) => ls.removeItem(k),
  };
}

const initial: ChatsState = { chats: [], activeId: null };

export const useChats = create<ChatsState & ChatsActions>()(
  persist(
    (set, get) => ({
      ...initial,

      newChat: () => {
        const s = get();
        const active = s.chats.find((c) => c.id === s.activeId);
        if (active && active.messages.length === 0) return active.id;
        // Пустые черновики не копим: при создании нового убираем прочие пустые незакреплённые.
        const chat = emptyChat(Date.now());
        set({ chats: capChats([chat, ...s.chats.filter((c) => c.messages.length > 0 || c.pinned)], chat.id), activeId: chat.id });
        return chat.id;
      },

      setActive: (id) => {
        if (get().chats.some((c) => c.id === id)) set({ activeId: id });
      },

      rename: (id, title) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, title: titleFromText(title) } : c)) })),

      togglePin: (id) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),

      remove: (id) =>
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          const activeId = s.activeId === id ? (sortChats(chats)[0]?.id ?? null) : s.activeId;
          return { chats, activeId };
        }),

      addMessage: (msg, opts) => {
        const now = Date.now();
        const full: ChatMsg = { ...msg, content: msg.content.slice(0, MAX_CONTENT), id: uid(), at: now };
        const s = get();
        let target = s.chats.find((c) => c.id === (opts?.chatId ?? s.activeId));
        let chats = s.chats;
        let activeId = s.activeId;
        if (!target) {
          target = emptyChat(now);
          chats = [target, ...chats];
          activeId = target.id;
        }
        const next = appendMessage(target, full, opts?.titleHint);
        set({ chats: capSize(capChats(chats.map((c) => (c.id === next.id ? next : c)), next.id), next.id), activeId });
        return { chatId: next.id, msgId: full.id };
      },

      answerQuiz: (chatId, msgId, quiz) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? { ...m, quiz } : m)) } : c,
          ),
        })),
    }),
    {
      name: "informatica-chats",
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      partialize: (s): ChatsState => ({ chats: s.chats, activeId: s.activeId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatsState>;
        const chats = sanitizeChats(p.chats);
        const activeId = typeof p.activeId === "string" && chats.some((c) => c.id === p.activeId) ? p.activeId : (sortChats(chats)[0]?.id ?? null);
        return { ...current, chats, activeId };
      },
    },
  ),
);

/**
 * Перенос старого единственного чата из useApp: если чатов ещё нет, а старый чат есть —
 * создаём из него чат и очищаем старый. Возвращает true, если перенос был.
 */
export function migrateLegacyChat(legacy: LegacyChatMessage[], clearLegacy: () => void): boolean {
  if (!legacy.length) return false;
  if (useChats.getState().chats.length > 0) {
    // Чаты уже есть — старый чат не нужен (перенос был раньше в другой вкладке).
    return false;
  }
  const chat = chatFromLegacy(legacy);
  if (!chat) return false;
  useChats.setState({ chats: [chat], activeId: chat.id });
  clearLegacy();
  return true;
}

// ---------- Резервная копия (подключает главная модель) ----------

export interface ChatsExport {
  version: 1;
  chats: Chat[];
}

export function exportChats(): ChatsExport {
  return { version: 1, chats: useChats.getState().chats };
}

/** Импорт из резервной копии: заменяет чаты. false — данные не похожи на экспорт чатов. */
export function importChats(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const data = raw as Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : data.chats;
  if (!Array.isArray(list)) return false;
  const chats = sanitizeChats(list);
  useChats.setState({ chats, activeId: sortChats(chats)[0]?.id ?? null });
  return true;
}
