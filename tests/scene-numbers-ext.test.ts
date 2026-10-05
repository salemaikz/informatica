import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/extended";
import { binarySum, decimalParts, decimalTotal } from "@/components/scenes/logic";
import {
  NUM_W,
  andBits,
  andLines,
  baseColumnWidth,
  baseParts,
  baseSumTerms,
  binaryUnits,
  bitsValue,
  gapVisible,
  isBinaryExt,
  isDecimalExt,
  layoutRows,
  peelSteps,
  placesFit,
  shiftBits,
  valueInBase,
  weightLabel,
  weightMode,
} from "@/components/scenes/numbers";
import type { Scene } from "@/lib/types";
import { validateScene } from "./validate";

type Bin = Extract<Scene, { kind: "binary" }>;
type Dec = Extract<Scene, { kind: "decimal" }>;
const IP = "11000000101010000000000100001010"; // 192.168.1.10
const MASK = "11111111111111111111111100000000"; // 255.255.255.0

const html = (scene: Scene) => renderToStaticMarkup(createElement(SceneView, { scene }));

describe("старые сцены binary и decimal не меняются", () => {
  it("без новых полей — старый рисунок", () => {
    const olds: Bin[] = [
      { kind: "binary", bits: "101101" },
      { kind: "binary", bits: "101101", weights: true, cross: true, sum: true, highlight: [1] },
      { kind: "binary", bits: "1011", weights: true, wrongDirection: true },
    ];
    for (const s of olds) expect(isBinaryExt(s)).toBe(false);
    for (const s of [{ kind: "decimal", number: "345" }, { kind: "decimal", number: "345", peel: false }] as Dec[]) expect(isDecimalExt(s)).toBe(false);
    // старый рисунок — HTML-плитки, а не общий SVG
    expect(html({ kind: "binary", bits: "101101", weights: true, sum: true })).not.toContain('viewBox="0 0 328');
    expect(html({ kind: "decimal", number: "345" })).toContain("×100");
  });

  it("старая логика не тронута", () => {
    expect(binarySum("101101")).toBe(45);
    expect(decimalParts("345").map((p) => p.value)).toEqual([300, 40, 5]);
    expect(decimalTotal("345")).toBe(345);
  });

  it("новые поля включают новый рисунок", () => {
    expect(isBinaryExt({ kind: "binary", bits: "1011", groups: 4 })).toBe(true);
    expect(isBinaryExt({ kind: "binary", bits: "1011", shift: "left" })).toBe(true);
    expect(isBinaryExt({ kind: "binary", bits: "1011", and: "1111" })).toBe(true);
    expect(isDecimalExt({ kind: "decimal", number: "7E3", base: 16 })).toBe(true);
    expect(isDecimalExt({ kind: "decimal", number: "4721", peel: true })).toBe(true);
    expect(isDecimalExt({ kind: "decimal", number: "4721", peel: 1 })).toBe(true);
  });
});

describe("binary: логика", () => {
  it("поразрядное И: адрес и маска", () => {
    expect(andBits(IP, MASK)).toBe("11000000101010000000000100000000"); // 192.168.1.0
    expect(andBits("1011", "0110")).toBe("0010");
    expect(andBits("11", "1")).toBe("01"); // короткая слева дополняется
    const [a, b, c] = andLines(IP, MASK);
    expect([a.bits, b.bits, c.bits]).toEqual([IP, MASK, andBits(IP, MASK)]);
    expect(b.mask.filter(Boolean)).toHaveLength(24);
  });

  it("сдвиг: влево приписывает 0, вправо отбрасывает правый разряд", () => {
    expect(shiftBits("101101", "left")).toBe("1011010");
    expect(shiftBits("101101", "right")).toBe("10110");
    expect(bitsValue(shiftBits("101101", "left"))).toBe(bitsValue("101101") * 2);
    expect(bitsValue(shiftBits("101101", "right"))).toBe(Math.floor(bitsValue("101101") / 2));
    expect(shiftBits("1", "right")).toBe("0");
  });

  it("пропуск середины: показаны крайние разряды", () => {
    expect(gapVisible(10, [3, 7])).toEqual([0, 1, 2, 7, 8, 9]);
  });

  it("группы справа налево: байты IP и цифры 16-й системы", () => {
    const u = binaryUnits(IP, { groups: 8 });
    expect(u).toHaveLength(4);
    expect(u.map((x) => x.bracket?.value)).toEqual([192, 168, 1, 10]);
    expect(u.map((x) => x.bracket?.byte)).toEqual([1, 2, 3, 4]);
    const hex = binaryUnits("11010111", { groups: 4 });
    expect(hex.map((x) => x.bracket?.text)).toEqual(["D", "7"]);
  });

  it("группы: ведущие нули дописываются слева бледными", () => {
    const u = binaryUnits("1011010", { groups: 3 });
    expect(u).toHaveLength(3);
    expect(u[0].cells.map((c) => c.ch).join("")).toBe("001");
    expect(u[0].cells.filter((c) => c.pad)).toHaveLength(2);
    expect(u.map((x) => x.bracket?.text)).toEqual(["1", "3", "2"]);
    // у дописанных нулей нет индекса исходной записи
    expect(u[0].cells.filter((c) => c.pad).every((c) => c.index === -1)).toBe(true);
  });

  it("ключи плиток — по степени разряда: при смене длины существующие не пересоздаются", () => {
    const a = binaryUnits("1011", { groups: 4 })[0].cells.map((c) => c.key);
    const b = binaryUnits("11011", { groups: 4 }).flatMap((u) => u.cells.map((c) => c.key));
    for (const k of a) expect(b).toContain(k);
    expect(new Set(b).size).toBe(b.length);
  });

  it("сдвиг: приписанный ноль и отброшенный разряд помечены", () => {
    const l = binaryUnits("101", { shift: "left" });
    expect(l[l.length - 1].cells[0]).toMatchObject({ kind: "extra", ch: "0", mark: "added" });
    const r = binaryUnits("101", { shift: "right" }).flatMap((u) => u.cells);
    expect(r.filter((c) => c.mark === "dropped")).toHaveLength(1);
    expect(r[r.length - 1].mark).toBe("dropped");
  });

  it("gap: веса по краям остаются верными (степень считается от исходной длины)", () => {
    const cells = binaryUnits("1111111111", { gap: [3, 7] }).flatMap((u) => u.cells);
    expect(cells.filter((c) => c.kind === "digit").map((c) => c.exp)).toEqual([9, 8, 7, 2, 1, 0]);
    expect(cells.filter((c) => c.kind === "gap")).toHaveLength(1);
    expect(cells.findIndex((c) => c.kind === "gap")).toBe(3);
  });

  it("подписи весов: число или степень, если число не влезает", () => {
    expect(weightMode([2, 1, 0], 40).mode).toBe("value");
    const wide = weightMode(Array.from({ length: 32 }, (_, i) => i), 17);
    expect(wide.mode).toBe("pow");
    expect(weightLabel(31, "pow")).toBe("2³¹");
    expect(weightLabel(5, "value")).toBe("32");
  });
});

describe("binary: раскладка на 360 px", () => {
  const ok = (bits: string, o: { groups?: 3 | 4 | 8; gap?: [number, number]; shift?: "left" | "right" }, weights = false) => {
    const units = binaryUnits(bits, o);
    const lay = layoutRows(units, { weights, brackets: !!o.groups, maxTiles: o.shift && !o.groups ? 17 : undefined });
    for (const row of lay.rows) {
      const cells = row.cells;
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + lay.tileW).toBeLessThanOrEqual(NUM_W + 0.001);
      }
      for (let i = 1; i < cells.length; i++) expect(cells[i].x).toBeGreaterThanOrEqual(cells[i - 1].x + lay.tileW); // не наезжают
    }
    return lay;
  };

  it("32 разряда по 8: 4 октета в 2 строки, плитка ≥ 16 px", () => {
    const lay = ok(IP, { groups: 8 });
    expect(lay.rows).toHaveLength(2);
    expect(lay.rows.map((r) => r.units.length)).toEqual([2, 2]);
    expect(lay.tileW).toBeGreaterThanOrEqual(16);
  });

  it("32 разряда по 4 и по 3, а также по 8 с весами — без выхода за край", () => {
    expect(ok(IP, { groups: 4 }).rows.length).toBeGreaterThanOrEqual(2);
    ok(IP, { groups: 3 });
    ok(IP, { groups: 8 }, true);
  });

  it("8 разрядов — одна строка и крупные плитки; группа не рвётся между строками", () => {
    const lay = ok("11010111", { groups: 4 });
    expect(lay.rows).toHaveLength(1);
    expect(lay.tileW).toBe(37);
    const l3 = ok("1".repeat(32), { groups: 3 });
    for (const r of l3.rows) expect(r.cells.length % 3).toBe(0);
  });

  it("16 разрядов со сдвигом и пропуском помещаются в одну строку", () => {
    const sh = ok("1010110011110000", { shift: "left" });
    expect(sh.rows).toHaveLength(1);
    expect(sh.tileW).toBeGreaterThanOrEqual(14);
    expect(ok("1".repeat(16), { gap: [2, 14] }).rows).toHaveLength(1);
  });

  it("скобки и веса добавляют высоту, байтовые скобки выше", () => {
    const plain = layoutRows(binaryUnits("11010111", { groups: 4 }), {});
    const withB = layoutRows(binaryUnits("11010111", { groups: 4 }), { brackets: true });
    const withW = layoutRows(binaryUnits("11010111", { groups: 4 }), { brackets: true, weights: true });
    const byte = layoutRows(binaryUnits("11010111", { groups: 8 }), { brackets: true });
    expect(withB.height).toBeGreaterThan(plain.height);
    expect(withW.height).toBeGreaterThan(withB.height);
    expect(byte.height - byte.tileH).toBeGreaterThan(withB.height - withB.tileH);
  });
});

describe("decimal: основание и «отрываем цифру»", () => {
  it("значение числа в системе с основанием q", () => {
    expect(valueInBase("7E3", 16)).toBe(2019);
    expect(valueInBase("11010111", 2)).toBe(215);
    expect(valueInBase("FFFFFFFF", 16)).toBe(4294967295);
    expect(valueInBase("345", 10)).toBe(345);
  });

  it("разряды: веса — степени основания, цифры A–F", () => {
    const p = baseParts("7E3", 16);
    expect(p.map((x) => x.place)).toEqual([256, 16, 1]);
    expect(p.map((x) => x.digit)).toEqual([7, 14, 3]);
    expect(p.map((x) => x.value)).toEqual([1792, 224, 3]);
    expect(p.reduce((a, x) => a + x.value, 0)).toBe(2019);
  });

  it("строка суммы: «7·256 + 14·16 + 3», нули пропущены", () => {
    expect(baseSumTerms(baseParts("7E3", 16)).map((t) => t.text)).toEqual(["7·256", "14·16", "3"]);
    expect(baseSumTerms(baseParts("1001", 2)).map((t) => t.text)).toEqual(["1·8", "1"]);
    expect(baseSumTerms(baseParts("000", 2)).map((t) => t.text)).toEqual(["0"]);
  });

  it("peel: 4721 — четыре шага «n % 10» и «n // 10»", () => {
    const s = peelSteps("4721", undefined, true);
    expect(s.map((x) => [x.cur, x.digit, x.next])).toEqual([
      [4721, 1, 472],
      [472, 2, 47],
      [47, 7, 4],
      [4, 4, 0],
    ]);
    expect(s.every((x) => x.q === 10)).toBe(true);
  });

  it("peel: число — сколько шагов показать", () => {
    expect(peelSteps("4721", undefined, 2)).toHaveLength(2);
    expect(peelSteps("4721", undefined, 1)[0].n).toBe(1);
    expect(peelSteps("4721", undefined, 9)).toHaveLength(4); // не больше, чем цифр
  });

  it("peel с основанием: % q и // q, цифры A–F", () => {
    const s = peelSteps("7E3", 16, true);
    expect(s.map((x) => x.ch)).toEqual(["3", "E", "7"]);
    expect(s.map((x) => x.q)).toEqual([16, 16, 16]);
    expect(s[0]).toMatchObject({ cur: 2019, digit: 3, next: 126 });
    // собранные цифры справа налево дают исходное число
    expect(s.map((x) => x.ch).reverse().join("")).toBe("7E3");
  });

  it("peel: ноль — один шаг", () => {
    expect(peelSteps("0", undefined, true)).toEqual([{ n: 1, cur: 0, q: 10, digit: 0, ch: "0", next: 0 }]);
  });

  it("8 цифр: колонки не уже 28 px, значения весов в основании 16 не влезают — ряд скрыт", () => {
    const parts = baseParts("FFFFFFFF", 16);
    expect(baseColumnWidth(8, 38)).toBeGreaterThanOrEqual(28);
    expect(placesFit(parts, baseColumnWidth(8, 38), 11)).toBe(false);
    expect(placesFit(baseParts("7E3", 16), baseColumnWidth(3, 60), 14)).toBe(true);
  });
});

describe("образцы расширений binary и decimal", () => {
  const mine = SAMPLES.filter((s) => s.kind === "binary" || s.kind === "decimal");

  it("все проходят validateScene и рисуются (ru)", () => {
    expect(mine.length).toBeGreaterThanOrEqual(15);
    for (const s of mine) {
      expect(validateScene(s)).toEqual([]);
      expect(html(s).length).toBeGreaterThan(50);
    }
  });

  it("образцы покрывают все новые поля", () => {
    const bin = mine.filter((s): s is Bin => s.kind === "binary");
    const dec = mine.filter((s): s is Dec => s.kind === "decimal");
    for (const g of [3, 4, 8]) expect(bin.some((s) => s.groups === g)).toBe(true);
    expect(bin.some((s) => s.shift === "left") && bin.some((s) => s.shift === "right")).toBe(true);
    expect(bin.some((s) => s.gap) && bin.some((s) => s.and) && bin.some((s) => s.andLabels)).toBe(true);
    expect(dec.some((s) => s.base === 16) && dec.some((s) => s.base === 2)).toBe(true);
    expect(dec.some((s) => s.peel === true) && dec.some((s) => typeof s.peel === "number")).toBe(true);
    expect(dec.some((s) => s.peel && s.base)).toBe(true);
  });

  it("худший случай: 32 разряда с and — три строки по две, всё в границах", () => {
    const units = binaryUnits(IP, { groups: 8 });
    const lay = layoutRows(units, {});
    expect(lay.rows).toHaveLength(2);
    expect(lay.height).toBeLessThan(120);
  });
});
