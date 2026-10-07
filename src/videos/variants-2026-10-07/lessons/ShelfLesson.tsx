import { Series, useVideoConfig } from "remotion";
import type { LessonVideoProps } from "./script";
import { ShelfIndicesScene } from "./shelf/ShelfIndicesScene";
import { ShelfLastScene } from "./shelf/ShelfLastScene";
import { ShelfSliceScene } from "./shelf/ShelfSliceScene";
import { ShelfErrorScene } from "./shelf/ShelfErrorScene";

export function ShelfLesson({ lang }: LessonVideoProps) {
  const { fps } = useVideoConfig();
  return <Series>
    <Series.Sequence name="Shelf · indices 0, 1, 2" durationInFrames={225} premountFor={fps}><ShelfIndicesScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Shelf · last item −1" durationInFrames={225} premountFor={fps}><ShelfLastScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Shelf · slice 1:3" durationInFrames={225} premountFor={fps}><ShelfSliceScene lang={lang} /></Series.Sequence>
    <Series.Sequence name="Shelf · IndexError" durationInFrames={225} premountFor={fps}><ShelfErrorScene lang={lang} /></Series.Sequence>
  </Series>;
}
