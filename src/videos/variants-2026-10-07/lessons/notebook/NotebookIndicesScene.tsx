import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { NOTEBOOK_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { NotebookArray, NotebookPage, NotebookPen, notebookColors } from "./NotebookPage";

export function NotebookIndicesScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = NOTEBOOK_SCRIPT.scenes[0];
  return <NotebookPage title={copy.title[lang]} caption={copy.caption[lang]}>
    <Interactive.Div name="Written list name" style={{ position: "absolute", left: 149, top: 374, fontSize: 60, fontWeight: 800, fontFamily: lessonFonts.code, clipPath: `inset(0 ${interpolate(frame, [0, 26], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}% 0 0)` }}>a =</Interactive.Div>
    <NotebookArray selected={frame > 105 ? 1 : -1} />
    <Interactive.Div name="Pen signs the indices" style={{ position: "absolute", top: 560, left: 245, rotate: "27deg", translate: interpolate(frame, [25, 57, 88, 120], ["0px 0px", "230px 0px", "230px 0px", "460px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [0, 15, 135, 155], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><NotebookPen /></Interactive.Div>
    <Interactive.Div name="Direct index result" style={{ position: "absolute", left: 175, top: 751, fontSize: 67, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.green, opacity: interpolate(frame, [138, 161], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>a[1] = 7</Interactive.Div>
  </NotebookPage>;
}
