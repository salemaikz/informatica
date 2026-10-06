"use client";

import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { levelTier, type LevelTier } from "@/lib/gamification";
import { useT } from "@/i18n/useT";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { RARITY_BORDER, RARITY_SOFT } from "@/components/ui/rarity";
import type { ReactNode } from "react";

// Бейдж уровня (этап 16В, J): вид зависит от ступени уровня (lib/gamification → levelTier).
// common — мягкий фон · rare — кольцо · epic — кольцо и свечение · legendary — свечение и пробегающий блик ·
// mythic (30+) — переливающийся кант всех цветов редкости и искры. «Меньше анимаций» (настройка или система) — статично.

const SIZE = {
  sm: { box: 28, ring: 2 },
  md: { box: 48, ring: 3 },
  lg: { box: 80, ring: 4 },
} as const;

export type LevelBadgeSize = keyof typeof SIZE;

/** Кант мифической ступени: все цвета редкости по кругу (токены, обе темы). */
const MYTHIC_CONIC =
  "conic-gradient(from 0deg, var(--rarity-common), var(--rarity-rare), var(--rarity-epic), var(--rarity-legendary), var(--rarity-common))";

const glow = (token: string, percent: number, px: number) => `0 0 ${Math.round(px)}px color-mix(in srgb, var(${token}) ${percent}%, transparent)`;

/** Свечение вокруг бейджа по ступени (у common и rare его нет). */
function glowShadow(tier: LevelTier, box: number): string | undefined {
  if (tier === "epic") return glow("--rarity-epic", 50, box * 0.32);
  if (tier === "legendary") return glow("--rarity-legendary", 60, box * 0.42);
  if (tier === "mythic") return `${glow("--rarity-epic", 45, box * 0.3)}, ${glow("--rarity-legendary", 40, box * 0.5)}`;
  return undefined;
}

/** Четырёхконечная искра (24×24). */
const SPARK = "M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z";

const SPARKS: { x: string; y: string; scale: number; color: string; delay: number }[] = [
  { x: "88%", y: "-6%", scale: 0.26, color: "var(--rarity-legendary)", delay: 0 },
  { x: "-8%", y: "70%", scale: 0.22, color: "var(--rarity-rare)", delay: 0.8 },
  { x: "-4%", y: "-2%", scale: 0.17, color: "var(--rarity-epic)", delay: 1.6 },
];

function Sparks({ box, animated, count }: { box: number; animated: boolean; count: number }) {
  return (
    <>
      {SPARKS.slice(0, count).map((sp, i) => {
        const size = Math.max(6, Math.round(box * sp.scale));
        return (
          <m.svg
            key={i}
            aria-hidden
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className="pointer-events-none absolute"
            style={{ left: sp.x, top: sp.y, fill: sp.color }}
            initial={false}
            animate={animated ? { scale: [0.3, 1, 0.3], opacity: [0, 1, 0], rotate: [0, 45, 90] } : { scale: 1, opacity: 0.9 }}
            transition={animated ? { duration: 2.6, repeat: Infinity, delay: sp.delay, ease: "easeInOut" } : { duration: 0 }}
          >
            <path d={SPARK} />
          </m.svg>
        );
      })}
    </>
  );
}

/**
 * Круглый бейдж с номером уровня; вид — по ступени.
 * `plate` — бейдж на цветном фоне (золотое свечение кейса): золотое кольцо и тень, а у обычной ступени вместо бледно-серой заливки —
 * цвет карточки (`surface`), чтобы число не терялось ни в светлой, ни в тёмной теме.
 */
export function LevelBadge({ level, size = "md", className, plate }: { level: number; size?: LevelBadgeSize; className?: string; plate?: boolean }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const { box, ring } = SIZE[size];
  const tier = levelTier(level);
  const animated = !reduce;
  const digits = String(level).length;
  const fontSize = Math.round(box * (digits <= 2 ? 0.5 : 0.36));
  const shadow = glowShadow(tier, box);

  const number = (
    <span className="relative font-extrabold leading-none tabular-nums text-text" style={{ fontSize }}>
      {level}
    </span>
  );

  return (
    <span
      role="img"
      aria-label={`${t("stats.level")} ${level}`}
      className={cn("relative inline-grid shrink-0 place-items-center align-middle", plate && "rounded-full bg-surface shadow-md ring-[3px] ring-gold", className)}
      style={{ width: box, height: box }}
    >
      {shadow && <span aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: shadow }} />}

      {tier === "mythic" ? (
        <>
          <m.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: MYTHIC_CONIC }}
            initial={false}
            animate={animated ? { rotate: 360 } : { rotate: 0 }}
            transition={animated ? { duration: 7, ease: "linear", repeat: Infinity } : { duration: 0 }}
          />
          <span className="relative grid place-items-center rounded-full bg-surface" style={{ width: box - ring * 2, height: box - ring * 2 }}>
            {number}
          </span>
          <Sparks box={box} animated={animated} count={size === "sm" ? 2 : 3} />
        </>
      ) : (
        <span
          className={cn(
            "relative grid size-full place-items-center overflow-hidden rounded-full",
            plate && tier === "common" ? "bg-surface" : RARITY_SOFT[tier],
            tier !== "common" && cn("border-solid", RARITY_BORDER[tier]),
          )}
          style={tier === "common" ? undefined : { borderWidth: ring }}
        >
          {number}
          {tier === "legendary" && animated && (
            <m.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/70 to-transparent"
              initial={{ x: "-160%" }}
              animate={{ x: ["-160%", "260%", "260%"] }}
              transition={{ duration: 4.6, times: [0, 0.32, 1], repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </span>
      )}
    </span>
  );
}

/** Плашка в цвете ступени («Новая ступень: Редкий уровень!»). Мифическая — с переливающейся рамкой всех цветов редкости. */
export function TierPill({ tier, children, className }: { tier: LevelTier; children: ReactNode; className?: string }) {
  const body = "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-center text-sm font-extrabold text-text";
  if (tier === "mythic") {
    return (
      <span
        className={cn("inline-flex rounded-full p-0.5", className)}
        style={{ background: "linear-gradient(90deg, var(--rarity-common), var(--rarity-rare), var(--rarity-epic), var(--rarity-legendary))" }}
      >
        <span className={cn(body, "flex-1 bg-surface")}>{children}</span>
      </span>
    );
  }
  return <span className={cn(body, "border-2 border-solid", RARITY_SOFT[tier], RARITY_BORDER[tier], className)}>{children}</span>;
}
