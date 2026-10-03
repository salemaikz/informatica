import { describe, expect, it } from "vitest";
import { barWidths, formatBytes } from "@/components/scenes/sizes";
import { flattenTree, iconFor, normalizePath, pathState, windowsPath } from "@/components/scenes/files";
import { KB_UNITS, KEY_ROWS, canonical, comboText, isKnownKey, keyCaption, litKeyIds } from "@/components/scenes/keyboard";
import { layerState } from "@/components/scenes/layers";
import { instrFontSize, instrLines } from "@/components/scenes/CpuCycleScene";
import { basicsDict } from "@/i18n/parts/basics";
import type { FileNode } from "@/lib/types";

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

describe("formatBytes", () => {
  it("единицы Б/КБ/МБ/ГБ/ТБ по 1024", () => {
    expect(formatBytes(0, "ru")).toBe("0 Б");
    expect(formatBytes(1, "ru")).toBe("1 Б");
    expect(formatBytes(1023, "ru")).toBe("1023 Б");
    expect(formatBytes(KB, "ru")).toBe("1 КБ");
    expect(formatBytes(3 * MB, "ru")).toBe("3 МБ");
    expect(formatBytes(2 * GB, "ru")).toBe("2 ГБ");
    expect(formatBytes(TB, "ru")).toBe("1 ТБ");
  });

  it("не больше одного знака после запятой, запятая, без «,0»", () => {
    expect(formatBytes(1.5 * GB, "ru")).toBe("1,5 ГБ");
    expect(formatBytes(4.7 * GB, "kk")).toBe("4,7 ГБ");
    expect(formatBytes(700 * MB, "ru")).toBe("700 МБ");
    expect(formatBytes(1.25 * MB, "ru")).toBe("1,3 МБ");
    expect(formatBytes(0.04 * MB, "ru")).toBe("41 КБ");
  });

  it("округление до 1024 переходит в следующую единицу", () => {
    expect(formatBytes(MB - 1, "ru")).toBe("1 МБ");
    expect(formatBytes(GB - 10, "ru")).toBe("1 ГБ");
  });

  it("больше терабайта остаётся в ТБ; мусор — ноль", () => {
    expect(formatBytes(2048 * TB, "ru")).toBe("2048 ТБ");
    expect(formatBytes(-5, "ru")).toBe("0 Б");
    expect(formatBytes(Number.NaN, "kk")).toBe("0 Б");
  });

  it("на казахском те же буквы", () => {
    expect(formatBytes(5 * MB, "kk")).toBe(formatBytes(5 * MB, "ru"));
  });
});

describe("barWidths", () => {
  it("логарифмическая шкала: минимум — minPct, максимум — 100, порядок сохраняется", () => {
    const w = barWidths([KB, MB, GB]);
    expect(w[0]).toBe(10);
    expect(w[2]).toBe(100);
    expect(w[1]).toBeCloseTo(55, 1); // середина по логарифму
    expect(w[0]).toBeLessThan(w[1]);
    expect(w[1]).toBeLessThan(w[2]);
  });

  it("порядок входа не важен, равные размеры — равные полосы", () => {
    const w = barWidths([GB, KB, GB]);
    expect(w[0]).toBe(100);
    expect(w[1]).toBe(10);
    expect(w[2]).toBe(100);
  });

  it("один размер или все одинаковые — полные полосы; пусто — пусто", () => {
    expect(barWidths([5 * MB])).toEqual([100]);
    expect(barWidths([MB, MB])).toEqual([100, 100]);
    expect(barWidths([])).toEqual([]);
  });

  it("свой минимум; нули не ломают расчёт", () => {
    expect(barWidths([KB, GB], 20)[0]).toBe(20);
    const w = barWidths([0, KB]);
    expect(w.every((x) => Number.isFinite(x) && x >= 10 && x <= 100)).toBe(true);
  });
});

const tree: FileNode[] = [
  { name: "Учёба", children: [{ name: "Информатика", children: [{ name: "урок.docx" }, { name: "фото.JPG" }] }, { name: "song.mp3" }] },
  { name: "readme" },
];

describe("flattenTree", () => {
  it("обход сверху вниз с глубиной, путём и признаком папки", () => {
    const rows = flattenTree(tree);
    expect(rows.map((r) => [r.name, r.depth, r.isFolder])).toEqual([
      ["Учёба", 0, true],
      ["Информатика", 1, true],
      ["урок.docx", 2, false],
      ["фото.JPG", 2, false],
      ["song.mp3", 1, false],
      ["readme", 0, false],
    ]);
    expect(rows[2].path).toBe("Учёба/Информатика/урок.docx");
    expect(rows[2].kind).toBe("doc");
    expect(rows[3].kind).toBe("image");
  });

  it("пустая папка остаётся папкой", () => {
    expect(flattenTree([{ name: "Пусто", children: [] }])[0].isFolder).toBe(true);
  });
});

describe("iconFor", () => {
  it("по расширению, регистр и точка не важны", () => {
    expect(iconFor("docx")).toBe("doc");
    expect(iconFor(".pdf")).toBe("doc");
    expect(iconFor("PNG")).toBe("image");
    expect(iconFor("mp3")).toBe("music");
    expect(iconFor("mp4")).toBe("video");
    expect(iconFor("py")).toBe("code");
    expect(iconFor("html")).toBe("code");
    expect(iconFor("zip")).toBe("archive");
    expect(iconFor("урок.docx")).toBe("doc");
  });
  it("неизвестное и без расширения — generic", () => {
    expect(iconFor("exe")).toBe("generic");
    expect(iconFor("readme")).toBe("generic");
    expect(iconFor("")).toBe("generic");
  });
});

describe("windowsPath / pathState", () => {
  it("«/» → «\\» с диском C:", () => {
    expect(windowsPath("Учёба/Информатика/урок.docx")).toBe("C:\\Учёба\\Информатика\\урок.docx");
    expect(windowsPath("Учёба")).toBe("C:\\Учёба");
    expect(windowsPath(undefined)).toBe("C:\\");
    expect(windowsPath("", "D")).toBe("D:\\");
  });
  it("лишние разделители и обратные слеши нормализуются", () => {
    expect(normalizePath("/Учёба//Информатика\\урок.docx/")).toBe("Учёба/Информатика/урок.docx");
    expect(windowsPath("/Учёба/")).toBe("C:\\Учёба");
  });
  it("состояние строки: цель, папка на пути, посторонняя", () => {
    const a = "Учёба/Информатика/урок.docx";
    expect(pathState("Учёба/Информатика/урок.docx", a)).toBe("active");
    expect(pathState("Учёба", a)).toBe("ancestor");
    expect(pathState("Учёба/Информатика", a)).toBe("ancestor");
    expect(pathState("Учёба/song.mp3", a)).toBe("none");
    expect(pathState("Учёба2", "Учёба")).toBe("none");
    expect(pathState("Учёба", undefined)).toBe("none");
  });
});

describe("клавиатура: раскладка", () => {
  it("каждый ряд умещается в 15 единиц и клавиши не пересекаются", () => {
    for (const row of KEY_ROWS) {
      let end = 0;
      for (const k of row.keys) {
        expect(k.x).toBeGreaterThanOrEqual(end - 1e-9);
        end = k.x + k.w;
      }
      expect(end).toBeLessThanOrEqual(KB_UNITS + 1e-9);
    }
  });
  it("id клавиш уникальны; правые Ctrl/Alt/Shift — дубликаты", () => {
    const ids = KEY_ROWS.flatMap((r) => r.keys.map((k) => k.id));
    expect(new Set(ids).size).toBe(ids.length);
    const dups = KEY_ROWS.flatMap((r) => r.keys.filter((k) => k.dup).map((k) => k.norm)).sort();
    expect(dups).toEqual(["alt", "ctrl", "shift"]);
  });
  it("есть все нужные клавиши", () => {
    const norms = new Set(KEY_ROWS.flatMap((r) => r.keys.map((k) => k.norm)));
    for (const n of ["esc", "f1", "f12", "del", "backspace", "tab", "caps", "shift", "ctrl", "win", "alt", "space", "enter", "←", "↑", "→", "↓", "c", "v", "z", "1", "0"]) {
      expect(norms.has(n)).toBe(true);
    }
  });
});

describe("клавиатура: подсветка", () => {
  it("синонимы и регистр", () => {
    expect(canonical("Control")).toBe("ctrl");
    expect(canonical("CTRL")).toBe("ctrl");
    expect(canonical("⊞")).toBe("win");
    expect(canonical("Windows")).toBe("win");
    expect(canonical("Delete")).toBe("del");
    expect(canonical("Escape")).toBe("esc");
    expect(canonical("Return")).toBe("enter");
    expect(canonical("Пробел")).toBe("space");
    expect(canonical("ArrowLeft")).toBe("←");
    expect(canonical("down")).toBe("↓");
    expect(canonical("с")).toBe("c"); // русская «с» — та же клавиша
    expect(canonical("К")).toBe("k"); // look-alike
    expect(canonical("А")).toBe("a");
    expect(canonical("Х")).toBe("x");
    expect(canonical("Ы")).toBe("s"); // не похожа — по раскладке
  });

  it("Ctrl + C подсвечивает левый Ctrl и C", () => {
    expect([...litKeyIds(["Ctrl", "C"])].sort()).toEqual(["c", "ctrl"]);
  });
  it("Ctrl+Shift+Esc, Win+Пробел, Alt+Tab, стрелки", () => {
    expect([...litKeyIds(["ctrl", "shift", "Esc"])].sort()).toEqual(["ctrl", "esc", "shift"]);
    expect([...litKeyIds(["⊞", "пробел"])].sort()).toEqual(["space", "win"]);
    expect([...litKeyIds(["Alt", "Tab"])].sort()).toEqual(["alt", "tab"]);
    expect([...litKeyIds(["Shift", "→"])].sort()).toEqual(["shift", "→"]);
  });
  it("неизвестная клавиша ничего не подсвечивает", () => {
    expect(litKeyIds(["PrtSc"]).size).toBe(0);
  });
  it("подпись сочетания", () => {
    expect(comboText(["ctrl", "c"], "Пробел")).toBe("Ctrl + C");
    expect(comboText(["Win", "Пробел"], "Пробел")).toBe("Win + Пробел");
    expect(comboText(["control", "shift", "escape"], "Space")).toBe("Ctrl + Shift + Esc");
    expect(keyCaption("f5", "")).toBe("F5");
    expect(keyCaption("delete", "")).toBe("Del");
    expect(keyCaption("left", "")).toBe("←");
  });
});

describe("keyboard list mode / known keys / instr lines", () => {
  it("list caption joins with commas", () => {
    expect(comboText(["Backspace", "Delete", "Enter", "Esc"], "Пробел", false)).toBe("Backspace, Del, Enter, Esc");
  });
  it("Cyrillic look-alikes light the intended key", () => {
    expect([...litKeyIds(["Ctrl", "А"])].sort()).toEqual(["a", "ctrl"]);
    expect(litKeyIds(["Х"]).has("x")).toBe(true);
  });
  it("isKnownKey", () => {
    expect(isKnownKey("Ctrl")).toBe(true);
    expect(isKnownKey("PrtSc")).toBe(false);
    expect(isKnownKey("/")).toBe(false);
  });
  it("24-char instr stays legible on two lines", () => {
    const s = "MOV AX, [0x1F40] + 0x0001".slice(0, 24);
    const lines = instrLines(s);
    expect(lines.length).toBe(2);
    expect(instrFontSize(Math.max(...lines.map((x) => x.length)))).toBeGreaterThanOrEqual(9);
  });
});

describe("layerState / instrFontSize", () => {
  it("подсветка слоя", () => {
    expect(layerState(0, undefined)).toBe("normal");
    expect(layerState(2, 2)).toBe("active");
    expect(layerState(1, 2)).toBe("dim");
  });
  it("команда в центре цикла: короткая крупнее длинной, в пределах 8–17", () => {
    expect(instrFontSize(5)).toBeGreaterThan(instrFontSize(24));
    for (const n of [1, 5, 10, 24, 40]) {
      const s = instrFontSize(n);
      expect(s).toBeGreaterThanOrEqual(8);
      expect(s).toBeLessThanOrEqual(17);
    }
  });
});

describe("словарь basics.*", () => {
  const entries = Object.entries(basicsDict);
  it("все ключи с префиксом basics. и обоими языками", () => {
    expect(entries.length).toBeGreaterThan(20);
    for (const [key, v] of entries) {
      expect(key.startsWith("basics.")).toBe(true);
      expect(v.ru.trim()).not.toBe("");
      expect(v.kk.trim()).not.toBe("");
    }
  });
  it("плейсхолдеры одинаковы в ru и kk", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [, v] of entries) expect(ph(v.kk)).toBe(ph(v.ru));
  });
  it("в казахском нет падежного окончания сразу после {плейсхолдера}", () => {
    for (const [key, v] of entries) expect(`${key}: ${v.kk}`).not.toMatch(/\}-?[а-яәғқңөұүһіa-z]/i);
  });
});
