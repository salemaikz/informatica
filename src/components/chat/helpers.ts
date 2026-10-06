import type { ChatMessage } from "@/lib/store";
import { MAX_MESSAGES, previewOf, type ChatMsg, type ChatMode, type QuizSummary } from "@/lib/chats";
import { shortDate } from "@/lib/date";
import type { EntTopicId, Lang } from "@/lib/types";
import { entTopicById } from "@/content/ent-topics";
import type { DictKey } from "@/i18n/dict";

// Чистые помощники экрана чатов (без React) — покрыты tests/chats.test.ts.

/** Функция перевода (как t из useT) — передаём снаружи, чтобы файл оставался чистым. */
export type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

/** Сколько последних сообщений уходит в ИИ (сервер обрезает так же). */
export const HISTORY_LIMIT = 12;
/** Сколько ошибок из «Дай задачи» пересказываем ИИ. */
export const MAX_MISTAKES_TO_AI = 5;
const FIELD_LEN = 200;

export const clip = (s: string, n = FIELD_LEN) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Режимы, которым нужна тема, и режимы, где тема необязательна. */
export const TOPIC_REQUIRED: ChatMode[] = ["explain"];
export const TOPIC_OPTIONAL: ChatMode[] = ["tasks"];
export const needsTopicStep = (mode: ChatMode) => TOPIC_REQUIRED.includes(mode) || TOPIC_OPTIONAL.includes(mode);

/** Название темы ЕНТ на языке ученика ("" — если темы нет). */
export function topicTitle(topic: EntTopicId | undefined, lang: Lang, short = false): string {
  if (!topic) return "";
  try {
    const x = entTopicById(topic);
    return (short ? x.short : x.title)[lang];
  } catch {
    return "";
  }
}

/** Итог «Дай задачи» одной строкой — для превью списка. */
export function quizPreviewText(q: QuizSummary, tr: Tr): string {
  return tr("chat2.quiz.preview", { correct: q.correct, total: q.total, grade: q.grade });
}

/** Итог «Дай задачи» как текст для ИИ (карточку модель не видит). */
export function describeQuiz(q: QuizSummary, lang: Lang, tr: Tr): string {
  const topic = topicTitle(q.topic, lang);
  const head = topic
    ? tr("chat2.quiz.aiResultTopic", { topic, correct: q.correct, total: q.total, grade: q.grade })
    : tr("chat2.quiz.aiResult", { correct: q.correct, total: q.total, grade: q.grade });
  const lines = q.mistakes.slice(0, MAX_MISTAKES_TO_AI).map((m, i) =>
    tr("chat2.quiz.aiLine", { n: i + 1, prompt: clip(m.prompt), given: clip(m.given), expected: clip(m.expected) }),
  );
  return [head, ...lines].join("\n");
}

/**
 * Сообщение «Разобрать ошибки с Битом»: просьба + список ошибок.
 * withList=false — карточка итога ещё в истории для ИИ (describeQuiz), ошибки повторять не надо.
 */
export function reviewRequest(q: QuizSummary, tr: Tr, withList = true): string {
  if (!withList) return tr("chat2.quiz.reviewAskShort");
  const lines = q.mistakes.slice(0, MAX_MISTAKES_TO_AI).map((m, i) =>
    tr("chat2.quiz.aiLine", { n: i + 1, prompt: clip(m.prompt), given: clip(m.given), expected: clip(m.expected) }),
  );
  return [tr("chat2.quiz.reviewAsk"), ...lines].join("\n");
}

/** Карточка итога попадёт в историю для ИИ, если среди последних HISTORY_LIMIT - 1 сообщений (место под новое). */
export function quizInHistory(msgs: ChatMsg[], quizId: string): boolean {
  return msgs.slice(-(HISTORY_LIMIT - 1)).some((m) => m.id === quizId);
}

/** История для ИИ: последние HISTORY_LIMIT сообщений; карточка итога — текстом (от лица ученика). */
export function toHistory(msgs: ChatMsg[], lang: Lang, tr: Tr): { role: "user" | "assistant"; content: string }[] {
  return msgs.slice(-HISTORY_LIMIT).map((m) =>
    m.quiz ? { role: "user" as const, content: describeQuiz(m.quiz, lang, tr) } : { role: m.role, content: m.content },
  );
}

/** Первый вопрос ученика — из него делаем название чата. */
export function firstUserText(msgs: ChatMsg[]): string {
  return msgs.find((m) => m.role === "user" && !m.quiz)?.content ?? "";
}

/** Превью последнего сообщения для списка. */
export function lastPreview(msgs: ChatMsg[], tr: Tr): string {
  const last = msgs[msgs.length - 1];
  if (!last) return "";
  return last.quiz ? quizPreviewText(last.quiz, tr) : previewOf(last.content);
}

/** Добавляет сообщение и обрезает ленту до MAX_MESSAGES. */
export function appendMessage(msgs: ChatMsg[], msg: ChatMsg): ChatMsg[] {
  return [...msgs, msg].slice(-MAX_MESSAGES);
}

/** Перенос старого одиночного чата в сообщения нового формата. */
export function legacyToMsgs(old: ChatMessage[]): ChatMsg[] {
  return old
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ id: m.id, role: m.role, content: m.content, hadImage: m.hadImage || undefined, at: m.at }));
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Время в списке: сегодня — «14:05», иначе — «2 окт.». now = 0 (часы ещё не готовы) — пусто. */
export function formatChatTime(at: number, now: number, lang: Lang): string {
  if (!Number.isFinite(at) || at <= 0 || !(now > 0)) return "";
  const d = new Date(at);
  if (sameDay(d, new Date(now))) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return shortDate(d, lang);
}

/** Ключ названия режима в словаре. */
export const MODE_NAME_KEY: Record<ChatMode, DictKey> = {
  free: "chat2.mode.free",
  explain: "chat2.mode.explain",
  tasks: "chat2.mode.tasks",
  check: "chat2.mode.check",
  ent: "chat2.mode.ent",
};

/** Ключ описания режима («что умеет»). */
export const MODE_DESC_KEY: Record<ChatMode, DictKey> = {
  free: "chat2.modeDesc.free",
  explain: "chat2.modeDesc.explain",
  tasks: "chat2.modeDesc.tasks",
  check: "chat2.modeDesc.check",
  ent: "chat2.modeDesc.ent",
};

/** Название чата для показа: своё, иначе — название режима (и тема). */
export function displayTitle(c: { title: string; mode: ChatMode; topic?: EntTopicId }, lang: Lang, tr: Tr): string {
  if (c.title.trim()) return c.title.trim();
  const mode = tr(MODE_NAME_KEY[c.mode]);
  const topic = topicTitle(c.topic, lang, true);
  return topic ? `${mode}: ${topic}` : mode;
}

/**
 * Шапка чата: заголовок и подзаголовок без повтора одного слова («Еркін / Еркін»). Свой заголовок — как есть, под ним режим (и тема);
 * чат без названия и без сообщений — «Новый чат», под ним режим; без названия, но с сообщениями — тема (или режим) без подзаголовка-дубля.
 * Чат по теме урока в подзаголовке называет «По теме урока».
 */
export function chatHeader(
  c: { title: string; mode: ChatMode; topic?: EntTopicId; lessonId?: string; count?: number },
  lang: Lang,
  tr: Tr,
): { title: string; subtitle: string } {
  const own = c.title.trim();
  const modeName = c.lessonId ? tr("theory16c.chat.badge") : tr(MODE_NAME_KEY[c.mode]);
  const topic = topicTitle(c.topic, lang, true);
  const full = topic ? `${modeName} · ${topic}` : modeName;
  let title: string;
  let subtitle = full;
  if (own) title = own;
  else if ((c.count ?? 0) === 0) title = tr("chat2.new");
  else {
    title = topic || modeName;
    subtitle = topic ? modeName : "";
  }
  // Название совпало с подписью (чат переименовали в «Свободный») — второй раз не повторяем.
  if (subtitle.trim().toLowerCase() === title.trim().toLowerCase()) subtitle = "";
  return { title, subtitle };
}
