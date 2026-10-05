import { beforeEach, describe, expect, it } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import { EMPTY_COSMETICS } from "@/lib/cosmetics";
import { rollLevelCase } from "@/lib/level-case";
import { START_WALLET } from "@/lib/economy";
import type { AnswerRecord } from "@/lib/types";

const st = () => useApp.getState();

/** Кладёт в кошелёк столько чипов (остальное — как у нового ученика). */
const giveChips = (chips: number) => useApp.setState({ wallet: { ...START_WALLET, chips, earned: chips } });

const right = (stepId: string): AnswerRecord => ({
  stepId,
  skill: "ns.dec2bin",
  correct: true,
  score: 1,
  given: "1",
  expected: "1",
  prompt: "?",
  retry: false,
  timeMs: 1000,
});

describe("стор: украшения профиля", () => {
  beforeEach(() => st().resetProgress());

  it("по умолчанию — пусто", () => {
    expect(st().cosmetics).toEqual(EMPTY_COSMETICS);
  });

  it("покупка: чипы списаны, строка в истории с id украшения, купленное сразу надето", () => {
    giveChips(200);
    const res = st().buyCosmetic("frame-dots");
    expect(res).toEqual({ ok: true });
    const s = st();
    expect(s.wallet.chips).toBe(120);
    expect(s.wallet.spent).toBe(80);
    expect(s.cosmetics.owned).toEqual(["frame-dots"]);
    expect(s.cosmetics.equipped.frame).toBe("frame-dots");
    expect(s.ledger[0]).toMatchObject({ amount: -80, reason: "buy", note: "frame-dots" });
  });

  it("цены: редкое 160, эпическое 320; надевается только в свой слот", () => {
    giveChips(600);
    expect(st().buyCosmetic("banner-night")).toEqual({ ok: true });
    expect(st().buyCosmetic("title-algo-master")).toEqual({ ok: true });
    expect(st().wallet.chips).toBe(600 - 160 - 320);
    expect(st().cosmetics.equipped).toEqual({ frame: null, banner: "banner-night", title: "title-algo-master" });
  });

  it("не хватает чипов — отказ, ничего не меняется", () => {
    giveChips(79);
    const before = st();
    expect(st().buyCosmetic("frame-dots")).toEqual({ ok: false, reason: "chips" });
    expect(st().wallet).toBe(before.wallet);
    expect(st().cosmetics).toBe(before.cosmetics);
    expect(st().ledger).toBe(before.ledger);
  });

  it("повторная покупка и легендарное — отказ без списания", () => {
    giveChips(5000);
    expect(st().buyCosmetic("frame-dots")).toEqual({ ok: true });
    const chips = st().wallet.chips;
    expect(st().buyCosmetic("frame-dots")).toEqual({ ok: false, reason: "owned" });
    expect(st().buyCosmetic("frame-crown")).toEqual({ ok: false, reason: "notForSale" });
    expect(st().buyCosmetic("title-legend")).toEqual({ ok: false, reason: "notForSale" });
    expect(st().wallet.chips).toBe(chips);
    expect(st().cosmetics.owned).toEqual(["frame-dots"]);
  });

  it("equipCosmetic: надеть, снять, не купленное и чужой слот — без изменений", () => {
    giveChips(500);
    st().buyCosmetic("frame-dots");
    st().buyCosmetic("frame-wave");
    expect(st().cosmetics.equipped.frame).toBe("frame-wave");
    st().equipCosmetic("frame", "frame-dots");
    expect(st().cosmetics.equipped.frame).toBe("frame-dots");
    st().equipCosmetic("frame", null);
    expect(st().cosmetics.equipped.frame).toBeNull();
    const before = st().cosmetics;
    st().equipCosmetic("frame", "frame-neon"); // не куплено
    st().equipCosmetic("banner", "frame-dots"); // чужой слот
    expect(st().cosmetics).toBe(before);
  });

  it("resetProgress сбрасывает украшения", () => {
    giveChips(500);
    st().buyCosmetic("frame-dots");
    st().resetProgress();
    expect(st().cosmetics).toEqual(EMPTY_COSMETICS);
  });

  it("старое сохранение без поля cosmetics загружается пустым; мусор не ломает загрузку", () => {
    expect(mergeState({ xp: 5, profile: {} }, st()).cosmetics).toEqual(EMPTY_COSMETICS);
    expect(mergeState({ cosmetics: "мусор" }, st()).cosmetics).toEqual(EMPTY_COSMETICS);
    const m = mergeState(
      { cosmetics: { owned: ["frame-dots", "nope"], equipped: { frame: "frame-dots", banner: "frame-dots", title: "title-legend" } } },
      st(),
    );
    expect(m.cosmetics.owned).toEqual(["frame-dots"]);
    expect(m.cosmetics.equipped).toEqual({ frame: "frame-dots", banner: null, title: null });
  });

  it("кейс за уровень: выпавшее украшение попадает в owned и не надевается; повторный кейс его не повторяет", () => {
    st().recordAnswer(right("a"), 150); // уровень 2 — кейс в очереди
    expect(st().pendingCases).toEqual([2]);
    // seed, на котором выпадает украшение (сердечки у нового ученика полные)
    let seed = 0;
    for (let i = 1; i < 20000 && !seed; i++) if (rollLevelCase(2, i, true).prize.kind === "cosmetic") seed = i;
    expect(seed).toBeGreaterThan(0);
    const chips = st().wallet.chips;
    const roll = st().openLevelCase(2, seed)!;
    expect(roll.prize.kind).toBe("cosmetic");
    const id = roll.prize.cosmetic!;
    expect(st().cosmetics.owned).toEqual([id]);
    expect(st().cosmetics.equipped).toEqual({ frame: null, banner: null, title: null });
    expect(st().wallet.chips).toBe(chips);
    expect(st().pendingCases).toEqual([]);
    // выпавшее надевается обычным действием
    const slot = id.split("-")[0] as "frame" | "banner" | "title";
    st().equipCosmetic(slot, id);
    expect(st().cosmetics.equipped[slot]).toBe(id);
    // то же украшение второй раз не выпадет
    st().recordAnswer(right("b"), 250);
    const level = st().pendingCases[0];
    const second = st().openLevelCase(level, seed)!;
    if (second.prize.kind === "cosmetic") expect(second.prize.cosmetic).not.toBe(id);
  });
});
