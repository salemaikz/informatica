import { describe, expect, it } from "vitest";
import { HOUR, MINUTE, PLAN_FEATURES, yearSaving } from "@/lib/economy";
import { dict } from "@/i18n/dict";
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
  it("часы: 150 минут — «2,5 ч» / «2,5 сағ», 5 часов — «5 ч»", () => {
    expect(formatHours(150 * MINUTE, "ru")).toBe("2,5 ч");
    expect(formatHours(150 * MINUTE, "kk")).toBe("2,5 сағ");
    expect(formatHours(5 * HOUR, "ru")).toBe("5 ч");
    expect(formatHours(5 * HOUR, "kk")).toBe("5 сағ");
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
  it("возврат сердечка: 6 ч / 3 ч / прочерк", () => {
    expect(byId("regen").cells.free).toEqual({ kind: "text", text: "6 ч" });
    expect(byId("regen").cells.lite).toEqual({ kind: "text", text: "3 ч" });
    expect(byId("regen").cells.unlimited).toEqual({ kind: "dash" });
  });
  it("возврат сердечка по-казахски: 6 сағ / 3 сағ", () => {
    const kk = compareRows("kk").find((r) => r.id === "regen")!;
    expect(kk.cells.free).toEqual({ kind: "text", text: "6 сағ" });
    expect(kk.cells.lite).toEqual({ kind: "text", text: "3 сағ" });
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

describe("тексты тарифов без суточного пополнения", () => {
  const forbidden = /в день|каждый день|күніне жүрек|Күн сайын/;

  it("пункты про сердечки не обещают «в день»", () => {
    for (const key of ["plans.perk.lite.hearts", "plans.cmp.hearts"] as const) {
      expect(dict[key].ru, key).not.toMatch(forbidden);
      expect(dict[key].kk, key).not.toMatch(forbidden);
    }
    expect(dict["plans.perk.lite.hearts"].ru).toBe("{n} сердечек, новое каждые {time}");
    expect(dict["plans.cmp.hearts"].ru).toBe("Запас сердечек");
  });

  it("карточка профиля: запас, время возврата и ИИ в день", () => {
    const f = dict["plans.profile.freeText"];
    expect(f.ru).toBe("{hearts} сердечек, новое каждые {time}; ИИ: {ai} в день");
    for (const p of ["{hearts}", "{time}", "{ai}"]) {
      expect(f.ru).toContain(p);
      expect(f.kk).toContain(p);
    }
  });

  it("у сердечек в магазине и в окне «закончились» нет обещания полного запаса каждый день", () => {
    for (const key of ["shop.hearts.hint", "hearts.out.text"] as const) {
      expect(dict[key].ru, key).not.toMatch(/Каждый день|каждый день|снова полный/);
      expect(dict[key].kk, key).not.toMatch(/Күн сайын/);
    }
    expect(dict["shop.hearts.hint"].ru).toContain("{time}");
    expect(dict["shop.hearts.hint"].kk).toContain("{time}");
  });
});
