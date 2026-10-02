"use client";

import clsx from "clsx";
import { shortDate } from "@/lib/date";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";

// Столбчатая диаграмма XP за 7 дней: одна серия, один цвет, линия дневной цели.
// Значения: подпись у сегодняшнего столбца, остальное — во всплывающей подсказке и в скрытой таблице.

const H = 140;

export function WeekChart() {
  const { t, lang } = useT();
  const days = useApp((s) => s.days);
  const goal = useApp((s) => s.profile.dailyGoalXp);
  const [hover, setHover] = useState<number | null>(null);
  const names = t("stats.days").split(",");

  const data = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = todayKey(d);
    return {
      key,
      label: names[(d.getDay() + 6) % 7],
      date: shortDate(d, lang),
      xp: days[key]?.xp ?? 0,
      today: i === 6,
    };
  });
  const max = Math.max(goal, ...data.map((d) => d.xp), 10);
  const scale = (v: number) => (v / max) * H;
  const goalY = H - scale(goal);

  return (
    <div>
      <div className="relative" style={{ height: H + 24 }}>
        {/* Базовая линия и линия цели */}
        <div className="absolute inset-x-0 border-t border-border" style={{ top: H + 24 - 1 }} />
        <div className="absolute inset-x-0 border-t border-gold/70" style={{ top: goalY + 24 }}>
          <span className="absolute -top-5 left-0 rounded bg-surface pr-1 text-[11px] font-bold text-muted">
            {t("stats.goalLine")} · {goal}
          </span>
        </div>
        <div className="absolute inset-0 grid grid-cols-7 items-end" style={{ top: 24 }}>
          {data.map((d, i) => {
            const h = d.xp > 0 ? Math.max(4, scale(d.xp)) : 0;
            return (
              <button
                key={d.key}
                type="button"
                className="group relative flex h-full flex-col items-center justify-end outline-none"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.date}: ${d.xp} XP`}
              >
                {(d.today || hover === i) && (
                  <span
                    className={clsx(
                      "absolute whitespace-nowrap text-xs font-extrabold",
                      hover === i && !d.today && "rounded-lg bg-text px-2 py-1 text-surface",
                    )}
                    style={{ bottom: h + 6 }}
                  >
                    {hover === i && !d.today ? `${d.date} · ${d.xp} XP` : `${d.xp} XP`}
                  </span>
                )}
                <span
                  className={clsx("w-full max-w-6 rounded-t-[4px] transition-[filter]", hover === i && "brightness-110")}
                  style={{ height: h, background: d.xp >= goal ? "var(--success)" : "var(--primary)" }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs font-bold text-muted">
        {data.map((d) => (
          <span key={d.key} className={clsx(d.today && "text-text")}>
            {d.today ? t("stats.today") : d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.date}</th>
              <td>{d.xp} XP</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
