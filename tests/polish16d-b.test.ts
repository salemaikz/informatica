import { describe, expect, it } from "vitest";
import { dict, type DictKey } from "@/i18n/dict";
import { missPromptText } from "@/lib/miss-prompt";
import { bumpMissLog, mergeState, useApp } from "@/lib/store";
import type { AnswerRecord } from "@/lib/types";

const st = () => useApp.getState();

describe("polB: «Повторяющиеся ошибки» на двух языках", () => {
  it("bumpMissLog хранит promptL и не теряет его при следующей ошибке без promptL", () => {
    let log = bumpMissLog({}, "q", "Сколько байт?", "l1", 1, { ru: "Сколько байт?", kk: "Неше байт?" });
    expect(log.q.promptL).toEqual({ ru: "Сколько байт?", kk: "Неше байт?" });
    log = bumpMissLog(log, "q", "Сколько байт?", undefined, 2);
    expect(log.q.n).toBe(2);
    expect(log.q.promptL?.kk).toBe("Неше байт?");
    expect(log.q.lessonId).toBe("l1");
  });

  it("битый promptL (одна строка, пустой язык, не объект) не сохраняется", () => {
    const bad = bumpMissLog({}, "q", "p", undefined, 1, { ru: "x", kk: " " });
    expect(bad.q.promptL).toBeUndefined();
    const m = mergeState(
      {
        missLog: {
          a: { n: 2, prompt: "p", promptL: { ru: "да", kk: "иә" }, at: 1 },
          b: { n: 2, prompt: "p", promptL: "строка", at: 1 },
          c: { n: 2, prompt: "p", promptL: { ru: "только ru" }, at: 1 },
          d: { n: 2, prompt: "p", at: 1 },
        },
      },
      st(),
    );
    expect(m.missLog.a.promptL).toEqual({ ru: "да", kk: "иә" });
    expect(m.missLog.b.promptL).toBeUndefined();
    expect(m.missLog.c.promptL).toBeUndefined();
    expect(m.missLog.d.prompt).toBe("p"); // старая запись читается как раньше
  });

  it("recordAnswer передаёт promptL в журнал", () => {
    const rec: AnswerRecord & { promptL: { ru: string; kk: string } } = {
      stepId: "pl-1",
      skill: "ns.bin2dec",
      correct: false,
      score: 0,
      given: "1",
      expected: "2",
      prompt: "Сколько?",
      promptL: { ru: "Сколько?", kk: "Қанша?" },
      retry: false,
      timeMs: 1000,
    };
    st().recordAnswer(rec, 0);
    expect(st().missLog["pl-1"].promptL?.kk).toBe("Қанша?");
  });

  it("missPromptText: контент → оба языка → старая строка", () => {
    const e = { prompt: "старый", promptL: { ru: "ру", kk: "қаз" } };
    expect(missPromptText(e, { ru: "из контента", kk: "контенттен" })).toEqual({ ru: "из контента", kk: "контенттен" });
    expect(missPromptText(e)).toEqual({ ru: "ру", kk: "қаз" });
    expect(missPromptText({ prompt: "старый" })).toBe("старый");
  });
});

describe("polB: строки polish16d", () => {
  const keys = Object.keys(dict).filter((k) => k.startsWith("pol16d.")) as DictKey[];
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  it("есть, оба языка непустые, параметры совпадают", () => {
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const k of keys) {
      expect(dict[k].ru.trim().length, k).toBeGreaterThan(0);
      expect(dict[k].kk.trim().length, k).toBeGreaterThan(0);
      expect(ph(dict[k].kk), k).toEqual(ph(dict[k].ru));
    }
  });
  it("«Бесплатно ещё N из M» без двоеточия; короткий плейсхолдер вопроса", () => {
    expect(dict["pol16d.ai.free"].ru).toBe("Бесплатно ещё {n} из {max}");
    expect(dict["pol16d.ai.free"].ru).not.toContain(":");
    expect(dict["pol16d.ai.free"].kk).not.toContain(":");
    expect(dict["tutor.askPlaceholder"]).toEqual({ ru: "Спроси своими словами…", kk: "Өз сөзіңмен сұра…" });
  });
});
