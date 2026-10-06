import { AbsoluteFill, interpolate } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { ink: "#1b2333", blue: "#1a91d6", green: "#21b26f", light: "#f6f7fb", soft: "#e4f3fc", muted: "#8b96a7", wood: "#ead8bf", grain: "#d9ad65" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mono = '"JetBrains Mono Variable", monospace';
const xs = [245, 525, 805];
const weights = [4, 2, 1];
const bits = [1, 0, 1];
const titles = ["Взять или пропустить?", "Каждая мерка вдвое больше", "Наш рецепт — 101₂", "Справа 1: берём мерку", "В середине 0: пропускаем", "Слева 1: берём всю мерку", "Теперь без кухни"];
const descriptions = ["Мерка одна. Выборов — два.", "Считаем места справа налево", "Каждая цифра управляет своей меркой", "1 означает «взять»", "0 означает «не добавлять»", "1 — взять мерку. 4 г — её вес.", "Складываем веса под единицами"];
const lerp = (f: number, start: number, end: number, a = 0, b = 1) => interpolate(f, [start, end], [a, b], clamp);

function Cup({ weight, empty = false, ghost = false, color = C.blue }: { weight: number; empty?: boolean; ghost?: boolean; color?: string }) {
  const h = 112 + Math.log2(weight) * 28;
  return <g opacity={ghost ? 0.2 : 1}>
    <ellipse cy="12" rx="85" ry="13" fill={C.ink} opacity=".08" />
    <path d={`M70 ${-h + 24} H91 Q125 ${-h + 24} 119 ${-h + 62} Q114 ${-h + 88} 76 ${-h + 82}`} fill="none" stroke={color} strokeWidth="9" />
    <path d={`M-82 ${-h} L-65 -12 Q0 18 65 -12 L82 ${-h} Z`} fill={ghost ? "none" : "white"} stroke={color} strokeWidth="5" strokeDasharray={ghost ? "10 8" : undefined} />
    {!empty && <path d={`M-71 ${-h + 36} Q0 ${-h + 20} 71 ${-h + 36} L56 -18 Q0 3 -56 -18 Z`} fill="#f4e4c7" />}
    <ellipse cy={-h} rx="82" ry="14" fill={ghost ? "none" : "#f7fbff"} stroke={color} strokeWidth="5" strokeDasharray={ghost ? "10 8" : undefined} />
    {!empty && Array.from({ length: weight }, (_, i) => <ellipse key={i} cx={(i - (weight - 1) / 2) * 25} cy={-h + 54 + (i % 2) * 17} rx="9" ry="6" fill={C.grain} transform={`rotate(-25 ${(i - (weight - 1) / 2) * 25} ${-h + 54 + (i % 2) * 17})`} />)}
    <path d={`M-58 ${-h + 27} L-48 -39`} stroke="white" strokeWidth="9" strokeLinecap="round" opacity=".8" />
  </g>;
}

export function KitchenClear({ frame }: { frame: number }) {
  const phase = Math.min(6, Math.floor(Math.max(0, frame) / 180));
  const local = frame - phase * 180;
  const final = phase === 6 ? lerp(local, 12, 65) : 0;
  const pouringIndex = phase === 3 ? 2 : phase === 5 ? 0 : -1;
  const tilt = pouringIndex < 0 ? 0 : interpolate(local, [55, 70, 99, 118], [0, 65, 65, 0], clamp);
  const focus = pouringIndex < 0 ? 0 : interpolate(local, [0, 26, 125, 165], [0, 1, 1, 0], clamp);
  const zoom = 1 + focus * 0.04;
  const total = phase < 3 || (phase === 3 && local < 100) ? 0 : phase < 5 || (phase === 5 && local < 100) ? 1 : 5;
  const introPick = local >= 40 && local < 105;

  return <AbsoluteFill style={{ background: C.light, fontFamily: '"Nunito Variable", sans-serif' }}>
    <svg viewBox="0 0 1080 1080" width="100%" height="100%">
      <defs><clipPath id="clear-kitchen-bowl"><path d="M400 663 Q420 761 525 764 Q630 761 650 663 Z" /></clipPath></defs>
      <rect x="60" y="56" width="960" height="850" rx="40" fill="white" />
      <text x="85" y="132" fontSize="52" fontWeight="900" fill={C.ink}>{titles[phase]}</text>
      <text x="85" y="202" fontSize="40" fontWeight="750" fill={phase === 6 ? C.green : C.blue}>{descriptions[phase]}</text>
      <g opacity={1 - final}>
        <path d="M84 619 H997 V888 H84 Z" fill={C.wood} opacity=".7" />
        <path d="M84 634 H997" stroke="#d5b995" strokeWidth="7" />
      </g>

      {phase === 0 ? <g>
        <g transform={`translate(540 535) scale(1.5) rotate(${-interpolate(local, [40, 59, 87, 104], [0, 32, 32, 0], clamp)})`}><Cup weight={1} empty={introPick && local > 65} /></g>
        {introPick && local >= 65 && <ellipse cx={lerp(local, 65, 98, 503, 284)} cy={lerp(local, 65, 98, 350, 645)} rx="12" ry="9" fill={C.grain} opacity={local < 98 ? 1 : 0} />}
        <text x="540" y="591" fontSize="52" textAnchor="middle" fontWeight="850" fill={C.ink}>1 г</text>
        {[{ x: 90, bit: 1, label: "Взять", active: introPick }, { x: 600, bit: 0, label: "Пропустить", active: local >= 105 }].map(({ x, bit, label, active }) => <g key={bit}>
          <rect x={x} y="658" width="390" height="149" rx="26" fill={active ? C.soft : "white"} stroke={active ? C.blue : "#dce3ec"} strokeWidth="4" />
          <text x={x + 82} y="761" fontSize="92" fontWeight="850" fontFamily={mono} fill={C.blue}>{bit}</text>
          <text x={x + 159} y="752" fontSize="44" fontWeight="850" fill={C.ink}>{label}</text>
        </g>)}
      </g> : <g transform={`translate(${540 * (1 - zoom)} ${560 * (1 - zoom)}) scale(${zoom})`}>
        {weights.map((weight, i) => {
          const grow = phase === 1 ? lerp(local, (2 - i) * 45, (2 - i) * 45 + 22) : 1;
          const bitIn = phase === 2 ? lerp(local, 12 + i * 18, 35 + i * 18) : phase > 2 ? 1 : 0;
          const moving = pouringIndex === i;
          const empty = (i === 2 && (phase > 3 || (phase === 3 && local >= 88))) || (i === 0 && (phase > 5 || (phase === 5 && local >= 88)));
          const quiet = phase >= 4 && i === 1;
          const color = quiet ? C.muted : C.blue;
          const weightY = 608 - final * 114;
          return <g key={weight} opacity={grow}>
            <g opacity={bitIn}>
              <rect x={xs[i] - 58} y="281" width="116" height="108" rx="24" fill={i === 1 ? "#f0f3f7" : C.soft} opacity={1 - final} />
              <text x={xs[i]} y={362 + final * 24} textAnchor="middle" fontFamily={mono} fontSize="86" fontWeight="850" fill={color}>{bits[i]}</text>
            </g>
            <g opacity={1 - final}>
              <g transform={`translate(${xs[i]} 548) rotate(${moving ? tilt * (i === 0 ? 1 : -1) : 0})`}><Cup weight={weight} empty={empty} color={color} /></g>
            </g>
            <text x={xs[i]} y={weightY} fontFamily={mono} fontSize="65" fontWeight="800" textAnchor="middle" fill={quiet ? C.muted : C.ink}>
              {weight}<tspan fontSize="42" opacity={1 - final}> г</tspan>
            </text>
            {phase === 1 && i < 2 && <g opacity={lerp(local, (2 - i) * 45, (2 - i) * 45 + 22)}>
              <path d={`M${xs[i] + 206} 306 Q${xs[i] + 140} 252 ${xs[i] + 74} 306`} fill="none" stroke={C.blue} strokeWidth="4" />
              <path d={`M${xs[i] + 74} 306 L${xs[i] + 90} 283 M${xs[i] + 74} 306 L${xs[i] + 101} 308`} fill="none" stroke={C.blue} strokeWidth="4" strokeLinecap="round" />
              <text x={xs[i] + 140} y="264" textAnchor="middle" fontSize="42" fontWeight="900" fill={C.blue}>×2</text>
            </g>}
          </g>;
        })}
        <g opacity={1 - final}>
          <ellipse cx="525" cy="863" rx="180" ry="16" fill={C.ink} opacity=".07" />
          <rect x="357" y="768" width="336" height="91" rx="23" fill="white" stroke="#cbd7e6" strokeWidth="4" />
          <rect x="404" y="782" width="242" height="63" rx="13" fill={total === 5 ? "#e8f8ef" : C.soft} />
          <text x="525" y="832" textAnchor="middle" fontSize="60" fontFamily={mono} fontWeight="850" fill={total === 5 ? C.green : C.ink}>{total} г</text>
          <path d="M400 663 Q420 761 525 764 Q630 761 650 663 Z" fill={C.soft} stroke={C.blue} strokeWidth="5" />
          <g clipPath="url(#clear-kitchen-bowl)">
            {total > 0 && <path d={`M410 ${758 - total * 14} Q525 ${744 - total * 14} 640 ${758 - total * 14} V769 H410 Z`} fill="#f4e4c7" />}
          </g>
          <ellipse cx="525" cy="663" rx="125" ry="17" fill="white" fillOpacity=".65" stroke={C.blue} strokeWidth="5" />
          {pouringIndex >= 0 && local >= 71 && local < 100 && Array.from({ length: weights[pouringIndex] }, (_, i) => {
            const drop = lerp(local, 71 + i * 4, 88 + i * 3);
            const angle = tilt * (pouringIndex === 0 ? 1 : -1) * Math.PI / 180;
            const h = 112 + Math.log2(weights[pouringIndex]) * 28;
            const lip = pouringIndex === 0 ? 82 : -82;
            const startX = xs[pouringIndex] + lip * Math.cos(angle) + h * Math.sin(angle);
            const startY = 548 + lip * Math.sin(angle) - h * Math.cos(angle);
            return <ellipse key={i} cx={startX + (508 + i * 11 - startX) * drop} cy={startY + (713 - startY) * drop - Math.sin(drop * Math.PI) * 42} rx="8" ry="6" fill={C.grain} opacity={drop < 1 ? 1 : 0} />;
          })}
        </g>
      </g>}

      {phase === 4 && <g opacity={lerp(local, 0, 20)}>
        <rect x="710" y="726" width="276" height="95" rx="22" fill={C.soft} />
        <text x="848" y="766" textAnchor="middle" fontSize="40" fontWeight="850" fill={C.blue}>Пропускаем</text>
        <text x="848" y="808" textAnchor="middle" fontSize="42" fontWeight="850" fill={C.blue}>2 г</text>
      </g>}
      {phase === 5 && local > 100 && <text x="525" y="647" textAnchor="middle" fontSize="44" fontWeight="850" fill={C.green}>1 г + 4 г = 5 г</text>}
      {phase === 6 && <g opacity={final}>
        <path d="M150 535 H900" stroke="#e0e8f1" strokeWidth="4" />
        <text x="525" y="650" textAnchor="middle" fontSize="78" fontWeight="900" fontFamily={mono} fill={C.green}>4 + 1 = 5</text>
        <text x="525" y="767" textAnchor="middle" fontSize="64" fontWeight="850" fontFamily={mono} fill={C.ink}>101₂ = 5₁₀</text>
      </g>}
    </svg>
    {phase !== 0 && <div style={{ position: "absolute", left: 82, top: 727, width: 144, opacity: phase === 6 ? 1 : 0.92 }}>
      <BrandBit frame={frame} size={144} mood={phase === 4 ? "thinking" : phase === 6 ? "celebrate" : "happy"} />
    </div>}
  </AbsoluteFill>;
}
