import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { SHELF_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { ShelfRow, ShelfStage, shelfColors } from "./ShelfObjects";

export function ShelfSliceScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame();
  const copy = SHELF_SCRIPT.scenes[2];
  return <ShelfStage title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", top: 366, left: 110, fontFamily: lessonFonts.code, fontSize: 60, fontWeight: 800, color: shelfColors.blue }}>a[1:3]</div>
    <ShelfRow />
    <Interactive.Div name="Included slice region" style={{ position: "absolute", left: 373, top: 471, width: 536, height: 216, border: `7px solid ${shelfColors.mint}`, borderRadius: 17, opacity: interpolate(frame, [20, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
    <Interactive.Div name="Start boundary 1" style={{ position: "absolute", left: 371, top: 688, fontFamily: lessonFonts.code, fontSize: 47, fontWeight: 800, color: shelfColors.mint, opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>1</Interactive.Div>
    <Interactive.Div name="Excluded boundary 3" style={{ position: "absolute", left: 925, top: 688, fontFamily: lessonFonts.code, fontSize: 47, fontWeight: 800, color: shelfColors.danger, opacity: interpolate(frame, [48, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>3</Interactive.Div>
    <Interactive.Div name="New list copied from slice" style={{ position: "absolute", left: 482, top: 499, width: 332, padding: "10px 16px", borderRadius: 12, backgroundColor: shelfColors.paper, border: `4px solid ${shelfColors.mint}`, color: shelfColors.mint, fontFamily: lessonFonts.code, fontSize: 65, fontWeight: 800, textAlign: "center", opacity: interpolate(frame, [95, 112], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: interpolate(frame, [105, 153], ["0px 0px", "-70px -131px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) }}>[7, 9]</Interactive.Div>
    <Interactive.Div name="Slice equality" style={{ position: "absolute", top: 370, left: 350, fontFamily: lessonFonts.code, fontSize: 60, fontWeight: 800, color: shelfColors.mint, opacity: interpolate(frame, [150, 170], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>=</Interactive.Div>
  </ShelfStage>;
}
