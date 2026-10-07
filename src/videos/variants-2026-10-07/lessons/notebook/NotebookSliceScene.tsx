import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { NOTEBOOK_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { NotebookArray, NotebookPage, notebookColors } from "./NotebookPage";

export function NotebookSliceScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = NOTEBOOK_SCRIPT.scenes[2];
  return <NotebookPage title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", top: 377, left: 149, fontSize: 64, fontFamily: lessonFonts.code, fontWeight: 800 }}>a[1:3]</div>
    <NotebookArray />
    <svg viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <path d="M435 441 L439 698" fill="none" stroke={notebookColors.green} strokeWidth="7" strokeLinecap="round" strokeDasharray="260" strokeDashoffset={interpolate(frame, [20, 47], [260, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <path d="M904 441 L908 698" fill="none" stroke={notebookColors.red} strokeWidth="7" strokeLinecap="round" strokeDasharray="260" strokeDashoffset={interpolate(frame, [53, 80], [260, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <path d="M463 606 Q660 619 847 606" fill="none" stroke={notebookColors.gold} strokeWidth="18" strokeLinecap="round" strokeDasharray="400" strokeDashoffset={interpolate(frame, [92, 130], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </svg>
    <Interactive.Div name="Start boundary included" style={{ position: "absolute", left: 419, top: 703, fontSize: 44, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.green, opacity: interpolate(frame, [35, 50], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>1</Interactive.Div>
    <Interactive.Div name="Stop boundary excluded" style={{ position: "absolute", left: 893, top: 703, fontSize: 44, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.red, opacity: interpolate(frame, [65, 80], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>3</Interactive.Div>
    <Interactive.Div name="Written slice result" style={{ position: "absolute", left: 147, top: 765, fontSize: 64, fontFamily: lessonFonts.code, fontWeight: 800, color: notebookColors.green, translate: interpolate(frame, [132, 155], ["0px 16px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), opacity: interpolate(frame, [132, 155], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>= [7, 9]</Interactive.Div>
  </NotebookPage>;
}
