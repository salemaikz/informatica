// Плата за чтение конспекта урока (этап 15, F2; этап 16В, P6 «Теория 2.0»; ТЗ docs/specs/stage16c.md §10.1, решение #113):
// 0,5 сердечка за открытие страницы `/theory/<id>`. Чистые функции без React; факт оплаты (id урока → когда) лежит
// в сторе (`theoryPaid`), действие — `payTheory`.
//
// Правила (уточнение владельца 2026-10-06 — «при нажатии просто 0,5 сердца, и всё»):
// - открыл тему — списано ½ сердечка, как вход в урок; без бесплатной карточки, ворот и пояснений на странице;
// - «Безлимит» (в том числе пробный) — бесплатно;
// - та же тема оплачена не раньше THEORY_REPEAT_MS назад — бесплатно (сутки);
// - пройденный урок — тоже платно (владелец: «теория тоже платная за сердца»).
// Шпаргалка, формулы и «Конспект урока» в заметках — бесплатно (это не эта страница).

import { DAY, ENTRY_COST, MINUTE } from "./economy";

/** Повторное чтение той же темы бесплатно столько мс после оплаты. */
export const THEORY_REPEAT_MS = DAY;
/** Записей об оплате храним не больше (защита от раздувания localStorage). */
export const THEORY_PAID_MAX = 60;
/** Запись «из будущего» дальше этого допуска — мусор (часы переведены); меньше — часы интерфейса отстают на тик. */
const FUTURE_SKEW_MS = MINUTE;

/** id урока → когда оплачено (мс). */
export type TheoryPaid = Record<string, number>;

/** Цена чтения темы, сердечек. */
export const theoryCost = (): number => ENTRY_COST.theory;

/** Оплачено ли чтение в последние сутки (запись «из далёкого будущего» и мусор — нет). */
export function theoryPaidRecently(paidAt: number | undefined, now: number): boolean {
  return typeof paidAt === "number" && Number.isFinite(paidAt) && paidAt - now <= FUTURE_SKEW_MS && now - paidAt < THEORY_REPEAT_MS;
}

/** Нужно ли платить за открытие темы прямо сейчас: «Безлимит» и повтор за сутки — нет. */
export function shouldPayTheory(input: { unlimited: boolean; paidAt: number | undefined; now: number }): boolean {
  return !input.unlimited && !theoryPaidRecently(input.paidAt, input.now);
}

/**
 * Что показывает страница темы при открытии:
 * - `wait` — время ещё не известно (первый кадр), ничего не решаем;
 * - `pay` — платить нужно: оплату делает колбэк страницы (не тело эффекта), текста темы пока нет;
 * - `open` — читать можно (бесплатно по правилам или уже оплачено); раз открытая тема не закрывается (`admitted`) —
 *   запись об оплате может устареть или вытесниться, пока человек читает;
 * - `locked` — сердечек не хватило: «Сердечки закончились», текст темы не показывается.
 */
export type TheoryOpenStep = "wait" | "pay" | "open" | "locked";

export function theoryOpenStep(input: { admitted: boolean; refused: boolean; unlimited: boolean; paidAt: number | undefined; now: number }): TheoryOpenStep {
  if (input.admitted) return "open";
  if (!(input.now > 0)) return "wait";
  if (!shouldPayTheory(input)) return "open";
  return input.refused ? "locked" : "pay";
}

/** Записать оплату: старше суток и лишние (самые старые) записи отбрасываются. */
export function putTheoryPaid(paid: TheoryPaid, id: string, now: number): TheoryPaid {
  return sanitizeTheoryPaid({ ...paid, [id]: now }, now);
}

/**
 * Проверка сохранённого (данные из localStorage — недоверенные): только `строка → конечное число`,
 * записи старше суток и записи «из будущего» отбрасываются, остаются самые свежие THEORY_PAID_MAX.
 */
export function sanitizeTheoryPaid(raw: unknown, now: number): TheoryPaid {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rows: [string, number][] = [];
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id.length > 80 || typeof at !== "number" || !Number.isFinite(at)) continue;
    // Из будущего (часы переведены назад) — тоже мусор: иначе чтение было бы бесплатным до этого момента.
    if (at - now > FUTURE_SKEW_MS || now - at >= THEORY_REPEAT_MS) continue;
    rows.push([id, at]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(rows.slice(0, THEORY_PAID_MAX));
}
