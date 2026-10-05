import { describe, expect, it } from "vitest";
import { CARD_MAX_TOPICS, cardFileName, cardToneColor, CARD_COLORS, hostOf, pickStrongTopics, type CardTopic } from "@/lib/share-card";

const row = (label: string, points: number, max: number): CardTopic => ({ label, points, max });

describe("карточка: сильные темы", () => {
  it("только доля ≥ 0,5, по убыванию, не больше 3", () => {
    const r = pickStrongTopics([row("a", 1, 4), row("b", 3, 3), row("c", 2, 4), row("d", 4, 5), row("e", 5, 6), row("f", 0, 2)]);
    expect(r.map((t) => t.label)).toEqual(["b", "e", "d"]);
    expect(r.length).toBeLessThanOrEqual(CARD_MAX_TOPICS);
  });
  it("слабые темы не попадают никогда", () => {
    expect(pickStrongTopics([row("a", 0, 3), row("b", 1, 3)])).toEqual([]);
  });
  it("граница 0,5 — сильная; при равной доле раньше та, где больше заданий, затем по названию", () => {
    const r = pickStrongTopics([row("b", 1, 2), row("a", 2, 4), row("c", 1, 2)]);
    expect(r.map((t) => t.label)).toEqual(["a", "b", "c"]);
  });
  it("мусор (нет заданий, NaN) отбрасывается", () => {
    expect(pickStrongTopics([row("a", 0, 0), row("b", Number.NaN, 3), row("c", 3, Number.POSITIVE_INFINITY)])).toEqual([]);
  });
  it("лимит задаётся", () => {
    expect(pickStrongTopics([row("a", 3, 3), row("b", 3, 3)], 1)).toHaveLength(1);
    expect(pickStrongTopics([row("a", 3, 3)], 0)).toEqual([]);
  });
  it("не меняет исходный массив", () => {
    const src = [row("a", 1, 2), row("b", 3, 3)];
    pickStrongTopics(src);
    expect(src.map((t) => t.label)).toEqual(["a", "b"]);
  });
});

describe("карточка: тон, файл, хост", () => {
  it("цвет по доле: < 0,5 красный, < 0,8 янтарный, иначе зелёный", () => {
    expect(cardToneColor(0.49)).toBe(CARD_COLORS.danger);
    expect(cardToneColor(0.5)).toBe(CARD_COLORS.warning);
    expect(cardToneColor(0.79)).toBe(CARD_COLORS.warning);
    expect(cardToneColor(0.8)).toBe(CARD_COLORS.success);
    expect(cardToneColor(Number.NaN)).toBe(CARD_COLORS.danger);
  });
  it("имя файла", () => {
    expect(cardFileName({ kind: "exam", examKind: "mini", points: 14, max: 19 })).toBe("informatica-mini-14-of-19.png");
    expect(cardFileName({ kind: "exam", examKind: "../x y", points: 1, max: 2 })).toBe("informatica-xy-1-of-2.png");
    expect(cardFileName({ kind: "course", percent: 42 })).toBe("informatica-course-42.png");
    expect(cardFileName({ kind: "streak", days: 5 })).toBe("informatica-streak-5.png");
    expect(cardFileName({ kind: "lesson", percent: 85 })).toBe("informatica-lesson-85.png");
  });
  it("хост без протокола и пути", () => {
    expect(hostOf("https://informatica-chi.vercel.app")).toBe("informatica-chi.vercel.app");
    expect(hostOf("http://localhost:3100/x")).toBe("localhost:3100");
    expect(hostOf("не адрес/путь")).toBe("не адрес");
  });
});
