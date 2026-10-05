"use client";

import { Cpu, Gift, Heart, PackageOpen } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { PERFECT_DROP } from "@/lib/economy";
import type { PerfectDrop } from "@/lib/perfect";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ChipFlight } from "@/components/motion/ChipFlight";
import { springBouncy } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { chipsKey } from "./xp-chips";

/** Шанс сюрприза в процентах — из PERFECT_DROP (в текстах числа не пишем). */
export const PERFECT_DROP_PERCENT = Math.round((PERFECT_DROP.heartChance + PERFECT_DROP.chipsChance) * 100);

/** Через сколько после появления плитки капсула раскрывается, с. */
const REVEAL_AFTER = 0.8;

/** «Меньше анимаций» включено в настройках или у системы (читаем при создании плитки — без setState в эффекте). */
function prefersReducedMotion(): boolean {
  try {
    if (useApp.getState().profile.reduceMotion) return true;
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * «Сюрприз за идеальный урок» (этап 16В, решение B): капсула «раскрывается» и показывает то, что УЖЕ выдано стором
 * (пол-сердечка, чипы или «пусто»). Бросок и выдача — в действии стора, здесь только показ.
 * - animate: свежий результат — капсула раскрывается (~0,8 с после появления), играют звук и полёт чипов; «Меньше анимаций» — сразу итог.
 *   Не свежий (итоги тестов открыты из истории) — сразу итог, без звука и полёта.
 * - delay: задержка появления плитки, с (лесенка плиток итогов).
 * - flightTarget: куда летят чипы (на итогах урока — `[data-chip-target]`; по умолчанию — счётчик в шапке).
 */
export function PerfectDropTile({
  drop,
  variant = "lesson",
  animate = true,
  delay = 0,
  flightTarget,
}: {
  drop: PerfectDrop;
  variant?: "lesson" | "test";
  animate?: boolean;
  delay?: number;
  flightTarget?: string;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const [opened, setOpened] = useState(() => !animate || prefersReducedMotion());
  // Чипы летят только когда капсула раскрылась на глазах: при «сразу итоге» — один звук монетки, без повторного показа.
  const [live] = useState(() => animate);

  useEffect(() => {
    if (!live) return;
    const play = () => feedback(drop.kind === "heart" ? "perfect" : drop.kind === "chips" ? "pop" : "tap");
    if (opened) {
      play();
      return;
    }
    const id = setTimeout(() => {
      setOpened(true);
      play();
    }, (delay + REVEAL_AFTER) * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- раскрытие запускаем один раз при показе плитки
  }, []);

  const tone =
    !opened ? "border-border bg-surface text-text" : drop.kind === "heart" ? "border-heart bg-heart-soft text-heart-strong" : drop.kind === "chips" ? "border-gold bg-gold-soft text-warning-strong" : "border-border bg-surface-2 text-muted";
  const result =
    drop.kind === "heart" ? t("econ16c.drop.heart") : drop.kind === "chips" ? t(chipsKey("econ16c.drop.chips", drop.amount), { n: drop.amount }) : t("econ16c.drop.none");
  const Icon = !opened ? Gift : drop.kind === "heart" ? Heart : drop.kind === "chips" ? Cpu : PackageOpen;
  const iconTone = !opened ? "text-gold" : drop.kind === "heart" ? "text-heart" : drop.kind === "chips" ? "text-gold" : "text-muted";

  return (
    <m.div
      role="status"
      aria-live="polite"
      className={cn("relative flex flex-col items-center gap-1 rounded-3xl border-2 px-4 py-3 text-center transition-colors duration-300", tone)}
      initial={reduce ? false : { opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay: reduce ? 0 : delay }}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t(variant === "test" ? "econ16c.drop.titleTest" : "econ16c.drop.title")}</p>
      <div className="flex items-center gap-2">
        <m.span
          aria-hidden
          className={cn("inline-flex", iconTone)}
          animate={
            reduce
              ? undefined
              : opened
                ? { scale: [0.6, 1.35, 1], rotate: [0, -8, 0] }
                : { rotate: [0, -12, 12, -10, 10, 0], scale: [1, 1.08, 1] }
          }
          transition={opened ? { duration: 0.45, ease: "easeOut" } : { duration: 0.7, delay, repeat: Infinity, repeatDelay: 0.2 }}
        >
          <Icon size={28} fill={opened && drop.kind === "heart" ? "currentColor" : "none"} />
        </m.span>
        <span className="text-xl font-extrabold leading-tight" data-testid="perfect-drop-result">
          {opened ? (
            result
          ) : (
            <>
              <span aria-hidden>?</span>
              <span className="sr-only">{t("econ16c.drop.opening")}</span>
            </>
          )}
        </span>
      </div>
      <p className="text-xs font-bold text-muted">{t(variant === "test" ? "econ16c.drop.hintTest" : "econ16c.drop.hint", { p: PERFECT_DROP_PERCENT })}</p>
      {opened && live && drop.kind === "chips" && <ChipFlight amount={drop.amount} delay={0.25} targetSelector={flightTarget} />}
    </m.div>
  );
}
