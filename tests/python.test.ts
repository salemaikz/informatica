import { describe, expect, it } from "vitest";
import { pythonDict } from "@/i18n/parts/python";
import { decodeCode, encodeCode, MAX_URL_CODE, MAX_URL_PARAM, pythonHref } from "@/lib/python/codec";
import { applyEdit, backspaceEdit, enterEdit, lineOffset, tabEdit } from "@/lib/python/editing";
import { classifyError, explainError, suggestName, type ErrorKind } from "@/lib/python/errors";
import { PY_EXAMPLES, pyExampleCodeKey, pyExampleTitleKey, usesInput } from "@/lib/python/examples";
import type { PyError } from "@/lib/python/types";

const err = (type: string, message = "", line: number | null = 3): PyError => ({ type, message, line });
const kind = (type: string, message = "") => classifyError(err(type, message)).kind;

describe("python: classifyError", () => {
  // Сообщения — как у CPython 3.12/3.13 (Pyodide 0.29).
  const cases: [string, string, ErrorKind][] = [
    ["SyntaxError", "expected ':'", "colon"],
    ["SyntaxError", "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", "assign"],
    ["SyntaxError", "'(' was never closed", "paren"],
    ["SyntaxError", "unmatched ')'", "paren"],
    ["SyntaxError", "closing parenthesis ']' does not match opening parenthesis '('", "paren"],
    ["SyntaxError", "unterminated string literal (detected at line 1)", "quote"],
    ["SyntaxError", "invalid character '“' (U+201C)", "char"],
    ["SyntaxError", "Missing parentheses in call to 'print'. Did you mean print(...)?", "print"],
    ["SyntaxError", "invalid syntax", "syntax"],
    ["IndentationError", "expected an indented block after 'if' statement on line 1", "indentExpected"],
    ["IndentationError", "unexpected indent", "indentUnexpected"],
    ["IndentationError", "unindent does not match any outer indentation level", "indentMismatch"],
    ["TabError", "inconsistent use of tabs and spaces in indentation", "indentMismatch"],
    ["NameError", "name 'x' is not defined", "name"],
    ["TypeError", 'can only concatenate str (not "int") to str', "mix"],
    ["TypeError", "unsupported operand type(s) for +: 'int' and 'str'", "mix"],
    ["TypeError", "'<' not supported between instances of 'str' and 'int'", "mix"],
    ["TypeError", "'list' object is not callable", "type"],
    ["ZeroDivisionError", "division by zero", "zero"],
    ["IndexError", "list index out of range", "index"],
    ["ValueError", "invalid literal for int() with base 10: 'abc'", "notNumber"],
    ["ValueError", "could not convert string to float: 'x'", "notNumber"],
    ["ValueError", "math domain error", "value"],
    ["EOFError", "input(): not enough input lines", "eof"],
    ["RecursionError", "maximum recursion depth exceeded", "recursion"],
    ["KeyError", "'b'", "key"],
    ["AttributeError", "'str' object has no attribute 'append'", "attr"],
    ["Timeout", "> 5 s", "timeout"],
    ["TooManySteps", "more than 1000 steps", "steps"],
    ["LoadError", "load timeout", "load"],
    ["OverflowError", "int too large", "generic"],
  ];
  it.each(cases)("%s: %s → %s", (type, message, expected) => {
    expect(kind(type, message)).toBe(expected);
  });

  it("достаёт значение из ValueError int()", () => {
    expect(classifyError(err("ValueError", "invalid literal for int() with base 10: 'пять'")).params.value).toBe("пять");
  });

  it("NameError: имя и подсказка", () => {
    expect(classifyError(err("NameError", "name 'Print' is not defined")).params).toEqual({ name: "Print", suggest: "print" });
    expect(classifyError(err("NameError", "name 'pritn' is not defined")).params.suggest).toBe("print");
    expect(classifyError(err("NameError", "name 'total' is not defined")).params.suggest).toBeUndefined();
    expect(classifyError(err("NameError", "name 'lenght' is not defined. Did you mean: 'length'?")).params.suggest).toBe("length");
  });
});

describe("python: suggestName", () => {
  it("регистр и одна опечатка", () => {
    expect(suggestName("PRINT")).toBe("print");
    expect(suggestName("Input")).toBe("input");
    expect(suggestName("rnage")).toBe("range");
    expect(suggestName("prin")).toBe("print");
    expect(suggestName("true")).toBe("True");
    expect(suggestName("x")).toBeNull();
    expect(suggestName("print")).toBeNull();
  });
});

describe("python: explainError", () => {
  it("тексты на ru и kk, с номером строки и подстановками", () => {
    const e = err("ValueError", "invalid literal for int() with base 10: 'abc'", 2);
    const ru = explainError(e, "ru");
    const kk = explainError(e, "kk");
    expect(ru.line).toBe(2);
    expect(ru.title).toContain("abc");
    expect(kk.title).toContain("abc");
    expect(ru.title).not.toBe(kk.title);
    expect(ru.hint).not.toMatch(/\{\w+\}/);
  });

  it("NameError с подсказкой добавляет «возможно…»", () => {
    const ru = explainError(err("NameError", "name 'Print' is not defined"), "ru");
    expect(ru.title).toContain("Print");
    expect(ru.hint).toContain("«print»");
    const kk = explainError(err("NameError", "name 'Print' is not defined"), "kk");
    expect(kk.hint).toContain("«print»");
  });

  it("у каждого вида есть заголовок и подсказка на обоих языках", () => {
    const kinds = new Set<ErrorKind>([
      "syntax", "colon", "assign", "paren", "quote", "char", "print", "indentExpected", "indentUnexpected", "indentMismatch",
      "name", "mix", "type", "zero", "index", "notNumber", "value", "eof", "recursion", "key", "attr", "timeout", "steps", "load", "generic",
    ]);
    const dict = pythonDict as Record<string, { ru: string; kk: string }>;
    for (const k of kinds) {
      for (const part of ["title", "hint"]) {
        const v = dict[`python.err.${k}.${part}`];
        expect(v, `${k}.${part}`).toBeDefined();
        expect(v.ru.length).toBeGreaterThan(0);
        expect(v.kk.length).toBeGreaterThan(0);
      }
    }
  });

  it("без номера строки — null", () => {
    expect(explainError(err("Timeout", "", null), "ru").line).toBeNull();
  });
});

describe("python: editing", () => {
  it("Tab без выделения — 4 пробела", () => {
    const e = tabEdit("ab", 1, 1, false);
    expect(applyEdit("ab", e)).toBe("a    b");
    expect([e.selStart, e.selEnd]).toEqual([5, 5]);
  });

  it("Tab по нескольким строкам сдвигает каждую (пустые не трогает)", () => {
    const v = "a\n\nb\nc";
    const e = tabEdit(v, 0, 4, false); // a … b
    expect(applyEdit(v, e)).toBe("    a\n\n    b\nc");
    expect(e.selStart).toBe(4);
    expect(e.selEnd).toBe(12);
  });

  it("Shift+Tab убирает до 4 пробелов и не уводит курсор за начало строки", () => {
    const v = "x\n      y";
    const e = tabEdit(v, 8, 8, true); // курсор перед y
    expect(applyEdit(v, e)).toBe("x\n  y");
    expect(e.selStart).toBe(4);
    const v2 = "  z";
    const e2 = tabEdit(v2, 1, 1, true);
    expect(applyEdit(v2, e2)).toBe("z");
    expect(e2.selStart).toBe(0);
  });

  it("выделение, кончающееся началом строки, следующую строку не сдвигает", () => {
    const v = "a\nb\n";
    const e = tabEdit(v, 0, 2, false);
    expect(applyEdit(v, e)).toBe("    a\nb\n");
  });

  it("Enter сохраняет отступ и углубляет после «:»", () => {
    const v = "for i in range(3):";
    const e = enterEdit(v, v.length, v.length);
    expect(applyEdit(v, e)).toBe("for i in range(3):\n    ");
    const v2 = "if x:\n    y = 1";
    const e2 = enterEdit(v2, v2.length, v2.length);
    expect(applyEdit(v2, e2)).toBe("if x:\n    y = 1\n    ");
    expect(e2.selStart).toBe(e2.selEnd);
  });

  it("Enter после return/break уменьшает отступ", () => {
    const v = "def f():\n    return 1";
    expect(applyEdit(v, enterEdit(v, v.length, v.length))).toBe("def f():\n    return 1\n");
  });

  it("Backspace в отступе удаляет до ступени в 4 пробела", () => {
    const v = "      ";
    const e = backspaceEdit(v, 6, 6)!;
    expect(applyEdit(v, e)).toBe("    ");
    expect(backspaceEdit("    x", 5, 5)).toBeNull();
    expect(backspaceEdit("x", 0, 0)).toBeNull();
    expect(backspaceEdit("    ", 0, 4)).toBeNull();
  });

  it("lineOffset находит строку", () => {
    const v = "a\nbb\nccc";
    expect(lineOffset(v, 2)).toEqual({ start: 2, end: 4 });
    expect(lineOffset(v, 3)).toEqual({ start: 5, end: 8 });
    expect(lineOffset(v, 99)).toEqual({ start: 5, end: 8 });
  });
});

describe("python: codec", () => {
  it("base64url туда и обратно, включая кириллицу и казахские буквы", () => {
    const code = 'print("Сәлем, әлем! Привет")\nx = 2 ** 10\n';
    const enc = encodeCode(code);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCode(enc)).toBe(code);
  });

  it("битая строка — null", () => {
    expect(decodeCode("@@@")).toBeNull();
    expect(decodeCode("")).toBeNull();
    expect(decodeCode(null)).toBeNull();
    expect(decodeCode("_w")).toBeNull(); // не UTF-8
  });

  it("pythonHref", () => {
    expect(pythonHref("print(1)")).toBe(`/python?code=${encodeCode("print(1)")}`);
  });

  it("слишком длинный параметр — null; обрезанная ссылка укладывается в предел и раскодируется", () => {
    expect(decodeCode("A".repeat(MAX_URL_PARAM + 4))).toBeNull();
    const huge = "😀".repeat(MAX_URL_CODE + 10);
    const param = pythonHref(huge).split("=")[1];
    expect(param.length).toBeLessThanOrEqual(MAX_URL_PARAM);
    expect(decodeCode(param)).toBe("😀".repeat(MAX_URL_CODE));
  });

  it("управляющие символы из адреса убираются, табуляция и переводы строк остаются", () => {
    expect(decodeCode(encodeCode("a\u0000b\tc\r\nd\u001b"))).toBe("ab\tc\r\nd");
  });
});

describe("python: examples", () => {
  it("8 примеров, у каждого название и код на ru и kk, код совпадает по строкам", () => {
    expect(PY_EXAMPLES).toHaveLength(8);
    for (const ex of PY_EXAMPLES) {
      const title = pythonDict[pyExampleTitleKey(ex.id)];
      const code = pythonDict[pyExampleCodeKey(ex.id)];
      expect(title.ru && title.kk).toBeTruthy();
      // Различаются только комментарии и тексты в кавычках: число строк одинаковое.
      expect(code.ru.split("\n").length).toBe(code.kk.split("\n").length);
      expect(usesInput(code.ru)).toBe(ex.stdin.length > 0);
    }
  });

  it("usesInput", () => {
    expect(usesInput("x = input()")).toBe(true);
    expect(usesInput("x = int(input ('a'))")).toBe(true);
    expect(usesInput("my_input = 5")).toBe(false);
  });
});
