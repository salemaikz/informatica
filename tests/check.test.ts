import { describe, expect, it } from "vitest";
import { checkInput, divisionLadder, normalizeAnswer, sameSet } from "@/lib/check";

describe("normalizeAnswer", () => {
  it("срезает основание и пробелы", () => {
    expect(normalizeAnswer(" 1011₂ ", "binary")).toBe("1011");
    expect(normalizeAnswer("1011(2)", "binary")).toBe("1011");
    expect(normalizeAnswer("1011_2", "binary")).toBe("1011");
    expect(normalizeAnswer("1 011", "binary")).toBe("1011");
  });
  it("убирает ведущие нули", () => {
    expect(normalizeAnswer("00101", "binary")).toBe("101");
    expect(normalizeAnswer("022", "number")).toBe("22");
    expect(normalizeAnswer("0", "number")).toBe("0");
  });
});

describe("checkInput", () => {
  it("принимает верные ответы", () => {
    expect(checkInput("11001", ["11001"], "binary")).toBe(true);
    expect(checkInput("011001₂", ["11001"], "binary")).toBe(true);
    expect(checkInput("22₁₀", ["22"], "number")).toBe(true);
  });
  it("отклоняет неверные и недвоичные", () => {
    expect(checkInput("11011", ["11001"], "binary")).toBe(false);
    expect(checkInput("11201", ["11001"], "binary")).toBe(false);
    expect(checkInput("", ["1"], "number")).toBe(false);
  });
});

describe("divisionLadder", () => {
  it("13 → остатки 1,0,1,1", () => {
    expect(divisionLadder(13).map((r) => r.remainder)).toEqual([1, 0, 1, 1]);
  });
  it("19 → 10011 снизу вверх", () => {
    const rows = divisionLadder(19);
    expect(rows.map((r) => r.remainder).reverse().join("")).toBe("10011");
  });
});

describe("sameSet", () => {
  it("сравнивает без учёта порядка", () => {
    expect(sameSet([3, 1], [1, 3])).toBe(true);
    expect(sameSet([1], [1, 3])).toBe(false);
  });
});
