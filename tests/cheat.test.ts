import { describe, expect, it } from "vitest";
import {
  CHEAT_OPEN_FIRST,
  CHEAT_SECTIONS,
  CHEAT_TITLE,
  FORMULA_ROWS,
  LOGIC_ROWS,
  NS_ROWS,
  PYTHON_ROWS,
  UNITS_ROWS,
  groupDigits,
  nsRows,
  powerCells,
  toggleSection,
  triads,
  truthTable,
} from "@/components/tools/cheat-data";
import { ENT_TABS, TOOL_TABS, tabsFor } from "@/components/tools/useToolbox";
import { dict } from "@/i18n/dict";

describe("шпаргалка: данные", () => {
  it("степени двойки 2⁰…2¹⁶, подсвечены 2⁸, 2¹⁰, 2¹⁶", () => {
    const cells = powerCells();
    expect(cells).toHaveLength(17);
    expect(cells[0]).toMatchObject({ label: "2⁰", value: 1 });
    expect(cells[16]).toMatchObject({ label: "2¹⁶", value: 65536, text: "65 536" });
    expect(cells.filter((c) => c.mark).map((c) => c.exp)).toEqual([8, 10, 16]);
    expect(cells[10].value).toBe(1024);
  });

  it("groupDigits разделяет тысячи неразрывным пробелом", () => {
    expect(groupDigits(256)).toBe("256");
    expect(groupDigits(1024)).toBe("1 024");
    expect(groupDigits(1048576)).toBe("1 048 576");
  });

  it("таблица 0–15: двоичная запись — тетрада, значения согласованы", () => {
    const rows = nsRows();
    expect(rows).toHaveLength(16);
    rows.forEach((r, n) => {
      expect(r.bin).toHaveLength(4);
      expect(parseInt(r.bin, 2)).toBe(n);
      expect(parseInt(r.oct, 8)).toBe(n);
      expect(parseInt(r.hex, 16)).toBe(n);
    });
    expect(rows[10]).toEqual({ dec: "10", bin: "1010", oct: "12", hex: "A" });
    expect(rows[15].hex).toBe("F");
  });

  it("триады: цифра 0–7 → три бита", () => {
    const t = triads();
    expect(t).toHaveLength(8);
    expect(t.map((x) => x.bits)).toEqual(["000", "001", "010", "011", "100", "101", "110", "111"]);
  });

  it("таблица истинности: ¬, ∧, ∨, →, ≡", () => {
    expect(truthTable()).toEqual([
      [0, 0, 1, 0, 0, 1, 1],
      [0, 1, 1, 0, 1, 1, 0],
      [1, 0, 0, 0, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 1],
    ]);
  });

  it("законы де Моргана и A → B = ¬A ∨ B выполняются на таблице", () => {
    for (const [a, b, na, and, or, impl] of truthTable()) {
      const nb = b ? 0 : 1;
      expect(a && b ? 0 : 1).toBe(na || nb); // ¬(A ∧ B) = ¬A ∨ ¬B
      expect(a || b ? 0 : 1).toBe(na && nb); // ¬(A ∨ B) = ¬A ∧ ¬B
      expect(impl).toBe(na || b);
      expect(and).toBe(a && b);
      expect(or).toBe(a || b);
    }
  });

  it("аккордеон: toggleSection не мутирует исходное множество", () => {
    const start = new Set([CHEAT_OPEN_FIRST]);
    const closed = toggleSection(start, CHEAT_OPEN_FIRST);
    expect(closed.size).toBe(0);
    expect(start.has(CHEAT_OPEN_FIRST)).toBe(true);
    expect(toggleSection(closed, "logic").has("logic")).toBe(true);
    expect(CHEAT_OPEN_FIRST).toBe(CHEAT_SECTIONS[0]);
  });
});

describe("шпаргалка: тексты и вкладка", () => {
  it("все ключи есть в словаре, двуязычны, без эмодзи", () => {
    const keys = [
      ...CHEAT_SECTIONS.map((id) => CHEAT_TITLE[id]),
      ...[...UNITS_ROWS, ...FORMULA_ROWS, ...NS_ROWS, ...LOGIC_ROWS, ...PYTHON_ROWS].flatMap((r) => (r.note ? [r.f, r.note] : [r.f])),
      ...(Object.keys(dict).filter((k) => k.startsWith("cheat.")) as (keyof typeof dict)[]),
    ];
    for (const k of keys) {
      const v = dict[k];
      expect(v, k).toBeDefined();
      expect(v.ru.trim(), k).toBeTruthy();
      expect(v.kk.trim(), k).toBeTruthy();
      expect(/\p{Extended_Pictographic}/u.test(v.ru + v.kk), k).toBe(false);
    }
  });

  it("строки не повторяют f внутри секции (ключ React)", () => {
    for (const rows of [UNITS_ROWS, FORMULA_ROWS, NS_ROWS, LOGIC_ROWS, PYTHON_ROWS]) {
      expect(new Set(rows.map((r) => r.f)).size).toBe(rows.length);
    }
  });

  it("вкладка «cheat» есть в полном наборе и не показывается на уровне «как на ЕНТ»", () => {
    expect(TOOL_TABS).toContain("cheat");
    expect(TOOL_TABS).not.toContain("powers" as never);
    expect(tabsFor("full")).toContain("cheat");
    expect(ENT_TABS).not.toContain("cheat");
    expect(tabsFor("ent")).not.toContain("cheat");
  });
});
