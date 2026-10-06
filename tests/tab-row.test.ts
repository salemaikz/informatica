import { describe, expect, it } from "vitest";
import { TAB_FADE, tabRowScroll, type TabBox } from "@/lib/tab-row";

// Строка подразделов (SectionTabs) при показе: первая вкладка не начинается посреди слова, активная видна целиком.

/** Ряд вкладок: поле 16 px, промежуток 8 px, ширины — по порядку. */
function row(widths: number[], pad = 16, gap = 8): { tabs: TabBox[]; content: number } {
  const tabs: TabBox[] = [];
  let x = pad;
  for (const w of widths) {
    tabs.push({ left: x, width: w });
    x += w + gap;
  }
  return { tabs, content: x - gap + pad };
}

describe("tabRowScroll", () => {
  const view = 360;
  // «Материалы» по-казахски на 360 px: «Конспектілер», «Теория», «Жадынама», «Іздеу».
  const kk = row([160, 139, 139, 122]);
  const max = kk.content - view;

  it("активная видна и без прокрутки — ряд в начале: «Конспектілер» с первой буквы, а не «нспектілер»", () => {
    expect(tabRowScroll(kk.tabs, 1, view, max)).toEqual({ left: 0, extra: 0 });
    expect(tabRowScroll(kk.tabs, 0, view, max)).toEqual({ left: 0, extra: 0 });
  });

  it("активной нет (подстраница) — ряд в начале", () => {
    expect(tabRowScroll(kk.tabs, -1, view, max)).toEqual({ left: 0, extra: 0 });
  });

  it("активная за краем — ряд начинается с целой вкладки сразу за затуханием, активная видна целиком", () => {
    const { left, extra } = tabRowScroll(kk.tabs, 2, view, max);
    // Слева — целая вкладка: прокрутка ровно до её начала (минус затухание).
    expect(kk.tabs.some((t) => t.left - TAB_FADE === left)).toBe(true);
    const a = kk.tabs[2];
    expect(a.left - left).toBeGreaterThanOrEqual(TAB_FADE);
    // Справа: не докрутили до конца — у активной есть ещё и поле под затухание.
    const end = left >= max + extra;
    expect(a.left + a.width - left).toBeLessThanOrEqual(view - (end ? 0 : TAB_FADE));
  });

  it("последняя вкладка активна: до начала целой вкладки не докрутить — справа добавляется поле, а не обрезается слово слева", () => {
    const { left, extra } = tabRowScroll(kk.tabs, 3, view, max);
    expect(extra).toBeGreaterThan(0);
    expect(left).toBe(max + extra);
    expect(kk.tabs.some((t) => t.left - TAB_FADE === left)).toBe(true);
    const a = kk.tabs[3];
    expect(a.left + a.width - left).toBeLessThanOrEqual(view);
  });

  it("всё помещается (ряд не прокручивается) — в начале", () => {
    const ru = row([100, 90, 110]);
    expect(ru.content).toBeLessThanOrEqual(view);
    expect(tabRowScroll(ru.tabs, 2, view, 0)).toEqual({ left: 0, extra: 0 });
  });

  it("ряд чуть длиннее экрана — докрутка до конца, если слева под затуханием только поле и иконка первой вкладки", () => {
    const ru = row([110, 100, 120]);
    const max2 = ru.content - view;
    expect(max2).toBe(18);
    expect(tabRowScroll(ru.tabs, 2, view, max2)).toEqual({ left: 18, extra: 0 });
  });

  it("активная шире ряда — её начало сразу за затуханием", () => {
    const wide = row([120, 400]);
    expect(tabRowScroll(wide.tabs, 1, view, wide.content - view).left).toBe(wide.tabs[1].left - TAB_FADE);
  });
});
