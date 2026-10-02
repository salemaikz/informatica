"use client";

import type { ReactNode } from "react";
import type { UnitTheme } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useReduceMotion } from "@/components/motion/useReduceMotion";

// Лёгкий SVG-декор «местности» раздела (цвет — переменная --u из unitVars). Без картинок.
// Покачивание — нативной SMIL-анимацией (без JS на каждый кадр); при «меньше анимаций» — статично.

const U = "var(--u)";

function Float({ children, dy = 4, dur = 5, delay = 0 }: { children: ReactNode; dy?: number; dur?: number; delay?: number }) {
  const reduce = useReduceMotion();
  return (
    <g>
      {!reduce && (
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`0 0;0 ${-dy};0 0`}
          dur={`${dur}s`}
          begin={`${-delay}s`}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      )}
      {children}
    </g>
  );
}

function Twinkle({ x, y, r = 4, delay = 0 }: { x: number; y: number; r?: number; delay?: number }) {
  const reduce = useReduceMotion();
  const d = `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
  return (
    <path d={d} fill={U} opacity={0.7}>
      {!reduce && <animate attributeName="opacity" values="0.25;0.85;0.25" dur="3s" begin={`${-delay}s`} repeatCount="indefinite" />}
    </path>
  );
}

const glyph = { fontFamily: "var(--font-mono)", fontWeight: 800, fill: U } as const;

function Island({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <path d={`M${x - w} ${y}Q${x} ${y + w * 1.1} ${x + w} ${y}Z`} fill={U} opacity={0.22} />
      <ellipse cx={x} cy={y} rx={w} ry={w / 4} fill={U} opacity={0.45} />
    </g>
  );
}

function Numbers() {
  return (
    <>
      <Float dur={6}>
        <Island x={44} y={86} w={28} />
        <text x={36} y={80} fontSize={20} {...glyph} opacity={0.75}>1</text>
      </Float>
      <Float dur={7} delay={2} dy={5}>
        <Island x={124} y={64} w={20} />
        <text x={118} y={58} fontSize={16} {...glyph} opacity={0.75}>0</text>
      </Float>
      <Float dur={4} delay={1} dy={6}>
        <text x={76} y={34} fontSize={26} {...glyph} opacity={0.5}>1</text>
      </Float>
      <Float dur={5} delay={3} dy={5}>
        <text x={18} y={36} fontSize={18} {...glyph} opacity={0.4}>0</text>
        <text x={136} y={26} fontSize={14} {...glyph} opacity={0.35}>1</text>
      </Float>
    </>
  );
}

function Logic() {
  return (
    <>
      <g stroke={U} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.75}>
        <path d="M30 40H64M30 66H64M108 53H138" />
        <path d="M64 30H84A23 23 0 0 1 84 76H64Z" fill={U} fillOpacity={0.14} />
      </g>
      <Float dur={3} dy={0}>
        <circle cx={30} cy={40} r={5} fill={U} />
        <circle cx={30} cy={66} r={5} fill={U} opacity={0.4} />
        <circle cx={138} cy={53} r={5} fill={U} opacity={0.4} />
      </Float>
      <Float dur={5} delay={1}>
        <rect x={24} y={88} width={40} height={20} rx={10} fill={U} opacity={0.5} />
        <circle cx={54} cy={98} r={7} fill="var(--surface)" />
      </Float>
      <Float dur={6} delay={3}>
        <rect x={98} y={84} width={40} height={20} rx={10} fill="none" stroke={U} strokeWidth={3} opacity={0.5} />
        <circle cx={108} cy={94} r={6} fill={U} opacity={0.5} />
      </Float>
    </>
  );
}

function Code() {
  return (
    <>
      <Float dur={6}>
        <rect x={66} y={24} width={82} height={58} rx={9} fill={U} fillOpacity={0.1} stroke={U} strokeWidth={3} opacity={0.75} />
        <path d="M66 38H148" stroke={U} strokeWidth={2.5} opacity={0.5} />
        <circle cx={75} cy={31} r={2.5} fill={U} opacity={0.6} />
        <circle cx={83} cy={31} r={2.5} fill={U} opacity={0.6} />
        <text x={76} y={62} fontSize={15} {...glyph} opacity={0.8}>{">_"}</text>
        <path d="M76 72H118" stroke={U} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      </Float>
      <Float dur={4} delay={1} dy={5}>
        <text x={10} y={68} fontSize={34} {...glyph} opacity={0.4}>{"{}"}</text>
      </Float>
      <Float dur={5} delay={2.5} dy={4}>
        <text x={92} y={108} fontSize={16} {...glyph} opacity={0.45}>{"</>"}</text>
      </Float>
    </>
  );
}

function Cylinder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ry = w / 3.2;
  return (
    <g stroke={U} strokeWidth={3} fill={U} fillOpacity={0.12} opacity={0.75}>
      <path d={`M${x - w} ${y}V${y + h}A${w} ${ry} 0 0 0 ${x + w} ${y + h}V${y}`} />
      <path d={`M${x - w} ${y + h / 2}A${w} ${ry} 0 0 0 ${x + w} ${y + h / 2}`} fill="none" />
      <ellipse cx={x} cy={y} rx={w} ry={ry} fillOpacity={0.3} />
    </g>
  );
}

function Data() {
  return (
    <>
      <Float dur={6}>
        <g stroke={U} strokeWidth={2.5} opacity={0.65} fill="none">
          <rect x={14} y={34} width={66} height={48} rx={6} fill={U} fillOpacity={0.08} />
          <path d="M14 50H80M14 66H80M36 34V82M58 34V82" />
        </g>
        <rect x={14} y={34} width={66} height={16} rx={6} fill={U} opacity={0.35} />
      </Float>
      <Float dur={5} delay={1.5} dy={5}>
        <Cylinder x={118} y={34} w={22} h={44} />
      </Float>
      <Float dur={7} delay={3} dy={3}>
        <Cylinder x={74} y={96} w={13} h={14} />
      </Float>
    </>
  );
}

function Hardware() {
  return (
    <>
      <g stroke={U} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.45}>
        <path d="M72 44H46V22H18M72 64H38V100M116 50H142V24M96 76V100H140" />
      </g>
      <g fill={U} opacity={0.6}>
        <circle cx={18} cy={22} r={4} />
        <circle cx={38} cy={100} r={4} />
        <circle cx={142} cy={24} r={4} />
        <circle cx={140} cy={100} r={4} />
      </g>
      <Float dur={5} dy={3}>
        <g stroke={U} strokeWidth={3} strokeLinecap="round" opacity={0.7}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <path d={`M${80 + i * 9} 26V20M${80 + i * 9} 86V92M66 ${40 + i * 9}H60M120 ${40 + i * 9}H126`} />
            </g>
          ))}
        </g>
        <rect x={66} y={26} width={54} height={60} rx={8} fill={U} fillOpacity={0.16} stroke={U} strokeWidth={3} opacity={0.8} />
        <rect x={80} y={42} width={26} height={28} rx={4} fill={U} opacity={0.45} />
      </Float>
    </>
  );
}

function Network() {
  return (
    <>
      <g stroke={U} strokeWidth={2.5} opacity={0.4} strokeDasharray="4 5">
        <path d="M24 30L80 56M40 92L80 64M148 102L126 82" />
      </g>
      <Float dur={6} dy={3}>
        <g stroke={U} strokeWidth={3} fill="none" opacity={0.75}>
          <circle cx={108} cy={58} r={32} fill={U} fillOpacity={0.1} />
          <ellipse cx={108} cy={58} rx={13} ry={32} />
          <path d="M76 58H140M81 42H135M81 74H135" />
        </g>
      </Float>
      <Float dur={4} delay={1} dy={5}>
        <circle cx={24} cy={30} r={7} fill={U} opacity={0.6} />
      </Float>
      <Float dur={5} delay={2} dy={4}>
        <circle cx={40} cy={92} r={6} fill={U} opacity={0.5} />
      </Float>
      <Float dur={4.5} delay={3} dy={4}>
        <circle cx={148} cy={102} r={5} fill={U} opacity={0.45} />
      </Float>
    </>
  );
}

function Office() {
  return (
    <>
      <Float dur={6} dy={3}>
        <g stroke={U} strokeWidth={2.5} fill="none" opacity={0.6}>
          <rect x={22} y={22} width={124} height={80} rx={8} fill={U} fillOpacity={0.08} />
          <path d="M22 40H146M22 60H146M22 80H146M46 22V102M80 22V102M114 22V102" />
        </g>
        <rect x={22} y={22} width={124} height={18} rx={8} fill={U} opacity={0.25} />
        <rect x={80} y={60} width={34} height={20} fill={U} opacity={0.35} stroke={U} strokeWidth={3.5} />
      </Float>
      <Float dur={4} delay={1.5} dy={5}>
        <text x={2} y={66} fontSize={17} {...glyph} fontStyle="italic" opacity={0.55}>fx</text>
      </Float>
    </>
  );
}

function Future() {
  return (
    <>
      <Twinkle x={24} y={26} r={6} />
      <Twinkle x={56} y={90} r={4} delay={1} />
      <Twinkle x={146} y={30} r={5} delay={2} />
      <Twinkle x={20} y={84} r={3} delay={1.6} />
      <Float dur={3.5} dy={6}>
        <g transform="rotate(35 98 58)">
          <path d="M98 18C112 30 114 54 110 76H86C82 54 84 30 98 18Z" fill={U} fillOpacity={0.2} stroke={U} strokeWidth={3} opacity={0.85} />
          <circle cx={98} cy={46} r={7} fill="var(--surface)" stroke={U} strokeWidth={3} />
          <path d="M86 62L74 80H88M110 62L122 80H108" fill={U} opacity={0.45} />
          <path d="M90 80Q98 104 106 80Z" fill="var(--streak)" opacity={0.75} />
        </g>
      </Float>
    </>
  );
}

function Summit() {
  const reduce = useReduceMotion();
  return (
    <>
      <circle cx={132} cy={30} r={12} fill="var(--gold)" opacity={0.45} />
      <path d="M8 108L58 40L86 74L104 54L156 108Z" fill={U} opacity={0.3} />
      <path d="M58 40L70 56L62 54L54 60L48 54Z" fill="var(--surface)" opacity={0.9} />
      <path d="M104 54L114 66L106 64L98 68Z" fill="var(--surface)" opacity={0.8} />
      <g>
        <path d="M58 40V16" stroke={U} strokeWidth={3} strokeLinecap="round" />
        <path d="M58 16L78 22L58 28Z" fill="var(--gold)">
          {!reduce && <animate attributeName="d" values="M58 16L78 22L58 28Z;M58 16L76 24L58 28Z;M58 16L78 22L58 28Z" dur="2.4s" repeatCount="indefinite" />}
        </path>
      </g>
    </>
  );
}

const ART: Record<UnitTheme, () => ReactNode> = {
  numbers: Numbers,
  logic: Logic,
  code: Code,
  data: Data,
  hardware: Hardware,
  network: Network,
  office: Office,
  future: Future,
  summit: Summit,
};

/** Декор раздела. Цвет берёт из --u (задать unitVars на родителе). */
export function UnitArt({ theme, className }: { theme?: UnitTheme; className?: string }) {
  const Art = ART[theme ?? "numbers"];
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={cn("pointer-events-none select-none", className)}>
      <Art />
    </svg>
  );
}
