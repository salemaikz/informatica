"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CoinsTool } from "@/components/scenes/explore/CoinsTool";
import { GoalBanner } from "@/components/scenes/explore/GoalBanner";
import { LampsTool, type SandboxState } from "@/components/scenes/explore/LampsTool";
import { WeightsTool } from "@/components/scenes/explore/WeightsTool";
import { clampLamps, goalReached } from "@/components/scenes/logic";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import type { ExploreStep } from "@/lib/types";

/** Стабильная ссылка на колбэк родителя: эффекты не перезапускаются, даже если родитель каждый раз создаёт новую функцию. */
function useStableCallback<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

function Sandbox({ step, onGoalChange }: { step: ExploreStep; onGoalChange: (reached: boolean) => void }) {
  const { l } = useT();
  const notify = useStableCallback(onGoalChange);
  const goal = step.goal;
  // Цель «защёлкивается»: достигнутое не пропадает, если ученик продолжит играть.
  const initialReached = !goal || goalReached(step.tool, goal.target, { lamps: clampLamps(step.size), sum: 0 });
  const [reached, setReached] = useState(initialReached);

  // Сообщаем плееру исходное состояние: без цели «Продолжить» доступно сразу.
  useEffect(() => {
    notify(initialReached);
  }, [notify, initialReached]);

  const onState = (s: SandboxState) => {
    if (!goal || reached) return;
    if (goalReached(step.tool, goal.target, s)) {
      setReached(true);
      notify(true);
      feedback("correct");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {goal && <GoalBanner text={l(goal.text)} reached={reached} />}
      <div className="rounded-3xl bg-surface-2/60 px-3 py-5">
        {step.tool === "lamps" && <LampsTool size={step.size} onChange={onState} />}
        {step.tool === "weights" && <WeightsTool size={step.size} target={goal?.target} onChange={onState} />}
        {step.tool === "coins" && <CoinsTool size={step.size} target={goal?.target} onChange={onState} />}
      </div>
    </div>
  );
}

/**
 * Песочница урока (без оценки): лампы, лампы с весами, монеты. Заголовок и текст шага рисует плеер.
 * onGoalChange(true) — цель достигнута (или цели нет вовсе).
 */
export function ExploreView({ step, onGoalChange }: { step: ExploreStep; onGoalChange: (reached: boolean) => void }) {
  // key: при переходе к другой песочнице состояние начинается заново.
  return <Sandbox key={step.id} step={step} onGoalChange={onGoalChange} />;
}
