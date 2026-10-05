import { Art, C, GLOSS, Shadow } from "./kit";

// Датчик, VR-шлем, робот-пылесос, дрон, манипулятор.

export function SensorArt() {
  return (
    <Art>
      <Shadow cy={84} rx={40} />
      {/* сигнал сверху */}
      <path d="M16 20 Q22 8 28 20 T40 20" fill="none" stroke={C.primary} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
      <path d="M80 20 Q86 8 92 20 T104 20" fill="none" stroke={C.primary} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
      {/* модуль-датчик: плата с чувствительным элементом, выводы вниз */}
      <rect x="26" y="30" width="68" height="42" rx="4" fill={`color-mix(in srgb, ${C.primaryStrong} 55%, ${C.dark})`} />
      <rect x="26" y="30" width="68" height="3" rx="1.5" {...GLOSS} />
      <circle cx="46" cy="50" r="15" fill={C.shell3} />
      <circle cx="46" cy="50" r="12" fill={C.shell1} />
      <circle cx="46" cy="50" r="7.5" fill={C.dark2} />
      <circle cx="46" cy="50" r="3" fill={C.primary} />
      <circle cx="43" cy="47" r="1.6" {...GLOSS} />
      <rect x="66" y="38" width="20" height="10" rx="1.5" fill={C.dark} />
      <circle cx="70" cy="62" r="2" fill={C.success} />
      <circle cx="77" cy="62" r="2" fill={C.danger} />
      <path d="M62 54 H88" stroke={C.gold} strokeOpacity={0.7} strokeWidth={0.9} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={36 + i * 14} y="72" width="3" height="10" fill={C.gold} />
      ))}
    </Art>
  );
}

export function VrHeadsetArt() {
  return (
    <Art>
      <Shadow cy={80} rx={46} />
      {/* ремни */}
      <path d="M8 36 Q4 46 10 56" fill="none" stroke={C.shell3} strokeWidth={7} strokeLinecap="round" />
      <path d="M112 36 Q116 46 110 56" fill="none" stroke={C.shell3} strokeWidth={7} strokeLinecap="round" />
      <path d="M26 16 Q60 4 94 16" fill="none" stroke={C.shell3} strokeWidth={6} strokeLinecap="round" />
      {/* передняя панель */}
      <rect x="12" y="20" width="96" height="46" rx="14" fill={C.dark2} />
      <rect x="12" y="18" width="96" height="46" rx="14" fill={C.dark} />
      <rect x="20" y="28" width="38" height="28" rx="10" fill={C.glass} />
      <rect x="62" y="28" width="38" height="28" rx="10" fill={C.glass} />
      <circle cx="39" cy="42" r="8" fill={C.lit} fillOpacity={0.5} />
      <circle cx="81" cy="42" r="8" fill={C.lit} fillOpacity={0.5} />
      <ellipse cx="33" cy="35" rx="6" ry="2.4" {...GLOSS} />
      <ellipse cx="75" cy="35" rx="6" ry="2.4" {...GLOSS} />
      <rect x="57" y="36" width="6" height="12" fill={C.dark2} />
      <circle cx="22" cy="23" r="2" fill={C.shell3} />
      <circle cx="98" cy="23" r="2" fill={C.shell3} />
      {/* нос */}
      <path d="M46 64 Q60 58 74 64 Q68 72 60 72 Q52 72 46 64 Z" fill={C.shell3} />
    </Art>
  );
}

export function RobotVacuumArt() {
  return (
    <Art>
      <Shadow cy={80} rx={44} />
      {/* пройденный путь */}
      <path d="M6 70 Q60 86 114 70" fill="none" stroke={C.primary} strokeOpacity={0.4} strokeWidth={3} strokeDasharray="1 5" strokeLinecap="round" />
      {/* диск с наклоном: корпус, лидар, кнопка, бампер, боковая щётка */}
      <ellipse cx="60" cy="52" rx="40" ry="26" fill={C.shell3} />
      <ellipse cx="60" cy="47" rx="40" ry="26" fill={C.shell1} />
      <ellipse cx="60" cy="47" rx="33" ry="20" fill={C.shell2} />
      <ellipse cx="46" cy="36" rx="17" ry="3.2" transform="rotate(-18 46 36)" {...GLOSS} />
      <path d="M24 38 Q60 12 96 38" fill="none" stroke={C.dark} strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx="60" cy="43" rx="11" ry="7" fill={C.dark2} />
      <ellipse cx="60" cy="40" rx="11" ry="7" fill={C.dark} />
      <circle cx="60" cy="39" r="2.6" fill={C.primary} />
      <circle cx="60" cy="60" r="4.5" fill={C.dark} />
      <circle cx="60" cy="60" r="2" fill={C.success} />
      <path d="M96 60 L110 50 M96 60 L112 60 M96 60 L109 69" stroke={C.primary} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="96" cy="60" r="2.4" fill={C.dark2} />
    </Art>
  );
}

function Rotor({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="15" ry="3.6" fill={C.shell3} fillOpacity={0.55} />
      <ellipse cx={cx} cy={cy} rx="15" ry="3.6" fill="none" stroke={C.shell3} strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r="3" fill={C.dark} />
    </g>
  );
}

export function DroneArt() {
  return (
    <Art>
      <Shadow cy={84} rx={34} ry={3} />
      {/* лучи рамы к четырём винтам */}
      <path d="M60 44 L22 30 M60 44 L98 30 M60 44 L24 58 M60 44 L96 58" stroke={C.dark} strokeWidth={4} strokeLinecap="round" />
      <path d="M22 33 V27 M98 33 V27 M24 61 V55 M96 61 V55" stroke={C.dark2} strokeWidth={3} strokeLinecap="round" />
      <Rotor cx={22} cy={25} />
      <Rotor cx={98} cy={25} />
      <Rotor cx={24} cy={53} />
      <Rotor cx={96} cy={53} />
      {/* корпус */}
      <ellipse cx="60" cy="44" rx="17" ry="11" fill={C.shell1} />
      <ellipse cx="60" cy="41" rx="17" ry="9" fill={C.shell2} />
      <ellipse cx="55" cy="38" rx="8" ry="2" {...GLOSS} />
      <circle cx="68" cy="43" r="2" fill={C.success} />
      {/* камера на подвесе */}
      <rect x="53" y="52" width="14" height="5" rx="2" fill={C.shell3} />
      <rect x="54" y="56" width="12" height="11" rx="3.5" fill={C.dark} />
      <circle cx="60" cy="62" r="3.4" fill={C.glass} />
      <circle cx="60" cy="62" r="1.4" fill={C.primary} />
    </Art>
  );
}

export function ManipulatorArt() {
  return (
    <Art>
      <Shadow cy={85} rx={46} ry={3.5} />
      {/* основание с поворотной стойкой */}
      <rect x="18" y="72" width="48" height="12" rx="3" fill={C.shell3} />
      <rect x="18" y="70" width="48" height="12" rx="3" fill={C.shell2} />
      <rect x="30" y="58" width="28" height="14" rx="3" fill={C.dark} />
      {/* два звена */}
      <path d="M44 60 L52 24" stroke={C.shell3} strokeWidth={11} strokeLinecap="round" />
      <path d="M44 60 L52 24" stroke={C.warning} strokeWidth={8} strokeLinecap="round" />
      <path d="M52 24 L92 34" stroke={C.shell3} strokeWidth={10} strokeLinecap="round" />
      <path d="M52 24 L92 34" stroke={C.warning} strokeWidth={7} strokeLinecap="round" />
      <circle cx="44" cy="60" r="6" fill={C.dark} />
      <circle cx="44" cy="60" r="2.4" fill={C.shell1} />
      <circle cx="52" cy="24" r="6" fill={C.dark} />
      <circle cx="52" cy="24" r="2.4" fill={C.shell1} />
      {/* схват с кубиком */}
      <rect x="88" y="34" width="9" height="8" rx="2" fill={C.dark} />
      <path d="M89 42 L87 54 M96 42 L98 54" stroke={C.dark} strokeWidth={3} strokeLinecap="round" fill="none" />
      <rect x="86" y="55" width="14" height="13" rx="1.5" fill={C.primary} />
      <rect x="86" y="55" width="14" height="3" rx="1.5" {...GLOSS} />
      <rect x="78" y="76" width="36" height="5" rx="2.5" fill={C.shell3} />
    </Art>
  );
}
