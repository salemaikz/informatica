import { interpolate, useCurrentFrame } from "remotion";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, DarkBackdrop, entrance, Eyebrow, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function TeachStringScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.teach;
  return <ReelCanvas background="#101722" color="#f4f9ff">
    <DarkBackdrop />
    <Eyebrow color="#79dcff">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.quotes[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 560, ...mono, fontSize: 122, textAlign: "center", color: "#b7ed67", opacity: interpolate(frame, [6, 20], [0, 1], clamp) }}><span style={{ color: "#79dcff", fontSize: 166 }}>{"'"}</span>False<span style={{ color: "#79dcff", fontSize: 166 }}>{"'"}</span></div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 832, display: "flex", gap: 22 }}>
      {"False".split("").map((letter, i) => <div key={i} style={{ width: 162, height: 176, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22, border: "2px solid #79dcff", background: "#213b4d", color: "#b7ed67", ...mono, fontSize: 110, opacity: interpolate(frame, [26 + i * 8, 40 + i * 8], [0, 1], clamp), translate: interpolate(frame, [26 + i * 8, 46 + i * 8], ["0px 58px", "0px 0px"], entrance) }}>{letter}</div>)}
    </div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1084, fontSize: 80, fontWeight: 950, color: "#79dcff", opacity: interpolate(frame, [54, 74], [0, 1], clamp) }}>{text.isText[lang]}</div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1200, height: 7, background: "#79dcff", width: interpolate(frame, [60, 90], [0, 900], clamp) }} />
    <Note color="#c3d2e2" top={1300}>{text.five[lang]}</Note>
  </ReelCanvas>;
}
