import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { SHELF_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { ShelfRow, ShelfStage, shelfColors } from "./ShelfObjects";

export function ShelfErrorScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame();
  const copy = SHELF_SCRIPT.scenes[3];
  return <ShelfStage title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", top: 366, left: 110, fontFamily: lessonFonts.code, fontSize: 62, fontWeight: 800, color: shelfColors.danger }}>a[3]</div>
    <ShelfRow />
    <Interactive.Div name="Nonexistent fourth slot" style={{ position: "absolute", left: 935, top: 504, width: 48, height: 151, border: `4px dashed ${shelfColors.danger}`, borderRadius: 8, opacity: interpolate(frame, [38, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
    <Interactive.Div name="Invalid index pointer" style={{ position: "absolute", top: 729, left: 202, width: 70, textAlign: "center", fontSize: 50, fontFamily: lessonFonts.code, fontWeight: 800, color: shelfColors.danger, translate: interpolate(frame, [10, 48], ["0px 0px", "715px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) }}>↑3</Interactive.Div>
    <Interactive.Div name="Python exception" style={{ position: "absolute", left: 316, top: 358, fontFamily: lessonFonts.code, fontSize: 65, fontWeight: 800, color: shelfColors.danger, opacity: interpolate(frame, [65, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: interpolate(frame, [65, 74, 83, 92], ["0px 0px", "10px 0px", "-7px 0px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>→ IndexError</Interactive.Div>
  </ShelfStage>;
}
