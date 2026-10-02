import { describe, expect, it } from "vitest";
import { FIRST_TASKS, binToDec, detectLang, expectedText, isCorrect, lampsValue, taskXp } from "@/components/onboarding/logic";
import { isPublicPath } from "@/lib/public-paths";
import { onboardDict } from "@/i18n/parts/onboard";

describe("онбординг: логика заданий", () => {
  it("язык из navigator.language", () => {
    expect(detectLang("kk-KZ")).toBe("kk");
    expect(detectLang("KK")).toBe("kk");
    expect(detectLang("ru-RU")).toBe("ru");
    expect(detectLang("en-US")).toBe("ru");
    expect(detectLang(undefined)).toBe("ru");
  });

  it("лампочки считаются по весам 8-4-2-1", () => {
    expect(lampsValue([false, false, false, false])).toBe(0);
    expect(lampsValue([false, true, false, true])).toBe(5);
    expect(lampsValue([true, true, true, true])).toBe(15);
  });

  it("ответы считает код", () => {
    const [lamps, choice, compare] = FIRST_TASKS;
    expect(isCorrect(lamps, 5)).toBe(true);
    expect(isCorrect(lamps, 6)).toBe(false);
    expect(binToDec("1011")).toBe(11);
    expect(isCorrect(choice, 11)).toBe(true);
    expect(isCorrect(choice, 13)).toBe(false);
    expect(isCorrect(compare, "bin")).toBe(true); // 1000₂ = 8 > 7
    expect(isCorrect(compare, "dec")).toBe(false);
    expect(expectedText(compare)).toBe("1000₂");
  });

  it("у каждого задания верный вариант есть среди вариантов", () => {
    for (const t of FIRST_TASKS) if (t.kind === "choice") expect(t.options).toContain(binToDec(t.bits));
  });

  it("XP: повторная попытка дешевле", () => {
    expect(taskXp(true)).toBeGreaterThan(taskXp(false));
  });
});

describe("открытые ссылки", () => {
  it.each(["/lesson/ns-1-bits", "/theory/ns-1-bits", "/exam/run", "/game/bit-rush", "/onboarding"])("%s — без онбординга", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(["/", "/learn", "/practice", "/exam", "/lessons", "/gamex", "/theoryx", "/exam/run/x", "/exam/runx"])("%s — с онбордингом", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("строки онбординга", () => {
  it("двуязычные, с префиксом onboard.", () => {
    for (const [k, v] of Object.entries(onboardDict)) {
      expect(k.startsWith("onboard.")).toBe(true);
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
});
