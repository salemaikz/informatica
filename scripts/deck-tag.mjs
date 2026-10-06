#!/usr/bin/env node
// Тег набора заданий дуэлей (docs/specs/duels.md §2 п. 9): хеш исходников, от которых зависит buildDeck — сам
// src/lib/duel/deck.ts и всё, что он импортирует (банк src/lib/bank/**, генераторы, ГПСЧ, навыки). Файлы находятся
// обходом импортов (кроме `import type`), поэтому новая зависимость банка попадёт в тег сама.
// Из лёгкого каталога (catalog.generated.ts) берутся только «урок → раздел → навыки»: правки текстов уроков тег не меняют.
//
//   node scripts/deck-tag.mjs              — напечатать тег;
//   node scripts/deck-tag.mjs next build   — запустить команду с NEXT_PUBLIC_DECK_TAG=<тег> (шаг сборки, package.json).
// Без тега (next dev, тесты) код берёт "dev".

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DECK_ENTRY = "src/lib/duel/deck.ts";
const CATALOG = "src/content/catalog.generated.ts";
/** Банк целиком (src/lib/bank/**), даже файлы, которые импортируются только как типы. */
const BANK_DIR = "src/lib/bank";

function listTs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? listTs(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
  );
}

const IMPORT_RE = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

function resolveSpec(fromFile, spec, root) {
  let base;
  if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // пакет из node_modules — не наш исходник
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Файлы, от которых зависит набор (пути от корня, через «/», по алфавиту). */
export function deckSources(root = ROOT, read = (p) => readFileSync(p, "utf8")) {
  const seen = new Set();
  const stack = [join(root, DECK_ENTRY), ...listTs(join(root, BANK_DIR))];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (relative(root, file).split(sep).join("/") === CATALOG) continue; // его импорты — только типы
    const src = read(file);
    for (const m of src.matchAll(IMPORT_RE)) {
      if (m[2]) continue; // import type / export type
      const dep = resolveSpec(file, m[3], root);
      if (dep && !seen.has(dep)) stack.push(dep);
    }
  }
  return [...seen].map((f) => relative(root, f).split(sep).join("/")).sort();
}

/** Из каталога — только id урока, раздел и навыки. */
function catalogDigest(src) {
  const rows = [];
  const re = /"id":"([^"]+)","unitId":"([^"]+)"[\s\S]*?"skills":\[([^\]]*)\]/g;
  for (const m of src.matchAll(re)) rows.push(`${m[1]}|${m[2]}|${m[3]}`);
  return rows.sort().join("\n");
}

/** Тег: 10 знаков hex от sha256 по путям и содержимому. */
export function computeDeckTag(root = ROOT, read = (p) => readFileSync(p, "utf8")) {
  const h = createHash("sha256");
  for (const rel of deckSources(root, read)) {
    const src = read(join(root, rel)).replace(/\r\n/g, "\n");
    h.update(`${rel}\n`);
    h.update(rel === CATALOG ? catalogDigest(src) : src);
    h.update("\n\0\n");
  }
  return h.digest("hex").slice(0, 10);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const tag = computeDeckTag();
  const cmd = process.argv.slice(2);
  if (!cmd.length) {
    process.stdout.write(`${tag}\n`);
  } else {
    console.log(`[deck-tag] NEXT_PUBLIC_DECK_TAG=${tag}`);
    const r = spawnSync(cmd[0], cmd.slice(1), {
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_DECK_TAG: tag },
      shell: process.platform === "win32",
    });
    process.exit(r.status ?? 1);
  }
}
