"use client";

import type { CodeStep } from "@/lib/types";
import type { StepProps } from "./types";

// ЗАГЛУШКА каркаса этапа 14 — реализует пакет P4 (docs/specs/stage14.md).
/** Задача практикума на Python внутри урока: редактор, «Проверить код», итог — onAnswer({type:"code"…}, {submit:true}). */
export function CodeStepView({ step }: StepProps<CodeStep>) {
  return <div data-step-kind="code" data-task={step.task} />;
}
