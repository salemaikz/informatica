import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../lab/shared/BrandBit";
import { palette, ReviewFrame } from "./Frame";
import { videoReview, type ReviewLanguage } from "./script";

export type ReviewVideoProps = { lang: ReviewLanguage };
const xFor = (value: number) => 42 + value * 77;

export function RangeVideo({ lang }: ReviewVideoProps) {
  const frame = useCurrentFrame();
  const seconds = frame / 30;
  const text = videoReview.range;
  const stage = seconds < 6 ? 0 : seconds < 15 ? 1 : seconds < 21 ? 2 : seconds < 28 ? 3 : seconds < 36 ? 4 : 5;
  const position = interpolate(frame, [180, 225, 270, 315, 345, 380, 430, 449], [2, 2, 4, 4, 6, 6, 8, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quiz = stage >= 4;
  const reveal = stage === 5;
  return <ReviewFrame label={text.label[lang]} title={quiz ? text.quiz[lang] : text.title[lang]} caption={text.captions[stage][lang]}>
    {!quiz ? <>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 56, fontWeight: 800 }}>
        <span style={{ color: palette.muted }}>range(</span>
        {[2, 9, 2].map((value, i) => <div key={i} style={{ textAlign: "center", color: i === 1 ? palette.danger : i === 2 ? palette.gold : palette.primary }}>
          <div>{value}{i < 2 ? "," : ""}</div>
          <div style={{ fontFamily: '"Nunito Variable", sans-serif', fontSize: 28, marginTop: 8 }}>{[text.start, text.stop, text.step][i][lang]}</div>
        </div>)}<span style={{ color: palette.muted }}>)</span>
      </div>
      <svg width="912" height="190" viewBox="0 0 912 190" style={{ position: "absolute", top: 134, overflow: "visible" }}>
        <line x1="42" x2="830" y1="90" y2="90" stroke={palette.muted} strokeWidth="5" />
        <line x1={xFor(9)} x2={xFor(9)} y1="10" y2="152" stroke={palette.danger} strokeWidth="4" strokeDasharray="10 9" />
        {Array.from({ length: 11 }, (_, n) => <g key={n}>
          <line x1={xFor(n)} x2={xFor(n)} y1="83" y2="97" stroke={palette.muted} strokeWidth="4" />
          {[2, 4, 6, 8].includes(n) && stage >= 1 && position >= n && <circle cx={xFor(n)} cy="90" r="17" fill={palette.primary} />}
          <text x={xFor(n)} y="140" textAnchor="middle" fill={n === 9 ? palette.danger : palette.ink} fontFamily="Nunito Variable" fontWeight="800" fontSize="37">{n}</text>
        </g>)}
        {[2, 4, 6].map((n) => <path key={n} d={`M${xFor(n)},63 Q${xFor(n + 1)},-8 ${xFor(n + 2)},63`} fill="none" stroke={palette.gold} strokeWidth="4" strokeDasharray="8 6" opacity={stage >= 1 && position >= n + 2 ? 1 : 0} />)}
      </svg>
      {stage === 1 && <div style={{ position: "absolute", top: 122, left: xFor(position) - 40, translate: `0px ${-Math.abs(Math.sin(frame / 25)) * 16}px` }}><BrandBit frame={frame} size={82} mood="happy" /></div>}
      {stage === 2 && <div style={{ position: "absolute", bottom: -16, left: 190, color: palette.danger, fontSize: 44, fontWeight: 900 }}>10 ≥ 9 → stop</div>}
      {stage === 3 && <div style={{ position: "absolute", bottom: -16, left: 115, fontSize: 48, fontFamily: '"JetBrains Mono Variable", monospace', color: palette.green }}>print: 2 4 6 8</div>}
    </> : <div style={{ background: palette.surface, border: `3px solid ${palette.primary}50`, padding: "35px 32px", borderRadius: 32 }}>
      <div style={{ fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 42, lineHeight: 1.65 }}>for i in range(7, 1, -2):<br /><span style={{ marginLeft: 60 }}>print(i)</span></div>
      <div style={{ marginTop: 22, fontSize: 58, fontFamily: '"JetBrains Mono Variable", monospace', color: reveal ? palette.green : palette.gold }}>{reveal ? "7   5   3" : "?   ?   ?"}</div>
    </div>}
  </ReviewFrame>;
}
