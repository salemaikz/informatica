import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDE_REGISTRY } from "@/components/ide/registry";
import { SKILLS } from "@/content/skills";
import { checkExcel, describeSheetError, matchesExpected, type ExcelCheck } from "@/lib/ide/excel/check";
import { TASKS } from "@/lib/ide/excel/tasks";
import { CODE_XP } from "@/lib/ide/types";
import { evaluateSheet, fillCells, isError, isFormula, parseSheetCode, serializeSheet, type SheetCells } from "@/lib/sheet";
import { ideExcelDict } from "@/i18n/parts/ide-excel";

const byId = (id: string) => TASKS.find((t) => t.id === id)!;
const excel = (id: string) => byId(id).check as ExcelCheck;
const run = (id: string, cells: SheetCells) => checkExcel(excel(id), serializeSheet(cells));
const base = (id: string) => parseSheetCode(byId(id).starter);
const msg = (r: { message?: unknown }) => (typeof r.message === "string" ? r.message : ((r.message as { ru: string } | undefined)?.ru ?? ""));

describe("задачи Excel: содержимое", () => {
  it("8 задач, уникальные id, язык, уровни от A к C, навыки курса", () => {
    expect(TASKS).toHaveLength(8);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const skills = new Set(SKILLS.map((s) => s.id));
    let prev = 0;
    for (const t of TASKS) {
      expect(t.id).toMatch(/^xl-\d+-[a-z]+$/);
      expect(t.lang).toBe("excel");
      expect(t.level).toBeGreaterThanOrEqual(prev);
      prev = t.level;
      expect(t.skill && skills.has(t.skill), t.id).toBe(true);
      expect(["sheets.formulas", "sheets.refs"]).toContain(t.skill);
      expect(t.check.kind).toBe("excel");
    }
    expect(TASKS.map((t) => t.level)).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
    expect(CODE_XP[TASKS[0].level]).toBe(10);
  });

  it("двуязычность и непустота текстов", () => {
    for (const t of TASKS) {
      for (const f of [t.title, t.prompt, t.hint!]) {
        expect(f, t.id).toBeDefined();
        expect(f.ru.trim().length, t.id).toBeGreaterThan(5);
        expect(f.kk.trim().length, t.id).toBeGreaterThan(5);
        expect(f.kk, t.id).toMatch(/[Ѐ-ӿ]/);
        expect(f.kk, t.id).not.toBe(f.ru);
      }
    }
  });

  it("подсказка не содержит готовой формулы-ответа", () => {
    for (const t of TASKS) {
      const answers = Object.values(parseSheetCode(t.solution)).filter(isFormula);
      for (const a of answers) {
        expect(t.hint!.ru, t.id).not.toContain(a);
        expect(t.hint!.kk, t.id).not.toContain(a);
      }
    }
  });

  it("starter и solution — корректный JSON ячеек, без ошибок в значениях", () => {
    for (const t of TASKS) {
      for (const code of [t.starter, t.solution]) {
        const parsed = JSON.parse(code);
        expect(typeof parsed).toBe("object");
        expect(Object.keys(parseSheetCode(code)).length, t.id).toBe(Object.keys(parsed).length);
        const r = evaluateSheet(parseSheetCode(code));
        for (const [addr, v] of Object.entries(r.values)) expect(isError(v), `${t.id} ${addr}`).toBe(false);
      }
    }
  });

  it("реестр показывает эти задачи", () => {
    expect(IDE_REGISTRY.excel.tasks).toBe(TASKS);
  });
});

describe("задачи Excel: проверка", () => {
  it("эталонное решение проходит, начальная таблица — нет", () => {
    for (const t of TASKS) {
      const ok = checkExcel(t.check as ExcelCheck, t.solution);
      expect(ok.ok, `${t.id}: ${msg(ok)}`).toBe(true);
      expect(ok.passed).toBe(ok.total);
      const start = checkExcel(t.check as ExcelCheck, t.starter);
      expect(start.ok, t.id).toBe(false);
      expect(start.message, t.id).toBeDefined();
    }
  });

  it("в эталоне формулы из formulas действительно формулы", () => {
    for (const t of TASKS) {
      const sol = parseSheetCode(t.solution);
      for (const a of (t.check as ExcelCheck).formulas ?? []) expect(isFormula(sol[a]), `${t.id} ${a}`).toBe(true);
    }
  });

  it("число, введённое вручную вместо формулы, не засчитывается", () => {
    const r = run("xl-1-sum", { ...base("xl-1-sum"), E1: "33" });
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(1); // значение верное, формулы нет
    expect(r.total).toBe(2);
    expect(msg(r)).toContain("E1");
    expect(msg(r)).toContain("формула");
    const kk = (r.message as { kk: string }).kk;
    expect(kk).toContain("E1");
    expect(kk).toContain("формула");
  });

  it("верная формула на английском и с запятыми-разделителями тоже проходит", () => {
    expect(run("xl-1-sum", { ...base("xl-1-sum"), E1: "=SUM(A1:D1)" }).ok).toBe(true);
    expect(run("xl-1-sum", { ...base("xl-1-sum"), E1: "=A1+B1+C1+D1" }).ok).toBe(true);
    expect(run("xl-2-average", { ...base("xl-2-average"), B1: "=AVERAGE(A1:A5)" }).ok).toBe(true);
    expect(run("xl-2-average", { ...base("xl-2-average"), B1: "=СУММ(A1:A5)/СЧЁТ(A1:A5)" }).ok).toBe(true);
    expect(run("xl-8-sumif", { ...base("xl-8-sumif"), D1: '=SUMIF(A1:A6,"astana",B1:B6)', D2: '=SUMIF(B1:B6,">100")' }).ok).toBe(true);
  });

  it("неверное значение: сообщение на двух языках и пример", () => {
    const r = run("xl-2-average", { ...base("xl-2-average"), B1: "=СУММ(A1:A5)" });
    expect(r.ok).toBe(false);
    expect(msg(r)).toBe("Ячейка B1: ожидалось 20, получилось 100.");
    expect((r.message as { kk: string }).kk).toBe("B1 ұяшығы: күтілгені 20, шыққаны 100.");
    expect(r.sample).toEqual({ input: "B1", expected: "20", got: "100" });
  });

  it("пустая ячейка и ошибка формулы показываются понятно", () => {
    const empty = checkExcel({ kind: "excel", cells: { A1: 1 } }, "{}");
    expect(msg(empty)).toBe("Ячейка A1: ожидалось 1, получилось пусто.");
    expect((empty.message as { kk: string }).kk).toContain("бос");
    const bad = checkExcel({ kind: "excel", cells: { A1: 1 } }, '{"A1":"=1/0"}');
    expect(msg(bad)).toContain("#ДЕЛ/0!");
  });

  it("ЕСЛИ: слова на любом из двух языков, регистр не важен, чужое слово — нет", () => {
    const t4 = base("xl-4-if");
    const withFormula = (f: string) => fillCells({ ...t4, C2: f }, "C2", "down", 4).cells;
    expect(run("xl-4-if", withFormula('=ЕСЛИ(B2>=10;"тапсырды";"тапсырмады")')).ok).toBe(true);
    expect(run("xl-4-if", withFormula('=IF(B2>=10;"СДАЛ";"Не сдал")')).ok).toBe(true);
    expect(run("xl-4-if", withFormula('=IF(B2>=10,"сдал","не сдал")')).ok).toBe(true);
    const wrongWord = run("xl-4-if", withFormula('=ЕСЛИ(B2>=10;"да";"нет")'));
    expect(wrongWord.ok).toBe(false);
    expect(msg(wrongWord)).toContain("C2");
    // условие «больше 10» вместо «не меньше»: у Aruzhan (10) получится не то
    const strict = run("xl-4-if", withFormula('=ЕСЛИ(B2>10;"сдал";"не сдал")'));
    expect(strict.ok).toBe(false);
    expect(msg(strict)).toContain("C5");
    // формула только в первой ячейке — остальные пусты
    expect(run("xl-4-if", { ...t4, C2: '=ЕСЛИ(B2>=10;"сдал";"не сдал")' }).ok).toBe(false);
  });

  it("абсолютная ссылка: относительная $B$6 ломает протянутую формулу, закреплённая — нет", () => {
    const t5 = base("xl-5-abs");
    const relative = fillCells({ ...t5, C2: "=B2/B6*100" }, "C2", "down", 3).cells;
    const r = run("xl-5-abs", relative);
    expect(r.ok).toBe(false);
    expect(msg(r)).toContain("C3"); // C2 верна (25), на C3 ссылка «уехала» и дала ошибку
    const absolute = fillCells({ ...t5, C2: "=B2/$B$6*100" }, "C2", "down", 3).cells;
    expect(run("xl-5-abs", absolute).ok).toBe(true);
    const mixed = fillCells({ ...t5, C2: "=B2/B$6*100" }, "C2", "down", 3).cells;
    expect(run("xl-5-abs", mixed).ok).toBe(true); // B$6 тоже не двигается вниз — решение верное
    // числа вместо формул
    const typed = { ...t5, C2: "25", C3: "35", C4: "15", C5: "25" };
    const hard = run("xl-5-abs", typed);
    expect(hard.ok).toBe(false);
    expect(msg(hard)).toContain("формула");
    // доля без «×100»
    expect(run("xl-5-abs", fillCells({ ...t5, C2: "=B2/$B$6" }, "C2", "down", 3).cells).ok).toBe(false);
  });

  it("СЧЁТЕСЛИ: эквивалентные условия засчитываются", () => {
    const t6 = base("xl-6-countif");
    expect(run("xl-6-countif", { ...t6, B1: "=COUNTIF(A1:A8;5)", B2: '=COUNTIF(A1:A8;">3")' }).ok).toBe(true);
    expect(run("xl-6-countif", { ...t6, B1: '=СЧЁТЕСЛИ(A1:A8;"5")', B2: '=СЧЁТЕСЛИ(A1:A8;">=4")' }).ok).toBe(true);
    expect(run("xl-6-countif", { ...t6, B1: "=СЧЁТЕСЛИ(A1:A8;5)", B2: '=СЧЁТЕСЛИ(A1:A8;">4")' }).ok).toBe(false);
  });

  it("копирование формулы: верный ответ 12, ошибки типичных рассуждений — нет", () => {
    const t7 = base("xl-7-copy");
    expect(run("xl-7-copy", { ...t7, F1: "12" }).ok).toBe(true);
    expect(run("xl-7-copy", { ...t7, F1: "=D4" }).ok).toBe(false); // D4 пуста
    for (const wrong of ["0", "2", "6", "9", "8", "16"]) expect(run("xl-7-copy", { ...t7, F1: wrong }).ok, wrong).toBe(false);
    // протянуть B2 вправо и вниз — в D4 действительно 12
    let cells = fillCells(t7, "B2", "right", 2).cells;
    for (const c of ["B2", "C2", "D2"]) cells = fillCells(cells, c, "down", 2).cells;
    expect(evaluateSheet(cells).get("D4")).toBe(12);
    // удалённая исходная формула B2 — не решение
    expect(run("xl-7-copy", { ...t7, B2: "", F1: "12" }).ok).toBe(false);
  });

  it("СУММЕСЛИ: регистр текста не важен, чужой город — нет", () => {
    const t8 = base("xl-8-sumif");
    expect(run("xl-8-sumif", { ...t8, D1: '=SUMIF(A1:A6;"Almaty";B1:B6)', D2: '=SUMIF(B1:B6;">100")' }).ok).toBe(false);
    expect(run("xl-8-sumif", { ...t8, D1: '=SUMIF(A1:A6;"Astana";B1:B6)', D2: '=SUMIF(B1:B6;"<100")' }).ok).toBe(false);
    expect(run("xl-8-sumif", { ...t8, D1: '=SUMIF(A1:A6;"astana";B1:B6)', D2: '=SUMIF(B1:B6;">=100")' }).ok).toBe(true); // значения 100 в данных нет
    expect(run("xl-8-sumif", { ...t8, D1: '=SUMIF(A1:A6;"Astana")', D2: '=SUMIF(B1:B6;">100")' }).ok).toBe(false); // без диапазона сумм складываются города → 0
  });

  it("мелочи: пустой код, мусор, лишние ячейки не мешают", () => {
    expect(checkExcel(excel("xl-1-sum"), "").ok).toBe(false);
    expect(checkExcel(excel("xl-1-sum"), "не json").ok).toBe(false);
    const extra = { ...parseSheetCode(byId("xl-1-sum").solution), H15: "лишнее", G7: "=A1" };
    expect(run("xl-1-sum", extra).ok).toBe(true);
  });
});

describe("matchesExpected", () => {
  it("числа: допуск на двоичные хвосты", () => {
    expect(matchesExpected(0.3, 0.1 + 0.2)).toBe(true);
    expect(matchesExpected(1e12, 1e12 + 1)).toBe(true);
    expect(matchesExpected(5, 5.001)).toBe(false);
    expect(matchesExpected(5, "5")).toBe(false);
    expect(matchesExpected(5, null)).toBe(false);
    expect(matchesExpected(5, { error: "#ЗНАЧ!" })).toBe(false);
  });
  it("текст: варианты через |, регистр и крайние пробелы", () => {
    expect(matchesExpected("да|иә", "ИӘ")).toBe(true);
    expect(matchesExpected("да|иә", " да ")).toBe(true);
    expect(matchesExpected("да|иә", "нет")).toBe(false);
    expect(matchesExpected("да", null)).toBe(false);
  });
  it("число и логическое под текстовое ожидание", () => {
    expect(matchesExpected("12", 12)).toBe(true);
    expect(matchesExpected("TRUE|ИСТИНА", true)).toBe(true);
    expect(matchesExpected("ЛОЖЬ", false)).toBe(true);
    expect(matchesExpected("ЛОЖЬ", true)).toBe(false);
  });
});

describe("describeSheetError", () => {
  it("первая ячейка с ошибкой; нет ошибок — null", () => {
    expect(describeSheetError({ A1: "5", B1: "=A1*2" })).toBeNull();
    expect(describeSheetError({ A1: "5", B1: "=A1/0" })).toBe("B1 (=A1/0) → #ДЕЛ/0!");
    expect(describeSheetError({ A1: "=B1", B1: "=A1" })).toContain("#ЦИКЛ!");
    expect(describeSheetError({})).toBeNull();
  });
});

describe("словарь idexl.*", () => {
  const entries = Object.entries(ideExcelDict) as [string, { ru: string; kk: string }][];
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("все ключи с префиксом idexl., оба языка непусты, плейсхолдеры совпадают", () => {
    expect(entries.length).toBeGreaterThan(30);
    for (const [k, v] of entries) {
      expect(k.startsWith("idexl."), k).toBe(true);
      expect(v.ru.trim(), k).not.toBe("");
      expect(v.kk.trim(), k).not.toBe("");
      expect(v.kk, k).toMatch(/[Ѐ-ӿ]/);
      expect(placeholders(v.kk), k).toEqual(placeholders(v.ru));
    }
  });

  it("в казахском нет окончания сразу после {плейсхолдера}", () => {
    for (const [k, v] of entries) expect(v.kk, k).not.toMatch(/\}[-A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ]/);
  });

  it("ключи, используемые в компонентах, есть в словаре, и лишних ключей нет", () => {
    const files = ["Workspace", "Grid", "FormulaBar"].map((f) => readFileSync(`src/components/ide/excel/${f}.tsx`, "utf8")).join("\n");
    const used = new Set([...files.matchAll(/["'`](idexl\.[A-Za-z0-9.]+)["'`]/g)].map((m) => m[1]));
    const keys = new Set(entries.map(([k]) => k));
    for (const k of used) expect(keys.has(k), `нет в словаре: ${k}`).toBe(true);
    for (const k of keys) expect(used.has(k), `не используется: ${k}`).toBe(true);
  });

  it("в компонентах нет захардкоженных русских строк интерфейса", () => {
    for (const f of ["Workspace", "Grid", "FormulaBar"]) {
      const src = readFileSync(`src/components/ide/excel/${f}.tsx`, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line) && !/\{ ru: "/.test(line) && !/ERROR_KEYS|"#/.test(line));
      for (const line of src) {
        // кириллица допустима только в именах функций Excel (код) и в комментариях после кода
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        const strings = [...code.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((s) => /[Ѐ-ӿ]/.test(s));
        for (const s of strings) expect(/^[А-ЯЁ]+$/.test(s), `${f}: «${s}»`).toBe(true);
      }
    }
  });
});

import { checkExcel as chk } from "@/lib/ide/excel/check";
import { TASKS as XT } from "@/lib/ide/excel/tasks";

describe("антиобход проверок", () => {
  const t = (id: string) => XT.find((x) => x.id === id)!;
  it("константная формула не засчитывается", () => {
    expect(chk(t("xl-1-sum").check as never, JSON.stringify({ A1: "12", B1: "7", C1: "5", D1: "9", E1: "=33" })).ok).toBe(false);
  });
  it("xl-5: ручные и относительные формулы не засчитываются", () => {
    const c = t("xl-5-abs").check as never;
    const base = { B2: "50", B3: "70", B4: "30", B5: "50", B6: "=СУММ(B2:B5)" };
    expect(chk(c, JSON.stringify({ ...base, C2: "=25", C3: "=35", C4: "=15", C5: "=25" })).ok).toBe(false);
    expect(chk(c, JSON.stringify({ ...base, C2: "=B2/B6*100", C3: "=B3/B6*100", C4: "=B4/B6*100", C5: "=B5/B6*100" })).ok).toBe(false);
    expect(chk(c, t("xl-5-abs").solution).ok).toBe(true);
  });
});
