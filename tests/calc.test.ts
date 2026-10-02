import { describe, expect, it } from "vitest";
import {
  arith,
  BASES,
  CALC_INIT,
  calcPress,
  checkDigits,
  completeExpression,
  convert,
  convertUnits,
  displayExpr,
  displayResult,
  evaluateExpression,
  exactText,
  formatIn,
  formatNumber,
  INFO_UNITS,
  isPlainNumber,
  parseDecimal,
  parseIn,
  previewExpression,
  subscript,
  superscript,
  toBits,
  transferTime,
  type Base,
  type CalcState,
  type Conversion,
} from "@/lib/calc";
import { loadScratch, MAX_SCRATCH_PAGES, sanitizePages, saveScratch } from "@/lib/scratch";

const NUMBERS = [0, 1, 2, 7, 8, 10, 15, 16, 25, 100, 255, 256, 1000, 4095, 65535];

function ok(c: Conversion) {
  if (!c.ok) throw new Error(`ожидали ok, получили ${c.error}`);
  return c;
}

describe("subscript / superscript", () => {
  it("нижние и верхние индексы", () => {
    expect(subscript(2)).toBe("₂");
    expect(subscript(16)).toBe("₁₆");
    expect(subscript(10)).toBe("₁₀");
    expect(superscript(10)).toBe("¹⁰");
    expect(superscript(0)).toBe("⁰");
  });
});

describe("checkDigits / parseIn / formatIn", () => {
  it("допустимые цифры, регистр и пробелы не важны", () => {
    expect(checkDigits("1011", 2)).toEqual({ ok: true });
    expect(checkDigits("ff", 16)).toEqual({ ok: true });
    expect(checkDigits("1 011", 2)).toEqual({ ok: true });
    expect(checkDigits("7", 8)).toEqual({ ok: true });
  });
  it("находит недопустимую цифру", () => {
    expect(checkDigits("102", 2)).toEqual({ ok: false, digit: "2" });
    expect(checkDigits("18", 8)).toEqual({ ok: false, digit: "8" });
    expect(checkDigits("1G", 16)).toEqual({ ok: false, digit: "G" });
    expect(checkDigits("1g", 16)).toEqual({ ok: false, digit: "G" });
    expect(checkDigits("A", 10)).toEqual({ ok: false, digit: "A" });
    expect(checkDigits("-5", 10)).toEqual({ ok: false, digit: "-" });
  });
  it("пустая строка — ok:false с пустой цифрой", () => {
    expect(checkDigits("", 2)).toEqual({ ok: false, digit: "" });
    expect(checkDigits("   ", 16)).toEqual({ ok: false, digit: "" });
  });
  it("parseIn читает числа и отсекает лишнее", () => {
    expect(parseIn("11001", 2)).toBe(25);
    expect(parseIn("ff", 16)).toBe(255);
    expect(parseIn("0017", 8)).toBe(15);
    expect(parseIn("", 10)).toBeNull();
    expect(parseIn("12", 2)).toBeNull();
    expect(parseIn(String(Number.MAX_SAFE_INTEGER), 10)).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseIn("9007199254740992", 10)).toBeNull();
    expect(parseIn("FFFFFFFFFFFFFFFF", 16)).toBeNull();
  });
  it("formatIn — заглавные hex", () => {
    expect(formatIn(255, 16)).toBe("FF");
    expect(formatIn(10, 2)).toBe("1010");
    expect(formatIn(64, 8)).toBe("100");
  });
});

describe("convert — все пары систем", () => {
  for (const from of BASES) {
    for (const to of BASES) {
      it(`${from} → ${to}`, () => {
        for (const n of NUMBERS) {
          const c = ok(convert(n.toString(from).toUpperCase(), from, to));
          expect(c.result).toBe(n.toString(to).toUpperCase());
          expect(c.decimal).toBe(n);
          expect(c.explain.length).toBeGreaterThan(0);
          for (const line of c.explain) {
            expect(line.ru.length).toBeGreaterThan(0);
            expect(line.kk.length).toBeGreaterThan(0);
          }
        }
      });
    }
  }

  it("метод выбирается по паре систем", () => {
    const method = (a: Base, b: Base) => ok(convert("1", a, b)).method;
    expect(method(10, 2)).toBe("ladder");
    expect(method(10, 8)).toBe("ladder");
    expect(method(10, 16)).toBe("ladder");
    expect(method(2, 10)).toBe("powers");
    expect(method(8, 10)).toBe("powers");
    expect(method(16, 10)).toBe("powers");
    expect(method(2, 8)).toBe("groups");
    expect(method(2, 16)).toBe("groups");
    expect(method(8, 2)).toBe("ungroup");
    expect(method(16, 2)).toBe("ungroup");
    expect(method(8, 16)).toBe("via2");
    expect(method(16, 8)).toBe("via2");
    for (const b of BASES) expect(method(b, b)).toBe("same");
  });

  it("строчные hex, пробелы и ведущие нули принимаются", () => {
    expect(ok(convert("ff", 16, 10)).result).toBe("255");
    expect(ok(convert("1010 0101", 2, 16)).result).toBe("A5");
    expect(ok(convert("0025", 10, 2)).result).toBe("11001");
    expect(ok(convert("0000", 2, 10)).result).toBe("0");
  });

  it("ошибки: пусто, цифра, слишком большое", () => {
    expect(convert("", 2, 10)).toEqual({ ok: false, error: "empty" });
    expect(convert("  ", 10, 2)).toEqual({ ok: false, error: "empty" });
    expect(convert("102", 2, 10)).toEqual({ ok: false, error: "digit", digit: "2" });
    expect(convert("8", 8, 10)).toEqual({ ok: false, error: "digit", digit: "8" });
    expect(convert("G", 16, 10)).toEqual({ ok: false, error: "digit", digit: "G" });
    expect(convert("99999999999999999999", 10, 2)).toEqual({ ok: false, error: "tooBig" });
  });

  it("ladder: строки согласованы, остатки читаются снизу вверх", () => {
    for (const to of [2, 8, 16] as Base[]) {
      for (const n of NUMBERS) {
        const c = ok(convert(String(n), 10, to));
        const rows = c.ladder!;
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.dividend).toBe(r.quotient * to + r.remainder);
          expect(r.remainder).toBeLessThan(to);
          expect(r.digit).toBe(r.remainder.toString(16).toUpperCase());
        }
        expect(rows[rows.length - 1].quotient).toBe(0);
        for (let i = 1; i < rows.length; i++) expect(rows[i].dividend).toBe(rows[i - 1].quotient);
        expect(rows[0].dividend).toBe(n);
        expect(rows.map((r) => r.digit).reverse().join("")).toBe(c.result);
      }
    }
  });

  it("ladder: 25 → 11001, 0 → «0»", () => {
    const c = ok(convert("25", 10, 2));
    expect(c.ladder!.map((r) => r.remainder)).toEqual([1, 0, 0, 1, 1]);
    expect(c.result).toBe("11001");
    const z = ok(convert("0", 10, 2));
    expect(z.result).toBe("0");
    expect(z.ladder).toEqual([{ dividend: 0, quotient: 0, remainder: 0, digit: "0" }]);
  });

  it("ladder: пояснение про буквы A–F только для 16", () => {
    const hex = ok(convert("255", 10, 16));
    expect(hex.explain.some((l) => l.ru.includes("A–F"))).toBe(true);
    const bin = ok(convert("255", 10, 2));
    expect(bin.explain.some((l) => l.ru.includes("A–F"))).toBe(false);
  });

  it("powers: слагаемые дают десятичное число", () => {
    for (const from of [2, 8, 16] as Base[]) {
      for (const n of NUMBERS) {
        const c = ok(convert(n.toString(from).toUpperCase(), from, 10));
        const terms = c.terms!;
        expect(terms.reduce((s, t) => s + t.product, 0)).toBe(n);
        for (const t of terms) {
          expect(t.weight).toBe(from ** t.power);
          expect(t.product).toBe(t.value * t.weight);
        }
        expect(terms[terms.length - 1].power).toBe(0);
        expect(terms[0].power).toBe(terms.length - 1);
      }
    }
    const c = ok(convert("1A", 16, 10));
    expect(c.terms).toEqual([
      { digit: "1", value: 1, power: 1, weight: 16, product: 16 },
      { digit: "A", value: 10, power: 0, weight: 1, product: 10 },
    ]);
  });

  it("groups: 11010110₂ → D6₁₆, группы справа налево", () => {
    const c = ok(convert("11010110", 2, 16));
    expect(c.groups!.map((g) => g.chunk)).toEqual(["1101", "0110"]);
    expect(c.groups!.map((g) => g.digit)).toEqual(["D", "6"]);
    expect(c.result).toBe("D6");
    expect(c.pad).toBe(0);
    expect(c.groupSize).toBe(4);
  });

  it("groups: дополнение нулями слева (101₂ → 5₈, 1011₂ → 13₈)", () => {
    const a = ok(convert("101", 2, 8));
    expect(a.groups).toEqual([{ chunk: "101", digit: "5" }]);
    expect(a.pad).toBe(0);
    const b = ok(convert("1011", 2, 8));
    expect(b.groups!.map((g) => g.chunk)).toEqual(["001", "011"]);
    expect(b.pad).toBe(2);
    expect(b.result).toBe("13");
    const z = ok(convert("0", 2, 16));
    expect(z.result).toBe("0");
  });

  it("ungroup: каждая цифра — 3/4 бита, ведущие нули срезаются", () => {
    const o = ok(convert("17", 8, 2));
    expect(o.groups).toEqual([
      { chunk: "001", digit: "1" },
      { chunk: "111", digit: "7" },
    ]);
    expect(o.result).toBe("1111");
    const h = ok(convert("2F", 16, 2));
    expect(h.groups!.map((g) => g.chunk)).toEqual(["0010", "1111"]);
    expect(h.result).toBe("101111");
    expect(ok(convert("0", 16, 2)).result).toBe("0");
    expect(ok(convert("1", 8, 2)).result).toBe("1");
  });

  it("via2: 8 ↔ 16 через двоичную запись", () => {
    const c = ok(convert("377", 8, 16));
    expect(c.binary).toBe("11111111");
    expect(c.groupsIn!.map((g) => g.chunk)).toEqual(["011", "111", "111"]);
    expect(c.groups!.map((g) => g.chunk)).toEqual(["1111", "1111"]);
    expect(c.result).toBe("FF");
    const back = ok(convert("FF", 16, 8));
    expect(back.binary).toBe("11111111");
    expect(back.groups!.map((g) => g.chunk)).toEqual(["011", "111", "111"]);
    expect(back.result).toBe("377");
    expect(ok(convert("0", 8, 16)).result).toBe("0");
  });

  it("same: число нормализуется", () => {
    const c = ok(convert("0ff", 16, 16));
    expect(c.result).toBe("FF");
    expect(c.method).toBe("same");
  });
});

describe("arith", () => {
  const r = (a: string, b: string, op: "+" | "-" | "*" | "/", base: Base) => {
    const x = arith(a, b, op, base);
    if (!x.ok) throw new Error(x.error);
    return x;
  };

  it("сложение: 1011₂ + 11₂ = 1110₂", () => {
    const x = r("1011", "11", "+", 2);
    expect(x.result).toBe("1110");
    expect(x.decimal).toEqual({ a: 11, b: 3, result: 14 });
    expect(x.remainder).toBeUndefined();
  });
  it("умножение: 17₈ · 2₈ = 36₈", () => {
    expect(r("17", "2", "*", 8).result).toBe("36");
  });
  it("вычитание: FF₁₆ − 1 = FE₁₆", () => {
    expect(r("FF", "1", "-", 16).result).toBe("FE");
    expect(r("ff", "ff", "-", 16).result).toBe("0");
  });
  it("деление с остатком: 1011₂ ÷ 11₂ = 11₂ (ост. 10₂)", () => {
    const x = r("1011", "11", "/", 2);
    expect(x.result).toBe("11");
    expect(x.remainder).toBe("10");
    expect(x.decimal).toEqual({ a: 11, b: 3, result: 3, remainder: 2 });
    const y = r("64", "4", "/", 10);
    expect(y.result).toBe("16");
    expect(y.remainder).toBe("0");
  });
  it("совпадает с обычной арифметикой", () => {
    for (const base of BASES) {
      for (const [a, b] of [[17, 5], [255, 16], [100, 7], [1000, 33]]) {
        const sa = formatIn(a, base);
        const sb = formatIn(b, base);
        expect(r(sa, sb, "+", base).decimal.result).toBe(a + b);
        expect(r(sa, sb, "*", base).decimal.result).toBe(a * b);
        expect(r(sb, sa, "+", base).result).toBe(formatIn(a + b, base));
        expect(r(sa, sb, "-", base).result).toBe(formatIn(a - b, base));
        expect(r(sa, sb, "/", base).result).toBe(formatIn(Math.floor(a / b), base));
        expect(r(sa, sb, "/", base).remainder).toBe(formatIn(a % b, base));
      }
    }
  });
  it("ошибки", () => {
    expect(arith("1", "10", "-", 2)).toEqual({ ok: false, error: "negative" });
    expect(arith("1", "0", "/", 2)).toEqual({ ok: false, error: "divZero" });
    expect(arith("", "1", "+", 2)).toEqual({ ok: false, error: "empty" });
    expect(arith("1", " ", "+", 2)).toEqual({ ok: false, error: "empty" });
    expect(arith("12", "1", "+", 2)).toEqual({ ok: false, error: "digit", digit: "2" });
    expect(arith("1", "G", "+", 16)).toEqual({ ok: false, error: "digit", digit: "G" });
    // неверная цифра важнее пустого поля
    expect(arith("12", "", "+", 2)).toEqual({ ok: false, error: "digit", digit: "2" });
    expect(arith("9007199254740991", "9007199254740991", "*", 10)).toEqual({ ok: false, error: "tooBig" });
  });
});

describe("единицы информации", () => {
  it("toBits / convertUnits", () => {
    expect(toBits(1, "bit")).toBe(1);
    expect(toBits(1, "byte")).toBe(8);
    expect(toBits(1, "KB")).toBe(8192);
    expect(toBits(1, "MB")).toBe(8 * 1024 * 1024);
    expect(toBits(1, "GB")).toBe(8 * 1024 ** 3);
    expect(convertUnits(2, "MB", "KB")).toBe(2048);
    expect(convertUnits(1, "KB", "bit")).toBe(8192);
    expect(convertUnits(8192, "bit", "KB")).toBe(1);
    expect(convertUnits(1, "GB", "MB")).toBe(1024);
    expect(convertUnits(512, "byte", "KB")).toBe(0.5);
  });
  it("туда-обратно для всех пар", () => {
    for (const a of INFO_UNITS) {
      for (const b of INFO_UNITS) {
        expect(convertUnits(convertUnits(3, a, b), b, a)).toBe(3);
      }
    }
  });
  it("transferTime: 1050 Кбайт при 8400 байт/с = 128 с", () => {
    const t = transferTime(1050, "KB", 8400, "byte");
    expect(t).not.toBeNull();
    expect(t!.seconds).toBe(128);
    expect(t!.explain.length).toBeGreaterThanOrEqual(2);
    expect(t!.explain[0].ru).toContain("t = I / v");
    expect(t!.explain.some((l) => l.ru.includes("1075200"))).toBe(true);
    expect(t!.explain[t!.explain.length - 1].ru).toContain("128");
    for (const l of t!.explain) expect(l.kk.length).toBeGreaterThan(0);
  });
  it("transferTime: одинаковые единицы, биты и байты", () => {
    expect(transferTime(1, "MB", 1, "MB")!.seconds).toBe(1);
    expect(transferTime(2, "KB", 16384, "bit")!.seconds).toBe(1);
    expect(transferTime(1, "byte", 4, "bit")!.seconds).toBe(2);
    expect(transferTime(0, "KB", 10, "KB")!.seconds).toBe(0);
  });
  it("transferTime: скорость ≤ 0 или мусор → null", () => {
    expect(transferTime(10, "KB", 0, "byte")).toBeNull();
    expect(transferTime(10, "KB", -5, "byte")).toBeNull();
    expect(transferTime(-1, "KB", 5, "byte")).toBeNull();
    expect(transferTime(NaN, "KB", 5, "byte")).toBeNull();
  });
  it("parseDecimal: запятая и точка", () => {
    expect(parseDecimal("1,5")).toBe(1.5);
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal(" 42 ")).toBe(42);
    expect(parseDecimal(".5")).toBe(0.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("-1")).toBeNull();
    expect(parseDecimal("1.2.3")).toBeNull();
    expect(parseDecimal("1e3")).toBeNull();
  });
});

describe("evaluateExpression", () => {
  it("приоритет операций", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("2*3+4")).toBe(10);
    expect(evaluateExpression("10-4-3")).toBe(3);
    expect(evaluateExpression("100/10/5")).toBe(2);
    expect(evaluateExpression("2+6/3*2")).toBe(6);
  });
  it("скобки", () => {
    expect(evaluateExpression("(2+3)*4")).toBe(20);
    expect(evaluateExpression("((1+2)*(3+4))")).toBe(21);
    expect(evaluateExpression("2*(3+(4-1))")).toBe(12);
  });
  it("унарный минус", () => {
    expect(evaluateExpression("-3+5")).toBe(2);
    expect(evaluateExpression("2*-3")).toBe(-6);
    expect(evaluateExpression("-(2+3)")).toBe(-5);
    expect(evaluateExpression("2--3")).toBe(5);
    expect(evaluateExpression("−3+5")).toBe(2);
  });
  it("десятичная запятая и точка", () => {
    expect(evaluateExpression("1,5+2,5")).toBe(4);
    expect(evaluateExpression("0.5*4")).toBe(2);
    expect(evaluateExpression(".5+.5")).toBe(1);
    expect(evaluateExpression("5.+1")).toBe(6);
  });
  it("символы × и ÷", () => {
    expect(evaluateExpression("6×7")).toBe(42);
    expect(evaluateExpression("84÷4")).toBe(21);
    expect(evaluateExpression("2 × ( 3 + 4 ) ÷ 7")).toBe(2);
  });
  it("ошибки → null", () => {
    expect(evaluateExpression("1/0")).toBeNull();
    expect(evaluateExpression("1÷(2-2)")).toBeNull();
    expect(evaluateExpression("2++")).toBeNull();
    expect(evaluateExpression("2++3")).toBeNull();
    expect(evaluateExpression("")).toBeNull();
    expect(evaluateExpression("   ")).toBeNull();
    expect(evaluateExpression("2+")).toBeNull();
    expect(evaluateExpression("*2")).toBeNull();
    expect(evaluateExpression("(2+3")).toBeNull();
    expect(evaluateExpression("2+3)")).toBeNull();
    expect(evaluateExpression("()")).toBeNull();
    expect(evaluateExpression("2(3)")).toBeNull();
    expect(evaluateExpression("1.2.3")).toBeNull();
    expect(evaluateExpression(".")).toBeNull();
    expect(evaluateExpression("2a")).toBeNull();
    expect(evaluateExpression("alert(1)")).toBeNull();
    expect(evaluateExpression("process.exit()")).toBeNull();
    expect(evaluateExpression("1".repeat(600))).toBeNull();
  });
  it("не копит шум плавающей точки", () => {
    expect(evaluateExpression("0.1+0.2")).toBe(0.3);
    expect(evaluateExpression("1.1*1.1")).toBe(1.21);
    expect(evaluateExpression("4.35*100")).toBe(435);
    expect(evaluateExpression("2^")).toBeNull();
  });
  it("большие целые не портятся", () => {
    expect(evaluateExpression("1024*1024*1024*1024")).toBe(1099511627776);
    expect(evaluateExpression("123456789012345+1")).toBe(123456789012346);
  });
});

describe("formatNumber", () => {
  it("убирает шум и ограничивает 10 значащими цифрами", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(1 / 3)).toBe("0.3333333333");
    expect(formatNumber(2 / 3)).toBe("0.6666666667");
    expect(formatNumber(Math.PI)).toBe("3.141592654");
    expect(formatNumber(1234.5)).toBe("1234.5");
  });
  it("целые — полностью, нули и минус", () => {
    expect(formatNumber(14)).toBe("14");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(-5)).toBe("-5");
    expect(formatNumber(1099511627776)).toBe("1099511627776");
    expect(formatNumber(1048576)).toBe("1048576");
  });
  it("очень большие и не-числа", () => {
    expect(formatNumber(1e21)).toBe("1e+21");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
  it("безопасные целые — точно, без выдуманных нулей (2⁵⁰)", () => {
    expect(formatNumber(2 ** 50)).toBe("1125899906842624");
    expect(formatNumber(-(2 ** 50))).toBe("-1125899906842624");
    expect(formatNumber(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
    expect(formatNumber(123456789012345)).toBe("123456789012345");
  });
  it("целые за пределом безопасных — экспоненциальная форма, не нули", () => {
    expect(formatNumber(2 ** 60)).toBe("1.152921505e+18");
    expect(formatNumber(-(2 ** 60))).toBe("-1.152921505e+18");
    expect(formatNumber(2 ** 53)).toBe("9.007199255e+15");
    expect(formatNumber(1e20)).toBe("1e+20");
  });
  it("дроби с большой целой частью не теряют целые цифры", () => {
    expect(formatNumber(12345678901.5)).toBe("12345678901.5");
    expect(formatNumber(123456789012.25)).toBe("123456789012.25");
    expect(formatNumber(1234567.891)).toBe("1234567.891");
    expect(formatNumber(99999999999.99)).toBe("99999999999.99");
    // 13 цифр целой части + 2 дробные = потолок в 15 значащих: дробь урезается, целая часть цела.
    expect(formatNumber(1234567890123.456)).toBe("1234567890123.46");
  });
  it("маленькие числа — экспонента без нулей на конце", () => {
    expect(formatNumber(1e-7)).toBe("1e-7");
    expect(formatNumber(1.5e-10)).toBe("1.5e-10");
    expect(formatNumber(-2.5e-8)).toBe("-2.5e-8");
    expect(formatNumber(0.000001)).toBe("0.000001");
  });
});

describe("exactText / displayResult", () => {
  it("exactText: безопасные целые точно, большие — экспонента, дроби — как есть", () => {
    expect(exactText(0)).toBe("0");
    expect(exactText(-0)).toBe("0");
    expect(exactText(2 ** 50)).toBe("1125899906842624");
    expect(exactText(2 ** 60)).toBe("1.152921504606847e+18");
    expect(exactText(1e21)).toBe("1e+21");
    expect(exactText(1 / 3)).toBe("0.3333333333333333");
    expect(exactText(1e-7)).toBe("1e-7");
    expect(exactText(-1.5e-7)).toBe("-1.5e-7");
  });
  it("displayResult округляет только для показа: запятая и настоящий минус", () => {
    expect(displayResult("0.333333333333333")).toBe("0,3333333333");
    expect(displayResult("0.999999999999999")).toBe("1");
    expect(displayResult("-1.5e-7")).toBe("−1,5e−7");
    expect(displayResult("1125899906842624")).toBe("1125899906842624");
  });
});

describe("previewExpression", () => {
  it("игнорирует висящие операторы и закрывает скобки", () => {
    expect(previewExpression("2+3×")).toBe(5);
    expect(previewExpression("2+3×(")).toBe(5);
    expect(previewExpression("2×(3+4")).toBe(14);
    expect(previewExpression("2×(3+")).toBe(6);
    expect(previewExpression("5.")).toBe(5);
    expect(previewExpression("7")).toBe(7);
  });
  it("пустое и ошибочное — null", () => {
    expect(previewExpression("")).toBeNull();
    expect(previewExpression("-")).toBeNull();
    expect(previewExpression("(")).toBeNull();
    expect(previewExpression("1÷0")).toBeNull();
  });
});

describe("completeExpression", () => {
  it("достраивает выражение так же, как предпросмотр", () => {
    expect(completeExpression("5+")).toBe("5");
    expect(completeExpression("2+(3")).toBe("2+(3)");
    expect(completeExpression("2×(3+")).toBe("2×(3)");
    expect(completeExpression("2+3×(")).toBe("2+3");
    expect(completeExpression("(2+3)")).toBe("(2+3)");
    expect(completeExpression("5.")).toBe("5");
  });
  it("пусто → null", () => {
    expect(completeExpression("")).toBeNull();
    expect(completeExpression("+")).toBeNull();
    expect(completeExpression("(")).toBeNull();
  });
});

describe("displayExpr / isPlainNumber", () => {
  it("запятая и настоящий минус", () => {
    expect(displayExpr("-1.5×2")).toBe("−1,5×2");
  });
  it("простое число", () => {
    expect(isPlainNumber("12")).toBe(true);
    expect(isPlainNumber("-12.5")).toBe(true);
    expect(isPlainNumber("5.")).toBe(true);
    expect(isPlainNumber("1e+21")).toBe(true);
    expect(isPlainNumber("1.152921504606847e+18")).toBe(true);
    expect(isPlainNumber("-1.5e-7")).toBe(true);
    expect(isPlainNumber("2+3")).toBe(false);
    expect(isPlainNumber("")).toBe(false);
    expect(isPlainNumber("-")).toBe(false);
  });
});

describe("calcPress", () => {
  const type = (keys: string[], from: CalcState = CALC_INIT) => keys.reduce(calcPress, from);
  const expr = (keys: string[], from?: CalcState) => type(keys, from).expr;

  it("набор и вычисление: 2+3×4 = 14", () => {
    const s = type(["2", "+", "3", "*", "4"]);
    expect(s.expr).toBe("2+3×4");
    const r = calcPress(s, "=");
    expect(r).toEqual({ expr: "14", fresh: true, prev: "2+3×4" });
  });
  it("после «=» цифра начинает заново, оператор продолжает", () => {
    const r = type(["2", "+", "3", "="]);
    expect(calcPress(r, "7").expr).toBe("7");
    const cont = calcPress(r, "×");
    expect(cont).toEqual({ expr: "5×", fresh: false, prev: "" });
    expect(calcPress(r, ".").expr).toBe("0.");
    expect(calcPress(r, "(").expr).toBe("(");
  });
  it("«=» на ошибке ничего не ломает", () => {
    const s = type(["1", "÷", "0"]);
    expect(calcPress(s, "=")).toBe(s);
    expect(calcPress(CALC_INIT, "=")).toBe(CALC_INIT);
    const plain = calcPress(type(["5", "."]), "=");
    expect(plain).toEqual({ expr: "5", fresh: true, prev: "" });
  });
  it("два оператора подряд заменяются", () => {
    expect(expr(["2", "+", "×", "3"])).toBe("2×3");
    expect(expr(["2", "×", "÷", "3"])).toBe("2÷3");
    expect(expr(["2", "-", "+", "3"])).toBe("2+3");
  });
  it("минус после × и ÷ — унарный, потом оператор заменяет обоих", () => {
    expect(expr(["2", "×", "-", "3"])).toBe("2×-3");
    expect(evaluateExpression(expr(["2", "×", "-", "3"]))).toBe(-6);
    expect(expr(["2", "×", "-", "+"])).toBe("2+");
    expect(expr(["2", "×", "-", "-"])).toBe("2×-");
    expect(expr(["2", "+", "-"])).toBe("2-");
  });
  it("в начале допустим только минус", () => {
    expect(expr(["+"])).toBe("");
    expect(expr(["×", "5"])).toBe("5");
    expect(expr(["-", "5"])).toBe("-5");
    expect(expr(["-", "+"])).toBe("-");
    expect(expr(["(", "+"])).toBe("(");
    expect(expr(["(", "-", "5"])).toBe("(-5");
  });
  it("одна десятичная точка в числе, запятая = точка", () => {
    expect(expr(["1", ".", "5", ".", "2"])).toBe("1.52");
    expect(expr(["1", ",", "5"])).toBe("1.5");
    expect(expr(["."])).toBe("0.");
    expect(expr(["2", "+", ","])).toBe("2+0.");
    expect(expr(["1", ".", "5", "+", "2", ".", "5"])).toBe("1.5+2.5");
  });
  it("висящая точка срезается перед оператором", () => {
    expect(expr(["5", ".", "+"])).toBe("5+");
  });
  it("ведущие нули не копятся", () => {
    expect(expr(["0", "0", "7"])).toBe("7");
    expect(expr(["0", "."])).toBe("0.");
    expect(expr(["2", "+", "0", "5"])).toBe("2+5");
    expect(expr(["1", "0", "0"])).toBe("100");
    expect(expr(["0", ".", "0", "5"])).toBe("0.05");
  });
  it("скобки: закрываем только открытые, неявное умножение", () => {
    expect(expr(["(", "2", "+", "3", ")", ")"])).toBe("(2+3)");
    expect(expr([")"])).toBe("");
    expect(expr(["(", ")"])).toBe("(");
    expect(expr(["(", "2", "+", ")"])).toBe("(2+");
    expect(expr(["2", "("])).toBe("2×(");
    expect(expr(["(", "2", ")", "(", "3", ")"])).toBe("(2)×(3)");
    expect(expr(["(", "2", ")", "3"])).toBe("(2)×3");
    expect(expr(["(", "(", "1"])).toBe("((1");
  });
  it("⌫ и C", () => {
    expect(expr(["1", "2", "3", "⌫"])).toBe("12");
    expect(expr(["⌫"])).toBe("");
    expect(expr(["Backspace"], type(["4", "2"]))).toBe("4");
    expect(type(["1", "+", "2", "C"])).toEqual(CALC_INIT);
  });
  it("клавиши клавиатуры: Enter, Backspace, * и /", () => {
    const s = type(["6", "*", "7", "Enter"]);
    expect(s.expr).toBe("42");
    expect(s.fresh).toBe(true);
    expect(expr(["8", "/", "2"])).toBe("8÷2");
    expect(expr(["5", "−", "2"])).toBe("5-2");
  });
  it("лимиты длины числа и выражения", () => {
    const digits = Array.from({ length: 20 }, () => "9");
    expect(expr(digits).length).toBe(15);
    const long = Array.from({ length: 200 }, () => "1+");
    expect(expr(long).length).toBeLessThanOrEqual(80);
  });
  it("мусорные клавиши игнорируются", () => {
    const s = type(["2"]);
    expect(calcPress(s, "a")).toBe(s);
    expect(calcPress(s, "Shift")).toBe(s);
  });

  describe("«=»: точность и дисплей", () => {
    const keys = (s: string) => [...s];
    const shown = (s: CalcState) => displayResult(s.expr);

    it("2⁵⁰ считается и показывается точно, без выдуманных нулей", () => {
      const s = type(keys("1024×1024×1024×1024×1024="));
      expect(s.expr).toBe("1125899906842624");
      expect(shown(s)).toBe("1125899906842624");
    });
    it("за пределом безопасных целых — экспонента", () => {
      const s = type([...keys("1024×1024×1024×1024×1024×1024×1024="), "×", "1", "0", "2", "4", "="]);
      expect(s.expr).toMatch(/e\+\d+$/);
      expect(shown(s)).toMatch(/^\d(?:,\d+)?e\+\d+$/);
      expect(shown(s)).not.toMatch(/0000/);
    });
    it("дробь с большой целой частью не теряет цифры", () => {
      const s = type(keys("12345678901.5+0="));
      expect(shown(s)).toBe("12345678901,5");
    });
    it("в состоянии полная точность, а не округление до 10 знаков", () => {
      const s = type(keys("1÷3="));
      expect(s.expr).toBe("0.333333333333333");
      expect(shown(s)).toBe("0,3333333333");
    });
    it("1÷3= ×3= даёт 1, а не 0,9999999999", () => {
      const third = type(keys("1÷3="));
      const s = type(["×", "3", "="], third);
      expect(Number(s.expr)).toBeCloseTo(1, 14);
      expect(shown(s)).toBe("1");
      expect(s.prev).toBe("0.333333333333333×3");
    });
    it("2÷3= ×3= даёт 2", () => {
      const s = type(["×", "3", "="], type(keys("2÷3=")));
      expect(shown(s)).toBe("2");
    });
    it("повторный «=» ничего не меняет", () => {
      const r = type(keys("2+3×4="));
      expect(calcPress(r, "=")).toBe(r);
    });
  });

  describe("«=» вычисляет то же, что предпросмотр", () => {
    it("висящий оператор: 5+= → 5", () => {
      expect(type(["5", "+", "="])).toEqual({ expr: "5", fresh: true, prev: "" });
      expect(type(["6", "×", "="]).expr).toBe("6");
      expect(type(["8", "-", "="]).expr).toBe("8");
    });
    it("незакрытая скобка: 2+(3= → 5", () => {
      expect(type(["2", "+", "(", "3", "="])).toEqual({ expr: "5", fresh: true, prev: "2+(3)" });
      expect(type(["2", "×", "(", "3", "+", "4", "="]).expr).toBe("14");
    });
    it("висящая «(» после оператора и точка", () => {
      expect(type(["2", "+", "3", "×", "(", "="]).expr).toBe("5");
      expect(type(["5", ".", "="]).expr).toBe("5");
    });
    it("совпадает с previewExpression на наборе выражений", () => {
      for (const e of ["2+3×", "2+3×(", "2×(3+4", "2×(3+", "5.", "7", "(2+3", "10-", "2×-"]) {
        const s: CalcState = { expr: e, fresh: false, prev: "" };
        const preview = previewExpression(e);
        const r = calcPress(s, "=");
        if (preview === null) expect(r).toBe(s);
        else expect(Number(r.expr)).toBe(preview);
      }
    });
    it("пустое и ошибочное по-прежнему не ломает", () => {
      expect(calcPress(type(["("]), "=").expr).toBe("(");
      expect(calcPress(type(["-"]), "=").expr).toBe("-");
      const div0 = type(["1", "÷", "0"]);
      expect(calcPress(div0, "=")).toBe(div0);
    });
  });

  describe("⌫ после результата", () => {
    it("стирает результат целиком, а не по символу", () => {
      expect(type([..."2+3=", "⌫"])).toEqual(CALC_INIT);
      expect(type([..."12×12=", "⌫"])).toEqual(CALC_INIT);
    });
    it("экспонента: 1e-7 не превращается в «1e-»", () => {
      const r = type(["1", "÷", "1", "0", "0", "0", "0", "0", "0", "0", "="]);
      expect(r.expr).toBe("1e-7");
      const back = calcPress(r, "⌫");
      expect(back).toEqual(CALC_INIT);
      expect(calcPress(r, "Backspace")).toEqual(CALC_INIT);
    });
    it("после оператора: снятие оператора возвращает «свежий» результат, дальше — стирание целиком", () => {
      const r = type(["1", "÷", "1", "0", "0", "0", "0", "0", "0", "0", "=", "×"]);
      expect(r.expr).toBe("1e-7×");
      const noOp = calcPress(r, "⌫");
      expect(noOp).toEqual({ expr: "1e-7", fresh: true, prev: "" });
      expect(calcPress(noOp, "⌫")).toEqual(CALC_INIT);
      // и цифра теперь начинает заново, а не дописывается к экспоненте
      expect(calcPress(noOp, "5").expr).toBe("5");
    });
    it("длинная дробь после снятия оператора — тоже свежая", () => {
      const r = type([..."1÷3=", "+", "⌫"]);
      expect(r).toEqual({ expr: "0.333333333333333", fresh: true, prev: "" });
    });
    it("обычный набор ⌫ работает по символам", () => {
      expect(type([..."2+35", "⌫"]).expr).toBe("2+3");
      expect(type([..."2+3=", "+", "⌫"])).toEqual({ expr: "5", fresh: false, prev: "" });
    });
  });
});

describe("scratch (сохранение черновика)", () => {
  it("sanitizePages отбрасывает мусор и режет до MAX_SCRATCH_PAGES листов", () => {
    expect(sanitizePages(null)).toEqual([]);
    expect(sanitizePages("x")).toEqual([]);
    const raw = [
      { id: "p1", text: "abc", updatedAt: 5 },
      { id: "p2", text: "", image: "data:image/png;base64,AAA", updatedAt: 6 },
      { id: "p3", text: 5 },
      { text: "no id" },
      { id: "p4", text: "x", image: "javascript:alert(1)", updatedAt: 1 },
      ...Array.from({ length: MAX_SCRATCH_PAGES + 2 }, (_, i) => ({ id: `q${i}`, text: "x" })),
    ];
    const pages = sanitizePages(raw);
    expect(pages.length).toBe(MAX_SCRATCH_PAGES);
    expect(pages[0]).toEqual({ id: "p1", text: "abc", updatedAt: 5 });
    expect(pages[1].image).toBe("data:image/png;base64,AAA");
    expect(pages[2].id).toBe("p4");
    expect(pages[2].image).toBeUndefined();
  });

  it("без IndexedDB (как в приватном режиме) работает в памяти", async () => {
    await saveScratch([
      { id: "p1", text: "привет", updatedAt: 1 },
      { id: "p2", text: "", image: "data:image/png;base64,BBB", updatedAt: 2 },
    ]);
    const loaded = await loadScratch();
    expect(loaded.map((p) => p.text)).toEqual(["привет", ""]);
    expect(loaded[1].image).toBe("data:image/png;base64,BBB");
    // отдаём копии: правка результата не портит память
    loaded[0].text = "изменено";
    expect((await loadScratch())[0].text).toBe("привет");
    // не больше MAX_SCRATCH_PAGES листов
    await saveScratch(Array.from({ length: MAX_SCRATCH_PAGES + 3 }, (_, i) => ({ id: `p${i}`, text: String(i), updatedAt: i })));
    expect((await loadScratch()).length).toBe(MAX_SCRATCH_PAGES);
  });
});
