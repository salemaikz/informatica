"use client";

import { BookOpen, ClipboardCheck, Clock, Dumbbell, Lock, Play, Star } from "lucide-react";
import { useMemo, useState } from "react";
import type { EntTopicId } from "@/lib/types";
import { ENT_TOPICS, type EntTopic } from "@/content/ent-topics";
import { LESSONS, UNITS, lessonNumber } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { masteryLevel } from "@/lib/mastery";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ICONS } from "@/components/scenes/icons";
import { nodeState, pluralForm, topicLessons, topicMastery, topicSkillIds, type NodeState, type TopicLevel } from "./map";
import { unitVars } from "./useLearn";

// Вид «Карта ЕНТ»: 13 тем ЕНТ плитками. Размер плитки — вес темы на ЕНТ, цвет — освоение (семантика CLAUDE.md).

const TONE: Record<TopicLevel, { tile: string; ink: string; bar: string; dot: string }> = {
  none: { tile: "border-border bg-surface", ink: "text-muted", bar: "var(--border)", dot: "bg-border" },
  weak: { tile: "border-danger/40 bg-danger-soft", ink: "text-danger", bar: "var(--danger)", dot: "bg-danger" },
  progress: { tile: "border-warning/50 bg-warning-soft", ink: "text-warning-strong", bar: "var(--warning)", dot: "bg-warning" },
  mastered: { tile: "border-success/40 bg-success-soft", ink: "text-success-strong", bar: "var(--success)", dot: "bg-success" },
};

const LEVELS: TopicLevel[] = ["none", "weak", "progress", "mastered"];

/** Иконка темы — иконка раздела, в который она входит. */
function topicIcon(id: EntTopicId) {
  const unit = UNITS.find((u) => u.entTopics?.includes(id));
  return unit?.icon ? ICONS[unit.icon] : BookOpen;
}

/** Плитка: ≥ 5 заданий — на всю ширину, 4 — двойная высота. */
function tileSpan(t: EntTopic): string {
  if (t.examCount >= 5) return "col-span-2";
  if (t.examCount >= 4) return "row-span-2";
  return "";
}

function Legend() {
  const { t } = useT();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {LEVELS.map((lv) => (
        <li key={lv} className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <span className={cn("h-3 w-3 rounded-full", TONE[lv].dot)} />
          {t(`learn2.legend.${lv}`)}
        </li>
      ))}
    </ul>
  );
}

const STATE_ICON: Record<NodeState, { icon: typeof Star; cls: string }> = {
  done: { icon: Star, cls: "bg-gold text-white" },
  due: { icon: Clock, cls: "bg-streak text-white" },
  recommended: { icon: Play, cls: "bg-(--u-fill) text-white" },
  available: { icon: Play, cls: "bg-(--u-fill) text-white" },
  soon: { icon: Lock, cls: "bg-surface-2 text-muted" },
};

function TopicSheet({
  topicId,
  onClose,
  onLesson,
  recommendedId,
  now,
}: {
  topicId: EntTopicId | null;
  onClose: () => void;
  onLesson: (lessonId: string) => void;
  recommendedId: string | undefined;
  now: number;
}) {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const lessons = useApp((s) => s.lessons);
  const [shown, setShown] = useState(topicId);
  if (topicId && topicId !== shown) setShown(topicId);
  const topic = shown ? ENT_TOPICS.find((x) => x.id === shown) : undefined;

  return (
    <Modal open={!!topicId} onClose={onClose} label={topic ? l(topic.title) : ""}>
      {topic &&
        (() => {
          const skillIds = topicSkillIds(topic.id, SKILLS);
          const { value, level } = topicMastery(skillIds, skills);
          const list = topicLessons(topic.id, UNITS, LESSONS, SKILLS);
          const Icon = topicIcon(topic.id);
          const firstSkill = skillIds[0];
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 pr-2">
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2", TONE[level].tile, TONE[level].ink)}>
                  <Icon size={24} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t(`learn2.ent.items.${pluralForm(topic.examCount)}`, { n: topic.examCount })}</p>
                  <h3 className="text-xl font-extrabold leading-tight">{l(topic.title)}</h3>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm font-extrabold">
                  <span>{t("learn2.topic.mastery", { n: Math.round(value * 100) })}</span>
                  <span className={TONE[level].ink}>{t(`learn2.legend.${level}`)}</span>
                </div>
                <ProgressBar value={value} color={TONE[level].bar} height={10} />
              </div>

              {skillIds.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("learn2.topic.skills")}</p>
                  <ul className="flex flex-col gap-1.5">
                    {skillIds.map((id) => {
                      const sk = SKILLS.find((s) => s.id === id)!;
                      const st = skills[id];
                      const lv = masteryLevel(st);
                      const tone = TONE[lv === "new" ? "none" : lv];
                      return (
                        <li key={id} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{l(sk.title)}</span>
                          <span className="w-20 shrink-0">
                            <ProgressBar value={st?.attempts ? st.mastery : 0} color={tone.bar} height={8} />
                          </span>
                          <span className={cn("w-9 shrink-0 text-right text-xs font-black", tone.ink)}>{st?.attempts ? `${Math.round(st.mastery * 100)}%` : "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {list.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("learn2.topic.lessons")}</p>
                  <ul className="flex flex-col gap-1.5">
                    {list.map(({ unit, ref }) => {
                      const st = nodeState(ref, lessons[ref.id], recommendedId, now);
                      const { icon: SIcon, cls } = STATE_ICON[st];
                      return (
                        <li key={ref.id} style={unitVars(unit.color)}>
                          <button
                            type="button"
                            onClick={() => onLesson(ref.id)}
                            aria-label={t("learn2.node.aria", { n: lessonNumber(ref.id), title: l(ref.title), state: t(`learn2.state.${st}`) })}
                            className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface p-2 text-left hover:bg-surface-2"
                          >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}>
                              <SIcon size={16} fill={st === "soon" || st === "due" ? "none" : "currentColor"} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted">{t("learn.lesson", { n: lessonNumber(ref.id) })}</span>
                              <span className={cn("line-clamp-2 text-sm font-extrabold leading-snug", st === "soon" && "text-muted")}>{l(ref.title)}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <ButtonLink href={`/exam/run?kind=topic&topics=${topic.id}`} block icon={<ClipboardCheck size={18} />}>
                  {t("learn2.topic.test")}
                </ButtonLink>
                {firstSkill && (
                  <ButtonLink href={`/drill?mode=topic&topic=${topic.id}`} variant="secondary" block icon={<Dumbbell size={18} />}>
                    {t("learn2.topic.train")}
                  </ButtonLink>
                )}
              </div>
            </div>
          );
        })()}
    </Modal>
  );
}

export function EntMap({ recommendedId, now, onLesson }: { recommendedId: string | undefined; now: number; onLesson: (lessonId: string) => void }) {
  const { t, l, lang } = useT();
  const skills = useApp((s) => s.skills);
  const [topic, setTopic] = useState<EntTopicId | null>(null);
  const tiles = useMemo(
    () =>
      ENT_TOPICS.map((tp) => ({
        topic: tp,
        lessons: topicLessons(tp.id, UNITS, LESSONS, SKILLS).length,
        ...topicMastery(topicSkillIds(tp.id, SKILLS), skills),
      })),
    [skills],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("learn2.ent.title")}</h2>
        <p className="text-sm font-semibold text-muted">{t("learn2.ent.hint")}</p>
        <Legend />
      </div>
      <div className="grid grid-flow-row-dense auto-rows-[minmax(7.5rem,auto)] grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(({ topic: tp, lessons, value, level }, i) => {
          const Icon = topicIcon(tp.id);
          const pct = Math.round(value * 100);
          // level «none» = ни одной попытки по навыкам темы: вместо «0%» показываем «—».
          const hasData = level !== "none";
          const pctText = hasData ? `${pct}%` : "—";
          const tall = tp.examCount === 4;
          return (
            <button
              key={tp.id}
              type="button"
              onClick={() => setTopic(tp.id)}
              aria-label={hasData ? t("learn2.ent.open", { title: l(tp.title), n: pct }) : t("learn2.ent.open.none", { title: l(tp.title) })}
              style={{ animationDelay: `${i * 35}ms` }}
              className={cn(
                "animate-rise-in flex flex-col gap-2 rounded-3xl border-2 p-3.5 text-left transition-transform active:scale-[0.98]",
                TONE[level].tile,
                tileSpan(tp),
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-surface/70", TONE[level].ink)}>
                  <Icon size={19} />
                </span>
                <span className="flex gap-1" aria-hidden>
                  {Array.from({ length: tp.examCount }, (_, k) => (
                    <span key={k} className={cn("h-1.5 w-1.5 rounded-full", TONE[level].dot, level === "none" && "bg-muted/40")} />
                  ))}
                </span>
              </div>
              <span lang={lang} className={cn("hyphens-auto font-extrabold leading-tight [overflow-wrap:anywhere]", tp.examCount >= 4 ? "text-base" : "text-[15px]", tall ? "line-clamp-5" : "line-clamp-4")}>{l(tp.title)}</span>
              <div className="mt-auto flex flex-col gap-1.5">
                {tall || tp.examCount >= 5 ? (
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-3xl font-black leading-none", TONE[level].ink)}>{pctText}</span>
                    {!hasData && <span className="text-xs font-bold text-muted">{t("learn2.ent.nodata")}</span>}
                  </span>
                ) : null}
                <ProgressBar value={value} color={TONE[level].bar} height={6} />
                <span className="flex flex-wrap items-center justify-between gap-x-2 text-xs font-bold text-muted">
                  <span>{t(`learn2.ent.items.${pluralForm(tp.examCount)}`, { n: tp.examCount })}</span>
                  <span>
                    {tp.examCount < 4 && (
                      <span className={cn("font-black", TONE[level].ink)}>
                        {pctText}
                        {!hasData && <span className="font-bold text-muted"> {t("learn2.ent.nodata")}</span>}
                        {" · "}
                      </span>
                    )}
                    {t(`learn2.ent.lessons.${pluralForm(lessons)}`, { n: lessons })}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <TopicSheet
        topicId={topic}
        onClose={() => setTopic(null)}
        onLesson={(id) => {
          setTopic(null);
          onLesson(id);
        }}
        recommendedId={recommendedId}
        now={now}
      />
    </div>
  );
}
