import { AbsoluteFill, interpolate, spring } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", green: "#21b26f", greenSoft: "#e3f7ec", gold: "#f0b400", border: "#e3e7ef" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const xs = [278, 540, 802];
const weights = [4, 2, 1];
const bits = [1, 0, 1];
const titles = ["Всего два состояния", "Но места имеют разный вес", "У каждой цифры — своё место", "Правая единица включает 1", "Ноль: место остаётся", "Левая единица включает 4", "Теперь это обычное число!"];
const descriptions = ["Сигнал включён или выключен", "Справа — 1. Каждый шаг влево — ×2", "Читаем код: один, ноль, один", "На дисплее появляется первая единица", "Но вес 2 не прибавляется", "К единице добавляем ещё четыре", "Складываем веса под единицами"];

function Dots({ x, y, count, color, frame }: { x: number; y: number; count: number; color: string; frame: number }) {
  return <g>{Array.from({ length: count }, (_, i) => {
    const dx = count === 1 ? 0 : (i % 2 ? 17 : -17);
    const dy = count < 3 ? 0 : (i < 2 ? -17 : 17);
    const p = spring({ frame: frame - i * 7, fps: 30, config: { damping: 20 } });
    return <circle key={i} cx={x + dx} cy={y + dy} r={10 * p} fill={color} opacity={p} />;
  })}</g>;
}

function Pulse({ x, progress, index = 0 }: { x: number; progress: number; index?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const px = interpolate(p, [0, .2, .8, 1], [x, x, 540, 540], clamp);
  const py = interpolate(p, [0, .2, .8, 1], [594, 621, 621, 654], clamp);
  return <circle cx={px + (index % 2 ? 7 : -7)} cy={py} r="10" fill={C.blue} stroke="white" strokeWidth="3" />;
}

/** Frame-only animation: the counter is an explicit teaching model, not a processor diagram. */
export function BitWorkshop({ frame: f }: { frame: number }) {
  const beat = Math.min(6, Math.floor(Math.max(0, f) / 180));
  const local = f - beat * 180;
  const show = (start: number, length = 18) => interpolate(local, [start, start + length], [0, 1], clamp);
  const reveal = (index: number) => beat > 1 ? 1 : show((2 - index) * 54, 20);
  const on = beat === 0 && local >= 88;
  const rightOn = beat > 3 || beat === 3 && local >= 26;
  const leftOn = beat > 5 || beat === 5 && local >= 26;
  const total = beat >= 6 || beat === 5 && local >= 140 ? 5 : beat >= 4 || beat === 3 && local >= 117 ? 1 : 0;
  const finish = beat === 6 ? show(0, 38) : 0;
  const bodyOpacity = 1 - finish;
  const counterDown = finish * 75;
  const mood = beat === 6 ? "celebrate" : beat === 4 ? "thinking" : total > 0 ? "happy" : "neutral";
  const helperText = ["0 и 1 обозначают состояние", "Вес зависит от места", "Не читаем как «сто один»", "Берём вес справа: 1", "Ноль не убирает позицию", "1 + 4 = 5", "1 включает свой вес"][beat];
  return <AbsoluteFill style={{ background: C.bg, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 800 }}>
    <svg width="1080" height="920" viewBox="0 0 1080 920" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="workshop-body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="white" /><stop offset="1" stopColor="#edf4fa" /></linearGradient>
        <pattern id="workshop-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke={C.border} strokeWidth="1" /></pattern>
      </defs>
      <rect width="1080" height="920" fill={C.bg} />
      <rect y="205" width="1080" height="715" fill="url(#workshop-grid)" opacity=".55" />
      <rect x="60" y="57" width="222" height="43" rx="16" fill={C.soft} />
      <text x="171" y="88" textAnchor="middle" fontSize="27" fill={C.blue}>МАСТЕРСКАЯ БИТА</text>
      <text x="60" y="161" fontSize="56" fontWeight="900" fill={beat === 6 ? C.green : C.ink}>{titles[beat]}</text>
      <text x="60" y="220" fontSize="41" fill={C.muted}>{descriptions[beat]}</text>

      <g opacity={bodyOpacity} transform={`translate(0 ${counterDown})`}>
        <ellipse cx="540" cy="798" rx="447" ry="25" fill="#b9cddd" opacity=".22" />
        <rect x="155" y="745" width="77" height="41" rx="12" fill="#a1b5c6" />
        <rect x="848" y="745" width="77" height="41" rx="12" fill="#a1b5c6" />
        <rect x="97" y="348" width="886" height="416" rx="47" fill="#cbd8e5" />
        <rect x="97" y="331" width="886" height="416" rx="47" fill="url(#workshop-body)" stroke="#bfcede" strokeWidth="4" />
        <path d="M137 692V393Q137 371 159 371H203" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none" />
        {beat <= 1 && <text x="151" y="388" fontSize="40" fill={C.muted}>Учебный счётчик</text>}
        {[156, 924].map(x => <g key={x}><circle cx={x} cy="717" r="10" fill="#bbc9d5" /><path d={`M${x - 4} 713l8 8`} stroke="#8ea1b3" strokeWidth="2" /></g>)}
      </g>

      {beat === 0 && <g>
        <text x="330" y="305" textAnchor="middle" fontSize="34" fill={C.muted}>Крупный план кнопки</text>
        <circle cx="330" cy="519" r="100" fill={on ? C.soft : "#edf0f5"} stroke={on ? C.blue : "#bcc6d4"} strokeWidth="7" />
        <circle cx="330" cy="519" r="78" fill={on ? C.blue : "#c4ced9"} />
        <path d="M330 470v46M306 483a42 42 0 1 0 48 0" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
        <path d="M438 519h155" stroke={on ? C.blue : "#cbd5e0"} strokeWidth="7" strokeLinecap="round" strokeDasharray={on ? undefined : "12 14"} />
        {on && <circle cx={438 + (local - 88) % 34 / 34 * 155} cy="519" r="9" fill={C.blue} />}
        <rect x="610" y="416" width="269" height="201" rx="25" fill={on ? C.soft : "#f0f2f7"} stroke={on ? C.blue : "#b9c6d4"} strokeWidth="4" />
        <text x="744" y="566" textAnchor="middle" fontFamily={MONO} fontSize="132" fontWeight="800" fill={on ? C.blue : C.muted}>{on ? 1 : 0}</text>
        <text x="540" y="688" textAnchor="middle" fontSize="44" fill={on ? C.blue : C.muted}>{on ? "Есть сигнал → 1" : "Нет сигнала → 0"}</text>
      </g>}

      {beat >= 1 && <>
        {beat === 1 && <g>
          {[{ x: 671, at: 54 }, { x: 409, at: 108 }].map(({ x, at }) => <g key={x} opacity={show(at)}>
            <path d={`M${x + 58} 286h-100l17 -13m-17 13l17 13`} fill="none" stroke={C.blue} strokeWidth="5" strokeLinecap="round" />
            <text x={x} y="270" textAnchor="middle" fontFamily={MONO} fontSize="36" fill={C.blue}>×2</text>
          </g>)}
        </g>}
        {weights.map((weight, i) => {
          const x = xs[i];
          const active = i === 2 ? rightOn : i === 0 ? leftOn : false;
          const focus = beat === 3 && i === 2 || beat === 4 && i === 1 || beat === 5 && i === 0;
          const neutral = i === 1 && beat >= 4;
          return <g key={weight} opacity={reveal(i)}>
            {beat >= 2 && <g opacity={beat === 2 ? show(i * 14) : 1}>
              <rect x={x - 51} y="242" width="102" height="81" rx="23" fill={bits[i] ? C.soft : "#edf0f5"} />
              <text x={x} y="304" textAnchor="middle" fontFamily={MONO} fontSize="66" fill={bits[i] ? C.blue : C.muted}>{bits[i]}</text>
              <path d={`M${x} 326v81`} stroke={bits[i] ? C.blue : "#bac4d0"} strokeWidth="3" strokeDasharray="6 8" opacity={(1 - finish) * .65} />
            </g>}
            <text x={x} y="452" textAnchor="middle" fontFamily={MONO} fontSize="66" fill={neutral ? C.muted : C.blue}>{weight}</text>
            <g opacity={1 - finish}>
              {focus && <circle cx={x} cy="533" r="79" fill="none" stroke={neutral ? "#aab8c7" : C.blue} strokeWidth="4" strokeDasharray={neutral ? "8 7" : undefined} />}
              <circle cx={x} cy="538" r="60" fill="#c8d6e3" />
              <circle cx={x} cy={active ? 538 : 531} r="60" fill={active ? C.blue : "white"} stroke={active ? "#1277b3" : "#bacada"} strokeWidth="4" />
              <Dots x={x} y={active ? 538 : 531} count={weight} color={active ? "white" : neutral ? "#a3afbd" : C.blue} frame={beat === 1 ? local - (2 - i) * 54 : 180} />
              <path d={`M${x} 594v27H540v33`} fill="none" stroke={active ? C.blue : "#d9e1eb"} strokeWidth={active ? 5 : 3} opacity={neutral ? .45 : 1} strokeLinejoin="round" />
              {beat === 4 && i === 1 && <g><rect x={x - 43} y="593" width="86" height="43" rx="11" fill="white" /><text x={x} y="625" textAnchor="middle" fontSize="40" fill={C.muted}>+0</text></g>}
            </g>
          </g>;
        })}
        {beat < 6 && <>
          <rect x="442" y="651" width="196" height="83" rx="19" fill={total === 5 ? C.greenSoft : "white"} stroke={total === 5 ? C.green : "#bfcddb"} strokeWidth="4" />
          <text x="540" y="715" textAnchor="middle" fontFamily={MONO} fontSize="71" fill={total === 5 ? C.green : C.ink}>{total}</text>
          {beat === 3 && local >= 50 && local < 117 && <Pulse x={802} progress={(local - 50) / 67} />}
          {beat === 5 && Array.from({ length: 4 }, (_, i) => {
            const t = local - 45 - i * 10;
            return t >= 0 && t < 62 && <Pulse key={i} x={278} progress={t / 62} index={i} />;
          })}
        </>}
      </>}

      {beat === 6 && <g opacity={finish}>
        <text x="540" y="572" textAnchor="middle" fontFamily={MONO} fontSize="76" fill={C.green}>4 + 1 = 5</text>
        <path d="M226 597h628" stroke={C.border} strokeWidth="4" strokeLinecap="round" />
        <text x="540" y="702" textAnchor="middle" fontFamily={MONO} fontSize="76" fill={C.green}>101₂ = 5₁₀</text>
        {[{ x: 843, y: 666 }, { x: 887, y: 703 }].map(({ x, y }, i) => <path key={x} d="M0 -10l3 7 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z" transform={`translate(${x} ${y}) rotate(${local * .7 + i * 20})`} fill={C.gold} />)}
      </g>}
      <text x="242" y="842" fontSize="39" fill={beat === 6 ? C.green : C.ink}>{helperText}</text>
      <text x="242" y="890" fontSize="29" fill={C.muted}>{beat === 6 ? "101₂ — другая запись того же числа 5" : "Бит показывает каждое действие"}</text>
    </svg>
    <div style={{ position: "absolute", left: 60, top: 756, width: 160 }}><BrandBit frame={f} size={160} mood={mood} /></div>
  </AbsoluteFill>;
}
