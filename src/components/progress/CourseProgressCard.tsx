"use client";

import { BookOpenCheck, ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar, Ring } from "@/components/ui/ProgressBar";
import { percent } from "./format";
import { useCourseView, type CourseView } from "./useCourseView";

function titleOf(v: CourseView, t: ReturnType<typeof useT>["t"]): string {
  const p = percent(v.ratio);
  const done = v.ratio >= 1 && v.total > 0;
  if (v.kind === "class") return t(done ? "progress.class.titleDone" : "progress.class.title", { p, g: v.grade });
  return t(done ? "progress.course.titleDone" : "progress.course.title", { p });
}

/**
 * Шкала «Пройдено X% курса» (#71): кольцо, «N из M уроков, ещё K скоро». Считаются только готовые уроки на карте.
 * Школьный трек — процент своего класса. Цвет: primary, на 100% — success.
 */
export function CourseProgressCard({ className }: { className?: string }) {
  const { t } = useT();
  const v = useCourseView();
  const full = v.ratio >= 1 && v.total > 0;
  const color = full ? "var(--success)" : "var(--primary)";
  const Icon = v.kind === "class" ? GraduationCap : BookOpenCheck;
  return (
    <Card className={cn("flex items-center gap-4", className)}>
      <Ring value={v.ratio} size={76} stroke={9} color={color}>
        <span className={cn("text-lg font-extrabold tabular-nums", full ? "text-success-strong" : "text-text")}>{percent(v.ratio)}%</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
          <Icon size={20} className={cn("shrink-0", full ? "text-success" : "text-primary")} aria-hidden />
          <span className="min-w-0">{titleOf(v, t)}</span>
        </p>
        <p className="mt-1 text-sm font-bold text-muted">
          {t("progress.lessons", { done: v.done, total: v.total })}
          {v.soon > 0 && ` · ${t(v.kind === "class" ? "progress.class.soon" : "progress.soon", { n: v.soon })}`}
        </p>
        {!v.anyDone && <p className="mt-1 text-sm font-semibold text-muted">{t("progress.course.empty")}</p>}
        {v.kind === "course" && v.skipBasics && <p className="mt-1 text-xs font-semibold text-muted">{t("progress.skipBasics")}</p>}
      </div>
    </Card>
  );
}

/**
 * Одна строка для главной: «Курс: 42% · 48 из 113» с тонкой полосой; нажатие открывает «Прогресс».
 * `href` можно поменять, `className` — для отступов в месте вставки.
 */
export function CourseProgressBadge({ href = "/stats", className }: { href?: string; className?: string }) {
  const { t } = useT();
  const v = useCourseView();
  const full = v.ratio >= 1 && v.total > 0;
  const p = percent(v.ratio);
  const text = t(v.kind === "class" ? "progress.badge.class" : "progress.badge", { p, done: v.done, total: v.total });
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-2xl border-2 border-border bg-surface px-3 py-2 hover:bg-surface-2 active:translate-y-0.5",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      {v.kind === "class" ? (
        <GraduationCap size={18} className={cn("shrink-0", full ? "text-success" : "text-primary")} aria-hidden />
      ) : (
        <BookOpenCheck size={18} className={cn("shrink-0", full ? "text-success" : "text-primary")} aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{text}</span>
        <ProgressBar value={v.ratio} color={full ? "var(--success)" : "var(--primary)"} height={6} className="mt-1" label={t(v.kind === "class" ? "progress.class.aria" : "progress.course.aria")} />
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
