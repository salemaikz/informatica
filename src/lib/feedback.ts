"use client";

import { useApp } from "@/lib/store";
import { playSound } from "@/lib/sound";

// Единая точка «отклика» на действия ученика: звук + вибрация по настройкам профиля.

export type FeedbackKind = "correct" | "wrong" | "combo" | "complete" | "levelUp" | "tap" | "xp" | "pop" | "perfect" | "chips" | "streak" | "caseTick" | "caseReveal";

/** Паттерны вибрации, мс (вибро, пауза, вибро…). Для tap/xp/pop вибрации нет. */
const PATTERNS: Partial<Record<FeedbackKind, number[]>> = {
  correct: [12],
  wrong: [40, 60, 40],
  combo: [10, 30, 10],
  complete: [20, 40, 20, 40, 60],
  levelUp: [30, 50, 30, 50, 90],
  perfect: [20, 40, 20, 40, 80],
  streak: [15, 30, 15],
  caseReveal: [25, 40, 60],
};

export function feedback(kind: FeedbackKind, opts?: { step?: number; combo?: number }) {
  try {
    const { profile } = useApp.getState();
    if (profile.sound) playSound(kind, { step: opts?.step ?? opts?.combo });
    const pattern = PATTERNS[kind];
    if (pattern && profile.vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // отклик — не критично
  }
}
