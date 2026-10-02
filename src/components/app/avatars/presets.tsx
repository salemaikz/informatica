import type { JSX, ReactNode } from "react";
import { AVATAR_PRESET_IDS, type AvatarPresetId } from "@/lib/avatar";
import type { L } from "@/lib/types";

// 12 рисованных аватаров в стиле маскота «Бит» (components/mascot/Mascot.tsx): плоские SVG без внешних картинок.
// Каждый рисуется на квадрате 120×120 с фоном; круг вырезает обёртка <Avatar>.
// Цвета в SVG — фиксированные (как у маскота): иллюстрация одинаково выглядит в светлой и тёмной теме.

type Props = { size: number };

const EYE = "#7fe3ff";

function Frame({ size, bg, children }: Props & { bg: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false" className="block">
      <rect width="120" height="120" fill={bg} />
      {children}
    </svg>
  );
}

/** Бит анфас (крупнее, чем в уроках, чтобы лицо читалось в маленьком круге). */
function Bit({
  body = "#1a91d6",
  dark = "#1277b3",
  ball = "#f0b400",
  antenna = true,
  before,
  after,
}: {
  body?: string;
  dark?: string;
  ball?: string;
  antenna?: boolean;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <g transform="translate(60 71) scale(0.88) translate(-60 -64)">
      {before}
      {antenna && (
        <>
          <line x1="60" y1="14" x2="60" y2="27" stroke={dark} strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="11" r="6.5" fill={ball} />
        </>
      )}
      <rect x="9" y="54" width="12" height="24" rx="6" fill={dark} />
      <rect x="99" y="54" width="12" height="24" rx="6" fill={dark} />
      <rect x="17" y="26" width="86" height="78" rx="28" fill={body} />
      <rect x="25" y="30" width="70" height="16" rx="8" fill="#fff" opacity="0.18" />
      <rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />
      <g stroke={EYE} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M39 64 q7 -9 14 0" />
        <path d="M67 64 q7 -9 14 0" />
      </g>
      <path d="M50 75 q10 9 20 0" stroke={EYE} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="35" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
      <circle cx="85" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
      {after}
    </g>
  );
}

function BitBlue({ size }: Props) {
  return (
    <Frame size={size} bg="#d9effb">
      <Bit />
    </Frame>
  );
}

function BitHeadphones({ size }: Props) {
  return (
    <Frame size={size} bg="#e8e1ff">
      <Bit
        after={
          <>
            <path d="M23 56 C21 12 99 12 97 56" fill="none" stroke="#2b3a52" strokeWidth="7" strokeLinecap="round" />
            <rect x="8" y="46" width="16" height="30" rx="8" fill="#7c5cff" />
            <rect x="96" y="46" width="16" height="30" rx="8" fill="#7c5cff" />
            <rect x="12" y="52" width="5" height="18" rx="2.5" fill="#fff" opacity="0.35" />
            <rect x="103" y="52" width="5" height="18" rx="2.5" fill="#fff" opacity="0.35" />
          </>
        }
      />
    </Frame>
  );
}

function BitGlasses({ size }: Props) {
  return (
    <Frame size={size} bg="#fff1cf">
      <Bit
        body="#2fb57a"
        dark="#1f8f5d"
        after={
          <g fill="rgba(127,227,255,0.18)" stroke="#f0b400" strokeWidth="4" strokeLinejoin="round">
            <rect x="31" y="51" width="27" height="25" rx="9" />
            <rect x="62" y="51" width="27" height="25" rx="9" />
            <path d="M58 61 h4" fill="none" strokeLinecap="round" />
            <path d="M31 60 l-9 -3 M89 60 l9 -3" fill="none" strokeLinecap="round" />
          </g>
        }
      />
    </Frame>
  );
}

function BitCap({ size }: Props) {
  return (
    <Frame size={size} bg="#ffe3e3">
      <Bit
        antenna={false}
        after={
          <>
            <path d="M20 40 C20 8 100 8 100 40 Z" fill="#e5484d" />
            <path d="M52 40 H118 a4 4 0 0 1 0 8 H52 Z" fill="#c23a3f" />
            <circle cx="60" cy="12" r="4.5" fill="#f0b400" />
            <path d="M36 28 C42 18 52 14 60 14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
          </>
        }
      />
    </Frame>
  );
}

function BitGrad({ size }: Props) {
  return (
    <Frame size={size} bg="#e4f3fc">
      <Bit
        antenna={false}
        after={
          <>
            <path d="M32 34 v-8 L60 34 L88 26 v8 C88 44 32 44 32 34 Z" fill="#26364a" />
            <path d="M60 4 L110 22 L60 40 L10 22 Z" fill="#1b2a3a" />
            <path d="M60 10 L96 23 L60 36 L24 23 Z" fill="#26364a" />
            <path d="M104 24 v22" stroke="#f0b400" strokeWidth="3" strokeLinecap="round" />
            <circle cx="104" cy="49" r="4.5" fill="#f0b400" />
          </>
        }
      />
    </Frame>
  );
}

function BitCrown({ size }: Props) {
  return (
    <Frame size={size} bg="#fff6d6">
      <Bit
        antenna={false}
        body="#ff8a3d"
        dark="#d96a1d"
        after={
          <>
            <path d="M30 32 L33 6 L47 20 L60 2 L73 20 L87 6 L90 32 Z" fill="#f0b400" stroke="#d99a00" strokeWidth="2" strokeLinejoin="round" />
            <rect x="30" y="28" width="60" height="8" rx="4" fill="#d99a00" />
            <circle cx="33" cy="6" r="3.5" fill="#fff" />
            <circle cx="60" cy="2" r="3.5" fill="#fff" />
            <circle cx="87" cy="6" r="3.5" fill="#fff" />
            <circle cx="60" cy="32" r="3" fill="#e5484d" />
          </>
        }
      />
    </Frame>
  );
}

function BitScarf({ size }: Props) {
  return (
    <Frame size={size} bg="#dff6ea">
      <Bit
        body="#9a6bff"
        dark="#7449d6"
        after={
          <>
            <rect x="20" y="88" width="80" height="17" rx="8.5" fill="#e5484d" />
            <rect x="72" y="96" width="17" height="30" rx="7" fill="#c23a3f" />
            <path d="M30 94 h10 M50 94 h10 M70 94 h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
            <path d="M76 114 h9" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
          </>
        }
      />
    </Frame>
  );
}

function BitLaptop({ size }: Props) {
  return (
    <Frame size={size} bg="#e1ecff">
      <Bit
        after={
          <>
            <rect x="26" y="90" width="68" height="34" rx="6" fill="#dfe5ee" stroke="#b6c0cf" strokeWidth="2.5" />
            <path d="M60 101 l-5 8 h4 l-3 7 8 -9 h-4 l4 -6 z" fill="#f0b400" />
            <rect x="9" y="76" width="12" height="16" rx="6" fill="#1277b3" />
            <rect x="99" y="76" width="12" height="16" rx="6" fill="#1277b3" />
          </>
        }
      />
    </Frame>
  );
}

function BitBolt({ size }: Props) {
  return (
    <Frame size={size} bg="#f2e8ff">
      <Bit
        antenna={false}
        body="#7c5cff"
        dark="#5b3fd1"
        before={
          <>
            <line x1="60" y1="16" x2="60" y2="27" stroke="#5b3fd1" strokeWidth="4" strokeLinecap="round" />
            <path d="M66 -8 L50 12 H59 L53 28 L72 6 H62 Z" fill="#f0b400" stroke="#d99a00" strokeWidth="1.5" strokeLinejoin="round" />
          </>
        }
      />
    </Frame>
  );
}

function OwlCoder({ size }: Props) {
  return (
    <Frame size={size} bg="#ece7ff">
      <path d="M28 40 L24 14 L48 28 Z" fill="#6a4bd8" />
      <path d="M92 40 L96 14 L72 28 Z" fill="#6a4bd8" />
      <ellipse cx="60" cy="72" rx="42" ry="44" fill="#7c5cff" />
      <ellipse cx="60" cy="88" rx="26" ry="24" fill="#b9a6ff" opacity="0.55" />
      <path d="M48 84 l-6 6 6 6 M72 84 l6 6 -6 6 M64 82 l-8 16" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="58" r="17" fill="#fff" />
      <circle cx="78" cy="58" r="17" fill="#fff" />
      <circle cx="44" cy="59" r="8" fill="#10263d" />
      <circle cx="76" cy="59" r="8" fill="#10263d" />
      <circle cx="47" cy="56" r="2.5" fill="#fff" />
      <circle cx="79" cy="56" r="2.5" fill="#fff" />
      <g fill="none" stroke="#2b3a52" strokeWidth="3.5">
        <circle cx="42" cy="58" r="19" />
        <circle cx="78" cy="58" r="19" />
        <path d="M61 58 h-2" strokeLinecap="round" />
      </g>
      <path d="M54 70 L66 70 L60 80 Z" fill="#f0b400" />
    </Frame>
  );
}

function CatHacker({ size }: Props) {
  return (
    <Frame size={size} bg="#d9f1e6">
      <path d="M22 52 L26 14 L52 34 Z" fill="#26364a" />
      <path d="M98 52 L94 14 L68 34 Z" fill="#26364a" />
      <path d="M30 40 L32 24 L44 34 Z" fill="#ff8fb1" />
      <path d="M90 40 L88 24 L76 34 Z" fill="#ff8fb1" />
      <ellipse cx="60" cy="70" rx="42" ry="38" fill="#33445c" />
      <rect x="26" y="52" width="68" height="24" rx="12" fill="#10263d" />
      <ellipse cx="43" cy="64" rx="9" ry="7" fill="#35e08a" />
      <ellipse cx="77" cy="64" rx="9" ry="7" fill="#35e08a" />
      <ellipse cx="43" cy="64" rx="2.5" ry="6" fill="#10263d" />
      <ellipse cx="77" cy="64" rx="2.5" ry="6" fill="#10263d" />
      <path d="M55 82 L65 82 L60 88 Z" fill="#ff8fb1" />
      <path d="M60 88 v5 M60 93 q-6 5 -12 1 M60 93 q6 5 12 1" fill="none" stroke="#9fb0c7" strokeWidth="2.5" strokeLinecap="round" />
      <g stroke="#9fb0c7" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 80 h-12 M22 88 l-11 4" />
        <path d="M98 80 h12 M98 88 l11 4" />
      </g>
      <path d="M18 108 C24 92 96 92 102 108 V120 H18 Z" fill="#1b2a3a" />
    </Frame>
  );
}

function Rocket({ size }: Props) {
  return (
    <Frame size={size} bg="#10263d">
      <g fill="#fff">
        <circle cx="20" cy="24" r="2" />
        <circle cx="98" cy="18" r="2.5" />
        <circle cx="92" cy="58" r="1.8" />
        <circle cx="26" cy="70" r="1.6" />
        <circle cx="104" cy="92" r="2" />
      </g>
      <g transform="rotate(35 60 60)">
        <path d="M60 106 C50 106 52 124 60 134 C68 124 70 106 60 106 Z" fill="#ff8a3d" />
        <path d="M60 106 C56 106 57 116 60 122 C63 116 64 106 60 106 Z" fill="#f0b400" />
        <path d="M44 86 C32 90 30 106 30 108 L48 98 Z" fill="#e5484d" />
        <path d="M76 86 C88 90 90 106 90 108 L72 98 Z" fill="#e5484d" />
        <path d="M60 6 C40 22 40 60 46 108 H74 C80 60 80 22 60 6 Z" fill="#f4f7fb" />
        <path d="M60 6 C48 18 44 36 44 56 H76 C76 36 72 18 60 6 Z" fill="#1a91d6" />
        <circle cx="60" cy="68" r="12" fill="#10263d" stroke="#b6c0cf" strokeWidth="4" />
        <circle cx="56" cy="64" r="3.5" fill="#7fe3ff" />
      </g>
    </Frame>
  );
}

export type AvatarPreset = { id: AvatarPresetId; label: L; Component: (props: { size: number }) => JSX.Element };

// Record по AvatarPresetId: TypeScript не даст забыть рисунок для id из lib/avatar.ts (и наоборот).
const PRESETS: Record<AvatarPresetId, Omit<AvatarPreset, "id">> = {
  "bit-blue": { label: { ru: "Бит", kk: "Бит" }, Component: BitBlue },
  "bit-headphones": { label: { ru: "Бит в наушниках", kk: "Құлаққапты Бит" }, Component: BitHeadphones },
  "bit-glasses": { label: { ru: "Бит в очках", kk: "Көзілдірікті Бит" }, Component: BitGlasses },
  "bit-cap": { label: { ru: "Бит в кепке", kk: "Кепкалы Бит" }, Component: BitCap },
  "bit-grad": { label: { ru: "Бит-выпускник", kk: "Түлек Бит" }, Component: BitGrad },
  "bit-crown": { label: { ru: "Бит-король", kk: "Бит-патша" }, Component: BitCrown },
  "bit-scarf": { label: { ru: "Бит в шарфе", kk: "Шарф таққан Бит" }, Component: BitScarf },
  "bit-laptop": { label: { ru: "Бит с ноутбуком", kk: "Ноутбукты Бит" }, Component: BitLaptop },
  "bit-bolt": { label: { ru: "Бит с молнией", kk: "Найзағайлы Бит" }, Component: BitBolt },
  "owl-coder": { label: { ru: "Сова-программист", kk: "Жапалақ-бағдарламашы" }, Component: OwlCoder },
  "cat-hacker": { label: { ru: "Кот-хакер", kk: "Мысық-хакер" }, Component: CatHacker },
  rocket: { label: { ru: "Ракета", kk: "Зымыран" }, Component: Rocket },
};

/** 12 рисованных аватаров в порядке сетки 4×3 (порядок — AVATAR_PRESET_IDS). */
export const AVATAR_PRESETS: AvatarPreset[] = AVATAR_PRESET_IDS.map((id) => ({ id, ...PRESETS[id] }));

export function findPreset(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.id === id);
}
