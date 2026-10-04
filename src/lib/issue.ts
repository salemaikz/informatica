// «Сообщить об ошибке»: что именно ученик считает ошибкой (задание или ответ ИИ) и где это было.
// Тип общий для кнопки (components/issue), маршрута /api/issue и мест, где кнопка стоит.
// Здесь же — чистая проверка и обрезка тела запроса (без React и без сервера: покрыта tests/issue.test.ts).

import type { Lang } from "@/lib/types";

export type IssueKind = "task" | "ai";

export type IssueWhere = "lesson" | "drill" | "exam" | "chat" | "panel";

export interface IssueTarget {
  kind: IssueKind;
  where: IssueWhere;
  /** id задания или шага (для ответа ИИ — id задания, к которому был ответ, если есть). */
  itemId?: string;
  lessonId?: string;
  /** Короткий текст для разбора: условие задания или ответ ИИ (на сервере обрезается). */
  snippet?: string;
}

// ---------- Причины ----------

/** Допустимые причины жалобы: у задания и у ответа ИИ они разные. */
export const ISSUE_REASONS = {
  task: ["wrong_answer", "unclear", "typo", "other"],
  ai: ["wrong", "unclear", "gave_solution", "other"],
} as const satisfies Record<IssueKind, readonly string[]>;

export type IssueReason = (typeof ISSUE_REASONS)[IssueKind][number];

const WHERES: readonly IssueWhere[] = ["lesson", "drill", "exam", "chat", "panel"];

/** Максимальная длина полей (символов). Всё, что длиннее, обрезается. */
export const ISSUE_LIMITS = {
  comment: 500,
  snippet: 600,
  id: 80,
  path: 200,
  message: 500,
  stack: 1500,
  userAgent: 160,
  /** Тело запроса целиком, в байтах: больше — отказ (413), читаем потоком и обрываем на этой отметке. */
  body: 8000,
} as const;

/** Два потока: жалобы учеников и ошибки с телефонов — у каждого свой лимит и свой список в хранилище. */
export type IssueChannel = "issue" | "client_error";

export const ISSUE_CHANNELS: Record<IssueChannel, { limit: number; windowMs: number; list: string; max: number }> = {
  issue: { limit: 20, windowMs: 10 * 60_000, list: "issues", max: 5000 },
  client_error: { limit: 30, windowMs: 10 * 60_000, list: "client-errors", max: 2000 },
};

/** Общий лимит запросов к /api/issue с одного IP: проверяется до чтения тела, считает любые запросы (в том числе мусор). */
export const ISSUE_ANY_LIMIT = { limit: 60, windowMs: 10 * 60_000 } as const;

/** Потолок на весь сайт в сутки (по Астане) — отдельно для жалоб и для ошибок клиента; сверх — 429 без записи. */
export const ISSUE_DAY_MAX = 3000;

// ---------- Тело запроса ----------

export interface IssueBody {
  type: IssueKind;
  where: IssueWhere;
  reason: string;
  comment?: string;
  itemId?: string;
  lessonId?: string;
  snippet?: string;
  lang?: Lang;
}

export interface ClientErrorBody {
  type: "client_error";
  message: string;
  stack?: string;
  path?: string;
  lang?: Lang;
}

export type IssueRequest = IssueBody | ClientErrorBody;

/** Запись, которая сохраняется: без IP, имени и id устройства. */
export interface IssueRecord {
  type: IssueKind;
  where: IssueWhere;
  reason: string;
  comment?: string;
  itemId?: string;
  lessonId?: string;
  snippet?: string;
  lang: Lang | null;
  version: string;
  at: string;
}

export interface ClientErrorRecord {
  type: "client_error";
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  lang: Lang | null;
  version: string;
  at: string;
}

export type StoredIssue = IssueRecord | ClientErrorRecord;

export type IssueRejection = "bad_body" | "bad_type" | "bad_reason" | "bad_where" | "bad_message";

export type ParsedIssue = { ok: true; channel: IssueChannel; record: StoredIssue } | { ok: false; code: IssueRejection };

// Управляющие символы (кроме перевода строки и табуляции), C1 (U+0080–U+009F, в том числе NEL), разделители строк,
// невидимые знаки нулевой ширины и метки направления письма (bidi): ими можно подделать вид строки в списке жалоб.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g;
const ID_BAD = /[^A-Za-z0-9_:#.\-/]/g;

/** Строка не длиннее max: управляющие символы убраны, края обрезаны, пара-суррогат не разорвана. Не строка — пустая. */
export function clip(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  let s = v.slice(0, max + 64).replace(CONTROL, "").trim();
  if (s.length > max) s = s.slice(0, max);
  if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1);
  return s.trim();
}

/** id задания или урока: только безопасные символы, не длиннее ISSUE_LIMITS.id. */
export function clipId(v: unknown): string {
  return typeof v === "string" ? v.slice(0, ISSUE_LIMITS.id * 2).replace(ID_BAD, "").slice(0, ISSUE_LIMITS.id) : "";
}

const asLang = (v: unknown): Lang | null => (v === "ru" || v === "kk" ? v : null);

/** Путь без параметров и якоря: в адресе бывают id записей и seed — их не храним. */
export function cleanPath(v: unknown): string {
  return clip(v, ISSUE_LIMITS.path * 2)
    .replace(/[?#].*$/, "")
    .slice(0, ISSUE_LIMITS.path);
}

/** К какому потоку относится тело (для выбора лимита до разбора); null — мусор. */
export function issueChannel(raw: unknown): IssueChannel | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = (raw as Record<string, unknown>).type;
  if (type === "task" || type === "ai") return "issue";
  if (type === "client_error") return "client_error";
  return null;
}

export interface IssueMeta {
  now: number;
  version: string;
  /** Заголовок User-Agent запроса (для ошибок с телефонов). */
  userAgent?: string;
}

/** Проверяет и обрезает тело запроса. Мусор — отказ с кодом, остальное — запись для хранения. */
export function parseIssue(raw: unknown, meta: IssueMeta): ParsedIssue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "bad_body" };
  const o = raw as Record<string, unknown>;
  const at = new Date(meta.now).toISOString();
  const lang = asLang(o.lang);

  if (o.type === "client_error") {
    const message = clip(o.message, ISSUE_LIMITS.message);
    if (!message) return { ok: false, code: "bad_message" };
    const record: ClientErrorRecord = { type: "client_error", message, lang, version: meta.version, at };
    const stack = clip(o.stack, ISSUE_LIMITS.stack);
    if (stack) record.stack = stack;
    const path = cleanPath(o.path);
    if (path) record.path = path;
    const ua = clip(meta.userAgent, ISSUE_LIMITS.userAgent);
    if (ua) record.userAgent = ua;
    return { ok: true, channel: "client_error", record };
  }

  if (o.type !== "task" && o.type !== "ai") return { ok: false, code: "bad_type" };
  const kind: IssueKind = o.type;
  const reasons: readonly string[] = ISSUE_REASONS[kind];
  if (typeof o.reason !== "string" || !reasons.includes(o.reason)) return { ok: false, code: "bad_reason" };
  if (typeof o.where !== "string" || !WHERES.includes(o.where as IssueWhere)) return { ok: false, code: "bad_where" };

  const record: IssueRecord = { type: kind, where: o.where as IssueWhere, reason: o.reason, lang, version: meta.version, at };
  const comment = clip(o.comment, ISSUE_LIMITS.comment);
  if (comment) record.comment = comment;
  const itemId = clipId(o.itemId);
  if (itemId) record.itemId = itemId;
  const lessonId = clipId(o.lessonId);
  if (lessonId) record.lessonId = lessonId;
  const snippet = clip(o.snippet, ISSUE_LIMITS.snippet);
  if (snippet) record.snippet = snippet;
  return { ok: true, channel: "issue", record };
}

// ---------- Клиент ----------

/** Тело жалобы из выбора ученика (поля уже обрезаются так же, как на сервере). */
export function buildIssueBody(target: IssueTarget, reason: string, comment: string, lang: Lang): IssueBody {
  const body: IssueBody = { type: target.kind, where: target.where, reason, lang };
  const c = clip(comment, ISSUE_LIMITS.comment);
  if (c) body.comment = c;
  const itemId = clipId(target.itemId);
  if (itemId) body.itemId = itemId;
  const lessonId = clipId(target.lessonId);
  if (lessonId) body.lessonId = lessonId;
  const snippet = clip(target.snippet, ISSUE_LIMITS.snippet);
  if (snippet) body.snippet = snippet;
  return body;
}

/** Отправляет жалобу. true — сервер принял; сеть или отказ — false (кнопка покажет «Не отправилось»). */
export async function submitIssue(body: IssueBody, doFetch: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await doFetch("/api/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Короткий хэш текста (FNV-1a), чтобы различать ответы ИИ к одному заданию. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Ключ «то же самое»: повторную жалобу на то же задание или тот же ответ ИИ за сессию не отправляем. */
export function issueKey(target: IssueTarget): string {
  return [target.kind, clipId(target.itemId), hash(clip(target.snippet, ISSUE_LIMITS.snippet))].join("|");
}
