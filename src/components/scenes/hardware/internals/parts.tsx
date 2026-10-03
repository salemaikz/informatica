import { Art, C, Fan, GLOSS, Shadow, Stripes } from "./kit";

// Детали системного блока (viewBox 0 0 120 90): корпус, плата, процессор, кулер, ОЗУ, SSD, HDD, видеокарта, БП.

/** Системный блок закрытый, вид спереди-сбоку: передняя панель с кнопкой, боковое окно с вентилятором. */
export function CaseArt() {
  return (
    <Art>
      <Shadow cx={64} cy={82} rx={40} />
      {/* верх и бок */}
      <path d="M36 12 L54 5 L90 5 L72 12 Z" fill={C.shell1} />
      <path d="M72 12 L90 5 L90 74 L72 81 Z" fill={C.shell3} />
      {/* окно бокового стекла */}
      <path d="M75 18 L87 13 L87 66 L75 71 Z" fill={C.dark2} />
      <ellipse cx={81} cy={30} rx={4.4} ry={6.2} fill={C.dark} />
      <ellipse cx={81} cy={30} rx={2.2} ry={3} fill={C.primary} opacity={0.75} />
      <ellipse cx={81} cy={50} rx={4.4} ry={6.2} fill={C.dark} />
      <ellipse cx={81} cy={50} rx={2.2} ry={3} fill={C.primary} opacity={0.75} />
      <path d="M75 18 L87 13 L87 20 L75 25 Z" {...GLOSS} />
      {/* передняя панель */}
      <rect x={36} y={12} width={36} height={69} rx={2} fill={C.shell2} />
      <rect x={39} y={15} width={30} height={63} rx={1.5} fill={C.dark} />
      {/* кнопка питания с подсветкой */}
      <circle cx={54} cy={23} r={4.2} fill={C.dark2} />
      <circle cx={54} cy={23} r={3} fill="none" stroke={C.primary} strokeWidth={1.2} />
      <path d="M54 20.6 V23" stroke={C.primary} strokeWidth={1.2} strokeLinecap="round" />
      {/* порты USB и аудио */}
      <rect x={44} y={31} width={6} height={2.4} rx={0.6} fill={C.dark2} stroke={C.shell3} strokeWidth={0.5} />
      <rect x={52} y={31} width={6} height={2.4} rx={0.6} fill={C.dark2} stroke={C.shell3} strokeWidth={0.5} />
      <circle cx={62} cy={32.2} r={1.3} fill={C.dark2} stroke={C.shell3} strokeWidth={0.5} />
      {/* решётка передней панели */}
      <Stripes x={43} y={40} n={9} w={22} h={1.4} step={4} fill={C.dark2} vertical={false} />
      {/* ножки */}
      <rect x={40} y={80} width={6} height={2} rx={1} fill={C.dark2} />
      <rect x={62} y={80} width={6} height={2} rx={1} fill={C.dark2} />
    </Art>
  );
}

/** Материнская плата сверху: сокет, слоты ОЗУ, слоты PCIe, чипсет, разъёмы. */
export function MotherboardArt() {
  return (
    <Art>
      <Shadow cx={60} cy={83} rx={44} />
      <rect x={16} y={6} width={88} height={74} rx={2.5} fill={C.pcb} />
      {/* дорожки */}
      <g stroke={C.pcbLine} strokeWidth={0.6} fill="none" opacity={0.55}>
        <path d="M54 30 H60 V18" />
        <path d="M54 34 H64 V18" />
        <path d="M42 42 V50 H70" />
        <path d="M48 42 V47 H86 V58" />
        <path d="M30 70 H60 V76" />
        <path d="M90 50 V70 H96" />
      </g>
      {/* разъёмы задней панели */}
      <rect x={16} y={8} width={10} height={30} rx={1} fill={C.metal2} />
      <rect x={18} y={11} width={6} height={4} rx={0.6} fill={C.dark2} />
      <rect x={18} y={18} width={6} height={4} rx={0.6} fill={C.primary} />
      <rect x={18} y={25} width={6} height={4} rx={0.6} fill={C.dark2} />
      <circle cx={21} cy={33.5} r={1.6} fill={C.success} />
      {/* сокет процессора */}
      <rect x={30} y={14} width={24} height={24} rx={1.5} fill={C.metal3} />
      <rect x={33} y={17} width={18} height={18} rx={1} fill={C.metal1} />
      <path d="M33 17 h4 l-4 4 Z" fill={C.gold} />
      {/* слоты ОЗУ */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={62 + i * 6} y={10} width={4} height={34} rx={0.8} fill={i % 2 ? C.dark : C.shell3} />
          <rect x={62.6 + i * 6} y={12} width={2.8} height={30} rx={0.5} fill={C.dark2} />
        </g>
      ))}
      {/* 24-pin питание */}
      <rect x={92} y={12} width={8} height={26} rx={1} fill={C.paper} />
      <Stripes x={93.6} y={14} n={6} w={4.8} h={2} step={4} fill={C.shell3} vertical={false} />
      {/* слоты PCIe */}
      <rect x={24} y={50} width={44} height={4} rx={0.8} fill={C.dark2} />
      <rect x={24} y={62} width={44} height={4} rx={0.8} fill={C.dark2} />
      <rect x={24} y={71} width={20} height={3} rx={0.8} fill={C.dark2} />
      {/* чипсет под радиатором */}
      <rect x={74} y={54} width={16} height={16} rx={1.5} fill={C.metal2} />
      <Stripes x={76} y={56} n={5} w={1.6} h={12} step={2.8} fill={C.metal3} />
      {/* конденсаторы */}
      {[
        [56, 18],
        [56, 25],
        [40, 44],
        [46, 44],
        [96, 44],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={2.2} fill={C.metal3} />
          <circle cx={cx} cy={cy} r={1.2} fill={C.metal1} />
        </g>
      ))}
      {/* батарейка BIOS */}
      <circle cx={84} cy={76} r={3.2} fill={C.metal2} />
      <circle cx={84} cy={76} r={2.2} fill={C.metal1} />
      {/* отверстия под винты */}
      {[
        [20, 76],
        [100, 9.5],
        [100, 76],
        [58, 76],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.5} fill={C.gold} />
      ))}
    </Art>
  );
}

/** Процессор: квадрат на зелёной подложке, металлическая крышка, ряды контактов по краям. */
export function CpuArt() {
  const pins = Array.from({ length: 11 }, (_, i) => 35 + i * 5);
  return (
    <Art>
      <Shadow cx={60} cy={83} rx={34} />
      {/* ножки по четырём сторонам */}
      <g fill={C.gold}>
        {pins.map((p) => (
          <g key={p}>
            <rect x={p - 0.8} y={4} width={1.6} height={5} rx={0.5} />
            <rect x={p - 0.8} y={75} width={1.6} height={5} rx={0.5} />
            <rect x={23} y={p - 3.2} width={5} height={1.6} rx={0.5} />
            <rect x={92} y={p - 3.2} width={5} height={1.6} rx={0.5} />
          </g>
        ))}
      </g>
      {/* подложка */}
      <rect x={27} y={8} width={66} height={68} rx={3} fill={C.pcb2} />
      <rect x={27} y={8} width={66} height={68} rx={3} fill="none" stroke={C.pcb} strokeWidth={1.4} />
      {/* мелкие элементы на подложке */}
      <Stripes x={33} y={68} n={8} w={2} h={3} step={3.4} fill={C.gold} />
      {/* крышка-теплораспределитель */}
      <rect x={36} y={15} width={48} height={48} rx={3} fill={C.metal2} />
      <rect x={38} y={17} width={44} height={44} rx={2} fill={C.metal1} />
      <path d="M38 17 h44 v10 Z" {...GLOSS} />
      {/* гравировка */}
      <rect x={45} y={35} width={30} height={3} rx={1} fill={C.metal3} />
      <rect x={49} y={41} width={22} height={2} rx={1} fill={C.metal3} />
      {/* метка-ключ в углу */}
      <path d="M29 10 h6 l-6 6 Z" fill={C.gold} />
    </Art>
  );
}

/** Кулер: башня из рёбер радиатора, вентилятор спереди, медные тепловые трубки. */
export function CoolerArt() {
  return (
    <Art>
      <Shadow cx={60} cy={83} rx={34} />
      {/* тепловые трубки */}
      <g fill="none" stroke={C.copper} strokeWidth={2.6} strokeLinecap="round">
        <path d="M44 8 V4" />
        <path d="M52 8 V3" />
        <path d="M68 8 V3" />
        <path d="M76 8 V4" />
      </g>
      {/* радиатор */}
      <rect x={30} y={7} width={60} height={64} rx={2} fill={C.metal2} />
      <Stripes x={31.5} y={8} n={20} w={1.4} h={62} step={3} fill={C.metal1} />
      {/* основание */}
      <rect x={42} y={71} width={36} height={6} rx={1} fill={C.copper} />
      <rect x={38} y={77} width={44} height={3} rx={1} fill={C.metal3} />
      {/* вентилятор */}
      <Fan cx={60} cy={39} size={44} />
      {/* скобы крепления вентилятора */}
      <rect x={36} y={14} width={3} height={50} rx={1} fill={C.metal3} />
      <rect x={81} y={14} width={3} height={50} rx={1} fill={C.metal3} />
    </Art>
  );
}

/** Планка оперативной памяти: длинная плата с чипами, золотые контакты и ключ (вырез). */
export function RamArt() {
  const chips = [16, 28, 40, 52, 70, 82, 94];
  return (
    <Art>
      <Shadow cx={60} cy={72} rx={52} ry={3.6} />
      <path d="M8 26 H112 V40 A2.6 2.6 0 0 0 112 45.2 V63 H66 V58 H62 V63 H8 V45.2 A2.6 2.6 0 0 0 8 40 Z" fill={C.pcb2} />
      {/* чипы */}
      {chips.map((x) => (
        <g key={x}>
          <rect x={x} y={31} width={9} height={14} rx={0.8} fill={C.chip} />
          <rect x={x + 1} y={32} width={7} height={2} rx={0.5} fill={C.chipTop} />
        </g>
      ))}
      {/* наклейка */}
      <rect x={16} y={47} width={30} height={6} rx={1} fill={C.paper} />
      <rect x={18} y={49} width={16} height={1.4} rx={0.6} fill={C.shell3} />
      {/* контакты: две группы, между ними ключ */}
      <Stripes x={12} y={56} n={17} w={1.6} h={6.5} step={2.8} fill={C.gold} />
      <Stripes x={68.5} y={56} n={15} w={1.6} h={6.5} step={2.8} fill={C.gold} />
      <path d="M8 26 H112 V29 H8 Z" {...GLOSS} />
    </Art>
  );
}

/** SSD 2,5″ со снятой крышкой: плата с контроллером и чипами флеш-памяти, разъём SATA. */
export function SsdArt() {
  return (
    <Art>
      <Shadow cx={60} cy={82} rx={42} />
      {/* корпус */}
      <rect x={18} y={10} width={84} height={68} rx={4} fill={C.dark} />
      <rect x={21} y={13} width={78} height={62} rx={2.5} fill={C.dark2} />
      {/* плата */}
      <rect x={25} y={17} width={66} height={54} rx={2} fill={C.pcb2} />
      <g stroke={C.pcbLine} strokeWidth={0.6} fill="none" opacity={0.55}>
        <path d="M42 34 H50 V28" />
        <path d="M42 40 H50 V58" />
        <path d="M36 50 V62 H50" />
      </g>
      {/* контроллер */}
      <rect x={29} y={29} width={14} height={14} rx={1} fill={C.chip} />
      <rect x={31} y={31} width={10} height={3} rx={0.6} fill={C.chipTop} />
      {/* память NAND */}
      <rect x={52} y={22} width={16} height={20} rx={1} fill={C.chip} />
      <rect x={71} y={22} width={16} height={20} rx={1} fill={C.chip} />
      <rect x={52} y={46} width={16} height={20} rx={1} fill={C.chip} />
      <rect x={71} y={46} width={16} height={20} rx={1} fill={C.chip} />
      {[52, 71].map((x) => (
        <g key={x} fill={C.chipTop}>
          <rect x={x + 2} y={24} width={12} height={3} rx={0.6} />
          <rect x={x + 2} y={48} width={12} height={3} rx={0.6} />
        </g>
      ))}
      {/* DRAM-кэш */}
      <rect x={30} y={50} width={8} height={8} rx={0.8} fill={C.chip} />
      {/* разъём SATA на торце */}
      <rect x={12} y={30} width={7} height={28} rx={1} fill={C.dark} />
      <rect x={13.5} y={33} width={4} height={8} rx={0.6} fill={C.gold} />
      <rect x={13.5} y={44} width={4} height={11} rx={0.6} fill={C.gold} />
      {/* светодиод */}
      <circle cx={86} cy={69} r={1.4} fill={C.primary} />
    </Art>
  );
}

/** Жёсткий диск со снятой крышкой: круглая пластина, шпиндель, коромысло с головкой, магнит. */
export function HddArt() {
  return (
    <Art>
      <Shadow cx={60} cy={83} rx={42} />
      {/* корпус */}
      <rect x={16} y={6} width={88} height={74} rx={5} fill={C.metal3} />
      <rect x={19} y={9} width={82} height={68} rx={4} fill={C.metal2} />
      {/* пластина */}
      <circle cx={52} cy={41} r={31} fill={C.shell3} />
      <circle cx={52} cy={41} r={29.5} fill={C.metal1} />
      <circle cx={52} cy={41} r={22} fill="none" stroke={C.metal2} strokeWidth={0.8} />
      <circle cx={52} cy={41} r={15} fill="none" stroke={C.metal2} strokeWidth={0.8} />
      <path d="M33 22 A27 27 0 0 1 71 22 L62 31 A14 14 0 0 0 42 31 Z" {...GLOSS} />
      {/* шпиндель */}
      <circle cx={52} cy={41} r={7} fill={C.metal3} />
      <circle cx={52} cy={41} r={4.5} fill={C.metal2} />
      <circle cx={52} cy={41} r={1.6} fill={C.metal3} />
      {/* магнит привода */}
      <path d="M86 56 L100 56 L100 76 L82 76 Z" fill={C.dark} />
      {/* коромысло с головкой */}
      <path d="M90 66 L60 26 L57.5 28 L84.5 69 Z" fill={C.metal3} />
      <path d="M61 24.5 L57 29.5 L54.5 27.5 L58.5 22.5 Z" fill={C.dark} />
      <circle cx={89} cy={66} r={6} fill={C.metal3} />
      <circle cx={89} cy={66} r={3} fill={C.metal1} />
      {/* шлейф */}
      <path d="M92 60 C96 52 96 44 99 36" fill="none" stroke={C.warning} strokeWidth={2} strokeLinecap="round" />
      {/* винты */}
      {[
        [22, 12],
        [98, 12],
        [22, 74],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.7} fill={C.metal3} />
      ))}
    </Art>
  );
}

/** Видеокарта: кожух с двумя вентиляторами, плата с золотыми контактами PCIe, металлическая планка с портами. */
export function GpuArt() {
  return (
    <Art>
      <Shadow cx={62} cy={80} rx={50} ry={3.6} />
      {/* плата снизу */}
      <rect x={14} y={58} width={98} height={8} rx={1} fill={C.pcb} />
      <Stripes x={34} y={66} n={16} w={1.6} h={5} step={2.6} fill={C.gold} />
      <Stripes x={78} y={66} n={4} w={1.6} h={5} step={2.6} fill={C.gold} />
      {/* кожух */}
      <rect x={12} y={18} width={102} height={42} rx={5} fill={C.dark} />
      <path d="M12 23 a5 5 0 0 1 5 -5 h92 a5 5 0 0 1 5 5 v3 h-102 Z" fill={C.shell3} opacity={0.35} />
      <path d="M66 18 l6 42 h3 l-6 -42 Z" fill={C.primary} opacity={0.8} />
      {/* вентиляторы */}
      {[40, 90].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={39} r={17} fill={C.dark2} />
          <Fan cx={cx} cy={39} size={32} frame="transparent" hole={C.dark2} blade={C.shell3} hub={C.dark} blades={9} />
        </g>
      ))}
      {/* планка с портами */}
      <rect x={4} y={12} width={8} height={62} rx={1} fill={C.metal2} />
      <rect x={6} y={20} width={4} height={8} rx={0.8} fill={C.dark2} />
      <rect x={6} y={31} width={4} height={8} rx={0.8} fill={C.dark2} />
      <rect x={6} y={42} width={4} height={6} rx={0.8} fill={C.dark2} />
      <path d="M4 12 h8 v-3 h-5 Z" fill={C.metal3} />
    </Art>
  );
}

/** Блок питания: короб с вентилятором-решёткой, гнездо и выключатель, жгут проводов с разъёмом. */
export function PsuArt() {
  return (
    <Art>
      <Shadow cx={58} cy={82} rx={44} />
      {/* провода */}
      <g fill="none" strokeLinecap="round" strokeWidth={2.2}>
        <path d="M86 52 C98 52 100 62 106 64" stroke={C.dark} />
        <path d="M86 58 C96 58 98 68 104 70" stroke={C.warning} />
        <path d="M86 46 C100 44 102 52 108 54" stroke={C.danger} />
      </g>
      <rect x={102} y={58} width={12} height={16} rx={1.5} fill={C.paper} />
      <Stripes x={104} y={60} n={4} w={8} h={2.2} step={3.4} fill={C.shell3} vertical={false} />
      {/* корпус */}
      <rect x={14} y={14} width={74} height={64} rx={3} fill={C.dark} />
      <path d="M14 17 a3 3 0 0 1 3 -3 h68 a3 3 0 0 1 3 3 v3 h-74 Z" fill={C.shell3} opacity={0.35} />
      {/* решётка вентилятора */}
      <circle cx={44} cy={46} r={25} fill={C.dark2} />
      <Fan cx={44} cy={46} size={44} frame="transparent" hole={C.dark2} blade={C.dark} hub={C.dark} />
      <g fill="none" stroke={C.shell3} strokeWidth={1}>
        <circle cx={44} cy={46} r={23} />
        <circle cx={44} cy={46} r={16} />
        <circle cx={44} cy={46} r={9} />
        <path d="M21 46 H67 M44 23 V69" />
      </g>
      {/* гнездо питания и выключатель */}
      <rect x={73} y={20} width={11} height={9} rx={1.5} fill={C.dark2} />
      <rect x={75.5} y={22.5} width={6} height={4} rx={0.6} fill={C.shell3} />
      <rect x={75} y={33} width={7} height={10} rx={1} fill={C.dark2} />
      <rect x={76.5} y={34.5} width={4} height={4} rx={0.5} fill={C.danger} />
      {/* значок «высокое напряжение» */}
      <path d="M79 54 L75 62 H78.5 L77 69 L82 60 H78.5 L80 54 Z" fill={C.warning} />
    </Art>
  );
}
