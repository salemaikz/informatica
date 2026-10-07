import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, LightBackdrop, Note, ReelCanvas, SceneHeading } from "./shared";

export function InviteHelloScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.invite;
  return <ReelCanvas background="#f4f8fc" color="#15253a">
    <LightBackdrop />
    <Eyebrow color="#4b7896">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.hello[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 255, top: 614, width: 570, height: 570, background: "#ffffff", border: "2px solid #d9e8f2", borderRadius: "50%", boxShadow: "0 26px 90px #247fb91a", opacity: interpolate(frame, [0, 20], [0, 1], clamp), scale: interpolate(frame, [0, 32], [0.78, 1], { ...entrance, output: "perceptual-scale" }) }} />
    <div style={{ position: "absolute", left: 300, top: 652, opacity: interpolate(frame, [12, 30], [0, 1], clamp), translate: interpolate(frame, [12, 44], ["0px 70px", "0px 0px"], entrance) }}><BrandBit frame={frame} size={480} mood="happy" /></div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1286, textAlign: "center", fontSize: 80, fontWeight: 950, letterSpacing: -2, color: "#1277b3", opacity: interpolate(frame, [44, 66], [0, 1], clamp) }}>Informatica</div>
    <Note top={1414} style={{ textAlign: "center" }} color="#526c81">{text.start[lang]}</Note>
  </ReelCanvas>;
}
