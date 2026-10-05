import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

// Снимок «горел ли огонь на старте занятия». Его берёт само занятие (урок, игра, пробник) при запуске,
// а итоги читают: если день тогда был не засчитан, а теперь засчитан — показываем «Огонь загорелся».
// Хранится в sessionStorage (переживает перезагрузку страницы) и в памяти (если хранилище недоступно).
const KEY = "informatica.streakStart";
let mem: { day: string; lit: boolean } | null = null;

/** Вызывать при старте занятия. */
export function snapshotStreakStart() {
  const day = todayKey();
  mem = { day, lit: useApp.getState().streak.lastDay === day };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* хранилище недоступно — остаётся память */
  }
}

function read(): { day: string; lit: boolean } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { day?: unknown; lit?: unknown };
      if (typeof v.day === "string" && typeof v.lit === "boolean") return { day: v.day, lit: v.lit };
    }
  } catch {
    /* ничего */
  }
  return mem;
}

/** Огонь был погашен на старте последнего занятия сегодня (значит, этим занятием серия засчитана). */
export function streakWasUnlit(): boolean {
  const s = read();
  return !!s && s.day === todayKey() && !s.lit;
}

/** После показа анимации — чтобы не повторять. */
export function clearStreakStart() {
  mem = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
}
