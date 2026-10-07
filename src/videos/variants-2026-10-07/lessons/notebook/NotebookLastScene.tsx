import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { NOTEBOOK_SCRIPT, type LessonVideoProps } from "../script";
import { lessonFonts } from "../typography";
import { NotebookArray, NotebookPage, notebookColors } from "./NotebookPage";

export function NotebookLastScene({ lang }: LessonVideoProps) {
  const frame = useCurrentFrame(); const copy = NOTEBOOK_SCRIPT.scenes[1];
  return <NotebookPage title={copy.title[lang]} caption={copy.caption[lang]}>
    <div style={{ position: "absolute", top: 378, left: 149, fontSize: 60, fontFamily: lessonFonts.code, fontWeight: 800 }}>a =</div>
    <NotebookArray selected={2} negative={frame >= 58} />
    <svg viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0 }} aria-hidden="true"><path d="M950 692 C950 735 796 744 777 686" fill="none" stroke={notebookColors.blue} strokeWidth="8" strokeLinecap="round" strokeDasharray="300" strokeDashoffset={interpolate(frame, [18, 60], [300, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} /><path d="M762 698 L777 680 L795 694" fill="none" stroke={notebookColors.blue} strokeWidth="7" opacity={interpolate(frame, [55,65], [0,1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} /></svg>
    <Interactive.Div name="Positive and negative equivalence" style={{ position: "absolute", top: 754, left: 147, fontFamily: lessonFonts.code, fontSize: 62, fontWeight: 800, color: notebookColors.green, opacity: interpolate(frame, [105, 128], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>a[2] = a[-1] = 9</Interactive.Div>
  </NotebookPage>;
}
