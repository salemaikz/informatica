// Сцены Бита-проводника (этап 16Б, P6; этап 16В, P2a): что уже показано ученику. id → время показа (мс). Чистая логика без React.
// Сцены — lib/guide.ts. Прогресс подсказок — в сторе (useApp.tips), меняется только действиями
// noteTip / resetTips, чтобы позже уехать в облако вместе с остальным прогрессом.

/** Известные сцены: путь первого входа и по одной короткой сцене на главных страницах. */
export const TIP_IDS = [
  "intro", // этап 16Г: знакомство на «Учиться» до первого урока — карточка, шапка, вкладки, кнопка Бита, «Начать»
  "welcome", // старое приветствие v0.16–0.18: теперь только отметка (сцены нет) — видел старое → короткий nav
  "lesson-first", // первый урок: сердечко за вход, полоска, инструменты, ИИ, «нажми вариант», «нажми Проверить»
  "lesson-icons", // этап 16Г: инструменты и ИИ в уроке — один раз для тех, кто прошёл старый lesson-first
  "after-first", // итоги первого урока: опыт, чипы, серия, «Продолжить»
  "learn-next", // этап 16Г: после первого урока одна реплика у карточки урока — «нажми» (конец обучения)
  "nav", // отметка «обзор панели показан» (v0.18); сцена — короткая версия для видевших старое приветствие
  "page-practice",
  "page-tutor",
  "page-materials",
  "page-progress",
  "page-school",
  "page-shop",
  "page-profile",
] as const;

export type TipId = (typeof TIP_IDS)[number];
export type TipsState = Partial<Record<TipId, number>>;

const KNOWN = new Set<string>(TIP_IDS);

/** Сохранённое состояние из localStorage — недоверенное: только известные id и разумные времена. */
export function sanitizeTips(raw: unknown): TipsState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TipsState = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (KNOWN.has(k) && typeof v === "number" && Number.isFinite(v) && v >= 0) out[k as TipId] = Math.floor(v);
  }
  return out;
}

export const tipSeen = (tips: TipsState | undefined, id: TipId): boolean => !!tips?.[id];
