import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { DETECTIVE_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { DetectiveDesk, EvidenceCards, detectiveColors } from "./DetectiveDesk";

export function DetectiveSliceScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = DETECTIVE_SCRIPT.scenes[2];
  return <DetectiveDesk title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", left: 100, top: 367, fontSize: 62, fontWeight: 800, fontFamily: lessonFonts.code, color: detectiveColors.gold }}>a[1:3]</div>
    <EvidenceCards />
    <Interactive.Div name="Slice evidence boundary" style={{ position: "absolute", left: 405, top: 449, width: 536, height: 266, border: `6px solid ${detectiveColors.cyan}`, borderRadius: 12, opacity: interpolate(frame, [20, 44], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
    <Interactive.Div name="Left boundary one" style={{ position: "absolute", left: 409, top: 724, fontSize: 48, fontFamily: lessonFonts.code, color: detectiveColors.cyan, fontWeight: 800, opacity: interpolate(frame, [30,50], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>1</Interactive.Div>
    <Interactive.Div name="Right boundary three" style={{ position: "absolute", left: 941, top: 724, fontSize: 48, fontFamily: lessonFonts.code, color: detectiveColors.red, fontWeight: 800, opacity: interpolate(frame, [54,74], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>3</Interactive.Div>
    <Interactive.Div name="Collected evidence list" style={{ position: "absolute", left: 470, top: 546, padding: "8px 17px", fontSize: 66, fontFamily: lessonFonts.code, fontWeight: 800, color: detectiveColors.darkInk, backgroundColor: detectiveColors.paper, borderRadius: 8, opacity: interpolate(frame, [96,112], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: interpolate(frame, [108,152], ["0px 0px", "-70px -175px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) }}>[7, 9]</Interactive.Div>
    <Interactive.Div name="Slice equality" style={{ position: "absolute", left: 347, top: 373, fontFamily: lessonFonts.code, fontSize: 66, color: detectiveColors.cyan, fontWeight: 800, opacity: interpolate(frame, [148,168], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>=</Interactive.Div>
  </DetectiveDesk>;
}
