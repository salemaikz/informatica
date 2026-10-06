import { AbsoluteFill, interpolate } from "remotion";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", green: "#21b26f", pale: "#e3f7ec", line: "#d9e2ed" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const X = [310, 540, 770];
const weights = [4, 2, 1];
const powers = ["2²", "2¹", "2⁰"];
const titles = ["Запишем число 5 нулями и единицами", "Две цифры: 0 и 1", "Разложим пять: четыре и один", "Берём 4 — записываем 1", "Вес 2 не берём — записываем 0", "Берём 1 — записываем 1", "Двоичная запись готова"];

function DotGroup({ x, y, count, opacity = 1, collapse = 0 }: { x: number; y: number; count: number; opacity?: number; collapse?: number }) {
  return <g opacity={opacity}>
    {Array.from({ length: count }, (_, i) => <circle key={i} cx={x + (count === 1 ? 0 : (i % 2 ? 33 : -33) * (1 - collapse))} cy={y + (count < 3 ? 0 : (i < 2 ? -33 : 33) * (1 - collapse))} r={25 - collapse * 8} fill={C.blue} />)}
  </g>;
}

/** The amount stays five while groups become fixed-position binary digits. */
export function BinaryEncode({ frame }: { frame: number }) {
  const beat = Math.min(6, Math.floor(Math.max(0, frame) / 180));
  const local = Math.max(0, Math.min(179, frame - beat * 180));
  const fade = (start: number, length = 22) => interpolate(local, [start, start + length], [0, 1], clamp);
  const secondExample = beat === 6 && local >= 85;
  const focus = beat === 3 ? 0 : beat === 4 ? 1 : beat === 5 ? 2 : -1;
  const bits: Array<number | null> = beat === 3 ? [1, null, null] : beat === 4 ? [1, 0, null] : secondExample ? [1, 1, 0] : [1, 0, 1];
  const morph = beat === 3 || beat === 5 ? fade(5, 30) : 0;

  return <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="750" viewBox="0 0 1080 750" style={{ position: "absolute" }}>
      <rect width="1080" height="750" fill={C.bg} />
      <text x="80" y="91" fontSize="27" fill={C.blue}>ИЗ ЧИСЛА — В ДВОИЧНУЮ ЗАПИСЬ</text>
      <text x="80" y="163" fontSize="49" fontWeight="900" fill={beat === 6 ? C.green : C.ink}>{secondExample ? "Тот же способ: число 6" : titles[beat]}</text>

      {beat === 0 && <>
        <text x="315" y="256" textAnchor="middle" fontSize="40" fill={C.muted}>Обычная запись</text>
        <text x="785" y="256" textAnchor="middle" fontSize="40" fill={C.muted}>Двоичная запись</text>
        <text x="315" y="387" textAnchor="middle" fontFamily={MONO} fontSize="116" fill={C.ink}>5₁₀</text>
        <path d="M458 347h148l-19 -17m19 17l-19 17" stroke={C.blue} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="785" y="387" textAnchor="middle" fontFamily={MONO} fontSize="116" fill={C.blue}>?₂</text>
        {Array.from({ length: 5 }, (_, i) => <circle key={i} cx={170 + i * 185} cy="518" r="33" fill={C.blue} opacity={fade(i * 4, 18)} />)}
        <text x="540" y="678" textAnchor="middle" fontSize="47" fill={C.ink}>Пять точек. Меняется только запись.</text>
      </>}

      {beat === 1 && <>
        {[0, 1].map((digit, i) => <g key={digit} opacity={fade(i * 8, 18)}>
          <rect x={371 + i * 202} y="211" width="137" height="117" rx="24" fill={digit ? C.soft : "white"} stroke={C.blue} strokeWidth="3" />
          <text x={439 + i * 202} y="299" textAnchor="middle" fontFamily={MONO} fontSize="93" fill={C.blue}>{digit}</text>
        </g>)}
        {weights.map((weight, i) => <g key={weight} opacity={fade((2 - i) * 13, 18)}>
          <rect x={X[i] - 87} y="367" width="174" height="107" rx="24" fill="white" stroke={C.line} strokeWidth="3" />
          <text x={X[i]} y="447" textAnchor="middle" fontFamily={MONO} fontSize="79" fill={C.blue}>{weight}</text>
          <text x={X[i]} y="551" textAnchor="middle" fontFamily={MONO} fontSize="52" fill={C.blue}>{powers[i]}</text>
        </g>)}
        {[0, 1].map(i => <g key={i} opacity={fade(13 + i * 13, 18)}>
          <path d={`M${650 - i * 230} 409h-27l10 -10m-10 10l10 10`} stroke={C.blue} strokeWidth="4" fill="none" />
          <text x={655 - i * 230} y="385" textAnchor="middle" fontSize="33" fill={C.blue}>×2</text>
        </g>)}
        <text x="540" y="675" textAnchor="middle" fontSize="45" fill={C.ink}>Справа 1. Каждый шаг влево — вдвое.</text>
      </>}

      {beat === 2 && <>
        <text x="540" y="294" textAnchor="middle" fontFamily={MONO} fontSize="86" fill={C.blue}>5 = 4 + 1</text>
        <rect x="211" y="359" width="198" height="216" rx="29" fill="white" stroke={C.blue} strokeWidth="3" opacity={fade(0)} />
        <rect x="671" y="359" width="198" height="216" rx="29" fill="white" stroke={C.blue} strokeWidth="3" opacity={fade(8)} />
        <DotGroup x={310} y={460} count={4} opacity={fade(0)} />
        <DotGroup x={770} y={460} count={1} opacity={fade(8)} />
        <text x="540" y="489" textAnchor="middle" fontFamily={MONO} fontSize="86" fill={C.ink}>+</text>
        <text x="310" y="636" textAnchor="middle" fontFamily={MONO} fontSize="70" fill={C.blue}>4</text>
        <text x="770" y="636" textAnchor="middle" fontFamily={MONO} fontSize="70" fill={C.blue}>1</text>
      </>}

      {beat >= 3 && <>
        {weights.map((weight, i) => <g key={weight}>
          <text x={X[i]} y="270" textAnchor="middle" fontSize="40" fill={C.muted}>Вес</text>
          <rect x={X[i] - 89} y="294" width="178" height="113" rx="25" fill={focus === i ? C.soft : "white"} stroke={focus === i ? C.blue : C.line} strokeWidth="3" />
          <text x={X[i]} y="379" textAnchor="middle" fontFamily={MONO} fontSize="82" fill={C.blue}>{weight}</text>
          <path d={`M${X[i]} 410v65`} stroke={focus === i ? C.blue : C.line} strokeWidth="3" strokeDasharray="5 8" />
          <rect x={X[i] - 73} y="488" width="146" height="124" rx="25" fill={beat === 6 ? bits[i] ? C.pale : "white" : bits[i] === 1 ? C.soft : "white"} stroke={focus === i ? C.blue : C.line} strokeWidth="4" />
          <text x={X[i]} y="585" textAnchor="middle" fontFamily={MONO} fontSize="109" fill={beat === 6 && bits[i] ? C.green : bits[i] === 1 ? C.blue : C.muted} opacity={focus === i ? fade(19, 26) : 1}>{bits[i] === null ? "?" : bits[i]}</text>
        </g>)}
        {beat === 3 && <>
          <DotGroup x={310} y={442 + morph * 66} count={4} collapse={morph} opacity={1 - morph} />
          <DotGroup x={770} y={443} count={1} />
          <text x="540" y="710" textAnchor="middle" fontSize="49" fill={C.ink} opacity={fade(15)}>5 − 4 = 1. Остался один.</text>
        </>}
        {beat === 4 && <>
          <DotGroup x={770} y={443} count={1} />
          <text x="540" y="710" textAnchor="middle" fontSize="49" fill={C.ink} opacity={fade(15)}>Остался 1. Поэтому 2 не берём.</text>
        </>}
        {beat === 5 && <>
          <DotGroup x={770} y={442 + morph * 66} count={1} collapse={morph} opacity={1 - morph} />
          <text x="540" y="685" textAnchor="middle" fontFamily={MONO} fontSize="66" fill={C.green} opacity={fade(23, 22)}>101₂ — остаток 0</text>
        </>}
        {beat === 6 && <>
          <text x="540" y="709" textAnchor="middle" fontFamily={MONO} fontSize="61" fill={C.green}>{secondExample ? "110₂ = 4 + 2 = 6₁₀" : "101₂ = 4 + 0 + 1 = 5₁₀"}</text>
          <text x="540" y="216" textAnchor="middle" fontSize="37" fill={C.muted}>{secondExample ? "Выбрали веса 4 и 2" : "Те же пять точек, записанные иначе"}</text>
        </>}
      </>}
    </svg>
  </AbsoluteFill>;
}
