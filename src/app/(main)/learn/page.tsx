"use client";

import clsx from "clsx";
import { Camera, Check, Clapperboard, Clock, Hammer, Lock, Play, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import type { LessonRef, Unit } from "@/lib/types";
import { UNITS, getLesson, lessonNumber } from "@/content/course";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MascotSays } from "@/components/mascot/Mascot";
import { DailyGoalCard, WeakTopicsCard } from "@/components/app/Widgets";

// Главная: приветствие, «продолжить», карта курса в стиле тропинки.

const OFFSETS = [0, 44, 64, 44, 0, -44, -64, -44];

function nextLesson(completed: Record<string, unknown>): LessonRef | undefined {
  for (const u of UNITS) for (const l of u.lessons) if (l.status === "available" && !completed[l.id]) return l;
  return undefined;
}

export default function LearnPage() {
  const { t, l } = useT();
  const name = useApp((s) => s.profile.name);
  const lessons = useApp((s) => s.lessons);
  const [picked, setPicked] = useState<{ unit: Unit; lesson: LessonRef } | null>(null);
  const upcoming = nextLesson(lessons);
  const firstAvailable = UNITS[0].lessons[0];
  const hero = upcoming ?? firstAvailable;
  const heroLesson = getLesson(hero.id);

  return (
    <div className="flex flex-col gap-5">
      <MascotSays mood="happy">
        <span className="block text-lg font-extrabold">{name ? t("learn.greeting", { name }) : t("learn.hello")}</span>
        <span className="text-muted">
          {Object.keys(lessons).length === 0 ? t("learn.startFirst") : upcoming ? t("learn.continue") : t("learn.allDone")}
        </span>
      </MascotSays>

      <div className="xl:hidden">
        <DailyGoalCard compact />
      </div>

      {heroLesson && (
        <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-surface">
          <div className="flex items-center gap-2 bg-primary px-5 py-2 text-sm font-extrabold text-white">
            {t("learn.lesson", { n: lessonNumber(hero.id) })}
            {lessons[hero.id] && (
              <span className="ml-auto flex items-center gap-1">
                <Check size={16} /> {t("learn.best", { n: Math.round(lessons[hero.id].bestAccuracy * 100) })}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 p-5">
            <h2 className="text-2xl font-extrabold">{l(heroLesson.title)}</h2>
            <p className="font-semibold text-muted">{l(heroLesson.description)}</p>
            <div className="flex flex-wrap gap-3 text-sm font-bold text-muted">
              <span className="flex items-center gap-1">
                <Clock size={16} /> {t("common.minutes", { n: heroLesson.durationMin })}
              </span>
              <span>· {t("learn.steps", { n: heroLesson.steps.length })}</span>
              {heroLesson.steps.some((step) => step.type === "video") && <span className="flex items-center gap-1">
                · <Clapperboard size={16} /> {t("lesson.video")}
              </span>}
              <span className="flex items-center gap-1">
                · <Camera size={16} /> {t("learn.photoCheck")}
              </span>
              <span className="flex items-center gap-1 text-ai">
                · <Sparkles size={16} /> {t("fb.ai.short")}
              </span>
            </div>
            <ButtonLink href={`/lesson/${hero.id}`} className="mt-1" size="lg" block icon={<Play size={20} fill="currentColor" />}>
              {lessons[hero.id] ? t("learn.repeat") : t("common.start")}
            </ButtonLink>
          </div>
        </div>
      )}

      <div className="xl:hidden">
        <WeakTopicsCard />
      </div>

      {UNITS.map((unit, ui) => (
        <section key={unit.id} className="flex flex-col gap-4">
          <div className="rounded-3xl px-5 py-4 text-white" style={{ background: unit.color }}>
            <p className="text-xs font-extrabold uppercase opacity-80">{t("learn.unit", { n: ui + 1 })}</p>
            <h3 className="text-xl font-extrabold">{l(unit.title)}</h3>
            <p className="text-sm font-semibold opacity-90">{l(unit.description)}</p>
          </div>
          <div className="flex flex-col items-center gap-5 py-2">
            {unit.lessons.map((ref, i) => {
              const done = !!lessons[ref.id];
              const current = ref.id === upcoming?.id;
              const soon = ref.status === "soon";
              return (
                <div key={ref.id} className="flex flex-col items-center gap-1.5" style={{ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` }}>
                  <button
                    type="button"
                    onClick={() => setPicked({ unit, lesson: ref })}
                    aria-label={l(ref.title)}
                    className={clsx(
                      "relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-b-[6px] transition-transform active:translate-y-1 active:border-b-2",
                      soon && "border-border bg-surface-2 text-muted",
                      done && "border-warning-strong bg-gold text-white",
                      !soon && !done && "text-white",
                      current && "animate-pulse-ring",
                    )}
                    style={!soon && !done ? { background: unit.color, borderColor: "rgba(0,0,0,0.25)" } : undefined}
                  >
                    {soon ? <Lock size={26} /> : done ? <Star size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
                    {current && (
                      <span className="absolute -top-9 whitespace-nowrap rounded-xl border-2 border-border bg-surface px-2.5 py-1 text-xs font-extrabold text-primary shadow-sm">
                        {t("common.start")}
                      </span>
                    )}
                  </button>
                  <span className={clsx("max-w-40 text-center text-sm font-bold", soon ? "text-muted" : "text-text")}>{l(ref.title)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Modal open={!!picked} onClose={() => setPicked(null)} label={picked ? l(picked.lesson.title) : ""}>
        {picked && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-extrabold" style={{ color: picked.unit.color }}>
              {t("learn.lesson", { n: lessonNumber(picked.lesson.id) })} · {l(picked.unit.title)}
            </p>
            <h3 className="text-2xl font-extrabold">{l(picked.lesson.title)}</h3>
            {picked.lesson.status === "soon" ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-muted">
                  <Hammer size={18} /> {t("learn.soon")}
                </p>
                <Button variant="secondary" block onClick={() => setPicked(null)}>
                  {t("common.close")}
                </Button>
              </>
            ) : (
              <>
                {getLesson(picked.lesson.id) && <p className="font-semibold text-muted">{l(getLesson(picked.lesson.id)!.description)}</p>}
                <ButtonLink href={`/lesson/${picked.lesson.id}`} size="lg" block icon={<Play size={20} fill="currentColor" />}>
                  {lessons[picked.lesson.id] ? t("learn.repeat") : t("common.start")}
                </ButtonLink>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
