import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { NOTEBOOK_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { NotebookArray, NotebookPage, notebookColors } from "./NotebookPage";

export function NotebookErrorScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = NOTEBOOK_SCRIPT.scenes[3];
  return <NotebookPage title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", top: 377, left: 149, fontSize: 64, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.red }}>a[3]</div>
    <NotebookArray />
    <Interactive.Div name="Out of range index" style={{ position: "absolute", left: 914, top: 609, fontSize: 56, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.red, opacity: interpolate(frame, [20, 40], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>3</Interactive.Div>
    <svg viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0 }} aria-hidden="true"><path d="M899 611 L963 671 M961 610 L900 671" fill="none" stroke={notebookColors.red} strokeWidth="7" strokeLinecap="round" strokeDasharray="180" strokeDashoffset={interpolate(frame, [45, 72], [180, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} /></svg>
    <Interactive.Div name="Written exception" style={{ position: "absolute", left: 369, top: 373, fontSize: 62, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.red, opacity: interpolate(frame, [72, 94], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>→ IndexError</Interactive.Div>
    <Interactive.Div name="Corrected last index" style={{ position: "absolute", left: 150, top: 766, fontSize: 60, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.green, opacity: interpolate(frame, [123, 146], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>a[2] = 9</Interactive.Div>
  </NotebookPage>;
}
