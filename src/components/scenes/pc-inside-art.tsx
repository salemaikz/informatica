import type { CSSProperties, ReactNode } from "react";
import type { PcPart } from "@/lib/types";
import { C, Fan, Stripes, mix } from "./hardware/internals/kit";

// Рисунок «системный блок изнутри» (вид сбоку со снятой крышкой) в координатах корпуса 150 × 236.
// Задняя стенка слева (порты, задний вентилятор), передняя — справа (вентиляторы, накопители), БП внизу.
// Каждая деталь красится шестью «слотами» цвета (--pa … --pf): обычные оттенки или оттенки primary при подсветке.

type Tones = readonly [a: string, b: string, c: string, d: string, e: string, f: string];

/** Обычные оттенки деталей. Primary в них нет: синий означает «выделено». */
const NORMAL: Record<PcPart, Tones> = {
  motherboard: [C.pcb2, C.pcb, C.dark2, C.metal2, C.pcbLine, C.metal3],
  cpu: [C.pcb2, C.metal2, C.gold, C.metal1, C.metal3, C.pcb],
  cooler: [C.metal2, C.metal1, C.dark, C.copper, C.shell3, C.dark2],
  ram: [C.pcb2, C.pcb, C.chip, C.gold, C.chipTop, C.dark2],
  gpu: [C.dark, C.shell3, C.dark2, C.metal2, C.pcb, C.gold],
  psu: [C.dark, C.shell3, C.dark2, C.warning, C.paper, C.danger],
  ssd: [C.dark, C.dark2, C.paper, C.shell3, C.success, C.metal2],
  hdd: [C.metal2, C.metal1, C.metal3, C.paper, C.dark, C.shell3],
  fans: [C.dark, C.dark2, C.shell3, C.shell2, C.shell3, C.dark2],
  ports: [C.metal1, C.metal3, C.dark2, C.success, C.warning, C.metal2],
};

/** Оттенки подсвеченной детали: вся деталь — в гамме primary. */
const HIGHLIGHT: Tones = [
  mix("var(--primary)", 30, "var(--surface)"),
  mix("var(--primary)", 55, "var(--surface)"),
  "var(--primary-strong)",
  "var(--primary)",
  "var(--primary-soft)",
  mix("var(--primary-strong)", 70, "#0b0f17"),
];

const A = "var(--pa)";
const B = "var(--pb)";
const Cc = "var(--pc)";
const D = "var(--pd)";
const E = "var(--pe)";
const F = "var(--pf)";

/** Стиль группы детали: CSS-переменные оттенков. */
export function toneStyle(part: PcPart, lit: boolean): CSSProperties {
  const t = lit ? HIGHLIGHT : NORMAL[part];
  return { "--pa": t[0], "--pb": t[1], "--pc": t[2], "--pd": t[3], "--pe": t[4], "--pf": t[5] } as CSSProperties;
}

/** Корпус: стенки, задняя стенка изнутри, передняя панель с кнопкой. Не подсвечивается. */
export function CaseShell() {
  return (
    <g>
      <rect x={2} y={4} width={150} height={236} rx={8} fill="#000000" fillOpacity={0.12} />
      <rect x={0} y={0} width={150} height={236} rx={7} fill={C.shell2} />
      <rect x={5} y={5} width={137} height={226} rx={4} fill={mix("var(--muted)", 46, "var(--surface)")} />
      {/* отверстия для кабелей */}
      <rect x={116} y={84} width={4} height={16} rx={2} fill={C.dark} opacity={0.5} />
      <rect x={116} y={132} width={4} height={16} rx={2} fill={C.dark} opacity={0.5} />
      {/* полка-кожух над БП */}
      <rect x={5} y={160} width={104} height={3} fill={C.shell3} />
      {/* передняя панель */}
      <rect x={142} y={0} width={8} height={236} rx={3} fill={C.shell1} />
      <circle cx={146} cy={12} r={2.2} fill={C.dark} />
      {/* ножки */}
      <rect x={12} y={234} width={14} height={3} rx={1.5} fill={C.dark} />
      <rect x={120} y={234} width={14} height={3} rx={1.5} fill={C.dark} />
    </g>
  );
}

function Ports() {
  return (
    <g>
      <rect x={7} y={42} width={23} height={52} rx={1.5} fill={A} stroke={B} strokeWidth={1} />
      {/* USB попарно */}
      {[47, 55, 63].map((y) => (
        <g key={y}>
          <rect x={10} y={y} width={7.5} height={5} rx={0.8} fill={Cc} />
          <rect x={11.2} y={y + 1.4} width={5} height={1.6} fill={F} />
          <rect x={19.5} y={y} width={7.5} height={5} rx={0.8} fill={Cc} />
          <rect x={20.7} y={y + 1.4} width={5} height={1.6} fill={F} />
        </g>
      ))}
      {/* сеть (Ethernet) */}
      <rect x={13} y={71} width={10} height={8} rx={0.8} fill={Cc} />
      <rect x={16} y={77} width={4} height={2} fill={A} />
      {/* аудио */}
      <circle cx={12.5} cy={86} r={2.4} fill={D} />
      <circle cx={18.5} cy={86} r={2.4} fill={E} />
      <circle cx={24.5} cy={86} r={2.4} fill={B} />
    </g>
  );
}

function Motherboard() {
  return (
    <g>
      <rect x={34} y={10} width={80} height={146} rx={2.5} fill={A} stroke={B} strokeWidth={1.2} />
      <g stroke={E} strokeWidth={0.7} fill="none" opacity={0.5}>
        <path d="M76 30 H82 V20" />
        <path d="M76 50 H84 V86" />
        <path d="M40 66 V90 H70" />
        <path d="M60 64 V84" />
        <path d="M40 130 H80 V150" />
      </g>
      {/* слоты ОЗУ */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={85 + i * 6.5} y={16} width={4.5} height={64} rx={1} fill={Cc} />
      ))}
      {/* разъём питания 24-pin */}
      <rect x={107} y={122} width={6} height={24} rx={1} fill={D} />
      {/* слоты PCIe */}
      <rect x={38} y={100} width={58} height={4} rx={1} fill={Cc} />
      <rect x={38} y={124} width={58} height={4} rx={1} fill={Cc} />
      <rect x={38} y={136} width={30} height={4} rx={1} fill={Cc} />
      {/* чипсет с радиатором */}
      <rect x={76} y={132} width={20} height={18} rx={2} fill={D} />
      <Stripes x={79} y={134} n={5} w={1.6} h={14} step={3.2} fill={F} />
      {/* VRM-радиатор над сокетом */}
      <rect x={42} y={12} width={30} height={6} rx={1.5} fill={D} />
      {/* батарейка BIOS и винты */}
      <circle cx={50} cy={146} r={4} fill={D} />
      {[
        [38, 14],
        [110, 14],
        [38, 152],
        [110, 152],
        [38, 96],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.6} fill={F} />
      ))}
    </g>
  );
}

function Cpu() {
  return (
    <g>
      <rect x={44} y={24} width={34} height={34} rx={2} fill={A} />
      <Stripes x={47} y={54.5} n={9} w={1.6} h={2.6} step={3.3} fill={Cc} />
      <rect x={49} y={29} width={24} height={24} rx={2} fill={B} />
      <rect x={50.5} y={30.5} width={21} height={21} rx={1.5} fill={D} />
      <rect x={54} y={40} width={14} height={2} rx={1} fill={E} />
      <path d="M45.5 25.5 h4 l-4 4 Z" fill={Cc} />
    </g>
  );
}

function Cooler() {
  return (
    <g>
      {/* тепловые трубки */}
      <g stroke={D} strokeWidth={2.4} strokeLinecap="round">
        <path d="M50 20 V15" />
        <path d="M57 20 V14" />
        <path d="M65 20 V14" />
        <path d="M72 20 V15" />
      </g>
      <rect x={40} y={19} width={42} height={44} rx={2} fill={A} />
      <Stripes x={41.2} y={20} n={14} w={1.3} h={42} step={2.95} fill={B} />
      <Fan cx={61} cy={41} size={34} frame={Cc} hole={F} blade={E} hub={B} />
    </g>
  );
}

function Ram() {
  return (
    <g>
      {[85, 98].map((x) => (
        <g key={x}>
          <rect x={x - 0.5} y={14} width={5.5} height={68} rx={1} fill={A} stroke={B} strokeWidth={0.8} />
          {[18, 30, 42, 54, 66].map((y) => (
            <rect key={y} x={x + 0.6} y={y} width={3.3} height={9} rx={0.5} fill={Cc} />
          ))}
          <rect x={x + 0.6} y={78} width={3.3} height={3} fill={D} />
        </g>
      ))}
    </g>
  );
}

function Gpu() {
  return (
    <g>
      {/* планка с портами на задней стенке */}
      <rect x={6} y={93} width={7} height={30} rx={1} fill={D} />
      <rect x={7.5} y={97} width={4} height={6} rx={0.6} fill={Cc} />
      <rect x={7.5} y={106} width={4} height={6} rx={0.6} fill={Cc} />
      <rect x={7.5} y={115} width={4} height={4} rx={0.6} fill={Cc} />
      {/* плата и кожух */}
      <rect x={13} y={98} width={104} height={4} rx={1} fill={E} />
      <rect x={13} y={102} width={105} height={20} rx={4} fill={A} />
      <rect x={13} y={102} width={105} height={3.5} rx={1.5} fill={B} opacity={0.45} />
      {[46, 88].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={112} r={9.4} fill={Cc} />
          <Fan cx={cx} cy={112} size={18} frame="transparent" hole={Cc} blade={B} hub={A} blades={9} />
        </g>
      ))}
    </g>
  );
}

function Psu() {
  return (
    <g>
      {/* жгут проводов к плате */}
      <g fill="none" strokeWidth={2.4} strokeLinecap="round">
        <path d="M86 168 C96 160 100 150 106 140" stroke={A} />
        <path d="M90 168 C99 162 102 150 107 132" stroke={D} />
        <path d="M82 168 C92 158 98 146 106 126" stroke={F} />
      </g>
      <rect x={6} y={166} width={96} height={62} rx={3} fill={A} />
      <rect x={6} y={166} width={96} height={4} rx={2} fill={B} opacity={0.4} />
      <circle cx={38} cy={198} r={24} fill={Cc} />
      <Fan cx={38} cy={198} size={44} frame="transparent" hole={Cc} blade={A} hub={A} />
      <g fill="none" stroke={B} strokeWidth={1}>
        <circle cx={38} cy={198} r={22} />
        <circle cx={38} cy={198} r={15} />
        <circle cx={38} cy={198} r={8} />
        <path d="M16 198 H60 M38 176 V220" />
      </g>
      {/* наклейка со значком напряжения */}
      <rect x={70} y={180} width={26} height={34} rx={2} fill={E} />
      <path d="M84 185 L78 197 H82.5 L80.5 208 L87.5 194 H83 L86 185 Z" fill={D} />
    </g>
  );
}

function Ssd() {
  return (
    <g>
      <rect x={119} y={94} width={22} height={24} rx={2} fill={A} />
      <rect x={121} y={96} width={18} height={20} rx={1.5} fill={B} />
      <rect x={123} y={99} width={14} height={8} rx={1} fill={Cc} />
      <rect x={124.5} y={101} width={8} height={1.4} rx={0.6} fill={D} />
      <circle cx={136} cy={113} r={1.2} fill={E} />
    </g>
  );
}

function Hdd() {
  return (
    <g>
      {/* корзина для дисков */}
      <rect x={110} y={166} width={32} height={62} rx={2} fill="none" stroke={F} strokeWidth={1.5} />
      <rect x={113} y={172} width={27} height={40} rx={2.5} fill={A} />
      <circle cx={126.5} cy={188} r={10} fill={B} />
      <circle cx={126.5} cy={188} r={3} fill={Cc} />
      <path d="M135 205 L128 192" stroke={Cc} strokeWidth={2} strokeLinecap="round" />
      <rect x={116} y={204} width={10} height={5} rx={1} fill={D} />
      <rect x={113} y={214} width={27} height={10} rx={2} fill={A} opacity={0.6} />
    </g>
  );
}

function Fans() {
  return (
    <g>
      <Fan cx={19} cy={23} size={26} frame={A} hole={B} blade={Cc} hub={D} />
      <Fan cx={130} cy={30} size={24} frame={A} hole={B} blade={Cc} hub={D} />
      <Fan cx={130} cy={58} size={24} frame={A} hole={B} blade={Cc} hub={D} />
    </g>
  );
}

/** Рисунок детали (цвета — из CSS-переменных группы). */
export const PC_PART_ART: Record<PcPart, () => ReactNode> = {
  ports: Ports,
  motherboard: Motherboard,
  cpu: Cpu,
  cooler: Cooler,
  ram: Ram,
  gpu: Gpu,
  psu: Psu,
  ssd: Ssd,
  hdd: Hdd,
  fans: Fans,
};
