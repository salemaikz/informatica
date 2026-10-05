// Часы активного времени на вкладке (#68): один экземпляр на страницу, запускает ActiveTimeAgent.
// Логика — lib/active-time.ts; здесь только состояние и подписки на события браузера. Только в браузере.

import { FLUSH_MS, input, startClock, studyKindOf, takeSeconds, tick, type ClockState, type StudyKind } from "./active-time";

let clock: ClockState | null = null;
let kind: StudyKind | null = null;
let sink: ((sec: number, kind: StudyKind) => void) | null = null;
let sinceFlush = 0;
let timer = 0;

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

/** Сбросить накопленное в стор (sink). */
function flush() {
  if (!clock || !sink) return;
  const { clock: c, sec } = takeSeconds(clock);
  clock = c;
  if (sec > 0 && kind) sink(sec, kind);
}

function onTick() {
  if (!clock) return;
  const now = Date.now();
  clock = tick(clock, now, visible(), kind);
  sinceFlush += 1000;
  if (sinceFlush >= FLUSH_MS) {
    sinceFlush = 0;
    flush();
  }
}

function onInput() {
  if (clock) clock = input(clock, Date.now());
}

function onHide() {
  if (!clock) return;
  clock = tick(clock, Date.now(), true, kind);
  flush();
}

/** Запуск (из эффекта ActiveTimeAgent). Возвращает остановку. Повторный запуск — та же функция остановки. */
export function startActiveClock(write: (sec: number, kind: StudyKind) => void): () => void {
  sink = write;
  if (clock) return stopActiveClock;
  clock = startClock(Date.now());
  const opts = { passive: true, capture: true } as const;
  window.addEventListener("pointerdown", onInput, opts);
  window.addEventListener("keydown", onInput, opts);
  window.addEventListener("wheel", onInput, opts);
  window.addEventListener("touchmove", onInput, opts);
  window.addEventListener("scroll", onInput, opts);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  timer = window.setInterval(onTick, 1000);
  return stopActiveClock;
}

export function stopActiveClock() {
  if (!clock) return;
  onHide();
  window.clearInterval(timer);
  const opts = { capture: true } as const;
  window.removeEventListener("pointerdown", onInput, opts);
  window.removeEventListener("keydown", onInput, opts);
  window.removeEventListener("wheel", onInput, opts);
  window.removeEventListener("touchmove", onInput, opts);
  window.removeEventListener("scroll", onInput, opts);
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("pagehide", onHide);
  clock = null;
}

/** Смена страницы: досчитать время прошлого экрана и переключить вид занятия. */
export function setStudyPath(pathname: string | null) {
  const next = studyKindOf(pathname);
  if (next === kind) return;
  if (clock) {
    clock = tick(clock, Date.now(), visible(), kind);
    flush();
    clock = input(clock, Date.now());
  }
  kind = next;
}

/**
 * Всего активных миллисекунд на вкладке. Разница двух чтений — активное время между ними
 * (урок: время прохождения и время на ответ). До запуска часов — 0.
 */
export function activeMs(): number {
  if (!clock) return 0;
  return tick(clock, Date.now(), visible(), kind).totalMs;
}
