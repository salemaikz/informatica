import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { DETECTIVE_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { DetectiveDesk, EvidenceCards, Magnifier, detectiveColors } from "./DetectiveDesk";

export function DetectiveLastScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = DETECTIVE_SCRIPT.scenes[1];
  return <DetectiveDesk title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", left: 100, top: 367, fontFamily: lessonFonts.code, fontSize: 62, fontWeight: 800, color: detectiveColors.gold }}>a[-1]</div>
    <EvidenceCards selected={2} negative />
    <Interactive.Div name="Inspect final clue" style={{ position: "absolute", top: 456, left: 898, translate: interpolate(frame, [12, 55], ["0px 0px", "-132px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [0, 16, 110, 129], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><Magnifier /></Interactive.Div>
    <Interactive.Div name="Confirmed last value" style={{ position: "absolute", left: 772, top: 553, width: 104, height: 120, textAlign: "center", fontFamily: lessonFonts.code, fontSize: 100, fontWeight: 800, color: detectiveColors.darkInk, backgroundColor: detectiveColors.paper, borderRadius: 5, translate: interpolate(frame, [93, 133], ["0px 0px", "-426px -184px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [85, 93], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>9</Interactive.Div>
    <Interactive.Div name="Final lookup equal sign" style={{ position: "absolute", left: 296, top: 373, fontFamily: lessonFonts.code, fontSize: 66, fontWeight: 800, color: detectiveColors.cyan, opacity: interpolate(frame, [128, 147], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>=</Interactive.Div>
    <div style={{ position: "absolute", left: 140, top: 724, fontSize: 48, fontWeight: 800, color: detectiveColors.cyan }}>{lang === "ru" ? "Считаем справа налево" : "Оңнан солға санаймыз"}</div>
  </DetectiveDesk>;
}
