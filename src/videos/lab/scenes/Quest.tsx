import { AbsoluteFill, interpolate, spring } from "remotion";

const C = { blue: "#1a91d6", green: "#21b26f", red: "#ec4c4c", gold: "#f0b400", ink: "#153449" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const bitDigits = [1, 0, 1, 1, 0, 1];
const values = [32, 8, 4, 1];
const total = [32, 40, 44, 45];
const scatter = [{ x: 224, y: 396 }, { x: 416, y: 366 }, { x: 372, y: 573 }, { x: 548, y: 678 }];

function Hero({ frame, x, y, happy }: { frame: number; x: number; y: number; happy: boolean }) {
  const bob = happy ? Math.abs(Math.sin(frame / 8)) * -19 : Math.sin(frame / 18) * 3;
  const blink = frame % 120 > 113;
  const hand = happy ? Math.sin(frame / 7) * 14 : 0;
  return <g transform={`translate(${x} ${y + bob})`}>
    <ellipse cx="110" cy="226" rx="98" ry="15" fill="#13364b" opacity=".13" />
    <path d="M64 182 L51 216 M149 182 L166 216" fill="none" stroke="#116b9d" strokeWidth="22" strokeLinecap="round" />
    <path d="M28 113 L4 146" stroke={C.blue} strokeWidth="20" strokeLinecap="round" />
    <path d={happy ? "M180 110 L218 59" : "M180 110 L202 144"} stroke={C.blue} strokeWidth="20" strokeLinecap="round" transform={`rotate(${hand} 180 110)`} />
    <rect x="25" y="39" width="164" height="157" rx="46" fill={C.blue} stroke="#116b9d" strokeWidth="6" />
    <path d="M107 39 L107 20" stroke="#116b9d" strokeWidth="6" /><circle cx="107" cy="12" r="12" fill={C.gold} />
    <rect x="42" y="55" width="130" height="103" rx="34" fill="#eaf7ff" />
    {happy ? <path d="M61 96 Q72 78 84 96 M129 96 Q142 78 154 96" stroke={C.ink} strokeWidth="7" fill="none" strokeLinecap="round" /> : blink ? <path d="M61 91 H84 M129 91 H153" stroke={C.ink} strokeWidth="7" strokeLinecap="round" /> : <><ellipse cx="73" cy="92" rx="8" ry="13" fill={C.ink} /><ellipse cx="141" cy="92" rx="8" ry="13" fill={C.ink} /></>}
    <path d={happy ? "M85 117 Q107 148 133 117 Z" : "M99 128 Q110 119 121 128"} stroke={C.ink} strokeWidth="5" fill={happy ? C.ink : "none"} strokeLinecap="round" />
    <circle cx="57" cy="116" r="10" fill="#ffb697" opacity=".7" /><circle cx="158" cy="116" r="10" fill="#ffb697" opacity=".7" />
    <rect x="88" y="168" width="39" height="12" rx="6" fill="#73c5f0" />
  </g>;
}

export function Quest({ frame: f }: { frame: number }) {
  const beat = Math.min(4, Math.floor(f / 180));
  const local = f % 180;
  const fade = (start: number, duration = 20) => interpolate(f, [start, start + duration], [0, 1], clamp);
  const open = interpolate(f, [746, 806], [0, 1], clamp);
  const zoom = interpolate(f, [0, 130, 180, 360, 540, 720, 790, 899], [1.035, 1, 1, 1.025, 1.025, 1.025, 1, 1], clamp);
  const collected = beat >= 4 ? 4 : beat === 3 ? Math.min(4, Math.floor(local / 38)) : 0;
  const display = collected ? total[collected - 1] : "?";
  const heroX = interpolate(f, [0, 540, 575, 690, 720], [91, 91, 189, 282, 282], clamp);
  const heroY = 648;
  const weightStep = Math.min(5, Math.floor(Math.max(0, f - 198) / 25));
  const currentWeight = [1, 2, 4, 8, 16, 32][weightStep];
  return <AbsoluteFill style={{ background: "#e9f6fc", fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 900 }}>
    <svg width="1080" height="920" viewBox="0 0 1080 920" style={{ position: "absolute", overflow: "hidden" }}>
      <defs>
        <linearGradient id="quest-wall" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eaf8ff" /><stop offset="1" stopColor="#bedfeb" /></linearGradient>
        <linearGradient id="quest-door" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#367b9b" /><stop offset="1" stopColor="#185172" /></linearGradient>
        <linearGradient id="quest-glow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff5bd" /><stop offset="1" stopColor="#bdf1d5" /></linearGradient>
      </defs>
      <g transform={`translate(${540 * (1 - zoom)} ${430 * (1 - zoom)}) scale(${zoom})`}>
        <rect width="1080" height="920" fill="url(#quest-wall)" />
        {[0, 1, 2, 3, 4, 5].map(row => <g key={row} opacity=".35"><path d={`M0 ${row * 135 + 50} H1080`} stroke="#87b6cb" strokeWidth="3" />{[0, 1, 2, 3, 4].map(col => <path key={col} d={`M${col * 255 + (row % 2) * 126} ${row * 135 + 50} v135`} stroke="#87b6cb" strokeWidth="3" />)}</g>)}
        <path d="M0 811 H1080 V920 H0 Z" fill="#d0e8f2" /><path d="M0 813 H1080" stroke="#98bfcc" strokeWidth="5" />
        <path d="M690 813 L628 920 M884 813 L957 920 M0 876 H1080" stroke="#b2d2df" strokeWidth="3" />
        <ellipse cx="750" cy="830" rx="224" ry="22" fill="#32657a" opacity=".12" />

        {/* The door slides sideways in 2D; the bright room is revealed underneath. */}
        <rect x="510" y="130" width="470" height="696" rx="38" fill="#224c62" stroke="#143e55" strokeWidth="13" />
        <rect x="532" y="154" width="426" height="661" rx="24" fill="url(#quest-glow)" />
        <g opacity={open}>
          <path d="M665 763 L702 515 L757 451 L809 511 L862 763 Z" fill="#ffffff" opacity=".42" />
          <circle cx="746" cy="448" r="89" fill="white" opacity=".74" />
          <path d="M701 448 L736 483 L792 413" stroke={C.green} strokeWidth="19" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {[0,1,2,3,4].map(i => <g key={i} transform={`translate(${576 + i * 78} ${253 + (i % 2) * 48}) rotate(${f + i * 17})`}><path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3Z" fill={C.gold} /></g>)}
        </g>
        <g transform={`translate(${open * 401} 0)`} opacity={1 - open * .28}>
          <rect x="532" y="154" width="426" height="661" rx="24" fill="url(#quest-door)" stroke="#94d1e2" strokeWidth="6" />
          <rect x="562" y="184" width="366" height="244" rx="17" fill="none" stroke="#528eaa" strokeWidth="7" />
          <path d="M573 683 H917 M574 707 H918" stroke="#427f9d" strokeWidth="7" />
          <circle cx="897" cy="578" r="15" fill={C.gold} stroke="#ab7e15" strokeWidth="4" />
          <path d="M695 476 V438 Q695 377 745 377 Q795 377 795 438 V476" fill="none" stroke="#a9d6e8" strokeWidth="20" strokeLinecap="round" />
          <rect x="639" y="456" width="210" height="142" rx="25" fill="#eaf7fc" stroke="#a0cedf" strokeWidth="7" />
          <rect x="657" y="474" width="174" height="104" rx="14" fill={collected === 4 ? "#ddf8eb" : "#d2edf9"} />
          <text x="744" y="553" textAnchor="middle" fill={collected === 4 ? C.green : C.blue} fontSize="80">{display}</text>
          <path d="M746 632 l-10 17 h20 Z" fill="#c0e1ee" />
        </g>

        {/* The starting code belongs to an object in the room. */}
        <g transform={`rotate(-3 275 244)`} opacity={beat === 4 ? .5 : 1}>
          <path d="M145 128 L178 172 M382 128 L363 174" stroke="#567e90" strokeWidth="6" />
          <circle cx="145" cy="126" r="8" fill="#5a8396" /><circle cx="382" cy="126" r="8" fill="#5a8396" />
          <rect x="71" y="173" width="396" height="140" rx="22" fill="#fffdf7" stroke="#83b6cc" strokeWidth="7" />
          <text x="91" y="272" fontSize="76" fill={C.blue}>101101<tspan fontSize="37" dy="11">₂</tspan></text>
          {beat === 2 && bitDigits.map((bit, i) => <rect key={i} x={85 + i * 45} y="285" width="34" height="8" rx="4" fill={bit ? C.blue : "#a8b7bd"} opacity={bit ? fade(360 + i * 8) : .4} />)}
        </g>

        {beat === 0 && <g opacity={fade(25)} transform={`translate(242 ${489 + Math.sin(f / 20) * 5})`}>
          <path d="M-12 62 L-42 88 L-31 46" fill="white" /><rect x="-30" y="-12" width="122" height="94" rx="30" fill="white" />
          <text x="30" y="58" textAnchor="middle" fontSize="66" fill={C.blue}>?</text>
        </g>}
        {beat === 1 && <g opacity={fade(185)} transform={`translate(88 ${373 + (1 - spring({ frame: f - 183, fps: 30, config: { damping: 18 } })) * 32}) rotate(2 166 120)`}>
          <rect width="347" height="231" rx="18" fill="#fffdf2" stroke="#dac9a5" strokeWidth="5" />
          <path d="M25 15 H320 M25 215 H320" stroke="#e4d3ae" strokeWidth="3" />
          <text x="173" y="59" textAnchor="middle" fontSize="39" fill={C.ink}>Начинай справа!</text>
          <text x="173" y="155" textAnchor="middle" fontSize="83" fill={C.blue}>{currentWeight}</text>
          <text x="173" y="204" textAnchor="middle" fontSize="35" fill="#667d89">{weightStep === 0 ? "первый вес" : `${currentWeight / 2} × 2`}</text>
          {[0,1,2,3,4,5].map(i => <circle key={i} cx={111 + i * 25} cy="225" r="5" fill={i <= weightStep ? C.blue : "#d0d9db"} />)}
        </g>}
        {beat >= 2 && beat < 4 && <g opacity={fade(374)}>
          {[{v:16,x:128},{v:2,x:370}].map(({v,x}) => <g key={v} opacity=".42"><circle cx={x} cy="348" r="33" fill="#dce5e9" stroke="#a1b5bd" strokeWidth="4" /><text x={x} y="360" textAnchor="middle" fontSize="36" fill="#6d8794">{v}</text><path d={`M${x-22} 370 L${x+21} 329`} stroke={C.red} strokeWidth="4" /></g>)}
        </g>}

        {values.map((value, i) => {
          const arrival = spring({ frame: f - (372 + i * 23), fps: 30, config: { damping: 17 } });
          const toss = interpolate(f, [540 + i * 38, 578 + i * 38], [0, 1], clamp);
          const source = { x: 112 + [0,2,3,5][i] * 45, y: 257 };
          const sx = source.x + (scatter[i].x - source.x) * arrival;
          const sy = source.y + (scatter[i].y - source.y) * arrival - Math.sin(Math.min(1, arrival) * Math.PI) * 95;
          const x = sx + (744 - sx) * toss;
          const y = sy + (523 - sy) * toss - Math.sin(toss * Math.PI) * 125;
          const visible = f >= 372 + i * 23 && f < 578 + i * 38;
          return visible && <g key={value} transform={`translate(${x} ${y}) scale(${.85 + arrival * .15 - toss * .5})`}>
            <circle r="55" fill="#fff4c4" stroke={C.gold} strokeWidth="7" /><circle r="43" fill="none" stroke="#dfc56d" strokeWidth="2" />
            <text y="19" textAnchor="middle" fontSize="52" fill={C.blue}>{value}</text>
          </g>;
        })}
        {beat === 3 && collected > 0 && <g opacity={fade(580)}>
          <rect x="84" y="377" width="370" height="86" rx="20" fill="#ffffff" opacity=".95" />
          <text x="269" y="436" textAnchor="middle" fontSize="43" fill={C.blue}>{collected === 1 ? "32" : `${total[collected - 2]} + ${values[collected - 1]}`}<tspan fill={C.green}> = {display}</tspan></text>
        </g>}
        <Hero frame={f} x={heroX} y={heroY} happy={beat === 4} />
        {beat === 4 && <g opacity={fade(755)}>
          <rect x="63" y="374" width="385" height="202" rx="36" fill="white" stroke="#afe6ca" strokeWidth="5" />
          <text x="255" y="523" textAnchor="middle" fontSize="146" fill={C.green}>45</text>
          <text x="255" y="418" textAnchor="middle" fontSize="34" fill="#617d6e">Код принят!</text>
        </g>}
      </g>
    </svg>
    <div style={{ position: "absolute", top: 55, left: 62, right: 62, fontSize: 51, color: C.ink, lineHeight: 1.12 }}>{["Бит попал в квест-комнату", "Нашёл подсказку!", "Единицы дают жетоны", "Жетоны собираются в замке", "Вот зачем складывать веса!"][beat]}</div>
  </AbsoluteFill>;
}
