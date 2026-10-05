import type { ReactNode } from "react";
import { Art, C, GLOSS, Shadow } from "./kit";

// Печатающие устройства: матричный, струйный, лазерный принтеры, плоттер, графический планшет.

export function PrinterDotArt() {
  const holes: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    holes.push(<circle key={`l${i}`} cx={34} cy={9 + i * 4.5} r={1.1} fill={C.shell3} />);
    holes.push(<circle key={`r${i}`} cx={86} cy={9 + i * 4.5} r={1.1} fill={C.shell3} />);
  }
  return (
    <Art>
      <Shadow cy={83} rx={52} />
      {/* лента с перфорацией по краям выходит сверху */}
      <path d="M30 34 L32 2 H88 L90 34 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M38 4 V32 M82 4 V32" stroke={C.paperLine} strokeWidth={0.6} strokeDasharray="1.6 1.4" />
      {holes}
      <path d="M44 10 H76 M44 15 H72 M44 20 H78" stroke={C.dark} strokeWidth={1.2} strokeDasharray="1 1.2" strokeLinecap="round" />
      {/* корпус с валиком */}
      <rect x="10" y="32" width="100" height="14" rx="3" fill={C.shell3} />
      <rect x="10" y="44" width="100" height="30" rx="5" fill={C.shell1} />
      <path d="M10 60 H110 V69 A5 5 0 0 1 105 74 H15 A5 5 0 0 1 10 69 Z" fill={C.shell2} />
      <rect x="14" y="36" width="92" height="6" rx="3" fill={C.dark2} />
      {/* печатающая головка на направляющей */}
      <rect x="14" y="38.5" width="92" height="1.6" fill={C.shell3} />
      <rect x="54" y="33" width="12" height="9" rx="1.5" fill={C.dark} />
      <path d="M58 42 V45 M60 42 V45 M62 42 V45" stroke={C.gold} strokeWidth={0.9} />
      <rect x="82" y="50" width="22" height="8" rx="2" fill={C.glass} />
      <circle cx="88" cy="54" r="1.5" fill={C.success} />
      <circle cx="94" cy="54" r="1.5" fill={C.warning} />
      <rect x="16" y="51" width="50" height="2.4" rx="1.2" fill={C.shell3} />
      {/* лента, выходящая спереди */}
      <path d="M26 74 H94 L98 84 H22 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M32 79 H60" stroke={C.dark} strokeWidth={1} strokeDasharray="1 1.2" strokeLinecap="round" />
    </Art>
  );
}

export function PrinterInkjetArt() {
  const inks = [C.primary, C.danger, C.gold, C.dark];
  return (
    <Art>
      <Shadow cy={83} rx={52} />
      {/* откинутая крышка, под ней четыре картриджа */}
      <path d="M22 28 L26 4 H94 L98 28 Z" fill={C.glass} />
      <path d="M26 4 H94 L95 10 H25 Z" {...GLOSS} />
      <rect x="10" y="26" width="100" height="46" rx="6" fill={C.shell1} />
      <path d="M10 52 H110 V66 A6 6 0 0 1 104 72 H16 A6 6 0 0 1 10 66 Z" fill={C.shell2} />
      <rect x="18" y="29" width="84" height="16" rx="2.5" fill={C.dark2} />
      {inks.map((c, i) => (
        <g key={i}>
          <rect x={25 + i * 19} y="31" width="14" height="12" rx="1.5" fill={C.shell3} />
          <rect x={26.5 + i * 19} y="35" width="11" height="6" rx="1" fill={c} />
          <rect x={26.5 + i * 19} y="32.4" width="11" height="2" rx="1" fill={C.dark2} />
        </g>
      ))}
      <rect x="22" y="48" width="76" height="4" rx="2" fill={C.dark2} />
      <circle cx="100" cy="59" r="2" fill={C.success} />
      {/* лист с каплей чернил */}
      <path d="M26 52 H94 L99 84 H21 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M31 58 H60 M31 62 H54 M31 66 H58" stroke={C.paperLine} strokeWidth={1.4} strokeLinecap="round" />
      <rect x="66" y="58" width="22" height="18" rx="1.5" fill={C.primarySoft} />
      <path d="M77 60 C74 64 73 66 73 68 A4 4 0 0 0 81 68 C81 66 80 64 77 60 Z" fill={C.primary} />
    </Art>
  );
}

export function PrinterLaserArt() {
  return (
    <Art>
      <Shadow cy={84} rx={46} />
      {/* высокий короб: сверху выходной лоток, посередине дверца с тонером, снизу лоток с бумагой */}
      <rect x="16" y="22" width="88" height="60" rx="5" fill={C.shell2} />
      <rect x="16" y="14" width="88" height="40" rx="5" fill={C.shell1} />
      <rect x="16" y="14" width="88" height="3" rx="1.5" {...GLOSS} />
      <path d="M26 14 L32 2 H88 L94 14 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M40 6 H80 M38 10 H78" stroke={C.paperLine} strokeWidth={1.2} strokeLinecap="round" />
      <rect x="24" y="26" width="46" height="22" rx="2.5" fill={C.shell2} />
      <rect x="28" y="30" width="38" height="8" rx="2" fill={C.dark} />
      <rect x="28" y="40" width="22" height="3" rx="1.5" fill={C.shell3} />
      <path d="M47 38 V47" stroke={C.danger} strokeWidth={1.4} strokeLinecap="round" />
      <rect x="76" y="26" width="22" height="12" rx="2" fill={C.glass} />
      <rect x="79" y="29" width="12" height="1.8" rx="0.9" fill={C.primary} />
      <circle cx="82" cy="34" r="1.6" fill={C.success} />
      <circle cx="88" cy="34" r="1.6" fill={C.shell3} />
      <rect x="76" y="42" width="22" height="4" rx="2" fill={C.shell3} />
      <rect x="16" y="52" width="88" height="1.6" fill={C.shell3} />
      {/* выдвижной лоток для бумаги */}
      <rect x="22" y="58" width="76" height="20" rx="3" fill={C.shell3} />
      <rect x="26" y="62" width="68" height="12" rx="2" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} />
      <rect x="50" y="75" width="20" height="2.4" rx="1.2" fill={C.dark2} />
    </Art>
  );
}

export function PlotterArt() {
  return (
    <Art>
      <Shadow cy={84} rx={56} />
      {/* стойка-ножки */}
      <path d="M22 62 L16 82 M98 62 L104 82" stroke={C.shell3} strokeWidth={3} strokeLinecap="round" />
      {/* широкий корпус */}
      <rect x="4" y="30" width="112" height="34" rx="4" fill={C.shell3} />
      <rect x="4" y="26" width="112" height="34" rx="4" fill={C.shell1} />
      <rect x="4" y="26" width="112" height="3" rx="1.5" {...GLOSS} />
      {/* рулон бумаги сверху */}
      <rect x="10" y="12" width="100" height="10" rx="5" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} />
      <ellipse cx="12" cy="17" rx="3.4" ry="5" fill={C.shell3} />
      <ellipse cx="108" cy="17" rx="3.4" ry="5" fill={C.shell3} />
      {/* направляющая и каретка с пером */}
      <rect x="10" y="33" width="100" height="3" rx="1.5" fill={C.shell3} />
      <rect x="64" y="30" width="14" height="14" rx="2" fill={C.dark} />
      <rect x="69" y="44" width="4" height="7" fill={C.danger} />
      <rect x="9" y="40" width="14" height="6" rx="2" fill={C.glass} />
      <circle cx="30" cy="43" r="1.5" fill={C.success} />
      {/* широкий лист с чертежом */}
      <path d="M12 56 H108 L112 82 H8 Z" fill={C.paper} stroke={C.paperLine} strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M22 76 V66 H40 V74 H56 V62 H72" fill="none" stroke={C.primary} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx="88" cy="70" r="6" fill="none" stroke={C.danger} strokeWidth={1.4} />
    </Art>
  );
}

export function PenTabletArt() {
  return (
    <Art>
      <Shadow cy={82} rx={50} />
      {/* тонкий планшет с рабочей областью и клавишами по краю */}
      <path d="M8 72 H106 V76 A3 3 0 0 1 103 79 H11 A3 3 0 0 1 8 76 Z" fill={C.shell3} />
      <path d="M22 18 H112 L106 72 H8 Z" fill={C.dark} />
      <path d="M28 24 H106 L101 66 H17 Z" fill={C.shell2} />
      <path d="M28 24 H106 L105.6 27 H27.7 Z" {...GLOSS} />
      <path d="M34 54 C44 34 54 62 66 44 S78 36 88 46" fill="none" stroke={C.primary} strokeWidth={2.2} strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={13.5 - i * 0.7} y={28 + i * 10} width="5" height="6" rx="1.5" fill={C.shell3} />
      ))}
      {/* перо */}
      <g transform="rotate(35 95 40)">
        <rect x="92" y="4" width="6" height="34" rx="3" fill={C.primaryStrong} />
        <rect x="92" y="4" width="2" height="32" rx="1" {...GLOSS} />
        <rect x="92" y="20" width="6" height="3" fill={C.dark} />
        <path d="M92 38 H98 L95 45 Z" fill={C.shell1} />
        <circle cx="95" cy="45.5" r="0.9" fill={C.dark} />
      </g>
    </Art>
  );
}
