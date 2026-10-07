import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, mono, Note, PaperBackdrop, ReelCanvas, SceneHeading } from "./shared";

export function MemeSetupScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.meme;
  return <ReelCanvas background="#fff3dc" color="#392722">
    <PaperBackdrop />
    <Eyebrow color="#94663b">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.setup[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 540, padding: "36px 30px", background: "#fffdf5", border: "6px solid #392722", borderRadius: 22, boxShadow: "12px 14px 0 #e4bd81", ...mono, fontSize: 62, textAlign: "center", rotate: interpolate(frame, [0, 26], ["-5deg", "-1deg"], entrance) }}>items = [10, 20, 30]</div>
    <div style={{ position: "absolute", left: 188, top: 822, width: 690, background: "#ffbd69", border: "6px solid #392722", borderRadius: 22, padding: "32px 30px", ...mono, fontSize: 106, textAlign: "center", opacity: interpolate(frame, [24, 40], [0, 1], clamp), scale: interpolate(frame, [24, 52], [0.72, 1], { ...entrance, output: "perceptual-scale" }) }}>items[<span style={{ color: "#a73a24" }}>3</span>]</div>
    <div style={{ position: "absolute", left: 292, top: 1080, rotate: interpolate(frame, [35, 60], ["-8deg", "1deg"], entrance), opacity: interpolate(frame, [30, 44], [0, 1], clamp) }}><BrandBit frame={frame} size={360} mood="thinking" /></div>
    <Note top={1444} style={{ fontSize: 56, fontWeight: 900 }}>{text.familiar[lang]}</Note>
  </ReelCanvas>;
}
