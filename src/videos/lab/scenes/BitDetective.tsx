import { AbsoluteFill, interpolate, spring } from "remotion";
import { BrandBit } from "../shared/BrandBit";

const C = { bg: "#f6f7fb", ink: "#1b2333", muted: "#6b7487", blue: "#1a91d6", soft: "#e4f3fc", green: "#21b26f", pale: "#e3f7ec", gold: "#f0b400", line: "#d9e2ed" };
const MONO = '"JetBrains Mono Variable", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const doorX = (index: number) => 50 + index * 123;
const titles = ["Кот спрятался. Бит ищет!", "Кот отвечает только «да» или «нет»", "Вопрос 1: справа среди восьми?", "Вопрос 2: справа среди четырёх?", "Вопрос 3: справа среди двух?", "Три ответа нашли дверь 5", "Новый раунд: найдём дверь 6", "Три бита различают восемь дверей"];

function Cat({ x, y, frame, opacity = 1 }: { x: number; y: number; frame: number; opacity?: number }) {
  return <g transform={`translate(${x} ${y + Math.sin(frame / 18) * 1.4})`} opacity={opacity}>
    <path d="M68 96Q103 110 92 71Q89 60 82 72" fill="none" stroke="#e0a036" strokeWidth="11" strokeLinecap="round" />
    <ellipse cx="47" cy="89" rx="28" ry="35" fill="#f5bb50" />
    <path d="M14 43L13 9L37 26M79 43L80 9L56 26" fill="#f5bb50" stroke="#d9972e" strokeWidth="3" strokeLinejoin="round" />
    <path d="M19 29L18 16L30 28M74 29L75 16L63 28" fill="#f8d09b" />
    <ellipse cx="47" cy="49" rx="35" ry="30" fill="#f5bb50" />
    <path d="M31 46q6 -6 12 0M52 46q6 -6 12 0" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
    <path d="M43 55h8l-4 5Z" fill="#a56b34" /><path d="M47 60v5m0 0q-7 5 -12 0m12 0q7 5 12 0" fill="none" stroke="#a56b34" strokeWidth="2.5" />
    <path d="M27 58L7 53m20 12L5 66m61 -8l20 -5m-20 12l22 1" stroke="#a56b34" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="32" cy="113" rx="13" ry="7" fill="#ffce77" /><ellipse cx="63" cy="113" rx="13" ry="7" fill="#ffce77" />
  </g>;
}

function Door({ index, active, queried, opened, cat, frame, code }: { index: number; active: boolean; queried: boolean; opened: number; cat: boolean; frame: number; code: boolean }) {
  const x = doorX(index);
  const edge = opened > .1 ? C.green : queried ? C.gold : active ? C.blue : C.line;
  return <g>
    <ellipse cx={x + 45} cy="618" rx="51" ry="8" fill={C.ink} opacity=".07" />
    <rect x={x - 6} y="383" width="102" height="223" rx="30" fill={active ? "white" : "#eef1f6"} stroke={edge} strokeWidth={queried ? 5 : 3} />
    <rect x={x + 2} y="397" width="86" height="200" rx="21" fill={opened ? "#163149" : "#dcebf4"} />
    {cat && opened > .12 && <Cat x={x - 1} y={478 - opened * 5} frame={frame} opacity={interpolate(opened, [.12, .55], [0, 1], clamp)} />}
    <g transform={`translate(${x + 2} 397) scale(${1 - opened * .92} 1)`} opacity={active ? 1 : .24}>
      <rect width="86" height="200" rx="21" fill={index % 2 ? "#dff2fc" : "#d3eafa"} stroke={active ? C.blue : "#becbda"} strokeWidth="3" />
      <rect x="13" y="21" width="60" height="97" rx="15" fill="white" opacity=".45" />
      <path d="M20 34h43" stroke="white" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <circle cx="69" cy="135" r="6" fill={C.gold} />
      <path d="M69 135v16" stroke="#c8951b" strokeWidth="4" strokeLinecap="round" />
    </g>
    <text x={x + 45} y="656" textAnchor="middle" fontFamily={MONO} fontSize="47" fill={active ? C.ink : C.muted}>{index}</text>
    {code && <text x={x + 45} y="711" textAnchor="middle" fontFamily={MONO} fontSize="35" fill={C.blue}>{index.toString(2).padStart(3, "0")}</text>}
  </g>;
}

function Bubble({ children, green = false }: { children: string; green?: boolean }) {
  return <g>
    <path d="M254 205l27 15 -27 15" fill="white" stroke={green ? C.green : C.blue} strokeWidth="3" strokeLinejoin="round" />
    <rect x="272" y="178" width="746" height="86" rx="28" fill="white" stroke={green ? C.green : C.blue} strokeWidth="3" />
    <text x="645" y="234" textAnchor="middle" fontSize="40" fill={green ? C.green : C.ink}>{children}</text>
  </g>;
}

/** A binary-search story: the cat stays hidden until the third answer. */
export function BitDetective({ frame }: { frame: number }) {
  const beat = Math.min(7, Math.floor(Math.max(0, frame) / 180));
  const local = Math.min(179, Math.max(0, frame - beat * 180));
  const fade = (start: number, length = 17) => interpolate(local, [start, start + length], [0, 1], clamp);
  const answered = local >= 55;
  const roundTwo = beat === 6;
  const roundStep = Math.min(2, Math.floor(local / 45));
  const roundAnswered = local >= (roundStep * 45 + 30);
  let answers: Array<number | null> = [null, null, null];
  if (beat === 2) answers = [answered ? 1 : null, null, null];
  if (beat === 3) answers = [1, answered ? 0 : null, null];
  if (beat === 4) answers = [1, 0, answered ? 1 : null];
  if (beat === 5) answers = [1, 0, 1];
  if (beat === 6) answers = [local >= 30 ? 1 : null, local >= 75 ? 1 : null, local >= 120 ? 0 : null];
  if (beat === 7) answers = [1, 1, 0];
  let remaining = [0, 1, 2, 3, 4, 5, 6, 7];
  let query = [] as number[];
  if (beat === 2) { query = [4, 5, 6, 7]; if (answered) remaining = query; }
  if (beat === 3) { remaining = answered ? [4, 5] : [4, 5, 6, 7]; query = [6, 7]; }
  if (beat === 4) { remaining = answered ? [5] : [4, 5]; query = [5]; }
  if (beat === 5) remaining = [5];
  if (roundTwo) {
    remaining = local < 30 ? remaining : local < 75 ? [4, 5, 6, 7] : local < 120 ? [6, 7] : [6];
    query = roundStep === 0 ? [4, 5, 6, 7] : roundStep === 1 ? [6, 7] : [7];
  }
  const open = beat === 4 ? fade(72, 38) : beat === 5 || beat === 7 ? 1 : beat === 6 ? fade(126, 19) : 0;
  const catDoor = beat >= 6 ? 6 : 5;
  const question = beat === 2 ? "Это двери 4–7?" : beat === 3 ? "Среди 4–7: это 6 или 7?" : "Среди 4–5: это дверь 5?";
  const response = beat === 3 ? "Нет → 0" : "Да → 1";
  const roundQuestion = ["Среди 0–7: дверь справа?", "Среди 4–7: дверь справа?", "Среди 6–7: дверь справа?"][roundStep];
  const currentResponse = roundStep === 2 ? "Нет → 0" : "Да → 1";
  const bitX = 70 + (beat === 0 ? Math.sin(local / 24) * 23 : beat >= 2 && beat <= 4 ? fade(0, 40) * 25 : 0);
  const floorBit = beat === 4 && local >= 55 || beat === 5;
  const approach = beat === 5 ? 1 : fade(64, 58);
  const actorX = floorBit ? 70 + approach * 685 : bitX;
  const actorY = floorBit ? 647 + (approach < 1 ? Math.abs(Math.sin(local / 4)) * 2 : 0) : 183;
  const actorSize = floorBit ? 75 : 155;
  const actorOpacity = beat === 4 ? local < 55 ? 1 : fade(55, 9) : 1;
  const actorScale = actorSize / 155;
  const bitMood = beat === 4 && open > .5 || beat === 5 || beat === 7 || beat === 6 && local >= 135 ? "celebrate" : answered && beat >= 2 && beat <= 3 ? "happy" : "thinking";

  return <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: '"Nunito Variable", Nunito, sans-serif', fontWeight: 850 }}>
    <svg width="1080" height="750" viewBox="0 0 1080 750" style={{ position: "absolute" }}>
      <defs><pattern id="detective-wall" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="#eaf0f7" strokeWidth="1" /></pattern></defs>
      <rect width="1080" height="750" fill={C.bg} />
      <rect y="353" width="1080" height="285" fill="url(#detective-wall)" />
      <path d="M0 617H1080V750H0Z" fill="#edf3fa" />
      <path d="M0 618H1080" stroke={C.line} strokeWidth="3" />
      <path d="M197 368q343 -71 687 0" stroke="#dce8f4" strokeWidth="3" fill="none" />
      <text x="60" y="58" fontSize="26" fill={C.blue}>ДЕТЕКТИВ БИТ</text>
      <text x="60" y="124" fontSize="47" fontWeight="900" fill={beat >= 5 ? C.green : C.ink}>{titles[beat]}</text>

      {beat === 0 && <>
        <Bubble>Восемь дверей. Где же кот?</Bubble>
        <g opacity={fade(65)}><path d="M291 330l5 -14 5 14m-13 0h16" fill="none" stroke={C.gold} strokeWidth="4" /><text x="539" y="326" textAnchor="middle" fontSize="42" fill={C.muted}>Начнём с одного вопроса!</text></g>
      </>}
      {beat === 1 && <>
        <Bubble>Один ответ — один бит</Bubble>
        {[{ x: 343, text: "Нет", value: 0 }, { x: 647, text: "Да", value: 1 }].map((item, i) => <g key={item.value} opacity={fade(i * 40)}>
          <rect x={item.x} y="282" width="251" height="75" rx="23" fill={i ? C.soft : "white"} stroke={i ? C.blue : C.line} strokeWidth="3" />
          <text x={item.x + 125} y="334" textAnchor="middle" fontSize="44" fill={i ? C.blue : C.muted}>{item.text} → {item.value}</text>
        </g>)}
      </>}
      {beat >= 2 && beat <= 4 && <Bubble>{answered ? `${question}  ${response}` : question}</Bubble>}
      {beat === 5 && <Bubble green>101₂: 4 + 0 + 1 = 5</Bubble>}
      {beat === 6 && <Bubble green={local >= 135}>{local >= 135 ? "110₂: 4 + 2 + 0 = 6" : roundAnswered ? `${roundQuestion} ${currentResponse}` : roundQuestion}</Bubble>}
      {beat === 7 && <Bubble green>3 бита → 2³ = 8 разных кодов</Bubble>}

      {beat >= 2 && beat < 7 && answers.map((answer, i) => <g key={i}>
        <text x={421 + i * 171} y="287" textAnchor="middle" fontSize="34" fill={C.muted}>{["Вес 4", "Вес 2", "Вес 1"][i]}</text>
        <rect x={367 + i * 171} y="295" width="108" height="62" rx="18" fill={answer === 1 ? C.soft : "white"} stroke={answer === null ? C.line : C.blue} strokeWidth="3" />
        <text x={421 + i * 171} y="343" textAnchor="middle" fontFamily={MONO} fontSize={51 * (answer === null || beat === 5 ? 1 : spring({ frame: beat === 6 ? local - i * 45 - 30 : i === beat - 2 ? local - 55 : 180, fps: 30, config: { damping: 22 } }))} fill={answer === 1 ? C.blue : C.muted}>{answer === null ? "?" : answer}</text>
      </g>)}

      {Array.from({ length: 8 }, (_, index) => <Door key={index} index={index} active={remaining.includes(index)} queried={query.includes(index) && !(roundTwo ? roundAnswered : answered)} opened={index === catDoor ? open : 0} cat={index === catDoor} frame={frame} code={beat === 7} />)}

      {beat >= 2 && beat <= 4 && <text x="540" y="718" textAnchor="middle" fontSize="43" opacity={beat === 4 && local >= 55 ? fade(125) : 1} fill={answered ? C.blue : C.muted}>{answered ? ["8 → 4 варианта", "4 → 2 варианта", "2 → 1 вариант"][beat - 2] : ["8 вариантов", "4 варианта", "2 варианта"][beat - 2]}</text>}
      {beat === 0 && <text x="540" y="718" textAnchor="middle" fontSize="40" fill={C.muted}>Двери пронумерованы от 0 до 7</text>}
      {beat === 1 && <text x="540" y="718" textAnchor="middle" fontSize="40" fill={C.muted}>Каждый вопрос делит варианты пополам</text>}
      {beat === 5 && <text x="365" y="718" textAnchor="middle" fontSize="31" fill={C.green}>«Да» добавляет вес. «Нет» добавляет 0.</text>}
      {beat === 6 && <text x="540" y="718" textAnchor="middle" fontSize="40" fill={local >= 135 ? C.green : C.blue}>{local >= 135 ? "Ответы 1, 1, 0 нашли дверь 6" : `${remaining.length} ${remaining.length === 1 ? "вариант" : "варианта"} осталось`}</text>}
      {beat === 4 && open > .6 && <g opacity={fade(105)}><path d="M813 419q35 -19 65 4" fill="none" stroke={C.gold} strokeWidth="4" /><text x="880" y="401" textAnchor="middle" fontSize="37" fill={C.green}>Нашли!</text></g>}
      <g opacity={actorOpacity} transform={`translate(${actorX + 127 * actorScale} ${actorY + 80 * actorScale}) scale(${actorScale}) rotate(${beat === 0 ? Math.sin(local / 14) * 9 : -19})`}><circle cx="0" cy="0" r="27" fill={C.soft} fillOpacity=".65" stroke={C.blue} strokeWidth="7" /><path d="M18 20l28 30" stroke={C.blue} strokeWidth="10" strokeLinecap="round" /></g>
    </svg>
    <div style={{ position: "absolute", left: actorX, top: actorY, opacity: actorOpacity }}><BrandBit frame={frame} size={actorSize} mood={bitMood} /></div>
  </AbsoluteFill>;
}
