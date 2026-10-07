import { Series, useVideoConfig } from "remotion";
import type { LessonVideoProps } from "./script";
import { DetectiveIndicesScene } from "./detective/DetectiveIndicesScene";
import { DetectiveLastScene } from "./detective/DetectiveLastScene";
import { DetectiveSliceScene } from "./detective/DetectiveSliceScene";
import { DetectiveErrorScene } from "./detective/DetectiveErrorScene";

export function DetectiveLesson({ lang }: LessonVideoProps) {
  const { fps } = useVideoConfig();
  return <Series>
    <Series.Sequence name="Detective · identify the indices" durationInFrames={225} premountFor={fps}><DetectiveIndicesScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Detective · inspect −1" durationInFrames={225} premountFor={fps}><DetectiveLastScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Detective · slice the evidence" durationInFrames={225} premountFor={fps}><DetectiveSliceScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Detective · explain IndexError" durationInFrames={225} premountFor={fps}><DetectiveErrorScene lang={lang} /></Series.Sequence>
  </Series>;
}
