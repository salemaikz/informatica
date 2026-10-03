import { Art, C, DesktopUI, GLOSS, Shadow, Waves } from "./kit";

// Устройства вывода: монитор, принтер, колонки, наушники, проектор.

export function MonitorArt() {
  return (
    <Art>
      <Shadow cy={84} rx={30} />
      <path d="M53 68 H67 L69 81 H51 Z" fill={C.shell3} />
      <rect x="38" y="79" width="44" height="5" rx="2.5" fill={C.shell2} />
      <rect x="8" y="6" width="104" height="64" rx="4.5" fill={C.dark} />
      <rect x="12" y="10" width="96" height="52" rx="1.5" fill={C.lit} />
      <DesktopUI x={12} y={10} w={96} h={52} />
      <circle cx="104" cy="66" r="1.1" fill={C.success} />
    </Art>
  );
}

export function PrinterArt() {
  return (
    <Art>
      <Shadow cy={83} rx={52} />
      {/* лоток с бумагой сзади */}
      <path d="M32 30 L35 6 H85 L88 30 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M32 30 L35 6 H85 L88 30 Z" fill="var(--muted)" fillOpacity={0.1} />
      <rect x="26" y="24" width="68" height="8" rx="2" fill={C.shell3} />
      {/* корпус */}
      <rect x="10" y="28" width="100" height="44" rx="6" fill={C.shell1} />
      <path d="M10 48 H110 V66 A6 6 0 0 1 104 72 H16 A6 6 0 0 1 10 66 Z" fill={C.shell2} />
      <rect x="10" y="28" width="100" height="3" rx="1.5" fill={C.gloss} fillOpacity={0.3} />
      {/* панель управления */}
      <rect x="78" y="33" width="22" height="10" rx="2" fill={C.glass} />
      <rect x="81" y="36" width="12" height="1.6" rx="0.8" fill={C.primary} />
      <rect x="81" y="39" width="8" height="1.6" rx="0.8" fill={C.primary} fillOpacity={0.5} />
      <circle cx="71" cy="38" r="2.2" fill={C.success} />
      <circle cx="64" cy="38" r="2.2" fill={C.shell3} />
      {/* щель выдачи и лист с картинкой */}
      <rect x="22" y="51" width="76" height="5" rx="2.5" fill={C.dark2} />
      <path d="M26 54 H94 L99 84 H21 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M26 54 H94 L94.5 57 H25.5 Z" fill={C.shade} fillOpacity={0.12} />
      <rect x="31" y="60" width="26" height="18" rx="1.5" fill={C.primarySoft} />
      <circle cx="51" cy="64.5" r="2.4" fill={C.gold} />
      <path d="M31 78 L39 67 L45 74 L49 70 L57 78 Z" fill={C.success} />
      <path d="M62 62 H90 M62.3 66 H86 M62.6 70 H91 M62.9 74 H80" stroke={C.paperLine} strokeWidth={1.4} strokeLinecap="round" />
    </Art>
  );
}

function Speaker({ x }: { x: number }) {
  const cx = x + 16;
  return (
    <g>
      <rect x={x + 2} y="14" width="32" height="64" rx="4" fill={C.dark2} />
      <rect x={x} y="12" width="32" height="64" rx="4" fill={C.dark} />
      <rect x={x} y="12" width="32" height="3" rx="1.5" fill={C.gloss} fillOpacity={0.12} />
      {/* пищалка */}
      <circle cx={cx} cy="27" r="6.5" fill={C.shell3} />
      <circle cx={cx} cy="27" r="4.6" fill={C.dark2} />
      <circle cx={cx} cy="27" r="2" fill={C.shell3} />
      {/* динамик */}
      <circle cx={cx} cy="54" r="13" fill={C.shell3} />
      <circle cx={cx} cy="54" r="11" fill={C.dark2} />
      <circle cx={cx} cy="54" r="8.5" fill={C.dark} />
      <circle cx={cx} cy="54" r="4" fill={C.shell3} />
      <circle cx={cx - 1.2} cy="52.8" r="1.4" fill={C.gloss} fillOpacity={0.35} />
      <circle cx={cx} cy="71" r="1" fill={C.success} />
    </g>
  );
}

export function SpeakersArt() {
  return (
    <Art>
      <Shadow cx={35} cy={80} rx={20} ry={3.5} />
      <Shadow cx={85} cy={80} rx={20} ry={3.5} />
      <Waves cx={19} cy={45} dir={180} radii={[6, 12]} spread={38} />
      <Waves cx={101} cy={45} dir={0} radii={[6, 12]} spread={38} />
      <Speaker x={19} />
      <Speaker x={69} />
    </Art>
  );
}

export function HeadphonesArt() {
  const band = "M30 50 C26 4 94 4 90 50";
  return (
    <Art>
      <Shadow cy={84} rx={42} />
      <path d={band} fill="none" stroke={C.dark} strokeWidth={6} strokeLinecap="round" />
      <path d="M40 20 C52 9 68 9 80 20" fill="none" stroke={C.shell3} strokeWidth={2.4} strokeLinecap="round" />
      {/* левая чашка */}
      <rect x="27" y="40" width="6" height="10" rx="2" fill={C.shell3} />
      <rect x="12" y="46" width="18" height="32" rx="8" fill={C.primaryStrong} />
      <rect x="12" y="46" width="15" height="32" rx="7.5" fill={C.primary} />
      <rect x="25" y="44" width="11" height="36" rx="5.5" fill={C.dark} />
      <ellipse cx="17" cy="55" rx="1.6" ry="4.5" {...GLOSS} />
      {/* правая чашка */}
      <rect x="87" y="40" width="6" height="10" rx="2" fill={C.shell3} />
      <rect x="90" y="46" width="18" height="32" rx="8" fill={C.primaryStrong} />
      <rect x="93" y="46" width="15" height="32" rx="7.5" fill={C.primary} />
      <rect x="84" y="44" width="11" height="36" rx="5.5" fill={C.dark} />
      <ellipse cx="103" cy="55" rx="1.6" ry="4.5" {...GLOSS} />
    </Art>
  );
}

export function ProjectorArt() {
  return (
    <Art>
      <Shadow cx={34} cy={80} rx={28} />
      {/* экран на стене */}
      <rect x="70" y="4" width="48" height="3.5" rx="1.75" fill={C.dark} />
      {/* луч света */}
      <path d="M49 61 L74 8 H114 V38 Z" fill={C.primary} fillOpacity={0.16} />
      <rect x="72" y="7" width="44" height="32" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <rect x="75" y="10" width="38" height="26" fill={C.primarySoft} />
      <circle cx="105" cy="16" r="3" fill={C.gold} />
      <path d="M75 36 L86 22 L94 30 L100 25 L113 36 Z" fill={C.success} />
      {/* проектор */}
      <path d="M14 50 H58 L62 54 H10 Z" fill={C.shell1} />
      <rect x="8" y="54" width="56" height="22" rx="4" fill={C.shell2} />
      <rect x="8" y="54" width="56" height="3" fill={C.gloss} fillOpacity={0.25} />
      <path d="M14 63 H30 M14 67 H30 M14 71 H30" stroke={C.shell3} strokeWidth={1.4} strokeLinecap="round" />
      <circle cx="49" cy="65" r="9" fill={C.shell3} />
      <circle cx="49" cy="65" r="6.8" fill={C.dark2} />
      <circle cx="49" cy="65" r="4" fill={C.glass} />
      <circle cx="49" cy="65" r="2" fill={C.primary} />
      <circle cx="47.3" cy="63.3" r="1.2" fill={C.gloss} fillOpacity={0.7} />
      <circle cx="36" cy="59" r="1.3" fill={C.success} />
      <rect x="12" y="76" width="6" height="3" rx="1" fill={C.shell3} />
      <rect x="54" y="76" width="6" height="3" rx="1" fill={C.shell3} />
    </Art>
  );
}
