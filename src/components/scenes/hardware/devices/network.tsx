import type { ReactNode } from "react";
import { Art, C, GLOSS, Shadow, Waves } from "./kit";

// Сетевые устройства: коммутатор, концентратор, модем, точка доступа, сетевая карта, витая пара, оптоволокно.

/** Порт RJ-45: гнездо с контактами; plug — вставлен кабель сверху. */
function Port({ x, y, plug, color = C.primary }: { x: number; y: number; plug?: boolean; color?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="9" height="8" rx="1.2" fill={C.dark2} />
      <path d={`M${x + 1.8} ${y + 8} V${y + 6.2} H${x + 7.2} V${y + 8}`} fill="none" stroke={C.gold} strokeWidth={0.8} />
      {plug && (
        <g>
          <rect x={x - 0.5} y={y - 2} width="10" height="9" rx="1.2" fill={C.shell1} />
          <rect x={x + 1.5} y={y - 14} width="6" height="12.5" fill={color} />
        </g>
      )}
    </g>
  );
}

export function SwitchArt() {
  const ports: ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 17 + i * 11.6;
    const on = i % 3 !== 2;
    ports.push(<Port key={`a${i}`} x={x} y={46} plug={on} color={i % 2 ? C.primary : C.success} />);
    ports.push(<circle key={`l${i}`} cx={x + 4.5} cy={41} r={1.1} fill={on ? C.success : C.shell3} />);
  }
  return (
    <Art>
      <Shadow cy={78} rx={54} />
      {/* широкий плоский корпус коммутатора с рядом портов */}
      <rect x="6" y="36" width="108" height="32" rx="3.5" fill={C.shell3} />
      <rect x="6" y="34" width="108" height="32" rx="3.5" fill={C.shell1} />
      <rect x="6" y="34" width="108" height="2.5" rx="1.2" {...GLOSS} />
      <circle cx="11" cy="50" r="1.6" fill={C.dark2} />
      <circle cx="109" cy="50" r="1.6" fill={C.dark2} />
      {ports}
      <rect x="17" y="59" width="26" height="1.6" rx="0.8" fill={C.shell3} />
      <rect x="86" y="59" width="20" height="1.6" rx="0.8" fill={C.shell3} />
    </Art>
  );
}

export function HubArt() {
  return (
    <Art>
      <Shadow cy={80} rx={42} />
      {/* небольшая коробка с четырьмя портами; сверху — сигнал разветвляется во все стороны */}
      <rect x="28" y="42" width="64" height="30" rx="4" fill={C.shell3} />
      <rect x="28" y="39" width="64" height="30" rx="4" fill={C.shell2} />
      <rect x="28" y="39" width="64" height="3" rx="1.5" {...GLOSS} />
      <Port x={34} y={54} plug color={C.primary} />
      <Port x={47} y={54} plug color={C.success} />
      <Port x={60} y={54} plug color={C.gold} />
      <Port x={73} y={54} plug color={C.ai} />
      {[38, 51, 64, 77].map((x) => (
        <circle key={x} cx={x + 0.5} cy={47} r={1.2} fill={C.success} />
      ))}
      {/* стрелки наружу: хаб повторяет кадр на все порты */}
      <path d="M60 36 V30 M60 30 L40 18 M60 30 L52 14 M60 30 L68 14 M60 30 L80 18" fill="none" stroke={C.primary} strokeWidth={2} strokeLinecap="round" />
      <path d="M36 14 L42 20 L35 22 Z M50 8 L54 14 L47 15 Z M70 8 L73 15 L66 14 Z M84 14 L85 22 L78 20 Z" fill={C.primary} />
    </Art>
  );
}

export function ModemArt() {
  return (
    <Art>
      <Shadow cy={80} rx={50} />
      {/* телефонная линия слева, кабель к компьютеру справа */}
      <path d="M2 64 H14" stroke={C.gold} strokeWidth={3} strokeLinecap="round" />
      <path d="M106 64 H118" stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
      <path d="M16 50 H100 L106 72 H10 Z" fill={C.shell1} />
      <path d="M10 72 H106 V76 A3 3 0 0 1 103 79 H13 A3 3 0 0 1 10 76 Z" fill={C.shell3} />
      <path d="M16 50 H100 L101 53 H15 Z" {...GLOSS} />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={26 + i * 9} cy={60} r={1.7} fill={i === 3 ? C.warning : C.success} />
      ))}
      <rect x="74" y="57" width="22" height="7" rx="1.6" fill={C.dark2} />
      <rect x="77" y="60" width="6" height="1.6" rx="0.8" fill={C.success} />
      {/* аналоговая волна превращается в цифровые импульсы */}
      <path d="M12 28 Q18 16 24 28 T36 28" fill="none" stroke={C.gold} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M46 28 H66 M60 23 L66 28 L60 33" fill="none" stroke={C.shell3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 34 V22 H84 V34 H92 V22 H100 V34" fill="none" stroke={C.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Art>
  );
}

export function AccessPointArt() {
  return (
    <Art>
      <Shadow cy={84} rx={26} ry={2.5} />
      <Waves cx={60} cy={44} dir={-90} radii={[14, 23, 32]} spread={46} width={2.4} />
      {/* круглая точка доступа, кабель вниз */}
      <path d="M60 68 V84" stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx="60" cy="65" rx="27" ry="8" fill={C.shell3} />
      <path d="M33 60 A27 8 0 0 1 87 60 V65 A27 8 0 0 1 33 65 Z" fill={C.shell2} />
      <ellipse cx="60" cy="60" rx="27" ry="8" fill={C.shell1} />
      <ellipse cx="60" cy="60" rx="19" ry="5" fill={C.shell2} />
      <ellipse cx="53" cy="58.5" rx="9" ry="1.4" {...GLOSS} />
      <circle cx="60" cy="61" r="2" fill={C.success} />
      <circle cx="68" cy="61" r="1.1" fill={C.success} fillOpacity={0.5} />
    </Art>
  );
}

export function NicArt() {
  const green = `color-mix(in srgb, ${C.success} 55%, ${C.dark})`;
  return (
    <Art>
      <Shadow cy={82} rx={50} />
      {/* плата сетевой карты: планка с портом RJ-45 слева, золотые контакты снизу */}
      <rect x="14" y="14" width="8" height="62" rx="1.5" fill={C.shell3} />
      <rect x="16" y="14" width="2" height="62" fill={C.gloss} fillOpacity={0.25} />
      <rect x="22" y="18" width="88" height="48" rx="3" fill={green} />
      <rect x="22" y="18" width="88" height="2.5" rx="1.2" {...GLOSS} />
      <rect x="6" y="28" width="22" height="20" rx="2" fill={C.shell2} />
      <rect x="9" y="31" width="16" height="14" rx="1.2" fill={C.dark2} />
      <path d="M11 44 V40 H23 V44" fill="none" stroke={C.gold} strokeWidth={0.9} />
      <circle cx="10" cy="24" r="1.5" fill={C.success} />
      <circle cx="16" cy="24" r="1.5" fill={C.warning} />
      <rect x="44" y="28" width="22" height="22" rx="1.5" fill={C.dark} />
      <rect x="47" y="31" width="16" height="16" rx="1" fill={C.dark2} />
      <rect x="76" y="30" width="12" height="8" rx="1" fill={C.dark} />
      <rect x="92" y="30" width="10" height="5" rx="1" fill={C.shell3} />
      <path d="M30 56 H100 M66 38 H76 M66 44 H96" stroke={C.gold} strokeOpacity={0.7} strokeWidth={0.9} fill="none" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={30 + i * 4.4} y={66} width="2.8" height="9" fill={C.gold} />
      ))}
    </Art>
  );
}

export function CableUtpArt() {
  const pairs = [C.warning, C.success, C.primary, C.streak];
  return (
    <Art>
      <Shadow cy={80} rx={52} />
      {/* внешняя оболочка */}
      <rect x="2" y="26" width="48" height="16" rx="8" fill={C.primaryStrong} />
      <rect x="2" y="27" width="48" height="4" rx="2" {...GLOSS} />
      {/* срез оболочки: четыре витые пары (цветной + белый провод) */}
      {pairs.map((a, i) => {
        const y = 21 + i * 7;
        return (
          <g key={i}>
            <path d={`M44 ${y + 4} C54 ${y - 6} 68 ${y + 12} 82 ${y + 4}`} fill="none" stroke={a} strokeWidth={2.8} strokeLinecap="round" />
            <path d={`M44 ${y + 4} C54 ${y + 14} 68 ${y - 4} 82 ${y + 4}`} fill="none" stroke={C.paper} strokeWidth={2.8} strokeLinecap="round" />
          </g>
        );
      })}
      {/* разъём RJ-45 */}
      <rect x="82" y="14" width="30" height="40" rx="3" fill={C.shell1} stroke={C.shell3} strokeWidth={0.8} />
      <rect x="82" y="14" width="30" height="3" rx="1.5" {...GLOSS} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={85 + i * 3.1} y="22" width="1.6" height="22" fill={C.gold} />
      ))}
      <rect x="94" y="50" width="6" height="6" fill={C.shell3} />
    </Art>
  );
}

export function CableFiberArt() {
  return (
    <Art>
      <Shadow cy={82} rx={50} />
      {/* оболочка кабеля, внутри светящиеся волокна, на конце разъём */}
      <rect x="2" y="30" width="44" height="22" rx="11" fill={C.warning} fillOpacity={0.85} />
      <rect x="2" y="32" width="44" height="4" rx="2" {...GLOSS} />
      <rect x="40" y="33" width="12" height="16" fill={C.shell3} />
      {[-6, -2, 2, 6].map((d, i) => (
        <path key={i} d={`M42 ${41 + d / 2} L68 ${41 + d * 0.6}`} stroke={i % 2 ? C.gold : C.primary} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      ))}
      <rect x="52" y="30" width="14" height="22" rx="2" fill={C.shell2} />
      {/* разъём SC */}
      <rect x="66" y="26" width="28" height="30" rx="3" fill={C.shell1} stroke={C.shell3} strokeWidth={0.8} />
      <rect x="66" y="26" width="28" height="3" rx="1.5" {...GLOSS} />
      <rect x="94" y="35" width="10" height="12" rx="2" fill={C.dark} />
      <circle cx="99" cy="41" r="2.6" fill={C.gold} />
      {/* свет на конце */}
      <path d="M108 41 H116 M107 35 L114 31 M107 47 L114 51" stroke={C.gold} strokeWidth={2} strokeLinecap="round" />
    </Art>
  );
}
