import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { DETECTIVE_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { DetectiveDesk, EvidenceCards, detectiveColors } from "./DetectiveDesk";

export function DetectiveErrorScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = DETECTIVE_SCRIPT.scenes[3];
  return <DetectiveDesk title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", left: 100, top: 367, fontSize: 64, fontFamily: lessonFonts.code, fontWeight: 800, color: detectiveColors.red }}>a[3]</div>
    <EvidenceCards />
    <Interactive.Div name="Missing index alert" style={{ position: "absolute", left: 918, top: 511, width: 62, height: 166, border: `4px dashed ${detectiveColors.red}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: lessonFonts.code, fontSize: 53, fontWeight: 800, color: detectiveColors.red, opacity: interpolate(frame, [28,48], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>3</Interactive.Div>
    <Interactive.Div name="Exception stamp" style={{ position: "absolute", left: 301, top: 367, fontFamily: lessonFonts.code, fontSize: 65, fontWeight: 800, color: detectiveColors.red, opacity: interpolate(frame, [62,83], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), scale: interpolate(frame, [62,83], [1.12,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16,1,0.3,1), output: "perceptual-scale" }) }}>→ IndexError</Interactive.Div>
    <Interactive.Div name="Case resolved index bounds" style={{ position: "absolute", left: 141, top: 724, fontSize: 50, fontFamily: lessonFonts.code, fontWeight: 800, color: detectiveColors.cyan, opacity: interpolate(frame, [109,132], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>len(a) − 1 = 2</Interactive.Div>
  </DetectiveDesk>;
}
