import { AbsoluteFill, interpolate, spring } from "remotion";

const C = { ink: "#3a3430", blue: "#1a91d6", green: "#21b26f", cream: "#fff7e9", wood: "#dcb789", edge: "#a77b53", glass: "#d9eef1", muted: "#847d74" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const weights = [32, 16, 8, 4, 2, 1];
const bits = [1, 0, 1, 1, 0, 1];
const pours = [390, -1, 552, 600, -1, 650];
const landings = [440, 585, 633, 683];
const headlines = ["Рецепт: ровно 45 граммов", "Мерки растут вдвое", "Начинаем с 32 граммов", "Добавляем 8, 4 и 1", "Рецепт готов!"];

function Helper({ frame }: { frame: number }) {
  const appear = spring({ frame, fps: 30, config: { damping: 18 } });
  return <g transform={`translate(500 ${430 + (1 - appear) * 25})`} opacity={appear}>
    <path d="M-70 95 Q-76 27 -37 20 H37 Q76 27 70 95" fill="#e4f3fc" stroke={C.blue} strokeWidth="5" />
    <path d="M-39 25 L-28 83 H28 L40 25" fill={C.blue} /><rect x="-24" y="52" width="48" height="27" rx="9" fill="#b8e4fa" />
    <ellipse cx="0" cy="-26" rx="49" ry="53" fill="#f2bf95" stroke="#ca926c" strokeWidth="4" />
    <path d="M-44 -41 Q-53 -107 9 -90 Q59 -92 45 -35 L29 -61 Q-2 -31 -44 -41" fill="#685046" />
    <circle cx="-17" cy="-25" r="5" fill={C.ink} /><circle cx="18" cy="-25" r="5" fill={C.ink} />
    <path d="M-13 -2 Q0 10 15 -2" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
    <path d="M-21 -92 Q-62 -113 -30 -130 Q-27 -168 8 -145 Q45 -162 45 -130 Q79 -104 35 -90" fill="white" stroke="#d9c8b6" strokeWidth="4" />
    <rect x="-26" y="-103" width="61" height="18" rx="5" fill="white" stroke="#d9c8b6" strokeWidth="4" />
  </g>;
}

function Measure({ index, frame }: { index: number; frame: number }) {
  const weight = weights[index];
  const chosen = bits[index] === 1;
  const start = pours[index];
  const local = frame - start;
  const pouring = start >= 0 && local >= 0 && local < 58;
  const empty = start >= 0 && local >= 30;
  const height = 64 + Math.log2(weight) * 12;
  const x = 134 + (index % 3) * 185;
  const y = index < 3 ? 559 : 810;
  const travel = pouring ? interpolate(local, [0, 13, 43, 58], [0, 1, 1, 0], clamp) : 0;
  const tilt = pouring ? interpolate(local, [13, 23, 39, 48], [0, 104, 104, 0], clamp) : 0;
  const px = x + (797 - x) * travel;
  const py = y + (425 - y) * travel;
  const highlighted = frame >= 180 && frame < 360 && Math.floor((frame - 180) / 30) === 5 - index;
  const unused = frame >= 360 && !chosen;
  const color = highlighted || pouring ? C.blue : unused ? "#aca99f" : C.edge;
  const bitAppear = interpolate(frame, [202 + (5 - index) * 15, 213 + (5 - index) * 15], [0, 1], clamp);
  return <g>
    {frame >= 180 && <g opacity={bitAppear}>
      <rect x={x - 34} y={y - 216} width="68" height="72" rx="18" fill={chosen ? "#e4f3fc" : "#eeebe5"} stroke={chosen ? C.blue : "#d7d1c5"} strokeWidth="3" />
      <text x={x} y={y - 160} textAnchor="middle" fontSize="62" fontWeight="900" fill={chosen ? C.blue : C.muted}>{bits[index]}</text>
    </g>}
    <g transform={`translate(${px} ${py}) rotate(${-tilt})`} opacity={unused ? .45 : 1}>
      <ellipse cx="0" cy="9" rx="66" ry="13" fill="#745234" opacity=".12" />
      <path d={`M53 ${-height + 15} H75 Q106 ${-height + 15} 105 ${-height + 41} Q105 ${-height + 68} 58 ${-height + 62}`} fill="none" stroke={color} strokeWidth="9" />
      <path d={`M-60 ${-height} L-48 -8 Q0 15 48 -8 L60 ${-height} Z`} fill={unused ? "#e9e5dd" : "#ecf8f7"} stroke={color} strokeWidth="5" />
      {!empty && <path d={`M-49 ${-height + 27} Q0 ${-height + 13} 49 ${-height + 27} L39 -17 Q0 3 -39 -17 Z`} fill="#eadbc0" />}
      <ellipse cx="0" cy={-height} rx="60" ry="11" fill="#f6fbf7" stroke={color} strokeWidth="5" />
      {!empty && <ellipse cx="0" cy={-height + 1} rx="48" ry="7" fill="#efe4cc" />}
      <path d={`M-42 ${-height + 23} L-37 -28`} stroke="white" strokeWidth="8" strokeLinecap="round" opacity=".7" />
      <text x="0" y="-28" textAnchor="middle" fontSize="57" fontWeight="900" fill={empty ? C.blue : C.ink}>{weight}<tspan fontSize="40"> г</tspan></text>
      {highlighted && <path d={`M-69 ${-height - 22} L-84 ${-height - 43} M0 ${-height - 29} V${-height - 51} M69 ${-height - 22} L84 ${-height - 43}`} stroke={C.blue} strokeWidth="5" strokeLinecap="round" />}
    </g>
  </g>;
}

export function Kitchen({ frame }: { frame: number }) {
  const phase = Math.min(4, Math.floor(Math.max(0, frame) / 180));
  const total = frame < landings[0] ? 0 : frame < landings[1] ? 32 : frame < landings[2] ? 40 : frame < landings[3] ? 44 : 45;
  const bowlFill = interpolate(total, [0, 45], [0, 113], clamp);
  const final = spring({ frame: frame - 724, fps: 30, config: { damping: 20 } });
  const subtitle = phase === 0 ? "Учебные мерки. Как отмерить?" : phase === 1 ? "1 → 2 → 4 → 8 → 16 → 32 г" : phase === 2 ? "16 г оставляем: над меркой ноль" : phase === 3 ? "2 г тоже оставляем: над меркой ноль" : "32 + 8 + 4 + 1 = 45";
  return <AbsoluteFill style={{ background: C.cream, fontFamily: '"Nunito Variable", sans-serif' }}>
    <svg viewBox="0 0 1080 1080" width="100%" height="100%" style={{ color: C.ink }}>
      <defs>
        <pattern id="kitchen-tile" width="84" height="84" patternUnits="userSpaceOnUse"><rect width="84" height="84" fill="#faf0de" /><path d="M84 0 H0 V84" fill="none" stroke="#e9dbc6" strokeWidth="2" /></pattern>
        <clipPath id="kitchen-bowl"><path d="M673 515 Q695 684 808 690 Q921 684 943 515 Z" /></clipPath>
      </defs>
      <rect width="1080" height="1080" fill={C.cream} />
      <rect y="210" width="1080" height="520" fill="url(#kitchen-tile)" />
      <rect x="63" y="226" width="288" height="155" rx="20" fill="#beccc0" />
      <rect x="77" y="239" width="260" height="127" rx="12" fill="#e8f5f3" />
      <path d="M82 337 Q128 277 176 333 Q211 285 264 327 Q306 289 335 317 V366 H82 Z" fill="#cddfc3" />
      <circle cx="117" cy="277" r="22" fill="#efd384" />
      <path d="M207 239 V366 M77 307 H337" stroke="#fffaf0" strokeWidth="10" />
      <path d="M383 241 H583" stroke="#ad9473" strokeWidth="8" strokeLinecap="round" />
      {[404, 455, 506, 557].map((x, i) => <g key={x} stroke="#93877a" fill="none" strokeWidth="7" strokeLinecap="round">
        <path d={`M${x} 240 V286`} />
        {i % 2 ? <><ellipse cx={x} cy="304" rx="13" ry="22" /><path d={`M${x} 324 V353`} /></> : <><path d={`M${x - 13} 295 V316 Q${x} 330 ${x + 13} 316 V295 M${x} 294 V351`} /></>}
      </g>)}
      <rect x="655" y="219" width="349" height="20" rx="7" fill={C.edge} />
      <rect x="675" y="179" width="63" height="40" rx="12" fill="#d3b995" /><path d="M739 187 Q762 184 758 205 Q753 217 738 207" fill="none" stroke="#d3b995" strokeWidth="8" />
      <rect x="769" y="167" width="57" height="52" rx="9" fill="#f0b400" opacity=".58" /><rect x="767" y="163" width="61" height="9" rx="4" fill="#c3a571" />
      <path d="M925 206 Q888 169 905 153 Q927 156 925 187 Q935 145 951 153 Q965 174 925 206" fill="#8fa988" />
      <path d="M901 189 H950 L941 219 H911 Z" fill="#bd9779" />
      <rect x="58" y="387" width="538" height="477" rx="28" fill="#f4dfbe" stroke="#d6b58b" strokeWidth="4" />
      <rect x="79" y="407" width="498" height="434" rx="20" fill="#fff8e9" stroke="#ead1ad" strokeWidth="3" />
      <text x="326" y="878" textAnchor="middle" fontSize="40" fontWeight="700" fill={C.muted}>Учебные мерки</text>
      <rect y="689" width="1080" height="391" fill={C.wood} />
      <path d="M0 704 H1080 M0 941 H1080" stroke="#c59c70" strokeWidth="9" />
      <path d="M21 771 H43 M1011 797 H1043 M882 971 H998 M51 995 H156" stroke="#c59c70" strokeWidth="5" strokeLinecap="round" />
      <rect x="58" y="387" width="538" height="477" rx="28" fill="#fff8e9" stroke="#d6b58b" strokeWidth="4" />
      <path d="M74 642 H580" stroke="#e8d1ad" strokeWidth="3" />
      <text x="326" y="878" textAnchor="middle" fontSize="40" fontWeight="700" fill={C.ink}>Учебные мерки</text>

      <text x="60" y="109" fontSize="60" fontWeight="900" fill={phase === 4 ? C.green : C.ink}>{headlines[phase]}</text>
      <text x="60" y="177" fontSize={phase === 4 || phase === 1 ? 57 : 43} fontWeight="800" fill={phase === 4 ? C.green : C.blue}>{subtitle}</text>
      <g transform="translate(674 266)">
        <rect x="7" y="9" width="329" height="122" rx="18" fill="#6f5133" opacity=".12" />
        <rect width="329" height="122" rx="18" fill="#fffdf6" stroke="#e0c5a0" strokeWidth="4" />
        <path d="M24 0 V15 M47 0 V15 M282 0 V15 M305 0 V15" stroke="#c5ab87" strokeWidth="6" />
        <text x="164" y="39" textAnchor="middle" fontSize="40" fontWeight="800" fill={C.muted}>РЕЦЕПТ</text>
        <text x="164" y="101" textAnchor="middle" fontSize="66" fontWeight="900" fill={C.ink}>45 г</text>
      </g>
      {phase === 0 && <Helper frame={frame - 15} />}
      {phase === 1 && <g>
        <rect x="658" y="418" width="350" height="84" rx="18" fill="#e4f3fc" stroke={C.blue} strokeWidth="3" />
        <text x="834" y="481" textAnchor="middle" fontSize="66" fontWeight="900" letterSpacing="5" fill={C.blue}>101101</text>
      </g>}
      <ellipse cx="808" cy="828" rx="187" ry="24" fill="#976e45" opacity=".2" />
      <rect x="640" y="692" width="336" height="129" rx="30" fill="#e9e7dc" stroke="#b4b4a8" strokeWidth="5" />
      <rect x="664" y="674" width="288" height="35" rx="16" fill="#cbd8d1" stroke="#a5b7b0" strokeWidth="4" />
      <rect x="676" y="717" width="222" height="82" rx="12" fill={phase === 4 ? "#e3f7ec" : "#e3edf0"} stroke={phase === 4 ? C.green : "#9baeb3"} strokeWidth="4" />
      <text x="787" y="780" textAnchor="middle" fontSize="68" fontWeight="900" fill={phase === 4 ? C.green : C.ink}>{total} г</text>
      <circle cx="935" cy="760" r="17" fill={C.blue} /><path d="M935 750 V760 M928 755 A10 10 0 1 0 942 755" fill="none" stroke="white" strokeWidth="3" />
      <path d="M673 515 Q695 684 808 690 Q921 684 943 515 Z" fill={C.glass} fillOpacity=".34" stroke="#8daeb6" strokeWidth="6" />
      <g clipPath="url(#kitchen-bowl)">
        <path d={`M682 ${690 - bowlFill} Q805 ${673 - bowlFill} 934 ${690 - bowlFill} V700 H682 Z`} fill="#eadbc0" />
        {total > 0 && Array.from({ length: 32 }, (_, i) => <circle key={i} cx={706 + (i * 41) % 214} cy={684 - (i * 19) % Math.max(7, bowlFill - 8)} r={3 + i % 3} fill={i % 2 ? "#cdb894" : "#fff0d5"} />)}
      </g>
      <ellipse cx="808" cy="514" rx="135" ry="23" fill="#f2fbfa" fillOpacity=".55" stroke="#8daeb6" strokeWidth="6" />
      <path d="M699 548 Q711 621 737 642" fill="none" stroke="white" strokeWidth="13" strokeLinecap="round" opacity=".75" />
      {weights.map((_, i) => <Measure key={i} index={i} frame={frame} />)}
      {pours.map((start, index) => start >= 0 && frame >= start + 15 && frame < start + 53 && <g key={start}>
        {Array.from({ length: 16 }, (_, i) => {
          const progress = ((frame - start - 15 + i * 2) % 27) / 27;
          return <circle key={i} cx={791 + Math.sin(i * 3) * 19 + progress * 15} cy={428 + progress * 191} r={4 + i % 3} fill={index % 2 ? "#d5bd93" : "#e8d6b4"} />;
        })}
      </g>)}
      {phase === 1 && <g>
        <rect x="62" y="188" width="948" height="53" rx="17" fill="#fffdf6" opacity=".95" />
        <text x="536" y="227" textAnchor="middle" fontSize="40" fontWeight="800" fill={C.ink}>1 — насыпаем; 0 — оставляем</text>
      </g>}
      {phase >= 2 && phase < 4 && <g>
        <rect x="650" y="849" width="350" height="62" rx="18" fill="#fff8e9" />
        <text x="825" y="894" textAnchor="middle" fontSize="40" fontWeight="800" fill={C.blue}>{phase === 2 ? "+32 г" : frame < 600 ? "+8 г" : frame < 650 ? "+4 г" : "+1 г"}</text>
      </g>}
      {phase === 4 && <g opacity={final}>
        <rect x="620" y="840" width="396" height="78" rx="20" fill="#e3f7ec" stroke={C.green} strokeWidth="3" />
        <text x="818" y="898" textAnchor="middle" fontSize="56" fontWeight="900" fill={C.green}>101101₂ = 45₁₀</text>
        <circle cx="947" cy="605" r="35" fill={C.green} /><path d="M928 605 L941 618 L964 591" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
    </svg>
  </AbsoluteFill>;
}
