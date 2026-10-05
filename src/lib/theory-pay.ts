// Плата за чтение конспекта урока (этап 15, F2; ТЗ docs/specs/stage15.md): 0,5 сердечка за страницу `/theory/<id>`.
// Чистые функции без React; факт оплаты (id урока → когда) лежит в сторе (`theoryPaid`), действие — `payTheory`.
//
// Правила:
// - урок пройден — читать бесплатно (повторять пройденное не наказываем);
// - «Безлимит» (в том числе пробный) — бесплатно;
// - тот же конспект оплачен не раньше THEORY_REPEAT_MS назад — бесплатно (сутки);
// - иначе платим ENTRY_COST.theory, когда ученик листает дальше первого экрана или читает THEORY_READ_MS — что раньше.
// Шпаргалка, формулы и «Конспект урока» в заметках — бесплатно (это не эта страница).

import { DAY, ENTRY_COST, MINUTE } from "./economy";

/** Повторное чтение того же конспекта бесплатно столько мс после оплаты. */
export const THEORY_REPEAT_MS = DAY;
/** Через сколько мс чтения (без прокрутки) платим. */
export const THEORY_READ_MS = 15_000;
/** Прокрутка от верха, после которой платим, в долях высоты экрана («дальше первого экрана»). */
export const THEORY_SCROLL_SCREENS = 0.6;
/** Записей об оплате храним не больше (защита от раздувания localStorage). */
export const THEORY_PAID_MAX = 60;
/** Запись «из будущего» дальше этого допуска — мусор (часы переведены); меньше — часы интерфейса отстают на тик. */
const FUTURE_SKEW_MS = MINUTE;

/** id урока → когда оплачено (мс). */
export type TheoryPaid = Record<string, number>;

/** Цена чтения конспекта, сердечек. */
export const theoryCost = (): number => ENTRY_COST.theory;

/**
 * Состояние оплаты чтения конспекта:
 * done — урок пройден, unlimited — «Безлимит», paid — уже оплачено в последние сутки, pay — нужно платить.
 */
export type TheoryPayState = "done" | "unlimited" | "paid" | "pay";

export function theoryPayState(input: { done: boolean; unlimited: boolean; paidAt: number | undefined; now: number }): TheoryPayState {
  if (input.done) return "done";
  if (input.unlimited) return "unlimited";
  const at = input.paidAt;
  if (typeof at === "number" && Number.isFinite(at) && at - input.now <= FUTURE_SKEW_MS && input.now - at < THEORY_REPEAT_MS) return "paid";
  return "pay";
}

/** Нужно ли платить за открытие конспекта прямо сейчас. */
export const shouldPayTheory = (input: Parameters<typeof theoryPayState>[0]): boolean => theoryPayState(input) === "pay";

/** Оплачено время `at` — до какого момента повторное чтение бесплатно (мс). */
export const theoryFreeUntil = (at: number): number => at + THEORY_REPEAT_MS;

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
