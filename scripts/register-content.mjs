// Подключает новые уроки, банки заданий и задания ЕНТ: node scripts/register-content.mjs
// Ищет файлы с нужными экспортами и пишет три реестра (их не правят руками):
//   src/content/lessons/generated.ts  — export const lesson     (src/content/lessons/<id>.ts)
//   src/lib/bank/generated.ts         — export const BANKS      (src/lib/bank/<id>.ts)
//   src/content/ent/generated.ts      — export const ITEMS      (src/content/ent/<id>.ts)
// Аргументы: --only=id1,id2 — подключить только эти уроки (остальные новые — пропустить);
//            --add=id1,id2 — добавить эти уроки к уже подключённым (недописанные файлы других авторов не трогать).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
// --add=id1,id2 — подключить эти уроки В ДОПОЛНЕНИЕ к уже подключённым (остальные новые файлы — пропустить).
const add = process.argv.find((a) => a.startsWith("--add="))?.slice(6).split(",").filter(Boolean);

/** id, которые уже подключены в generated.ts папки (import … from "./<id>"). */
function registered(dir) {
  try {
    return [...readFileSync(join(root, dir, "generated.ts"), "utf8").matchAll(/from "\.\/([^"]+)";/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

function scan(dir, exportName, skip) {
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".ts") && !skip.includes(f) && f !== "generated.ts")
    .map((f) => f.slice(0, -3))
    .filter((id) => new RegExp(`export const ${exportName}\\b`).test(readFileSync(join(root, dir, `${id}.ts`), "utf8")))
    .filter((id) => !only || only.includes(id) || id === "ns")
    .filter((id) => !add || add.includes(id) || registered(dir).includes(id))
    .sort();
}

const alias = (id) => id.replace(/[^a-zA-Z0-9]/g, "_");
const header = "// Сгенерировано scripts/register-content.mjs — не править руками.\n";

function write(file, ids, exportName, type, typeImport, outName) {
  const lines = [header, `import type { ${type} } from "${typeImport}";`];
  for (const id of ids) lines.push(`import { ${exportName} as ${alias(id)} } from "./${id}";`);
  const value = exportName === "lesson" ? ids.map(alias).join(", ") : ids.map((id) => `...${alias(id)}`).join(", ");
  lines.push("", `export const ${outName}: ${type}[] = [${value}];`, "");
  writeFileSync(join(root, file), lines.join("\n"));
}

const lessons = scan("src/content/lessons", "lesson", []);
const banks = scan("src/lib/bank", "BANKS", ["index.ts", "pool.ts", "types.ts"]);
const ent = scan("src/content/ent", "ITEMS", ["index.ts"]);

write("src/content/lessons/generated.ts", lessons, "lesson", "Lesson", "@/lib/types", "GENERATED_LESSONS");
write("src/lib/bank/generated.ts", banks, "BANKS", "SkillBank", "./types", "GENERATED_BANKS");
write("src/content/ent/generated.ts", ent, "ITEMS", "EntItem", "@/lib/types", "GENERATED_ENT");
console.log(`уроков: ${lessons.length}, банков: ${banks.length}, файлов ЕНТ: ${ent.length}`);
