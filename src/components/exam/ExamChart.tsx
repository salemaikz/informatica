"use client";

import { useT } from "@/i18n/useT";
import { MAX_SCORE } from "@/lib/forecast";
import { chartBars, toneOf, type HistoryPoint, type Tone } from "./logic";

const W = 320;
const H = 100;
const TOP = 14;
const BOTTOM = 14;

const FILL: Record<Tone, string> = { danger: "var(--danger)", warning: "var(--warning)", success: "var(--success)" };

/** Столбики по последним попыткам мини/полного (доля баллов), цвет — по семантике; пунктир — цель ученика. */
export function ExamChart({ points, target }: { points: HistoryPoint[]; target: number }) {
  const { t } = useT();
  const bars = chartBars(points, W, H);
  const goalY = TOP + H - (Math.max(0, Math.min(MAX_SCORE, target)) / MAX_SCORE) * H;
  return (
    <svg
      viewBox={`0 0 ${W} ${TOP + H + BOTTOM}`}
      role="img"
      aria-label={t("exam.chart.label", { n: points.length })}
      className="block h-auto w-full overflow-visible"
    >
      {/* Опорные линии: 50% и 100% */}
      {[0, 0.5, 1].map((v) => (
        <line key={v} x1={0} x2={W} y1={TOP + H - v * H} y2={TOP + H - v * H} stroke="var(--border)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : "3 4"} />
      ))}
      {bars.map((b) => {
        const tone = toneOf(b.point.percent / 100);
        return (
          <g key={b.point.id}>
            <title>{`${b.point.points}/${b.point.maxPoints} · ${b.point.percent}%`}</title>
            <rect x={b.x} y={TOP + b.y} width={b.w} height={b.h} rx={5} fill={FILL[tone]} />
            <text x={b.x + b.w / 2} y={TOP + b.y - 4} textAnchor="middle" fontSize={10} fontWeight={800} fill="var(--text)">
              {b.point.percent}
            </text>
            <text x={b.x + b.w / 2} y={TOP + H + 11} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--muted)">
              {b.point.kind === "full" ? t("exam.mode.full.short") : t("exam.mode.mini.short")}
            </text>
          </g>
        );
      })}
      {/* Цель — по баллам из 50 */}
      <line x1={0} x2={W} y1={goalY} y2={goalY} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" />
      <text x={W} y={goalY - 4} textAnchor="end" fontSize={10} fontWeight={800} fill="var(--primary)">
        {t("exam.chart.goal", { n: target })}
      </text>
    </svg>
  );
}
