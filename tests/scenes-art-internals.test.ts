import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INTERNAL_ART, INTERNAL_IDS } from "@/components/scenes/hardware/internals";
import { PC_PART_ART } from "@/components/scenes/pc-inside-art";
import {
  PC_ANCHORS,
  PC_COOLER_BOX,
  PC_CPU_BOX,
  PC_GEO,
  PC_INSIDE_TEXT,
  PC_PARTS,
  layoutCallouts,
  pcInsideAria,
  pcPartName,
  toScene,
  wrapLabel,
} from "@/components/scenes/pc-inside";
import type { PcPart } from "@/lib/types";

const ALL_PARTS: PcPart[] = ["motherboard", "cpu", "cooler", "ram", "ssd", "hdd", "gpu", "psu", "fans", "ports"];

describe("INTERNAL_ART", () => {
  it("рисунки для всех 14 деталей и носителей", () => {
    expect(INTERNAL_IDS).toHaveLength(14);
    expect(new Set(INTERNAL_IDS).size).toBe(14);
    for (const id of INTERNAL_IDS) expect(INTERNAL_ART[id], id).toBeTypeOf("function");
  });

  it("каждый рисунок — svg 120×90 на токенах темы, без текста", () => {
    for (const id of INTERNAL_IDS) {
      const html = renderToStaticMarkup(createElement(INTERNAL_ART[id]!));
      expect(html.startsWith("<svg"), id).toBe(true);
      expect(html, id).toContain('viewBox="0 0 120 90"');
      expect(html, id).toContain('aria-hidden="true"');
      expect(html, id).toContain("var(--");
      expect(html, id).not.toMatch(/<text/);
      expect(html, id).not.toMatch(/NaN|undefined/);
    }
  });
});

describe("pc-inside: детали и выноски", () => {
  it("у каждой детали есть рисунок, точка выноски и название ru/kk", () => {
    expect([...PC_PARTS].sort()).toEqual([...ALL_PARTS].sort());
    for (const p of ALL_PARTS) {
      expect(PC_PART_ART[p], p).toBeTypeOf("function");
      const a = PC_ANCHORS[p];
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(PC_GEO.caseW);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(PC_GEO.caseH);
      expect(pcPartName(p).ru.trim()).not.toBe("");
      expect(pcPartName(p).kk.trim()).not.toBe("");
    }
  });

  it("процессор виден из-под кулера, и выноска «Процессор» указывает на него, а не на кулер", () => {
    const inBox = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    expect(PC_COOLER_BOX.y + PC_COOLER_BOX.h).toBeLessThan(PC_CPU_BOX.y + PC_CPU_BOX.h - 6);
    expect(inBox(PC_ANCHORS.cpu, PC_CPU_BOX)).toBe(true);
    expect(inBox(PC_ANCHORS.cpu, PC_COOLER_BOX)).toBe(false);
    expect(inBox(PC_ANCHORS.cooler, PC_COOLER_BOX)).toBe(true);
  });

  it("точки выносок внутри корпуса в координатах сцены", () => {
    for (const p of ALL_PARTS) {
      const s = toScene(PC_ANCHORS[p].x, PC_ANCHORS[p].y);
      expect(s.x).toBeGreaterThan(PC_GEO.leftEdge);
      expect(s.x).toBeLessThan(PC_GEO.rightEdge);
      expect(s.y).toBeLessThan(PC_GEO.vh);
    }
  });

  it("wrapLabel: переносит по словам и после дефиса, текст не теряется", () => {
    expect(wrapLabel("Оперативная память")).toEqual(["Оперативная", "память"]);
    expect(wrapLabel("SSD-накопитель")).toEqual(["SSD-", "накопитель"]);
    expect(wrapLabel("Жёсткий диск (HDD)")).toEqual(["Жёсткий диск", "(HDD)"]);
    expect(wrapLabel("Кулер")).toEqual(["Кулер"]);
    expect(wrapLabel("Салқындатқыш")).toEqual(["Салқындатқыш"]);
  });

  for (const lang of ["ru", "kk"] as const) {
    it(`раскладка подписей (${lang}): строки влезают, блоки не наезжают и не выходят за сцену`, () => {
      const names = Object.fromEntries(ALL_PARTS.map((p) => [p, pcPartName(p)[lang]])) as Record<PcPart, string>;
      const callouts = layoutCallouts(names);
      expect(callouts).toHaveLength(ALL_PARTS.length);
      for (const c of callouts) {
        expect(c.lines.join(" ").replace("- ", "-")).toBe(names[c.part]);
        for (const line of c.lines) expect(line.length, line).toBeLessThanOrEqual(PC_GEO.maxChars);
        expect(c.lines.length).toBeLessThanOrEqual(2);
        expect(c.top).toBeGreaterThanOrEqual(PC_GEO.top);
        expect(c.top + c.height).toBeLessThanOrEqual(PC_GEO.bottom);
      }
      for (const side of ["left", "right"] as const) {
        const col = callouts.filter((c) => c.side === side).sort((a, b) => a.top - b.top);
        for (let i = 1; i < col.length; i++) {
          expect(col[i].top, `${col[i - 1].part} → ${col[i].part}`).toBeGreaterThanOrEqual(col[i - 1].top + col[i - 1].height + PC_GEO.gap - 0.01);
        }
      }
    });
  }

  it("раскладка раздвигает подписи с одинаковой точкой", () => {
    const names = Object.fromEntries(ALL_PARTS.map((p) => [p, "Очень длинное название детали"])) as Record<PcPart, string>;
    const callouts = layoutCallouts(names);
    for (const side of ["left", "right"] as const) {
      const col = callouts.filter((c) => c.side === side).sort((a, b) => a.top - b.top);
      for (let i = 1; i < col.length; i++) expect(col[i].top).toBeGreaterThanOrEqual(col[i - 1].top + col[i - 1].height + PC_GEO.gap - 0.01);
    }
  });

  it("aria-label перечисляет детали и выделенные", () => {
    const name = (p: PcPart) => pcPartName(p).ru;
    const plain = pcInsideAria(name, PC_INSIDE_TEXT.title.ru, PC_INSIDE_TEXT.highlighted.ru, []);
    expect(plain.startsWith("Системный блок изнутри:")).toBe(true);
    for (const p of ALL_PARTS) expect(plain).toContain(name(p));
    const lit = pcInsideAria(name, PC_INSIDE_TEXT.title.ru, PC_INSIDE_TEXT.highlighted.ru, ["cpu", "ram"]);
    expect(lit.endsWith("Выделено: Процессор, Оперативная память.")).toBe(true);
  });
});
