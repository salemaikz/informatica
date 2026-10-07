import { interpolate, useCurrentFrame } from "remotion";
import { reelText, type InstagramSceneProps } from "./script";
import { clamp, entrance, Eyebrow, mono, Note, PaperBackdrop, ReelCanvas, SceneHeading } from "./shared";

export function MemeIndexScene({ lang }: InstagramSceneProps) {
  const frame = useCurrentFrame();
  const text = reelText.meme;
  return <ReelCanvas background="#fff3dc" color="#392722">
    <PaperBackdrop />
    <Eyebrow color="#94663b">{text.eyebrow[lang]}</Eyebrow>
    <SceneHeading>{text.start[lang]}</SceneHeading>
    <div style={{ position: "absolute", left: 90, right: 90, top: 628, display: "flex", gap: 30 }}>
      {[10, 20, 30].map((value, index) => <div key={value} style={{ width: 280, opacity: interpolate(frame, [12 + index * 18, 28 + index * 18], [0, 1], clamp), translate: interpolate(frame, [12 + index * 18, 40 + index * 18], ["0px 70px", "0px 0px"], entrance) }}>
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", background: index === 2 ? "#c7e4c6" : "#ffdb98", border: "6px solid #392722", borderRadius: 24, boxShadow: "10px 12px 0 #d6ad70", ...mono, fontSize: 116 }}>{value}</div>
        <div style={{ textAlign: "center", marginTop: 48, fontSize: 44, fontWeight: 900, color: "#94663b" }}>{text.address[lang]}</div>
        <div style={{ width: 166, height: 166, margin: "18px auto 0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "6px solid #392722", background: index === 2 ? "#73b97b" : "#fffdf5", color: index === 2 ? "#fffdf5" : "#392722", ...mono, fontSize: 110 }}>{index}</div>
      </div>)}
    </div>
    <Note top={1365} style={{ fontSize: 54, fontWeight: 900, opacity: interpolate(frame, [76, 94], [0, 1], clamp) }}>{text.three[lang]}</Note>
  </ReelCanvas>;
}
