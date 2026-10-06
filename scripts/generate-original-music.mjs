// Две собственные мелодии; детерминированный синтез без записей, моделей и лицензий третьих лиц.
// Запуск: node scripts/generate-original-music.mjs — синтез во временный WAV, затем ffmpeg кодирует в .ogg и .m4a (~64 кбит/с);
// WAV в репозиторий не кладём. Файлы: public/media/music/<имя>.ogg и <имя>.m4a.
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const rate = 22050;
const outDir = resolve(import.meta.dirname, "../public/media/music");
mkdirSync(outDir, { recursive: true });
const directory = mkdtempSync(resolve(tmpdir(), "informatica-music-"));
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
let randomState = 61906;
const random = () => { randomState = (1664525 * randomState + 1013904223) >>> 0; return randomState / 4294967296 * 2 - 1; };

function make(name, bpm, kind) {
  const beat = 60 / bpm;
  const samples = Math.round(rate * beat * 32);
  const mix = new Float64Array(samples);
  function add(at, seconds, level, wave, attack = .008, release = .08) {
    const count = Math.ceil(seconds * rate);
    for (let i = 0; i < count; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / attack, Math.max(0, (seconds - t) / release));
      const index = ((Math.round(at * rate) + i) % samples + samples) % samples;
      mix[index] += wave(t) * envelope * level;
    }
  }
  function note(at, midi, seconds, level, timbre) {
    const f = frequency(midi);
    add(at, seconds, level, (t) => {
      const base = Math.sin(2 * Math.PI * f * t);
      return timbre === "pluck" ? (base + .22 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-5 * t / seconds)
        : timbre === "bass" ? base + .1 * Math.sin(6 * Math.PI * f * t)
          : base + .12 * Math.sin(4 * Math.PI * f * t);
    }, timbre === "pad" ? .12 : .007, timbre === "pad" ? .45 : .05);
  }
  const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]];
  const lead = kind === "game" ? [0, 2, 1, 3, 2, 1, 3, 2] : [0, 2, 3, 1];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4];
    const start = bar * 4 * beat;
    chord.forEach((midi) => note(start, midi, 4.15 * beat, kind === "game" ? .017 : .033, "pad"));
    note(start, chord[0] - 24, 1.7 * beat, .057, "bass");
    note(start + 2 * beat, chord[0] - 24, 1.6 * beat, .043, "bass");
    lead.forEach((degree, i) => note(start + i * (kind === "game" ? .5 : 1) * beat, chord[degree] + 12, kind === "game" ? .8 * beat : 1.3 * beat, kind === "game" ? .072 : .024, "pluck"));
    for (let b = 0; b < 4; b++) {
      if (kind === "game" || b === 0) add(start + b * beat, .14, kind === "game" ? .11 : .045, (t) => Math.sin(2 * Math.PI * (52 * t + 5 * (1 - Math.exp(-35 * t)))) * Math.exp(-24 * t), .003, .045);
      if (kind === "game") {
        add(start + (b + .5) * beat, .06, .028, () => random(), .002, .035);
        if (b % 2 === 1) add(start + b * beat, .1, .048, (t) => random() * Math.exp(-35 * t), .002, .06);
      }
    }
  }
  const peak = Math.max(...Array.from({ length: 150 }, (_, i) => Math.max(...mix.subarray(i * Math.ceil(samples / 150), Math.min(samples, (i + 1) * Math.ceil(samples / 150))).map(Math.abs))));
  const gain = Math.min(1, .38 / peak);
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767), 44 + i * 2);
  writeFileSync(resolve(directory, `${name}.wav`), data);
  console.log(`${name}: ${(samples / rate).toFixed(3)} sec, ${data.length} bytes, peak ${(peak * gain).toFixed(3)}`);
}
make("bit-arcade", 112, "game");
make("quiet-focus", 80, "focus");

for (const name of ["bit-arcade", "quiet-focus"]) {
  const wav = resolve(directory, `${name}.wav`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-b:a", "64k", resolve(outDir, `${name}.ogg`)]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", resolve(outDir, `${name}.m4a`)]);
}
rmSync(directory, { recursive: true, force: true });
