import stories from "./stories.json";
import durations from "./durations.json";
import type { Variant } from "./registry";

// Для проб без голоса оставляем время на чтение и самостоятельный ответ.
const silentSeconds: Partial<Record<Variant, number[]>> = {
  "binary-encode": [5, 8, 6, 7, 6, 6, 8],
  "binary-decode": [5, 8, 6, 6, 6, 7, 8],
  "bit-detective": [5, 7, 8, 8, 8, 10, 10, 8],
  "bit-bakery": [6, 7, 8, 8, 9, 8, 6, 8],
  "bit-phone": [6, 7, 8, 5, 9, 12, 9, 8, 8, 6, 8],
  "bit-counter": [6, 7, 8, 5, 9, 12, 9, 8, 8, 6, 8],
};
export const isSilent = (variant: Variant) => variant in silentSeconds;

export function timeline(variant: Variant) {
  const table = durations as Partial<Record<Variant, number[]>>;
  let from = 0;
  return stories[variant].map((text, index) => {
    const frames = Math.ceil(((table[variant]?.[index] ?? silentSeconds[variant]?.[index] ?? 6) + .4) * 30);
    const beat = { text, from, frames, index, hasAudio: !isSilent(variant) && Boolean(table[variant]?.[index]) };
    from += frames;
    return beat;
  });
}
export const durationFor = (variant: Variant) => timeline(variant).reduce((sum, beat) => sum + beat.frames, 0);
export function storyFrame(frame: number, variant: Variant) {
  const beat = timeline(variant).find((item) => frame < item.from + item.frames) ?? timeline(variant).at(-1)!;
  return beat.index * 180 + Math.min(179, (frame - beat.from) / beat.frames * 180);
}
