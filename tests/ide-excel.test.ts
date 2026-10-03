import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDE_REGISTRY } from "@/components/ide/registry";
import { SKILLS } from "@/content/skills";
import { checkExcel, describeSheetError, matchesExpected, type ExcelCheck } from "@/lib/ide/excel/check";
import { TASKS } from "@/lib/ide/excel/tasks";
import { CODE_XP } from "@/lib/ide/types";
import { evaluateSheet, fillCells, isError, isFormula, parseSheetCode, serializeSheet, shiftFormula, type SheetCells } from "@/lib/sheet";
import { ideExcelDict } from "@/i18n/parts/ide-excel";

const byId = (id: string) => TASKS.find((t) => t.id === id)!;
const excel = (id: string) => byId(id).check as ExcelCheck;
const run = (id: string, cells: SheetCells) => checkExcel(excel(id), serializeSheet(cells));
const base = (id: string) => parseSheetCode(byId(id).starter);
const msg = (r: { message?: unknown }) => (typeof r.message === "string" ? r.message : ((r.message as { ru: string } | undefined)?.ru ?? ""));

describe("задачи Excel: содержимое", () => {
  it("16 задач, уникальные id, язык, уровни A–C в каждой группе навыка, навыки курса", () => {
    expect(TASKS).toHaveLength(16);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const skills = new Set(SKILLS.map((s) => s.id));
    for (const t of TASKS) {
      expect(t.id).toMatch(/^xl-\d+-[a-z]+$/);
      expect(t.lang).toBe("excel");
      expect(t.skill && skills.has(t.skill), t.id).toBe(true);
      expect(["sheets.formulas", "sheets.refs", "sheets.functions", "sheets.if", "sheets.text", "sheets.copy"]).toContain(t.skill);
      expect(t.check.kind).toBe("excel");
    }
    // нумерация сквозная: xl-1 … xl-16
    expect(TASKS.map((t) => Number(t.id.split("-")[1]))).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    // внутри навыка уровни не убывают (список групп идёт от A к C)
    const bySkill = new Map<string, number[]>();
    for (const t of TASKS) bySkill.set(t.skill!, [...(bySkill.get(t.skill!) ?? []), t.level]);
    for (const [skill, levels] of bySkill) expect(levels, skill).toEqual([...levels].sort());
    // все четыре новых навыка курса 2.0 представлены, на каждом уровне есть задачи
    for (const s of ["sheets.functions", "sheets.if", "sheets.text", "sheets.copy"]) expect(bySkill.get(s)?.length, s).toBe(2);
    for (const l of [1, 2, 3]) expect(TASKS.filter((t) => t.level === l).length).toBeGreaterThanOrEqual(2);
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

describe("задачи Excel курса 2.0: проверка", () => {
  const fill = (cells: SheetCells, from: string, dir: "down" | "right", n: number) => fillCells(cells, from, dir, n).cells;

  it("xl-9: СЧЁТ пропускает текст и пустые, СЧЁТЗ и «=5» — нет", () => {
    const t = base("xl-9-count");
    expect(run("xl-9-count", { ...t, B1: "=COUNT(A1:A8)", B2: "=AVERAGE(A1:A8)" }).ok).toBe(true);
    expect(run("xl-9-count", { ...t, B1: "=СЧЁТЗ(A1:A8)", B2: "=СРЗНАЧ(A1:A8)" }).ok).toBe(false); // 7 вместо 5
    expect(run("xl-9-count", { ...t, B1: "=СЧЁТ(A1:A8)", B2: "=СУММ(A1:A8)/8" }).ok).toBe(false); // деление на 8, а не на 5
    expect(run("xl-9-count", { ...t, B1: "5", B2: "15" }).ok).toBe(false); // вручную
  });

  it("xl-10: доля хороших оценок, разные способы записи", () => {
    const t = base("xl-10-countif");
    expect(run("xl-10-countif", { ...t, B1: '=COUNTIF(A1:A10;">3")', B2: "=B1/COUNT(A1:A10)*100", B3: "=AVERAGE(A1:A10)" }).ok).toBe(true);
    expect(run("xl-10-countif", { ...t, B1: '=СЧЁТЕСЛИ(A1:A10;">=4")', B2: "=B1/8*100", B3: "=СРЗНАЧ(A1:A10)" }).ok).toBe(true);
    expect(run("xl-10-countif", { ...t, B1: '=СЧЁТЕСЛИ(A1:A10;">=4")', B2: "=B1/СЧЁТ(A1:A10)", B3: "=СРЗНАЧ(A1:A10)" }).ok).toBe(false); // без ×100
    expect(run("xl-10-countif", { ...t, B1: '=СЧЁТЕСЛИ(A1:A10;">4")', B2: "=B1/8*100", B3: "=СРЗНАЧ(A1:A10)" }).ok).toBe(false);
    // делят на число ячеек (с «abs»), а не на число оценок
    expect(run("xl-10-countif", { ...t, B1: '=СЧЁТЕСЛИ(A1:A10;">=4")', B2: "=B1/СЧЁТЗ(A1:A10)*100", B3: "=СРЗНАЧ(A1:A10)" }).ok).toBe(false);
    expect(run("xl-10-countif", { ...t, B1: '=СЧЁТЕСЛИ(A1:A10;">=4")', B2: "=B1/10*100", B3: "=СУММ(A1:A10)/10" }).ok).toBe(false);
  });

  it("xl-11: вложенное ЕСЛИ — границы 85, 65, 40; ловушка порядка условий", () => {
    const t = base("xl-11-nested");
    const withF = (f: string) => fill({ ...t, C2: f }, "C2", "down", 5);
    expect(run("xl-11-nested", withF("=IF(B2>=85,5,IF(B2>=65,4,IF(B2>=40,3,2)))")).ok).toBe(true);
    expect(run("xl-11-nested", withF("=ЕСЛИ(B2<40;2;ЕСЛИ(B2<65;3;ЕСЛИ(B2<85;4;5)))")).ok).toBe(true); // от меньшего порога тоже верно
    expect(run("xl-11-nested", withF("=ЕСЛИ(B2>=40;3;ЕСЛИ(B2>=65;4;ЕСЛИ(B2>=85;5;2)))")).ok).toBe(false); // «3» перехватывает всех
    expect(run("xl-11-nested", withF("=ЕСЛИ(B2>85;5;ЕСЛИ(B2>=65;4;ЕСЛИ(B2>=40;3;2)))")).ok).toBe(false); // 85 → 4
    expect(run("xl-11-nested", { ...t, C2: "=ЕСЛИ(B2>=85;5;ЕСЛИ(B2>=65;4;ЕСЛИ(B2>=40;3;2)))" }).ok).toBe(false); // не протянуто
  });

  it("xl-12: СЧЁТЕСЛИ с закреплённым диапазоном; сдвигающийся диапазон ломает результат", () => {
    const t = base("xl-12-dup");
    const good = fill({ ...t, B2: '=ЕСЛИ(СЧЁТЕСЛИ($A$2:$A$8;A2)>1;"повтор";"один раз")' }, "B2", "down", 6);
    expect(run("xl-12-dup", good).ok).toBe(true);
    expect(run("xl-12-dup", fill({ ...t, B2: '=IF(COUNTIF($A$2:$A$8,A2)>=2,"қайталану","бір рет")' }, "B2", "down", 6)).ok).toBe(true);
    const relative = fill({ ...t, B2: '=ЕСЛИ(СЧЁТЕСЛИ(A2:A8;A2)>1;"повтор";"один раз")' }, "B2", "down", 6);
    const r = run("xl-12-dup", relative);
    expect(r.ok).toBe(false);
    expect(msg(r)).toContain("B");
    expect(run("xl-12-dup", fill({ ...t, B2: '=ЕСЛИ(СЧЁТЕСЛИ($A$2:$A$8;A2)>2;"повтор";"один раз")' }, "B2", "down", 6)).ok).toBe(false); // Madina (2 раза)
  });

  it("xl-13: СТРОЧН и ДЛСТР", () => {
    const t = base("xl-13-lower");
    const good = fill(fill({ ...t, B2: "=LOWER(A2)", C2: "=LEN(A2)" }, "B2", "down", 3), "C2", "down", 3);
    expect(run("xl-13-lower", good).ok).toBe(true);
    const noLen = fill(fill({ ...t, B2: "=СТРОЧН(A2)", C2: "=ДЛСТР(B2)&\"\"" }, "B2", "down", 3), "C2", "down", 3);
    expect(run("xl-13-lower", noLen).ok).toBe(false); // «5» текстом — не число
    expect(run("xl-13-lower", { ...t, B2: "=СТРОЧН(A2)", C2: "=ДЛСТР(A2)" }).ok).toBe(false); // не протянуто
    expect(run("xl-13-lower", { ...t, B2: "aidar", B3: "madina", B4: "daniyar", B5: "berik", C2: "5", C3: "6", C4: "7", C5: "5" }).ok).toBe(false); // вручную
  });

  it("xl-14: код из частей текста", () => {
    const t = base("xl-14-code");
    const good = fill({ ...t, C2: '=UPPER(LEFT(A2;3))&"-"&RIGHT(B2;2)' }, "C2", "down", 3);
    expect(run("xl-14-code", good).ok).toBe(true);
    expect(run("xl-14-code", fill({ ...t, C2: '=ПРОПИСН(ЛЕВСИМВ(A2;3))&"-"&ПРАВСИМВ(B2;3)' }, "C2", "down", 3)).ok).toBe(false); // три цифры
    expect(run("xl-14-code", fill({ ...t, C2: '=ПРОПИСН(ЛЕВСИМВ(A2;3))&ПРАВСИМВ(B2;2)' }, "C2", "down", 3)).ok).toBe(false); // без дефиса
    expect(run("xl-14-code", fill({ ...t, C2: '=ЛЕВСИМВ(A2;2)&"-"&ПРАВСИМВ(B2;2)' }, "C2", "down", 3)).ok).toBe(false);
    expect(evaluateSheet(good).get("C3")).toBe("SAD-05");
  });

  it("xl-15: смешанные ссылки — таблица умножения протягивается в обе стороны", () => {
    const t = base("xl-15-table");
    const build = (f: string) => {
      let cells = fill({ ...t, B2: f }, "B2", "right", 3);
      for (const c of ["B2", "C2", "D2", "E2"]) cells = fill(cells, c, "down", 3);
      return cells;
    };
    expect(run("xl-15-table", build("=$A2*B$1")).ok).toBe(true);
    expect(run("xl-15-table", build("=B$1*$A2")).ok).toBe(true);
    for (const wrong of ["=A2*B1", "=$A$2*B$1", "=$A2*$B$1", "=A$2*$B1"]) {
      expect(run("xl-15-table", build(wrong)).ok, wrong).toBe(false);
    }
    const sol = evaluateSheet(parseSheetCode(byId("xl-15-table").solution));
    expect([sol.get("B2"), sol.get("E2"), sol.get("B5"), sol.get("E5")]).toEqual([12, 30, 18, 45]);
    // значения, введённые руками, не засчитываются
    const typed = { ...t, ...Object.fromEntries(Object.entries(excel("xl-15-table").cells).map(([a, v]) => [a, String(v)])) };
    expect(run("xl-15-table", typed).ok).toBe(false);
    // верные значения, но каждая формула набрана заново (без $) — не одна протянутая формула
    const manual = { ...t, ...Object.fromEntries(Object.keys(excel("xl-15-table").cells).map((a) => [a, `=A${a[1]}*${a[0]}1`])) };
    const rm = run("xl-15-table", manual);
    expect(evaluateSheet(manual).get("E5")).toBe(45);
    expect(rm.ok).toBe(false);
    expect(rm.passed).toBe(rm.total - 1);
  });

  it("xl-16: в E5 получается 70, остальные рассуждения — нет", () => {
    const t = base("xl-16-copyval");
    expect(run("xl-16-copyval", { ...t, G1: "70", G2: "40" }).ok).toBe(true);
    for (const wrong of ["0", "30", "40", "50", "60", "80", "100"]) expect(run("xl-16-copyval", { ...t, G1: wrong, G2: "40" }).ok, wrong).toBe(false);
    // B5 — копия влево: $A5*10+B$2 = 40; без сдвига 30, с закреплённой строкой у A — 20
    for (const wrong of ["10", "20", "30", "50", "70"]) expect(run("xl-16-copyval", { ...t, G1: "70", G2: wrong }).ok, wrong).toBe(false);
    expect(evaluateSheet({ ...t, B5: shiftFormula(t.C3, 2, -1) }).get("B5")).toBe(40);
    // протянули C3 в E5 — действительно 70, а при другой раскладке $ получились бы иные числа
    let cells = fill(t, "C3", "right", 2);
    for (const c of ["C3", "D3", "E3"]) cells = fill(cells, c, "down", 2);
    expect(evaluateSheet(cells).get("E5")).toBe(70);
    expect(evaluateSheet(cells).get("E3")).toBe(50);
    expect(evaluateSheet(cells).get("C5")).toBe(50);
    expect(run("xl-16-copyval", { ...t, C3: "", G1: "70", G2: "40" }).ok).toBe(false);
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
