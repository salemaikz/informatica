// Оплаченные входы в занятия (этап 16Г, решение #120): повторный вход в то же занятие в течение RUN_GRACE_MS после оплаты
// бесплатный — перезагрузка, случайный выход, двойной вызов эффекта или двойное нажатие не списывают сердечко второй раз.
// Чистые функции без React; поле стора `entryPaid` меняют только payEntryOnce / payEntryFresh / finishSession (store.ts).
//
// Ключи: `lesson:<id>` («Учиться»), `check:<id>` («Проверить себя»), ключ тренировки (lib/drill-paid.ts → drillPaidKey),
// `code:<язык>:<задача>` (задача практикума кода), `quiz:<тема>` («Дай задачи» в чате).
// Закончил занятие (finishSession) — ключ снимается: следующее такое же снова платное. Обобщает `drillPaid` этапа 16В (E7).

import { RUN_GRACE_MS } from "./lesson-run";

/** Сколько после оплаты то же занятие открывается бесплатно, мс (20 минут — как продолжение урока). */
export const ENTRY_PAID_GRACE_MS = RUN_GRACE_MS;
/** Сколько оплаченных входов помним (самые свежие). */
export const ENTRY_PAID_MAX = 8;
const KEY_MAX = 160;

/** Ключ занятия → когда оплачен вход. */
export type EntryPaid = Record<string, number>;

export const lessonEntryKey = (lessonId: string): string => `lesson:${lessonId}`;
export const checkEntryKey = (lessonId: string): string => `check:${lessonId}`;
export const codeEntryKey = (lang: string, taskId: string): string => `code:${lang}:${taskId}`;
export const quizEntryKey = (topic: string | undefined): string => `quiz:${topic ?? ""}`;

const fresh = (at: number, now: number) => now - at >= 0 && now - at <= ENTRY_PAID_GRACE_MS;

/** Вход с этим ключом уже оплачен и срок не вышел. */
export function entryPaidActive(paid: EntryPaid | null | undefined, key: string, now: number): boolean {
  const at = paid?.[key];
  return typeof at === "number" && fresh(at, now);
}

/** Без просроченных и не больше ENTRY_PAID_MAX самых свежих. */
export function pruneEntryPaid(paid: EntryPaid, now: number): EntryPaid {
  const alive = Object.entries(paid)
    .filter(([, at]) => fresh(at, now))
    .sort((a, b) => b[1] - a[1])
    .slice(0, ENTRY_PAID_MAX);
  return Object.fromEntries(alive);
}

/** Запомнить оплату входа (и подрезать список). */
export function putEntryPaid(paid: EntryPaid, key: string, at: number): EntryPaid {
  return pruneEntryPaid({ ...paid, [key.slice(0, KEY_MAX)]: at }, at);
}

/** Забыть оплату входов (занятие закончено). Ничего не изменилось — тот же объект. */
export function dropEntryPaid(paid: EntryPaid, keys: readonly string[]): EntryPaid {
  if (!keys.some((k) => k in paid)) return paid;
  const next = { ...paid };
  for (const k of keys) delete next[k];
  return next;
}

/**
 * Из хранилища (данные недоверенные): только корректные и не просроченные отметки, не больше ENTRY_PAID_MAX.
 * legacyDrill — старое поле `drillPaid` ({ key, at }, этап 16В): переносим, чтобы оплаченная тренировка не стала платной снова.
 */
export function sanitizeEntryPaid(raw: unknown, now: number, legacyDrill?: unknown): EntryPaid {
  const out: EntryPaid = {};
  const add = (key: unknown, at: unknown) => {
    if (typeof key !== "string" || !key || key.length > KEY_MAX) return;
    if (typeof at !== "number" || !Number.isFinite(at) || !fresh(at, now)) return;
    out[key] = at;
  };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) add(k, v);
  }
  if (legacyDrill && typeof legacyDrill === "object" && !Array.isArray(legacyDrill)) {
    const d = legacyDrill as { key?: unknown; at?: unknown };
    if (typeof d.key === "string" && !(d.key in out)) add(d.key, d.at);
  }
  return pruneEntryPaid(out, now);
}
