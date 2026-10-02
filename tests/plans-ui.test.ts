import { describe, expect, it } from "vitest";
import { PLAN_FEATURES, yearSaving } from "@/lib/economy";
import { closeAction, compareRows, formatHours, formatMult, formatNumber, parseFrom, planWhat, subtitleKey, yearDiscountPercent } from "@/components/plans/plans-helpers";

describe("parseFrom / closeAction", () => {
  it("принимает только известные источники", () => {
    expect(parseFrom("onboarding")).toBe("onboarding");
    expect(parseFrom("hearts")).toBe("hearts");
    expect(parseFrom("evil")).toBeUndefined();
    expect(parseFrom(null)).toBeUndefined();
  });
  it("онбординг и автопоказ закрываются на карту, остальные — назад", () => {
    expect(closeAction("onboarding", 5)).toBe("learn");
    expect(closeAction("auto", 5)).toBe("learn");
    expect(closeAction("shop", 5)).toBe("back");
    expect(closeAction("profile", 2)).toBe("back");
  });
  it("без истории — на карту", () => {
    expect(closeAction("shop", 1)).toBe("learn");
    expect(closeAction(undefined, 1)).toBe("learn");
    expect(closeAction(undefined, 3)).toBe("back");
  });
  it("подзаголовок зависит от источника", () => {
    expect(subtitleKey("hearts")).toBe("plans.sub.hearts");
    expect(subtitleKey("ai")).toBe("plans.sub.ai");
    expect(subtitleKey("shop")).toBe("plans.sub.default");
  });
});

describe("форматирование", () => {
  it("множитель и часы с десятичной запятой", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatMult(2)).toBe("×2");
    expect(formatMult(1.5)).toBe("×1,5");
    expect(formatHours(2 * 3_600_000, "ru")).toBe("2 ч");
    expect(formatHours(4 * 3_600_000, "kk")).toBe("4 сағ");
  });
  it("подпись товара для шторки", () => {
    expect(planWhat("Безлимит", "19 990 ₸", "год")).toBe("Безлимит · 19 990 ₸ / год");
  });
  it("скидка за год — наименьшая из двух (честная для обоих тарифов)", () => {
    expect(yearDiscountPercent()).toBe(Math.min(yearSaving("lite").percent, yearSaving("unlimited").percent));
    expect(yearDiscountPercent()).toBeGreaterThanOrEqual(35);
  });
});

describe("compareRows", () => {
  const rows = compareRows("ru");
  const byId = (id: string) => rows.find((r) => r.id === id)!;
  it("сердечки 5 / 10 / ∞", () => {
    expect(["free", "lite", "unlimited"].map((t) => byId("hearts").cells[t as "free"])).toEqual([
      { kind: "text", text: String(PLAN_FEATURES.free.maxHearts) },
      { kind: "text", text: String(PLAN_FEATURES.lite.maxHearts) },
      { kind: "text", text: "∞" },
    ]);
  });
  it("возврат сердечка: 4 ч / 2 ч / прочерк", () => {
    expect(byId("regen").cells.free).toEqual({ kind: "text", text: "4 ч" });
    expect(byId("regen").cells.lite).toEqual({ kind: "text", text: "2 ч" });
    expect(byId("regen").cells.unlimited).toEqual({ kind: "dash" });
  });
  it("ИИ 3 / 30 / ∞ и множитель ×1 / ×1,5 / ×2", () => {
    expect(byId("ai").cells.free).toEqual({ kind: "text", text: "3" });
    expect(byId("ai").cells.lite).toEqual({ kind: "text", text: "30" });
    expect(byId("ai").cells.unlimited).toEqual({ kind: "text", text: "∞" });
    expect(byId("chips").cells.lite).toEqual({ kind: "text", text: "×1,5" });
    expect(byId("chips").cells.unlimited).toEqual({ kind: "text", text: "×2" });
  });
  it("уроки, тренировки, ЕНТ и история — везде", () => {
    for (const id of ["access", "history"]) for (const tier of ["free", "lite", "unlimited"] as const) expect(byId(id).cells[tier]).toEqual({ kind: "check" });
  });
});
