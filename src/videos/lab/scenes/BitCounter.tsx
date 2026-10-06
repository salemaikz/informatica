import { AbsoluteFill, interpolate, spring } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", screen: "#10263d", cyan: "#7fe3ff", green: "#21b26f", greenSoft: "#e3f7ec", gold: "#f0b400", line: "#d5dfe9" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const xs = [280, 540, 800];
const titles = ["Как записать пять?", "Один бит. Два состояния.", "Два бита — четыре выбора", "Теперь считаем числа", "Две единицы → одна двойка", "Две двойки → одна четвёрка", "Почему веса растут вдвое?", "Пример: собираем пять", "Пример: собираем шесть", "А какое число здесь?", "Получается семь!"];
const subtitles = ["Попробуем только цифрами 0 и 1", "Да или нет · включено или выключено", "Звук и тема могут меняться независимо", "Жетоны — модель количества", "В окне бита нельзя написать цифру 2", "Перенос может пройти через два места", "Каждый шаг влево — умножение на 2", "Каждая единица берёт вес своего места", "Ноль сохраняет место, но добавляет 0", "Пауза: сложи веса под единицами", "Три бита: 8 записей для чисел от 0 до 7"];

function Coin({ x, y, value = 1, scale = 1, opacity = 1 }: { x: number; y: number; value?: number; scale?: number; opacity?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <ellipse cy="7" rx="43" ry="43" fill="#cbdbe8" />
    <circle r="43" fill="white" stroke={C.blue} strokeWidth="4" />
    <circle r="33" fill={C.soft} />
    <text y="19" textAnchor="middle" fontSize="51" fontFamily={MONO} fill={C.blue}>{value}</text>
  </g>;
}

function Windows({ bits, previous = bits, progress = 1, weights = true, powers = false }: { bits: number[]; previous?: number[]; progress?: number; weights?: boolean; powers?: boolean }) {
  return <g>
    <rect x="160" y="274" width="760" height="218" rx="38" fill="#c5d5e3" />
    <rect x="160" y="260" width="760" height="218" rx="38" fill="white" stroke={C.line} strokeWidth="4" />
    {xs.map((x, i) => <g key={x}>
      <defs><clipPath id={`counter-window-${i}`}><rect x={x - 84} y="292" width="168" height="152" rx="18" /></clipPath></defs>
      <rect x={x - 88} y="288" width="176" height="160" rx="22" fill={C.screen} stroke="#bed0df" strokeWidth="4" />
      <g clipPath={`url(#counter-window-${i})`} fontFamily={MONO} fontSize="127" textAnchor="middle" fill={C.cyan}>
        {previous[i] !== bits[i] && progress < 1 && <text x={x} y={409 - progress * 150}>{previous[i]}</text>}
        <text x={x} y={previous[i] === bits[i] ? 409 : 559 - progress * 150}>{bits[i]}</text>
      </g>
      <path d={`M${x - 77} 369h154`} stroke={C.screen} strokeWidth="3" opacity=".6" />
      {weights && <text x={x} y="549" textAnchor="middle" fontFamily={MONO} fontSize="72" fill={C.blue}>{[4, 2, 1][i]}</text>}
      {powers && <text x={x} y="631" textAnchor="middle" fontFamily={MONO} fontSize="60" fill={C.ink}>{["2²", "2¹", "2⁰"][i]}</text>}
    </g>)}
  </g>;
}

function Formula({ text, y = 716, opacity = 1 }: { text: string; y?: number; opacity?: number }) {
  return <g opacity={opacity}><rect x="180" y={y - 70} width="720" height="93" rx="24" fill={C.greenSoft} /><text x="540" y={y} fontFamily={MONO} fontSize="65" textAnchor="middle" fill={C.green}>{text}</text></g>;
}

/** Жетоны показывают числовое количество; они не изображают электричество. */
export function BitCounter({ frame }: { frame: number }) {
  const beat = Math.min(10, Math.floor(Math.max(0, frame) / 180));
  const local = Math.min(179, (frame - beat * 180) * 1.25);
  const p = (start: number, end: number) => interpolate(local, [start, end], [0, 1], clamp);
  const entry = spring({ frame: local, fps: 30, config: { damping: 22, stiffness: 140 } });
  const code = beat === 7 ? [1, 0, 1] : beat === 8 ? [1, 1, 0] : [1, 1, 1];
  const mode = Math.min(3, Math.floor(local / 45));
  const sound = Math.floor(mode / 2);
  const theme = mode % 2;
  const rightCarry = p(55, 100);
  const leftCarry = p(110, 151);
  return <AbsoluteFill style={{ background: C.bg, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="780" viewBox="0 0 1080 780" style={{ position: "absolute" }}>
      <defs><pattern id="counter-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke={C.line} strokeWidth="1" /></pattern></defs>
      <rect width="1080" height="780" fill={C.bg} />
      <rect y="224" width="1080" height="556" fill="url(#counter-grid)" opacity={beat >= 3 && beat <= 6 ? .45 : .12} />
      <text x="60" y="58" fontSize="28" fill={C.blue} letterSpacing="2">МАСТЕРСКАЯ · СЧЁТЧИК</text>
      <text x="60" y="130" fontSize="56" fill={beat === 10 ? C.green : C.ink}>{titles[beat]}</text>
      <text x="60" y="195" fontSize="40" fill={C.muted}>{subtitles[beat]}</text>
      <g opacity={entry} transform={`translate(0 ${(1 - entry) * 20})`}>
        {beat === 0 && <g>
          <rect x="95" y="289" width="890" height="241" rx="38" fill="white" stroke={C.line} strokeWidth="3" />
          {[0, 1, 2, 3, 4].map(i => <Coin key={i} x={260 + i * 140} y={410} scale={spring({ frame: local - 12 - i * 10, fps: 30, config: { damping: 18 } })} />)}
          <text x="540" y="636" textAnchor="middle" fontFamily={MONO} fontSize="105" fill={C.ink}>5 = ?₂</text>
          <text x="540" y="720" textAnchor="middle" fontSize="44" fill={C.blue}>Бит поможет собрать запись</text>
        </g>}

        {beat === 1 && <g>
          <rect x="195" y="320" width="690" height="245" rx="122" fill="white" stroke={C.line} strokeWidth="6" />
          <text x="345" y="490" textAnchor="middle" fontFamily={MONO} fontSize="136" fill={C.muted}>0</text>
          <text x="735" y="490" textAnchor="middle" fontFamily={MONO} fontSize="136" fill={C.blue}>1</text>
          <circle cx={345 + p(65, 108) * 390} cy="442" r="103" fill={C.blue} />
          <text x={345 + p(65, 108) * 390} y="484" textAnchor="middle" fontFamily={MONO} fontSize="116" fill="white">{local < 88 ? 0 : 1}</text>
          <text x="345" y="643" textAnchor="middle" fontSize="49" fill={C.muted}>НЕТ</text>
          <text x="735" y="643" textAnchor="middle" fontSize="49" fill={C.blue}>ДА</text>
          <text x="540" y="733" textAnchor="middle" fontSize="44" fill={C.ink}>Бит хранит один из двух вариантов</text>
        </g>}

        {beat === 2 && <g>
          {[{ x: 330, label: "Звук", value: sound }, { x: 750, label: "Тёмная тема", value: theme }].map(({ x, label, value }) => <g key={x}>
            <text x={x} y="280" textAnchor="middle" fontSize="47" fill={C.ink}>{label}</text>
            <rect x={x - 116} y="320" width="232" height="123" rx="62" fill={value ? C.blue : "#d1dce6"} />
            <circle cx={x + (value ? 56 : -56)} cy="381" r="48" fill="white" />
            <text x={x} y="530" fontFamily={MONO} textAnchor="middle" fontSize="82" fill={C.blue}>{value}</text>
          </g>)}
          {["00", "01", "10", "11"].map((s, i) => <g key={s}>
            <rect x={100 + i * 237} y="581" width="169" height="119" rx="26" fill={i === mode ? C.soft : "white"} stroke={i === mode ? C.blue : C.line} strokeWidth="4" />
            <text x={184 + i * 237} y="663" fontFamily={MONO} textAnchor="middle" fontSize="75" fill={i === mode ? C.blue : C.muted}>{s}</text>
          </g>)}
          <text x="540" y="755" fontSize="44" textAnchor="middle" fill={C.ink}>2 × 2 = 4 комбинации</text>
        </g>}

        {beat === 3 && <g>
          <Windows bits={local < 78 ? [0, 0, 0] : [0, 0, 1]} previous={[0, 0, 0]} progress={p(78, 98)} />
          <Coin x={800} y={interpolate(p(36, 68), [0, 1], [652, 602])} opacity={p(30, 46)} />
          <text x="540" y="731" fontFamily={MONO} fontSize="66" textAnchor="middle" fill={C.blue}>{local < 78 ? "000₂ = 0" : "001₂ = 1"}</text>
        </g>}

        {beat === 4 && <g>
          <Windows bits={local < 108 ? [0, 0, 1] : [0, 1, 0]} previous={[0, 0, 1]} progress={p(108, 129)} />
          {local < 75 && <><Coin x={755 + rightCarry * 45} y={613} /><Coin x={845 - rightCarry * 45} y={613} opacity={p(12, 29)} /></>}
          {local >= 75 && <Coin x={interpolate(p(75, 108), [0, 1], [800, 540])} y={613 - Math.sin(p(75, 108) * Math.PI) * 49} value={2} />}
          {local >= 46 && local < 108 && <path d="M746 572Q677 541 595 572" fill="none" stroke={C.blue} strokeWidth="5" strokeDasharray="8 9" />}
          <text x="540" y="737" textAnchor="middle" fontFamily={MONO} fontSize="63" fill={local >= 129 ? C.green : C.blue}>{local < 129 ? "1 + 1 → перенос" : "10₂ = 2₁₀"}</text>
        </g>}

        {beat === 5 && <g>
          <Windows bits={local < 93 ? [0, 1, 1] : local < 151 ? [0, 1, 0] : [1, 0, 0]} previous={local < 151 ? [0, 1, 1] : [0, 1, 0]} progress={local < 151 ? p(93, 108) : p(151, 168)} />
          {local < 80 && <><Coin x={765 + rightCarry * 35} y={613} /><Coin x={835 - rightCarry * 35} y={613} opacity={p(10, 24)} /></>}
          {local < 130 && <Coin x={local < 110 ? 540 : 495 + leftCarry * 45} y={613} value={2} />}
          {local >= 80 && local < 130 && <Coin x={local < 110 ? interpolate(p(80, 110), [0, 1], [800, 630]) : 630 - leftCarry * 90} y={613} value={2} />}
          {local >= 130 && <Coin x={interpolate(p(130, 151), [0, 1], [540, 280])} y={613 - Math.sin(p(130, 151) * Math.PI) * 49} value={4} />}
          <text x="540" y="737" textAnchor="middle" fontFamily={MONO} fontSize="62" fill={local >= 168 ? C.green : C.blue}>{local < 93 ? "11₂ + 1" : local < 168 ? "2 + 2 → перенос" : "100₂ = 4₁₀"}</text>
        </g>}

        {beat === 6 && <g>
          <Windows bits={[1, 0, 0]} powers />
          {[410, 670].map((x, i) => <g key={x} opacity={p(30 + i * 35, 48 + i * 35)}><path d={`M${x + 43} 528h-86l17 -14m-17 14l17 14`} stroke={C.blue} strokeWidth="4" fill="none" /><text x={x} y="495" textAnchor="middle" fontFamily={MONO} fontSize="40" fill={C.blue}>×2</text></g>)}
          <text x="540" y="727" fontFamily={MONO} fontSize="57" textAnchor="middle" fill={C.blue}>2⁰ = 1 · 2¹ = 2 · 2² = 4</text>
        </g>}

        {beat >= 7 && beat <= 9 && <g>
          <Windows bits={code} />
          {beat <= 8 ? <>
            {xs.map((x, i) => code[i] === 1 ? <Coin key={x} x={x} y={613} value={[4, 2, 1][i]} scale={spring({ frame: local - 22 - i * 25, fps: 30, config: { damping: 18 } })} /> : <text key={x} x={x} y="636" textAnchor="middle" fontFamily={MONO} fontSize="65" fill={C.muted}>+0</text>)}
            <Formula text={beat === 7 ? "4 + 0 + 1 = 5" : "4 + 2 + 0 = 6"} y={751} opacity={p(120, 140)} />
          </> : <><text x="540" y="655" textAnchor="middle" fontFamily={MONO} fontSize="86" fill={C.blue}>111₂ = ?₁₀</text><text x="540" y="733" textAnchor="middle" fontSize="44" fill={C.muted}>Веса остаются 4 · 2 · 1</text></>}
        </g>}

        {beat === 10 && <g>
          <Formula text="4 + 2 + 1 = 7" y={312} />
          {Array.from({ length: 8 }, (_, i) => <g key={i} opacity={p(17 + i * 9, 34 + i * 9)}>
            <rect x={110 + i % 4 * 240} y={377 + Math.floor(i / 4) * 122} width="140" height="104" rx="22" fill={i === 7 ? C.greenSoft : "white"} stroke={i === 7 ? C.green : C.line} strokeWidth="3" />
            <text x={180 + i % 4 * 240} y={445 + Math.floor(i / 4) * 122} fontFamily={MONO} fontSize="46" textAnchor="middle" fill={i === 7 ? C.green : C.blue}>{i.toString(2).padStart(3, "0")}</text>
            <text x={280 + i % 4 * 240} y={445 + Math.floor(i / 4) * 122} fontFamily={MONO} fontSize="44" textAnchor="middle" fill={C.muted}>{i}</text>
          </g>)}
          <text x="540" y="705" textAnchor="middle" fontFamily={MONO} fontSize="73" fill={C.blue}>2³ = 8 комбинаций</text>
          <text x="540" y="760" textAnchor="middle" fontSize="43" fill={C.ink}>Счёт начинается с 0, заканчивается 7</text>
        </g>}
      </g>
    </svg>
    <div style={{ position: "absolute", left: 895, top: 13 }}><BrandBit frame={frame} size={130} mood={beat === 9 ? "thinking" : beat >= 7 ? "happy" : "neutral"} /></div>
  </AbsoluteFill>;
}
