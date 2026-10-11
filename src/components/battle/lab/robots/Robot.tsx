"use client";

import { useId } from "react";
import { m, useAnimationControls, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { GEARS, PALETTES, piv, type Palette } from "./skins";

// Робот-Бит в полный рост (вид сбоку, лицом вправо). Геометрия — из маскота Бит: скруглённый корпус-голова,
// тёмный визор, голубые глаза, антенна с шариком. Руки двухзвенные: анимируются поворотом плеча и локтя.
// viewBox 140×200, земля — y≈192.

export type AnimationControls = ReturnType<typeof useAnimationControls>;

export interface RobotCtl {
  fU: AnimationControls;
  fF: AnimationControls;
  bU: AnimationControls;
  bF: AnimationControls;
  hurt: AnimationControls;
}

export function useRobotCtl(): RobotCtl {
  return { fU: useAnimationControls(), fF: useAnimationControls(), bU: useAnimationControls(), bF: useAnimationControls(), hurt: useAnimationControls() };
}

export interface Pose {
  fU: number;
  fF: number;
  bU: number;
  bF: number;
}

/** Углы суставов (градусы, 0 = рука вниз, минус = вперёд-вверх). */
export const POSE: Record<"guard" | "wind" | "punch" | "upper" | "hurt" | "limp" | "stun" | "win", Pose> = {
  guard: { fU: -30, fF: -105, bU: -58, bF: -82 },
  wind: { fU: 22, fF: -35, bU: -58, bF: -82 },
  punch: { fU: -84, fF: -6, bU: -62, bF: -90 },
  upper: { fU: -14, fF: -165, bU: 20, bF: -60 },
  hurt: { fU: 36, fF: -14, bU: 28, bF: -20 },
  limp: { fU: 16, fF: 8, bU: 10, bF: 6 },
  stun: { fU: 24, fF: -30, bU: 14, bF: -16 },
  win: { fU: -158, fF: -16, bU: -38, bF: -92 },
};

const PIVOT = piv(0, 0);

interface ArmProps {
  x: number;
  y: number;
  upper: AnimationControls;
  fore: AnimationControls;
  initU: number;
  initF: number;
  p: Palette;
  back?: boolean;
  swing?: boolean;
}

function Arm({ x, y, upper, fore, initU, initF, p, back, swing }: ArmProps) {
  const limb = back ? p.lo : p.limb;
  return (
    <g transform={`translate(${x} ${y})`}>
      <m.g initial={{ rotate: initU }} animate={upper} style={PIVOT}>
        <line x1="0" y1="0" x2="0" y2="21" stroke={p.ol} strokeWidth="15" strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2="21" stroke={limb} strokeWidth="10.5" strokeLinecap="round" />
        <g transform="translate(0 21)">
          <m.g initial={{ rotate: initF }} animate={fore} style={PIVOT}>
            <line x1="0" y1="0" x2="0" y2="17" stroke={p.ol} strokeWidth="15" strokeLinecap="round" />
            <line x1="0" y1="0" x2="0" y2="17" stroke={limb} strokeWidth="10.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="6.5" fill={p.trim} stroke={p.ol} strokeWidth="2.5" />
            {/* Кулак-перчатка. */}
            <g transform={swing ? "translate(0 2)" : undefined}>
              <circle cx="0" cy="24" r="11" fill={back ? p.lo : p.glove} stroke={p.ol} strokeWidth="3" />
              <circle cx="-3.4" cy="20.5" r="3.4" fill="#fff" opacity="0.45" />
              <path d="M-8 17 H8" stroke={p.ol} strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
            </g>
          </m.g>
        </g>
      </m.g>
    </g>
  );
}

interface RobotProps {
  skin: string;
  ctl?: RobotCtl;
  /** Побеждён — «× _ ×» на визоре. */
  dead?: boolean;
  /** Оглушён — «× _ ×» и короткое замыкание. */
  stunned?: boolean;
  /** Показать только голову (аватар). */
  bust?: boolean;
  /** Спокойная стойка с дыханием. */
  idle?: boolean;
  className?: string;
}

export function Robot({ skin, ctl, dead, stunned, bust, idle = true, className }: RobotProps) {
  const reduce = useReducedMotion();
  const loop = idle && !reduce;
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = PALETTES[skin] ?? PALETTES.bit;
  const g = GEARS[skin] ?? GEARS.bit;
  const own = useRobotCtl();
  const c = ctl ?? own;
  const gc = { p, u, loop };
  const x = dead || stunned;
  const headFill = p.head ? p.head : `url(#${u}b)`;
  const wide = skin === "batyr" ? 4 : skin === "ninja" ? -2 : 0;

  return (
    <svg
      viewBox={bust ? "24 22 120 120" : "0 0 168 240"}
      className={cn("block overflow-visible", className)}
      role="img"
      aria-label="Робот"
      width="100%"
      height="100%"
    >
      <defs>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1">
          {p.stops.map(([o, col]) => (
            <stop key={o} offset={o} stopColor={col} />
          ))}
        </linearGradient>
        <linearGradient id={`${u}wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6b8" />
          <stop offset="0.55" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#e8a313" />
        </linearGradient>
        <radialGradient id={`${u}aura`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe27a" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ffc933" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffc933" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}ray`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffe27a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${u}dome`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bfeaff" stopOpacity="0.38" />
          <stop offset="0.7" stopColor="#7fb8e8" stopOpacity="0.16" />
          <stop offset="1" stopColor="#4a7bc0" stopOpacity="0.3" />
        </radialGradient>
        <pattern id={`${u}mail`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#7b88a4" />
          <circle cx="3" cy="3" r="2.1" fill="none" stroke="#c5d0e2" strokeWidth="1.1" />
        </pattern>
      </defs>

      <g transform="translate(14 34)">
      {!bust && <ellipse cx="72" cy="194" rx="58" ry="6.5" fill="#000" opacity="0.38" />}

      {/* Плащ, крылья, рюкзак, сияние — позади ног и тела (и тоже дышат). */}
      <m.g animate={loop ? { y: [0, -2.4, 0] } : undefined} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
        {g.back?.(gc)}
      </m.g>

      {/* Ноги (не дышат). */}
      {!bust && (
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M58 138 L47 162 L38 183" stroke={p.ol} strokeWidth="18" />
          <path d="M84 138 L96 160 L103 182" stroke={p.ol} strokeWidth="18" />
          <path d="M58 138 L47 162 L38 183" stroke={p.lo} strokeWidth="11.5" />
          <path d="M84 138 L96 160 L103 182" stroke={p.limb} strokeWidth="11.5" />
          <circle cx="47" cy="162" r="5.6" fill={p.trim} stroke={p.ol} strokeWidth="2.2" />
          <circle cx="96" cy="160" r="5.6" fill={p.trim} stroke={p.ol} strokeWidth="2.2" />
          <rect x="24" y="178" width="30" height="15" rx="7.5" fill={p.boot} stroke={p.ol} strokeWidth="3" />
          <rect x="89" y="177" width="32" height="16" rx="8" fill={p.boot} stroke={p.ol} strokeWidth="3" />
          <path d="M31 183 H44 M96 182 H112" stroke="#fff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}

      {/* Верхняя часть тела «дышит». */}
      <m.g
        animate={loop ? { y: [0, -2.4, 0] } : undefined}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >

        {/* Уши-блоки (как у маскота). */}
        <rect x="14" y="47" width="15" height="28" rx="7.5" fill={p.lo} stroke={p.ol} strokeWidth="3" />
        <rect x="111" y="47" width="15" height="28" rx="7.5" fill={p.lo} stroke={p.ol} strokeWidth="3" />

        {g.headBack?.(gc)}

        {/* Задняя рука (за корпусом). */}
        {!bust && <Arm x={52} y={113} upper={c.bU} fore={c.bF} initU={POSE.guard.bU} initF={POSE.guard.bF} p={p} back />}

        {/* Шея и корпус. */}
        {!bust && (
          <>
            <rect x="62" y="88" width="16" height="16" rx="4" fill={p.lo} stroke={p.ol} strokeWidth="3" />
            <rect x={48 - wide} y="100" width={44 + wide * 2} height="44" rx="16" fill={`url(#${u}b)`} stroke={p.ol} strokeWidth="3" />
            <rect x={54 - wide} y="104" width={32 + wide * 2} height="7" rx="3.5" fill="#fff" opacity="0.2" />
            {g.torso?.(gc)}
          </>
        )}

        {/* Голова. */}
        <rect x="26" y="22" width="88" height="72" rx="28" fill={headFill} stroke={p.ol} strokeWidth="3" />
        <rect x="36" y="27" width="68" height="11" rx="5.5" fill="#fff" opacity="0.2" />

        {/* Визор и лицо. */}
        <rect x="36" y="32" width="72" height="50" rx="17" fill={p.visor} stroke={p.ol} strokeWidth="2.5" />
        <path d="M46 36 H72 L58 48 H44Z" fill="#fff" opacity="0.07" />

        <g style={{ opacity: x ? 0 : 1 }}>
          <m.g
                        animate={loop ? { scaleY: [1, 1, 0.12, 1, 1] } : undefined}
            transition={{ duration: 4.6, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] }}
          >
            <rect x="52" y="48" width="11" height="15" rx="5.5" fill={p.eye} stroke={p.eye} strokeOpacity="0.28" strokeWidth="7" />
            <rect x="84" y="48" width="11" height="15" rx="5.5" fill={p.eye} stroke={p.eye} strokeOpacity="0.28" strokeWidth="7" />
          </m.g>
          {/* Решительные брови. */}
          <path d="M48 43 L66 49 M99 43 L81 49" stroke={p.eye} strokeWidth="3.4" strokeLinecap="round" />
        </g>
        {!x && skin !== "ninja" && <path d="M64 72 q8 5 16 0" stroke={p.eye} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9" />}

        {/* Удар: глаза-«> <». */}
        <m.g initial={{ opacity: 0 }} animate={c.hurt}>
          <rect x="40" y="38" width="64" height="38" rx="13" fill={p.visor} />
          <g stroke={p.eye} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M50 47 L62 55 L50 63" />
            <path d="M97 47 L85 55 L97 63" />
            <path d="M67 70 q6 -4 12 0" />
          </g>
        </m.g>

        {/* Замыкание / побеждён: «× _ ×». */}
        {x && (
          <g>
            <rect x="40" y="38" width="64" height="38" rx="13" fill={p.visor} />
            <g stroke={p.eye} strokeWidth="4.2" strokeLinecap="round" fill="none">
              <path d="M49 47 L61 59 M61 47 L49 59" />
              <path d="M85 47 L97 59 M97 47 L85 59" />
              <path d="M66 70 H80" />
            </g>
          </g>
        )}

        {g.head?.(gc)}

        {/* Антенна. */}
        {!g.noAntenna && (
          <m.g
            style={piv(70, 22)}
            animate={loop ? { rotate: [-4, 4, -4] } : undefined}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <line x1="70" y1="22" x2="70" y2="9" stroke={p.ol} strokeWidth="8" strokeLinecap="round" />
            <line x1="70" y1="22" x2="70" y2="9" stroke={p.lo} strokeWidth="4" strokeLinecap="round" />
            <circle cx="70" cy="6" r="7.5" fill="#f0b400" stroke={p.ol} strokeWidth="3" />
            <circle cx="67.6" cy="3.6" r="2.3" fill="#fff" opacity="0.7" />
          </m.g>
        )}

        {/* Передняя рука. */}
        {!bust && <Arm x={90} y={113} upper={c.fU} fore={c.fF} initU={POSE.guard.fU} initF={POSE.guard.fF} p={p} swing />}

        {g.front?.(gc)}
      </m.g>
      </g>
    </svg>
  );
}
