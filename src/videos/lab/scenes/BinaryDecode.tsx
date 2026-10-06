import { AbsoluteFill, interpolate, spring } from "remotion";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", green: "#21b26f", greenSoft: "#e3f7ec", line: "#d5dfe9" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const xs = [300, 550, 800];
const weights = [4, 2, 1];
const titles = ["Как прочитать 101₂?", "Начнём с весов мест", "Левая единица берёт 4", "Ноль ничего не добавляет", "Правая единица берёт 1", "Складываем три вклада", "Другой пример: 110₂"];
const descriptions = ["В записи есть маленькая подсказка", "0/1 — цифры. 4/2/1 — веса мест.", "Умножаем цифру на вес её места", "Среднее место остаётся на месте", "Цифра та же, но вес другой", "1 × 4 + 0 × 2 + 1 × 1 = 5", "Снова: цифра × вес, затем сумма"];

function Dots({ x, value, frame, muted = false }: { x: number; value: number; frame: number; muted?: boolean }) {
  return <g>{Array.from({ length: value }, (_, i) => {
    const growth = spring({ frame: frame - i * 6, fps: 30, config: { damping: 22, stiffness: 150 } });
    return <circle key={i} cx={x + (i - (value - 1) / 2) * 31} cy="651" r={10 * growth} fill={muted ? C.line : C.blue} />;
  })}</g>;
}

/** Разбор числа: цифры, веса и вклады сохраняют одни и те же три колонки. */
export function BinaryDecode({ frame }: { frame: number }) {
  const beat = Math.min(6, Math.floor(Math.max(0, frame) / 180));
  const local = frame - beat * 180;
  const p = (from: number, to: number) => interpolate(local, [from, to], [0, 1], clamp);
  const digits = beat === 6 ? [1, 1, 0] : [1, 0, 1];
  const focus = beat === 2 ? 0 : beat === 3 ? 1 : beat === 4 ? 2 : -1;
  const final = beat === 5 || beat === 6 && local >= 60;
  const visible = (index: number) => beat >= 5 || beat >= 2 + index;
  return <AbsoluteFill style={{ background: C.bg, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="780" viewBox="0 0 1080 780" style={{ position: "absolute" }}>
      <rect width="1080" height="780" fill={C.bg} />
      <text x="80" y="79" fontSize="28" letterSpacing="2" fill={C.blue}>ЧИТАЕМ ДВОИЧНУЮ ЗАПИСЬ</text>
      <text x="80" y="146" fontSize="61" fontWeight="950" fill={C.ink}>{titles[beat]}</text>
      <text x="80" y="202" fontSize={beat === 5 ? 44 : 40} fontFamily={beat === 5 ? MONO : undefined} fill={C.muted}>{descriptions[beat]}</text>

      {beat >= 1 && <g>
        <text x="80" y="309" fontSize="35" fill={C.muted}>Цифра</text>
        <text x="80" y="468" fontSize="35" fill={C.muted}>Вес</text>
        {beat >= 2 && <text x="80" y="615" fontSize="35" fill={C.muted}>Вклад</text>}
      </g>}

      {xs.map((x, i) => {
        const selected = focus === i;
        const revealWeight = beat === 1 ? p((2 - i) * 11, (2 - i) * 11 + 15) : 1;
        const revealContribution = selected || beat === 6 ? p(8, 28) : 1;
        const product = digits[i] * weights[i];
        return <g key={x}>
          {beat >= 1 && <rect x={x - 105} y="225" width="210" height="453" rx="25" fill={selected ? C.soft : "white"} stroke={selected ? C.blue : C.line} strokeWidth={selected ? 4 : 2} />}
          <text x={x} y="346" textAnchor="middle" fontFamily={MONO} fontSize="144" fontWeight="900" fill={selected || beat === 0 ? C.blue : C.ink}>{digits[i]}</text>
          {beat >= 1 && <g opacity={revealWeight}>
            <path d={`M${x} 368v36l-9-10m9 10l9-10`} stroke={selected ? C.blue : C.line} strokeWidth="4" fill="none" strokeLinecap="round" />
            <text x={x} y="474" textAnchor="middle" fontFamily={MONO} fontSize="78" fill={C.blue}>{weights[i]}</text>
            <text x={x} y="524" textAnchor="middle" fontFamily={MONO} fontSize="40" fill={C.muted}>{["2²", "2¹", "2⁰"][i]}</text>
          </g>}
          {beat >= 2 && visible(i) && <g opacity={revealContribution}>
            <path d={`M${x} 541v27l-9-10m9 10l9-10`} stroke={selected ? C.blue : C.line} strokeWidth="4" fill="none" strokeLinecap="round" />
            <text x={x} y="617" textAnchor="middle" fontFamily={MONO} fontSize="37" fill={final ? C.green : product === 0 ? C.muted : C.blue}>{digits[i]}×{weights[i]}={product}</text>
            <Dots x={x} value={product} frame={selected || beat === 6 ? local - 9 : 120} />
            {product === 0 && <g opacity={selected ? p(14, 34) : 1}>
              <Dots x={x} value={weights[i]} frame={120} muted />
              <path d={`M${x - 40} 669l80-35`} stroke={C.muted} strokeWidth="4" strokeLinecap="round" />
            </g>}
          </g>}
        </g>;
      })}

      {beat === 0 && <g>
        <text x="916" y="367" textAnchor="middle" fontFamily={MONO} fontSize="80" fill={C.blue}>₂</text>
        <path d="M916 387v51h-48" fill="none" stroke={C.blue} strokeWidth="4" strokeLinecap="round" />
        <text x="550" y="491" textAnchor="middle" fontSize="41" fill={C.blue}>Маленькая 2 → двоичная система</text>
        <text x="550" y="598" textAnchor="middle" fontFamily={MONO} fontSize="69" fill={C.ink}>101₂ ≠ 101₁₀</text>
        <text x="550" y="710" textAnchor="middle" fontSize="45" fill={C.muted}>Это не «сто один»</text>
      </g>}

      {beat === 1 && <g>
        {[{ x: 425, at: 22 }, { x: 675, at: 11 }].map(({ x, at }) => <g key={x} opacity={p(at, at + 15)}>
          <path d={`M${x + 31} 457h-62l12-10m-12 10l12 10`} stroke={C.blue} strokeWidth="4" fill="none" />
          <text x={x} y="435" textAnchor="middle" fontFamily={MONO} fontSize="34" fill={C.blue}>×2</text>
        </g>)}
        <text x="550" y="714" textAnchor="middle" fontSize="42" fill={C.ink}>Справа 1. Каждый шаг влево — ×2.</text>
      </g>}

      {beat === 2 && <text x="550" y="714" textAnchor="middle" fontSize="43" fill={C.blue}>Одна левая единица добавляет четыре</text>}
      {beat === 3 && <text x="550" y="714" textAnchor="middle" fontSize="42" fill={C.muted}>Место 2 сохраняется, его вклад — 0</text>}
      {beat === 4 && <text x="550" y="714" textAnchor="middle" fontSize="43" fill={C.blue}>Правая единица добавляет только один</text>}
      {beat === 5 && <g opacity={p(12, 35)}>
        <rect x="237" y="674" width="626" height="65" rx="18" fill={C.greenSoft} />
        <text x="550" y="725" textAnchor="middle" fontFamily={MONO} fontSize="57" fill={C.green}>101₂ = 5₁₀</text>
      </g>}
      {beat === 6 && <text x="550" y="725" textAnchor="middle" fontFamily={MONO} fontSize="57" fill={local >= 60 ? C.green : C.blue}>{local < 60 ? "4 + 2 + 0 = ?" : "110₂ = 6₁₀"}</text>}
    </svg>
  </AbsoluteFill>;
}
