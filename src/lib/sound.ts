"use client";

// Короткие звуки через Web Audio — без аудиофайлов, ноль трафика.
// Один AudioContext на всё приложение, общий мастер-гейн и мягкий компрессор:
// наложение звуков не клиппит, огибающие громкости убирают щелчки.

export type SoundName = "correct" | "wrong" | "complete" | "tap" | "combo" | "levelUp" | "xp" | "pop";

export interface SoundOptions {
  /** Для "combo": размер комбо — чем больше, тем выше тон и длиннее «искры». */
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
      case "correct":
        // Яркий двойной звон (квинта вверх) с мягким хвостом.
        chime(a, t0, N.A5, 0, 0.22);
        chime(a, t0, N.E6, 0.085, 0.55, 0.55);
        chime(a, t0, N.E6, 0.21, 0.35, 0.12);
        break;
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
        // Взлетающая «искра»: чем длиннее серия, тем выше и длиннее.
        const step = Math.max(3, opts.step ?? 3);
        const base = N.E5 * 2 ** (Math.min(step - 3, 7) / 12);
        const ratios = [1, 1.2599, 1.4983, 2, 2.5198].slice(0, step >= 7 ? 5 : step >= 5 ? 4 : 3);
        ratios.forEach((r, i) => {
          const last = i === ratios.length - 1;
          chime(a, t0, base * r, i * 0.055, last ? 0.55 : 0.16, last ? 0.55 : 0.45);
        });
        break;
      }
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

export type MusicTrack = "game" | "focus";
export type MusicSnapshot = { enabled: boolean; playing: boolean; unavailable: boolean; track: MusicTrack };
const MUSIC_STORAGE_KEY = "informatica-music-v1";
const MUSIC_FILES: Record<MusicTrack, string> = { game: "/media/music/bit-arcade.wav", focus: "/media/music/quiet-focus.wav" };
const SILENT_MUSIC: MusicSnapshot = { enabled: false, playing: false, unavailable: false, track: "game" };
let musicSnapshot = SILENT_MUSIC;
let musicAudio: HTMLAudioElement | null = null;
let musicOwner: symbol | null = null;
let musicLoaded = false;
let musicRequest = 0;
const musicSubscribers = new Set<() => void>();

function publishMusic(update: Partial<MusicSnapshot>) {
  const next = { ...musicSnapshot, ...update };
  if (Object.keys(next).every((key) => next[key as keyof MusicSnapshot] === musicSnapshot[key as keyof MusicSnapshot])) return;
  musicSnapshot = next;
  musicSubscribers.forEach((listener) => listener());
}

function pauseMusic() {
  musicRequest++;
  musicAudio?.pause();
  publishMusic({ playing: false });
}

async function resumeMusic() {
  if (typeof document === "undefined" || !musicSnapshot.enabled || !musicOwner || document.hidden) return;
  const request = ++musicRequest;
  try {
    if (!musicAudio) {
      musicAudio = new Audio();
      musicAudio.loop = true;
      musicAudio.preload = "none";
      musicAudio.volume = .2;
    }
    const file = MUSIC_FILES[musicSnapshot.track];
    if (musicAudio.getAttribute("src") !== file) {
      musicAudio.pause();
      musicAudio.src = file;
    }
    await musicAudio.play();
    if (request === musicRequest && musicOwner && musicSnapshot.enabled && !document.hidden) publishMusic({ playing: true, unavailable: false });
    else if (!musicOwner || !musicSnapshot.enabled || document.hidden) musicAudio.pause();
  } catch {
    if (request === musicRequest) publishMusic({ playing: false, unavailable: true });
  }
}

function loadMusicPreference() {
  if (musicLoaded || typeof window === "undefined") return;
  musicLoaded = true;
  try { publishMusic({ enabled: window.localStorage.getItem(MUSIC_STORAGE_KEY) === "on" }); } catch { /* приватный режим */ }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseMusic(); else void resumeMusic(); });
  window.addEventListener("pagehide", pauseMusic);
  window.addEventListener("storage", (event) => {
    if (event.key !== MUSIC_STORAGE_KEY) return;
    publishMusic({ enabled: event.newValue === "on", unavailable: false });
    if (musicSnapshot.enabled) void resumeMusic(); else pauseMusic();
  });
  // Сохранённое разрешение не отменяет требование браузера к первому нажатию.
  const retry = () => { if (musicSnapshot.enabled && !musicSnapshot.playing && musicOwner) void resumeMusic(); };
  window.addEventListener("pointerdown", retry, { passive: true });
  window.addEventListener("keydown", retry);
}

export function subscribeMusic(listener: () => void) {
  musicSubscribers.add(listener);
  loadMusicPreference();
  return () => { musicSubscribers.delete(listener); };
}
export const getMusicSnapshot = () => musicSnapshot;
export const getServerMusicSnapshot = () => SILENT_MUSIC;

/** Только активная игра/тест владеет фоном. Последний владелец останавливает музыку при уходе. */
export function enterActivityMusic(owner: symbol, track: MusicTrack) {
  loadMusicPreference();
  musicOwner = owner;
  publishMusic({ track, unavailable: false });
  void resumeMusic();
}
export function exitActivityMusic(owner: symbol) {
  if (musicOwner !== owner) return;
  musicOwner = null;
  pauseMusic();
}
export function setMusicEnabled(enabled: boolean) {
  loadMusicPreference();
  publishMusic({ enabled, unavailable: false });
  try { window.localStorage.setItem(MUSIC_STORAGE_KEY, enabled ? "on" : "off"); } catch { /* настройка действует в текущей вкладке */ }
  if (enabled) void resumeMusic(); else pauseMusic();
}
export function setMusicTrack(track: MusicTrack) {
  publishMusic({ track, unavailable: false });
  if (musicSnapshot.enabled) void resumeMusic();
}
