import { interpolate, useCurrentFrame } from "remotion";
import { BrandBit } from "../../lab/shared/BrandBit";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, LightBackdrop, Note, ReelCanvas, SceneHeading } from "./shared";

export function InviteCtaScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.invite;
  return <ReelCanvas background="#f4f8fc" color="#15253a">
    <LightBackdrop />
    <Eyebrow color="#4b7896">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.cta[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 322, top: 588, opacity: interpolate(frame, [8, 26], [0, 1], clamp), scale: interpolate(frame, [8, 40], [0.7, 1], { ...entrance, output: "perceptual-scale" }) }}><BrandBit frame={frame} size={436} mood="celebrate" /></div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1120, padding: "38px 42px", background: "#1277b3", borderRadius: 30, boxShadow: "0 14px 0 #c9e4f2", color: "#fff", fontSize: 80, fontWeight: 950, textAlign: "center", opacity: interpolate(frame, [30, 48], [0, 1], clamp), translate: interpolate(frame, [30, 60], ["0px 50px", "0px 0px"], entrance) }}>Informatica</div>
    <Note top={1362} color="#526c81" style={{ fontSize: 48, textAlign: "center", opacity: interpolate(frame, [55, 76], [0, 1], clamp) }}>{text.steps[lang]}</Note>
  </ReelCanvas>;
}
