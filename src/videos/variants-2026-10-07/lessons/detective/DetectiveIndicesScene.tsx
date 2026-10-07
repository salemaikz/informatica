import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { DETECTIVE_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { DetectiveDesk, EvidenceCards, Magnifier, detectiveColors } from "./DetectiveDesk";

export function DetectiveIndicesScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = DETECTIVE_SCRIPT.scenes[0];
  const selected = frame < 81 ? 0 : frame < 140 ? 1 : 2;
  return <DetectiveDesk title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", left: 100, top: 367, fontFamily: lessonFonts.code, fontSize: 58, fontWeight: 800, color: detectiveColors.gold }}>a = [4, 7, 9]</div>
    <EvidenceCards selected={selected} />
    <Interactive.Div name="Inspect index labels" style={{ position: "absolute", left: 206, top: 456, translate: interpolate(frame, [48, 82, 108, 142], ["0px 0px", "280px 0px", "280px 0px", "560px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [0, 18, 177, 195], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><Magnifier /></Interactive.Div>
    <div style={{ position: "absolute", left: 153, top: 724, color: detectiveColors.cyan, fontFamily: lessonFonts.code, fontSize: 52, fontWeight: 800 }}>0 → 4 · 1 → 7 · 2 → 9</div>
  </DetectiveDesk>;
}
