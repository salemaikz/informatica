"use client";

import clsx from "clsx";
import { Brain, ChevronDown, ChevronRight, Code2, Repeat, RotateCcw, Timer, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { skillById } from "@/content/skills";
import { getLesson } from "@/content/course";
import { useApp } from "@/lib/store";
import { masteryLevel } from "@/lib/mastery";
import { dueLessons } from "@/lib/review";
import { gameOpen, gameSkillsFor, skillsByUnit, skillsOfLessons } from "@/lib/drill";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Pill } from "@/components/ui/Pill";
import { MASTERY_COLOR } from "@/components/lesson/Results";
import { HistoryPracticeCard } from "@/components/history/HistoryCards";
import { iconFor } from "@/components/scenes/icons";
import { GAMES } from "@/games/registry";

/** Разделы курса с навыками — считаем один раз (данные курса не меняются). */
const GROUPS = skillsByUnit();

export default function PracticePage() {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const lessons = useApp((s) => s.lessons);
  const mistakes = useApp((s) => s.mistakes);
  const games = useApp((s) => s.games);
  const [now] = useState(() => Date.now());
  const [openUnits, setOpenUnits] = useState<ReadonlySet<string>>(new Set());
  // Только уроки, которые есть в курсе (в старых сохранениях бывают удалённые id): разминка их не соберёт.
  const due = dueLessons(lessons, now).filter((d) => getLesson(d.id)).length;
  const completedSkills = skillsOfLessons(Object.keys(lessons).filter((id) => (lessons[id]?.completions ?? 0) > 0));

  const toggle = (id: string) =>
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("prac.title")}</h1>
        <p className="font-semibold text-muted">{t("prac.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/drill?mode=smart"
          className="flex flex-col gap-2 rounded-3xl bg-primary p-5 text-white shadow-[0_5px_0_var(--primary-strong)] active:translate-y-1 active:shadow-none"
        >
          <Brain size={30} />
          <span className="text-lg font-extrabold">{t("prac.smart")}</span>
          <span className="text-sm font-semibold opacity-90">{t("prac.smart.desc")}</span>
        </Link>
        <Link
          href={mistakes.length ? "/drill?mode=mistakes" : "#"}
          aria-disabled={!mistakes.length}
          className={clsx(
            "flex flex-col gap-2 rounded-3xl p-5",
            mistakes.length
              ? "bg-danger text-white shadow-[0_5px_0_var(--danger-strong)] active:translate-y-1 active:shadow-none"
              : "pointer-events-none border-2 border-border bg-surface text-muted",
          )}
        >
          <RotateCcw size={30} />
          <span className="text-lg font-extrabold">{t("prac.mistakes")}</span>
          <span className="text-sm font-semibold opacity-90">
            {mistakes.length ? t("prac.mistakes.desc", { n: mistakes.length }) : t("prac.noMistakes")}
          </span>
        </Link>
      </div>

      {/* История тестов: результаты и ошибки каждого теста. */}
      <HistoryPracticeCard />

      {/* Практикум кода: Python, SQL, HTML/CSS, JavaScript, Excel прямо в браузере. */}
      <Link
        href="/code"
        className="flex items-center gap-4 rounded-3xl border-2 border-primary/30 bg-primary-soft p-4 active:translate-y-0.5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_4px_0_var(--primary-strong)]">
          <Code2 size={26} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{t("nav.code")}</span>
          <span className="block text-sm font-semibold text-muted">{t("prac.code.desc")}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-primary" />
      </Link>

      {/* Повторение (разминка): тема «остывает» — повторяем по расписанию. */}
      <Link
        href="/drill?mode=review"
        className={clsx(
          "flex items-center gap-4 rounded-3xl border-2 p-4 active:translate-y-0.5",
          due > 0 ? "border-warning/50 bg-warning-soft" : "border-border bg-surface hover:bg-surface-2",
        )}
      >
        <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", due > 0 ? "bg-warning text-white" : "bg-surface-2 text-muted")}>
          <Repeat size={26} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{t("modes.review.title")}</span>
          <span className="block text-sm font-semibold text-muted">
            {due > 0 ? t("modes.review.due", { n: due }) : t("modes.review.none")}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" />
      </Link>

      {/* Пробный ЕНТ. */}
      <Link href="/exam" className="flex items-center gap-4 rounded-3xl border-2 border-border bg-surface p-4 hover:bg-surface-2 active:translate-y-0.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Timer size={26} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{t("modes.prac.exam")}</span>
          <span className="block text-sm font-semibold text-muted">{t("modes.prac.exam.desc")}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" />
      </Link>

      {GAMES.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold">{t("games.title")}</h2>
          <p className="mb-3 text-sm font-semibold text-muted">{t("games.subtitle")}</p>
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => {
              const open = gameOpen(g, completedSkills);
              const best = games[g.id]?.best;
              // Универсальные игры берут навыки пройденных уроков (если они есть), остальные — свои.
              const own = g.shape || g.source ? gameSkillsFor(g, completedSkills).slice(0, 12) : [];
              const href = open ? (own.length ? `/game/${g.id}?skills=${own.join(",")}` : `/game/${g.id}`) : "#";
              return (
                <Link
                  key={g.id}
                  href={href}
                  aria-disabled={!open}
                  tabIndex={open ? undefined : -1}
                  className={clsx(
                    "flex flex-col gap-2 rounded-3xl border-2 bg-surface p-3.5 transition-transform active:translate-y-0.5",
                    open ? "border-border hover:bg-surface-2" : "pointer-events-none border-dashed border-border opacity-60",
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: g.color, color: g.ink }}>
                    <g.icon size={26} strokeWidth={2.3} />
                  </span>
                  <span className="font-extrabold leading-tight">{l(g.title)}</span>
                  <span className="line-clamp-2 text-xs font-semibold text-muted">{l(g.description)}</span>
                  {(g.shape || g.source) && <span className="text-xs font-extrabold text-primary">{t("modes.prac.anyTopic")}</span>}
                  <span className="mt-auto flex items-center gap-1 text-xs font-extrabold text-warning-strong">
                    {open ? (
                      <>
                        <Trophy size={14} className="text-gold" /> {best ?? "—"}
                      </>
                    ) : (
                      <span className="text-muted">{t("common.soon")}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-extrabold">{t("prac.skills")}</h2>
        <p className="mb-3 text-sm font-semibold text-muted">{t("modes.prac.skillsHint")}</p>
        <div className="flex flex-col gap-3">
          {GROUPS.map(({ unit, skills: unitSkills }) => {
            const expanded = openUnits.has(unit.id);
            const UnitIcon = iconFor(unit.icon ?? "box");
            const trainable = unitSkills.filter((s) => s.hasBank).length;
            return (
              <Card key={unit.id} className="p-0 sm:p-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`unit-${unit.id}`}
                  onClick={() => toggle(unit.id)}
                  className="flex w-full items-center gap-3 rounded-3xl p-3.5 text-left hover:bg-surface-2"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: unit.color }}>
                    <UnitIcon size={22} strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold leading-tight">{l(unit.title)}</span>
                    <span className="block text-xs font-bold text-muted">{t("modes.prac.groupCount", { k: trainable, n: unitSkills.length })}</span>
                  </span>
                  <ChevronDown size={20} className={clsx("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <ul id={`unit-${unit.id}`} className="flex flex-col divide-y-2 divide-border border-t-2 border-border px-3.5">
                    {unitSkills.map(({ id, hasBank }) => {
                      const sk = skillById(id)!;
                      const st = skills[id];
                      const lvl = masteryLevel(st);
                      return (
                        <li key={id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold leading-tight">{l(sk.title)}</p>
                            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted">
                              <span className="h-2 w-2 rounded-full" style={{ background: MASTERY_COLOR[lvl] }} />
                              {t(`mastery.${lvl}`)} {st ? `· ${Math.round(st.mastery * 100)}%` : ""}
                            </p>
                            <ProgressBar value={st?.mastery ?? 0} color={MASTERY_COLOR[lvl]} height={10} />
                          </div>
                          {hasBank ? (
                            <Link
                              href={`/drill?mode=skill&skill=${encodeURIComponent(id)}`}
                              className="shrink-0 rounded-xl border-2 border-primary/40 bg-primary-soft px-3 py-2 text-sm font-extrabold text-primary"
                            >
                              {t("prac.train")}
                            </Link>
                          ) : (
                            <Pill className="shrink-0">{t("common.soon")}</Pill>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
