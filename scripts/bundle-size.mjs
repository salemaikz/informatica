// Вес JS каждой страницы после сборки (этап 16): npm run build && npm run size
// Считает чанки из клиентских манифестов страниц: сырой размер и в сжатом виде (gzip — примерно то, что качает телефон).
// Аргумент --over=1.5 — показать только страницы тяжелее 1,5 МБ (сырой вес).

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const next = join(import.meta.dirname, "..", ".next");
const over = Number(process.argv.find((a) => a.startsWith("--over="))?.slice(7) ?? 0);
const manifests = execSync("find server/app -name page_client-reference-manifest.js", { cwd: next }).toString().trim().split("\n");
const gz = new Map();
const gzOf = (c) => {
  if (!gz.has(c)) {
    try {
      gz.set(c, gzipSync(readFileSync(join(next, "static/chunks", c))).length);
    } catch {
      gz.set(c, 0);
    }
  }
  return gz.get(c);
};

const rows = manifests.map((f) => {
  const chunks = new Set([...readFileSync(join(next, f), "utf8").matchAll(/static\/chunks\/([\w\-.]+\.js)/g)].map((m) => m[1]));
  let raw = 0;
  let zipped = 0;
  for (const c of chunks) {
    try {
      raw += statSync(join(next, "static/chunks", c)).size;
    } catch {
      // чанк из манифеста может отсутствовать — не считаем
    }
    zipped += gzOf(c);
  }
  return { page: f.replace("server/app", "").replace("/page_client-reference-manifest.js", "") || "/", raw, zipped };
});

const mb = (n) => (n / 1e6).toFixed(2).padStart(6);
for (const r of rows.sort((a, b) => b.raw - a.raw)) if (r.raw / 1e6 >= over) console.log(`${mb(r.raw)} МБ  ${mb(r.zipped)} МБ gzip  ${r.page}`);
