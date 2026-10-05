// Сцены Бита-проводника (этап 16Б, P6; этап 16В, P2a): что уже показано ученику. id → время показа (мс). Чистая логика без React.
// Сцены — lib/guide.ts. Прогресс подсказок — в сторе (useApp.tips), меняется только действиями
// noteTip / resetTips, чтобы позже уехать в облако вместе с остальным прогрессом.

/** Известные сцены: путь первого входа и по одной короткой сцене на главных страницах. */
export const TIP_IDS = [
  "welcome", // приветствие на «Учиться» и путь к первому уроку
  "lesson-first", // первый урок: сердечко за вход, полоска, «нажми вариант», «нажми Проверить», где подсказка
  "after-first", // итоги первого урока: опыт, чипы, серия, «Продолжить»
  "nav", // после первого урока: следующий урок, нижняя панель, плавающий Бит, магазин
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
