// Выбор похвалы на панели ответа: без повтора подряд, при комбо — «огненные» фразы. Чистая логика (случайность передаётся снаружи).

export const BASE_PRAISE = [
  "fb.correct.1", "fb.correct.2", "fb.correct.3", "fb.correct.4",
  "praise.1", "praise.2", "praise.3", "praise.4", "praise.5", "praise.6", "praise.7", "praise.8",
] as const;

export const COMBO_PRAISE = ["praise.combo.1", "praise.combo.2", "praise.combo.3"] as const;

export type PraiseKey = (typeof BASE_PRAISE)[number] | (typeof COMBO_PRAISE)[number];

/** Фраза для верного ответа. `rand` — число [0, 1); `prev` — прошлая фраза (не повторяем). */
export function pickPraise(combo: number, prev: string | null, rand: number): PraiseKey {
  const pool: readonly PraiseKey[] = combo >= 3 ? [...COMBO_PRAISE, ...BASE_PRAISE.slice(0, 4)] : BASE_PRAISE;
  const free = pool.filter((k) => k !== prev);
  const list = free.length ? free : pool;
  return list[Math.min(list.length - 1, Math.floor(rand * list.length))];
}

/** Ступень комбо для звука и эффектов: 0 (нет), 3, 5, 10. */
export function comboTier(combo: number): 0 | 3 | 5 | 10 {
  if (combo >= 10) return 10;
  if (combo >= 5) return 5;
  if (combo >= 3) return 3;
  return 0;
}
