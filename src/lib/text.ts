import type { Lang, Text } from "./types";

/** Достаёт строку на нужном языке. */
export function tx(text: Text, lang: Lang): string {
  return typeof text === "string" ? text : text[lang];
}

/** Подстановка параметров вида {name}. */
export function fmt(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

/** Убирает markdown-разметку — для коротких текстов в контексте ИИ и статистике. */
export function plain(md: string): string {
  return md
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Убирает строчную markdown-разметку (`код`, **жирный**, *курсив*, ==маркер== и =={g}маркер==) —
 * для aria-label, объявлений скринридеру, замеров длины и проверок «формула ли это».
 * Консервативно: `a*b*c`, `2**10`, `a == b`, `my_var_name` остаются как есть (маркеры — только парные, у границ слов).
 */
export function plainText(md: string): string {
  // Код прячем за заглушки: внутри него разметку не трогаем (там бывают `a == b`, `2**3`).
  const codes: string[] = [];
  let s = md.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\uE000${codes.length - 1}\uE001`;
  });
  // Границы слов — Юникод (\w не знает кириллицу): [^L N _] слева, (?![L N _]) справа.
  s = s
    .replace(/(?<!=)==(?:\{[a-z]\})?(?=\S)(.+?)(?<=\S)==(?!=)/gu, "$1")
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/gu, "$1")
    .replace(/(^|[^\p{L}\p{N}*_])(\*\*|__)(?=\S)(.+?)(?<=\S)\2(?![\p{L}\p{N}])/gu, "$1$3")
    .replace(/(^|[^\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/gu, "$1$2");
  return s.replace(/\uE000(\d+)\uE001/g, (_, i: string) => codes[Number(i)]).replace(/`/g, "");
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Детерминированный ГПСЧ (mulberry32) — для воспроизводимых перемешиваний. */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * «Переведи в десятичную: 1100₂ = ?»: хвост «число = ?» склеиваем неразрывными пробелами, чтобы знак вопроса не уходил
 * один на вторую строку (на 360 px так и было). Только для показа; сам текст задания и проверка ответов не меняются.
 */
export function glueQuestionTail(s: string): string {
  return s.replace(/(\S+)\s([=≈→<>≤≥])\s(\?)\s*$/u, "$1\u00A0$2\u00A0$3");
}
