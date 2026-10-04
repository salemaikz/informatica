"use client";

import { BookCheck, Clock, Flame, Snowflake, Sparkles, Target, Trash2, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SKILLS } from "@/content/skills";
import { useApp } from "@/lib/store";
import { masteryLevel } from "@/lib/mastery";
import { useLevel, useStreak } from "@/lib/hooks";
import { levelTitle } from "@/lib/gamification";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Markdown } from "@/components/Markdown";
import { WeekChart } from "@/components/app/WeekChart";
import { MASTERY_COLOR } from "@/components/lesson/Results";
import { GoalsPanel } from "@/components/goals/GoalsPanel";
import { HistoryStatsCard } from "@/components/history/HistoryCards";
import { useEntVisible } from "@/components/school/useEntVisible";

function Tile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs font-bold text-muted">{sub}</p>}
    </div>
  );
}

function formatDuration(sec: number, lang: "ru" | "kk") {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  const hs = lang === "kk" ? "сағ" : "ч";
  const ms = lang === "kk" ? "мин" : "мин";
  return h ? `${h} ${hs} ${m} ${ms}` : `${m} ${ms}`;
}

export default function StatsPage() {
  const { t, l, lang } = useT();
  const days = useApp((s) => s.days);
  const skills = useApp((s) => s.skills);
  const lessons = useApp((s) => s.lessons);
  const mistakes = useApp((s) => s.mistakes);
  const memory = useApp((s) => s.memory);
  const setMemory = useApp((s) => s.setMemory);
  const { xp, level } = useLevel();
  const { current, best } = useStreak();
  const freezes = useApp((s) => s.streak.freezes ?? 0);
  // Цели, прогноз балла, план недели и график пробников — только в треке ЕНТ (#52).
  const ent = useEntVisible();

  const totals = Object.values(days).reduce((a, d) => ({ answers: a.answers + d.answers, correct: a.correct + d.correct, seconds: a.seconds + d.seconds }), { answers: 0, correct: 0, seconds: 0 });
  const accuracy = totals.answers ? Math.round((totals.correct / totals.answers) * 100) : 0;
  const empty = totals.answers === 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("stats.title")}</h1>

      {ent && <GoalsPanel />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile icon={<Zap size={14} className="text-gold" />} label={t("stats.totalXp")} value={xp} />
        <Tile icon={<Trophy size={14} className="text-primary" />} label={t("stats.level")} value={level} sub={l(levelTitle(level))} />
        <Tile icon={<Flame size={14} className="text-streak" />} label={t("stats.streak")} value={current} sub={t("stats.best", { n: best })} />
        <Tile icon={<Target size={14} className="text-success" />} label={t("stats.accuracy")} value={empty ? "—" : `${accuracy}%`} />
        <Tile icon={<Clock size={14} className="text-primary" />} label={t("stats.time")} value={formatDuration(totals.seconds, lang)} />
        <Tile icon={<BookCheck size={14} className="text-primary" />} label={t("stats.lessons")} value={Object.keys(lessons).length} />
      </div>

      <Card className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Snowflake size={24} />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">{t("goals.streak.freezes", { n: freezes })}</p>
          <p className="text-sm font-semibold text-muted">{t("goals.streak.freezeHint")}</p>
        </div>
      </Card>

      <HistoryStatsCard />

      <Card>
        <p className="mb-4 font-extrabold">{t("stats.week")}</p>
        <WeekChart />
      </Card>

      <Card>
        <p className="mb-3 font-extrabold">{t("stats.skills")}</p>
        {empty ? (
          <p className="font-semibold text-muted">{t("stats.noData")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {SKILLS.map((sk) => {
              const st = skills[sk.id];
              const lvl = masteryLevel(st);
              return (
                <li key={sk.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm font-bold">
                    <span>{l(sk.title)}</span>
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: MASTERY_COLOR[lvl] }} />
                      {t(`mastery.${lvl}`)}
                      {st && ` · ${Math.round(st.mastery * 100)}%`}
                    </span>
                  </div>
                  <ProgressBar value={st?.mastery ?? 0} color={MASTERY_COLOR[lvl]} height={10} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {mistakes.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-extrabold">{t("stats.mistakes")}</p>
            <Link href="/drill?mode=mistakes" className="text-sm font-extrabold text-primary">
              {t("prac.mistakes")} →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {mistakes.slice(0, 6).map((m) => (
              <li key={m.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <p className="font-semibold">{m.prompt}</p>
                <p className="mt-1 flex flex-wrap gap-x-3">
                  <span>
                    <span className="text-muted">{t("stats.given")}: </span>
                    <span className="font-bold text-danger">{m.given || "—"}</span>
                  </span>
                  <span>
                    <span className="text-muted">{t("stats.expected")}: </span>
                    <span className="font-mono font-bold text-success-strong">{m.expected}</span>
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="border-ai/30">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-extrabold text-ai">
            <Sparkles size={18} /> {t("stats.memory")}
          </p>
          {memory && (
            <button type="button" onClick={() => setMemory("")} className="flex items-center gap-1 text-xs font-bold text-muted hover:text-danger">
              <Trash2 size={14} /> {t("common.delete")}
            </button>
          )}
        </div>
        {memory ? <Markdown className="text-[15px]">{memory}</Markdown> : <p className="font-semibold text-muted">{t("stats.memoryEmpty")}</p>}
      </Card>
    </div>
  );
}
