import type { ReactNode } from "react";
import { Art, C, DesktopUI, GLOSS, Grid, Shadow, Waves } from "./kit";

// «Компьютеры вокруг нас»: ПК, ноутбук, телефон, планшет, умные часы, банкомат, касса, машина, сервер, роутер.

const APP_COLORS = [C.primary, C.success, C.warning, C.ai, C.danger, C.gold, C.streak, C.primaryStrong];

export function DesktopArt() {
  return (
    <Art>
      <Shadow cy={83} rx={56} />
      {/* монитор */}
      <path d="M38 56 H48 L49.5 66 H36.5 Z" fill={C.shell3} />
      <rect x="27" y="65" width="32" height="3.5" rx="1.75" fill={C.shell2} />
      <rect x="6" y="8" width="74" height="50" rx="3.5" fill={C.dark} />
      <DesktopUI x={9} y={11} w={68} h={41} />
      {/* клавиатура и мышь */}
      <path d="M12 71 H72 L75 80 H9 Z" fill={C.shell3} />
      <path d="M12 70 H72 L74.5 78 H9.5 Z" fill={C.shell2} />
      <Grid x={14} y={71.6} cols={14} rows={2} w={3.2} h={1.9} gx={0.95} gy={1.1} rx={0.4} fill={C.shell1} />
      <rect x="27" y="76" width="30" height="1.4" rx="0.5" fill={C.shell1} />
      <ellipse cx="80" cy="76" rx="3.2" ry="4.2" fill={C.shell2} />
      <path d="M80 72 V75" stroke={C.shell3} strokeWidth={0.6} />
      {/* системный блок */}
      <rect x="86" y="14" width="28" height="68" rx="3" fill={C.shell2} />
      <rect x="84" y="14" width="26" height="68" rx="3" fill={C.shell1} />
      <rect x="88" y="20" width="18" height="3.5" rx="1" fill={C.shell3} />
      <rect x="88" y="26" width="18" height="3.5" rx="1" fill={C.shell3} />
      <circle cx="97" cy="38" r="3.6" fill={C.shell3} />
      <circle cx="97" cy="38" r="1.7" fill={C.primary} />
      <rect x="90" y="45" width="3" height="1.8" rx="0.4" fill={C.dark} />
      <rect x="95" y="45" width="3" height="1.8" rx="0.4" fill={C.dark} />
      <circle cx="102" cy="46" r="0.9" fill={C.success} />
      <path d="M89 58 H105 M89 62 H105 M89 66 H105 M89 70 H105 M89 74 H105" stroke={C.shell3} strokeWidth={1.2} strokeLinecap="round" />
    </Art>
  );
}

export function LaptopArt() {
  const rows: ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    const y = 60.5 + r * 2.9;
    // боковые края основания: x = 14 − (y − 58)·10/16
    const left = 14 - ((y - 58) * 10) / 16 + 6;
    const width = 120 - 2 * left;
    const cols = 15;
    const w = +((width - (cols - 1) * 0.9) / cols).toFixed(2);
    rows.push(<Grid key={r} x={+left.toFixed(2)} y={+y.toFixed(2)} cols={cols} rows={1} w={w} h={2.1} gx={0.9} gy={0} rx={0.5} fill={C.dark} />);
  }
  return (
    <Art>
      <Shadow cy={82} rx={58} />
      {/* крышка с экраном */}
      <rect x="20" y="6" width="80" height="53" rx="4" fill={C.dark} />
      <DesktopUI x={24} y={10} w={72} h={45} />
      <circle cx="60" cy="8" r="0.9" fill={C.shell3} />
      {/* основание */}
      <path d="M4 74 H116 V76 A3 3 0 0 1 113 79 H7 A3 3 0 0 1 4 76 Z" fill={C.shell3} />
      <path d="M14 58 H106 L116 74 H4 Z" fill={C.shell1} />
      {rows}
      <path d="M49 69.5 H71 L72 73.2 H48 Z" fill={C.shell2} />
      <rect x="54" y="74" width="12" height="1.6" rx="0.8" fill={C.shell2} />
    </Art>
  );
}

export function PhoneArt() {
  return (
    <Art>
      <Shadow cy={86} rx={24} ry={3} />
      <rect x="78.5" y="20" width="2.5" height="10" rx="1" fill={C.shell3} />
      <rect x="78.5" y="33" width="2.5" height="6" rx="1" fill={C.shell3} />
      <rect x="40" y="3" width="40" height="81" rx="8" fill={C.dark} />
      <rect x="43" y="6" width="34" height="75" rx="5.5" fill={C.lit} />
      <circle cx="60" cy="10" r="1.6" fill={C.dark2} />
      {/* виджет-часы и иконки */}
      <rect x="46" y="15" width="28" height="9" rx="2.5" fill={C.primary} fillOpacity={0.25} />
      <rect x="49" y="18" width="12" height="3" rx="1.5" fill={C.primary} />
      <Grid x={46.5} y={28} cols={4} rows={4} w={5.6} h={5.6} gx={2.2} gy={3.6} rx={1.6} colors={APP_COLORS} />
      <rect x="46" y="69" width="28" height="9" rx="3.5" fill="#ffffff" fillOpacity={0.35} />
      <Grid x={48.5} y={70.7} cols={4} rows={1} w={5.6} h={5.6} gx={1.5} gy={0} rx={1.6} colors={[C.success, C.primary, C.warning, C.ai]} />
      <path d="M44 7 L52 7 L44 26 Z" fill="#ffffff" fillOpacity={0.12} />
    </Art>
  );
}

export function TabletArt() {
  return (
    <Art>
      <Shadow cy={82} rx={48} />
      <rect x="10" y="12" width="100" height="66" rx="7" fill={C.dark} />
      <rect x="15" y="17" width="90" height="56" rx="3" fill={C.lit} />
      <circle cx="12.5" cy="45" r="0.9" fill={C.shell3} />
      {/* видео */}
      <rect x="21" y="22" width="78" height="38" rx="2" fill={C.primarySoft} />
      <circle cx="88" cy="30" r="4" fill={C.gold} />
      <path d="M21 60 L42 38 L56 50 L66 42 L99 60 Z" fill={C.success} fillOpacity={0.75} />
      <circle cx="60" cy="41" r="8" fill="#ffffff" fillOpacity={0.88} />
      <path d="M57.5 36.5 L65 41 L57.5 45.5 Z" fill={C.primary} />
      <rect x="21" y="65" width="78" height="2.4" rx="1.2" fill={C.shell3} />
      <rect x="21" y="65" width="32" height="2.4" rx="1.2" fill={C.primary} />
      <circle cx="53" cy="66.2" r="2.4" fill={C.primary} />
      <path d="M16 18 L36 18 L16 50 Z" fill="#ffffff" fillOpacity={0.1} />
    </Art>
  );
}

/** Кольцо активности: доля frac окружности радиуса r. */
function Ring({ r, frac, color }: { r: number; frac: number; color: string }) {
  const len = +(2 * Math.PI * r).toFixed(2);
  return (
    <g fill="none" strokeWidth={3.4} strokeLinecap="round" transform="rotate(-90 60 45)">
      <circle cx="60" cy="45" r={r} stroke={color} strokeOpacity={0.25} />
      <circle cx="60" cy="45" r={r} stroke={color} strokeDasharray={`${+(len * frac).toFixed(2)} ${len}`} />
    </g>
  );
}

export function SmartwatchArt() {
  return (
    <Art>
      {/* ремешок */}
      <path d="M46 0 H74 L72 22 H48 Z" fill={C.primaryStrong} />
      <path d="M48 68 H72 L74 90 H46 Z" fill={C.primaryStrong} />
      <circle cx="60" cy="78" r="1.3" fill={C.dark2} />
      <circle cx="60" cy="84" r="1.3" fill={C.dark2} />
      {/* корпус */}
      <rect x="82" y="36" width="5" height="10" rx="2" fill={C.shell3} />
      <rect x="82" y="50" width="3.5" height="7" rx="1.5" fill={C.shell3} />
      <rect x="36" y="17" width="48" height="56" rx="13" fill={C.shell3} />
      <rect x="39" y="20" width="42" height="50" rx="10.5" fill={C.dark2} />
      <Ring r={14} frac={0.72} color={C.danger} />
      <Ring r={9.6} frac={0.55} color={C.success} />
      <Ring r={5.2} frac={0.85} color={C.primary} />
      <path d="M42 24 L56 22 L42 40 Z" fill="#ffffff" fillOpacity={0.08} />
      <rect x="36" y="17" width="48" height="3" rx="1.5" fill="#ffffff" fillOpacity={0.25} />
    </Art>
  );
}

export function AtmArt() {
  return (
    <Art>
      <Shadow cy={86} rx={42} ry={3} />
      <rect x="24" y="8" width="76" height="78" rx="4" fill={C.shell2} />
      <rect x="20" y="8" width="76" height="78" rx="4" fill={C.shell1} />
      {/* шапка с картой */}
      <path d="M20 21 V12 A4 4 0 0 1 24 8 H92 A4 4 0 0 1 96 12 V21 Z" fill={C.primary} />
      <rect x="51" y="11" width="14" height="8" rx="1.5" fill="#ffffff" fillOpacity={0.9} />
      <rect x="51" y="13" width="14" height="1.8" fill={C.primaryStrong} />
      {/* экран и боковые кнопки */}
      <rect x="30" y="25" width="46" height="28" rx="2.5" fill={C.dark} />
      <rect x="32" y="27" width="42" height="24" rx="1.2" fill={C.lit} />
      <rect x="35" y="30" width="20" height="2.4" rx="1.2" fill={C.primary} />
      <Grid x={35} y={35.5} cols={2} rows={3} w={16} h={3.6} gx={4} gy={2.6} rx={1} fill="var(--surface)" />
      <Grid x={25} y={35.3} cols={1} rows={3} w={3.5} h={4} gx={0} gy={2.2} rx={0.8} fill={C.shell3} />
      <Grid x={77.5} y={35.3} cols={1} rows={3} w={3.5} h={4} gx={0} gy={2.2} rx={0.8} fill={C.shell3} />
      {/* клавиатура */}
      <rect x="31" y="56" width="34" height="19" rx="2" fill={C.shell2} />
      <Grid x={33} y={57.8} cols={3} rows={4} w={6} h={3} gx={1.4} gy={1.3} rx={0.8} fill={C.dark} />
      <rect x="55" y="57.8" width="8" height="3" rx="0.8" fill={C.danger} />
      <rect x="55" y="62.1" width="8" height="3" rx="0.8" fill={C.warning} />
      <rect x="55" y="66.4" width="8" height="3" rx="0.8" fill={C.success} />
      {/* картоприёмник с картой */}
      <rect x="74" y="60" width="14" height="13" rx="1.5" fill={C.gold} />
      <rect x="76.5" y="64.5" width="4.5" height="3.8" rx="0.7" fill={C.shell1} />
      <rect x="76.5" y="70" width="9" height="1.2" rx="0.6" fill="#ffffff" fillOpacity={0.6} />
      <rect x="71" y="57" width="20" height="5" rx="2.5" fill={C.dark2} />
      <rect x="73" y="59" width="16" height="1.2" rx="0.6" fill={C.success} />
      {/* выдача наличных */}
      <rect x="44" y="76" width="32" height="6" rx="1" fill={C.success} />
      <circle cx="60" cy="79" r="2" fill="#ffffff" fillOpacity={0.5} />
      <rect x="34" y="80" width="52" height="4" rx="2" fill={C.dark2} />
    </Art>
  );
}

export function PosArt() {
  return (
    <Art>
      {/* прилавок */}
      <rect x="0" y="74" width="120" height="16" fill={C.shell2} />
      <rect x="0" y="72" width="120" height="4" fill={C.shell1} />
      {/* касса: ящик, стойка, экран */}
      <ellipse cx="34" cy="73" rx="28" ry="2" fill="#000000" fillOpacity={0.15} />
      <rect x="8" y="56" width="52" height="17" rx="2.5" fill={C.shell1} />
      <rect x="8" y="63" width="52" height="10" rx="2.5" fill={C.shell2} />
      <rect x="27" y="66.5" width="14" height="2.4" rx="1.2" fill={C.shell3} />
      <rect x="30" y="44" width="5" height="13" fill={C.shell3} />
      <rect x="12" y="18" width="40" height="28" rx="3" fill={C.dark} />
      <rect x="14.5" y="20.5" width="35" height="23" rx="1.2" fill={C.lit} />
      <Grid x={17} y={23.5} cols={1} rows={3} w={18} h={2.2} gx={0} gy={2.4} rx={1.1} fill={C.shell3} />
      <Grid x={39} y={23.5} cols={1} rows={3} w={8} h={2.2} gx={0} gy={2.4} rx={1.1} fill={C.shell3} />
      <rect x="17" y="37" width="30" height="4.4" rx="1.2" fill={C.success} />
      {/* чек */}
      <rect x="44" y="51" width="14" height="6" rx="1.5" fill={C.dark} />
      <path d="M46.5 52 V38 H55.5 V52 Z" fill={C.paper} />
      <path d="M48 41 H54 M48 44 H53 M48 47 H54" stroke={C.paperLine} strokeWidth={0.9} />
      <ellipse cx="90" cy="73" rx="15" ry="2" fill="#000000" fillOpacity={0.15} />
      {/* терминал */}
      <rect x="77" y="26" width="26" height="46" rx="5" fill={C.dark} />
      <rect x="80" y="31" width="20" height="13" rx="1.2" fill={C.lit} />
      <Waves cx={86} cy={37.5} dir={0} radii={[3, 5.5, 8]} spread={42} width={1.4} />
      <Grid x={81} y={47} cols={3} rows={3} w={5} h={3.2} gx={2.5} gy={1.6} rx={0.8} fill={C.shell3} />
      <Grid x={81} y={61.4} cols={3} rows={1} w={5} h={3.4} gx={2.5} gy={0} rx={0.8} colors={[C.danger, C.warning, C.success]} />
      <rect x="77" y="26" width="3" height="40" rx="1.5" fill="#ffffff" fillOpacity={0.1} />
      {/* банковская карта: прикладывают к терминалу */}
      <g transform="rotate(-14 92 13)">
        <rect x="80" y="5" width="25" height="16" rx="2" fill={C.gold} />
        <rect x="83" y="9" width="5.5" height="4.4" rx="0.8" fill={C.shell1} />
        <rect x="83" y="16" width="16" height="1.4" rx="0.7" fill="#ffffff" fillOpacity={0.65} />
        <circle cx="100" cy="9.5" r="1.8" fill={C.danger} fillOpacity={0.8} />
        <circle cx="97.8" cy="9.5" r="1.8" fill={C.warning} fillOpacity={0.8} />
      </g>
    </Art>
  );
}

export function CarArt() {
  return (
    <Art>
      {/* вид через лобовое стекло */}
      <rect x="0" y="0" width="120" height="50" fill={C.primarySoft} />
      <rect x="0" y="26" width="120" height="24" fill={C.success} fillOpacity={0.3} />
      <path d="M55 26 H65 L104 50 H16 Z" fill={C.shell3} />
      <path d="M60 28 V31 M60 35 V40 M60 44 V50" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.4} />
      <path d="M0 0 H12 L0 36 Z" fill={C.dark} />
      <path d="M120 0 H108 L120 36 Z" fill={C.dark} />
      {/* приборная панель */}
      <path d="M0 46 Q60 34 120 46 V90 H0 Z" fill={C.dark} />
      <path d="M0 46 Q60 34 120 46 V49 Q60 37 0 49 Z" fill="#ffffff" fillOpacity={0.12} />
      {/* щиток приборов */}
      <circle cx="26" cy="53" r="8" fill={C.glass} />
      <path d="M19.5 55 A7 7 0 0 1 32.5 55" fill="none" stroke={C.primary} strokeWidth={1.4} strokeOpacity={0.7} />
      <path d="M26 54 L30.5 49" stroke={C.warning} strokeWidth={1.5} strokeLinecap="round" />
      {/* руль */}
      <circle cx="26" cy="80" r="18" fill="none" stroke={C.dark2} strokeWidth={6} />
      <circle cx="26" cy="80" r="18" fill="none" stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1.4} />
      <path d="M9 82 H43 M26 82 V90" stroke={C.dark2} strokeWidth={5} />
      <circle cx="26" cy="82" r="7" fill={C.dark2} />
      <circle cx="26" cy="82" r="3" fill={C.shell3} />
      {/* центральный экран с картой */}
      <rect x="54" y="48" width="38" height="27" rx="3" fill={C.dark2} />
      <rect x="56" y="50" width="34" height="23" rx="1.5" fill={C.lit} />
      <path d="M56 58 H90 M56 66 H90 M64 50 V73 M78 50 V73" stroke="var(--surface)" strokeWidth={1.6} />
      <path d="M60 70 V62 H71 V54 H85" fill="none" stroke={C.primary} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M85 49.5 C82 49.5 81 51.5 81 53 C81 55.5 85 59 85 59 C85 59 89 55.5 89 53 C89 51.5 88 49.5 85 49.5 Z" fill={C.danger} />
      <circle cx="85" cy="53" r="1.3" fill="#ffffff" />
      <circle cx="60" cy="70" r="2" fill={C.primary} />
      {/* дефлектор */}
      <rect x="98" y="52" width="16" height="9" rx="2.5" fill={C.dark2} />
      <path d="M100 55 H112 M100 58 H112" stroke={C.shell3} strokeWidth={1} />
      <Grid x={58} y={79} cols={4} rows={1} w={6} h={3} gx={2.6} gy={0} rx={1.5} fill={C.dark2} />
    </Art>
  );
}

function ServerUnit({ y, leds }: { y: number; leds: string[] }) {
  return (
    <g>
      <rect x="35" y={y} width="50" height="10" rx="1.2" fill={C.shell3} />
      <rect x="35" y={y} width="50" height="1.4" rx="0.7" fill="#ffffff" fillOpacity={0.2} />
      <Grid x={38} y={y + 2.2} cols={4} rows={1} w={6} h={5.6} gx={1.4} gy={0} rx={0.6} fill={C.dark} />
      <path d={`M69 ${y + 3} V${y + 7} M71 ${y + 3} V${y + 7} M73 ${y + 3} V${y + 7}`} stroke={C.dark} strokeWidth={0.8} />
      {leds.map((color, i) => (
        <circle key={i} cx={77.5 + i * 3.5} cy={y + 5} r="1.2" fill={color} />
      ))}
    </g>
  );
}

export function ServerArt() {
  const leds = [
    [C.success, C.success],
    [C.success, C.primary],
    [C.success, C.success],
    [C.warning, C.success],
    [C.success, C.primary],
    [C.success, C.success],
  ];
  return (
    <Art>
      <Shadow cy={86} rx={36} ry={3} />
      <rect x="32" y="84" width="5" height="3" rx="1" fill={C.dark2} />
      <rect x="83" y="84" width="5" height="3" rx="1" fill={C.dark2} />
      <rect x="31" y="3" width="62" height="82" rx="3" fill={C.dark2} />
      <rect x="29" y="3" width="62" height="82" rx="3" fill={C.dark} />
      <rect x="32" y="6" width="56" height="76" rx="1.5" fill={C.dark2} />
      {leds.map((l, i) => (
        <ServerUnit key={i} y={8.5 + i * 12.2} leds={l} />
      ))}
      <rect x="29" y="3" width="2.5" height="82" rx="1.25" fill="#ffffff" fillOpacity={0.1} />
    </Art>
  );
}

function Antenna({ x, angle }: { x: number; angle: number }) {
  return (
    <g transform={`rotate(${angle} ${x} 54)`}>
      <rect x={x - 2.2} y="16" width="4.4" height="40" rx="2.2" fill={C.dark} />
      <rect x={x - 2.2} y="16" width="1.6" height="36" rx="0.8" fill="#ffffff" fillOpacity={0.15} />
      <rect x={x - 3} y="48" width="6" height="5" rx="1" fill={C.dark2} />
    </g>
  );
}

export function RouterArt() {
  return (
    <Art>
      <Shadow cy={81} rx={54} />
      <Waves cx={60} cy={14} dir={-90} radii={[5, 10, 15]} spread={42} width={2.2} />
      <Antenna x={28} angle={-14} />
      <Antenna x={60} angle={0} />
      <Antenna x={92} angle={14} />
      <path d="M20 52 H100 L110 62 H10 Z" fill={C.shell1} />
      <path d="M10 62 H110 V72 A4 4 0 0 1 106 76 H14 A4 4 0 0 1 10 72 Z" fill={C.shell2} />
      <rect x="10" y="62" width="100" height="1.6" fill="#ffffff" fillOpacity={0.25} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={24 + i * 8} cy="69" r="1.5" fill={i === 1 ? C.primary : C.success} />
      ))}
      <path d="M80 69 H100" stroke={C.shell3} strokeWidth={1.4} strokeLinecap="round" />
      <ellipse cx="44" cy="56" rx="14" ry="1.2" {...GLOSS} />
    </Art>
  );
}
