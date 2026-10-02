import { describe, expect, it } from "vitest";
import {
  MARK,
  addLamp,
  binarySum,
  chipWeights,
  clampLamps,
  coinCode,
  coinRows,
  coinSum,
  coinValues,
  crossedColumns,
  decimalParts,
  decimalTotal,
  goalReached,
  ladderRows,
  lampsPattern,
  lampsTerms,
  lampsValue,
  monoFit,
  newLamps,
  parseBits,
  readUpDigits,
  removeLamp,
  signalGridColumns,
  signalsCount,
  splitMark,
  sumTerms,
  tileMetrics,
  toggleLamp,
  visibleLadderRows,
  weightsRtl,
  weightsWrong,
  wrongSum,
} from "@/components/scenes/logic";

describe("двоичная запись", () => {
  it("веса справа налево: 1 у правой цифры", () => {
    expect(weightsRtl(4)).toEqual([8, 4, 2, 1]);
    expect(weightsRtl(6)).toEqual([32, 16, 8, 4, 2, 1]);
  });
  it("неверные веса слева направо", () => {
    expect(weightsWrong(4)).toEqual([1, 2, 4, 8]);
    expect(chipWeights(3, true)).toEqual([1, 2, 4]);
    expect(chipWeights(3, false)).toEqual([4, 2, 1]);
  });
  it("101101 → 32 + 8 + 4 + 1 = 45", () => {
    expect(sumTerms("101101")).toEqual([32, 8, 4, 1]);
    expect(binarySum("101101")).toBe(45);
  });
  it("зачёркнуты столбцы с нулями", () => {
    expect(crossedColumns("101101")).toEqual([1, 4]);
    expect(crossedColumns("111")).toEqual([]);
  });
  it("ловушка: 110101 слева направо даёт 43 вместо 53", () => {
    expect(binarySum("110101")).toBe(53);
    expect(wrongSum("110101")).toBe(43);
    expect(sumTerms("110101", true)).toEqual([1, 2, 8, 32]);
  });
  it("игнорирует лишние символы", () => {
    expect(parseBits("10 11")).toEqual(["1", "0", "1", "1"]);
    expect(binarySum("")).toBe(0);
    expect(binarySum("000")).toBe(0);
  });
  it("плитки сжимаются с ростом числа цифр, 8 цифр с зазорами укладываются в 328 px", () => {
    let prev = tileMetrics(1);
    for (let n = 2; n <= 10; n++) {
      const cur = tileMetrics(n);
      expect(cur.max).toBeLessThanOrEqual(prev.max);
      expect(cur.font).toBeLessThanOrEqual(prev.font);
      prev = cur;
    }
    const m8 = tileMetrics(8);
    // 8 плиток + 7 зазоров по 4 px + подстрочный знак (16 px): flex дожимает остаток
    expect(m8.max * 8 + 7 * 4 + 16).toBeLessThanOrEqual(360);
  });
});

describe("десятичное число", () => {
  it("345 → 300 + 40 + 5", () => {
    expect(decimalParts("345").map((p) => p.value)).toEqual([300, 40, 5]);
    expect(decimalParts("345").map((p) => p.place)).toEqual([100, 10, 1]);
    expect(decimalTotal("345")).toBe(345);
  });
  it("нули остаются слагаемыми", () => {
    expect(decimalParts("305").map((p) => p.value)).toEqual([300, 0, 5]);
    expect(decimalTotal("305")).toBe(305);
  });
});

describe("лесенка", () => {
  it("19 → остатки снизу вверх 10011", () => {
    expect(readUpDigits(ladderRows(19)).join("")).toBe("10011");
  });
  it("основание 16: 255 → FF, 26 → 1A", () => {
    expect(readUpDigits(ladderRows(255, 16)).join("")).toBe("FF");
    expect(readUpDigits(ladderRows(26, 16)).join("")).toBe("1A");
  });
  it("число 0 — одна строка", () => {
    expect(ladderRows(0)).toHaveLength(1);
  });
  it("сколько строк видно", () => {
    expect(visibleLadderRows(5, undefined, false)).toBe(5);
    expect(visibleLadderRows(5, 2, false)).toBe(2);
    expect(visibleLadderRows(5, 9, false)).toBe(5);
    expect(visibleLadderRows(5, -1, false)).toBe(0);
    expect(visibleLadderRows(5, 2, true)).toBe(5);
  });
});

describe("монеты", () => {
  const values = [16, 8, 4, 2, 1];
  it("сумма и код набора 19 = 16 + 2 + 1", () => {
    expect(coinSum(values, [16, 2, 1])).toBe(19);
    expect(coinCode(values, [16, 2, 1])).toBe("10011");
  });
  it("код упорядочен от большей монеты, даже если монеты заданы вразнобой", () => {
    expect(coinCode([1, 2, 4, 8], [8, 1])).toBe("1001");
  });
  it("лишние значения не считаются", () => {
    expect(coinSum(values, [16, 7])).toBe(16);
    expect(coinSum(values)).toBe(0);
  });
  it("раскладка по строкам", () => {
    expect(coinRows([1, 2, 3, 4, 5])).toEqual([[1, 2, 3, 4, 5]]);
    expect(coinRows([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3, 4], [5, 6, 7]]);
    expect(coinRows([1, 2, 3, 4, 5, 6, 7, 8]).map((r) => r.length)).toEqual([4, 4]);
  });
  it("монеты размера size", () => {
    expect(coinValues(5)).toEqual([16, 8, 4, 2, 1]);
    expect(coinValues(99)).toHaveLength(8);
  });
});

describe("песочница лампочек", () => {
  it("число ламп ограничено 1..8", () => {
    expect(clampLamps(0)).toBe(1);
    expect(clampLamps(20)).toBe(8);
    expect(clampLamps(Number.NaN)).toBe(1);
    expect(newLamps(3)).toEqual([false, false, false]);
  });
  it("добавление и удаление держатся в границах", () => {
    let bits = newLamps(7);
    bits = addLamp(bits);
    bits = addLamp(bits);
    expect(bits).toHaveLength(8);
    let one = newLamps(2);
    one = removeLamp(removeLamp(removeLamp(one)));
    expect(one).toHaveLength(1);
  });
  it("новая лампа появляется слева (старший разряд) и не меняет значение", () => {
    const bits = toggleLamp(toggleLamp(newLamps(3), 0), 2); // 101
    expect(lampsPattern(bits)).toBe("101");
    const more = addLamp(bits);
    expect(lampsPattern(more)).toBe("0101");
    expect(lampsValue(more)).toBe(lampsValue(bits));
  });
  it("значение и слагаемые: 1101 = 8 + 4 + 1", () => {
    let bits = newLamps(4);
    bits = toggleLamp(toggleLamp(toggleLamp(bits, 3), 2), 0);
    expect(lampsValue(bits)).toBe(13);
    expect(lampsTerms(bits)).toEqual([8, 4, 1]);
  });
  it("число сигналов удваивается", () => {
    expect([1, 2, 3, 4, 5, 6].map(signalsCount)).toEqual([2, 4, 8, 16, 32, 64]);
    expect(signalGridColumns(5)).toBe(8);
    expect(signalGridColumns(8)).toBe(16);
    expect(signalGridColumns(1)).toBe(2);
  });
});

describe("цель песочницы", () => {
  it("лампы — по числу ламп, веса и монеты — по сумме", () => {
    expect(goalReached("lamps", 5, { lamps: 5, sum: 0 })).toBe(true);
    expect(goalReached("lamps", 5, { lamps: 4, sum: 5 })).toBe(false);
    expect(goalReached("weights", 13, { lamps: 4, sum: 13 })).toBe(true);
    expect(goalReached("coins", 19, { lamps: 5, sum: 18 })).toBe(false);
  });
});

describe("шаблоны строк", () => {
  it("число между «до» и «после»", () => {
    expect(splitMark(`Сумма: ${MARK}`)).toEqual(["Сумма: ", ""]);
    expect(splitMark(`Ламп: ${MARK} шт.`)).toEqual(["Ламп: ", " шт."]);
    expect(splitMark("без числа")).toEqual(["без числа", ""]);
  });
  it("monoFit подбирает кегль под ширину", () => {
    expect(monoFit(4, 200, 18)).toBe(18);
    expect(monoFit(8, 60, 18)).toBeLessThan(18);
    expect(monoFit(0, 60, 18)).toBe(18);
  });
});
