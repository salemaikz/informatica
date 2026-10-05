import { describe, expect, it } from "vitest";
import { dict, type DictKey } from "@/i18n/dict";
import { AI_COST, PLAN_FEATURES } from "@/lib/economy";
import { pluralForm } from "@/components/learn/map";
import { fmt } from "@/lib/text";

// Строки правок по отзыву владельца (этап 15, F2): сердечки, теория за 0,5, счётчик ИИ.

const keys = Object.keys(dict).filter((k) => k.startsWith("hearts15.")) as DictKey[];
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("hearts15.*: словарь", () => {
  it("ключи есть, у каждого непустые ru и kk", () => {
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) {
      expect(dict[k].ru.trim().length, k).toBeGreaterThan(0);
      expect(dict[k].kk.trim().length, k).toBeGreaterThan(0);
    }
  });

  it("плейсхолдеры в ru и kk одинаковые", () => {
    for (const k of keys) expect(ph(dict[k].kk), k).toEqual(ph(dict[k].ru));
  });

  it("числа (цены, лимиты) — только плейсхолдерами", () => {
    for (const k of keys) {
      const strip = (s: string) => s.replace(/\{\w+\}/g, "");
      expect(strip(dict[k].ru), k).not.toMatch(/\d/);
      expect(strip(dict[k].kk), k).not.toMatch(/\d/);
    }
  });

  it("счётчик ИИ: для каждой цены обращения есть форма «за K чипов» (ru склоняется по числу)", () => {
    for (const cost of Object.values(AI_COST).filter((c) => c > 0)) {
      const key = `hearts15.ai.out.${pluralForm(cost)}` as DictKey;
      expect(dict[key], key).toBeDefined();
      const ru = fmt(dict[key].ru, { max: PLAN_FEATURES.free.aiFree, cost });
      expect(ru).toContain(`за ${cost} чип`);
      expect(ru).toContain(`завтра снова ${PLAN_FEATURES.free.aiFree}`);
      expect(ru).not.toContain("{");
    }
    // 2, 3 — «чипа», 5 и больше — «чипов»
    expect(fmt(dict["hearts15.ai.out.few"].ru, { max: 3, cost: 3 })).toMatch(/чипа$/);
    expect(fmt(dict["hearts15.ai.out.many"].ru, { max: 3, cost: 5 })).toMatch(/чипов$/);
  });

  it("«бесплатно, осталось N из M сегодня»", () => {
    expect(fmt(dict["hearts15.ai.free"].ru, { n: 2, max: 3 })).toBe("бесплатно, осталось 2 из 3 сегодня");
    expect(fmt(dict["hearts15.ai.freeShort"].ru, { n: 2, max: 3 })).toBe("бесплатно · 2 из 3");
  });

  it("в тексте для ученика нет эмодзи и глаголов с родом", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const k of keys) {
      expect(dict[k].ru, k).not.toMatch(emoji);
      expect(dict[k].ru, k).not.toMatch(/\b(?:сделал|сделала|прочитал|прочитала|начал|начала)\b/i);
    }
  });
});
