import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { SHELF_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { ShelfRow, ShelfStage, shelfColors } from "./ShelfObjects";

export function ShelfIndicesScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame();
  const copy = SHELF_SCRIPT.scenes[0];
  const active = frame < 75 ? 0 : frame < 135 ? 1 : 2;
  return <ShelfStage title={copy.title[lang]} caption={copy.caption[lang]}>
    <Interactive.Div name="List declaration" style={{ position: "absolute", top: 366, left: 110, fontFamily: lessonFonts.code, fontSize: 55, fontWeight: 700, color: shelfColors.blue, opacity: interpolate(frame, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>a = [4, 7, 9]</Interactive.Div>
    <ShelfRow active={active} />
    <Interactive.Div name="Index pointer" style={{ position: "absolute", top: 684, left: 202, width: 62, textAlign: "center", fontSize: 54, color: shelfColors.mint, translate: interpolate(frame, [45, 75, 110, 135], ["0px 0px", "278px 0px", "278px 0px", "556px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) }}>↑</Interactive.Div>
  </ShelfStage>;
}
