"use client";

import { BookOpen, Check, Clapperboard, Hand, ListOrdered, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { ExploreStep, InfoStep, TheoryStep, WorkedStep } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ExploreView } from "@/components/lesson/steps/ExploreView";
import { StoryView } from "@/components/lesson/steps/StoryView";
import { WorkedView } from "@/components/lesson/steps/WorkedView";
import { SceneView } from "@/components/scenes/SceneView";
import { Visual } from "@/components/visuals/Visuals";
import { LessonVideo } from "@/videos/LessonVideo";

export type WorkedMode = "all" | "steps";

/** Кнопка «Непонятно? Спроси Бита» (фиолетовая — всё, что делает ИИ). */
export function AskBit({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 items-center gap-1.5 self-start rounded-xl bg-ai-soft px-3 py-2 text-left text-sm font-extrabold text-ai hover:brightness-95"
    >
      <Sparkles size={16} className="shrink-0" aria-hidden /> {label ?? t("tutor.askInline")}
    </button>
  );
}

function BlockHead({ icon, label, title }: { icon: ReactNode; label: string; title: string }) {
  return (
    <>
      <Pill tone="primary" className="self-start" icon={icon}>
        {label}
      </Pill>
      <h2 className="text-2xl font-extrabold">{title}</h2>
    </>
  );
}

function TheoryBlock({ step }: { step: TheoryStep }) {
  const { t, l } = useT();
  return (
    <>
      <BlockHead icon={<BookOpen size={14} />} label={t("lesson.theory")} title={l(step.title)} />
      {step.scene && <SceneView scene={step.scene} />}
      {step.visual && <Visual id={step.visual} />}
      <Markdown className="text-[17px]">{l(step.body)}</Markdown>
    </>
  );
}

/** «Всё сразу»: все подшаги раскрыты, у каждого своя сцена под текстом. */
function WorkedAll({ step }: { step: WorkedStep }) {
  const { t, l } = useT();
  return (
    <>
      <BlockHead icon={<ListOrdered size={14} />} label={t("lesson.worked")} title={l(step.title)} />
      <ol className="flex flex-col gap-3">
        {step.steps.map((s, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-2xl bg-surface-2/60 px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">{i + 1}</span>
              <Markdown className="min-w-0 flex-1 text-[17px]">{l(s.text)}</Markdown>
            </div>
            {s.scene && <SceneView scene={s.scene} />}
          </li>
        ))}
      </ol>
      {step.result && <WorkedResult text={l(step.result)} />}
    </>
  );
}

function WorkedResult({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-success/30 bg-success-soft px-4 py-3 text-success-strong">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Check size={16} strokeWidth={3.5} />
      </span>
      <Markdown className="min-w-0 flex-1 text-[17px] font-bold">{text}</Markdown>
    </div>
  );
}

/** «По шагам»: как в уроке — шаги открываются по кнопке, сцена меняется вместе с шагом. */
function WorkedSteps({ step, revealed, onReveal }: { step: WorkedStep; revealed: number; onReveal: () => void }) {
  const { t } = useT();
  const more = revealed < step.steps.length;
  return (
    <>
      <WorkedView step={step} revealed={revealed} />
      {more && (
        <Button size="md" onClick={onReveal} className="self-start">
          {t("lesson.nextStep")}
        </Button>
      )}
    </>
  );
}

const noop = () => {};

/** Песочница без цели: работает как в уроке, но «Продолжить» не нужно — просто пробуй. */
function ExploreBlock({ step }: { step: ExploreStep }) {
  const { t, l } = useT();
  const free: ExploreStep = { ...step, goal: undefined };
  return (
    <>
      <BlockHead icon={<Hand size={14} />} label={t("lesson.explore")} title={l(step.title)} />
      {step.body && <Markdown className="text-[17px]">{l(step.body)}</Markdown>}
      <ExploreView step={free} onGoalChange={noop} />
    </>
  );
}

/**
 * Один информационный блок урока. id = id шага — на него ведут ссылки из поиска (`/theory/<урок>#<шаг>`).
 * revealed/onReveal — только для разборов в режиме «по шагам».
 */
export function InfoBlock({
  step,
  mode,
  revealed,
  onReveal,
  onAsk,
}: {
  step: InfoStep;
  mode: WorkedMode;
  revealed: number;
  onReveal: () => void;
  onAsk: () => void;
}) {
  const { t, l } = useT();
  return (
    <section id={step.id} className={cn("scroll-mt-20 flex flex-col gap-4 rounded-3xl border-2 border-border bg-surface p-4 sm:p-5")}>
      {step.type === "theory" && <TheoryBlock step={step} />}
      {step.type === "story" && <StoryView step={step} />}
      {step.type === "worked" && (mode === "all" ? <WorkedAll step={step} /> : <WorkedSteps step={step} revealed={revealed} onReveal={onReveal} />)}
      {step.type === "explore" && <ExploreBlock step={step} />}
      {step.type === "video" && (
        <>
          <BlockHead icon={<Clapperboard size={14} />} label={t("lesson.video")} title={l(step.title)} />
          <VideoBlock step={step} />
        </>
      )}
      {step.type !== "video" && <AskBit onClick={onAsk} />}
    </section>
  );
}

function VideoBlock({ step }: { step: Extract<InfoStep, { type: "video" }> }) {
  const { l, lang } = useT();
  return <LessonVideo videoId={step.videoId} lang={lang} title={l(step.title)} />;
}
