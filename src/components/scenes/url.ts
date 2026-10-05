// Чистая логика сцены url: перенос адреса по частям (не по буквам), места подписей ролей, тон роли, замок.
// Без React; покрыта тестами (tests/scene-web-ext.test.ts). Раскладка идёт в колонках моно-шрифта (1 колонка = 1ch).

import type { Scene, SceneTone, UrlRole } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export type UrlData = Extract<Scene, { kind: "url" }>;

/** Колонок в строке: при кегле 14 px (1ch ≈ 8,4 px) это ≈ 252 px — влезает на экран 360 px вместе с замком и полями. */
export const URL_COLS = 30;
/** Кегль адреса и подписей (px). */
export const URL_FONT = 14;
export const URL_LABEL_FONT = 11;
/** Ширина одной колонки моно-шрифта, px. */
export const URL_CH_PX = URL_FONT * 0.6;

export const URL_ROLES: readonly UrlRole[] = ["protocol", "subdomain", "domain", "zone", "port", "path", "query", "fragment"];

/** Тон роли: соседние части адреса получают разные тона (протокол, поддомен, домен, зона, порт, путь, параметры, якорь). */
export function roleTone(role: UrlRole): SceneTone {
  switch (role) {
    case "protocol":
    case "path":
      return "primary";
    case "subdomain":
    case "fragment":
      return "ai";
    case "domain":
      return "success";
    case "zone":
    case "query":
      return "warning";
    case "port":
      return "gold";
  }
}

export interface UrlSegment {
  text: string;
  role: UrlRole;
  /** Индекс части в сцене. */
  part: number;
  /** Колонка начала. */
  col: number;
  highlighted: boolean;
}
export interface UrlLabel {
  role: UrlRole;
  part: number;
  /** Центр подписи, колонки (с учётом границ строки). */
  center: number;
  /** Ширина подписи, колонки. */
  width: number;
  /** Ярус подписи (0 — сразу под адресом; если подписи рядом не помещаются — ниже). */
  level: number;
}
export interface UrlLine {
  segments: UrlSegment[];
  labels: UrlLabel[];
  /** Число ярусов подписей. */
  levels: number;
}

/** Перенос по частям: часть целиком на строке; не влезла — на следующую; длиннее строки — режется по колонкам. */
export function wrapUrl(parts: UrlData["parts"], highlight: readonly UrlRole[] = [], cols: number = URL_COLS): UrlLine["segments"][] {
  const lines: UrlSegment[][] = [[]];
  let col = 0;
  const hl = new Set(highlight);
  parts.forEach((p, i) => {
    const chars = [...p.text];
    if (chars.length > cols) {
      if (col > 0) {
        lines.push([]);
        col = 0;
      }
      for (let at = 0; at < chars.length; at += cols) {
        const chunk = chars.slice(at, at + cols).join("");
        if (at > 0) lines.push([]);
        lines[lines.length - 1].push({ text: chunk, role: p.role, part: i, col: 0, highlighted: hl.has(p.role) });
        col = [...chunk].length;
      }
      return;
    }
    if (col + chars.length > cols) {
      lines.push([]);
      col = 0;
    }
    lines[lines.length - 1].push({ text: p.text, role: p.role, part: i, col, highlighted: hl.has(p.role) });
    col += chars.length;
  });
  return lines;
}

/** Ширина подписи в колонках (текст кеглем 11 + поля по 4 px). */
export function labelCols(text: string): number {
  return (estimateTextWidth(text, URL_LABEL_FONT) + 8) / URL_CH_PX;
}

/**
 * Строки адреса с местами подписей. Подпись — под первым куском подсвеченной части, по центру, не выходит за строку;
 * подписи, которые наезжают друг на друга, разводятся по ярусам.
 */
export function layoutUrl(parts: UrlData["parts"], highlight: readonly UrlRole[] | undefined, roleName: (r: UrlRole) => string, cols: number = URL_COLS): UrlLine[] {
  const segLines = wrapUrl(parts, highlight, cols);
  const seen = new Set<number>();
  return segLines.map((segments) => {
    const labels: UrlLabel[] = [];
    for (const s of segments) {
      if (!s.highlighted || seen.has(s.part)) continue;
      seen.add(s.part);
      const width = labelCols(roleName(s.role));
      const half = width / 2;
      const raw = s.col + [...s.text].length / 2;
      const center = Math.min(Math.max(raw, half), Math.max(half, cols - half));
      labels.push({ role: s.role, part: s.part, center, width, level: 0 });
    }
    // Ярусы: жадно, слева направо; подпись идёт на первый ярус, где левее неё есть место (зазор в колонку).
    const ends: number[] = [];
    for (const lb of [...labels].sort((a, b) => a.center - b.center)) {
      const left = lb.center - lb.width / 2;
      let level = ends.findIndex((end) => left >= end + 0.5);
      if (level < 0) level = ends.length;
      ends[level] = lb.center + lb.width / 2;
      lb.level = level;
    }
    return { segments, labels, levels: ends.length };
  });
}

/** Протокол адреса: https — замок закрыт, http — открыт, иначе (нет протокола) — без замка. */
export function urlLock(parts: UrlData["parts"]): "secure" | "open" | "none" {
  const p = parts.find((x) => x.role === "protocol");
  if (!p) return "none";
  const txt = p.text.toLowerCase();
  if (txt.startsWith("https")) return "secure";
  if (txt.startsWith("http")) return "open";
  return "none";
}

/** Адрес целиком — склейка частей. */
export function urlText(parts: UrlData["parts"]): string {
  return parts.map((p) => p.text).join("");
}
