"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";

/**
 * Один раз на приложение: лёгкий набор возможностей motion (компоненты `m.*`)
 * и общая политика «меньше анимаций» — настройка профиля или системная.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduce = useApp((s) => s.profile.reduceMotion);
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>
    </LazyMotion>
  );
}
