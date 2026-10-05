"use client";

import type { EntMatchStep } from "@/lib/types";
import type { StepProps } from "./types";

// ЗАГЛУШКА каркаса этапа 14 — реализует пакет P3 (docs/specs/stage14.md).
/** «Соответствие» как на ЕНТ: пункты A и B, у каждого выбрать одно из 4 описаний. */
export function EntMatchView({ step }: StepProps<EntMatchStep>) {
  return <div data-step-kind="entmatch" data-items={step.items.length} />;
}
