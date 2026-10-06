import { AbsoluteFill, interpolate } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", screen: "#10263d", green: "#21b26f", greenSoft: "#e3f7ec", gold: "#f0b400", line: "#d5dfe9", dough: "#f0c185", crust: "#c88e51", chip: "#75513b" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const xs = [330, 540, 750];
const counts = [4, 2, 1];
const titles = ["Заказ с секретом", "Один бит — взять или оставить", "Соберём коробку побольше", "А если соединить две двойки?", "Выдаём заказ на пять", "Другой заказ — другие биты", "А теперь твоя очередь", "Все коробки — семь печенек"];
const visitorLines = [["Сто одна", "печенька?!"], ["А ноль — это", "пустая коробка?"], ["Мне две!", "Но коробки по одной…"], ["Две и ещё две.", "Их уже четыре!"], ["Ага! Единица", "может взять четыре!"], ["Тогда мне шесть.", "Какой будет билет?"], ["А что означает", "билет 111?"], ["Семь!", "Теперь понятно!"]];
const chefLines = [["Здесь записано", "пять. Смотри!"], ["0 — не берём.", "1 — берём целиком."], ["Объединим.", "1 и 1 станут 2."], ["Каждый шаг влево", "удваивает размер."], ["Берём 4 и 1.", "Два оставляем."], ["Берём 4 и 2.", "Один оставляем."], ["Все три коробки", "теперь выбраны."], ["Три бита —", "восемь наборов."]];

function Cookie({ x, y, scale = 1, opacity = 1 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <ellipse cy="5" rx="22" ry="20" fill={C.crust} opacity=".24" />
    <path d="M22 0Q26 8 20 14Q17 24 8 22Q0 27-8 22Q-20 22-22 12Q-28 3-22-5Q-21-18-10-20Q-2-27 8-21Q20-23 22-12Q28-5 22 0Z" fill={C.dough} stroke={C.crust} strokeWidth="2" />
    {[[-8, -8], [10, -5], [1, 12], [-13, 8], [2, -16]].map(([a, b], i) => <ellipse key={i} cx={a} cy={b} rx="3.5" ry="4" fill={C.chip} transform={`rotate(${i * 31} ${a} ${b})`} />)}
  </g>;
}

function CookieSlots(count: number, x: number, y: number) {
  return Array.from({ length: count }, (_, i) => ({ x: x + (count === 1 ? 0 : i % 2 ? 31 : -31), y: y + (count < 3 ? 0 : i < 2 ? -27 : 27) }));
}

function Box({ x, y = 498, count, selected = false, contents = true, opacity = 1 }: { x: number; y?: number; count: number; selected?: boolean; contents?: boolean; opacity?: number }) {
  return <g opacity={opacity}>
    <ellipse cx={x} cy={y + 102} rx="95" ry="12" fill={C.ink} opacity=".08" />
    <rect x={x - 87} y={y - 62} width="174" height="133" rx="20" fill={selected ? C.soft : "#fffaf1"} stroke={selected ? C.blue : "#ddc7a9"} strokeWidth="4" />
    <path d={`M${x - 80} ${y - 67}l14 -28h132l14 28`} fill="#fae8ca" stroke="#ddc7a9" strokeWidth="3" />
    {contents && CookieSlots(count, x, y - 9).map((pos, i) => <Cookie key={i} {...pos} />)}
    <rect x={x - 87} y={y + 35} width="174" height="49" rx="12" fill={selected ? C.blue : "#e8d3b3"} />
    <text x={x} y={y + 72} textAnchor="middle" fontFamily={MONO} fontSize="43" fill={selected ? "white" : C.chip}>{count}</text>
  </g>;
}

function Bubble({ x, lines, right = false, active = true }: { x: number; lines: string[]; right?: boolean; active?: boolean }) {
  return <g opacity={active ? 1 : .44}>
    <path d={`M${x + 27} 191h366q27 0 27 27v106q0 27-27 27H${x + (right ? 355 : 105)}l${right ? 28 : -28} 31v-31H${x + 27}q-27 0-27-27V218q0-27 27-27Z`} fill="white" stroke={right ? C.blue : C.line} strokeWidth="3" />
    {lines.map((line, i) => <text key={line} x={x + 210} y={248 + i * 57} textAnchor="middle" fontSize="39" fontWeight="900" fill={right ? C.blue : C.ink}>{line}</text>)}
  </g>;
}

function Visitor({ frame, pleased }: { frame: number; pleased: boolean }) {
  const tilt = Math.sin(frame / 31) * 2;
  return <g transform={`translate(120 439) rotate(${tilt} 0 55)`}>
    <path d="M-41 128l-9 121M40 128l9 121" stroke="#4e647c" strokeWidth="31" strokeLinecap="round" />
    <path d="M-59 250h43M17 250h43" stroke={C.screen} strokeWidth="20" strokeLinecap="round" />
    <path d="M-47 46q47-20 94 0l12 101H-60Z" fill="#b8dff4" stroke={C.blue} strokeWidth="3" />
    <path d="M-49 67l-27 58M48 64l44-27" stroke="#eac4aa" strokeWidth="19" strokeLinecap="round" />
    <circle cx="97" cy="34" r="13" fill="#eac4aa" />
    <rect x="-12" y="18" width="24" height="34" rx="9" fill="#eac4aa" />
    <ellipse cy="-18" rx="46" ry="52" fill="#f0ceb3" />
    <path d="M-45-23q-8-52 47-54q44 4 47 54l-26-19-30 6-17-11Z" fill="#4b5a69" />
    <path d="M-27-20l14-4M14-24l14 4" stroke="#4b5a69" strokeWidth="4" strokeLinecap="round" />
    <circle cx="-17" cy="-9" r="4" fill={C.screen} /><circle cx="19" cy="-9" r="4" fill={C.screen} />
    {pleased ? <path d="M-14 15q16 15 32-1" fill="none" stroke="#a35e50" strokeWidth="4" strokeLinecap="round" /> : <ellipse cx="3" cy="19" rx="10" ry="12" fill="#a35e50" />}
  </g>;
}

function Plate({ count = 0 }: { count?: number }) {
  return <g><ellipse cx="540" cy="636" rx="218" ry="52" fill="#d1e0ec" /><ellipse cx="540" cy="627" rx="218" ry="47" fill="white" stroke={C.line} strokeWidth="3" />{Array.from({ length: count }, (_, i) => <Cookie key={i} x={540 + (i - (count - 1) / 2) * 48} y={623} />)}</g>;
}

/** Учебная пекарня: размер коробки — вес разряда, бит — команда взять всю коробку. */
export function BitBakery({ frame }: { frame: number }) {
  const beat = Math.min(7, Math.floor(Math.max(0, frame) / 180));
  const local = Math.min(179, (frame - beat * 180) * 1.2);
  const p = (a: number, b: number) => interpolate(local, [a, b], [0, 1], clamp);
  const selected = beat === 4 ? [true, false, true] : beat === 5 ? [true, true, false] : [true, true, true];
  const codes = beat === 4 ? [1, 0, 1] : beat === 5 ? [1, 1, 0] : [1, 1, 1];
  const total = beat === 4 ? 5 : beat === 5 ? 6 : 7;
  const from = beat === 2 ? [{ x: 330, count: 1 }, { x: 750, count: 1 }] : [{ x: 540, count: 2 }, { x: 750, count: 2 }];
  const targetX = beat === 2 ? 540 : 330;
  const targetCount = beat === 2 ? 2 : 4;
  return <AbsoluteFill style={{ background: C.bg, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="780" viewBox="0 0 1080 780" style={{ position: "absolute" }}>
      <defs><pattern id="bakery-stripes" width="120" height="64" patternUnits="userSpaceOnUse"><rect width="60" height="64" fill={C.soft} /><rect x="60" width="60" height="64" fill="white" /></pattern></defs>
      <rect width="1080" height="780" fill={C.bg} />
      <rect width="1080" height="68" fill="url(#bakery-stripes)" /><path d="M0 68q30 23 60 0q30 23 60 0" fill="none" stroke="white" strokeWidth="3" />
      <rect x="340" y="13" width="400" height="49" rx="16" fill={C.blue} /><text x="540" y="49" textAnchor="middle" fontSize="31" letterSpacing="2" fill="white">ПЕКАРНЯ БИТА</text>
      <text x="540" y="136" textAnchor="middle" fontSize="53" fontWeight="950" fill={C.ink}>{titles[beat]}</text>
      <Bubble x={35} lines={visitorLines[beat]} active={local < 56 || beat >= 6} />
      <Bubble x={625} lines={chefLines[beat]} right active={local >= 28} />
      <Visitor frame={frame} pleased={beat >= 4} />
      <path d="M905 572h90v143h-90Z" fill="white" stroke={C.line} strokeWidth="3" />
      <path d="M923 617v75h54v-75" fill={C.soft} stroke={C.blue} strokeWidth="3" />
      <rect x="33" y="672" width="1014" height="42" rx="17" fill="#debc95" /><rect x="33" y="662" width="1014" height="20" rx="10" fill="#edd6b9" />

      {beat === 0 && <g transform={`rotate(${-5 + Math.sin(local / 20) * 2} 540 482)`}>
        <path d="M365 378h350v206H365v-68q35-14 0-29Z" fill="white" stroke={C.line} strokeWidth="4" />
        <path d="M406 407v148M675 407v148" stroke={C.line} strokeWidth="3" strokeDasharray="8 9" />
        <text x="540" y="469" textAnchor="middle" fontSize="40" fill={C.muted}>ВАШ ЗАКАЗ</text>
        <text x="540" y="552" textAnchor="middle" fontFamily={MONO} fontSize="98" fill={C.blue}>101</text>
      </g>}

      {beat === 1 && <g>
        <text x="390" y="416" textAnchor="middle" fontFamily={MONO} fontSize="74" fill={C.muted}>0</text><text x="690" y="416" textAnchor="middle" fontFamily={MONO} fontSize="74" fill={C.blue}>1</text>
        <Box x={390} count={2} /><Box x={690} count={2} selected />
        <g opacity={p(48, 72)}><path d="M680 604h37l-15-13m15 13l-15 13" stroke={C.blue} strokeWidth="5" fill="none" /><text x="390" y="717" textAnchor="middle" fontSize="40" fill={C.muted}>оставляем</text><text x="690" y="717" textAnchor="middle" fontSize="40" fill={C.blue}>берём целиком</text></g>
      </g>}

      {(beat === 2 || beat === 3) && <g>
        {from.map(({ x, count }) => <Box key={x} x={x} count={count} contents={false} opacity={1 - p(100, 121)} />)}
        <Box x={targetX} count={targetCount} contents={false} selected opacity={p(36, 65)} />
        {from.flatMap(({ x, count }, n) => CookieSlots(count, x, 489).map((pos, i) => {
          const move = p(47 + n * 20 + i * 10, 87 + n * 20 + i * 10);
          const destination = CookieSlots(targetCount, targetX, 489)[n * count + i];
          return <Cookie key={`${n}-${i}`} x={interpolate(move, [0, 1], [pos.x, destination.x])} y={interpolate(move, [0, 1], [pos.y, destination.y]) - Math.sin(move * Math.PI) * 75} />;
        }))}
        <text x="540" y="649" textAnchor="middle" fontFamily={MONO} fontSize="63" fill={local >= 120 ? C.green : C.blue}>{beat === 2 ? "1 + 1 = 2" : "2 + 2 = 4"}</text>
        {beat === 3 && <text x="540" y="717" textAnchor="middle" fontFamily={MONO} fontSize="49" fill={C.blue}>4 = 2² · 2 = 2¹ · 1 = 2⁰</text>}
      </g>}

      {beat >= 4 && <g>
        {xs.map((x, i) => <g key={x}>
          {beat < 7 && <><rect x={x - 80} y="351" width="160" height="52" rx="12" fill="white" stroke={C.line} strokeWidth="2" />
            <text x={x} y="397" textAnchor="middle" fontFamily={MONO} fontSize="60" fill={codes[i] ? C.blue : C.muted}>{codes[i]}</text>
            <path d={`M${x} 408v20`} stroke={codes[i] ? C.blue : C.line} strokeWidth="3" /></>}
          <Box x={x} count={counts[i]} selected={selected[i]} contents={false} />
        </g>)}
        <Plate />
        {counts.flatMap((count, col) => CookieSlots(count, xs[col], 489).map((pos, i) => {
          const takenBefore = counts.slice(0, col).reduce((sum, val, ix) => sum + (selected[ix] ? val : 0), 0);
          const move = selected[col] && beat !== 6 ? p(33 + col * 16 + i * 8, 74 + col * 16 + i * 8) : 0;
          return <Cookie key={`${col}-${i}`} x={interpolate(move, [0, 1], [pos.x, 540 + (takenBefore + i - (total - 1) / 2) * 48])} y={interpolate(move, [0, 1], [pos.y, 624]) - Math.sin(move * Math.PI) * 42} />;
        }))}
        {beat !== 6 && <text x="540" y="717" textAnchor="middle" fontFamily={MONO} fontSize={beat === 7 ? 40 : 55} fill={C.green} opacity={p(125, 141)}>{beat === 4 ? "101₂ → 4 + 1 = 5" : beat === 5 ? "110₂ → 4 + 2 = 6" : "4 + 2 + 1 = 7 · 2³ = 8 наборов (0–7)"}</text>}
        {beat === 6 && <text x="540" y="717" textAnchor="middle" fontFamily={MONO} fontSize="62" fill={C.blue}>111₂ = ? печенек</text>}
        {beat === 7 && Array.from({ length: 8 }, (_, i) => <g key={i} opacity={p(5 + i * 6, 17 + i * 6)}>
          <path d={`M${95 + i * 112} 355h96v49h-96v-12q13-8 0-16Z`} fill={i === 7 ? C.greenSoft : "white"} stroke={i === 7 ? C.green : C.line} strokeWidth="2" />
          <text x={143 + i * 112} y="395" textAnchor="middle" fontFamily={MONO} fontSize="40" fill={i === 7 ? C.green : C.blue}>{i.toString(2).padStart(3, "0")}</text>
        </g>)}
      </g>}
    </svg>
    <div style={{ position: "absolute", left: 870, top: 442 }}><BrandBit frame={frame} size={160} mood={beat === 6 ? "thinking" : beat >= 4 ? "happy" : "neutral"} /></div>
    <svg width="1080" height="780" viewBox="0 0 1080 780" style={{ position: "absolute", pointerEvents: "none" }}>
      <path d="M925 449v-22q-17-2-16-18q1-18 20-19q6-25 28-19q15 2 18 20q24-3 27 17q1 16-17 20v21Z" fill="white" stroke={C.line} strokeWidth="3" /><path d="M925 442h60" stroke={C.blue} strokeWidth="4" />
    </svg>
  </AbsoluteFill>;
}
