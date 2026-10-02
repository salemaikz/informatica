import type { ReactNode } from "react";

const INK = "#172127";
const CREAM = "#fff4d9";
const CYAN = "#80dded";
const GREEN = "#b5ed9a";
const ease = (f: number, start = 0, duration = 18) => {
  const t = Math.max(0, Math.min(1, (f - start) / duration));
  return 1 - (1 - t) ** 3;
};

function Words({ x, y, lines, size = 56, center = false, fill = INK }: {
  x: number; y: number; lines: string[]; size?: number; center?: boolean; fill?: string;
}) {
  return <text x={x} y={y} fill={fill} stroke="none" fontSize={size} fontWeight="900" textAnchor={center ? "middle" : "start"}>
    {lines.map((line, i) => <tspan key={i} x={x} dy={i ? size * 1.12 : 0}>{line}</tspan>)}
  </text>;
}

function Bubble({ x, y, w, h, lines, fill = "#fff", tail = "left", opacity = 1, size = 56 }: {
  x: number; y: number; w: number; h: number; lines: string[]; fill?: string;
  tail?: "left" | "right"; opacity?: number; size?: number;
}) {
  const tip = tail === "left" ? x + 70 : x + w - 70;
  return <g opacity={opacity}>
    <path d={`M${tip} ${y + h - 9} l${tail === "left" ? -20 : 20} 42 l65 -42`} fill={fill} stroke={INK} strokeWidth="8" strokeLinejoin="round" />
    <rect x={x} y={y} width={w} height={h} rx="30" fill={fill} stroke={INK} strokeWidth="8" />
    <Words x={x + w / 2} y={y + h / 2 - (lines.length - 1) * size * .56 + size * .34} lines={lines} size={size} center />
  </g>;
}

function Teen({ x, y, frame, friend = false, happy = false, flip = false, scale = 1, pointing = false }: {
  x: number; y: number; frame: number; friend?: boolean; happy?: boolean; flip?: boolean; scale?: number; pointing?: boolean;
}) {
  const wave = pointing ? Math.sin(frame / 16) * 7 : Math.sin(frame / 28) * 2;
  const blink = frame % 131 > 126;
  const shirt = friend ? GREEN : CYAN;
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g transform={flip ? "translate(250 0) scale(-1 1)" : undefined} stroke={INK} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M94 222 Q65 275 25 282 L36 311 L120 280 L139 238 M156 223 Q190 265 222 275 L211 310 L142 277" fill="#4c6370" />
      <path d="M24 285 L12 310 Q43 328 68 312 L56 292 M210 280 L193 306 Q220 326 246 311 L233 290" fill={CREAM} />
      <path d="M80 130 Q124 112 168 129 L187 228 Q127 257 65 226 Z" fill={shirt} />
      {friend && <path d="M76 173 L176 173 M72 193 L181 193" fill="none" stroke="#72bb76" />}
      <path d="M88 139 Q48 151 43 205 L82 217" fill="none" stroke={shirt} strokeWidth="31" />
      <path d="M87 139 Q48 151 43 205 L81 217" fill="none" />
      <g transform={`rotate(${wave} 167 144)`}>
        <path d={pointing ? "M168 145 L210 159 L248 122" : "M168 145 L211 168 L236 151"} fill="none" stroke={shirt} strokeWidth="30" />
        <path d={pointing ? "M168 145 L210 159 L248 122" : "M168 145 L211 168 L236 151"} fill="none" />
        <circle cx={pointing ? 246 : 235} cy={pointing ? 122 : 150} r="14" fill="#eebc98" />
      </g>
      <path d="M111 114 L110 132 Q127 144 142 130 L139 112" fill="#eebc98" />
      <ellipse cx="124" cy="72" rx="53" ry="57" fill="#f5c7a5" />
      <path d={friend ? "M72 57 Q47 18 89 21 Q94 -1 119 14 Q155 -4 165 26 Q190 30 174 68 L153 40 Q126 60 98 38 Z" : "M72 65 L69 24 Q119 -8 170 25 L177 57 Q135 20 112 49 L90 47 L84 72 Z"} fill={friend ? "#403127" : "#233744"} />
      {blink ? <path d="M97 77 L107 77 M142 77 L152 77" /> : <><circle cx="103" cy="75" r="4" fill={INK} strokeWidth="3" /><circle cx="147" cy="75" r="4" fill={INK} strokeWidth="3" /></>}
      <path d={happy ? "M108 94 Q125 114 143 94" : "M116 101 Q129 96 138 102"} fill={happy ? "#fff" : "none"} strokeWidth="5" />
      {!happy && !friend && <path d="M94 61 L107 57 M140 56 L153 61" strokeWidth="4" />}
    </g>
  </g>;
}

function Phone({ x, y, frame }: { x: number; y: number; frame: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${-5 + Math.sin(frame / 25) * 2} 130 170)`}>
    <rect width="260" height="350" rx="30" fill={INK} />
    <rect x="15" y="27" width="230" height="282" rx="15" fill={CYAN} />
    <path d="M101 13 H159" stroke={CREAM} strokeWidth="6" strokeLinecap="round" />
    <Words x={130} y={142} lines={["101101"]} size={58} center />
    <Words x={130} y={222} lines={["Это код?"]} size={44} center />
    <circle cx="130" cy="328" r="9" fill={CREAM} />
  </g>;
}

function Box({ x, y, weight, full = false, scale = 1, reveal = 0 }: {
  x: number; y: number; weight: number; full?: boolean; scale?: number; reveal?: number;
}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeWidth="6" strokeLinejoin="round">
    <path d="M0 27 L24 0 H145 L123 27 Z" fill="#dfb981" />
    <path d="M123 27 L145 0 V105 L123 135 Z" fill="#cf9a68" />
    <rect x="0" y="27" width="123" height="108" fill={CREAM} />
    {full && <g transform={`translate(0 ${-reveal * 46})`}>
      <rect x="17" y="38" width="90" height="76" rx="8" fill={GREEN} />
      <Words x={62} y={91} lines={[String(weight)]} size={48} center />
    </g>}
    {!full && <path d="M24 54 H100 M25 105 H100" stroke="#dbcab0" strokeWidth="5" />}
    <rect x="17" y="109" width="90" height="49" rx="8" fill={CYAN} />
    <Words x={62} y={148} lines={[String(weight)]} size={44} center />
  </g>;
}

function Card({ x, y, value, tilt = 0 }: { x: number; y: number; value: number; tilt?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${tilt} 72 80)`}>
    <rect x="7" y="10" width="145" height="155" rx="16" fill={INK} />
    <rect width="145" height="155" rx="16" fill={GREEN} stroke={INK} strokeWidth="8" />
    <Words x={72} y={108} lines={[String(value)]} size={90} center />
  </g>;
}

function Cut({ frame, children }: { frame: number; children: ReactNode }) {
  const arrive = ease(frame, 0, 9);
  return <g opacity={arrive} transform={`translate(${(1 - arrive) * 45} 0)`}>{children}</g>;
}

export function Dialogue({ frame }: { frame: number }) {
  const act = Math.min(4, Math.floor(Math.max(0, frame) / 180));
  const f = Math.max(0, frame) % 180;
  return <svg width="100%" height="100%" viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0, background: CREAM, fontFamily: '"Nunito Variable", sans-serif' }}>
    <defs><pattern id="dialogue-dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#d6bc8d" opacity=".35" /></pattern></defs>
    <rect width="1080" height="1080" fill="url(#dialogue-dots)" />
    <rect x="60" y="60" width="960" height="840" rx="22" fill={act === 2 ? "#fffaf0" : act === 3 ? CYAN : CREAM} stroke={INK} strokeWidth="10" />
    <Cut frame={f}>
      {act === 0 && <>
        <ellipse cx="538" cy="807" rx="405" ry="61" fill={GREEN} stroke={INK} strokeWidth="8" />
        <path d="M191 817 H885 M225 833 H850" stroke="#83ba75" strokeWidth="9" />
        <Teen x={110} y={472} frame={f} />
        <Teen x={718} y={474} frame={f} friend flip pointing happy={f > 75} />
        <path d="M345 623 L409 623" stroke={INK} strokeWidth="32" strokeLinecap="round" />
        <path d="M345 623 L409 623" stroke={CYAN} strokeWidth="20" strokeLinecap="round" />
        <Phone x={399} y={457} frame={f} />
        <Bubble x={84} y={88} w={675} h={178} lines={["Сто одна тысяча", "сто один?"]} opacity={ease(f, 5)} />
        <Bubble x={350} y={294} w={637} h={151} lines={["Другой алфавит", "чисел!"]} tail="right" fill={CYAN} opacity={ease(f, 80)} />
      </>}
      {act === 1 && <>
        <Words x={96} y={147} lines={["Шесть коробок,", "шесть разных весов"]} size={62} />
        <path d="M932 758 L155 349 M155 349 L173 421 M155 349 L233 341" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        {[32, 16, 8, 4, 2, 1].map((weight, i) => <g key={weight} opacity={ease(f, 10 + (5 - i) * 16)}>
          <Box x={83 + i * 145} y={305 + i * 55} weight={weight} />
        </g>)}
        <Teen x={93} y={605} frame={f} friend happy pointing scale={.74} />
        <Bubble x={340} y={752} w={647} h={112} lines={["Справа 1. Дальше ×2"]} fill={CYAN} tail="left" opacity={ease(f, 105)} />
      </>}
      {act === 2 && <>
        <Words x={540} y={148} lines={["1 — полная. 0 — пустая."]} size={59} center />
        <path d="M540 206 V690" stroke={INK} strokeWidth="10" />
        <circle cx="282" cy="279" r="62" fill={GREEN} stroke={INK} strokeWidth="8" />
        <circle cx="782" cy="279" r="62" fill={CREAM} stroke={INK} strokeWidth="8" />
        <Words x={282} y={311} lines={["1"]} size={90} center />
        <Words x={782} y={311} lines={["0"]} size={90} center />
        <Box x={170} y={375} weight={32} full scale={1.8} reveal={ease(f, 42)} />
        <Box x={670} y={375} weight={16} scale={1.8} />
        <Words x={282} y={713} lines={["Берём 32"]} center />
        <Words x={782} y={713} lines={["16 пропускаем"]} center />
        <Bubble x={145} y={734} w={790} h={140} lines={["0 — не ошибка.", "Просто не берём."]} fill={CYAN} opacity={ease(f, 88)} />
      </>}
      {act === 3 && <>
        <Bubble x={91} y={85} w={897} h={162} lines={["Берём карточки только", "из полных коробок"]} opacity={ease(f, 5)} />
        <Teen x={78} y={418} frame={f} happy pointing scale={.85} />
        <Teen x={786} y={418} frame={f} friend flip happy pointing scale={.85} />
        <path d="M205 774 V855 M880 774 V855" stroke={INK} strokeWidth="24" strokeLinecap="round" />
        <rect x="157" y="531" width="768" height="262" rx="45" fill={CREAM} stroke={INK} strokeWidth="10" />
        {[32, 8, 4, 1].map((value, i) => {
          const p = ease(f, 15 + i * 25, 25);
          return <g key={value} opacity={p}><Card x={(i % 2 ? 786 : 100) * (1 - p) + (187 + i * 184) * p} y={405 + p * 168} value={value} tilt={(1 - p) * (i % 2 ? 24 : -24)} /></g>;
        })}
        <Bubble x={92} y={293} w={895} h={132} lines={["32 + 8 + 4 + 1 = 45"]} fill={GREEN} size={63} opacity={ease(f, 125)} />
      </>}
      {act === 4 && <>
        <Teen x={100} y={412} frame={f} happy pointing scale={.8} />
        <Teen x={760} y={412} frame={f} friend flip happy pointing scale={.8} />
        <Bubble x={83} y={84} w={911} h={174} lines={["А, складываем только", "единицы!"]} />
        <Bubble x={359} y={290} w={635} h={119} lines={["Их веса. Верно!"]} tail="right" fill={GREEN} opacity={ease(f, 45)} />
        <g opacity={ease(f, 74)} transform={`translate(404 487) scale(${.9 + ease(f, 74) * .1})`}>
          <rect width="274" height="155" rx="28" fill={GREEN} stroke={INK} strokeWidth="8" />
          <path d="M26 82 L47 105 L86 54" fill="none" stroke="#228653" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <Words x={176} y={117} lines={["45"]} size={103} center />
        </g>
        <Words x={540} y={728} lines={["101101₂ = 45₁₀"]} size={61} center />
        <rect x="89" y="755" width="902" height="113" rx="22" fill={CYAN} stroke={INK} strokeWidth="8" />
        <Words x={540} y={827} lines={["Справа вес 1, дальше ×2"]} center />
      </>}
    </Cut>
  </svg>;
}
