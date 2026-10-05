"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { WifiOff } from "lucide-react";
import type { CodeStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import type { StepProps } from "./types";

// Задача практикума на Python внутри урока (этап 14, пакет P4): редактор, «Проверить код», «Стоп», эталон.
// Редактор и банк задач практикума тяжёлые — грузятся отдельным куском. Плеер заранее подгружает кусок, если в уроке есть
// шаг `code` (preloadCodeStep); если сеть всё же пропала — не роняем урок, а показываем «нет сети» и кнопку «Пропустить» плеера.
const load = () => import("./CodeStepInner");
const Inner = dynamic(load, {
  ssr: false,
  loading: () => <div role="status" aria-busy="true" className="h-64 animate-pulse rounded-3xl border-2 border-border bg-surface-2" />,
});

/** Подгрузить кусок шага заранее (вызывает плеер при открытии урока с задачей на код). */
export function preloadCodeStep(): void {
  void load().catch(() => {});
}

function LoadFail() {
  const { t } = useT();
  return (
    <div role="alert" className="flex items-start gap-3 rounded-3xl border-2 border-warning/40 bg-warning-soft p-4">
      <WifiOff size={20} className="mt-0.5 shrink-0 text-warning-strong" aria-hidden />
      <p className="font-semibold">{t("iderun.code.loadFail", { skip: t("common.skip") })}</p>
    </div>
  );
}

/** Ловит сбой загрузки куска (нет сети): без этого падал бы весь урок. */
class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <LoadFail /> : this.props.children;
  }
}

export function CodeStepView(props: StepProps<CodeStep>) {
  return (
    <LoadBoundary key={props.step.id}>
      <Inner {...props} />
    </LoadBoundary>
  );
}
