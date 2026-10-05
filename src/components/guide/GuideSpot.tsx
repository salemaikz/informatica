"use client";

import { useEffect } from "react";
import { create } from "zustand";

// Метки «где мы» для Бита-проводника: путь страницы не отличает урок «Учиться» от «Проверить себя» и плеер от итогов,
// поэтому экран сам ставит метку, пока он на экране. Не прогресс ученика — в localStorage не сохраняется.

interface Spots {
  /** Плеер урока в режиме «Учиться»: цена входа в сердечках (для реплики «Вход в урок списал {n} сердечко»). */
  lesson: { cost: number } | null;
  /** Итоги урока («Учиться», не «Проверить себя»). */
  results: boolean;
}

export const useGuideSpots = create<Spots>(() => ({ lesson: null, results: false }));

/** Метка экрана для проводника: пока компонент на экране, GuideHost знает, что это урок или итоги урока. */
export function GuideSpot(props: { kind: "lesson"; cost: number } | { kind: "results" }) {
  const cost = props.kind === "lesson" ? props.cost : 0;
  const { kind } = props;
  useEffect(() => {
    if (kind === "lesson") useGuideSpots.setState({ lesson: { cost } });
    else useGuideSpots.setState({ results: true });
    return () => {
      if (kind === "lesson") useGuideSpots.setState({ lesson: null });
      else useGuideSpots.setState({ results: false });
    };
  }, [kind, cost]);
  return null;
}
