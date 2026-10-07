import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, DarkBackdrop, entrance, Eyebrow, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function TeachRuleScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.teach;
  return <ReelCanvas background="#101722" color="#f4f9ff">
    <DarkBackdrop />
    <Eyebrow color="#79dcff">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.ruleTitle[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 560, ...mono, fontSize: 74, color: "#c3d2e2", textAlign: "center", opacity: interpolate(frame, [0, 18], [0, 1], clamp) }}>bool(<span style={{ color: "#b7ed67" }}>{"'False'"}</span>)</div>
    <div style={{ position: "absolute", top: 724, left: 90, right: 90, textAlign: "center", color: "#79dcff", fontSize: 106, opacity: interpolate(frame, [18, 34], [0, 1], clamp), translate: interpolate(frame, [18, 42], ["0px -28px", "0px 0px"], entrance) }}>↓</div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 884, ...mono, fontSize: 224, color: "#b7ed67", textAlign: "center", fontWeight: 800, scale: interpolate(frame, [28, 56], [0.6, 1], { ...entrance, output: "perceptual-scale" }), opacity: interpolate(frame, [28, 40], [0, 1], clamp) }}>True</div>
    <div style={{ position: "absolute", right: 98, top: 1144, opacity: interpolate(frame, [45, 60], [0, 1], clamp) }}><BrandBit frame={frame} size={190} mood="happy" /></div>
    <Note top={1240} style={{ right: 308 }} color="#f4f9ff">{text.rule[lang]}</Note>
    <Note top={1390} color="#a9bdd1">{text.meaning[lang]}</Note>
  </ReelCanvas>;
}
