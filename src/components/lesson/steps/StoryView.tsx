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
        className="flex items-end gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.12 }}
      >
        {bit && <Mascot mood="happy" size={64} className="shrink-0" />}
        <div
          className={cn(
            "relative min-w-0 flex-1 rounded-2xl px-4 py-3",
            bit ? "mb-2 border-2 border-border bg-surface" : "border-l-4 border-primary bg-surface-2",
          )}
        >
          {bit && (
            <span aria-hidden className="absolute -left-[9px] bottom-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-border bg-surface" />
          )}
          <Markdown className={cn("relative text-[17px]", bit && "font-semibold")}>{l(step.body)}</Markdown>
        </div>
      </m.div>
    </div>
  );
}
