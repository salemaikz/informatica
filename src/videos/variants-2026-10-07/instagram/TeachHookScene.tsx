import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, DarkBackdrop, entrance, Eyebrow, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function TeachHookScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.teach;
  return <ReelCanvas background="#101722" color="#f4f9ff">
    <DarkBackdrop />
    <Eyebrow color="#79dcff">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.question[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 528, border: "2px solid #365168", background: "#142334", borderRadius: 30, padding: "52px 28px", textAlign: "center", ...mono, fontSize: 80, opacity: interpolate(frame, [8, 24], [0, 1], clamp), scale: interpolate(frame, [8, 32], [0.92, 1], { ...entrance, output: "perceptual-scale" }) }}>bool(<span style={{ color: "#b7ed67" }}>{"'False'"}</span>)</div>
    <div style={{ position: "absolute", left: 108, right: 108, top: 786, display: "flex", gap: 28 }}>
      <div style={{ flex: 1, border: "2px solid #435365", borderRadius: 24, padding: "32px 12px", textAlign: "center", color: "#d5e0ed", ...mono, fontSize: 80 }}>True</div>
      <div style={{ flex: 1, border: "2px solid #435365", borderRadius: 24, padding: "32px 12px", textAlign: "center", color: "#d5e0ed", ...mono, fontSize: 80 }}>False</div>
    </div>
    <div style={{ position: "absolute", left: 120, top: 1080, opacity: interpolate(frame, [18, 34], [0, 1], clamp) }}><BrandBit frame={frame} size={260} mood="thinking" /></div>
    <div style={{ position: "absolute", right: 160, top: 1080, ...mono, fontSize: 178, fontWeight: 800, color: "#79dcff", scale: interpolate(frame % 30, [0, 8, 29], [0.85, 1, 1], { ...entrance, output: "perceptual-scale" }) }}>{frame < 45 ? "?" : Math.max(1, 3 - Math.floor((frame - 45) / 30))}</div>
    <Note color="#a9bdd1" top={1420}>{text.think[lang]}</Note>
  </ReelCanvas>;
}
