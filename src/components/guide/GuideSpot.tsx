"use client";

import { useEffect } from "react";
import { create } from "zustand";

// Метки «где мы» для Бита-проводника: путь страницы не отличает урок «Учиться» от «Проверить себя» и плеер от итогов,
// поэтому экран сам ставит метку, пока он на экране. Не прогресс ученика — в localStorage не сохраняется.

interface Spots {
  /**
   * Плеер урока в режиме «Учиться»: цена входа в сердечках (для реплики «Вход в урок списал {n} сердечко») и сколько
   * списано на этом входе (0 — вход уже был оплачен: «Вход в этот урок уже оплачен»; нет — считаем, что списана цена).
   */
  lesson: { cost: number; paid?: number } | null;
  /** Итоги урока («Учиться», не «Проверить себя»). */
  results: boolean;
}

export const useGuideSpots = create<Spots>(() => ({ lesson: null, results: false }));

/** Метка экрана для проводника: пока компонент на экране, GuideHost знает, что это урок или итоги урока. */
export function GuideSpot(props: { kind: "lesson"; cost: number; paid?: number } | { kind: "results" }) {
  const cost = props.kind === "lesson" ? props.cost : 0;
  const paid = props.kind === "lesson" ? props.paid : undefined;
  const { kind } = props;
  useEffect(() => {
    if (kind === "lesson") useGuideSpots.setState({ lesson: { cost, paid } });
    else useGuideSpots.setState({ results: true });
    return () => {
      if (kind === "lesson") useGuideSpots.setState({ lesson: null });
      else useGuideSpots.setState({ results: false });
    };
  }, [kind, cost, paid]);
  return null;
}
