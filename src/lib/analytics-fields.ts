// Хранение статистики (решение #69): только суточные счётчики в хеше `ev:<день по Астане>`.
// Здесь — какие поля пишет каждое событие. Ни id устройства, ни IP, ни времени события в хранилище нет.
// Читает эти поля страница владельца (lib/owner-report.ts); формат полей описан в docs/specs/stage12.md → P1.2.
// Чистая логика без React и сервера: покрыта tests/analytics-fields.test.ts.

import type { AnalyticsEvent } from "@/lib/analytics";

/** Ключ хеша суток: `ev:2026-10-05` (день — по Астане, kzDay). */
export const eventsKey = (day: string): string => `ev:${day}`;

/** Хеш суток живёт 400 дней: хватает на удержание D30 и год наблюдений. */
export const EVENTS_TTL_SEC = 400 * 86_400;

/**
 * Поля хеша, которые увеличивает одно событие (значение — на сколько):
 * `<e>` — счётчик событий вида; плюс измерения (урок, шаг, режим…), см. ТЗ P1.2.
 */
export function fieldsOf(ev: AnalyticsEvent): Record<string, number> {
  const f: Record<string, number> = { [ev.e]: 1 };
  switch (ev.e) {
    case "lesson_start":
      f[`ls:${ev.lesson}:${ev.via}`] = 1;
      if (ev.resume === 1) f[`lr:${ev.lesson}`] = 1;
      break;
    case "lesson_quit":
      f[`lq:${ev.lesson}:${ev.step}/${ev.of}`] = 1;
      break;
    case "lesson_finish":
      f[`lf:${ev.lesson}`] = 1;
      // Сумма точности: среднее = la / lf.
      if (ev.acc > 0) f[`la:${ev.lesson}`] = ev.acc;
      break;
    case "resume_choice":
      f[`rc:${ev.choice}`] = 1;
      break;
    case "task":
      f[`tk:${ev.step}:n`] = 1;
      // «w» — неверно или пропущено с первой попытки.
      if (ev.ok === 0 || ev.skip === 1) f[`tk:${ev.step}:w`] = 1;
      if (ev.hint === 1) f[`tk:${ev.step}:h`] = 1;
      break;
    case "drill_start":
      f[`ds:${ev.mode}`] = 1;
      break;
    case "drill_finish":
      f[`df:${ev.mode}`] = 1;
      break;
    case "game_start":
      f[`gs:${ev.game}`] = 1;
      break;
    case "game_finish":
      f[`gf:${ev.game}`] = 1;
      break;
    case "game_quit":
      f[`gq:${ev.game}`] = 1;
      break;
    case "exam_start":
      f[`xs:${ev.kind}`] = 1;
      break;
    case "exam_finish":
      f[`xf:${ev.kind}`] = 1;
      break;
    case "paywall_view":
      f[`pv:${ev.from}`] = 1;
      break;
    case "plan_click":
      f[`pc:${ev.tier}:${ev.period}`] = 1;
      break;
    case "trial_start":
      f[`ts:${ev.from}`] = 1;
      break;
    case "shop_click":
      f[`sc:${ev.item}`] = 1;
      break;
    case "hearts_out":
      f[`ho:${ev.where}`] = 1;
      break;
    case "onb_step":
      f[`ob:${ev.step}`] = 1;
      break;
    case "onb_done":
      f[`od:${ev.track}`] = 1;
      break;
    case "diag":
      f[`dg:${ev.done}`] = 1;
      break;
    case "active":
      f[`act:${ev.d}`] = 1;
      break;
    case "break_reason":
      f[`br:${ev.code}`] = 1;
      break;
    case "feedback":
      f[`fb:${ev.kind}`] = 1;
      break;
  }
  return f;
}

/** Только счётчики событий (поля без измерений: у них нет «:», их не больше числа видов событий). */
export function totalsOnly(fields: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(fields).filter(([k]) => !k.includes(":")));
}

/** Поля пачки событий, сложенные вместе (одно обращение к хранилищу на всю пачку). */
export function batchFields(events: readonly AnalyticsEvent[]): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const ev of events) for (const [k, n] of Object.entries(fieldsOf(ev))) sum[k] = (sum[k] ?? 0) + n;
  return sum;
}
