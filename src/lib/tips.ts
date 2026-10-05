// Подсказки первого входа (этап 16Б): что уже показано ученику. id → время показа (мс). Чистая логика без React.
// Сценарий — docs/specs/stage16b.md, пакет P6. Прогресс подсказок — в сторе (useApp.tips), меняется только действиями
// noteTip / resetTips, чтобы позже уехать в облако вместе с остальным прогрессом.

/** Известные подсказки: проводник первого входа и по одной карточке на главных страницах. */
export const TIP_IDS = [
  "welcome", // приветствие на «Учиться» и путь к первому уроку
  "lesson-first", // одна подсказка в первом уроке (сердечко за вход, ошибки не отнимают)
  "after-first", // объяснение итогов первого урока (опыт, чипы, серия, сердечки)
  "nav", // короткий обзор нижней панели и шапки
  "page-practice",
  "page-tutor",
  "page-materials",
  "page-progress",
  "page-school",
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
