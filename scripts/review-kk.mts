/**
 * Вычитка казахских текстов сильной моделью (замена носителя-редактора, пока его нет).
 *
 *   npm run review:kk            — отчёт в scripts/out/kk-review.json
 *   npm run review:kk -- --apply — сразу применить правки к файлам (dict.ts, уроки, игры)
 *
 * Модель: OPENAI_MODEL_REVIEW (по умолчанию gpt-5.5). Это офлайн-задача разработчика — не для ученика.
 * Собирает пары ru/kk из: словаря интерфейса, уроков, навыков, курса, достижений, сценариев видео, строк мини-игр.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const root = path.resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type L = { ru: string; kk: string };
const isL = (v: unknown): v is L => !!v && typeof v === "object" && typeof (v as L).ru === "string" && typeof (v as L).kk === "string";

/** Рекурсивно собирает все {ru, kk} из объекта. */
function collect(prefix: string, v: unknown, out: { id: string; l: L }[], depth = 0) {
  if (depth > 6 || v === null || typeof v !== "object") return;
  if (isL(v)) {
    out.push({ id: prefix, l: v });
    return;
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) collect(`${prefix}.${k}`, x, out, depth + 1);
}

const pairs: { id: string; l: L }[] = [];
const sources: [string, string][] = [
  ["ui", "src/i18n/dict.ts"],
  ["course", "src/content/course.ts"],
  ["skills", "src/content/skills.ts"],
  ["gamification", "src/lib/gamification.ts"],
  ["games", "src/games/registry.ts"],
];
for (const f of readdirSync(path.join(root, "src/content/lessons"))) sources.push([`lesson:${f}`, `src/content/lessons/${f}`]);
for (const d of readdirSync(path.join(root, "src/videos"), { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(path.join(root, "src/videos", d.name, "script.ts"))) sources.push([`video:${d.name}`, `src/videos/${d.name}/script.ts`]);
}
if (existsSync(path.join(root, "src/games"))) {
  for (const d of readdirSync(path.join(root, "src/games"), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(path.join(root, "src/games", d.name, "strings.ts"))) sources.push([`game:${d.name}`, `src/games/${d.name}/strings.ts`]);
  }
}
for (const [name, file] of sources) {
  const mod = await import(path.join(root, file));
  collect(name, mod, pairs);
}
console.log(`Строк для вычитки: ${pairs.length}`);

const client = new OpenAI();
const model = process.env.OPENAI_MODEL_REVIEW || "gpt-5.5";
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixes"],
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kk_old", "kk_new", "why"],
        properties: { id: { type: "string" }, kk_old: { type: "string" }, kk_new: { type: "string" }, why: { type: "string" } },
      },
    },
  },
} as const;

const prompt = `Ты — редактор-носитель казахского языка и учитель информатики в казахстанской школе. Ниже строки образовательного приложения для подготовки к ҰБТ: id, русский оригинал, казахский перевод.
Найди в казахских переводах: грамматические и орфографические ошибки, неестественные кальки с русского, неверные термины информатики (как в казахстанских учебниках), расхождения по смыслу с русским.
Верни только проблемные строки. kk_old — точная копия исходного казахского текста. Не меняй числа, формулы, markdown. Стилистику «на вкус» не трогай.

${pairs.map((p) => `${p.id}\tRU: ${p.l.ru.replace(/\n/g, "⏎")}\tKK: ${p.l.kk.replace(/\n/g, "⏎")}`).join("\n")}`;

const res = await client.chat.completions.create({
  model,
  reasoning_effort: "medium",
  response_format: { type: "json_schema", json_schema: { name: "kk_review", strict: true, schema: SCHEMA } },
  messages: [{ role: "user", content: prompt }],
});
const fixes = (JSON.parse(res.choices[0]?.message?.content ?? "{}") as { fixes: { id: string; kk_old: string; kk_new: string; why: string }[] }).fixes.map((f) => ({
  ...f,
  kk_old: f.kk_old.replace(/⏎/g, "\n"),
  kk_new: f.kk_new.replace(/⏎/g, "\n"),
}));
console.log(`Модель ${model}: правок ${fixes.length}, токены ${res.usage?.prompt_tokens}/${res.usage?.completion_tokens}`);
mkdirSync(path.join(root, "scripts/out"), { recursive: true });
writeFileSync(path.join(root, "scripts/out/kk-review.json"), JSON.stringify(fixes, null, 2));
for (const f of fixes) console.log(`• ${f.id}\n  было:  ${f.kk_old}\n  стало: ${f.kk_new}\n  почему: ${f.why}`);

if (process.argv.includes("--apply")) {
  let applied = 0;
  const files = sources.map(([, f]) => f);
  for (const f of fixes) {
    for (const file of files) {
      const p = path.join(root, file);
      const src = readFileSync(p, "utf8");
      const needle = JSON.stringify(f.kk_old).slice(1, -1);
      if (src.includes(needle)) {
        writeFileSync(p, src.replace(needle, JSON.stringify(f.kk_new).slice(1, -1)));
        applied++;
        break;
      }
    }
  }
  console.log(`Применено: ${applied}/${fixes.length} (остальные — вручную, см. scripts/out/kk-review.json)`);
}
