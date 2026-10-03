import { Art, C, GLOSS, Shadow, Stripes, mix, ring } from "./kit";

// Носители информации (viewBox 0 0 120 90): флешка, карта памяти, оптический диск, облако, внешний диск.

/** Флешка: корпус и металлический разъём USB с двумя окошками, петля для брелока, индикатор. */
export function FlashArt() {
  return (
    <Art>
      <Shadow cx={62} cy={66} rx={44} ry={3.6} />
      {/* разъём USB */}
      <rect x={10} y={33} width={34} height={22} rx={1.5} fill={C.metal2} />
      <rect x={10} y={33} width={34} height={6} rx={1.5} fill={C.metal1} />
      <rect x={16} y={40} width={6} height={5} rx={0.6} fill={C.dark2} />
      <rect x={30} y={40} width={6} height={5} rx={0.6} fill={C.dark2} />
      <rect x={12} y={48} width={30} height={5} rx={0.6} fill={C.metal3} />
      {/* корпус */}
      <rect x={40} y={27} width={68} height={34} rx={9} fill={C.primary} />
      <rect x={40} y={45} width={68} height={16} rx={8} fill={C.primaryStrong} />
      <rect x={40} y={36} width={68} height={16} fill={C.primary} />
      <rect x={46} y={30} width={50} height={5} rx={2.5} {...GLOSS} />
      {/* петля и индикатор */}
      <path d={ring(99, 44, 4.2, 2.2)} fill={C.primaryStrong} fillRule="evenodd" />
      <circle cx={50} cy={44} r={1.6} fill={C.success} />
    </Art>
  );
}

/** Карта памяти SD со срезанным углом, контактами и переключателем защиты, рядом microSD. */
export function SdArt() {
  return (
    <Art>
      <Shadow cx={58} cy={83} rx={38} />
      {/* SD */}
      <path d="M26 8 H62 L72 18 V78 a3 3 0 0 1 -3 3 H29 a3 3 0 0 1 -3 -3 Z" fill={C.dark} />
      <path d="M29 30 H69 V70 H29 Z" fill={C.primary} />
      <path d="M29 30 H69 V40 H29 Z" fill={C.primaryStrong} />
      <rect x={33} y={46} width={22} height={3} rx={1.5} fill={C.paper} opacity={0.9} />
      <rect x={33} y={52} width={14} height={3} rx={1.5} fill={C.paper} opacity={0.6} />
      {/* контакты */}
      <Stripes x={30} y={12} n={7} w={3.6} h={9} step={5} fill={C.gold} />
      <rect x={66} y={21} width={3.6} height={6} rx={0.6} fill={C.gold} />
      {/* переключатель защиты от записи */}
      <rect x={23} y={30} width={4} height={14} rx={1} fill={C.dark2} />
      <rect x={22} y={32} width={4} height={5} rx={1} fill={C.paper} />
      {/* microSD */}
      <path d="M80 44 H96 L98 47 V52 L96 54 V74 a2 2 0 0 1 -2 2 H82 a2 2 0 0 1 -2 -2 Z" fill={C.dark} />
      <rect x={82} y={58} width={12} height={14} rx={1} fill={C.primary} />
      <Stripes x={82} y={46} n={4} w={2} h={6} step={3.2} fill={C.gold} />
    </Art>
  );
}

/** Оптический диск CD/DVD: блестящая поверхность с радужным отливом, прозрачное кольцо и отверстие. */
export function CdArt() {
  return (
    <Art>
      <Shadow cx={60} cy={83} rx={34} />
      <path d={ring(60, 44, 36, 6)} fill={C.metal2} fillRule="evenodd" />
      <path d={ring(60, 44, 34.5, 12)} fill={C.metal1} fillRule="evenodd" />
      {/* радужный отлив — сектора полупрозрачных цветов */}
      <path d="M60 32 L60 9.5 A34.5 34.5 0 0 1 89.9 26.7 L70.4 38 A12 12 0 0 0 60 32 Z" fill={C.primary} opacity={0.28} />
      <path d="M70.4 38 L89.9 26.7 A34.5 34.5 0 0 1 94.5 44 L72 44 A12 12 0 0 0 70.4 38 Z" fill={C.ai} opacity={0.22} />
      <path d="M60 56 L60 78.5 A34.5 34.5 0 0 1 30.1 61.3 L49.6 50 A12 12 0 0 0 60 56 Z" fill={C.success} opacity={0.22} />
      <path d="M49.6 50 L30.1 61.3 A34.5 34.5 0 0 1 25.5 44 L48 44 A12 12 0 0 0 49.6 50 Z" fill={C.warning} opacity={0.28} />
      <circle cx={60} cy={44} r={28} fill="none" stroke={C.metal2} strokeWidth={0.6} />
      <circle cx={60} cy={44} r={20} fill="none" stroke={C.metal2} strokeWidth={0.6} />
      {/* прозрачное кольцо вокруг отверстия */}
      <path d={ring(60, 44, 10, 6)} fill={mix("var(--muted)", 18, "var(--surface)")} fillRule="evenodd" />
      <circle cx={60} cy={44} r={6} fill="none" stroke={C.metal3} strokeWidth={1} />
      {/* блик */}
      <path d="M40 18 A34 34 0 0 1 56 10 L58 30 A14 14 0 0 0 50 33 Z" {...GLOSS} />
    </Art>
  );
}

/** Облако: хранилище в интернете — облако со стрелками загрузки и сервер под ним. */
export function CloudArt() {
  return (
    <Art>
      <Shadow cx={60} cy={84} rx={24} ry={3} />
      {/* связь облака с сервером */}
      <path d="M60 52 V62" stroke={C.shell3} strokeWidth={2} strokeDasharray="2.5 2.5" />
      {/* облако */}
      <path
        d="M30 52 a14 14 0 0 1 2 -27.8 a20 20 0 0 1 37 -6 a15 15 0 0 1 22 13 a11 11 0 0 1 -1 21.8 Z"
        fill={C.primarySoft}
        stroke={C.primary}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {/* стрелки: загрузить и скачать */}
      <g fill="none" stroke={C.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M52 44 V26 M45 33 L52 26 L59 33" />
        <path d="M70 26 V44 M63 37 L70 44 L77 37" />
      </g>
      {/* сервер */}
      <rect x={44} y={62} width={32} height={20} rx={2} fill={C.dark} />
      <rect x={46.5} y={64.5} width={27} height={6.5} rx={1} fill={C.dark2} />
      <rect x={46.5} y={73} width={27} height={6.5} rx={1} fill={C.dark2} />
      <circle cx={50} cy={67.7} r={1.2} fill={C.success} />
      <circle cx={50} cy={76.2} r={1.2} fill={C.success} />
      <Stripes x={56} y={66.7} n={5} w={1.4} h={2} step={3} fill={C.shell3} />
      <Stripes x={56} y={75.2} n={5} w={1.4} h={2} step={3} fill={C.shell3} />
    </Art>
  );
}

/** Внешний диск: плоский корпус с индикатором и кабель USB со штекером. */
export function ExtHddArt() {
  return (
    <Art>
      <Shadow cx={56} cy={80} rx={42} />
      {/* кабель */}
      <path d="M78 62 C92 70 98 56 104 44" fill="none" stroke={C.dark} strokeWidth={2.6} strokeLinecap="round" />
      <rect x={100} y={30} width={9} height={12} rx={1.5} fill={C.dark} transform="rotate(20 104.5 36)" />
      <rect x={102} y={22} width={6} height={9} rx={0.8} fill={C.metal2} transform="rotate(20 104.5 36)" />
      {/* корпус */}
      <rect x={18} y={10} width={62} height={68} rx={8} fill={C.dark} />
      <rect x={22} y={14} width={54} height={60} rx={6} fill={C.shell3} />
      <rect x={22} y={14} width={54} height={60} rx={6} fill={C.dark} opacity={0.35} />
      <path d="M22 20 a6 6 0 0 1 6 -6 h42 a6 6 0 0 1 6 6 v6 h-54 Z" {...GLOSS} />
      {/* окружность — намёк на пластину внутри */}
      <circle cx={49} cy={46} r={16} fill="none" stroke={C.shell2} strokeWidth={1.4} opacity={0.6} />
      <circle cx={49} cy={46} r={3} fill={C.shell2} opacity={0.6} />
      {/* индикатор и разъём */}
      <rect x={42} y={66} width={14} height={3} rx={1.5} fill={C.primary} />
      <rect x={72} y={56} width={8} height={10} rx={1.5} fill={C.dark2} />
    </Art>
  );
}
