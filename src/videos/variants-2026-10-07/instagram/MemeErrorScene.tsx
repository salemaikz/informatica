import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, mono, Note, PaperBackdrop, ReelCanvas, SceneHeading } from "./shared";

export function MemeErrorScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.meme;
  return <ReelCanvas background="#fff3dc" color="#392722">
    <PaperBackdrop />
    <Eyebrow color="#94663b">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.errorTitle[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 94, right: 94, top: 568, background: "#e96345", border: "6px solid #392722", color: "#fffdf5", borderRadius: 12, padding: "52px 20px", textAlign: "center", ...mono, fontSize: 112, boxShadow: "14px 16px 0 #392722", rotate: interpolate(frame, [0, 12, 24], ["-5deg", "3deg", "-2deg"], clamp), scale: interpolate(frame, [0, 22], [0.5, 1], { ...entrance, output: "perceptual-scale" }) }}>IndexError</div>
    <div style={{ position: "absolute", left: 100, right: 100, top: 890, minHeight: 212, background: "#fffdf5", border: "6px solid #392722", borderRadius: 40, padding: "36px 38px", fontSize: 60, lineHeight: 1.18, fontWeight: 900, opacity: interpolate(frame, [30, 48], [0, 1], clamp), translate: interpolate(frame, [30, 54], ["0px 44px", "0px 0px"], entrance) }}>{text.joke[lang]}<svg width="82" height="58" style={{ position: "absolute", left: 130, bottom: -52 }}><path d="M4 0 L6 48 L72 0" fill="#fffdf5" stroke="#392722" strokeWidth="6" /><path d="M8 0 L68 0" stroke="#fffdf5" strokeWidth="8" /></svg></div>
    <div style={{ position: "absolute", left: 146, top: 1170 }}><BrandBit frame={frame} size={278} mood="thinking" /></div>
    <Note top={1388} style={{ left: 458, fontSize: 64, ...mono, color: "#a73a24", opacity: interpolate(frame, [65, 85], [0, 1], clamp) }}>items[3]</Note>
  </ReelCanvas>;
}
