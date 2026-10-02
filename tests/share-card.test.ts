import { describe, expect, it } from "vitest";
import { CARD_COLORS, CARD_MAX_TOPICS, CARD_MIN_TOPICS, cardFileName, cardToneColor, pickCardTopics } from "@/lib/share-card";
import { toneOf } from "@/components/exam/logic";
import { readFileSync } from "node:fs";

const topic = (label: string, points: number, max: number) => ({ label, points, max });

describe("share-card", () => {
  it("цвет полоски совпадает с семантикой toneOf", () => {
    const map = { danger: CARD_COLORS.danger, warning: CARD_COLORS.warning, success: CARD_COLORS.success };
    for (const r of [0, 0.2, 0.49, 0.5, 0.79, 0.8, 1]) expect(cardToneColor(r)).toBe(map[toneOf(r)]);
  });

  it("hex карточки равны токенам светлой темы из globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const light = css.slice(css.indexOf(":root"), css.indexOf('[data-theme="dark"]') > 0 ? css.indexOf('[data-theme="dark"]') : undefined);
    const tok = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(light)?.[1].toLowerCase();
    expect(CARD_COLORS.bg).toBe(tok("bg"));
    expect(CARD_COLORS.surface).toBe(tok("surface"));
    expect(CARD_COLORS.border).toBe(tok("border"));
    expect(CARD_COLORS.text).toBe(tok("text"));
    expect(CARD_COLORS.muted).toBe(tok("muted"));
    expect(CARD_COLORS.primary).toBe(tok("primary"));
    expect(CARD_COLORS.primaryStrong).toBe(tok("primary-strong"));
    expect(CARD_COLORS.success).toBe(tok("success"));
    expect(CARD_COLORS.warning).toBe(tok("warning"));
    expect(CARD_COLORS.danger).toBe(tok("danger"));
    expect(CARD_COLORS.gold).toBe(tok("gold"));
  });

  it("темы: не больше 5, пустые и битые отбрасываются, лучшие сверху", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"].map((l, i) => topic(l, i % 3, 3 + (i % 2)));
    const picked = pickCardTopics([...many, topic("пусто", 0, 0), topic("nan", NaN, 3)]);
    expect(picked.length).toBeLessThanOrEqual(CARD_MAX_TOPICS);
    expect(picked.length).toBeGreaterThanOrEqual(CARD_MIN_TOPICS);
    expect(picked.find((t) => t.label === "пусто" || t.label === "nan")).toBeUndefined();
    const ratios = picked.map((t) => t.points / t.max);
    expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
  });

  it("при нескольких темах берутся самые «весомые» (больше баллов в варианте)", () => {
    const picked = pickCardTopics([topic("a", 1, 1), topic("b", 2, 2), topic("c", 3, 6), topic("d", 4, 8), topic("e", 5, 10), topic("f", 6, 12)]);
    expect(picked.map((t) => t.label).sort()).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("имя файла", () => {
    expect(cardFileName("mini", 14, 19)).toBe("informatica-mini-14-of-19.png");
  });
});
