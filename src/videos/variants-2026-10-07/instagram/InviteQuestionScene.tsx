import { interpolate, useCurrentFrame } from "remotion";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, LightBackdrop, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function InviteQuestionScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.invite;
  return <ReelCanvas background="#f4f8fc" color="#15253a">
    <LightBackdrop />
    <Eyebrow color="#4b7896">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.question[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 540, background: "#fff", border: "2px solid #d9e8f2", boxShadow: "0 20px 65px #247fb916", borderRadius: 36, padding: "44px 46px", fontSize: 64, lineHeight: 1.18, fontWeight: 900, opacity: interpolate(frame, [6, 22], [0, 1], clamp), translate: interpolate(frame, [6, 34], ["0px 38px", "0px 0px"], entrance) }}>{text.twoBytes[lang]}</div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 828, opacity: interpolate(frame, [44, 64], [0, 1], clamp), translate: interpolate(frame, [44, 72], ["0px 44px", "0px 0px"], entrance) }}>
      <div style={{ display: "inline-block", fontSize: 44, fontWeight: 900, padding: "14px 26px", borderRadius: 20, background: "#e4f4ee", color: "#248967" }}>{text.explain[lang]}</div>
      <div style={{ marginTop: 40, ...mono, fontSize: 108, fontWeight: 800, color: "#1277b3", whiteSpace: "nowrap" }}>2 × 8 = <span style={{ color: "#248967", opacity: interpolate(frame, [76, 90], [0, 1], clamp) }}>16</span></div>
      <div style={{ fontSize: 60, fontWeight: 900, color: "#248967", marginTop: 22, opacity: interpolate(frame, [76, 96], [0, 1], clamp) }}>{text.bit[lang]}</div>
    </div>
    <Note top={1416} color="#526c81" style={{ opacity: interpolate(frame, [80, 100], [0, 1], clamp) }}>{text.multiply[lang]}</Note>
  </ReelCanvas>;
}
