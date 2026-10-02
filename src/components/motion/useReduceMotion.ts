"use client";

import { useReducedMotion } from "motion/react";
import { useApp } from "@/lib/store";

/** true — анимации нужно упростить: включено «Меньше анимаций» или это просит система. */
export function useReduceMotion(): boolean {
  const pref = useApp((s) => s.profile.reduceMotion);
  const system = useReducedMotion();
  return pref || !!system;
}
