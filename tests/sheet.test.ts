import { describe, expect, it } from "vitest";
import {
  addrOf,
  colToLetters,
  copyInput,
  ERROR_CODES,
  evaluateFormula,
  evaluateSheet,
  fillCells,
  formatNumber,
  formatValue,
  formulaRefs,
  FUNCTION_NAMES,
  isError,
  isFormula,
  lettersToCol,
  normalizeAddr,
  numberToText,
  parseAddr,
  parseConstant,
  parseFormula,
  parseNumberText,
  parseRangeText,
  parseRef,
  parseSheetCode,
  refText,
  roundHalfAway,
  serializeSheet,
  shiftFormula,
  shiftRef,
  tokenize,
  type ErrorCode,
  type SheetInput,
  type Value,
} from "@/lib/sheet";

const ev = (formula: string, cells: SheetInput = {}): Value => evaluateFormula(formula, cells);
const err = (code: ErrorCode) => ({ error: code });

describe("refs: адреса", () => {
  it("буквы столбцов", () => {
    expect(colToLetters(1)).toBe("A");
    expect(colToLetters(26)).toBe("Z");
    expect(colToLetters(27)).toBe("AA");
    expect(colToLetters(52)).toBe("AZ");
    expect(colToLetters(702)).toBe("ZZ");
    expect(colToLetters(703)).toBe("AAA");
    expect(colToLetters(16384)).toBe("XFD");
    for (const n of [1, 5, 26, 27, 100, 702, 703, 16384]) expect(lettersToCol(colToLetters(n))).toBe(n);
    expect(lettersToCol("ab")).toBe(28);
    expect(lettersToCol("")).toBe(0);
    expect(lettersToCol("ABCD")).toBe(0);
    expect(lettersToCol("A1")).toBe(0);
  });

  it("parseRef: относительные, абсолютные и смешанные", () => {
    expect(parseRef("A1")).toEqual({ col: 1, row: 1, absCol: false, absRow: false });
    expect(parseRef("$A$1")).toEqual({ col: 1, row: 1, absCol: true, absRow: true });
    expect(parseRef("A$1")).toEqual({ col: 1, row: 1, absCol: false, absRow: true });
    expect(parseRef("$A1")).toEqual({ col: 1, row: 1, absCol: true, absRow: false });
    expect(parseRef("c12")).toMatchObject({ col: 3, row: 12 });
  });

  it("parseRef: неверные адреса", () => {
    for (const bad of ["", "A", "1A", "A0", "A-1", "XFE1", "A1048577", "AB C1", "A1:B2", "$$A1"]) expect(parseRef(bad)).toBeNull();
    expect(parseRef("XFD1048576")).not.toBeNull();
  });

  it("parseAddr / normalizeAddr / addrOf / refText", () => {
    expect(parseAddr(" b3 ")).toEqual({ col: 2, row: 3 });
    expect(parseAddr("$B$3")).toEqual({ col: 2, row: 3 });
    expect(normalizeAddr("b3")).toBe("B3");
    expect(normalizeAddr("$c$10")).toBe("C10");
    expect(normalizeAddr("zz")).toBeNull();
    expect(addrOf(28, 7)).toBe("AB7");
    expect(refText(parseRef("$a1")!)).toBe("$A1");
  });

  it("shiftRef: абсолютные части не двигаются, край таблицы — null", () => {
    expect(refText(shiftRef(parseRef("A1")!, 2, 3)!)).toBe("D3");
    expect(refText(shiftRef(parseRef("$A$1")!, 2, 3)!)).toBe("$A$1");
    expect(refText(shiftRef(parseRef("A$1")!, 2, 3)!)).toBe("D$1");
    expect(refText(shiftRef(parseRef("$A1")!, 2, 3)!)).toBe("$A3");
    expect(shiftRef(parseRef("A1")!, -1, 0)).toBeNull();
    expect(shiftRef(parseRef("A1")!, 0, -1)).toBeNull();
    expect(shiftRef(parseRef("$A$1")!, -5, -5)).not.toBeNull();
  });

  it("parseRangeText нормализует углы", () => {
    expect(parseRangeText("B5:A1")).toEqual({ c1: 1, r1: 1, c2: 2, r2: 5 });
    expect(parseRangeText("A1")).toBeNull();
    expect(parseRangeText("A1:B2:C3")).toBeNull();
  });
});

describe("лексер", () => {
  it("числа с точкой, запятой и степенью", () => {
    const nums = (s: string) => tokenize(s).tokens.filter((t) => t.t === "num").map((t) => t.num);
    expect(nums("=1.5+2")).toEqual([1.5, 2]);
    expect(nums("=1,5+2")).toEqual([1.5, 2]);
    expect(nums("=.5")).toEqual([0.5]);
    expect(nums("=1E3+2e-2")).toEqual([1000, 0.02]);
  });

  it("запятая: десятичная в русской функции и вне функций, разделитель в английской", () => {
    const nums = (s: string) => tokenize(s).tokens.filter((t) => t.t === "num").map((t) => t.num);
    expect(nums("=СУММ(1,5)")).toEqual([1.5]);
    expect(nums("=SUM(1,5)")).toEqual([1, 5]);
    expect(nums("=SUM(1;5,5)")).toEqual([1, 5.5]); // есть «;» — запятая десятичная
    expect(nums("=A1*2,5")).toEqual([2.5]);
    expect(nums("=SUM((1,5))")).toEqual([1.5]); // скобки-группировка
    expect(nums("=SUM(1, 5)")).toEqual([1, 5]);
  });

  it("«;» внутри строки не меняет режим запятой", () => {
    const nums = (s: string) => tokenize(s).tokens.filter((t) => t.t === "num").map((t) => t.num);
    expect(nums('=SUM(1,5;"a")')).toEqual([1.5]);
    expect(nums('=SUM(1,5)&";"')).toEqual([1, 5]);
  });

  it("ошибки лексера", () => {
    expect(tokenize("=(1+2").error?.kind).toBe("paren");
    expect(tokenize("=1+2)").error?.kind).toBe("paren");
    expect(tokenize('="abc').error?.kind).toBe("string");
    expect(tokenize("=1+@").error?.kind).toBe("char");
    expect(tokenize("=2A").error?.kind).toBe("char");
    expect(tokenize("=$").error?.kind).toBe("char");
    expect(tokenize("=#FOO!").error?.kind).toBe("char");
  });

  it("ссылка против имени функции: LOG10( — функция, A1 — ссылка, A1B — имя", () => {
    const kinds = (s: string) => tokenize(s).tokens.map((t) => t.t);
    expect(kinds("=LOG10(A1)")).toEqual(["op", "name", "(", "ref", ")"]);
    expect(kinds("=A1B")).toEqual(["op", "name"]);
    expect(kinds("=XFE1")).toEqual(["op", "name"]);
  });
});

describe("разбор: приоритеты и ошибки", () => {
  it("структура дерева", () => {
    const p = parseFormula("=1+2*3");
    expect(p.ok && p.ast).toMatchObject({ type: "bin", op: "+", l: { type: "num", v: 1 }, r: { type: "bin", op: "*" } });
  });

  it("не формула или пустая — ошибка", () => {
    expect(parseFormula("1+2").ok).toBe(false);
    expect(parseFormula("=")).toMatchObject({ ok: false, error: { kind: "empty" } });
    expect(parseFormula("=1+")).toMatchObject({ ok: false });
    expect(parseFormula("=1 2")).toMatchObject({ ok: false, error: { kind: "syntax" } });
    expect(parseFormula("=SUM(1;")).toMatchObject({ ok: false });
    expect(parseFormula("=A1:5")).toMatchObject({ ok: false });
  });

  it("слишком глубокая вложенность не роняет разбор", () => {
    expect(parseFormula("=" + "(".repeat(500) + "1" + ")".repeat(500))).toMatchObject({ ok: false, error: { kind: "depth" } });
  });

  it("пропущенный аргумент и функция без аргументов", () => {
    const p = parseFormula("=IF(A1;;3)");
    expect(p.ok && p.ast).toMatchObject({ type: "call", args: [{ type: "ref" }, { type: "empty" }, { type: "num" }] });
    expect(parseFormula("=PI()")).toMatchObject({ ok: true });
  });
});

describe("арифметика и приоритеты", () => {
  it("+ − * / и скобки", () => {
    expect(ev("=1+2")).toBe(3);
    expect(ev("=2+3*4")).toBe(14);
    expect(ev("=(2+3)*4")).toBe(20);
    expect(ev("=10-4-3")).toBe(3);
    expect(ev("=100/10/5")).toBe(2);
    expect(ev("=7/2")).toBe(3.5);
    expect(ev("=2*3+4*5")).toBe(26);
    expect(ev("=((1+2)*(3+4))")).toBe(21);
  });

  it("степень: как в Excel — слева направо, унарный минус сильнее", () => {
    expect(ev("=2^3")).toBe(8);
    expect(ev("=2^3^2")).toBe(64);
    expect(ev("=-2^2")).toBe(4);
    expect(ev("=2^-1")).toBe(0.5);
    expect(ev("=2*3^2")).toBe(18);
    expect(ev("=4^0,5")).toBe(2);
  });

  it("унарные +/− и проценты", () => {
    expect(ev("=-5+3")).toBe(-2);
    expect(ev("=--3")).toBe(3);
    expect(ev("=2*-3")).toBe(-6);
    expect(ev("=+4")).toBe(4);
    expect(ev("=10%")).toBe(0.1);
    expect(ev("=50%*200")).toBe(100);
    expect(ev("=200+10%")).toBe(200.1);
  });

  it("десятичная запятая и точка", () => {
    expect(ev("=1,5+1")).toBe(2.5);
    expect(ev("=1.5+1")).toBe(2.5);
    expect(ev("=.5+.5")).toBe(1);
    expect(ev("=1E3")).toBe(1000);
    expect(ev("=2,5*2")).toBe(5);
  });

  it("плавающая арифметика округляется до 15 цифр", () => {
    expect(ev("=0,1+0,2")).toBe(0.3);
    expect(ev("=0,1+0,2=0,3")).toBe(true);
    expect(ev("=1-0,9")).toBe(0.1);
    expect(ev("=1,1*1,1")).toBe(1.21);
  });

  it("пробелы и регистр функций не важны", () => {
    expect(ev("=  1  +  2 ")).toBe(3);
    expect(ev("=сумм(1;2)")).toBe(3);
    expect(ev("=Sum(1;2)")).toBe(3);
  });

  it("типографские знаки с телефона", () => {
    expect(ev("=5−2")).toBe(3);
    expect(ev("=3×4")).toBe(12);
    expect(ev("=8÷2")).toBe(4);
    expect(ev("=3≥2")).toBe(true);
    expect(ev("=3≤2")).toBe(false);
    expect(ev("=3≠2")).toBe(true);
  });

  it("числа из текста при арифметике", () => {
    expect(ev('="3"+4')).toBe(7);
    expect(ev('="1,5"*2')).toBe(3);
    expect(ev("=A1+1", { A1: "5" })).toBe(6);
    expect(ev("=A1+1", { A1: "1,5" })).toBe(2.5);
    expect(ev("=TRUE+1")).toBe(2);
    expect(ev("=A9+1")).toBe(1);
  });
});

describe("текст и сравнения", () => {
  it("склейка &", () => {
    expect(ev('="a"&"b"')).toBe("ab");
    expect(ev('="x"&1,5')).toBe("x1,5");
    expect(ev('="Say ""hi"""')).toBe('Say "hi"');
    expect(ev('="a"&A1', { A1: 5 })).toBe("a5");
    expect(ev('=A1&" "&B1', { A1: "Aidar", B1: "Nur" })).toBe("Aidar Nur");
    expect(ev("=1&2+3")).toBe("15"); // & слабее +
    expect(ev('=“ab”&"c"')).toBe("abc"); // «умные» кавычки телефона
    expect(ev("=TRUE&1")).toBe("ИСТИНА1");
  });

  it("сравнения чисел и текста", () => {
    expect(ev("=1<2")).toBe(true);
    expect(ev("=2<=2")).toBe(true);
    expect(ev("=3>=4")).toBe(false);
    expect(ev("=1<>1")).toBe(false);
    expect(ev("=2=2")).toBe(true);
    expect(ev('="a"="A"')).toBe(true);
    expect(ev('="a"<"b"')).toBe(true);
    expect(ev('="б">"а"')).toBe(true);
    expect(ev('=2>="2"')).toBe(false); // число меньше текста
    expect(ev("=TRUE>5")).toBe(true);
  });

  it("пустая ячейка равна 0 и пустой строке", () => {
    expect(ev("=A1=0")).toBe(true);
    expect(ev('=A1=""')).toBe(true);
    expect(ev("=A1=B1")).toBe(true);
    expect(ev("=A1<1")).toBe(true);
  });

  it("сравнение приоритетнее… слабее всех", () => {
    expect(ev("=1+1=2")).toBe(true);
    expect(ev('=1&1="11"')).toBe(true);
  });
});

describe("ссылки и диапазоны", () => {
  const col = { A1: 1, A2: 2, A3: 3, A4: 4 };

  it("ссылки любого вида читают ту же ячейку", () => {
    expect(ev("=A1+$A$2+A$3+$A4", col)).toBe(10);
    expect(ev("=a1+b1", { A1: 2, B1: 3 })).toBe(5);
  });

  it("диапазоны: столбец, строка, прямоугольник, перевёрнутый", () => {
    const grid = { A1: 1, B1: 2, A2: 3, B2: 4 };
    expect(ev("=SUM(A1:A2)", grid)).toBe(4);
    expect(ev("=SUM(A1:B1)", grid)).toBe(3);
    expect(ev("=SUM(A1:B2)", grid)).toBe(10);
    expect(ev("=SUM(B2:A1)", grid)).toBe(10);
    expect(ev("=SUM($A$1:$B$2)", grid)).toBe(10);
  });

  it("огромный диапазон не зависает", () => {
    // формула лежит вне диапазона, иначе это был бы цикл
    expect(ev("=SUM(A1:A1048576)", { A1: 1, A5: 2 })).toBe(3);
    expect(ev("=SUM(B1:XFD9998)", { A1: 1, B5: 2 })).toBe(2);
    expect(ev("=COUNTIF(A1:A1048576;\"\")", { A1: 1 })).toBe(1048576 - 1);
  });

  it("ссылка на формулу, объявленную позже", () => {
    expect(evaluateSheet({ A3: "=A2+1", A2: "=A1+1", A1: 1 }).values).toMatchObject({ A1: 1, A2: 2, A3: 3 });
  });

  it("ключи листа: регистр и пустые ячейки", () => {
    const r = evaluateSheet({ a1: "5", B1: "=a1*2", c1: "", d1: null });
    expect(r.values).toEqual({ A1: 5, B1: 10 });
    expect(r.get("b1")).toBe(10);
    expect(r.get("$B$1")).toBe(10);
    expect(r.get("Z9")).toBeNull();
  });

  it("ввод: числа, запятая, логические, текст", () => {
    const r = evaluateSheet({ A1: "5", A2: "1,5", A3: "50%", A4: "TRUE", A5: "привет", A6: "  7 ", A7: "=" });
    expect(r.values).toMatchObject({ A1: 5, A2: 1.5, A3: 0.5, A4: true, A5: "привет", A6: 7, A7: "=" });
  });

  it("длинная цепочка зависимостей считается без рекурсии", () => {
    const cells: SheetInput = { A1: 1 };
    for (let i = 2; i <= 3000; i++) cells[`A${i}`] = `=A${i - 1}+1`;
    expect(evaluateSheet(cells).get("A3000")).toBe(3000);
  });
});

describe("функции: имена и разделители", () => {
  const nums = { A1: 4, A2: 8, A3: 6 };

  it("русские и английские имена совпадают", () => {
    const pairs: [string, string][] = [
      ["СУММ(A1:A3)", "SUM(A1:A3)"],
      ["СРЗНАЧ(A1:A3)", "AVERAGE(A1:A3)"],
      ["МИН(A1:A3)", "MIN(A1:A3)"],
      ["МАКС(A1:A3)", "MAX(A1:A3)"],
      ["СЧЁТ(A1:A3)", "COUNT(A1:A3)"],
      ["СЧЁТЗ(A1:A3)", "COUNTA(A1:A3)"],
      ["СЧЁТЕСЛИ(A1:A3;\">4\")", "COUNTIF(A1:A3;\">4\")"],
      ["СУММЕСЛИ(A1:A3;\">4\")", "SUMIF(A1:A3;\">4\")"],
      ["ЕСЛИ(A1>3;1;2)", "IF(A1>3;1;2)"],
      ["ОКРУГЛ(A1/3;1)", "ROUND(A1/3;1)"],
      ["ABS(-A1)", "ABS(-A1)"],
      ["И(A1>1;A2>1)", "AND(A1>1;A2>1)"],
      ["ИЛИ(A1>9;A2>9)", "OR(A1>9;A2>9)"],
      ["НЕ(A1>9)", "NOT(A1>9)"],
      ["ПРОИЗВЕД(A1:A2)", "PRODUCT(A1:A2)"],
      ["ЦЕЛОЕ(A1/3)", "INT(A1/3)"],
      ["ОСТАТ(A2;3)", "MOD(A2;3)"],
      ["КОРЕНЬ(A1)", "SQRT(A1)"],
      ["ЕСЛИОШИБКА(1/0;5)", "IFERROR(1/0;5)"],
    ];
    for (const [ru, en] of pairs) {
      const a = ev("=" + ru, nums);
      expect(isError(a), ru).toBe(false);
      expect(ev("=" + en, nums), ru).toEqual(a);
    }
  });

  it("«ё» не обязательна: СЧЕТ = СЧЁТ", () => {
    expect(ev("=СЧЕТ(A1:A3)", nums)).toBe(3);
    expect(ev("=счётесли(A1:A3;4)", nums)).toBe(1);
    expect(ev("=СЧЕТЕСЛИ(A1:A3;4)", nums)).toBe(1);
  });

  it("все функции из таблицы названий существуют", () => {
    expect(FUNCTION_NAMES.length).toBeGreaterThanOrEqual(12);
    for (const f of FUNCTION_NAMES) {
      expect(ev(`=${f.ru}()`, {}), f.ru).not.toEqual(err("#ИМЯ?"));
      expect(ev(`=${f.en}()`, {}), f.en).not.toEqual(err("#ИМЯ?"));
    }
  });

  it("разделитель «;» и «,»", () => {
    expect(ev("=СУММ(A1;A2;A3)", nums)).toBe(18);
    expect(ev("=SUM(A1,A2,A3)", nums)).toBe(18);
    expect(ev("=SUM(A1:A3,10)", nums)).toBe(28);
    expect(ev("=SUM(A1:A2;A3)", nums)).toBe(18);
    expect(ev("=IF(A1>3,1,2)", nums)).toBe(1);
    expect(ev("=ЕСЛИ(A1>3;\"да\";\"нет\")", nums)).toBe("да");
  });

  it("десятичная запятая рядом с «;»", () => {
    expect(ev("=СУММ(A1:A3;1,5)", nums)).toBe(19.5);
    expect(ev("=ОКРУГЛ(3,14159;2)")).toBe(3.14);
    expect(ev("=ROUND(3.14159,2)")).toBe(3.14);
    expect(ev("=ROUND(3,14159;2)")).toBe(3.14);
    expect(ev("=СУММ(1,5)")).toBe(1.5); // русская функция: запятая — десятичная
    expect(ev("=SUM(1,5)")).toBe(6); // английская: разделитель
    expect(ev("=СУММ(1,5;2)")).toBe(3.5);
    expect(ev("=ЕСЛИ(A1>3,5;\"да\";\"нет\")", nums)).toBe("да");
  });

  it("неверное число аргументов — #ЗНАЧ!", () => {
    expect(ev("=SUM()")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=ABS(1;2)")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=ROUND(1)")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=IF(1)")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=COUNTIF(A1:A2)")).toEqual(err("#ЗНАЧ!"));
  });
});

describe("функции: результаты", () => {
  it("СУММ: текст в диапазоне пропускается, в аргументе — нет", () => {
    const c = { A1: 1, A2: "x", A3: 3, A4: "TRUE" };
    expect(ev("=SUM(A1:A4)", c)).toBe(4);
    expect(ev('=SUM("x";1)')).toEqual(err("#ЗНАЧ!"));
    expect(ev('=SUM("3";4)')).toBe(7);
    expect(ev("=SUM(TRUE;1)")).toBe(2);
    expect(ev("=SUM(A1;A2;A3)", c)).toBe(4); // ссылки ведут себя как диапазон
    expect(ev("=SUM(1,1;2,2)")).toBe(3.3);
  });

  it("СРЗНАЧ / МИН / МАКС / СЧЁТ", () => {
    const c = { A1: 4, A2: 8, A3: 6, A4: "т" };
    expect(ev("=AVERAGE(A1:A4)", c)).toBe(6);
    expect(ev("=MIN(A1:A4)", c)).toBe(4);
    expect(ev("=MAX(A1:A4)", c)).toBe(8);
    expect(ev("=COUNT(A1:A4)", c)).toBe(3);
    expect(ev("=COUNTA(A1:A4)", c)).toBe(4);
    expect(ev("=AVERAGE(B1:B3)")).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=MIN(B1:B3)")).toBe(0);
    expect(ev("=MAX(B1:B3)")).toBe(0);
    expect(ev("=COUNT(B1:B3)")).toBe(0);
    expect(ev("=MAX(-5;-2)")).toBe(-2);
    expect(ev("=AVERAGE(1;2;3;4)")).toBe(2.5);
  });

  it("СЧЁТ: числа в тексте и логические прямо в аргументах считаются, ошибки — нет", () => {
    expect(ev('=COUNT(1;"2";"x";TRUE)')).toBe(3);
    expect(ev("=COUNT(A1:A2)", { A1: "=1/0", A2: 5 })).toBe(1);
  });

  it("ПРОИЗВЕД", () => {
    expect(ev("=PRODUCT(2;3;4)")).toBe(24);
    expect(ev("=PRODUCT(B1:B2)")).toBe(0);
  });

  it("ЕСЛИ: ленивые ветви, пустая ветвь, текстовое условие", () => {
    expect(ev('=IF(1>2;"a";"b")')).toBe("b");
    expect(ev("=IF(TRUE;1;1/0)")).toBe(1);
    expect(ev("=IF(FALSE;1/0;2)")).toBe(2);
    expect(ev("=IF(FALSE;1)")).toBe(false);
    expect(ev("=IF(A1;1;2)")).toBe(2);
    expect(ev("=IF(5;1;2)")).toBe(1);
    expect(ev("=IF(1;;3)")).toBe(0);
    expect(ev('=IF("TRUE";1;2)')).toBe(1);
    expect(ev('=IF("abc";1;2)')).toEqual(err("#ЗНАЧ!"));
    expect(ev("=IF(1/0;1;2)")).toEqual(err("#ДЕЛ/0!"));
    expect(ev('=IF(A1>=90;"5";IF(A1>=70;"4";"3"))', { A1: 75 })).toBe("4");
    expect(ev("=IF(1;B1)")).toBe(0);
  });

  it("И / ИЛИ / НЕ", () => {
    expect(ev("=AND(1<2;2<3)")).toBe(true);
    expect(ev("=AND(1<2;2>3)")).toBe(false);
    expect(ev("=OR(1>2;2>3)")).toBe(false);
    expect(ev("=OR(1>2;3>2)")).toBe(true);
    expect(ev("=AND(A1:A3)", { A1: 1, A2: 2, A3: 3 })).toBe(true);
    expect(ev("=AND(A1:A3)", { A1: 1, A2: 0 })).toBe(false);
    expect(ev("=AND(A1:A2)", { A1: "x" })).toEqual(err("#ЗНАЧ!")); // в диапазоне нет логических значений
    expect(ev('=AND("x")')).toEqual(err("#ЗНАЧ!"));
    expect(ev("=NOT(TRUE)")).toBe(false);
    expect(ev("=NOT(0)")).toBe(true);
    expect(ev("=ИСТИНА")).toBe(true);
    expect(ev("=ЛОЖЬ")).toBe(false);
    expect(ev("=И(ИСТИНА;ЛОЖЬ)")).toBe(false);
  });

  it("ОКРУГЛ: от нуля, отрицательные разряды, без ошибок двоичной дроби", () => {
    expect(ev("=ROUND(2,5;0)")).toBe(3);
    expect(ev("=ROUND(-2,5;0)")).toBe(-3);
    expect(ev("=ROUND(1,005;2)")).toBe(1.01);
    expect(ev("=ROUND(2,675;2)")).toBe(2.68);
    expect(ev("=ROUND(1234,567;-2)")).toBe(1200);
    expect(ev("=ROUND(1250;-2)")).toBe(1300);
    expect(ev("=ROUND(3,14159;3)")).toBe(3.142);
    expect(ev("=ROUND(0;2)")).toBe(0);
    expect(ev("=ROUND(A1/3;2)", { A1: 10 })).toBe(3.33);
    expect(ev("=ROUND(2,5;0,9)")).toBe(3); // разряды усекаются до целого
    expect(roundHalfAway(0.5, 0)).toBe(1);
    expect(roundHalfAway(-0.5, 0)).toBe(-1);
  });

  it("ABS, ЦЕЛОЕ, ОСТАТ, КОРЕНЬ", () => {
    expect(ev("=ABS(-5)")).toBe(5);
    expect(ev("=ABS(5)")).toBe(5);
    expect(ev('=ABS("-3")')).toBe(3);
    expect(ev("=INT(-2.5)")).toBe(-3);
    expect(ev("=ЦЕЛОЕ(2,9)")).toBe(2);
    expect(ev("=INT(2,9)")).toEqual(err("#ЗНАЧ!")); // английская функция: запятая — разделитель
    expect(ev("=MOD(10;3)")).toBe(1);
    expect(ev("=MOD(-10;3)")).toBe(2);
    expect(ev("=MOD(5;0)")).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=SQRT(16)")).toBe(4);
    expect(ev("=SQRT(-1)")).toEqual(err("#ЧИСЛО!"));
  });
});

describe("СЧЁТЕСЛИ / СУММЕСЛИ", () => {
  const grades = { A1: 5, A2: 4, A3: 5, A4: 3, A5: 4, A6: 5, A7: 2, A8: '="5"' }; // A8 — текст «5»

  it("число и условия сравнения", () => {
    expect(ev("=COUNTIF(A1:A8;5)", grades)).toBe(4); // число 5 ×3 и текст «5»
    expect(ev('=COUNTIF(A1:A8;">=4")', grades)).toBe(5);
    expect(ev('=COUNTIF(A1:A8;">3")', grades)).toBe(5);
    expect(ev('=COUNTIF(A1:A8;"<3")', grades)).toBe(1);
    expect(ev('=COUNTIF(A1:A8;"<=3")', grades)).toBe(2);
    expect(ev('=COUNTIF(A1:A8;"<>5")', grades)).toBe(4);
    expect(ev('=COUNTIF(A1:A8;"=4")', grades)).toBe(2);
    expect(ev('=COUNTIF(A1:A8;"5")', grades)).toBe(4);
    expect(ev("=COUNTIF(A1:A8;B1)", { ...grades, B1: 3 })).toBe(1);
    expect(ev('=COUNTIF(A1:A8;">"&B1)', { ...grades, B1: 4 })).toBe(3);
    expect(ev('=COUNTIF(A1:A8;"1,5")', { A1: 1.5 })).toBe(1);
  });

  it("текст: без учёта регистра, подстановки, пустые", () => {
    const c = { A1: "Astana", A2: "almaty", A3: "ASTANA", A4: "Shymkent", A5: 7 };
    expect(ev('=COUNTIF(A1:A6;"astana")', c)).toBe(2);
    expect(ev('=COUNTIF(A1:A6;"a*")', c)).toBe(3);
    expect(ev('=COUNTIF(A1:A6;"*ent")', c)).toBe(1);
    expect(ev('=COUNTIF(A1:A6;"?stana")', c)).toBe(2);
    expect(ev('=COUNTIF(A1:A6;"<>astana")', c)).toBe(4); // включая число и пустую
    expect(ev('=COUNTIF(A1:A6;"")', c)).toBe(1); // пустая A6
    expect(ev('=COUNTIF(A1:A6;"<>")', c)).toBe(5);
    expect(ev('=COUNTIF(A1:A3;"a~*")', { A1: "a*", A2: "ab" })).toBe(1);
    expect(ev('=COUNTIF(A1:A3;">b")', { A1: "a", A2: "c", A3: 9 })).toBe(1);
    expect(ev("=COUNTIF(A1:A3;TRUE)", { A1: true, A2: 1, A3: false })).toBe(1);
  });

  it("СЧЁТЕСЛИ: диапазон обязателен, ошибка в условии передаётся", () => {
    expect(ev("=COUNTIF(5;5)")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=COUNTIF(A1:A3;1/0)")).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=COUNTIF(A1:A3;1)", { A1: "=1/0", A2: 1 })).toBe(1);
  });

  it("СУММЕСЛИ: по тому же диапазону и по диапазону сумм", () => {
    const c = { A1: "Astana", A2: "Almaty", A3: "Astana", A4: "Shymkent", B1: 100, B2: 50, B3: 25, B4: 10 };
    expect(ev('=SUMIF(A1:A4;"Astana";B1:B4)', c)).toBe(125);
    expect(ev('=SUMIF(A1:A4;"almaty";B1:B4)', c)).toBe(50);
    expect(ev('=SUMIF(B1:B4;">20")', c)).toBe(175);
    expect(ev('=SUMIF(B1:B4;"<=25")', c)).toBe(35);
    expect(ev('=SUMIF(A1:A4;"A*";B1:B4)', c)).toBe(175);
    expect(ev('=SUMIF(A1:A4;"Oral";B1:B4)', c)).toBe(0);
    expect(ev('=SUMIF(A1:A4;"Astana";B2:B5)', c)).toBe(50 + 10); // диапазон сумм смещён вместе с условием
    expect(ev('=SUMIF(A1:A4;"Astana";B1)', c)).toBe(125); // достаточно левой верхней ячейки
    expect(ev("=SUMIF(5;5)")).toEqual(err("#ЗНАЧ!"));
    expect(ev('=SUMIF(A1:A2;"x";B1)', { A1: "x", B1: "=1/0" })).toEqual(err("#ДЕЛ/0!"));
  });
});

describe("ошибки", () => {
  it("#ДЕЛ/0!", () => {
    expect(ev("=1/0")).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=A1/B1", { A1: 5 })).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=0^-1")).toEqual(err("#ДЕЛ/0!"));
  });

  it("#ЗНАЧ!", () => {
    expect(ev('="a"+1')).toEqual(err("#ЗНАЧ!"));
    expect(ev('=""+1')).toEqual(err("#ЗНАЧ!"));
    expect(ev("=A1*2", { A1: "abc" })).toEqual(err("#ЗНАЧ!"));
    expect(ev("=A1:A3")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=ABS(A1:A3)")).toEqual(err("#ЗНАЧ!"));
  });

  it("неразобранная формула — #ЗНАЧ! и запись в parseErrors", () => {
    const r = evaluateSheet({ A1: "=1+", A2: "=(1", A3: '="x', A4: "=1 2", A5: "=SUM(" });
    for (const a of ["A1", "A2", "A3", "A4", "A5"]) {
      expect(r.get(a)).toEqual(err("#ЗНАЧ!"));
      expect(r.parseErrors[a]).toBeDefined();
    }
  });

  it("#ИМЯ?", () => {
    expect(ev("=ФУНК(1)")).toEqual(err("#ИМЯ?"));
    expect(ev("=abc")).toEqual(err("#ИМЯ?"));
    expect(ev("=1+abc")).toEqual(err("#ИМЯ?"));
    expect(ev("=СУММ(A1:A3)+СУММА(A1)")).toEqual(err("#ИМЯ?"));
  });

  it("#ССЫЛКА! и другие литералы ошибок", () => {
    expect(ev("=#REF!")).toEqual(err("#ССЫЛКА!"));
    expect(ev("=#ССЫЛКА!+1")).toEqual(err("#ССЫЛКА!"));
    expect(ev("=SUM(#REF!;1)")).toEqual(err("#ССЫЛКА!"));
    expect(ev("=#DIV/0!")).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=#VALUE!")).toEqual(err("#ЗНАЧ!"));
    expect(ev("=#NAME?")).toEqual(err("#ИМЯ?"));
    expect(ev("=#ЧИСЛО!")).toEqual(err("#ЧИСЛО!"));
  });

  it("#ЧИСЛО!", () => {
    expect(ev("=0^0")).toEqual(err("#ЧИСЛО!"));
    expect(ev("=10^400")).toEqual(err("#ЧИСЛО!"));
    expect(ev("=(-8)^(1/3)")).toEqual(err("#ЧИСЛО!"));
  });

  it("ошибка распространяется по ячейкам и функциям", () => {
    const c = { A1: "=1/0", A2: 5, B1: "=A1+1", B2: "=SUM(A1:A2)", B3: "=MAX(A1:A2)", B4: "=A1&\"x\"", B5: "=IF(A2>1;A1;0)" };
    const r = evaluateSheet(c);
    for (const a of ["A1", "B1", "B2", "B3", "B4", "B5"]) expect(r.get(a), a).toEqual(err("#ДЕЛ/0!"));
  });

  it("ЕСЛИОШИБКА ловит любую ошибку", () => {
    expect(ev("=IFERROR(1/0;\"нет\")")).toBe("нет");
    expect(ev("=IFERROR(5;\"нет\")")).toBe(5);
    expect(ev("=IFERROR(A1;7)", { A1: "=abc" })).toBe(7);
  });

  it("isError и коды", () => {
    expect(isError(err("#ЗНАЧ!"))).toBe(true);
    expect(isError(0)).toBe(false);
    expect(isError(null)).toBe(false);
    expect(ERROR_CODES).toContain("#ЦИКЛ!");
  });
});

describe("циклические ссылки", () => {
  it("прямая и косвенная", () => {
    const r = evaluateSheet({ A1: "=B1", B1: "=A1" });
    expect(r.get("A1")).toEqual(err("#ЦИКЛ!"));
    expect(r.get("B1")).toEqual(err("#ЦИКЛ!"));
    const s = evaluateSheet({ A1: "=A1+1" });
    expect(s.get("A1")).toEqual(err("#ЦИКЛ!"));
    const t = evaluateSheet({ A1: "=B1", B1: "=C1", C1: "=A1" });
    for (const a of ["A1", "B1", "C1"]) expect(t.get(a)).toEqual(err("#ЦИКЛ!"));
  });

  it("цикл через диапазон", () => {
    const r = evaluateSheet({ A1: 1, A2: "=SUM(A1:A3)", A3: 3 });
    expect(r.get("A2")).toEqual(err("#ЦИКЛ!"));
    expect(r.get("A1")).toBe(1);
  });

  it("цикл в ленивой ветви ЕСЛИ всё равно цикл", () => {
    expect(evaluateSheet({ A1: "=IF(TRUE;1;A1)" }).get("A1")).toEqual(err("#ЦИКЛ!"));
  });

  it("зависящие от цикла получают ошибку, остальные считаются", () => {
    const r = evaluateSheet({ A1: "=B1", B1: "=A1", C1: "=A1+1", D1: "=2*3", E1: "=D1+1" });
    expect(r.get("C1")).toEqual(err("#ЦИКЛ!"));
    expect(r.get("D1")).toBe(6);
    expect(r.get("E1")).toBe(7);
  });

  it("не цикл: ячейка читает соседей по цепочке и ромб", () => {
    const r = evaluateSheet({ A1: 1, B1: "=A1+1", C1: "=A1+2", D1: "=B1+C1" });
    expect(r.get("D1")).toBe(5);
  });
});

describe("shiftFormula: копирование формулы", () => {
  it("относительные ссылки", () => {
    expect(shiftFormula("=A1+B1", 1, 0)).toBe("=A2+B2");
    expect(shiftFormula("=A1+B1", 0, 1)).toBe("=B1+C1");
    expect(shiftFormula("=A1+B1", 3, 2)).toBe("=C4+D4");
    expect(shiftFormula("=A5", -2, 0)).toBe("=A3");
    expect(shiftFormula("=C3", 0, -2)).toBe("=A3");
    expect(shiftFormula("=A1", 0, 0)).toBe("=A1");
  });

  it("абсолютные и смешанные", () => {
    expect(shiftFormula("=$A$1+A1", 2, 2)).toBe("=$A$1+C3");
    expect(shiftFormula("=A$1+$A1", 3, 3)).toBe("=D$1+$A4");
    expect(shiftFormula("=B2/$B$6*100", 1, 0)).toBe("=B3/$B$6*100");
    expect(shiftFormula("=$A2*B$1", 2, 3)).toBe("=$A4*E$1");
  });

  it("диапазоны", () => {
    expect(shiftFormula("=SUM(A1:B5)", 1, 0)).toBe("=SUM(A2:B6)");
    expect(shiftFormula("=SUM(A1:B5)", 0, 2)).toBe("=SUM(C1:D5)");
    expect(shiftFormula("=SUM($A$1:A5)", 0, 1)).toBe("=SUM($A$1:B5)");
    expect(shiftFormula("=SUM(A$1:A5)", 2, 0)).toBe("=SUM(A$1:A7)");
    expect(shiftFormula("=СУММ(B2:B4)/МАКС($B$2:$B$4)", 0, 1)).toBe("=СУММ(C2:C4)/МАКС($B$2:$B$4)");
  });

  it("строки, пробелы, разделители и запятая сохраняются", () => {
    expect(shiftFormula('="A1"&A1', 1, 0)).toBe('="A1"&A2');
    expect(shiftFormula("= A1 + B1 ", 1, 0)).toBe("= A2 + B2 ");
    expect(shiftFormula("=СУММ(A1;B2)", 1, 1)).toBe("=СУММ(B2;C3)");
    expect(shiftFormula("=A1*1,5", 1, 0)).toBe("=A2*1,5");
    expect(shiftFormula("=IF(A1>=10;\"сдал\";\"не сдал\")", 2, 0)).toBe("=IF(A3>=10;\"сдал\";\"не сдал\")");
    expect(shiftFormula("=a1", 1, 0)).toBe("=A2");
    expect(shiftFormula("=LOG10(A1)", 1, 0)).toBe("=LOG10(A2)");
    expect(shiftFormula("=A1&“B1”", 1, 0)).toBe("=A2&“B1”");
  });

  it("за край таблицы — #ССЫЛКА!", () => {
    expect(shiftFormula("=A1+B1", -1, 0)).toBe("=#ССЫЛКА!+#ССЫЛКА!");
    expect(shiftFormula("=B1", 0, -2)).toBe("=#ССЫЛКА!");
    expect(shiftFormula("=B2+$A$1", -2, 0)).toBe("=#ССЫЛКА!+$A$1");
    expect(shiftFormula("=SUM(A1:A3)", -1, 0)).toBe("=SUM(#ССЫЛКА!)");
    expect(shiftFormula("=SUM(A1:A3)+B5", -1, 0)).toBe("=SUM(#ССЫЛКА!)+B4");
    expect(shiftFormula("=XFD1", 0, 1)).toBe("=#ССЫЛКА!");
    expect(shiftFormula("=A1048576", 1, 0)).toBe("=#ССЫЛКА!");
  });

  it("не формула и неразобранная — без изменений", () => {
    expect(shiftFormula("5", 1, 1)).toBe("5");
    expect(shiftFormula("текст A1", 1, 1)).toBe("текст A1");
    expect(shiftFormula('="abc', 1, 1)).toBe('="abc');
    expect(shiftFormula("", 1, 1)).toBe("");
  });

  it("скопированная формула считается как в Excel", () => {
    const cells = { A1: 2, A2: 3, A3: 4, B1: "=A1*10" };
    const r = evaluateSheet({ ...cells, B2: shiftFormula("=A1*10", 1, 0), B3: shiftFormula("=A1*10", 2, 0) });
    expect([r.get("B1"), r.get("B2"), r.get("B3")]).toEqual([20, 30, 40]);
  });

  it("сдвиг на (0,0) и обратный сдвиг возвращают исходную формулу", () => {
    const f = "=$A2*B$1+SUM(C3:D4)-$E$5";
    expect(shiftFormula(shiftFormula(f, 3, 2), -3, -2)).toBe(f);
  });

  it("ошибка из-за сдвига видна в значении", () => {
    expect(evaluateSheet({ A1: shiftFormula("=B1+1", -1, 0) }).get("A1")).toEqual(err("#ССЫЛКА!"));
  });
});

describe("fillCells / copyInput: протянуть", () => {
  it("вниз: формула сдвигается, абсолютные ссылки остаются", () => {
    const base = { A1: "40", A2: "25", A3: "35", B1: "=A1/$A$5*100", A5: "=SUM(A1:A3)" };
    const { cells, filled } = fillCells(base, "B1", "down", 2);
    expect(filled).toEqual(["B2", "B3"]);
    expect(cells.B2).toBe("=A2/$A$5*100");
    expect(cells.B3).toBe("=A3/$A$5*100");
    const r = evaluateSheet(cells);
    expect(r.get("B1")).toBe(40);
    expect(r.get("B2")).toBe(25);
    expect(r.get("B3")).toBe(35);
  });

  it("вправо; число и текст копируются как есть; пустая очищает", () => {
    expect(fillCells({ A1: "=B1+1" }, "A1", "right", 2).cells).toMatchObject({ B1: "=C1+1", C1: "=D1+1" });
    expect(fillCells({ A1: "7" }, "A1", "down", 2).cells).toMatchObject({ A2: "7", A3: "7" });
    expect(fillCells({ A1: "a", A2: "b" }, "A1", "down", 1).cells.A2).toBe("a");
    expect(fillCells({ A2: "b" }, "A1", "down", 1).cells.A2).toBeUndefined();
    expect(fillCells({ A1: "1" }, "A1", "down", 0).filled).toEqual([]);
  });

  it("обрезается по краю таблицы, исходные ячейки не меняются", () => {
    const base = { A1: "=B1" };
    const r = fillCells(base, "A1", "down", 3);
    expect(base).toEqual({ A1: "=B1" });
    expect(r.filled.length).toBe(3);
    const edge = fillCells({ XFD1: "=A1" }, "XFD1", "right", 3);
    expect(edge.filled).toEqual([]);
    expect(fillCells({ A1: "1" }, "bad", "down", 2).filled).toEqual([]);
  });

  it("таблица умножения: смешанные ссылки протянуты вправо и вниз", () => {
    let cells: Record<string, string> = { B1: "1", C1: "2", D1: "3", A2: "1", A3: "2", A4: "3", B2: "=$A2*B$1" };
    cells = fillCells(cells, "B2", "right", 2).cells;
    for (const c of ["B2", "C2", "D2"]) cells = fillCells(cells, c, "down", 2).cells;
    const r = evaluateSheet(cells);
    expect([r.get("B2"), r.get("C2"), r.get("D2")]).toEqual([1, 2, 3]);
    expect([r.get("B3"), r.get("C3"), r.get("D3")]).toEqual([2, 4, 6]);
    expect([r.get("B4"), r.get("C4"), r.get("D4")]).toEqual([3, 6, 9]);
    expect(cells.D4).toBe("=$A4*D$1");
  });

  it("copyInput", () => {
    expect(copyInput("=A1", 1, 0)).toBe("=A2");
    expect(copyInput("  =A1", 1, 0)).toBe("=A2");
    expect(copyInput("текст", 1, 0)).toBe("текст");
  });
});

describe("formulaRefs: ссылки в тексте формулы", () => {
  it("ячейки и диапазоны", () => {
    const refs = formulaRefs("=SUM(A1:B2)+$C$3");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ kind: "range", from: { col: 1, row: 1 }, to: { col: 2, row: 2 } });
    expect(refs[1]).toMatchObject({ kind: "cell", from: { col: 3, row: 3 } });
  });

  it("недописанная формула и не формула", () => {
    expect(formulaRefs("=A1+")).toHaveLength(1);
    expect(formulaRefs("=SUM(B2:")).toHaveLength(1);
    expect(formulaRefs("A1")).toEqual([]);
    expect(formulaRefs('="A1"')).toEqual([]);
  });
});

describe("format: числа, ввод и код задачи", () => {
  it("formatNumber / formatValue", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(0.1 + 0.2)).toBe("0,3");
    expect(formatNumber(1 / 3)).toBe("0,33333333333");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(1e21)).toBe("1E+21");
    expect(formatNumber(1.5e-9)).toBe("1,5E-09");
    expect(formatValue(true)).toBe("ИСТИНА");
    expect(formatValue(false)).toBe("ЛОЖЬ");
    expect(formatValue(null)).toBe("");
    expect(formatValue("abc")).toBe("abc");
    expect(formatValue(err("#ИМЯ?"))).toBe("#ИМЯ?");
    expect(numberToText(0.1 + 0.2)).toBe("0,3");
  });

  it("parseNumberText", () => {
    expect(parseNumberText("5")).toBe(5);
    expect(parseNumberText(" -3,5 ")).toBe(-3.5);
    expect(parseNumberText("2.5")).toBe(2.5);
    expect(parseNumberText("50%")).toBe(0.5);
    expect(parseNumberText("1e3")).toBe(1000);
    expect(parseNumberText(".5")).toBe(0.5);
    for (const bad of ["", "abc", "1,2,3", "5a", "--5", "1 000", "="]) expect(parseNumberText(bad)).toBeNull();
  });

  it("parseConstant / isFormula", () => {
    expect(parseConstant("")).toBeNull();
    expect(parseConstant("  ")).toBeNull();
    expect(parseConstant("12")).toBe(12);
    expect(parseConstant("true")).toBe(true);
    expect(parseConstant("ложь")).toBe(false);
    expect(parseConstant("текст")).toBe("текст");
    expect(isFormula("=A1")).toBe(true);
    expect(isFormula(" =A1")).toBe(true);
    expect(isFormula("=")).toBe(false);
    expect(isFormula("A1")).toBe(false);
    expect(isFormula(undefined)).toBe(false);
  });

  it("код задачи: JSON ↔ ячейки", () => {
    expect(parseSheetCode('{"a1":"5","B1":"=A1*2","C1":3,"D1":"","zz":"x","1A":"y","E1":null,"F1":true}')).toEqual({ A1: "5", B1: "=A1*2", C1: "3", F1: "true" });
    expect(parseSheetCode("не json")).toEqual({});
    expect(parseSheetCode("[1,2]")).toEqual({});
    expect(parseSheetCode("5")).toEqual({});
    expect(parseSheetCode("")).toEqual({});
    expect(serializeSheet({ B2: "x", A1: "1", C1: "2", A2: "" })).toBe('{"A1":"1","C1":"2","B2":"x"}');
    const cells = { A1: "5", B1: "=A1*2", A2: "текст" };
    expect(parseSheetCode(serializeSheet(cells))).toEqual(cells);
  });
});
