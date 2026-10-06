import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Ревью v18b: в светлой теме ink-warning был 2,8:1 к своей -soft-заливке. Токены ink-* исправлены (≥ 4,5:1), но текст на -soft-заливке в сценах
// должен брать именно их: связка «bg-*-soft + text-primary|success|warning|danger|ai(-strong)» в одной строке — ошибка.

const ROOT = join(process.cwd(), "src/components/scenes");
const SKIP = ["samples", "quest", "hardware", "pc-inside-art.tsx"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(name) ? [p] : [];
  });
}

describe("сцены: текст на -soft-заливке — токены ink-*", () => {
  it("в одной строке с bg-*-soft нет text-primary|success|warning|danger|ai (в том числе -strong)", () => {
    const bad: string[] = [];
    for (const f of files(ROOT)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/\bbg-(primary|success|warning|danger|ai|gold)-soft\b/.test(line) && /\btext-(primary|success|warning|danger|ai)(-strong)?\b/.test(line)) bad.push(`${f.replace(ROOT, "")}:${i + 1}`);
        });
    }
    expect(bad, `текст на -soft-заливке не на ink-*: ${bad.join(", ")}`).toEqual([]);
  });

  /** Значения переменных блока CSS (var(--x) раскрываются по тому же блоку, затем по базовому). */
  const block = (css: string, head: string): Map<string, string> => {
    const start = css.indexOf(head);
    expect(start, head).toBeGreaterThanOrEqual(0);
    const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
    const vars = new Map<string, string>();
    for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
    return vars;
  };
  const resolve = (vars: Map<string, string>, name: string, base?: Map<string, string>): string => {
    let v = vars.get(name) ?? base?.get(name);
    for (let k = 0; k < 6 && v && v.startsWith("var("); k++) {
      const ref = v.slice(6, -1);
      v = vars.get(ref) ?? base?.get(ref);
    }
    return v ?? "";
  };
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("ink-* к своей -soft-заливке и к карточке: светлая тема ≥ 4,5:1 (warning был 2,8:1), тёмная ≥ 4,5:1", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const light = block(css, ":root {");
    const dark = block(css, ':root[data-theme="dark"] {');
    for (const [theme, vars, base] of [["светлая", light, undefined], ["тёмная", dark, light]] as const)
      for (const tone of ["primary", "success", "danger", "warning", "ai", "gold", "streak"]) {
        const ink = resolve(vars, `ink-${tone}`, base);
        const soft = resolve(vars, `${tone}-soft`, base);
        expect(ink, `${theme}: ink-${tone}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(soft, `${theme}: ${tone}-soft`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrast(ink, soft), `${theme}: ink-${tone} ${ink} на ${soft}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ink, resolve(vars, "surface", base)), `${theme}: ink-${tone} на surface`).toBeGreaterThanOrEqual(4.5);
      }
  });
});
