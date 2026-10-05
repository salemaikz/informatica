"use client";

import { Gift } from "lucide-react";
import { animate, m, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CASE_WIN_INDEX, type LevelCaseRoll } from "@/lib/level-case";
import { playSound, type SoundName } from "@/lib/sound";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { LevelBadge } from "@/components/app/LevelBadge";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/mascot/Mascot";
import { easeOut, springBouncy, springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { cosmeticDef } from "@/lib/cosmetics";
import { cn } from "@/lib/cn";
import { COSMETIC_PRIZE_BOX, CosmeticPrizeBody, EquipPrizeButton } from "./CosmeticPrize";
import { PrizeIcon, prizeDesc, prizeName, prizeShortName } from "./prize";

/** Размеры карточки ленты и шаг между ними, px. */
const CARD_W = 104;
const STEP = CARD_W + 10;
/** Длительность прокрутки до приза, с; после касания экрана — короткая «досадка» до приза. */
const SPIN_S = 3.4;
const SKIP_S = 0.3;
/** Не чаще одного щелчка ленты за столько мс (в начале карточки летят очень быстро). */
const TICK_GAP_MS = 55;

type Phase = "closed" | "spin" | "reveal";

/** Где останавливается лента: победитель под указателем (чуть смещённо). */
const finalX = (r: LevelCaseRoll) => -(CASE_WIN_INDEX * STEP + r.landing * CARD_W);

/** Звук — по настройке профиля (как у общего отклика, lib/feedback.ts). */
function sfx(name: SoundName) {
  try {
    if (useApp.getState().profile.sound) playSound(name);
  } catch {
    // звук — не критично
  }
}

function buzz() {
  try {
    if (useApp.getState().profile.vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([30, 50, 30, 50, 90]);
  } catch {
    // вибрация — не критично
  }
}

/**
 * Полноэкранный кейс за новый уровень. Приз выбирает код в момент нажатия «Открыть» (стор: `openLevelCase`) —
 * лента только показывает уже выпавшее. Касание экрана во время прокрутки сразу ведёт к призу;
 * при «Меньше анимаций» прокрутки нет — приз показывается сразу.
 */
export function LevelCase({
  level,
  onClose,
  onOpened,
  initialRoll,
}: {
  level: number;
  onClose: () => void;
  /** Приз уже выдан (кейс убран из очереди): родитель запоминает бросок. */
  onOpened?: (roll: LevelCaseRoll) => void;
  /** Окно перемонтировано после выдачи приза: сразу показываем уже выпавший приз (без ленты, конфетти и звука). */
  initialRoll?: LevelCaseRoll;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const [phase, setPhase] = useState<Phase>(initialRoll ? "reveal" : "closed");
  const [roll, setRoll] = useState<LevelCaseRoll | null>(initialRoll ?? null);
  // Выпало украшение профиля: итог показывает его превью и кнопку «Надеть».
  const cosmeticId = roll?.prize.kind === "cosmetic" ? roll.prize.cosmetic : undefined;
  const cosmetic = cosmeticDef(cosmeticId);
  // Фокус до открытия окна: вернём его при закрытии (читается один раз, до первой отрисовки).
  const [returnTo] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.activeElement));
  const x = useMotionValue(-CARD_W / 2);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const spinning = useRef(false);
  const revealed = useRef(!!initialRoll);
  const lastIdx = useRef(0);
  const lastTick = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Щелчки: каждый раз, когда под указателем оказывается новая карточка.
  useMotionValueEvent(x, "change", (v) => {
    if (!spinning.current) return;
    const idx = Math.max(0, Math.floor(-v / STEP));
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;
    const now = performance.now();
    if (now - lastTick.current < TICK_GAP_MS) return;
    lastTick.current = now;
    sfx("caseTick");
  });

  useEffect(() => {
    const pending = timers;
    return () => {
      controls.current?.stop();
      pending.current.forEach(clearTimeout);
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [returnTo]);

  const reveal = useCallback((r: LevelCaseRoll) => {
    if (revealed.current) return;
    revealed.current = true;
    spinning.current = false;
    setPhase("reveal");
    sfx("caseReveal");
    buzz();
    if (r.prize.kind === "chips") timers.current.push(setTimeout(() => sfx("chips"), 450));
  }, []);

  const begin = () => {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const r = useApp.getState().openLevelCase(level, seed);
    if (!r) {
      onClose();
      return;
    }
    setRoll(r);
    onOpened?.(r);
    if (reduce) {
      reveal(r);
      return;
    }
    setPhase("spin");
    spinning.current = true;
    sfx("pop");
    controls.current = animate(x, finalX(r), { duration: SPIN_S, ease: [0.2, 0.75, 0.15, 1], onComplete: () => reveal(r) });
  };

  const skip = useCallback(() => {
    if (phase !== "spin" || !roll || !spinning.current) return;
    controls.current?.stop();
    controls.current = animate(x, finalX(roll), { duration: SKIP_S, ease: easeOut, onComplete: () => reveal(roll) });
  }, [phase, roll, x, reveal]);

  // Клавиатура: во время прокрутки любая клавиша — к призу; на закрытом кейсе Escape — «Позже».
  useEffect(() => {
    if (phase === "reveal") return;
    const onKey = (e: KeyboardEvent) => {
      if (phase === "spin") skip();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip, onClose]);

  // Конфетти на открытии приза.
  useEffect(() => {
    if (phase !== "reveal" || reduce || initialRoll) return;
    const colors = ["#f0b400", "#f5c22e", "#1a91d6", "#7656f5", "#f2416b"];
    let cancelled = false;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({ particleCount: 120, spread: 85, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
    });
    return () => {
      cancelled = true;
    };
  }, [phase, reduce, initialRoll]);

  return (
    <m.div
      className="fixed inset-0 z-[60] overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={t("case.aria")}
      onClick={phase === "spin" ? skip : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Постоянная «живая область» для скринридера: приз объявляется, когда появляется */}
      <p className="sr-only" role="status" aria-live="polite">
        {phase === "reveal" && roll ? `${prizeName(roll.prize, t)}. ${prizeDesc(roll.prize, t)}` : ""}
      </p>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-gold-soft to-transparent" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center">
        {phase === "closed" && (
          <>
            <div className="relative grid place-items-center">
              <span className="absolute h-44 w-44 rounded-full bg-gold/35 blur-3xl" />
              <m.span
                className="relative grid h-28 w-28 place-items-center rounded-3xl border-2 border-gold bg-gold-soft text-warning-strong shadow-[0_5px_0_var(--warning-strong)]"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: [0, -6, 6, -4, 4, 0] }}
                transition={reduce ? springBouncy : { scale: springBouncy, opacity: { duration: 0.2 }, rotate: { duration: 1.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" } }}
              >
                <Gift size={60} strokeWidth={2.2} />
              </m.span>
            </div>
            <m.div className="flex flex-col gap-1.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.15 }}>
              <div className="flex items-center justify-center gap-2">
                <LevelBadge level={level} size="md" />
                <p className="text-sm font-extrabold uppercase tracking-wide text-warning-strong">{t("gamify.newLevel")}</p>
              </div>
              <h1 className="text-balance text-3xl font-extrabold leading-tight">{t("case.title")}</h1>
              <p className="text-balance font-semibold text-muted">{t("case.sub")}</p>
            </m.div>
            <m.div className="flex w-full flex-col gap-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.3 }}>
              <Button variant="primary" size="lg" block onClick={begin} autoFocus>
                {t("case.open")}
              </Button>
              <Button variant="ghost" size="md" block onClick={onClose}>
                {t("case.later")}
              </Button>
            </m.div>
          </>
        )}

        {phase === "spin" && roll && (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-2">
                <LevelBadge level={level} size="md" />
                <p className="text-sm font-extrabold uppercase tracking-wide text-warning-strong">{t("gamify.newLevel")}</p>
              </div>
              <h1 className="text-balance text-2xl font-extrabold leading-tight">{t("case.spinning")}</h1>
            </div>
            <div className="relative -mx-5 h-36 w-[calc(100%+2.5rem)] overflow-hidden" aria-hidden>
              <m.div className="absolute left-1/2 top-3 flex gap-2.5" style={{ x }}>
                {roll.strip.map((p, i) => (
                  <div key={i} className="flex h-30 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface" style={{ width: CARD_W }}>
                    <PrizeIcon prize={p} size={32} className="h-14 w-14" />
                    <span className="px-1 text-sm font-extrabold leading-tight">{prizeShortName(p, t)}</span>
                  </div>
                ))}
              </m.div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-gold" />
            </div>
            <p className="text-balance text-sm font-semibold text-muted">{t("case.skip")}</p>
          </>
        )}

        {phase === "reveal" && roll && (
          <>
            <m.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
              <Mascot mood="celebrate" size={104} />
            </m.div>
            <m.div className="flex flex-col gap-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.1 }}>
              <p className="text-sm font-extrabold uppercase tracking-wide text-warning-strong">{t("case.reveal")}</p>
            </m.div>
            <m.div
              className={cn("flex w-full flex-col items-center gap-3 rounded-3xl border-2 p-5", cosmeticId && cosmetic ? COSMETIC_PRIZE_BOX[cosmetic.rarity] : "border-gold/60 bg-gold-soft")}
              role="group"
              aria-label={t("case.prize.aria", { name: prizeName(roll.prize, t) })}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...springBouncy, delay: 0.15 }}
            >
              {cosmeticId ? (
                <CosmeticPrizeBody id={cosmeticId} />
              ) : (
                <>
                  <PrizeIcon prize={roll.prize} size={44} className="h-20 w-20 bg-surface" />
                  <p className="text-3xl font-extrabold leading-tight">{prizeName(roll.prize, t)}</p>
                  <p className="text-balance font-semibold text-muted">{prizeDesc(roll.prize, t)}</p>
                </>
              )}
            </m.div>
            <m.div className={cn("w-full", cosmeticId && "grid grid-cols-2 gap-2")} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.5 }}>
              {cosmeticId && <EquipPrizeButton id={cosmeticId} />}
              <Button variant="primary" size="lg" block onClick={onClose} autoFocus>
                {t("case.done")}
              </Button>
            </m.div>
          </>
        )}
      </div>
    </m.div>
  );
}
