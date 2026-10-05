// Обезличенная статистика (решение #69): какие события бывают и как их отправить.
// Без идентификаторов: ни id устройства, ни имени, ни IP. Только имя события и короткие поля из белого списка.
// Сбор выключен, пока не включён на сервере (NEXT_PUBLIC_ANALYTICS=1) и не разрешён в профиле (profile.analytics).
//
// Компоненты зовут track(...) — дальше событие уходит в «приёмник» (setAnalyticsSink), который ставит AnalyticsAgent:
// буфер, отправка пачкой на /api/events. Пока приёмника нет (выключено, тесты, сервер) — track ничего не делает.

/** Откуда открыли окно тарифов (как PlansFrom). */
export type PaywallFrom = "onboarding" | "auto" | "shop" | "profile" | "hearts" | "ai" | "other";
/** Где закончились сердечки. */
export type HeartOutWhere = "lesson" | "check" | "extern" | "exam" | "checkpoint" | "game" | "drill";
/** Ответ на «Что помешало?» после перерыва. */
export type BreakReason = "time" | "hard" | "boring" | "forgot" | "other_prep" | "other";
/** Чем поделились (#72): результат пробника, % курса, серия, вызов другу, отчёт родителю. */
export type ShareWhat = "exam" | "course" | "streak" | "challenge" | "report";
/** Как поделились: системное меню, копирование, WhatsApp, Telegram, сохранение картинки, ручное копирование из поля. */
export type ShareHow = "native" | "copy" | "wa" | "tg" | "save" | "manual";
/** Шаг вызова друга (#73): принял на странице результата, начал вариант, итог против друга. */
export type ChallengeStep = "accept" | "start" | "more" | "same" | "less";

export type AnalyticsEvent =
  // Урок: старт (resume — продолжение сохранённого), выход до конца (step — пройдено шагов из of), конец (acc — точность в %, sec — активные секунды)
  | { e: "lesson_start"; lesson: string; via: "learn" | "check"; resume: 0 | 1 }
  | { e: "lesson_quit"; lesson: string; via: "learn" | "check"; step: number; of: number }
  | { e: "lesson_finish"; lesson: string; via: "learn" | "check"; acc: number; sec: number }
  // Выбор на экране «Урок не закончен»
  | { e: "resume_choice"; lesson: string; choice: "continue" | "restart" }
  // Первая попытка задания: ok — верно (частичный — 0), skip — пропущено; где — урок, тренировка
  | { e: "task"; step: string; ok: 0 | 1; skip: 0 | 1; hint: 0 | 1 }
  // Тренировка
  | { e: "drill_start"; mode: string }
  | { e: "drill_finish"; mode: string; acc: number }
  // Игра: старт, конец, выход без конца
  | { e: "game_start"; game: string; lesson: 0 | 1 }
  | { e: "game_finish"; game: string; acc: number }
  | { e: "game_quit"; game: string }
  // Пробный ЕНТ / контрольная
  | { e: "exam_start"; kind: "full" | "mini" | "topic" | "unit" }
  | { e: "exam_finish"; kind: "full" | "mini" | "topic" | "unit"; pct: number }
  // Деньги и спрос: показ окна тарифов, клик по тарифу, пробный период, клик по товару за ₸
  | { e: "paywall_view"; from: PaywallFrom }
  | { e: "plan_click"; tier: "lite" | "unlimited"; period: "month" | "year" }
  | { e: "trial_start"; from: PaywallFrom }
  | { e: "shop_click"; item: string }
  // Сердечки закончились (где)
  | { e: "hearts_out"; where: HeartOutWhere }
  // Онбординг: шаг (имя шага) и конец (трек); диагностика
  | { e: "onb_step"; step: string }
  | { e: "onb_done"; track: "ent" | "school" }
  | { e: "diag"; done: 0 | 1; pct: number }
  // Удержание: день с первого запуска (0, 1, 7, 30 — остальные не шлём); раз в день
  | { e: "active"; d: 0 | 1 | 7 | 30 }
  // «Что помешало?» после перерыва
  | { e: "break_reason"; code: BreakReason }
  // Отзыв со страницы обратной связи (только факт и вид, текст идёт отдельно через /api/issue)
  | { e: "feedback"; kind: "idea" | "bug" | "content" | "other" }
  // Поделиться (#72): что и как; открытие ссылки получателем (/r/… — exam/course/streak, /report — report); вызов другу (#73)
  | { e: "share"; what: ShareWhat; how: ShareHow }
  | { e: "share_open"; what: "exam" | "course" | "streak" | "report" }
  | { e: "challenge"; step: ChallengeStep };

export type AnalyticsName = AnalyticsEvent["e"];

let sink: ((ev: AnalyticsEvent) => void) | null = null;

/** Поставить приёмник событий (AnalyticsAgent) или убрать (null). */
export function setAnalyticsSink(fn: ((ev: AnalyticsEvent) => void) | null) {
  sink = fn;
}

/** Записать событие. Никогда не бросает и ничего не ждёт: сбой статистики не должен мешать учёбе. */
export function track(ev: AnalyticsEvent) {
  if (!sink) return;
  try {
    sink(ev);
  } catch {
    // статистика — не повод ломать экран
  }
}

/** Доля 0..1 → целый процент 0..100 (для полей acc/pct). */
export const pct = (x: number | null | undefined): number => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x * 100))) : 0);
