import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { SHELF_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { ShelfRow, ShelfStage, shelfColors } from "./ShelfObjects";

export function ShelfLastScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame();
  const copy = SHELF_SCRIPT.scenes[1];
  return <ShelfStage title={copy.title[lang]} caption={copy.caption[lang]}>
    <Interactive.Div name="Negative lookup" style={{ position: "absolute", top: 366, left: 110, fontFamily: lessonFonts.code, fontSize: 60, fontWeight: 800, color: shelfColors.blue }}>a[-1]</Interactive.Div>
    <ShelfRow active={frame >= 50 ? 2 : -1} negative />
    <Interactive.Div name="Right edge search arrow" style={{ position: "absolute", top: 675, left: 927, fontSize: 66, color: shelfColors.mint, translate: interpolate(frame, [12, 52], ["0px 0px", "-128px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [0, 12, 115, 135], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>←</Interactive.Div>
    <Interactive.Div name="Extracted last value" style={{ position: "absolute", top: 502, left: 718, width: 142, height: 138, borderRadius: 8, backgroundColor: shelfColors.paper, border: `4px solid ${shelfColors.mint}`, textAlign: "center", fontFamily: lessonFonts.code, fontSize: 100, lineHeight: 1.28, fontWeight: 800, color: shelfColors.mint, translate: interpolate(frame, [65, 110], ["0px 0px", "-360px -115px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [58, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>9</Interactive.Div>
    <Interactive.Div name="Lookup equals" style={{ position: "absolute", top: 388, left: 316, fontFamily: lessonFonts.code, fontSize: 64, fontWeight: 800, color: shelfColors.mint, opacity: interpolate(frame, [100, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>=</Interactive.Div>
  </ShelfStage>;
}
