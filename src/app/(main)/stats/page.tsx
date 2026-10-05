"use client";

import { Snowflake, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { Markdown } from "@/components/Markdown";
import { WeekChart } from "@/components/app/WeekChart";
import { GoalsPanel, WeekCard } from "@/components/goals/GoalsPanel";
import { HistoryStatsCard } from "@/components/history/HistoryCards";
import { CourseProgressCard } from "@/components/progress/CourseProgressCard";
import { SkillsMasteryCard } from "@/components/progress/SkillsMasteryCard";
import { StatsTiles } from "@/components/progress/StatsTiles";
import { TopicTable } from "@/components/progress/TopicTable";
import { UnitProgressList } from "@/components/progress/UnitProgressList";
import { WeakSpotsCard } from "@/components/progress/WeakSpotsCard";
import { useEntVisible } from "@/components/school/useEntVisible";
import { PageTip } from "@/components/tour/PageTip";

/**
 * «Прогресс»: сверху шкала курса, слабые места, разделы и темы (#71); затем честные числа (#66, #68),
 * цели, история, освоение навыков (#67), ошибки и «что ИИ знает обо мне».
 */
export default function StatsPage() {
  const { t } = useT();
  const mistakes = useApp((s) => s.mistakes);
  const memory = useApp((s) => s.memory);
  const setMemory = useApp((s) => s.setMemory);
  const freezes = useApp((s) => s.streak.freezes ?? 0);
  // Темы ЕНТ, цели, прогноз балла, план недели и график пробников — только в треке ЕНТ (#52); «Неделя» (уроков за неделю) нужна всем.
  const ent = useEntVisible();

  return (
    <div className="flex flex-col gap-5">
      <PageTip id="page-progress" />
      <h1 className="text-2xl font-extrabold">{t("stats.title")}</h1>

      <CourseProgressCard />
      <WeakSpotsCard />
      <UnitProgressList />
      {ent && <TopicTable />}

      <StatsTiles />

      {ent ? <GoalsPanel /> : <WeekCard showEdit />}

      <Card className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Snowflake size={24} aria-hidden />
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

      <SkillsMasteryCard />

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
