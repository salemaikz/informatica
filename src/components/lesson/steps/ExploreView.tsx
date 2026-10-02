"use client";

import type { ExploreStep } from "@/lib/types";

// ВРЕМЕННАЯ заглушка: настоящую песочницу делает исполнитель этапа 2.
/** Песочница урока. onGoalChange(true) — цель достигнута (или цели нет). */
export function ExploreView({ step, onGoalChange }: { step: ExploreStep; onGoalChange: (reached: boolean) => void }) {
  void onGoalChange;
  return <div data-explore={step.tool} className="rounded-3xl bg-surface-2 p-4 text-center text-sm text-muted">{step.tool}</div>;
}
