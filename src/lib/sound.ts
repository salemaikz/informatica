"use client";

// Короткие звуки через Web Audio — без аудиофайлов, ноль трафика.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type SoundName = "correct" | "wrong" | "complete" | "tap";

export function playSound(name: SoundName) {
  try {
    switch (name) {
      case "correct":
        tone(660, 0, 0.12, "sine");
        tone(990, 0.09, 0.18, "sine");
        break;
      case "wrong":
        tone(220, 0, 0.18, "triangle", 0.14);
        tone(180, 0.12, 0.22, "triangle", 0.12);
        break;
      case "complete":
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.25, "sine", 0.1));
        break;
      case "tap":
        tone(880, 0, 0.05, "sine", 0.05);
        break;
    }
  } catch {
    // звук — не критично
  }
}
