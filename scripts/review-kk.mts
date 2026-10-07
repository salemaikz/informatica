/**
 * Вычитка казахских текстов сильной моделью (замена носителя-редактора, пока его нет).
 *
 *   npm run review:kk            — отчёт в scripts/out/kk-review.json
 *   npm run review:kk -- --apply — сразу применить правки к файлам (dict.ts, уроки, игры)
 *   npm run review:kk -- --scope media — только новые видео и музыка
 *   npm run review:kk -- --scope curriculum — учебные материалы и банк заданий
 *   npm run review:kk -- --scope ui --dry-run — собрать строки без запроса к модели
 *
 * Модель: OPENAI_MODEL_REVIEW (по умолчанию gpt-5.5). Это офлайн-задача разработчика — не для ученика.
 * Scope: all (по умолчанию), media, curriculum, ui. Сохраняет отдельный отчёт каждого scope.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import ts from "typescript";

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
  if (depth > 12 || v === null || typeof v !== "object") return;
  if (isL(v)) {
    out.push({ id: prefix, l: v });
    return;
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) collect(`${prefix}.${k}`, x, out, depth + 1);
}

const pairs: { id: string; l: L }[] = [];
type Scope = "all" | "media" | "curriculum" | "ui";
const args = process.argv.slice(2);
const scopeArgument = args.find((arg) => arg.startsWith("--scope="))?.slice(8) ?? args[args.indexOf("--scope") + 1];
const scope = (args.includes("--scope") || args.some((arg) => arg.startsWith("--scope=")) ? scopeArgument : "all") as Scope;
if (!["all", "media", "curriculum", "ui"].includes(scope)) throw new Error("Scope: all, media, curriculum или ui");
const candidates: [string, string, Exclude<Scope, "all">][] = [
  ["ui", "src/i18n/dict.ts", "ui"],
  ["course", "src/content/course.ts", "curriculum"],
  ["skills", "src/content/skills.ts", "curriculum"],
  ["contexts", "src/content/contexts.ts", "curriculum"],
  ["context", "src/content/context.ts", "curriculum"],
  ["guidance", "src/content/guidance.ts", "curriculum"],
  ["curriculum", "src/content/curriculum.ts", "curriculum"],
  ["gamification", "src/lib/gamification.ts", "ui"],
  ["economy", "src/lib/economy.ts", "ui"],
  ["cosmetics", "src/lib/cosmetics.ts", "ui"],
  ["games", "src/games/registry.ts", "ui"],
  ["music", "src/components/music/strings.ts", "media"],
  ["video-player", "src/videos/player-strings.ts", "media"],
];
for (const f of readdirSync(path.join(root, "src/content/lessons"))) if (/\.(ts|tsx)$/.test(f)) candidates.push([`lesson:${f}`, `src/content/lessons/${f}`, "curriculum"]);
if (existsSync(path.join(root, "src/lib/bank"))) {
  for (const f of readdirSync(path.join(root, "src/lib/bank"))) if (/\.(ts|tsx)$/.test(f)) candidates.push([`bank:${f}`, `src/lib/bank/${f}`, "curriculum"]);
}
for (const d of readdirSync(path.join(root, "src/videos"), { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(path.join(root, "src/videos", d.name, "script.ts"))) candidates.push([`video:${d.name}`, `src/videos/${d.name}/script.ts`, "media"]);
}
// Сценарии новых проб могут лежать внутри отдельных групп.
for (const group of ["lessons", "instagram"]) {
  const file = `src/videos/variants-2026-10-07/${group}/script.ts`;
  if (existsSync(path.join(root, file))) candidates.push([`video:variants-2026-10-07:${group}`, file, "media"]);
}
if (existsSync(path.join(root, "src/games"))) {
  for (const d of readdirSync(path.join(root, "src/games"), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(path.join(root, "src/games", d.name, "strings.ts"))) candidates.push([`game:${d.name}`, `src/games/${d.name}/strings.ts`, "ui"]);
  }
}
const sources = candidates.filter(([, file, group]) => (scope === "all" || group === scope) && existsSync(path.join(root, file)));
for (const [name, file] of sources) {
  const mod = await import(path.join(root, file));
  collect(name, mod, pairs);
  // Функции генераторов и приватные справочники не входят в exports.
  // Читаем также исходные пары и шаблоны; вычисления и код не исполняем.
  const code = readFileSync(path.join(root, file), "utf8");
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const seen = new Set(pairs.filter((pair) => pair.id.startsWith(`${name}.`)).map((pair) => JSON.stringify(pair.l)));
  const value = (node: ts.Expression): string | undefined => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : ts.isTemplateExpression(node) ? node.getText(source).slice(1, -1) : undefined;
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const props = node.properties.filter(ts.isPropertyAssignment);
      const ru = props.find((prop) => prop.name.getText(source).replace(/^["']|["']$/g, "") === "ru");
      const kk = props.find((prop) => prop.name.getText(source).replace(/^["']|["']$/g, "") === "kk");
      const ruText = ru && value(ru.initializer);
      const kkText = kk && value(kk.initializer);
      if (ruText !== undefined && kkText !== undefined) {
        const l = { ru: ruText, kk: kkText };
        if (!seen.has(JSON.stringify(l))) {
          pairs.push({ id: `${name}.source:${node.getStart(source)}`, l });
          seen.add(JSON.stringify(l));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(`Scope ${scope}: ${sources.length} источников, ${pairs.length} строк для вычитки`);
if (args.includes("--dry-run")) process.exit(0);
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY не задан: строки собраны, модельная вычитка не выполнена.");
  process.exit(1);
}

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
Верни только проблемные строки. kk_old — точная копия исходного казахского текста. Не меняй числа, формулы, markdown и фрагменты кода, включая подстановки вида \${...}. Стилистику «на вкус» не трогай.

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
const reportFile = `scripts/out/kk-review${scope === "all" ? "" : `-${scope}`}.json`;
writeFileSync(path.join(root, reportFile), JSON.stringify(fixes, null, 2));
writeFileSync(path.join(root, reportFile.replace(/\.json$/, "-meta.json")), JSON.stringify({ scope, model, sourceCount: sources.length, pairCount: pairs.length, fixCount: fixes.length, usage: res.usage, checkedAt: new Date().toISOString(), reviewedByNativeSpeaker: false }, null, 2));
for (const f of fixes) console.log(`• ${f.id}\n  было:  ${f.kk_old}\n  стало: ${f.kk_new}\n  почему: ${f.why}`);

if (process.argv.includes("--apply")) {
  let applied = 0;
  for (const f of fixes) {
    const source = sources.find(([prefix]) => f.id.startsWith(`${prefix}.`));
    const original = pairs.find((pair) => pair.id === f.id);
    if (!source || original?.l.kk !== f.kk_old) continue;
    for (const file of [source[1]]) {
      const p = path.join(root, file);
      const src = readFileSync(p, "utf8");
      const ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
      let literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined;
      const find = (node: ts.Node) => {
        if (literal) return;
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === f.kk_old && ts.isPropertyAssignment(node.parent) && node.parent.name.getText(ast).replace(/^["']|["']$/g, "") === "kk") literal = node;
        ts.forEachChild(node, find);
      };
      find(ast);
      if (literal) {
        // Заменяем весь литерал корректно экранированной строкой. Шаблоны — вручную.
        writeFileSync(p, `${src.slice(0, literal.getStart(ast))}${JSON.stringify(f.kk_new)}${src.slice(literal.end)}`);
        applied++;
        break;
      }
    }
  }
  console.log(`Применено: ${applied}/${fixes.length} (остальные — вручную, см. ${reportFile})`);
}
