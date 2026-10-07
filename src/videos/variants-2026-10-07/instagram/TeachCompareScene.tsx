import { interpolate, useCurrentFrame } from "remotion";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, DarkBackdrop, entrance, Eyebrow, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function TeachCompareScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.teach;
  return <ReelCanvas background="#101722" color="#f4f9ff">
    <DarkBackdrop />
    <Eyebrow color="#79dcff">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.compare[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 568, background: "#1b3040", border: "2px solid #4f6a50", borderRadius: 30, padding: "34px 40px", opacity: interpolate(frame, [8, 24], [0, 1], clamp), translate: interpolate(frame, [8, 34], ["0px 32px", "0px 0px"], entrance) }}>
      <div style={{ ...mono, fontSize: 66 }}>bool(<span style={{ color: "#b7ed67" }}>{"'False'"}</span>)</div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><span style={{ ...mono, fontSize: 96, color: "#b7ed67" }}>True</span><span style={{ fontSize: 44, color: "#b6c9db", fontWeight: 800 }}>{text.notEmpty[lang]}</span></div>
    </div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 936, background: "#1a2635", border: "2px solid #41546b", borderRadius: 30, padding: "34px 40px", opacity: interpolate(frame, [40, 56], [0, 1], clamp), translate: interpolate(frame, [40, 64], ["0px 32px", "0px 0px"], entrance) }}>
      <div style={{ ...mono, fontSize: 66 }}>bool(<span style={{ color: "#79dcff" }}>{"''"}</span>)</div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><span style={{ ...mono, fontSize: 96, color: "#79dcff" }}>False</span><span style={{ fontSize: 44, color: "#b6c9db", fontWeight: 800 }}>{text.empty[lang]}</span></div>
    </div>
    <Note top={1395} color="#b7ed67" style={{ fontSize: 56, fontWeight: 950, opacity: interpolate(frame, [74, 92], [0, 1], clamp) }}>{text.save[lang]}</Note>
  </ReelCanvas>;
}
