"use client";

import { ChevronRight, ClipboardCheck, Link2, ListChecks, Play, Timer, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ENT_TOPICS } from "@/content/ent-topics";
import { ENT_POOL } from "@/content/ent";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { loadActiveAttempt, type ExamAttempt } from "@/lib/exam-store";
import type { ExamKind } from "@/lib/exam";
import { isAnswered } from "@/lib/exam";
import { forecastScore, MAX_SCORE } from "@/lib/forecast";
import { useApp } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ExamChart } from "./ExamChart";
import { EXAM_FORMAT, examLink, historyPoints, randomSeed, ratioOf, toneOf, toggleTopic, MAX_TOPIC_PICK } from "./logic";

/** Сколько заданий каждой темы в банке (вопросы контекстных считаем по одному). */
function poolCounts(): Record<EntTopicId, number> {
  const out = Object.fromEntries(ENT_TOPICS.map((tp) => [tp.id, 0])) as Record<EntTopicId, number>;
  for (const it of ENT_POOL) out[it.topic] += it.kind === "context" ? it.questions.length : 1;
  return out;
}

const MODE_ICON: Record<ExamKind, LucideIcon> = { mini: Zap, full: ClipboardCheck, topic: ListChecks };
const TONE_PILL = { danger: "danger", warning: "warning", success: "success" } as const;
const HISTORY_SHOWN = 6;

function ModeCard({
  kind,
  disabled,
  onStart,
  children,
}: {
  kind: ExamKind;
  disabled?: boolean;
  onStart: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useT();
  const Icon = MODE_ICON[kind];
  const f = EXAM_FORMAT[kind];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={26} strokeWidth={2.3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight">{t(`exam.mode.${kind}` as DictKey)}</h2>
          <p className="text-sm font-semibold text-muted">{t(`exam.mode.${kind}.desc` as DictKey)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="muted">{t("exam.fmt.questions", { n: f.questions })}</Pill>
        <Pill tone="muted" icon={<Timer size={12} aria-hidden />}>
          {t("common.minutes", { n: f.minutes })}
        </Pill>
        {kind === "full" && <Pill tone="muted">{t("exam.fmt.points", { n: f.points })}</Pill>}
      </div>
      {children}
      <Button block icon={<Play size={18} aria-hidden />} disabled={disabled} onClick={onStart}>
        {t("common.start")}
      </Button>
    </Card>
  );
}

export function ExamHub() {
  const { t, l, lang } = useT();
  const router = useRouter();
  const exams = useApp((s) => s.exams);
  const skills = useApp((s) => s.skills);
  const target = useApp((s) => s.profile.targetScore);

  const [topics, setTopics] = useState<EntTopicId[]>([]);
  const [active, setActive] = useState<ExamAttempt | null>(null);
  const [now] = useState(() => Date.now());
  const [showAll, setShowAll] = useState(false);
  const [shareKind, setShareKind] = useState<Extract<ExamKind, "mini" | "full">>("mini");
  const [shared, setShared] = useState<{ url: string; how: "shared" | "copied" | "manual" } | null>(null);

  useEffect(() => {
    let off = false;
    loadActiveAttempt().then((a) => {
      if (!off) setActive(a);
    });
    return () => {
      off = true;
    };
  }, []);

  const counts = useMemo(() => poolCounts(), []);
  const empty = ENT_POOL.length === 0;
  const forecast = useMemo(
    () =>
      forecastScore({
        skills,
        exams: exams.map((e) => ({ at: e.at, points: e.points, maxPoints: e.maxPoints, byTopic: e.byTopic, kind: e.kind })),
        now,
      }),
    [skills, exams, now],
  );
  const points = useMemo(() => historyPoints(exams), [exams]);
  const sorted = useMemo(() => [...exams].sort((a, b) => b.at - a.at), [exams]);
  const rows = showAll ? sorted : sorted.slice(0, HISTORY_SHOWN);
  const dateFmt = (at: number) => new Date(at).toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short" });

  const start = (kind: ExamKind) => router.push(examLink(kind, randomSeed(), kind === "topic" ? topics : []));

  const share = async () => {
    const url = `${window.location.origin}${examLink(shareKind, randomSeed())}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t(`exam.mode.${shareKind}` as DictKey), url });
        setShared({ url, how: "shared" });
        return;
      }
    } catch (e) {
      // Окно «Поделиться» закрыли — это не ошибка.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared({ url, how: "copied" });
    } catch {
      setShared({ url, how: "manual" });
    }
  };

  const activeProgress = active ? active.paper.items.filter((q) => isAnswered(q, active.answers[q.key])).length : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t("exam.title")}</h1>
        <p className="font-semibold text-muted">{t("exam.subtitle")}</p>
      </div>

      {active && (
        <Link
          href="/exam/run"
          className="flex items-center gap-3 rounded-3xl border-2 border-primary/40 bg-primary-soft p-4 transition-transform active:translate-y-0.5"
        >
          <Play size={24} className="shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-primary">{t("exam.resume.title")}</span>
            <span className="block text-sm font-semibold text-muted">
              {t(`exam.mode.${active.kind}` as DictKey)} · {t("exam.resume.progress", { done: activeProgress, total: active.paper.items.length })}
            </span>
          </span>
          <ChevronRight size={20} className="text-primary" aria-hidden />
        </Link>
      )}

      {empty && (
        <p className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-3.5 text-sm font-semibold">{t("exam.empty")}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard kind="mini" disabled={empty} onStart={() => start("mini")} />
        <ModeCard kind="full" disabled={empty} onStart={() => start("full")} />
        <div className="md:col-span-2">
          <ModeCard kind="topic" disabled={empty || topics.length === 0} onStart={() => start("topic")}>
            <div>
              <p className="mb-2 text-sm font-bold text-muted">{t("exam.topic.pick", { max: MAX_TOPIC_PICK })}</p>
              <div className="flex flex-wrap gap-2">
                {ENT_TOPICS.map((tp) => {
                  const on = topics.includes(tp.id);
                  const none = counts[tp.id] === 0;
                  const full = !on && topics.length >= MAX_TOPIC_PICK;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      aria-pressed={on}
                      disabled={none || full}
                      onClick={() => setTopics((cur) => toggleTopic(cur, tp.id))}
                      className={cn(
                        "h-10 rounded-full border-2 px-3.5 text-sm font-extrabold transition-colors",
                        on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:bg-surface-2",
                        (none || full) && "cursor-not-allowed border-dashed opacity-50 hover:bg-surface",
                      )}
                    >
                      {l(tp.short)}
                      <span className="ml-1.5 text-xs font-bold text-muted">{counts[tp.id]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </ModeCard>
        </div>
      </div>

      {/* Прогноз балла */}
      <section>
        <SectionTitle>{t("exam.forecast.title")}</SectionTitle>
        <Card>
          {forecast.basis === "none" ? (
            <p className="font-semibold text-muted">{t("exam.forecast.none")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <p className="text-4xl font-black leading-none">
                  ~{forecast.score}
                  <span className="ml-1.5 text-lg font-extrabold text-muted">{t("exam.of", { max: MAX_SCORE })}</span>
                </p>
                <Pill tone={TONE_PILL[toneOf(ratioOf(forecast.score, MAX_SCORE))]}>{t("exam.forecast.range", { low: forecast.low, high: forecast.high })}</Pill>
              </div>
              <p className="text-sm font-semibold text-muted">
                {t("exam.forecast.by", { n: forecast.answers })} · {t(`exam.forecast.basis.${forecast.basis}` as DictKey)}
              </p>
              <p className="text-sm font-bold">
                {forecast.score >= target ? t("exam.forecast.goalDone", { n: target }) : t("exam.forecast.goalLeft", { n: target, left: target - forecast.score })}
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* История */}
      <section>
        <SectionTitle>{t("exam.history.title")}</SectionTitle>
        {sorted.length === 0 ? (
          <Card>
            <p className="font-semibold text-muted">{t("exam.history.empty")}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {points.length > 0 && (
              <Card>
                <ExamChart points={points} target={target} />
              </Card>
            )}
            <ul className="flex flex-col gap-2">
              {rows.map((e) => {
                const ratio = ratioOf(e.points, e.maxPoints);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/exam/result/${e.id}`}
                      className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:bg-surface-2 active:translate-y-0.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">{t(`exam.mode.${e.kind}` as DictKey)}</span>
                        <span className="block text-xs font-semibold text-muted">
                          {dateFmt(e.at)}
                          {e.kind === "topic" && e.topics?.length ? ` · ${e.topics.map((x) => l(ENT_TOPICS.find((tp) => tp.id === x)?.short ?? x)).join(", ")}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-extrabold">
                          {e.points}/{e.maxPoints}
                        </span>
                      </span>
                      <Pill tone={TONE_PILL[toneOf(ratio)]}>{Math.round(ratio * 100)}%</Pill>
                      <ChevronRight size={18} className="text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {sorted.length > HISTORY_SHOWN && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("exam.history.less") : t("exam.history.more", { n: sorted.length - HISTORY_SHOWN })}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Вариант по ссылке */}
      <section>
        <SectionTitle>{t("exam.share.title")}</SectionTitle>
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-muted">{t("exam.share.desc")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {(["mini", "full"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={shareKind === k}
                onClick={() => {
                  setShareKind(k);
                  setShared(null);
                }}
                className={cn(
                  "h-10 rounded-full border-2 px-3.5 text-sm font-extrabold",
                  shareKind === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:bg-surface-2",
                )}
              >
                {t(`exam.mode.${k}` as DictKey)}
              </button>
            ))}
            <Button variant="secondary" size="sm" icon={<Link2 size={16} aria-hidden />} onClick={share} className="ml-auto">
              {t("exam.share.button")}
            </Button>
          </div>
          {shared && (
            <div className="flex flex-col gap-1.5" role="status">
              <p className="text-sm font-extrabold text-success-strong">{t(`exam.share.${shared.how}` as DictKey)}</p>
              <input
                readOnly
                value={shared.url}
                aria-label={t("exam.share.button")}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 w-full rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-xs"
              />
            </div>
          )}
        </Card>
      </section>

      <ButtonLink href="/practice" variant="ghost" className="self-center">
        {t("exam.toPractice")}
      </ButtonLink>
    </div>
  );
}
