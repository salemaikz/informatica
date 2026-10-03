import { describe, expect, it } from "vitest";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import {
  VENN_NAME_MAX,
  VENN_REGIONS_2,
  VENN_REGIONS_3,
  bestSpot,
  isVennRegion,
  labelFontSize,
  outsideClipPath,
  regionClearance,
  regionColor,
  regionMembership,
  regionName,
  regionOpacity,
  valueFontSize,
  vennAria,
  vennCount,
  vennLayout,
  vennRegions,
  type VennCount,
} from "@/components/scenes/venn";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import type { Lang, Scene } from "@/lib/types";
import { validateScene } from "./validate";

const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);
type VennScene = Extract<Scene, { kind: "venn" }>;
const venn = (over: Partial<VennScene> = {}): VennScene => ({ kind: "venn", sets: ["A", "B"], ...over });

describe("области кругов Эйлера", () => {
  it("для двух множеств 4 области, для трёх — 8", () => {
    expect([...VENN_REGIONS_2]).toEqual(["a", "b", "ab", "out"]);
    expect(VENN_REGIONS_3).toHaveLength(8);
    expect(vennRegions(2)).toBe(VENN_REGIONS_2);
    expect(vennRegions(3)).toBe(VENN_REGIONS_3);
  });

  it("isVennRegion: для двух множеств нет c, ac, bc, abc", () => {
    for (const r of ["a", "b", "ab", "out"]) expect(isVennRegion(r, 2)).toBe(true);
    for (const r of ["c", "ac", "bc", "abc", "x", "ba", ""]) expect(isVennRegion(r, 2)).toBe(false);
    for (const r of ["a", "b", "c", "ab", "ac", "bc", "abc", "out"]) expect(isVennRegion(r, 3)).toBe(true);
    expect(isVennRegion("ba", 3)).toBe(false);
  });

  it("vennCount приводит к 2 или 3", () => {
    expect([0, 1, 2, 3, 4].map(vennCount)).toEqual([2, 2, 2, 3, 3]);
  });

  it("regionMembership: внутри/снаружи", () => {
    expect(regionMembership("a", 2)).toEqual({ inside: [0], outside: [1] });
    expect(regionMembership("ab", 2)).toEqual({ inside: [0, 1], outside: [] });
    expect(regionMembership("out", 2)).toEqual({ inside: [], outside: [0, 1] });
    expect(regionMembership("ab", 3)).toEqual({ inside: [0, 1], outside: [2] });
    expect(regionMembership("bc", 3)).toEqual({ inside: [1, 2], outside: [0] });
    expect(regionMembership("abc", 3)).toEqual({ inside: [0, 1, 2], outside: [] });
    expect(regionMembership("c", 3)).toEqual({ inside: [2], outside: [0, 1] });
    expect(regionMembership("out", 3)).toEqual({ inside: [], outside: [0, 1, 2] });
  });
});

describe("vennLayout", () => {
  for (const n of [2, 3] as VennCount[]) {
    for (const framed of [false, true]) {
      const L = vennLayout(n, framed);
      const tag = `${n} множества, рамка: ${framed}`;

      it(`${tag}: круги и подписи внутри холста`, () => {
        expect(L.circles).toHaveLength(n);
        for (const c of L.circles) {
          expect(c.cx - c.r).toBeGreaterThanOrEqual(0);
          expect(c.cx + c.r).toBeLessThanOrEqual(L.w);
          expect(c.cy - c.r).toBeGreaterThanOrEqual(0);
          expect(c.cy + c.r).toBeLessThanOrEqual(L.h);
        }
        expect(L.labels).toHaveLength(n);
        for (const lb of L.labels) {
          expect(lb.x).toBeGreaterThan(0);
          expect(lb.x).toBeLessThan(L.w);
          expect(lb.y).toBeGreaterThan(10);
          expect(lb.y).toBeLessThan(L.h);
        }
        // подписи A и B не должны наезжать на рамку универсума: они ниже её подписи
        if (framed) expect(L.labels[0].y).toBeGreaterThan(L.universe.y + 8);
        expect(Number.isInteger(L.h)).toBe(true);
      });

      it(`${tag}: рамка есть только когда нужна и охватывает круги`, () => {
        if (!framed) return expect(L.frame).toBeNull();
        expect(L.frame).not.toBeNull();
        const f = L.frame!;
        for (const c of L.circles) {
          expect(c.cx - c.r).toBeGreaterThan(f.x);
          expect(c.cx + c.r).toBeLessThan(f.x + f.w);
          expect(c.cy - c.r).toBeGreaterThan(f.y);
          expect(c.cy + c.r).toBeLessThan(f.y + f.h);
        }
        expect(f.x + f.w).toBeLessThanOrEqual(L.w);
        expect(f.y + f.h).toBeLessThanOrEqual(L.h);
      });

      it(`${tag}: число каждой области лежит внутри неё, с запасом для двузначного числа`, () => {
        for (const region of vennRegions(n)) {
          const a = L.anchors[region];
          const clearance = regionClearance(a.x, a.y, L.circles, region);
          expect(clearance, region).toBeGreaterThan(0);
          expect(a.room, region).toBeGreaterThanOrEqual(20);
          expect(a.room, region).toBeLessThanOrEqual(clearance + 1e-9);
          expect(a.x).toBeGreaterThan(0);
          expect(a.x).toBeLessThan(L.w);
          expect(a.y).toBeGreaterThan(0);
          expect(a.y).toBeLessThan(L.h);
        }
      });
    }
  }

  it("число «вне кругов» — в правом нижнем углу рамки", () => {
    for (const n of [2, 3] as VennCount[]) {
      const L = vennLayout(n, true);
      const a = L.anchors.out;
      expect(a.x).toBeGreaterThan(L.w * 0.8);
      expect(a.y).toBeGreaterThan(L.h * 0.8);
      expect(a.x).toBeLessThan(L.frame!.x + L.frame!.w);
      expect(a.y).toBeLessThan(L.frame!.y + L.frame!.h);
    }
  });

  it("раскладка симметрична: A и B — зеркально, общая область по центру", () => {
    const L2 = vennLayout(2, false);
    expect(L2.anchors.a.x + L2.anchors.b.x).toBeCloseTo(L2.w, 5);
    expect(L2.anchors.a.y).toBe(L2.anchors.b.y);
    expect(L2.anchors.ab.x).toBeCloseTo(L2.w / 2, 5);
    const L3 = vennLayout(3, false);
    expect(L3.anchors.a.x + L3.anchors.b.x).toBeCloseTo(L3.w, 5);
    expect(L3.anchors.ab.x).toBeCloseTo(L3.w / 2, 5);
    expect(L3.anchors.abc.x).toBeCloseTo(L3.w / 2, 5);
    expect(L3.anchors.ac.x + L3.anchors.bc.x).toBeCloseTo(L3.w, 5);
    // C — ниже A и B, ab — выше центра, пары ac/bc — ниже центра
    expect(L3.anchors.c.y).toBeGreaterThan(L3.anchors.a.y);
    expect(L3.anchors.ab.y).toBeLessThan(L3.anchors.abc.y);
    expect(L3.anchors.ac.y).toBeGreaterThan(L3.anchors.abc.y);
  });

  it("области покрывают всё и не пересекаются: каждая точка — ровно в одной области", () => {
    for (const n of [2, 3] as VennCount[]) {
      const L = vennLayout(n, true);
      let seen = 0;
      for (let y = 0; y < L.h; y += 5) {
        for (let x = 0; x < L.w; x += 5) {
          const hit = vennRegions(n).filter((r) => regionClearance(x, y, L.circles, r) > 0);
          // точки на самом контуре (clearance = 0) пропускаем: у них нет единственной области
          const onEdge = L.circles.some((c) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) < 1e-9);
          if (onEdge) continue;
          expect(hit.length, `${n}: (${x}, ${y})`).toBe(1);
          seen++;
        }
      }
      expect(seen).toBeGreaterThan(1000);
    }
  });

  it("результат кэшируется", () => {
    expect(vennLayout(3, false)).toBe(vennLayout(3, false));
    expect(vennLayout(3, false)).not.toBe(vennLayout(3, true));
  });

  it("bestSpot: лучшая точка области «только A» лежит на оси кругов, левее центра A", () => {
    const L = vennLayout(2, false);
    const s = bestSpot(L.circles, "a");
    expect(s.y).toBe(L.circles[0].cy);
    expect(s.x).toBeLessThan(L.circles[0].cx);
    expect(s.room).toBeCloseTo(L.circles[0].r - (L.circles[0].cx - s.x), 5);
  });

  it("outsideClipPath: рамка рисунка плюс круг (clip-rule evenodd)", () => {
    const d = outsideClipPath({ cx: 100, cy: 50, r: 20 }, 360, 200);
    expect(d).toBe("M0 0H360V200H0Z M80 50a20 20 0 1 0 40 0a20 20 0 1 0 -40 0Z");
  });
});

describe("шрифты, цвета, прозрачность", () => {
  it("valueFontSize: крупно, но влезает; не меньше 11 и не больше 20", () => {
    expect(valueFontSize(1, 30)).toBe(20);
    expect(valueFontSize(2, 24)).toBeGreaterThanOrEqual(16);
    expect(valueFontSize(12, 20)).toBeLessThan(valueFontSize(3, 20));
    expect(valueFontSize(40, 10)).toBe(11);
    expect(valueFontSize(0, 24)).toBe(20);
    // строка помещается в диаметр области
    for (const len of [1, 2, 3, 5, 8]) for (const room of [20, 24, 32, 48]) {
      const fs = valueFontSize(len, room);
      if (fs > 11) expect(len * 0.62 * fs).toBeLessThanOrEqual(2 * room);
    }
  });

  it("labelFontSize: длинное название мельче, но не мельче 12", () => {
    expect(labelFontSize(1)).toBeGreaterThan(labelFontSize(9));
    expect(labelFontSize(9)).toBeGreaterThan(labelFontSize(VENN_NAME_MAX));
    expect(labelFontSize(100)).toBe(12);
  });

  it("цвета областей — только токены темы", () => {
    for (const r of VENN_REGIONS_3) expect(regionColor(r), r).toMatch(/^(var\(--[a-z-]+\)|color-mix\(in srgb, var\(--[a-z-]+\) 50%, var\(--[a-z-]+\)\))$/);
    // A — primary, B — warning, пересечение A и B — success (как в уроке: синий, жёлтый, зелёный)
    expect(regionColor("a")).toBe("var(--primary)");
    expect(regionColor("b")).toBe("var(--warning)");
    expect(regionColor("ab")).toBe("var(--success)");
    expect(new Set(VENN_REGIONS_3.map(regionColor)).size).toBe(8);
  });

  it("regionOpacity: выделенная сильнее, остальные при выделении бледнее, «вне» без выделения пустая", () => {
    expect(regionOpacity("a", true, true)).toBeGreaterThan(regionOpacity("a", false, false));
    expect(regionOpacity("a", false, true)).toBeLessThan(regionOpacity("a", false, false));
    expect(regionOpacity("a", false, true)).toBeGreaterThan(0);
    expect(regionOpacity("out", false, false)).toBe(0);
    expect(regionOpacity("out", false, true)).toBe(0);
    expect(regionOpacity("out", true, true)).toBeGreaterThan(0);
  });
});

describe("описание для экранного диктора", () => {
  const ru = tr("ru");
  const kk = tr("kk");

  it("названия областей", () => {
    expect(regionName("a", ["A", "B"], ru)).toBe("только A");
    expect(regionName("ab", ["A", "B"], ru)).toBe("A и B (пересечение)");
    expect(regionName("out", ["A", "B"], ru)).toBe("ни A, ни B");
    expect(regionName("ab", ["A", "B", "C"], ru)).toBe("A и B, без C");
    expect(regionName("ac", ["A", "B", "C"], ru)).toBe("A и C, без B");
    expect(regionName("bc", ["A", "B", "C"], ru)).toBe("B и C, без A");
    expect(regionName("abc", ["A", "B", "C"], ru)).toBe("A, B и C одновременно");
    expect(regionName("out", ["A", "B", "C"], ru)).toBe("ни A, ни B, ни C");
    expect(regionName("b", ["A", "B"], kk)).toBe("тек B");
    expect(regionName("ab", ["A", "B"], kk)).toBe("A және B (қиылысу)");
    expect(regionName("ac", ["A", "B", "C"], kk)).toBe("A және C, B жоқ");
  });

  it("aria: множества, универсум, значения и выделение в порядке областей (a, b, ab, out)", () => {
    const text = vennAria({ names: ["Футбол", "Шахматы"], universe: "Класс", values: { out: "7", a: "8", ab: "4", b: "5" }, highlight: ["b", "ab"] }, ru);
    expect(text).toBe(
      "Круги Эйлера. Множества: Футбол, Шахматы. Универсум: Класс. " +
        "В областях: только Футбол: 8; только Шахматы: 5; Футбол и Шахматы (пересечение): 4; ни Футбол, ни Шахматы: 7. " +
        "Выделено: только Шахматы; Футбол и Шахматы (пересечение).",
    );
  });

  it("aria на казахском и без значений", () => {
    expect(vennAria({ names: ["A", "B", "C"] }, kk)).toBe("Эйлер дөңгелектері. Жиындар: A, B, C.");
    const t = vennAria({ names: ["A", "B"], values: { ab: "4" }, universe: "U" }, kk);
    expect(t).toContain("Әмбебап жиын: U.");
    expect(t).toContain("Аймақтарда: A және B (қиылысу): 4.");
  });

  it("aria пропускает недопустимые для двух множеств области и пустые значения", () => {
    const t = vennAria({ names: ["A", "B"], values: { a: "", c: "9" }, highlight: ["abc", "a"] }, ru);
    expect(t).not.toContain("В областях");
    expect(t).toContain("Выделено: только A.");
    expect(t).not.toContain("9");
  });

  it("строки словаря есть на обоих языках", () => {
    const keys = (Object.keys(dict) as DictKey[]).filter((k) => k.startsWith("scene.venn."));
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const k of keys) {
      expect(dict[k].ru.trim(), k).toBeTruthy();
      expect(dict[k].kk.trim(), k).toBeTruthy();
    }
    // казахский вариант не должен быть кириллицей русского текста
    expect(dict["scene.venn.only"].kk).toMatch(/^тек /);
  });
});

describe("VennScene (SceneView)", () => {
  const html = (scene: Scene) => renderToStaticMarkup(createElement(SceneView, { scene }));

  it("рисует svg с viewBox, role=img и aria-label", () => {
    const out = html(venn({ universe: "U", values: { a: "8", ab: "4", b: "5", out: "3" }, highlight: ["ab"], caption: "подпись" }));
    expect(out).toMatch(/<svg[^>]*viewBox="0 0 360 226"/);
    expect(out).toContain('role="img"');
    expect(out).toMatch(/aria-label="Круги Эйлера\. Множества: A, B\./);
    expect(out).toContain("подпись");
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("undefined");
  });

  it("цвета — только токены темы", () => {
    const out = html(venn({ sets: ["A", "B", "C"], universe: "U", highlight: ["abc", "ac"], values: { abc: "2", out: "9" } }));
    const colors = [
      ...[...out.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]),
      ...[...out.matchAll(/style="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/fill\s*:\s*([^;]+?)(?:;|$)/g)].map((x) => x[1])),
    ];
    expect(colors.length).toBeGreaterThan(10);
    for (const c of colors) {
      if (c === "none") continue;
      expect(c, c).toMatch(/var\(--/);
      expect(c.replace(/var\(--[a-z-]+\)/g, "").replace(/color-mix\(in srgb, |\d+%|,|\)/g, "").trim(), c).toBe("");
    }
  });

  it("рамка рисуется только при universe или области out", () => {
    const frame = (s: Scene) => /<rect[^>]*rx="14"[^>]*stroke=/.test(html(s));
    expect(frame(venn())).toBe(false);
    expect(frame(venn({ universe: "U" }))).toBe(true);
    expect(frame(venn({ values: { out: "3" } }))).toBe(true);
    expect(frame(venn({ highlight: ["out"] }))).toBe(true);
    expect(frame(venn({ values: { a: "1" } }))).toBe(false);
  });

  it("числа выводятся в областях; у двух множеств нет лишних областей", () => {
    const out = html(venn({ values: { a: "330", ab: "?", b: "200" } }));
    for (const v of ["330", "?", "200"]) expect(out).toContain(`>${v}</text>`);
    // 2 множества: у каждого круга свой clipPath «внутри» и «снаружи»
    expect(out.match(/<clipPath/g)).toHaveLength(4);
    expect(html(venn({ sets: ["A", "B", "C"] })).match(/<clipPath/g)).toHaveLength(6);
  });

  it("id clipPath уникальны, когда на странице несколько сцен", () => {
    const two = renderToStaticMarkup(createElement(Fragment, null, createElement(SceneView, { scene: venn() }), createElement(SceneView, { scene: venn() })));
    const ids = [...two.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    // ссылки на clipPath указывают на существующие id
    for (const m of two.matchAll(/clip-path="url\(#([^)]+)\)"/g)) expect(ids).toContain(m[1]);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
  });

  it("выделенная область заливается сильнее остальных", () => {
    const out = html(venn({ universe: "U", highlight: ["ab"] }));
    const opacities = [...out.matchAll(/fill-opacity:([\d.]+)/g)].map((m) => +m[1]);
    expect(opacities.filter((o) => o === 0.45)).toHaveLength(1);
    expect(Math.max(...opacities)).toBe(0.45);
  });
});

describe("validateScene: venn", () => {
  const problems = (s: unknown) => validateScene(s as Scene);

  it("принимает корректные сцены", () => {
    expect(problems(venn())).toEqual([]);
    expect(problems(venn({ universe: "U", values: { a: "8", ab: "4", b: "5", out: "3" }, highlight: ["ab", "out"], caption: "x" }))).toEqual([]);
    expect(problems(venn({ sets: ["A", "B", "C"], values: { abc: "2", ac: "3", bc: "?" }, highlight: ["abc"] }))).toEqual([]);
    expect(problems(venn({ sets: [{ ru: "Футбол", kk: "Футбол" }, { ru: "Шахматы", kk: "Шахмат" }], universe: { ru: "Класс", kk: "Сынып" } }))).toEqual([]);
  });

  it("2–3 множества", () => {
    expect(problems(venn({ sets: ["A"] })).join()).toContain("2–3 множества");
    expect(problems(venn({ sets: [] })).join()).toContain("2–3 множества");
    expect(problems(venn({ sets: ["A", "B", "C", "D"] })).join()).toContain("2–3 множества");
  });

  it("пустые тексты", () => {
    expect(problems(venn({ sets: ["A", "  "] })).join()).toContain("название множества");
    expect(problems(venn({ sets: ["A", { ru: "Б", kk: "" }] })).join()).toContain("название множества");
    expect(problems(venn({ universe: "" })).join()).toContain("универсума");
    expect(problems(venn({ values: { a: "" } })).join()).toContain("значение области");
    expect(problems(venn({ values: { a: "  " } })).join()).toContain("значение области");
    expect(problems(venn({ caption: "" })).join()).toContain("пустая подпись");
  });

  it("области допустимы для числа множеств", () => {
    expect(problems(venn({ values: { c: "1" } })).join()).toContain("values");
    expect(problems(venn({ values: { abc: "1" } })).join()).toContain("values");
    expect(problems(venn({ highlight: ["bc"] })).join()).toContain("highlight");
    expect(problems(venn({ sets: ["A", "B", "C"], values: { out: "1" }, highlight: ["abc", "bc"] }))).toEqual([]);
    expect(problems({ ...venn(), values: { zz: "1" } }).join()).toContain("values");
  });

  it("highlight без повторов; длинные названия и значения не проходят", () => {
    expect(problems(venn({ highlight: ["a", "a"] })).join()).toContain("повтор");
    expect(problems(venn({ sets: ["A", "x".repeat(VENN_NAME_MAX + 1)] })).join()).toContain("длиннее");
    expect(problems(venn({ sets: ["A", "x".repeat(VENN_NAME_MAX)] }))).toEqual([]);
    expect(problems(venn({ values: { a: "1234567890123" } })).join()).toContain("значение области");
  });
});
