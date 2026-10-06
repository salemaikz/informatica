// Бесплатная черновая озвучка локальным голосом macOS. Не использует API.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const stories = JSON.parse(readFileSync(path.join(root, "src/videos/lab/stories.json"), "utf8"));
const durationFile = path.join(root, "src/videos/lab/durations.json");
const durations = existsSync(durationFile) ? JSON.parse(readFileSync(durationFile, "utf8")) : {};
const only = process.argv.slice(2);
const rate = process.env.LAB_VOICE_RATE ?? "170";
for (const [variant, lines] of Object.entries(stories)) {
  // These two previews deliberately use persistent on-screen explanations.
  if (["binary-encode", "binary-decode", "bit-phone", "bit-counter", "bit-detective", "bit-bakery"].includes(variant)) continue;
  const dir = path.join(root, "public/media/videos/lab/voice", variant);
  mkdirSync(dir, { recursive: true });
  durations[variant] ??= [];
  for (const [index, line] of lines.entries()) {
    if (only.length && !only.includes(`${variant}:${index}`)) continue;
    const raw = path.join(dir, `${index}.aiff`);
    const mp3 = path.join(dir, `${index}.mp3`);
    execFileSync("say", ["-v", "Milena", "-r", rate, "-o", raw, line]);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-ac", "1", "-b:a", "48k", mp3]);
    durations[variant][index] = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim());
    rmSync(raw);
  }
  console.log(`Озвучено: ${variant}`);
}
writeFileSync(durationFile, JSON.stringify(durations, null, 2) + "\n");
