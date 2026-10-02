import { AbsoluteFill, interpolate } from "remotion";
const bits = [1, 0, 1, 1, 0, 1];
const weights = [32, 16, 8, 4, 2, 1];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const blue = "#61c7ff", green = "#21b26f";

export function Arcade({ frame: f }: { frame: number }) {
  const stage = Math.min(4, Math.floor(f / 180));
  const progress = interpolate(f, [0, 540, 600, 660, 719, 780], [0, 0, .4, .6, 1, 1], clamp);
  const jump = f >= 540 && f < 720 ? Math.sin((f - 540) % 60 / 60 * Math.PI) * 130 : 0;
  const score = f < 360 ? 0 : f < 600 ? 32 : f < 660 ? 40 : f < 715 ? 44 : 45;
  const pickedCount = f < 360 ? 0 : f < 600 ? 1 : f < 660 ? 2 : f < 715 ? 3 : 4;
  const titles = ["Шесть платформ. Собери код!", "У каждой платформы свои очки", "1: берём. 0: перепрыгиваем", "Счёт растёт с каждым прыжком", "УРОВЕНЬ ПРОЙДЕН"];
  return <AbsoluteFill style={{ background: "#081526", color: "#eef7ff", fontFamily: '"JetBrains Mono Variable", monospace', overflow: "hidden" }}>
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 35 }, (_, i) => <rect key={i} x={(i * 193 + 37) % 1050} y={170 + (i * 47) % 455} width={i % 3 ? 3 : 6} height={i % 3 ? 3 : 6} fill="#8ac7ea" opacity={.2 + .3 * (Math.sin(f / 25 + i) + 1) / 2} />)}
      <path d="M0 790 V430 H70 V540 H160 V340 H230 V510 H305 V390 H380 V570 H470 V460 H570 V520 H650 V390 H730 V550 H820 V350 H895 V470 H975 V390 H1080 V790Z" fill="#102742" />
      <path d="M0 790 V570 H95 V630 H200 V540 H285 V650 H370 V530 H480 V690 H590 V590 H690 V670 H770 V560 H895 V630 H985 V570 H1080 V790Z" fill="#163857" />
      <rect y="775" width="1080" height="95" fill="#184762" /><rect y="775" width="1080" height="12" fill={blue} />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={i * 72} y={805 + i % 2 * 20} width="52" height="14" fill="#0d2e49" />)}
      {weights.map((weight, i) => {
        const chosen = bits[i] === 1;
        const n = [0, 2, 3, 5].indexOf(i);
        const collected = n >= 0 && n < pickedCount;
        const delay = 180 + (5 - i) * 21;
        const visible = interpolate(f, [delay, delay + 15], [0, 1], clamp);
        return <g key={i} transform={`translate(${52 + i * 162} 681)`}>
          <rect width="142" height="65" fill={chosen ? "#1a6895" : "#172c40"} stroke={chosen ? blue : "#3b5064"} strokeWidth="4" /><rect width="142" height="10" fill={chosen ? blue : "#3b5064"} />
          {f >= 180 && <g opacity={visible}>
            {!collected && <><rect x="46" y="-58" width="48" height="48" fill={chosen ? "#ffcf52" : "#344b60"} /><rect x="56" y="-48" width="28" height="28" fill={chosen ? "#ab782a" : "#24364a"} /></>}
            <text x="71" y="-82" fontSize="53" fontWeight="700" textAnchor="middle" fill={chosen ? blue : "#677f96"}>{weight}</text>
          </g>}
          <text x="71" y="53" fontSize="44" fontWeight="700" textAnchor="middle" fill={chosen ? "white" : "#728ba2"}>{bits[i]}</text>
          {collected && <text x="71" y="-31" fontSize="38" textAnchor="middle" fill={green}>+{weight}</text>}
        </g>;
      })}
      <g transform={`translate(${72 + progress * 842} ${650 - jump})`}>
        <rect x="10" y="56" width="48" height="10" fill="#05101c" opacity=".5" /><rect x="12" y="-15" width="46" height="46" fill={blue} />
        <rect x="20" y="-7" width="30" height="24" fill="#ebf7ff" /><rect x="23" y="0" width="6" height={stage === 4 ? 4 : 8} fill="#10223b" /><rect x="41" y="0" width="6" height={stage === 4 ? 4 : 8} fill="#10223b" />
        <rect x="15" y="31" width="40" height="22" fill="#188cc7" /><rect x="9" y="53" width="16" height="12" fill={blue} /><rect x="46" y="53" width="16" height="12" fill={blue} /><rect x="-1" y="31" width="15" height="16" fill={blue} /><rect x="56" y="23" width="15" height="16" fill={blue} />
      </g>
      {stage === 4 && <g>
        <rect x="382" y="305" width="316" height="135" fill="#123a32" stroke={green} strokeWidth="6" /><text x="540" y="396" textAnchor="middle" fontSize="91" fontWeight="700" fill={green}>45₁₀</text>
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={280 + i * 80} y={285 + Math.sin(f / 15 + i) * 23} width="12" height="12" fill={i % 2 ? green : "#f0b400"} />)}
      </g>}
    </svg>
    <div style={{ position: "absolute", top: 51, left: 56, right: 56, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 39, fontWeight: 800 }}><span style={{ color: blue }}>BIT QUEST / 01</span><span>СЧЁТ <span style={{ color: score === 45 ? green : blue, fontSize: 55 }}>{score}</span></span></div>
    <div style={{ position: "absolute", top: 146, left: 65, right: 65, textAlign: "center", fontSize: 47, fontWeight: 700 }}>{titles[stage]}</div>
    {stage < 4 && <div style={{ position: "absolute", top: 272, left: 215, right: 215, textAlign: "center", padding: "21px 0", background: "#10243c", border: "3px solid #315d7a", fontSize: 72, letterSpacing: 10 }}>101101₂</div>}
    <div style={{ position: "absolute", top: 813, left: 60, right: 60, textAlign: "center", fontSize: 43, color: stage === 4 ? green : "#8eb8d0" }}>{stage === 4 ? "32 + 8 + 4 + 1 = 45" : stage >= 2 ? "Берём только платформы с единицей" : "Справа вес 1. Дальше каждый ×2"}</div>
  </AbsoluteFill>;
}
