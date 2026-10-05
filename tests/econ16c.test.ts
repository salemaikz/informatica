import { describe, expect, it } from "vitest";
import { dict, type DictKey } from "@/i18n/dict";
import { AI_COST, ENTRY_COST, entryCost, type AiKind } from "@/lib/economy";
import { playerHeartsWhere } from "@/lib/player-events";
import { HEART_OUT_WHERES } from "@/lib/analytics-schema";
import { label } from "@/app/owner/labels";

// Пакет P3 этапа 16В: тексты `econ16c.*`, цена тренировки, список цен ИИ.

const keys = Object.keys(dict).filter((k) => k.startsWith("econ16c.")) as DictKey[];
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("econ16c.*: словарь", () => {
  it("ключи есть, у каждого непустые ru и kk", () => {
    expect(keys.length).toBeGreaterThan(25);
    for (const k of keys) {
      expect(dict[k].ru.trim().length, k).toBeGreaterThan(0);
      expect(dict[k].kk.trim().length, k).toBeGreaterThan(0);
    }
  });
  it("плейсхолдеры в ru и kk одинаковые", () => {
    for (const k of keys) expect(ph(dict[k].kk), k).toEqual(ph(dict[k].ru));
  });
  it("числа (шанс, цены) — только плейсхолдерами; в тексте нет эмодзи", () => {
    for (const k of keys) {
      const strip = (s: string) => s.replace(/\{\w+\}/g, "");
      expect(strip(dict[k].ru), k).not.toMatch(/\d/);
      expect(strip(dict[k].kk), k).not.toMatch(/\d/);
      expect(dict[k].ru, k).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(dict[k].kk, k).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it("ҰБТ по-казахски, не «ЕНТ»; в русском нет глаголов с родом", () => {
    for (const k of keys) {
      expect(dict[k].kk, k).not.toMatch(/ЕНТ/);
      expect(dict[k].ru, k).not.toMatch(/\b(сделал|сделала|получил|получила|прошёл|прошла|выбрал|выбрала)\b/i);
    }
  });
  it("формы чипов в сюрпризе: one/few/many есть, склонение ru по числу", () => {
    expect(dict["econ16c.drop.chips.one"].ru).toBe("+{n} чип!");
    expect(dict["econ16c.drop.chips.few"].ru).toBe("+{n} чипа!");
    expect(dict["econ16c.drop.chips.many"].ru).toBe("+{n} чипов!");
  });
});

describe("список цен ИИ: «что это» под каждой строкой (пункт H)", () => {
  const described: AiKind[] = ["hint", "explain", "ask", "chat", "photo", "review", "feedback"];
  it("у каждого вида (кроме голоса — у него прежняя подпись) есть описание ru и kk", () => {
    for (const kind of described) {
      const k = `econ16c.ai.${kind}.desc` as DictKey;
      expect(dict[k], k).toBeDefined();
      expect(dict[k].ru.length, k).toBeGreaterThan(10);
      expect(dict[k].kk.length, k).toBeGreaterThan(10);
    }
    expect(dict["shop.ai.voice.sub"].ru).toContain("{n}");
  });
  it("разница подсказки и сообщения в чате понятна из текстов", () => {
    expect(dict["econ16c.ai.hint.desc"].ru).toBe("Намёк к заданию, на котором застрял. Ответ не называет.");
    expect(dict["econ16c.ai.chat.desc"].ru).toBe("Одно сообщение в чате с Битом — на любую тему.");
    expect(dict["econ16c.ai.review.desc"].ru).toBe("Разбор всего пробного ЕНТ: ошибки, темы, что повторить.");
  });
  it("цены прежние: подсказка 3, чат 7, разбор пробного ЕНТ 15", () => {
    expect(AI_COST.hint).toBe(3);
    expect(AI_COST.chat).toBe(7);
    expect(AI_COST.review).toBe(15);
  });
});

describe("тренировка за сердечко (пункт F)", () => {
  it("цена тренировки — 1 сердечко", () => {
    expect(ENTRY_COST.drill).toBe(1);
    expect(entryCost("drill")).toBe(1);
  });
  it("«сердечки закончились» в тренировке: аналитика «drill», подпись у владельца", () => {
    expect(playerHeartsWhere({ mode: "smart" })).toBe("drill");
    expect(playerHeartsWhere({ mode: "mistakes" })).toBe("drill");
    expect(playerHeartsWhere({ mode: "review" })).toBe("drill");
    expect(playerHeartsWhere({ mode: "minitest" })).toBe("check"); // мини-тест платит «Начать» как «Проверить себя»
    expect(playerHeartsWhere({ mode: "extern" })).toBe("extern");
    expect(playerHeartsWhere({})).toBe("lesson");
    expect(playerHeartsWhere({ via: "check" })).toBe("check");
    expect(HEART_OUT_WHERES).toContain("drill");
    expect(label.heartsWhere("drill")).toBe("тренировка");
  });
  it("нигде в тексте не обещают бесплатную тренировку или возврат сердечка за неё", () => {
    for (const [k, v] of Object.entries(dict)) {
      expect(v.ru, k).not.toMatch(/[Тт]ренировк\w* (— )?бесплатн|бесплатн\w* тренировк|тренировк\w* (вернёт|возвращает|вернула) сердечк/);
      expect(v.kk, k).not.toMatch(/Жаттығу (— )?тегін|жаттығу жүректі қайтар/i);
    }
  });
});
