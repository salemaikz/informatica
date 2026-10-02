"use client";

import { DoorOpen } from "lucide-react";
import { m } from "motion/react";
import type { StoryStep } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { Pill } from "@/components/ui/Pill";
import { SceneView } from "@/components/scenes/SceneView";
import { springSoft } from "@/components/motion/presets";

/** Ситуация («квест-комната»): картинка-сцена и реплика Бита или рассказчика в «облачке». */
export function StoryView({ step }: { step: StoryStep }) {
  const { t, l } = useT();
  const bit = step.speaker === "bit";

  return (
    <div className="flex flex-col gap-4">
      <Pill tone="primary" className="self-start" icon={<DoorOpen size={14} />}>
        {t("lesson.story")}
      </Pill>
      {step.title && <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>}
      <SceneView scene={step.scene} />
      <m.div
        className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.12 }}
      >
        {bit && <Mascot mood="happy" size={64} className="ml-1 size-10 shrink-0 sm:ml-0 sm:size-16" />}
        <div
          className={cn(
            "relative w-full min-w-0 rounded-2xl px-4 py-3 sm:w-auto sm:flex-1",
            bit ? "border-2 border-border bg-surface sm:mb-2" : "border-l-4 border-primary bg-surface-2",
          )}
        >
          {bit && (
            <span
              aria-hidden
              className="absolute -top-[9px] left-4 h-4 w-4 rotate-45 border-l-2 border-t-2 border-border bg-surface sm:-left-[9px] sm:top-auto sm:bottom-4 sm:border-t-0 sm:border-b-2"
            />
          )}
          <Markdown className={cn("relative text-[17px]", bit && "font-semibold")}>{l(step.body)}</Markdown>
        </div>
      </m.div>
    </div>
  );
}
