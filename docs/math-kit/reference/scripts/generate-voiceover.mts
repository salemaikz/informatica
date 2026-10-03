/**
 * Генерация озвучки для видео уроков через OpenAI TTS.
 *
 *   npm run voiceover -- binary-intro
 *   npm run voiceover -- binary-intro --force --only=kk:example,kk:outro   (перегенерировать отдельные сцены)
 *
 * Требует OPENAI_API_KEY в .env.local. Кладёт mp3 в public/media/videos/<id>/<lang>/<scene>.mp3
 * и записывает длительности в src/videos/<id>/durations.json (через ffprobe).
 * Стоимость: ~1 минута аудио на язык ≈ доли цента. Генерировать один раз, результат коммитить.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const root = path.resolve(import.meta.dirname, "..");
const videoId = process.argv[2] ?? "binary-intro";
const force = process.argv.includes("--force");
const only = (process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? []).filter(Boolean);
const shouldRegenerate = (lang: string, id: string) => force && (only.length === 0 || only.includes(`${lang}:${id}`));

// Подхватываем .env.local без зависимостей
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { SCENES } = (await import(path.join(root, `src/videos/${videoId}/script.ts`))) as {
  SCENES: { id: string; narration: { ru: string; kk: string } }[];
};

const client = new OpenAI();
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const VOICE = process.env.OPENAI_TTS_VOICE || "coral";
const INSTRUCTIONS = {
  ru: "Ты дружелюбный учитель информатики для подростков. Говори по-русски живо и тепло, в спокойном темпе, чётко произноси числа.",
  kk: "Сен жасөспірімдерге арналған мейірімді информатика мұғалімісің. Қазақ тілінде анық, жылы, асықпай сөйле, сандарды нақты айт. Speak natural, native Kazakh.",
};

/** Обрезает тишину по краям и сжимает в mono 48 кбит/с — экономия трафика ~2.5×. */
function compress(src: string, dst: string) {
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05";
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", `${trim},areverse,${trim.replace("0.05", "0.25")},areverse`, "-ac", "1", "-b:a", "48k", dst]);
}

const durations: Record<string, Record<string, number>> = {};

for (const lang of ["ru", "kk"] as const) {
  const dir = path.join(root, "public/media/videos", videoId, lang);
  mkdirSync(dir, { recursive: true });
  durations[lang] = {};
  for (const scene of SCENES) {
    const file = path.join(dir, `${scene.id}.mp3`);
    if (shouldRegenerate(lang, scene.id) || !existsSync(file)) {
      const res = await client.audio.speech.create({
        model: MODEL,
        voice: VOICE,
        input: scene.narration[lang],
        instructions: INSTRUCTIONS[lang],
        response_format: "mp3",
      });
      const raw = `${file}.raw.mp3`;
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
      compress(raw, file);
      rmSync(raw);
      console.log(`✓ ${lang}/${scene.id}.mp3`);
    }
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
    durations[lang][scene.id] = Math.round(parseFloat(out) * 100) / 100;
  }
}

const durFile = path.join(root, "src/videos", videoId, "durations.json");
writeFileSync(durFile, JSON.stringify(durations, null, 2) + "\n");
console.log("durations →", path.relative(root, durFile), durations);
