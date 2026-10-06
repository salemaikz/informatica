import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../lab/shared/BrandBit";
import { palette, ReviewFrame } from "./Frame";
import { videoReview } from "./script";
import type { ReviewVideoProps } from "./RangeVideo";

const cases = [[false, false], [false, true], [true, false], [true, true]] as const;

export function LogicVideo({ lang }: ReviewVideoProps) {
  const frame = useCurrentFrame();
  const seconds = frame / 30;
  const stage = seconds < 6 ? 0 : seconds < 15 ? 1 : seconds < 23 ? 2 : seconds < 29 ? 3 : seconds < 38 ? 4 : 5;
  const text = videoReview.logic;
  const row = stage === 1 ? Math.min(3, Math.floor((seconds - 6) / 2.25)) : stage === 2 ? Math.min(3, Math.floor((seconds - 15) / 2)) : 2;
  const [ticket, code] = cases[row];
  const operator = stage === 2 ? "or" : "and";
  const accepted = operator === "or" ? ticket || code : ticket && code;
  const rowStart = stage === 2 ? 450 + row * 60 : 180 + row * 67.5;
  const quiz = stage >= 4;
  return <ReviewFrame label={text.label[lang]} title={quiz ? text.quiz[lang] : text.title[lang]} caption={text.captions[stage][lang]} accent={palette.purple}>
    {stage < 3 ? <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {[{ name: text.ticket, yes: ticket }, { name: text.code, yes: code }].map(({ name, yes }, i) => <div key={i} style={{ width: 205, borderRadius: 24, border: `3px solid ${yes ? palette.green : palette.danger}`, background: palette.surface, padding: "24px 10px", textAlign: "center" }}>
            <div style={{ color: palette.muted, fontSize: 32, fontWeight: 850 }}>{name[lang]}</div>
            <div style={{ color: yes ? palette.green : palette.danger, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 44, fontWeight: 850, marginTop: 10 }}>{String(yes).replace(/^./, (c) => c.toUpperCase())}</div>
          </div>)}
        </div>
        <div style={{ fontSize: 46, fontFamily: '"JetBrains Mono Variable", monospace', color: palette.purple }}>{operator}</div>
        <div style={{ position: "relative", width: 180, height: 180, background: palette.surface, border: `8px solid ${accepted ? palette.green : palette.danger}`, borderRadius: "32px 32px 0 0", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: palette.bg, translate: `${accepted ? interpolate(frame - rowStart, [0, 18], [0, 170], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0}px 0px` }} />
          <div style={{ position: "absolute", left: 27, bottom: 15 }}><BrandBit frame={frame} size={115} mood={accepted ? "happy" : "thinking"} /></div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 28, color: accepted ? palette.green : palette.danger, fontSize: 40, fontWeight: 900 }}>{(accepted ? text.open : text.closed)[lang]}</div>
      {stage > 0 && <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 20 }}>{cases.map(([a, b], i) => <div key={i} style={{ padding: "9px 14px", borderRadius: 12, fontSize: 30, fontWeight: 850, background: row === i ? palette.purple : palette.surface, color: row === i ? palette.bg : palette.ink }}>
        {Number(a)} {operator} {Number(b)} → {Number(operator === "or" ? a || b : a && b)}
      </div>)}</div>}
    </> : stage === 3 ? <div style={{ padding: 46, background: palette.surface, borderRadius: 32, textAlign: "center" }}>
      <div style={{ fontSize: 62, fontFamily: '"JetBrains Mono Variable", monospace', color: palette.purple }}>not True → False</div>
      <div style={{ fontSize: 50, fontFamily: '"JetBrains Mono Variable", monospace', color: palette.green, marginTop: 22 }}>not False → True</div>
      <div style={{ fontSize: 36, fontWeight: 850, marginTop: 24, color: palette.muted }}>{text.priority[lang]}</div>
    </div> : <div style={{ padding: "34px 26px", background: palette.surface, borderRadius: 32, textAlign: "center" }}>
      <div style={{ fontSize: 41, fontFamily: '"JetBrains Mono Variable", monospace' }}>True or <span style={{ color: palette.gold }}>False and False</span></div>
      <div style={{ marginTop: 30, fontSize: 50, fontFamily: '"JetBrains Mono Variable", monospace', color: stage === 5 ? palette.green : palette.purple }}>{stage === 5 ? "True or False → True" : "True / False ?"}</div>
      <div style={{ fontSize: 36, fontWeight: 850, marginTop: 26, color: palette.muted }}>{text.priority[lang]}</div>
    </div>}
  </ReviewFrame>;
}
