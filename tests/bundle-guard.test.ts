import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Сторож скорости (этап 16): клиентские модули не должны статически импортировать содержимое всех уроков,
// банки навыков и банк ЕНТ (~20 МБ JS) — так случился регресс этапа 12 («Профиль» грузил весь курс).
// Лёгкие замены: @/content/catalog, @/content/course-map, @/lib/drill-meta, @/lib/course-mix-meta, @/lib/ent-ref.
// Тяжёлое — только там, где содержимое действительно нужно, и грузится по требованию (next/dynamic, import()).

const ROOT = join(import.meta.dirname, "..");
const HEAVY = [
  "src/content/course.ts",
  "src/lib/bank/index.ts",
  "src/content/ent/index.ts",
  "src/content/lessons/all.ts",
  "src/content/lessons/generated.ts",
  "src/content/conspects.generated.ts",
];

/** Клиентские модули, которым содержимое нужно по смыслу. Новый — только осознанно и с ленивой загрузкой. */
const HEAVY_CLIENT_OK = new Set([
  "src/app/drill/DrillScreen.tsx", // тренировка собирает задания из банков (следующий шаг этапа 16 — банки по навыкам)
  "src/components/exam/ExamRun.tsx", // пробный ЕНТ собирает вариант из банка ЕНТ
  "src/components/ide/ContextHub.tsx", // список контекстных заданий из банка ЕНТ
  "src/components/chat/quiz/ChatQuiz.tsx", // «Дай задачи» в чате — next/dynamic в ChatScreen
  // Игры грузятся реестром по требованию (games/registry.ts)
  "src/games/memo/Game.tsx",
  "src/games/bingo/Game.tsx",
  "src/games/bet/Game.tsx",
  "src/games/cipher/Game.tsx",
  "src/games/truth/Game.tsx",
  "src/games/tower/Game.tsx",
  "src/games/build/Game.tsx",
  "src/games/boss/Game.tsx",
]);

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(name) ? [rel] : [];
  });
}

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return relative(ROOT, abs);
  }
  return null;
}

/** Статические импорты значений (import type и «только типы» не попадают в сборку). */
function deps(file: string): string[] {
  const src = readFileSync(join(ROOT, file), "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/^(?:import|export)\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)";/gm)) {
    if (m[1]) continue;
    const names = m[2].trim();
    if (/^\{[^}]*\}$/.test(names)) {
      const parts = names.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
      if (parts.length && parts.every((p) => p.startsWith("type "))) continue;
    }
    const r = resolve(file, m[3]);
    if (r) out.push(r);
  }
  return out;
}

/** Путь импортов от модуля до тяжёлого или null. */
function heavyPath(start: string): string[] | null {
  const prev = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const f = queue.shift()!;
    for (const d of deps(f)) {
      if (prev.has(d)) continue;
      prev.set(d, f);
      if (HEAVY.includes(d)) {
        const chain = [d];
        for (let x = prev.get(d); x; x = prev.get(x)) chain.unshift(x);
        return chain;
      }
      queue.push(d);
    }
  }
  return null;
}

const clientFiles = walk("src").filter((f) => /^\s*["']use client["']/.test(readFileSync(join(ROOT, f), "utf8")));

describe("сторож скорости: клиентские модули без всего курса", () => {
  it("клиентских модулей много (сторож что-то проверяет)", () => {
    expect(clientFiles.length).toBeGreaterThan(100);
  });

  it("тяжёлые модули — только у разрешённых", () => {
    const bad = clientFiles
      .filter((f) => !HEAVY_CLIENT_OK.has(f))
      .map((f) => heavyPath(f))
      .filter((chain): chain is string[] => !!chain)
      .map((chain) => chain.join(" → "));
    expect(bad, "клиентский модуль тянет весь курс — замени импорт на лёгкий (см. комментарий вверху файла)").toEqual([]);
  });

  it("список разрешённых не устарел", () => {
    for (const f of HEAVY_CLIENT_OK) expect(heavyPath(f), `${f} больше не тяжёлый — убери из списка`).not.toBeNull();
  });
});
