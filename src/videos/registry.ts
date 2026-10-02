import type { ComponentType } from "react";
import type { Lang } from "@/lib/types";
import { BinaryIntro, FPS, SIZE, totalFrames } from "./binary-intro/BinaryIntro";

// Реестр видео уроков: id → Remotion-композиция.
export interface VideoMeta {
  component: ComponentType<{ lang: Lang; subtitles: boolean }>;
  fps: number;
  width: number;
  height: number;
  durationInFrames: (lang: Lang) => number;
}

export const VIDEOS: Record<string, VideoMeta> = {
  "binary-intro": { component: BinaryIntro, fps: FPS, width: SIZE, height: SIZE, durationInFrames: totalFrames },
};
