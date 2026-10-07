import { Series, useVideoConfig } from "remotion";
import type { LessonVideoProps } from "./script";
import { NotebookIndicesScene } from "./notebook/NotebookIndicesScene";
import { NotebookLastScene } from "./notebook/NotebookLastScene";
import { NotebookSliceScene } from "./notebook/NotebookSliceScene";
import { NotebookErrorScene } from "./notebook/NotebookErrorScene";

export function NotebookLesson({ lang }: LessonVideoProps) {
  const { fps } = useVideoConfig();
  return <Series>
    <Series.Sequence name="Notebook · indices" durationInFrames={225} premountFor={fps}><NotebookIndicesScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Notebook · last item" durationInFrames={225} premountFor={fps}><NotebookLastScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Notebook · slice boundaries" durationInFrames={225} premountFor={fps}><NotebookSliceScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Notebook · correct the error" durationInFrames={225} premountFor={fps}><NotebookErrorScene lang={lang} /></Series.Sequence>
  </Series>;
}
