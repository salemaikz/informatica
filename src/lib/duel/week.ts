// Неделя и сутки по Казахстану (Asia/Almaty, с 1 марта 2024 — UTC+5 круглый год) для топа друзей и лимитов пары
// (docs/specs/duels.md §5: top:w:{kzWeek}, du:pair:{kzDay}). ISO-неделя: с понедельника 00:00 по Астане.

/** Сдвиг Казахстана от UTC, мс. */
export const KZ_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Сутки по Казахстану: «2026-10-06». */
export function kzDay(nowMs: number): string {
  return new Date(nowMs + KZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO-неделя по Казахстану: «2026-W41» (бывает и 53-я). */
export function kzWeek(nowMs: number): string {
  const d = new Date(nowMs + KZ_OFFSET_MS);
  // Четверг этой ISO-недели определяет её год.
  const day = (d.getUTCDay() + 6) % 7; // пн = 0 … вс = 6
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3);
  const year = new Date(thursday).getUTCFullYear();
  const week = 1 + Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Когда начнётся следующая неделя (понедельник 00:00 по Казахстану), мс UTC. */
export function kzWeekResetsAt(nowMs: number): number {
  const d = new Date(nowMs + KZ_OFFSET_MS);
  const day = (d.getUTCDay() + 6) % 7;
  const nextMondayLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7);
  return nextMondayLocal - KZ_OFFSET_MS;
}

/** Ключ пары игроков без порядка: «a|b» по возрастанию. */
export function pairKey(pidA: string, pidB: string): string {
  return pidA < pidB ? `${pidA}|${pidB}` : `${pidB}|${pidA}`;
}
