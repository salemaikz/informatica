"use client";

import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UNITS } from "@/content/course-map";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Ring } from "@/components/ui/ProgressBar";
import { ICONS } from "@/components/scenes/icons";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useSkillStats } from "@/components/progress/useSkillStats";
import { unitProgress } from "./map";
import { unitShortKey, unitVars } from "./useLearn";
import { UnitSection } from "./UnitSection";

// Вид «Путь»: прилипающая полоса разделов + разделы с дорогами, между разделами — «мостики».

/** Мостик между разделами: дорожка продолжается по центру. */
function Bridge() {
  return (
    <div aria-hidden className="flex justify-center py-1">
      <svg width="176" height="56" viewBox="0 0 176 56" fill="none" strokeLinecap="round">
        <path d="M88 0V56" stroke="var(--border)" strokeWidth={7} strokeDasharray="1 14" />
        <path d="M30 36Q88 10 146 36" stroke="var(--border)" strokeWidth={8} />
        <path d="M30 24Q88 -2 146 24" stroke="var(--border)" strokeWidth={3} />
        {[44, 66, 88, 110, 132].map((x) => {
          const y = 36 - 13 * (1 - ((x - 88) / 58) ** 2);
          return <path key={x} d={`M${x} ${y - 12}V${y}`} stroke="var(--border)" strokeWidth={3} />;
        })}
        <path d="M30 24V44M146 24V44" stroke="var(--muted)" strokeOpacity={0.5} strokeWidth={5} />
      </svg>
    </div>
  );
}

function UnitBar({ active, onPick }: { active: string; onPick: (unitId: string) => void }) {
  const { t, l } = useT();
  const lessons = useApp((s) => s.lessons);
  const barRef = useRef<HTMLDivElement>(null);
  const reduce = useReduceMotion();

  // Активный чип — в поле зрения полосы (прокрутка самой полосы, не страницы).
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!bar || !chip) return;
    const left = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  return (
    <nav
      aria-label={t("learn2.units.label")}
      className="sticky top-[58px] z-10 -mx-4 border-b-2 border-border bg-bg/92 backdrop-blur sm:-mx-6 lg:top-0"
    >
      <div ref={barRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        {UNITS.map((unit, i) => {
          const Icon = unit.icon ? ICONS[unit.icon] : BookOpen;
          const p = unitProgress(unit, lessons);
          const on = unit.id === active;
          const short = unitShortKey(unit.id);
          return (
            <button
              key={unit.id}
              type="button"
              data-chip={unit.id}
              aria-current={on ? "true" : undefined}
              onClick={() => onPick(unit.id)}
              style={unitVars(unit.color)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-2xl border-2 pl-1 pr-3 text-sm font-extrabold transition-colors",
                on ? "border-(--u) bg-(--u-soft) text-(--u-ink)" : "border-border bg-surface text-muted hover:text-text",
              )}
            >
              <Ring value={p.total ? p.done / p.total : 0} size={32} stroke={3.5} color="var(--u)">
                <Icon size={15} className={on ? "text-(--u-ink)" : "text-muted"} />
              </Ring>
              <span className="whitespace-nowrap">
                {i + 1} · {short ? t(short) : l(unit.title)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PathView({ recommendedId, now, onOpen }: { recommendedId: string | undefined; now: number; onOpen: (lessonId: string) => void }) {
  const lessons = useApp((s) => s.lessons);
  // Освоение на карте — с затуханием без практики (#45, #80).
  const skills = useSkillStats();
  const reduce = useReduceMotion();
  const [active, setActive] = useState(UNITS[0].id);
  /** Пока страница едет к разделу после нажатия на чип — подсветку от прокрутки не меняем. */
  const lockUntil = useRef(0);

  // Активный раздел — верхний из видимых в полосе под шапкой.
  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.unit!;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        if (Date.now() < lockUntil.current) return;
        const top = UNITS.find((u) => visible.has(u.id));
        if (top) setActive(top.id);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    document.querySelectorAll<HTMLElement>("section[data-unit]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const pick = useCallback(
    (unitId: string) => {
      setActive(unitId);
      lockUntil.current = Date.now() + (reduce ? 100 : 900);
      document.getElementById(`unit-${unitId}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    [reduce],
  );

  return (
    <div className="flex flex-col">
      <UnitBar active={active} onPick={pick} />
      <div className="flex flex-col pt-4">
        {UNITS.map((unit, i) => (
          <div key={unit.id}>
            {i > 0 && <Bridge />}
            <UnitSection unit={unit} index={i} lessons={lessons} skills={skills} recommendedId={recommendedId} now={now} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}
