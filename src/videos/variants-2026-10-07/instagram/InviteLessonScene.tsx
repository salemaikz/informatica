import { interpolate, useCurrentFrame } from "remotion";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, LightBackdrop, mono, Note, ReelCanvas, SceneHeading } from "./shared";

export function InviteLessonScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.invite;
  return <ReelCanvas background="#f4f8fc" color="#15253a">
    <LightBackdrop />
    <Eyebrow color="#4b7896">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.smallRule[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 566, height: 790, borderRadius: 42, border: "2px solid #d9e8f2", background: "#fff", boxShadow: "0 20px 65px #247fb91a", opacity: interpolate(frame, [8, 24], [0, 1], clamp), translate: interpolate(frame, [8, 38], ["0px 55px", "0px 0px"], entrance) }}>
      <div style={{ position: "absolute", left: 46, top: 38, padding: "16px 26px", background: "#e6f3fb", color: "#1277b3", borderRadius: 20, fontSize: 44, fontWeight: 900 }}>{text.lesson[lang]}</div>
      <div style={{ position: "absolute", left: 44, right: 44, top: 180, display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <div style={{ textAlign: "center" }}><div style={{ ...mono, fontSize: 142, color: "#1277b3" }}>1</div><div style={{ fontSize: 52, fontWeight: 900 }}>{text.byte[lang]}</div></div>
        <div style={{ ...mono, fontSize: 92, color: "#8da7b8" }}>=</div>
        <div style={{ textAlign: "center" }}><div style={{ ...mono, fontSize: 142, color: "#248967" }}>8</div><div style={{ fontSize: 52, fontWeight: 900 }}>{text.bit[lang]}</div></div>
      </div>
      <div style={{ position: "absolute", left: 58, right: 58, top: 482, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ height: 108, display: "flex", alignItems: "center", justifyContent: "center", background: "#e4f4ee", color: "#248967", borderRadius: 16, border: "2px solid #b0dbcc", ...mono, fontSize: 60, opacity: interpolate(frame, [30 + i * 6, 42 + i * 6], [0, 1], clamp), scale: interpolate(frame, [30 + i * 6, 50 + i * 6], [0.7, 1], { ...entrance, output: "perceptual-scale" }) }}>{i % 3 === 0 ? "1" : "0"}</div>)}
      </div>
    </div>
    <Note top={1430} color="#526c81" style={{ fontSize: 48 }}>{text.start[lang]}</Note>
  </ReelCanvas>;
}
