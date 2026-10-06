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
  ["skills", "src/content/skills.ts", "curriculum"],
  ["course-map", "src/content/course-map.ts", "curriculum"],
  ["school-program", "src/content/school-program.ts", "curriculum"],
  ["ent-topics", "src/content/ent-topics.ts", "curriculum"],
  ["groups", "src/content/groups.ts", "curriculum"],
  ["legal", "src/content/legal.ts", "ui"],
  ["conspects", "src/content/conspects.generated.ts", "curriculum"],
  ["cloze-bank", "src/lib/cloze-bank.ts", "curriculum"],
  ["gamification", "src/lib/gamification.ts", "ui"],
  ["economy", "src/lib/economy.ts", "ui"],
  ["cosmetics", "src/lib/cosmetics.ts", "ui"],
  ["reminder-texts", "src/lib/reminder-texts.ts", "ui"],
  ["games", "src/games/registry.ts", "ui"],
  // Медиа (видео, музыка) в дереве v0.18 пока нет: пути ниже подхватятся, когда появятся.
  ["music", "src/components/music/strings.ts", "media"],
  ["video-player", "src/videos/player-strings.ts", "media"],
];
// Порядок важен: сначала листовые файлы, агрегаторы (реэкспорт чужих строк) — в самом конце; пары дедуплицируются глобально.
if (existsSync(path.join(root, "src/i18n/parts"))) {
  for (const f of readdirSync(path.join(root, "src/i18n/parts"))) if (/\.ts$/.test(f)) candidates.push([`ui-part:${f}`, `src/i18n/parts/${f}`, "ui"]);
}
const AGGREGATORS = new Set(["lessons/all.ts", "lessons/generated.ts", "ent/index.ts", "ent/generated.ts"]);
for (const f of existsSync(path.join(root, "src/content/lessons")) ? readdirSync(path.join(root, "src/content/lessons")) : []) if (/\.(ts|tsx)$/.test(f) && !AGGREGATORS.has(`lessons/${f}`)) candidates.push([`lesson:${f}`, `src/content/lessons/${f}`, "curriculum"]);
if (existsSync(path.join(root, "src/content/ent"))) {
  for (const f of readdirSync(path.join(root, "src/content/ent"))) if (/\.(ts|tsx)$/.test(f) && !AGGREGATORS.has(`ent/${f}`)) candidates.push([`ent:${f}`, `src/content/ent/${f}`, "curriculum"]);
}
if (existsSync(path.join(root, "src/lib/bank"))) {
  for (const f of readdirSync(path.join(root, "src/lib/bank"))) if (/\.(ts|tsx)$/.test(f)) candidates.push([`bank:${f}`, `src/lib/bank/${f}`, "curriculum"]);
}
for (const d of existsSync(path.join(root, "src/videos")) ? readdirSync(path.join(root, "src/videos"), { withFileTypes: true }) : []) {
  if (d.isDirectory() && existsSync(path.join(root, "src/videos", d.name, "script.ts"))) candidates.push([`video:${d.name}`, `src/videos/${d.name}/script.ts`, "media"]);
}
if (existsSync(path.join(root, "src/games"))) {
  for (const d of readdirSync(path.join(root, "src/games"), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(path.join(root, "src/games", d.name, "strings.ts"))) candidates.push([`game:${d.name}`, `src/games/${d.name}/strings.ts`, "ui"]);
  }
}
// Агрегаторы — последними: их строки уже собраны из листовых файлов.
candidates.push(
  ["lesson:aggregators", "src/content/lessons/all.ts", "curriculum"],
  ["lesson:generated", "src/content/lessons/generated.ts", "curriculum"],
  ["ent:index", "src/content/ent/index.ts", "curriculum"],
  ["ent:generated", "src/content/ent/generated.ts", "curriculum"],
  ["course", "src/content/course.ts", "curriculum"],
  ["ui", "src/i18n/dict.ts", "ui"],
);
const sources = candidates.filter(([, file, group]) => (scope === "all" || group === scope) && existsSync(path.join(root, file)));
const globalSeen = new Set<string>();
const keyOf = (l: L) => `${l.ru}\u0000${l.kk}`;
for (const [name, file] of sources) {
  const mod = await import(path.join(root, file));
  const fromExports: { id: string; l: L }[] = [];
  collect(name, mod, fromExports);
  for (const pair of fromExports) {
    if (globalSeen.has(keyOf(pair.l))) continue;
    globalSeen.add(keyOf(pair.l));
    pairs.push(pair);
  }
  // Функции генераторов и приватные справочники не входят в exports.
  // Читаем также исходные пары и шаблоны; вычисления и код не исполняем.
  const code = readFileSync(path.join(root, file), "utf8");
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const value = (node: ts.Expression): string | undefined => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : ts.isTemplateExpression(node) ? node.getText(source).slice(1, -1) : undefined;
  const add = (node: ts.Node, l: L) => {
    if (globalSeen.has(keyOf(l))) return;
    globalSeen.add(keyOf(l));
    pairs.push({ id: `${name}.source:${node.getStart(source)}`, l });
  };
  function visit(node: ts.Node) {
    // Генераторы банка: l("ru", "kk") внутри функций.
    if (ts.isCallExpression(node) && node.expression.getText(source) === "l" && node.arguments.length >= 2) {
      const ruText = value(node.arguments[0]);
      const kkText = value(node.arguments[1]);
      if (ruText !== undefined && kkText !== undefined) add(node, { ru: ruText, kk: kkText });
    }
    if (ts.isObjectLiteralExpression(node)) {
      const props = node.properties.filter(ts.isPropertyAssignment);
      const ru = props.find((prop) => prop.name.getText(source).replace(/^["']|["']$/g, "") === "ru");
      const kk = props.find((prop) => prop.name.getText(source).replace(/^["']|["']$/g, "") === "kk");
      const ruText = ru && value(ru.initializer);
      const kkText = kk && value(kk.initializer);
      if (ruText !== undefined && kkText !== undefined) {
        add(node, { ru: ruText, kk: kkText });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const CHUNK = 1500;
const chunkCount = Math.ceil(pairs.length / CHUNK);
console.log(`Scope ${scope}: ${sources.length} источников, ${pairs.length} уникальных строк для вычитки, запросов: ${chunkCount} (по ${CHUNK})`);
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

const header = `Ты — редактор-носитель казахского языка и учитель информатики в казахстанской школе. Ниже строки образовательного приложения для подготовки к ҰБТ: id, русский оригинал, казахский перевод.
Найди в казахских переводах: грамматические и орфографические ошибки, неестественные кальки с русского, неверные термины информатики (как в казахстанских учебниках), расхождения по смыслу с русским.
Верни только проблемные строки. kk_old — точная копия исходного казахского текста. Не меняй числа, формулы, markdown и фрагменты кода, включая подстановки вида \${...}. Стилистику «на вкус» не трогай.

`;
type Fix = { id: string; kk_old: string; kk_new: string; why: string };
const fixes: Fix[] = [];
const usage = { prompt_tokens: 0, completion_tokens: 0 };
for (let i = 0; i < pairs.length; i += CHUNK) {
  const chunk = pairs.slice(i, i + CHUNK);
  const prompt = header + chunk.map((p) => `${p.id}\tRU: ${p.l.ru.replace(/\n/g, "⏎")}\tKK: ${p.l.kk.replace(/\n/g, "⏎")}`).join("\n");
  const res = await client.chat.completions.create({
    model,
    reasoning_effort: "medium",
    response_format: { type: "json_schema", json_schema: { name: "kk_review", strict: true, schema: SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  usage.prompt_tokens += res.usage?.prompt_tokens ?? 0;
  usage.completion_tokens += res.usage?.completion_tokens ?? 0;
  const part = (JSON.parse(res.choices[0]?.message?.content ?? "{}") as { fixes?: Fix[] }).fixes ?? [];
  for (const f of part) fixes.push({ ...f, kk_old: f.kk_old.replace(/⏎/g, "\n"), kk_new: f.kk_new.replace(/⏎/g, "\n") });
  console.log(`Запрос ${i / CHUNK + 1}/${chunkCount}: правок ${part.length}`);
}
console.log(`Модель ${model}: правок ${fixes.length}, токены ${usage.prompt_tokens}/${usage.completion_tokens}`);
mkdirSync(path.join(root, "scripts/out"), { recursive: true });
const reportFile = `scripts/out/kk-review${scope === "all" ? "" : `-${scope}`}.json`;
writeFileSync(path.join(root, reportFile), JSON.stringify(fixes, null, 2));
writeFileSync(path.join(root, reportFile.replace(/\.json$/, "-meta.json")), JSON.stringify({ scope, model, sourceCount: sources.length, pairCount: pairs.length, chunkCount, fixCount: fixes.length, usage, checkedAt: new Date().toISOString(), reviewedByNativeSpeaker: false }, null, 2));
for (const f of fixes) console.log(`• ${f.id}\n  было:  ${f.kk_old}\n  стало: ${f.kk_new}\n  почему: ${f.why}`);

if (process.argv.includes("--apply")) {
  // Ищем kk-литерал (свойство kk или 2-й аргумент l()) во всех собранных файлах; ru рядом должен совпасть.
  const files = [...new Set(sources.map(([, file]) => file))];
  const asts = new Map(files.map((file) => [file, { src: readFileSync(path.join(root, file), "utf8"), edits: [] as { start: number; end: number; text: string }[] }]));
  const strText = (n: ts.Node): string | undefined => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : undefined);
  const propName = (p: ts.PropertyAssignment, ast: ts.SourceFile) => p.name.getText(ast).replace(/^["']|["']$/g, "");
  let applied = 0;
  const notFound: string[] = [];
  for (const f of fixes) {
    const original = pairs.find((pair) => pair.id === f.id);
    if (original?.l.kk !== f.kk_old) {
      notFound.push(f.id);
      continue;
    }
    let hits = 0;
    for (const file of files) {
      const entry = asts.get(file)!;
      const ast = ts.createSourceFile(file, entry.src, ts.ScriptTarget.Latest, true);
      const find = (node: ts.Node) => {
        let kkNode: ts.Node | undefined;
        let ruText: string | undefined;
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const parent = node.parent;
          if (ts.isPropertyAssignment(parent) && parent.initializer === node && propName(parent, ast) === "kk") {
            kkNode = node;
            const ru = (parent.parent as ts.ObjectLiteralExpression).properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propName(p, ast) === "ru");
            ruText = ru && strText(ru.initializer);
          } else if (ts.isCallExpression(parent) && parent.expression.getText(ast) === "l" && parent.arguments[1] === node) {
            kkNode = node;
            ruText = strText(parent.arguments[0]);
          }
        }
        if (kkNode && (kkNode as ts.StringLiteral).text === f.kk_old && ruText === original.l.ru) {
          entry.edits.push({ start: kkNode.getStart(ast), end: kkNode.end, text: JSON.stringify(f.kk_new) });
          hits++;
        }
        ts.forEachChild(node, find);
      };
      find(ast);
    }
    if (hits > 0) applied++;
    else notFound.push(f.id);
  }
  for (const [file, { src, edits }] of asts) {
    if (!edits.length) continue;
    // Правки с конца файла, чтобы смещения не поплыли; одинаковые позиции не дублируем.
    const uniq = [...new Map(edits.map((e) => [e.start, e])).values()].sort((a, b) => b.start - a.start);
    let out = src;
    for (const e of uniq) out = `${out.slice(0, e.start)}${e.text}${out.slice(e.end)}`;
    writeFileSync(path.join(root, file), out);
  }
  console.log(`Применено: ${applied}/${fixes.length} (остальные — вручную, см. ${reportFile})`);
  if (notFound.length) console.log(`Не найдены в исходниках (шаблоны, вычисляемые строки или изменённый ru):\n  ${notFound.join("\n  ")}`);
}
