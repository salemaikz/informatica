import type { ReactNode } from "react";
import { Art, C, GLOSS, Grid, Shadow, Waves } from "./kit";

// Устройства ввода: клавиатура, мышь, тачпад, сенсорный экран, микрофон, веб-камера, сканер, геймпад.

/** Ряды основного блока клавиатуры: ширины клавиш в «клавишах» (каждый ряд = 15). */
const KEY_ROWS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
];

export function KeyboardArt() {
  const unit = 6.6;
  const gap = 1.2;
  const keys: ReactNode[] = [];
  KEY_ROWS.forEach((row, r) => {
    let x = 11;
    const y = 35 + r * 6.8;
    row.forEach((n, i) => {
      const w = +(n * unit - gap).toFixed(2);
      // Enter — акцентом, пробел — длинная клавиша
      const accent = r === 2 && i === row.length - 1;
      keys.push(
        <g key={`${r}-${i}`}>
          <rect x={+x.toFixed(2)} y={y + 0.9} width={w} height={5.2} rx={1.2} fill={accent ? C.primaryStrong : C.shell3} />
          <rect x={+x.toFixed(2)} y={y} width={w} height={5} rx={1.2} fill={accent ? C.primary : C.shell1} />
        </g>,
      );
      x += n * unit;
    });
  });
  return (
    <Art>
      <Shadow cy={79} rx={52} />
      <path d="M60 25 C60 14 46 14 46 6 V0" fill="none" stroke={C.dark} strokeWidth={2.4} strokeLinecap="round" />
      <rect x="6" y="27" width="108" height="49" rx="6" fill={C.shell3} />
      <rect x="6" y="24" width="108" height="49" rx="6" fill={C.shell2} />
      {/* ряд F1–F12 */}
      <Grid x={11} y={28} cols={13} rows={1} w={6.33} h={3.8} gx={1.3} gy={0} rx={1} fill={C.shell1} />
      <rect x="11" y="28" width="6.33" height="3.8" rx="1" fill={C.danger} fillOpacity={0.75} />
      {keys}
      <circle cx="104" cy="30" r="1" fill={C.success} />
      <circle cx="108" cy="30" r="1" fill={C.success} fillOpacity={0.5} />
    </Art>
  );
}

export function MouseArt() {
  const body = "M60 12 C78 12 85 28 85 47 C85 69 75 81 60 81 C45 81 35 69 35 47 C35 28 42 12 60 12 Z";
  return (
    <Art>
      <path d="M60 13 C60 5 64 3 68 0" fill="none" stroke={C.dark} strokeWidth={2.4} strokeLinecap="round" />
      <path d={body} fill="#000000" fillOpacity={0.13} transform="translate(3 4)" />
      <path d={body} fill={C.shell1} />
      {/* тень правого бока */}
      <path d="M72 15 C81 21 85 33 85 47 C85 69 75 81 60 81 C70 76 76 64 76 47 C76 32 75 22 72 15 Z" fill={C.shell2} />
      <path d="M60 12 V39 M36 38 Q60 44 84 38" fill="none" stroke={C.shell3} strokeWidth={1.4} strokeLinecap="round" />
      <rect x="56.5" y="19" width="7" height="14" rx="3.5" fill={C.dark} />
      <path d="M58 23 H62 M58 26 H62 M58 29 H62" stroke={C.shell3} strokeWidth={0.8} />
      <ellipse cx="46" cy="26" rx="4" ry="7" transform="rotate(25 46 26)" {...GLOSS} />
      <circle cx="60" cy="70" r="1.6" fill={C.primary} fillOpacity={0.7} />
    </Art>
  );
}

export function TouchpadArt() {
  // клавиши трапецией (вид сверху на ноутбук под углом)
  const rows: ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    const y = 26 + r * 5;
    const left = 16 - (y - 22) * 0.2 + 4;
    const width = 120 - 2 * left;
    const cols = 14;
    const w = +((width - (cols - 1) * 1.2) / cols).toFixed(2);
    rows.push(<Grid key={r} x={+left.toFixed(2)} y={y} cols={cols} rows={1} w={w} h={3.6} gx={1.2} gy={0} rx={0.8} fill={C.dark} />);
  }
  return (
    <Art>
      <Shadow cy={80} rx={56} />
      <path d="M6 72 H114 V75 A3 3 0 0 1 111 78 H9 A3 3 0 0 1 6 75 Z" fill={C.shell3} />
      <path d="M16 22 H104 L114 72 H6 Z" fill={C.shell1} />
      {rows}
      <path d="M40 44 H80 L83 69 H37 Z" fill={C.shell2} />
      <path d="M40 44 H80 L83 69 H37 Z" fill="none" stroke={C.shell3} strokeWidth={1} />
      <path d="M37.6 64 H82.4" stroke={C.shell3} strokeWidth={0.8} />
      <path d="M60 64 V69" stroke={C.shell3} strokeWidth={0.8} />
      {/* касание пальцем: круги */}
      <circle cx="64" cy="53" r="9" fill="none" stroke={C.primary} strokeWidth={1.2} opacity={0.35} />
      <circle cx="64" cy="53" r="5.5" fill="none" stroke={C.primary} strokeWidth={1.4} opacity={0.7} />
      <Finger x={64} y={53} angle={-28} />
    </Art>
  );
}

/** Указательный палец: кончик в точке (x, y), палец уходит вниз-вправо под углом angle. */
function Finger({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`rotate(${angle} ${x} ${y})`}>
      <rect x={x - 5.5} y={y - 2} width="11" height="46" rx="5.5" fill={C.skinShade} />
      <rect x={x - 5.5} y={y - 2} width="9.5" height="46" rx="4.75" fill={C.skin} />
      <rect x={x - 3.8} y={y - 0.6} width="6.6" height="7.5" rx="3.2" fill="#ffffff" fillOpacity={0.45} />
      <path d={`M${x - 4} ${y + 16} H${x + 3}`} stroke={C.skinShade} strokeWidth={0.8} strokeLinecap="round" />
    </g>
  );
}

export function TouchscreenArt() {
  const icons = [C.primary, C.success, C.warning, C.ai, C.danger, C.gold, C.streak, C.primaryStrong];
  return (
    <Art>
      <Shadow cy={83} rx={26} />
      <path d="M52 70 H68 L70 80 H50 Z" fill={C.shell3} />
      <rect x="38" y="78" width="44" height="4" rx="2" fill={C.shell2} />
      <rect x="10" y="8" width="100" height="64" rx="6" fill={C.dark} />
      <rect x="14" y="12" width="92" height="56" rx="2.5" fill={C.lit} />
      <rect x="14" y="12" width="92" height="5" fill={C.litDeep} fillOpacity={0.6} />
      <Grid x={23.5} y={23} cols={4} rows={2} w={13} h={13} gx={7} gy={8} rx={3.5} colors={icons} />
      <Grid x={23.5} y={38.5} cols={4} rows={2} w={13} h={1.8} gx={7} gy={19.2} rx={0.9} fill={C.shell3} />
      <circle cx="70" cy="50" r="10" fill="none" stroke={C.primaryStrong} strokeWidth={1.3} opacity={0.4} />
      <circle cx="70" cy="50" r="6.5" fill="none" stroke={C.primaryStrong} strokeWidth={1.5} opacity={0.75} />
      <Finger x={71} y={51} angle={-32} />
      <circle cx="60" cy="10" r="0.9" fill={C.shell3} />
    </Art>
  );
}

export function MicArt() {
  // сетка решётки: линии внутри купола радиуса 12 с центром (60, 22)
  const mesh: ReactNode[] = [];
  for (let y = 13; y <= 31; y += 3) {
    const half = y < 22 ? Math.sqrt(144 - (22 - y) ** 2) : 12;
    mesh.push(<path key={`h${y}`} d={`M${+(60 - half).toFixed(2)} ${y} H${+(60 + half).toFixed(2)}`} />);
  }
  for (let x = 51; x <= 69; x += 3) {
    const top = 22 - Math.sqrt(144 - (x - 60) ** 2);
    mesh.push(<path key={`v${x}`} d={`M${x} ${+top.toFixed(2)} V32`} />);
  }
  return (
    <Art>
      <Shadow cy={82} rx={26} />
      <Waves cx={60} cy={24} dir={0} radii={[19, 26]} spread={32} />
      <Waves cx={60} cy={24} dir={180} radii={[19, 26]} spread={32} />
      <ellipse cx="60" cy="79" rx="20" ry="4.5" fill={C.dark2} />
      <ellipse cx="60" cy="77.5" rx="20" ry="4.5" fill={C.dark} />
      <rect x="58.5" y="52" width="3" height="26" rx="1.2" fill={C.shell3} />
      <path d="M45 36 V44 Q45 55 60 55 Q75 55 75 44 V36" fill="none" stroke={C.shell3} strokeWidth={3} strokeLinecap="round" />
      <rect x="48" y="10" width="24" height="42" rx="12" fill={C.dark} />
      <rect x="66" y="34" width="4" height="15" rx="2" fill="#ffffff" fillOpacity={0.12} />
      <path d="M48 32 V22 A12 12 0 0 1 72 22 V32 Z" fill={C.shell2} />
      <g stroke={C.shell3} strokeWidth={0.9}>{mesh}</g>
      <ellipse cx="54" cy="16" rx="2.5" ry="4" transform="rotate(30 54 16)" {...GLOSS} />
      <rect x="47" y="31" width="26" height="4" rx="2" fill={C.shell3} />
      <circle cx="60" cy="42" r="1.5" fill={C.success} />
    </Art>
  );
}

export function WebcamArt() {
  return (
    <Art>
      {/* верх монитора */}
      <rect x="14" y="60" width="92" height="34" rx="4" fill={C.dark} />
      <rect x="18" y="64" width="84" height="30" rx="1.5" fill={C.lit} />
      <rect x="18" y="64" width="84" height="5" fill={C.litDeep} fillOpacity={0.5} />
      <ellipse cx="60" cy="61" rx="18" ry="2" fill="#000000" fillOpacity={0.2} />
      {/* крепление */}
      <path d="M53 52 H67 L69 61 H51 Z" fill={C.shell3} />
      {/* корпус камеры */}
      <rect x="30" y="20" width="60" height="34" rx="17" fill={C.dark2} />
      <rect x="30" y="18" width="60" height="33" rx="16.5" fill={C.dark} />
      <path d="M38 24 Q60 17 82 24" fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="60" cy="35" r="12.5" fill={C.shell3} />
      <circle cx="60" cy="35" r="10" fill={C.dark2} />
      <circle cx="60" cy="35" r="6.5" fill={C.glass} />
      <circle cx="60" cy="35" r="3" fill={C.primary} fillOpacity={0.6} />
      <circle cx="57.2" cy="32.2" r="1.8" fill="#ffffff" fillOpacity={0.75} />
      <circle cx="80" cy="35" r="2" fill={C.success} />
      <g fill={C.shell3}>
        <circle cx="39" cy="33" r="0.8" />
        <circle cx="42" cy="33" r="0.8" />
        <circle cx="39" cy="37" r="0.8" />
        <circle cx="42" cy="37" r="0.8" />
      </g>
    </Art>
  );
}

export function ScannerArt() {
  return (
    <Art>
      <Shadow cy={79} rx={54} />
      {/* открытая крышка */}
      <path d="M16 45 H104 L98 9 H22 Z" fill={C.shell2} />
      <path d="M21 43 H99 L94.5 13 H25.5 Z" fill={C.paper} />
      <path d="M21 43 H99 L94.5 13 H25.5 Z" fill="var(--muted)" fillOpacity={0.08} />
      {/* верх корпуса со стеклом */}
      <path d="M16 44 H104 L112 58 H8 Z" fill={C.shell1} />
      <path d="M22 46 H98 L104 56 H16 Z" fill={C.glass} />
      <path d="M25 47 H52 L53.5 55 H20 Z" fill={C.paper} />
      <path d="M27 49 H48 M26.4 51 H44 M25.8 53 H49" stroke={C.paperLine} strokeWidth={0.7} />
      {/* полоса света сканера */}
      <path d="M61 46 H71 L74 56 H63 Z" fill={C.primary} fillOpacity={0.35} />
      <path d="M65 46 H67.5 L69.5 56 H67 Z" fill={C.primary} />
      {/* передняя панель */}
      <path d="M8 58 H112 V71 A4 4 0 0 1 108 75 H12 A4 4 0 0 1 8 71 Z" fill={C.shell2} />
      <rect x="8" y="58" width="104" height="3" fill="#ffffff" fillOpacity={0.25} />
      <circle cx="101" cy="66.5" r="3" fill={C.primary} />
      <circle cx="92" cy="66.5" r="1.4" fill={C.success} />
      <path d="M16 66.5 H40" stroke={C.shell3} strokeWidth={1.4} strokeLinecap="round" />
    </Art>
  );
}

export function GamepadArt() {
  const body =
    "M36 24 H84 C94 24 101 27 104 34 C109 46 112 62 107 71 C103 78 94 78 90 71 L84 60 H36 L30 71 C26 78 17 78 13 71 C8 62 11 46 16 34 C19 27 26 24 36 24 Z";
  return (
    <Art>
      <Shadow cy={81} rx={48} />
      <rect x="22" y="19" width="22" height="9" rx="4.5" fill={C.shell3} />
      <rect x="76" y="19" width="22" height="9" rx="4.5" fill={C.shell3} />
      <path d={body} fill={C.dark} />
      <path d="M36 24 H84 C94 24 101 27 104 34 C106 39 107 44 108 49 C96 40 80 36 60 36 C40 36 24 40 12 49 C13 44 14 39 16 34 C19 27 26 24 36 24 Z" fill="#ffffff" fillOpacity={0.12} />
      {/* крестовина */}
      <rect x="29" y="34" width="6" height="16" rx="1.2" fill={C.dark2} />
      <rect x="24" y="39" width="16" height="6" rx="1.2" fill={C.dark2} />
      <circle cx="32" cy="42" r="1.4" fill={C.shell3} fillOpacity={0.5} />
      {/* кнопки действий */}
      <circle cx="88" cy="35" r="3.4" fill={C.warning} />
      <circle cx="95" cy="42" r="3.4" fill={C.danger} />
      <circle cx="88" cy="49" r="3.4" fill={C.success} />
      <circle cx="81" cy="42" r="3.4" fill={C.primary} />
      {/* стики */}
      <circle cx="46" cy="55" r="7.5" fill={C.dark2} />
      <circle cx="46" cy="54" r="5.2" fill={C.shell3} />
      <circle cx="46" cy="54" r="3.2" fill={C.dark} />
      <circle cx="74" cy="55" r="7.5" fill={C.dark2} />
      <circle cx="74" cy="54" r="5.2" fill={C.shell3} />
      <circle cx="74" cy="54" r="3.2" fill={C.dark} />
      {/* центральные кнопки */}
      <rect x="51" y="40" width="6" height="2.6" rx="1.3" fill={C.shell3} />
      <rect x="63" y="40" width="6" height="2.6" rx="1.3" fill={C.shell3} />
      <circle cx="60" cy="31" r="3" fill={C.primary} />
    </Art>
  );
}
