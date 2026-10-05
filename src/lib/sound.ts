"use client";

// Короткие звуки через Web Audio — без аудиофайлов, ноль трафика.
// Один AudioContext на всё приложение, общий мастер-гейн и мягкий компрессор:
// наложение звуков не клиппит, огибающие громкости убирают щелчки.

export type SoundName =
  | "correct" | "wrong" | "complete" | "tap" | "combo" | "levelUp" | "xp" | "pop"
  // Волна 1Б (docs/specs/stage16b-wave1b.md, R4).
  | "perfect" | "chips" | "streak" | "caseTick" | "caseReveal";

export interface SoundOptions {
  /** Для "combo": размер комбо (ступени 3/5/10); для "caseTick": номер щелчка. */
  step?: number;
}

const MASTER_GAIN = 0.15;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlockBound = false;

function create(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 18;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

/** Браузеры запускают звук только после жеста: на первое касание/клавишу создаём и «будим» контекст. */
function bindUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const events = ["pointerdown", "touchend", "keydown", "click"] as const;
  const detach = () => events.forEach((ev) => window.removeEventListener(ev, unlock, true));
  function unlock() {
    const a = create();
    if (!a) return;
    if (a.state === "running") return detach();
    void a
      .resume()
      .then(() => a.state === "running" && detach())
      .catch(() => {});
  }
  events.forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));
}

if (typeof window !== "undefined") bindUnlock();

interface Voice {
  freq: number;
  /** Задержка старта относительно начала звука, с. */
  at?: number;
  dur: number;
  type?: OscillatorType;
  /** Пиковая громкость 0..1 (до мастер-гейна). */
  vol?: number;
  attack?: number;
  /** Конечная частота — глайд вверх/вниз. */
  to?: number;
  /** Срез low-pass, Гц — смягчает тембр. */
  lp?: number;
}

function voice(a: AudioContext, t0: number, v: Voice) {
  if (!master) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  const start = t0 + (v.at ?? 0);
  const end = start + v.dur;
  osc.type = v.type ?? "sine";
  osc.frequency.setValueAtTime(v.freq, start);
  if (v.to) osc.frequency.exponentialRampToValueAtTime(v.to, end);
  // Огибающая: быстрый подъём без щелчка и плавный спад до тишины.
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v.vol ?? 0.6, start + (v.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  if (v.lp) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = v.lp;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(master);
  osc.start(start);
  osc.stop(end + 0.03);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

/** Колокольчик: основной тон + два быстро затухающих обертона. */
function chime(a: AudioContext, t0: number, freq: number, at: number, dur: number, vol = 0.6) {
  voice(a, t0, { freq, at, dur, vol });
  voice(a, t0, { freq: freq * 2, at, dur: dur * 0.55, vol: vol * 0.3 });
  voice(a, t0, { freq: freq * 3.01, at, dur: dur * 0.3, vol: vol * 0.1 });
}

const N = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  E6: 1318.5,
  G6: 1568,
  C7: 2093,
};

/** Счётчик верных ответов — для чередования трёх вариантов звука. */
let correctVariant = 0;

export function playSound(name: SoundName, opts: SoundOptions = {}) {
  try {
    const a = create();
    if (!a || !master) return;
    if (a.state !== "running") {
      void a.resume().catch(() => {});
      // Контекст «спит» после работы (фоновая вкладка) — старые события не копим, чтобы не прозвучали пачкой.
      if (a.currentTime > 0.05) return;
    }
    const t0 = a.currentTime + 0.005;
    switch (name) {
      case "correct": {
        // Три варианта по кругу: квинта вверх, терция вверх, «трель» — чтобы не приедалось.
        const variant = correctVariant++ % 3;
        if (variant === 0) {
          chime(a, t0, N.A5, 0, 0.22);
          chime(a, t0, N.E6, 0.085, 0.55, 0.55);
          chime(a, t0, N.E6, 0.21, 0.35, 0.12);
        } else if (variant === 1) {
          chime(a, t0, N.G5, 0, 0.2);
          chime(a, t0, N.C6, 0.08, 0.2, 0.5);
          chime(a, t0, N.E6, 0.16, 0.55, 0.5);
        } else {
          chime(a, t0, N.E5, 0, 0.16, 0.5);
          chime(a, t0, N.A5, 0.06, 0.16, 0.5);
          chime(a, t0, N.C6, 0.12, 0.2, 0.5);
          chime(a, t0, N.A5 * 2, 0.19, 0.5, 0.45);
        }
        break;
      }
      case "wrong":
        // Мягкий низкий «бонк»: синус с падающей высотой и срезом верхов — без дребезга.
        voice(a, t0, { freq: 240, to: 150, dur: 0.17, vol: 0.85, attack: 0.008, lp: 700 });
        voice(a, t0, { freq: 120, to: 80, dur: 0.15, vol: 0.5, attack: 0.008, lp: 400 });
        break;
      case "complete":
        // Короткая весёлая мелодия и аккорд.
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => chime(a, t0, f, i * 0.085, 0.24, 0.5));
        chime(a, t0, N.C6, 0.4, 0.85, 0.45);
        chime(a, t0, N.E6, 0.4, 0.8, 0.32);
        chime(a, t0, N.G6, 0.4, 0.75, 0.28);
        break;
      case "levelUp":
        // Фанфара: бас и арпеджио вверх, затем яркий аккорд.
        voice(a, t0, { freq: 130.8, dur: 0.5, vol: 0.45, type: "triangle", lp: 900 });
        voice(a, t0, { freq: 196, at: 0.12, dur: 0.5, vol: 0.35, type: "triangle", lp: 900 });
        [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => chime(a, t0, f, i * 0.07, 0.26, 0.5));
        chime(a, t0, N.C7, 0.5, 0.9, 0.4);
        chime(a, t0, N.G6, 0.5, 0.95, 0.35);
        chime(a, t0, N.E6, 0.5, 1, 0.35);
        chime(a, t0, N.C6, 0.5, 1.1, 0.4);
        break;
      case "xp":
        // Крошечная «монетка».
        chime(a, t0, N.E6, 0, 0.18, 0.32);
        chime(a, t0, 1760, 0.055, 0.34, 0.3);
        break;
      case "tap":
        // Очень тихий мягкий щелчок.
        voice(a, t0, { freq: 700, to: 430, dur: 0.04, vol: 0.32, attack: 0.002 });
        break;
      case "combo": {
        // Взлетающая «искра»: ступени 3 / 5 / 10 — выше, длиннее, с аккордом на финише.
        const step = Math.max(3, opts.step ?? 3);
        const tier = step >= 10 ? 10 : step >= 5 ? 5 : 3;
        const base = N.E5 * 2 ** (Math.min(step - 3, 7) / 12);
        const ratios = [1, 1.2599, 1.4983, 2, 2.5198].slice(0, tier === 10 ? 5 : tier === 5 ? 4 : 3);
        ratios.forEach((r, i) => {
          const last = i === ratios.length - 1;
          chime(a, t0, base * r, i * 0.055, last ? 0.55 : 0.16, last ? 0.55 : 0.45);
        });
        if (tier >= 5) chime(a, t0, base * 2, ratios.length * 0.055, 0.7, 0.3);
        if (tier === 10) {
          const at = ratios.length * 0.055;
          chime(a, t0, base * 3, at, 0.8, 0.3);
          voice(a, t0, { freq: base / 2, at, dur: 0.5, vol: 0.3, type: "triangle", lp: 900 });
        }
        break;
      }
      case "perfect":
        // Короткая фанфара: два «трубных» удара и яркий аккорд.
        voice(a, t0, { freq: 196, dur: 0.18, vol: 0.4, type: "triangle", lp: 1200 });
        voice(a, t0, { freq: 261.6, at: 0.14, dur: 0.18, vol: 0.4, type: "triangle", lp: 1200 });
        [N.G5, N.C6, N.E6].forEach((f, i) => chime(a, t0, f, 0.05 + i * 0.1, 0.22, 0.5));
        chime(a, t0, N.G6, 0.42, 0.9, 0.45);
        chime(a, t0, N.C7, 0.42, 1, 0.35);
        chime(a, t0, N.E6, 0.42, 0.95, 0.35);
        break;
      case "chips":
        // «Монетка»: два быстрых металлических звона, второй выше.
        voice(a, t0, { freq: 1568, dur: 0.07, vol: 0.4, type: "square", lp: 3000, attack: 0.002 });
        chime(a, t0, N.G6, 0.05, 0.28, 0.4);
        chime(a, t0, N.C7, 0.12, 0.45, 0.35);
        break;
      case "streak":
        // Огонь загорелся: низкий «вжух» вверх и тёплый аккорд.
        voice(a, t0, { freq: 180, to: 720, dur: 0.35, vol: 0.4, type: "sawtooth", lp: 900, attack: 0.04 });
        voice(a, t0, { freq: 120, to: 480, dur: 0.35, vol: 0.3, type: "triangle", lp: 700, attack: 0.04 });
        chime(a, t0, N.C6, 0.3, 0.7, 0.45);
        chime(a, t0, N.G6, 0.38, 0.8, 0.4);
        break;
      case "caseTick": {
        // Щелчок ленты кейса; шаг (0..) слегка меняет высоту — лента «живая».
        const k = (opts.step ?? 0) % 3;
        voice(a, t0, { freq: 1100 + k * 90, to: 700, dur: 0.035, vol: 0.4, attack: 0.002, type: "triangle" });
        break;
      }
      case "caseReveal":
        // «Раскрытие» приза: короткий нарастающий глайд и яркий звон.
        voice(a, t0, { freq: 300, to: 900, dur: 0.22, vol: 0.35, type: "triangle", lp: 1500, attack: 0.03 });
        [N.C6, N.E6, N.G6].forEach((f, i) => chime(a, t0, f, 0.2 + i * 0.06, 0.4, 0.45));
        chime(a, t0, N.C7, 0.4, 0.9, 0.4);
        break;
      case "pop":
        // «Пузырёк»: короткий глайд вверх.
        voice(a, t0, { freq: 320, to: 760, dur: 0.07, vol: 0.5, attack: 0.003 });
        voice(a, t0, { freq: 1200, at: 0.035, dur: 0.1, vol: 0.14 });
        break;
    }
  } catch {
    // звук — не критично
  }
}
