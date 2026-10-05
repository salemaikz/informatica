"use client";

import { Check, ChevronLeft, CircleCheck, Clock, Flag, RotateCcw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { getLesson } from "@/content/course";
import { useNow } from "@/components/economy/useEconomy";
import { formatClock, formatDay } from "@/components/exam/logic";
import { Mascot } from "@/components/mascot/Mascot";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Ring } from "@/components/ui/ProgressBar";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { entryScore, type HistoryEntry, type WrongItem } from "@/lib/history";
import { useApp } from "@/lib/store";
import { KindIcon, TONE_COLOR, TONE_TEXT } from "./HistoryParts";
import { entryClock, entryPercent, entryResult, entryTitle, entryTone, examResultHref, mistakeCounts, redoHref, replayHref } from "./logic";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] font-extrabold text-muted">
        {icon} {label}
      </p>
      <p className="truncate font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function WrongCard({ item, fixed, index }: { item: WrongItem; fixed: boolean; index: number }) {
  const { t } = useT();
  return (
    <li
      className={cn(
        "rounded-3xl border-2 p-4",
        fixed ? "border-success/40 bg-success-soft" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
            fixed ? "bg-success text-white" : "bg-danger-soft text-danger",
          )}
        >
          {fixed ? <Check size={14} strokeWidth={3} /> : index + 1}
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-line break-words font-bold leading-snug">{item.prompt || "—"}</p>
      </div>

      {fixed ? (
        <div className="mt-3 flex flex-col gap-2">
          <Pill tone="success" className="self-start" icon={<Check size={12} strokeWidth={3} aria-hidden />}>
            {t("history.detail.fixed")}
          </Pill>
          <p className="break-words text-sm font-semibold text-muted">
            <span className="font-extrabold text-success-strong">{t("history.detail.expected")}: </span>
            {item.expected || "—"}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="rounded-2xl bg-danger-soft px-3 py-2.5">
            <p className="flex items-center gap-1 text-xs font-extrabold text-danger">
              <X size={14} strokeWidth={3} aria-hidden /> {t("history.detail.given")}
            </p>
            <p className="break-words font-bold">{item.given || "—"}</p>
          </div>
          <div className="rounded-2xl bg-success-soft px-3 py-2.5">
            <p className="flex items-center gap-1 text-xs font-extrabold text-success-strong">
              <Check size={14} strokeWidth={3} aria-hidden /> {t("history.detail.expected")}
            </p>
            <p className="break-words font-bold">{item.expected || "—"}</p>
          </div>
        </div>
      )}
    </li>
  );
}

function Back() {
  const { t } = useT();
  return (
    <Link href="/history" className="inline-flex min-h-10 items-center gap-1 self-start rounded-xl pr-2 text-sm font-extrabold text-muted hover:text-text">
      <ChevronLeft size={18} aria-hidden /> {t("history.detail.back")}
    </Link>
  );
}

/** Один тест из истории: итог, ошибки (исправленные — с галочкой), действия. */
export function HistoryDetail({ id }: { id: string }) {
  const { t, lang } = useT();
  const entry: HistoryEntry | undefined = useApp((s) => s.history.find((e) => e.id === id));
  const now = useNow();

  if (!entry) {
    return (
      <div className="flex flex-col gap-4">
        <Back />
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="sad" size={88} />
          <p className="text-lg font-extrabold">{t("history.detail.notFound")}</p>
          <ButtonLink href="/history" variant="secondary">
            {t("history.detail.back")}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const tone = entryTone(entry);
  const counts = mistakeCounts(entry);
  const replay = replayHref(entry);
  const canReplay = replay !== null && !!entry.lessonId && !!getLesson(entry.lessonId);
  const clock = entryClock(entry.at);
  const day = formatDay(entry.at, lang, false, now);
  const examNote = entry.kind === "exam" && counts.total === 0 && entryScore(entry) < 1;

  return (
    <div className="flex flex-col gap-4">
      <Back />

      <Reveal>
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <KindIcon kind={entry.kind} size={48} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold leading-tight">{entryTitle(entry, t)}</h1>
              <p className="mt-0.5 text-sm font-bold text-muted">
                {[day, clock, t(`history.kind.${entry.kind}` as DictKey)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Ring value={entryScore(entry)} size={84} stroke={9} color={TONE_COLOR[tone]}>
              <span className={cn("text-lg font-extrabold tabular-nums", TONE_TEXT[tone])}>{entryPercent(entry)}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-muted">{t("history.detail.result")}</p>
              <p className={cn("text-xl font-extrabold leading-tight tabular-nums", TONE_TEXT[tone])}>{entryResult(entry, t)}</p>
              {counts.total > 0 && (
                <p className={cn("mt-1 text-sm font-extrabold", counts.open > 0 ? "text-danger" : "text-success-strong")}>
                  {t("history.row.mistakes", { n: counts.total, k: counts.fixed })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<Clock size={12} aria-hidden />} label={t("history.detail.time")} value={formatClock(entry.durationSec)} />
            <Stat icon={<Sparkles size={12} className="text-gold" aria-hidden />} label={t("history.detail.xp")} value={entry.xp > 0 ? `+${entry.xp} XP` : "—"} />
          </div>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-2.5">
        {counts.open > 0 && (
          <ButtonLink href={redoHref(entry.id)} variant="danger" size="lg" block icon={<RotateCcw size={20} aria-hidden />}>
            {t("history.detail.fix", { n: counts.open })}
          </ButtonLink>
        )}
        {entry.kind === "exam" && entry.examId && (
          <ButtonLink href={examResultHref(entry.examId)} variant="secondary" block icon={<Flag size={18} aria-hidden />}>
            {t("history.detail.openExam")}
          </ButtonLink>
        )}
        {canReplay && replay && (
          <ButtonLink href={replay} variant="secondary" block icon={<RotateCcw size={18} aria-hidden />}>
            {t("history.detail.replay")}
          </ButtonLink>
        )}
      </div>

      {examNote && (
        <p className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-3.5 text-sm font-semibold">{t("history.detail.examNote")}</p>
      )}

      {counts.total === 0 && !examNote && (
        <div className="flex items-center gap-3 rounded-3xl border-2 border-success/40 bg-success-soft p-4">
          <CircleCheck size={26} className="shrink-0 text-success-strong" aria-hidden />
          <p className="font-extrabold text-success-strong">{t("history.detail.noMistakes")}</p>
        </div>
      )}

      {counts.total > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{t("history.detail.mistakes")}</h2>
          {counts.open === 0 && (
            <p className="flex items-center gap-2 text-sm font-extrabold text-success-strong">
              <CircleCheck size={18} aria-hidden /> {t("history.detail.allFixed")}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {entry.wrong.map((w, i) => (
              <WrongCard key={w.stepId} item={w} fixed={entry.fixed.includes(w.stepId)} index={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
