import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", green: "#21b26f", pale: "#e3f7ec", gold: "#f0b400", shell: "#10263d" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const X = [350, 540, 730];
const titles = ["Бит, запиши число 5!", "Одна настройка — один бит", "Два бита: четыре сочетания", "А теперь будем считать", "После 1 начинается перенос", "После 3 — ещё один перенос", "Почему веса 1, 2, 4?", "Пример: собираем число 5", "Другой пример: число 6", "Твоя очередь: сколько это?", "Три единицы — число 7"];
const descriptions = ["Но доступны только 0 и 1…", "Нет = 0. Да = 1.", "Звук и тема меняются независимо", "Каждый новый шаг добавляет один", "Две единицы заменяем одной двойкой", "Две двойки заменяем одной четвёркой", "Каждый шаг влево умножает вес на 2", "Единица берёт вес, ноль оставляет место", "Меняем цифры. Веса остаются прежними", "Сложи веса включённых мест", "Восемь сочетаний: от 0 до 7"];

function Toggle({ x, y, on, value, label, progress = 1, dark = false }: { x: number; y: number; on: boolean; value: number; label: string; progress?: number; dark?: boolean }) {
  return <g opacity={progress}>
    <text x={x} y={y - 35} fontSize="40" fill={dark ? "#f6f7fb" : C.ink}>{label}</text>
    <rect x={x} y={y} width="170" height="84" rx="42" fill={on ? C.blue : "#c9d4e0"} />
    <circle cx={x + (on ? 128 : 42)} cy={y + 42} r="33" fill="white" />
    <text x={x + 219} y={y + 64} textAnchor="middle" fontSize="76" fontFamily={MONO} fill={dark ? on ? "#7fe3ff" : "#b7c7d8" : on ? C.blue : C.muted}>{value}</text>
  </g>;
}

function Phone({ x, y, width, height, children, dark = false }: { x: number; y: number; width: number; height: number; children: ReactNode; dark?: boolean }) {
  return <g>
    <rect x={x + 9} y={y + 14} width={width} height={height} rx="44" fill="#c9d4e0" opacity=".55" />
    <rect x={x} y={y} width={width} height={height} rx="44" fill={C.shell} />
    <rect x={x + 16} y={y + 16} width={width - 32} height={height - 32} rx="31" fill={dark ? "#182d43" : "white"} />
    <rect x={x + width / 2 - 47} y={y + 15} width="94" height="13" rx="6" fill={C.shell} />
    {children}
    <rect x={x + width / 2 - 54} y={y + height - 31} width="108" height="7" rx="4" fill="#cbd5e0" />
  </g>;
}

function Tile({ x, y, value, opacity = 1, scale = 1 }: { x: number; y: number; value: number; opacity?: number; scale?: number }) {
  return <g opacity={opacity} transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x="-43" y="-48" width="86" height="96" rx="22" fill={C.soft} stroke={C.blue} strokeWidth="3" />
    <text x="0" y="27" textAnchor="middle" fontFamily={MONO} fontSize="70" fill={C.blue}>{value}</text>
  </g>;
}

/** Two quantity tiles visibly merge; the carried quantity arrives in the next fixed column. */
function Carry({ from, to, value, local, start, end }: { from: number; to: number; value: number; local: number; start: number; end: number }) {
  const p = interpolate(local, [start, end], [0, 1], clamp);
  const merge = interpolate(p, [0, .42], [0, 1], clamp);
  const travel = interpolate(p, [.42, 1], [0, 1], clamp);
  if (local < start || local >= end) return null;
  return <g>
    {p < .42 ? <>
      <Tile x={from - 49 * (1 - merge)} y={465} value={value} />
      <Tile x={from + 49 * (1 - merge)} y={465} value={value} />
    </> : <Tile x={from + (to - from) * travel} y={465 - Math.sin(travel * Math.PI) * 47} value={value * 2} />}
    <text x="540" y="653" textAnchor="middle" fontSize="40" fill={C.blue}>{value} + {value} → {value * 2}</text>
  </g>;
}

export function BitPhone({ frame }: { frame: number }) {
  const beat = Math.min(10, Math.floor(Math.max(0, frame) / 180));
  const local = Math.min(179, Math.max(0, (frame - beat * 180) * 1.25));
  const fade = (at: number, span = 18) => interpolate(local, [at, at + span], [0, 1], clamp);
  const on = local >= 78;
  const darkTheme = Math.floor(local / 45) % 2 === 1;
  const phoneEnter = spring({ frame: local, fps: 30, config: { damping: 23, stiffness: 100 } });
  const mood = beat === 9 || beat === 0 ? "thinking" : beat >= 7 || beat === 2 ? "happy" : "neutral";
  let digits = [0, 0, 0];
  if (beat === 3 && local >= 83) digits = [0, 0, 1];
  if (beat === 4) digits = local < 81 ? [0, 0, 1] : local < 121 ? [0, 0, 0] : [0, 1, 0];
  if (beat === 5) digits = local < 59 ? [0, 1, 1] : local < 118 ? [0, 1, 0] : local < 155 ? [0, 0, 0] : [1, 0, 0];
  if (beat === 6) digits = [0, 0, 0];
  if (beat === 7) digits = [1, 0, 1];
  if (beat === 8) digits = [1, 1, 0];
  if (beat >= 9) digits = [1, 1, 1];
  const powers = ["2²", "2¹", "2⁰"];
  const weights = [4, 2, 1];
  const focus = beat === 6 ? 2 - Math.min(2, Math.floor(local / 52)) : beat === 7 || beat === 8 ? Math.min(2, Math.floor(local / 44)) : -1;

  return <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="780" viewBox="0 0 1080 780" style={{ position: "absolute" }}>
      <rect x="0" y="0" width="1080" height="780" fill={C.bg} />
      <circle cx="970" cy="600" r="216" fill={C.soft} opacity=".65" />
      <text x="60" y="62" fontSize="27" fill={C.blue}>БИТ И ЕГО ТЕЛЕФОН</text>
      <text x="60" y="125" fontSize="49" fontWeight="900" fill={beat === 10 ? C.green : C.ink}>{titles[beat]}</text>
      <text x="60" y="179" fontSize="36" fill={C.muted}>{descriptions[beat]}</text>

      {beat === 0 && <g transform={`translate(0 ${(1 - phoneEnter) * 28})`} opacity={phoneEnter}>
        <Phone x={350} y={218} width={400} height={495}>
          <text x="550" y="313" textAnchor="middle" fontSize="39" fill={C.muted}>Число на экране</text>
          <text x="550" y="465" textAnchor="middle" fontFamily={MONO} fontSize="148" fill={C.ink}>5</text>
          <rect x="409" y="526" width="282" height="100" rx="25" fill={C.soft} />
          <text x="550" y="595" textAnchor="middle" fontFamily={MONO} fontSize="61" fill={C.blue}>0 1 ?</text>
        </Phone>
        <g opacity={fade(64)}><rect x="767" y="315" width="205" height="111" rx="25" fill="white" stroke={C.blue} strokeWidth="3" /><text x="870" y="385" textAnchor="middle" fontSize="48" fill={C.blue}>Как?</text></g>
      </g>}

      {beat === 1 && <Phone x={322} y={224} width={468} height={489}>
        <text x="556" y="312" textAnchor="middle" fontSize="40" fill={C.ink}>Настройки</text>
        <Toggle x={410} y={415} on={on} value={on ? 1 : 0} label="Звук" />
        <text x="556" y="628" textAnchor="middle" fontSize="46" fill={on ? C.blue : C.muted}>{on ? "Включён → 1" : "Выключен → 0"}</text>
        {local >= 60 && local < 104 && <circle cx={on ? 538 : 452} cy="457" r={43 + (local % 22)} fill="none" stroke={C.gold} strokeWidth="5" opacity={.7} />}
      </Phone>}

      {beat === 2 && <>
        <Phone x={211} y={224} width={358} height={489} dark={darkTheme}>
          <text x="390" y="302" textAnchor="middle" fontSize="37" fill={darkTheme ? "#f6f7fb" : C.ink}>Настройки</text>
          <Toggle x={251} y={377} on={local >= 90} value={local >= 90 ? 1 : 0} label="Звук" dark={darkTheme} />
          <Toggle x={251} y={531} on={darkTheme} value={darkTheme ? 1 : 0} label="Тёмная тема" dark={darkTheme} />
        </Phone>
        {["00", "01", "10", "11"].map((pattern, i) => <g key={pattern} opacity={fade(i * 30)}>
          <rect x={621 + (i % 2) * 182} y={280 + Math.floor(i / 2) * 166} width="158" height="130" rx="26" fill={Math.min(3, Math.floor(local / 45)) === i ? C.soft : "white"} stroke={C.blue} strokeWidth="3" />
          <text x={700 + (i % 2) * 182} y={367 + Math.floor(i / 2) * 166} textAnchor="middle" fontFamily={MONO} fontSize="72" fill={C.blue}>{pattern}</text>
        </g>)}
        <text x="792" y="642" textAnchor="middle" fontSize="37" fill={C.ink}>Наборы настроек</text>
        <text x="792" y="686" textAnchor="middle" fontSize="37" fill={C.muted}>Пока не числа</text>
      </>}

      {beat >= 3 && <>
        <Phone x={210} y={225} width={720} height={495}>
          <text x="570" y="293" textAnchor="middle" fontSize="36" fill={C.muted}>Учебный числовой экран</text>
          {weights.map((weight, i) => <g key={weight}>
            <rect x={X[i] - 73} y="320" width="146" height={beat === 6 ? 116 : 67} rx="20" fill={focus === i ? C.soft : "#f2f5f9"} stroke={focus === i ? C.blue : "#e3e7ef"} strokeWidth="3" />
            <text x={X[i]} y="370" textAnchor="middle" fontFamily={MONO} fontSize="51" fill={C.blue} opacity={i === 2 || beat >= 6 || i === 1 && beat >= 4 || i === 0 && beat >= 5 ? 1 : .15}>{weight}</text>
            {beat === 6 && <text x={X[i]} y="422" textAnchor="middle" fontFamily={MONO} fontSize="41" fill={C.blue} opacity={fade((2 - i) * 52)}>{powers[i]}</text>}
            <rect x={X[i] - 64} y={beat === 6 ? 473 : 513} width="128" height="112" rx="24" fill={digits[i] && beat >= 7 ? C.soft : "white"} stroke={focus === i ? C.blue : "#cbd5e0"} strokeWidth="4" />
            <text x={X[i]} y={beat === 6 ? 556 : 598} textAnchor="middle" fontFamily={MONO} fontSize="88" fill={digits[i] ? C.blue : C.muted}>{digits[i]}</text>
          </g>)}
          {beat === 3 && <g opacity={fade(55)}><text x="730" y="463" textAnchor="middle" fontSize="61" fill={C.blue}>+1</text><text x="540" y="679" textAnchor="middle" fontFamily={MONO} fontSize="43" fill={C.ink}>{local >= 83 ? "001₂ = 1₁₀" : "000₂ = 0₁₀"}</text></g>}
          {beat === 4 && <>
            {local < 48 && <Tile x={730} y={455} value={1} />}
            {local < 48 && <text x="860" y="478" textAnchor="middle" fontFamily={MONO} fontSize="49" fill={C.blue}>+1</text>}
            <Carry from={730} to={540} value={1} local={local} start={48} end={121} />
            {local >= 121 && <text x="540" y="679" textAnchor="middle" fontFamily={MONO} fontSize="43" fill={C.green}>010₂ = 2₁₀</text>}
          </>}
          {beat === 5 && <>
            {local < 35 && <><Tile x={540} y={455} value={2} /><Tile x={730} y={455} value={1} /></>}
            {local < 35 && <text x="860" y="478" textAnchor="middle" fontFamily={MONO} fontSize="49" fill={C.blue}>+1</text>}
            {local >= 35 && local < 91 && <Tile x={540} y={455} value={2} />}
            <Carry from={730} to={540} value={1} local={local} start={35} end={91} />
            <Carry from={540} to={350} value={2} local={local} start={91} end={155} />
            {local >= 155 && <text x="540" y="679" textAnchor="middle" fontFamily={MONO} fontSize="43" fill={C.green}>100₂ = 4₁₀</text>}
          </>}
          {beat === 6 && <text x="570" y="664" textAnchor="middle" fontFamily={MONO} fontSize="44" fill={C.blue}>{["2⁰ = 1", "2¹ = 2", "2² = 4"][Math.min(2, Math.floor(local / 52))]}</text>}
          {(beat === 7 || beat === 8) && <>
            {digits.map((digit, i) => <text key={i} x={X[i]} y="467" textAnchor="middle" fontFamily={MONO} fontSize="55" fill={digit ? C.blue : C.muted} opacity={fade(i * 44)}>{digit ? `+${weights[i]}` : "+0"}</text>)}
            <text x="570" y="680" textAnchor="middle" fontFamily={MONO} fontSize="43" fill={C.green} opacity={fade(123)}>{beat === 7 ? "4 + 0 + 1 = 5" : "4 + 2 + 0 = 6"}</text>
          </>}
          {beat === 9 && <text x="570" y="682" textAnchor="middle" fontFamily={MONO} fontSize="50" fill={C.blue}>111₂ = ?</text>}
          {beat === 10 && <>
            <text x="570" y="469" textAnchor="middle" fontFamily={MONO} fontSize="47" fill={C.green}>4 + 2 + 1 = 7</text>
            <text x="570" y="683" textAnchor="middle" fontSize="39" fill={C.ink}>3 бита → 2³ = 8 сочетаний</text>
          </>}
        </Phone>
        {beat === 6 && [0, 1].map(i => <g key={i} opacity={fade(i ? 105 : 53)}><path d={`M${X[2 - i] - 82} 346h-26l10 -9m-10 9l10 9`} stroke={C.blue} strokeWidth="3" fill="none" /><text x={X[2 - i] - 95} y="319" textAnchor="middle" fontSize="29" fill={C.blue}>×2</text></g>)}
        {beat === 10 && <g opacity={fade(118)}>{[0, 1, 2].map(i => <path key={i} d="M0 -9l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3Z" transform={`translate(${949 + i * 19} ${344 + i * 36}) rotate(${local})`} fill={C.gold} />)}</g>}
      </>}
    </svg>
    <div style={{ position: "absolute", left: 37, top: 552, transform: `rotate(${beat === 0 ? -5 : 0}deg)` }}><BrandBit frame={frame} size={165} mood={beat === 10 ? "celebrate" : mood} /></div>
  </AbsoluteFill>;
}
