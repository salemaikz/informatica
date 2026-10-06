import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import type { Scene } from "@/lib/types";

// Ревью v18b: в светлой теме ink-warning был 2,8:1 к своей -soft-заливке. Токены ink-* исправлены (≥ 4,5:1), но текст на -soft-заливке в сценах
// должен брать именно их. Перепроверка: прежний сторож смотрел одну строку и пропускал многострочный cn(...) и SVG-текст на цветной плашке,
// поэтому теперь смотрим выражение целиком (cn(...), className=...) и теги <text> рядом с -soft-заливкой того же тона.

const ROOT = join(process.cwd(), "src/components/scenes");
const SKIP = ["samples", "quest", "hardware", "pc-inside-art.tsx"];
const TONES = "primary|success|warning|danger|ai|gold|streak";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(name) ? [p] : [];
  });
}

/** Индекс скобки, закрывающей ту, что стоит в `open` (строки и комментарии пропускаются); -1 — не нашлась. */
function closing(src: string, open: number, pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" }): number {
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2);
      if (i < 0) return -1;
      i++;
      continue;
    }
    if (ch in pairs) stack.push(pairs[ch]);
    else if (stack.length && ch === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** Выражения с классами: cn(...) и className="..." / className={...} — целиком, в том числе на нескольких строках. */
export function classExpressions(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lineOf = (i: number) => src.slice(0, i).split("\n").length;
  for (const m of src.matchAll(/\bcn\(|\bclassName=/g)) {
    const at = m.index!;
    let end = -1;
    if (m[0] === "cn(") end = closing(src, at + 2);
    else if (src[at + 10] === "{") end = closing(src, at + 10);
    else if (src[at + 10] === '"') end = src.indexOf('"', at + 11);
    if (end > at) out.push({ line: lineOf(at), text: src.slice(at, end + 1) });
  }
  return out;
}

const SOFT_BG = new RegExp(`(?<![\\w-])bg-(${TONES})-soft(?![\\w-])|\\bTONE_BG\\b`);
const TONE_TEXT = new RegExp(`(?<![\\w-])text-(${TONES})(-strong)?(?![\\w-])`);

/** Классовые выражения, где вместе с -soft-заливкой стоит text-<тон> (не ink-*): «line:text-тон». */
export function softTextViolations(src: string): string[] {
  const found = classExpressions(src).flatMap(({ line, text }) => (SOFT_BG.test(text) && TONE_TEXT.test(text) ? [`${line}:${text.match(TONE_TEXT)![0]}`] : []));
  return [...new Set(found)]; // className={cn(...)} видна и как className, и как вложенный cn — одна находка
}

/** Открывающие теги <text>, <m.text>, <tspan> целиком (с вложенными {...}). */
function textTags(src: string): { line: number; tag: string; at: number }[] {
  const out: { line: number; tag: string; at: number }[] = [];
  for (const m of src.matchAll(/<(?:m\.)?(?:text|tspan)\b/g)) {
    const at = m.index!;
    let i = at + m[0].length;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") {
        const e = closing(src, i);
        if (e < 0) break;
        i = e;
      } else if (ch === '"') i = src.indexOf('"', i + 1);
      else if (ch === ">") break;
    }
    out.push({ line: src.slice(0, at).split("\n").length, tag: src.slice(at, i + 1), at });
  }
  return out;
}

/**
 * SVG-текст с заливкой тона (var(--тон), fill-тон, не ink-*), рядом (в пределах 60 строк выше) с -soft-заливкой того же тона: «line:тон».
 * Так находится подпись «CPU» (fill primary на плашке primary-soft), которую одна строка не показывает.
 */
export function svgSoftTextViolations(src: string, window = 60): string[] {
  const lines = src.split("\n");
  const out: string[] = [];
  for (const { line, tag } of textTags(src)) {
    const tones = new Set<string>();
    for (const m of tag.matchAll(new RegExp(`var\\(--(${TONES})(?:-strong)?\\)`, "g"))) tones.add(m[1]);
    for (const m of tag.matchAll(new RegExp(`(?<![\\w-])fill-(${TONES})(?:-strong)?(?![\\w-])`, "g"))) tones.add(m[1]);
    for (const tone of tones) {
      const near = lines.slice(Math.max(0, line - 1 - window), line).join("\n");
      if (new RegExp(`var\\(--${tone}-soft\\)|fill-${tone}-soft(?![\\w-])|bg-${tone}-soft(?![\\w-])`).test(near)) out.push(`${line}:${tone}`);
    }
  }
  return out;
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

  it("весь cn(...) / className целиком: нет text-<тон> (не ink-*) вместе с bg-*-soft, даже если они на разных строках (TableScene: «1» в двоичном столбце на подсвеченной строке)", () => {
    const bad: string[] = [];
    for (const f of files(ROOT)) for (const v of softTextViolations(readFileSync(f, "utf8"))) bad.push(`${f.replace(ROOT, "")}:${v}`);
    expect(bad, `текст на -soft-заливке не на ink-*: ${bad.join(", ")}`).toEqual([]);
  });

  it("SVG-текст: нет fill тона (не ink-*) рядом с -soft-заливкой того же тона (CpuCycleScene: «CPU» на плашке primary-soft)", () => {
    const bad: string[] = [];
    for (const f of files(ROOT)) for (const v of svgSoftTextViolations(readFileSync(f, "utf8"))) bad.push(`${f.replace(ROOT, "")}:${v}`);
    expect(bad, `SVG-текст на -soft-заливке не на ink-*: ${bad.join(", ")}`).toEqual([]);
  });

  it("сторож сам ловит прежние ошибки (многострочный cn, SVG-текст на плашке) и пропускает исправленные", () => {
    const multi = `<td className={cn(
      cell,
      hiBg(r, c) && "bg-primary-soft",
      bin[c] && (value === "1" ? "font-bold text-success" : "text-muted"),
    )} />`;
    expect(softTextViolations(multi)).toHaveLength(1);
    expect(softTextViolations(multi.replace("text-success", "text-ink-success"))).toEqual([]);
    expect(softTextViolations(`<td className={cn("p-2", extra && TONE_BG[tone], "text-warning")} />`)).toHaveLength(1);
    expect(softTextViolations(`<i className="text-primary" /><b className="bg-primary-soft" />`)).toEqual([]); // разные элементы
    const svg = `<rect fill="var(--primary-soft)" stroke="var(--primary)" />
      {instr ? <text>x</text> : (
        <text x={CX} fontSize={15} fill="var(--primary)">
          CPU
        </text>
      )}`;
    expect(svgSoftTextViolations(svg)).toEqual(["3:primary"]);
    expect(svgSoftTextViolations(svg.replace('fill="var(--primary)"', 'fill="var(--ink-primary)"'))).toEqual([]);
    expect(svgSoftTextViolations(`<rect className="fill-success-soft" /><text className="fill-success font-mono">1</text>`)).toEqual(["1:success"]);
    expect(svgSoftTextViolations(`<rect fill="var(--danger-soft)" /><text fill="var(--primary)">1</text>`)).toEqual([]); // другой тон
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

describe("сцены: разметка с текстом на -soft-заливке берёт ink-*", () => {
  const html = (scene: Scene) => renderToStaticMarkup(createElement(SceneView, { scene }));

  it("таблица: «1» в двоичном столбце выделенной строки (bg-primary-soft) — text-ink-success, а не text-success", () => {
    const out = html({ kind: "table", columns: ["A", "B", "A ∧ B"], rows: [["0", "0", "0"], ["1", "1", "1"]], highlightRows: [1], mono: true });
    expect(out).toContain("bg-primary-soft font-bold text-ink-success");
    expect(out).not.toMatch(/(?<![\w-])text-success(?![\w-])/);
  });

  it("таблица: отклонённая строка — крестик text-ink-danger", () => {
    const out = html({ kind: "table", columns: ["A", "B"], rows: [["1", "2"], ["3", "4"]], rowStates: [{ row: 1, state: "rejected" }] });
    expect(out).toContain("text-ink-danger");
    expect(out).not.toMatch(/(?<![\w-])text-danger(?![\w-])/);
  });

  it("процессор: подпись «CPU» на плашке primary-soft — fill ink-primary, подпись активного этапа тоже", () => {
    const out = html({ kind: "cpu-cycle", step: 1 });
    expect(out).toMatch(/fill="var\(--ink-primary\)"[^>]*>CPU</);
    expect(out).not.toContain('fill="var(--primary)">CPU');
    expect(out).not.toMatch(/fill="var\(--primary\)"[^>]*>[^<]*<\/text>/);
  });

  it("код: токены и маркер активной строки на -soft-подсветке — ink-*", () => {
    const out = html({ kind: "code", lang: "python", lines: ["if x > 1:", "    print('a')"], active: 0 });
    expect(out).toContain("text-ink-primary");
    expect(out).not.toMatch(/(?<![\w-])text-(primary|success)(-strong)?(?![\w-])/);
  });
});
