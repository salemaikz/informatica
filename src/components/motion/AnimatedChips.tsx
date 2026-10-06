"use client";

import clsx from "clsx";
import { Flame } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { useLevel, useStreak } from "@/lib/hooks";
import { XpIcon } from "@/components/economy/XpIcon";
import { useT } from "@/i18n/useT";
import { CountUp } from "./CountUp";
import { XpBurst } from "./XpBurst";

// Что ученик уже «видел» в шапке. Урок идёт вне оболочки приложения, поэтому, вернувшись на главную,
// он увидит, как XP и серия выросли (счётчик докручивается, всплывает «+N», пламя качается).
let seenXp: number | null = null;
let seenStreak: number | null = null;

const BUMP_DELAY = 0.3;

/** Счётчик XP в шапке: при росте число «подпрыгивает», над ним всплывает «+N». */
export function XpChipAnimated() {
  const { xp } = useLevel();
  const [start] = useState(() => seenXp ?? xp);
  const [prev, setPrev] = useState(start);
  const [burst, setBurst] = useState({ id: 0, amount: 0 });
  const [bumping, setBumping] = useState(false);

  // Рост XP замечаем при рендере (приём «предыдущее значение»), без эффектов с setState.
  if (xp !== prev) {
    setPrev(xp);
    if (xp > prev) {
      setBurst((b) => ({ id: b.id + 1, amount: xp - prev }));
      setBumping(true);
    }
  }
  useEffect(() => {
    seenXp = xp;
  }, [xp]);

  return (
    <span data-tour="hdr-xp" title="XP" className="relative flex items-center gap-1 font-extrabold text-warning-strong">
      <XpIcon size={18} />
      <m.span
        className="inline-block"
        animate={bumping ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: bumping ? BUMP_DELAY : 0 }}
        onAnimationComplete={() => setBumping(false)}
      >
        <CountUp value={xp} from={start} delay={BUMP_DELAY} />
      </m.span>
      <XpBurst id={burst.id} amount={burst.amount} delay={BUMP_DELAY} className="right-0 top-5" />
    </span>
  );
}

/** Серия дней: когда она растёт, пламя «покачивается» и увеличивается. */
export function StreakChipAnimated() {
  const { current, activeToday } = useStreak();
  const { t } = useT();
  const [prev, setPrev] = useState(() => seenStreak ?? current);
  const [wiggling, setWiggling] = useState(false);

  if (current !== prev) {
    setPrev(current);
    if (current > prev) setWiggling(true);
  }
  useEffect(() => {
    seenStreak = current;
  }, [current]);

  return (
    <span data-tour="hdr-streak" title={current > 0 && !activeToday ? `${t("stats.streak")}: ${t("streak.notToday")}` : t("stats.streak")} className={clsx("flex items-center gap-1 font-extrabold", current > 0 ? "text-streak" : "text-muted")}>
      <m.span
        className="flex origin-bottom"
        animate={wiggling ? { rotate: [0, -16, 14, -9, 5, 0], scale: [1, 1.25, 1.25, 1.1, 1, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut", delay: wiggling ? BUMP_DELAY : 0 }}
        onAnimationComplete={() => setWiggling(false)}
      >
        <Flame size={20} fill={current > 0 ? "currentColor" : "none"} />
      </m.span>
      {current}
      {current > 0 && !activeToday && (
        <>
          <span aria-hidden data-testid="streak-reminder" className="h-1.5 w-1.5 rounded-full bg-streak" />
          <span className="sr-only">{t("streak.notToday")}</span>
        </>
      )}
    </span>
  );
}
