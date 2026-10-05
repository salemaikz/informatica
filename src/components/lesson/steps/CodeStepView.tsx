"use client";

import dynamic from "next/dynamic";
import type { CodeStep } from "@/lib/types";
import type { StepProps } from "./types";

// Задача практикума на Python внутри урока (этап 14, пакет P4): редактор, «Проверить код», «Стоп», подсказка, эталон.
// Редактор и банк задач практикума тяжёлые — грузятся отдельным куском, только когда в уроке дошли до шага `code`.
const Inner = dynamic(() => import("./CodeStepInner"), {
  ssr: false,
  loading: () => <div role="status" aria-busy="true" className="h-64 animate-pulse rounded-3xl border-2 border-border bg-surface-2" />,
});

export function CodeStepView(props: StepProps<CodeStep>) {
  return <Inner {...props} />;
}
