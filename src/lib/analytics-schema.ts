// Белый список событий статистики (решение #69): общий для клиента (что отправлять) и сервера (что принимать).
// Строго по типам из lib/analytics.ts: неизвестное событие, лишнее поле или значение не того вида — отбрасываются.
// Чистая логика без React и без сервера: покрыта tests/analytics-schema.test.ts.

import type { AnalyticsEvent, BreakReason, ChallengeStep, HeartOutWhere, PaywallFrom, ShareHow, ShareWhat } from "@/lib/analytics";

/** Не больше стольких событий в одной пачке (лишние отбрасываются до проверки). */
export const MAX_BATCH = 30;
/** Размер тела запроса /api/events, байт: больше — отказ (413). Тридцать событий укладываются с запасом. */
export const EVENTS_BODY_MAX = 4000;

/** Запросов к /api/events в окне с одного IP (за классом в школьном Wi-Fi — много учеников, поэтому не жёстко). */
export const EVENTS_IP_LIMIT = { limit: 600, windowMs: 10 * 60_000 } as const;
/** Событий в сутки (по Астане) с одного IP (хеш) и со всего сайта: сверх — 429 без записи. */
export const EVENTS_IP_DAY_MAX = 10_000;
export const EVENTS_SITE_DAY_MAX = 50_000;
/**
 * Новых полей в суточном хеше за сутки — запасной предохранитель: основная защита — сервер сводит неизвестные id к `other`
 * (server/analytics-ids.ts), поэтому число полей ограничено контентом, а не клиентом. Исчерпан бюджет — пишутся только
 * счётчики событий, без измерений (#69, ревью этапа 12).
 */
export const EVENTS_FIELDS_DAY_MAX = 5000;

/** Строка-идентификатор (урок, шаг, игра, режим, товар): латиница, цифры и `_ . : -`, до 80 знаков. */
export const ID_RE = /^[\w.:-]{1,80}$/;

/**
 * Имена, которыми «отравить» поиск в обычном объекте: ключи Object.prototype (constructor, __proto__, toString…) и prototype.
 * Идентификатор с таким именем (или с таким кусочком между «:») не принимается: см. тест «отравленные поля».
 */
const POISON = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);

/** Верный идентификатор: по шаблону и без имён из Object.prototype (целиком и по кускам через «:»). */
export const isSafeId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v) && !POISON.has(v) && !v.split(":").some((part) => POISON.has(part));

// ---------- Допустимые значения ----------

export const PAYWALL_FROMS: readonly PaywallFrom[] = ["onboarding", "auto", "shop", "profile", "hearts", "ai", "other"];
export const HEART_OUT_WHERES: readonly HeartOutWhere[] = ["lesson", "check", "extern", "exam", "checkpoint", "game"];
export const BREAK_REASONS: readonly BreakReason[] = ["time", "hard", "boring", "forgot", "other_prep", "other"];
export const SHARE_WHATS: readonly ShareWhat[] = ["exam", "course", "streak", "challenge", "report"];
export const SHARE_HOWS: readonly ShareHow[] = ["native", "copy", "wa", "tg", "save", "manual"];
export const SHARE_OPENS = ["exam", "course", "streak", "report"] as const;
export const CHALLENGE_STEPS: readonly ChallengeStep[] = ["accept", "start", "more", "same", "less"];
const VIA = ["learn", "check"] as const;
const EXAM_KINDS = ["full", "mini", "topic", "unit"] as const;
const FEEDBACK_KINDS = ["idea", "bug", "content", "other"] as const;

// ---------- Проверки полей ----------
// Каждая возвращает значение нужного вида или undefined (поле не годится — событие отбрасывается целиком).

type Check = (v: unknown) => string | number | undefined;

const id: Check = (v) => (isSafeId(v) ? v : undefined);
const oneOf =
  (list: readonly (string | number)[]): Check =>
  (v) =>
    (typeof v === "string" || typeof v === "number") && list.includes(v) ? v : undefined;
const int =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

const flag = oneOf([0, 1]);
const percent = int(0, 100);
const steps = int(0, 200);
const seconds = int(0, 7200);

type Schema = Record<string, Check>;

/** Поля каждого события. Ключи этой таблицы — полный список событий (проверяется тестом против lib/analytics.ts). */
export const EVENT_SCHEMA: Record<AnalyticsEvent["e"], Schema> = {
  lesson_start: { lesson: id, via: oneOf(VIA), resume: flag },
  lesson_quit: { lesson: id, via: oneOf(VIA), step: steps, of: steps },
  lesson_finish: { lesson: id, via: oneOf(VIA), acc: percent, sec: seconds },
  resume_choice: { lesson: id, choice: oneOf(["continue", "restart"]) },
  task: { step: id, ok: flag, skip: flag, hint: flag },
  drill_start: { mode: id },
  drill_finish: { mode: id, acc: percent },
  game_start: { game: id, lesson: flag },
  game_finish: { game: id, acc: percent },
  game_quit: { game: id },
  exam_start: { kind: oneOf(EXAM_KINDS) },
  exam_finish: { kind: oneOf(EXAM_KINDS), pct: percent },
  paywall_view: { from: oneOf(PAYWALL_FROMS) },
  plan_click: { tier: oneOf(["lite", "unlimited"]), period: oneOf(["month", "year"]) },
  trial_start: { from: oneOf(PAYWALL_FROMS) },
  shop_click: { item: id },
  hearts_out: { where: oneOf(HEART_OUT_WHERES) },
  onb_step: { step: id },
  onb_done: { track: oneOf(["ent", "school"]) },
  diag: { done: flag, pct: percent },
  active: { d: oneOf([0, 1, 7, 30]) },
  break_reason: { code: oneOf(BREAK_REASONS) },
  feedback: { kind: oneOf(FEEDBACK_KINDS) },
  share: { what: oneOf(SHARE_WHATS), how: oneOf(SHARE_HOWS) },
  share_open: { what: oneOf(SHARE_OPENS) },
  challenge: { step: oneOf(CHALLENGE_STEPS) },
};

/** Одно событие из недоверенных данных: только известное имя и только поля из схемы; иначе null. Лишние поля отбрасываются. */
export function parseEvent(raw: unknown): AnalyticsEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = o.e;
  if (typeof name !== "string" || !Object.prototype.hasOwnProperty.call(EVENT_SCHEMA, name)) return null;
  const schema = EVENT_SCHEMA[name as AnalyticsEvent["e"]];
  const out: Record<string, string | number> = { e: name };
  for (const [field, check] of Object.entries(schema)) {
    const v = check(o[field]);
    if (v === undefined) return null;
    out[field] = v;
  }
  return out as unknown as AnalyticsEvent;
}

/**
 * Тело запроса /api/events → список верных событий. Принимает массив или `{ events: [...] }`.
 * В пачке не больше MAX_BATCH событий (лишние отбрасываются), мусор пропускается, остальное сохраняется.
 */
export function parseEvents(body: unknown): AnalyticsEvent[] {
  const list = Array.isArray(body) ? body : body && typeof body === "object" ? (body as { events?: unknown }).events : undefined;
  if (!Array.isArray(list)) return [];
  const out: AnalyticsEvent[] = [];
  for (const raw of list.slice(0, MAX_BATCH)) {
    const ev = parseEvent(raw);
    if (ev) out.push(ev);
  }
  return out;
}
