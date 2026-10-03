import { describe, expect, it } from "vitest";
import { evaluateFormula, FUNCTION_NAMES, shiftFormula, type SheetInput, type Value } from "@/lib/sheet";

const ev = (f: string, cells: SheetInput = {}): Value => evaluateFormula(f, cells);
const err = (code: string) => ({ error: code });

describe("текстовые функции", () => {
  it("СТРОЧН / LOWER и ПРОПИСН / UPPER", () => {
    expect(ev('=СТРОЧН("Aidar")')).toBe("aidar");
    expect(ev('=LOWER("ЖАНДОС")')).toBe("жандос");
    expect(ev('=ПРОПИСН("қазақ")')).toBe("ҚАЗАҚ");
    expect(ev("=UPPER(A1)", { A1: "dAniyar" })).toBe("DANIYAR");
    expect(ev("=СТРОЧН(A1)", { A1: 5 })).toBe("5");
    expect(ev("=СТРОЧН(A9)")).toBe(""); // пустая ячейка
    expect(ev("=СТРОЧН(A1)", { A1: "=1/0" })).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=СТРОЧН(A1:A2)", { A1: "a", A2: "b" })).toEqual(err("#ЗНАЧ!")); // диапазон — не одно значение
    expect(ev("=СТРОЧН()")).toEqual(err("#ЗНАЧ!"));
  });

  it("ДЛСТР / LEN", () => {
    expect(ev('=ДЛСТР("Aidar")')).toBe(5);
    expect(ev('=LEN("")')).toBe(0);
    expect(ev('=LEN("a b")')).toBe(3); // пробел — символ
    expect(ev("=ДЛСТР(A1)", { A1: 12345 })).toBe(5);
    expect(ev("=ДЛСТР(A1)", { A1: 1.5 })).toBe(3); // «1,5»
    expect(ev("=ДЛСТР(A9)")).toBe(0);
    expect(ev("=ДЛСТР(A1)", { A1: "=A1+" })).toEqual(err("#ЗНАЧ!"));
  });

  it("СЦЕПИТЬ / CONCATENATE", () => {
    expect(ev('=СЦЕПИТЬ("a";"b";"c")')).toBe("abc");
    expect(ev('=CONCATENATE(A1;" ";B1)', { A1: "Aidar", B1: "Nur" })).toBe("Aidar Nur");
    expect(ev('=CONCATENATE("x",1,TRUE)')).toBe("x1ИСТИНА");
    expect(ev('=СЦЕПИТЬ("a";A9)')).toBe("a");
    expect(ev('=СЦЕПИТЬ("a";A1)', { A1: "=1/0" })).toEqual(err("#ДЕЛ/0!"));
    expect(ev("=СЦЕПИТЬ(A1:A2)", { A1: "a", A2: "b" })).toEqual(err("#ЗНАЧ!"));
    expect(ev("=СЦЕПИТЬ()")).toEqual(err("#ЗНАЧ!"));
  });

  it("ЛЕВСИМВ / LEFT", () => {
    expect(ev('=ЛЕВСИМВ("Abenov";3)')).toBe("Abe");
    expect(ev('=LEFT("Abenov")')).toBe("A"); // по умолчанию 1
    expect(ev('=LEFT("ab";10)')).toBe("ab"); // больше длины — вся строка
    expect(ev('=LEFT("ab";0)')).toBe("");
    expect(ev('=LEFT("abc";2,9)')).toBe("ab"); // дробная часть отбрасывается
    expect(ev('=LEFT("abc";-1)')).toEqual(err("#ЗНАЧ!"));
    expect(ev('=LEFT("abc";"x")')).toEqual(err("#ЗНАЧ!"));
    expect(ev("=ЛЕВСИМВ(A1;2)", { A1: 2024117 })).toBe("20");
  });

  it("ПРАВСИМВ / RIGHT", () => {
    expect(ev('=ПРАВСИМВ("Abenov";2)')).toBe("ov");
    expect(ev('=RIGHT("Abenov")')).toBe("v");
    expect(ev('=RIGHT("ab";10)')).toBe("ab");
    expect(ev('=RIGHT("ab";0)')).toBe("");
    expect(ev('=RIGHT("abc";-1)')).toEqual(err("#ЗНАЧ!"));
    expect(ev("=ПРАВСИМВ(A1;2)", { A1: 2024105 })).toBe("05"); // ведущий ноль сохраняется
  });

  it("вложение и склейка с &", () => {
    expect(ev('=ПРОПИСН(ЛЕВСИМВ(A1;3))&"-"&ПРАВСИМВ(B1;2)', { A1: "Abenov", B1: 2024117 })).toBe("ABE-17");
    expect(ev('=ЛЕВСИМВ(A1;1)&"."&ЛЕВСИМВ(B1;1)&"."', { A1: "Aidar", B1: "Nur" })).toBe("A.N.");
    expect(ev("=ДЛСТР(A1&B1)", { A1: "ab", B1: "cde" })).toBe(5);
    expect(ev('=ЕСЛИ(ДЛСТР(A1)>5;"длинно";"коротко")', { A1: "Madina" })).toBe("длинно");
  });

  it("новые функции есть в списке названий и не дают #ИМЯ?", () => {
    const names = FUNCTION_NAMES.map((f) => f.ru);
    for (const n of ["СТРОЧН", "ПРОПИСН", "ДЛСТР", "СЦЕПИТЬ", "ЛЕВСИМВ", "ПРАВСИМВ"]) expect(names).toContain(n);
    for (const n of ["lower", "Upper", "len", "concatenate", "left", "right"]) expect(ev(`=${n}("ab")`)).not.toEqual(err("#ИМЯ?"));
  });

  it("при копировании формулы ссылки в текстовых функциях сдвигаются", () => {
    expect(shiftFormula('=ПРОПИСН(ЛЕВСИМВ(A1;3))&"-"&ПРАВСИМВ($B1;2)', 1, 1)).toBe('=ПРОПИСН(ЛЕВСИМВ(B2;3))&"-"&ПРАВСИМВ($B2;2)');
  });
});
