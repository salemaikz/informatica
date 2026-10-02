import stories from "./stories.json";
import durations from "./durations.json";
import type { Variant } from "./registry";

export function timeline(variant: Variant) {
  const table = durations as Partial<Record<Variant, number[]>>;
  let from = 0;
  return stories[variant].map((text, index) => {
    const frames = Math.ceil(((table[variant]?.[index] ?? 6) + .4) * 30);
    const beat = { text, from, frames, index, hasAudio: Boolean(table[variant]?.[index]) };
    from += frames;
    return beat;
  });
}
export const durationFor = (variant: Variant) => timeline(variant).reduce((sum, beat) => sum + beat.frames, 0);
export function storyFrame(frame: number, variant: Variant) {
  const beat = timeline(variant).find((item) => frame < item.from + item.frames) ?? timeline(variant).at(-1)!;
  return beat.index * 180 + Math.min(179, (frame - beat.from) / beat.frames * 180);
}
