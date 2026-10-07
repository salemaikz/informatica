import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, mono, Note, PaperBackdrop, ReelCanvas, SceneHeading } from "./shared";

export function MemeFixedScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.meme;
  return <ReelCanvas background="#fff3dc" color="#392722">
    <PaperBackdrop />
    <Eyebrow color="#94663b">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.fixed[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 534, background: "#fffdf5", border: "6px solid #392722", borderRadius: 24, padding: "36px 30px", textAlign: "center", ...mono, fontSize: 86, boxShadow: "12px 14px 0 #a3cf9f", opacity: interpolate(frame, [8, 24], [0, 1], clamp), rotate: interpolate(frame, [8, 30], ["3deg", "0deg"], entrance) }}>items[<span style={{ color: "#367e45" }}>2</span>] → 30</div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 832, minHeight: 268, padding: "32px 40px", border: "6px solid #392722", borderRadius: 36, background: "#ffdb98", fontSize: 72, lineHeight: 1.16, fontWeight: 950, whiteSpace: "pre-line", opacity: interpolate(frame, [30, 48], [0, 1], clamp), translate: interpolate(frame, [30, 56], ["0px 38px", "0px 0px"], entrance) }}>{text.rule[lang]}</div>
    <div style={{ position: "absolute", left: 160, top: 1200 }}><BrandBit frame={frame} size={264} mood="celebrate" /></div>
    <Note top={1254} style={{ left: 474, fontSize: 52, fontWeight: 900, opacity: interpolate(frame, [58, 78], [0, 1], clamp) }}>{text.third[lang]}</Note>
  </ReelCanvas>;
}
