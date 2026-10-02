import { describe, expect, it } from "vitest";
import type { EntItem, Text } from "@/lib/types";
import { ITEMS } from "@/content/ent/ns";
import { lessonBinary } from "@/content/lessons/ns-1-binary";
import { lessonBits } from "@/content/lessons/ns-1-bits";
import { lessonRead } from "@/content/lessons/ns-2-read";
import { lessonWrite } from "@/content/lessons/ns-3-write";
import { lessonTraps } from "@/content/lessons/ns-4-traps";
import { validateEnt } from "./validate";

// Задания ЕНТ по двоичной системе (src/content/ent/ns.ts): формат, состав и ответы, пересчитанные кодом.
// Плюс подсказки и разборы ошибок в готовых уроках двоичной системы (W1-9).

const ru = (t: Text) => (typeof t === "string" ? t : t.ru);
const bin = (n: number) => n.toString(2);
const dec = (s: string) => parseInt(s.replace("₂", ""), 2);
const ones = (n: number) => bin(n).split("1").length - 1;
const byId = (id: string) => {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) throw new Error(`нет задания ${id}`);
  return it;
};
const single = (id: string) => {
  const it = byId(id);
  if (it.kind !== "single") throw new Error(`${id} не single`);
  return ru(it.options[it.correct]);
};

describe("ЕНТ: двоичная система (ns)", () => {
  it("формат и состав по ТЗ", () => {
    expect(ITEMS.flatMap(validateEnt)).toEqual([]);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    const count = (k: EntItem["kind"]) => ITEMS.filter((i) => i.kind === k).length;
    expect(count("single")).toBeGreaterThanOrEqual(16);
    expect(count("multi")).toBeGreaterThanOrEqual(5);
    expect(count("match")).toBeGreaterThanOrEqual(5);
    const skills = new Set(["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props"]);
    for (const it of ITEMS) {
      expect(it.id.startsWith("ns:"), it.id).toBe(true);
      expect(it.topic, it.id).toBe("t04");
      expect(skills.has(it.skill), it.id).toBe(true);
      if (it.kind === "single") expect(it.whyWrong, `${it.id}: whyWrong`).toBeDefined();
    }
    for (const lv of [1, 2, 3]) expect(ITEMS.some((i) => i.level === lv), `уровень ${lv}`).toBe(true);
  });

  it("ответы single совпадают с вычислениями", () => {
    expect(single("ns:b2d-reverse")).toBe(String(dec("101110")));
    expect(single("ns:b2d-10000")).toBe(String(dec("10000")));
    expect(single("ns:b2d-1111")).toBe(String(dec("1111")));
    expect(single("ns:d2b-29")).toBe(bin(29));
    expect(single("ns:d2b-ones-12")).toBe(String(ones(12)));
    expect(single("ns:props-digits-32")).toBe(String(bin(32).length));
    expect(dec(single("ns:props-odd")) % 2).toBe(1);
    expect(single("ns:d2b-powers")).toBe(bin(2 ** 6 + 2 ** 3 + 2 ** 0));
    expect(single("ns:d2b-times4")).toBe(bin(13 * 4));
    expect(single("ns:props-ones-127")).toBe(String(ones(127)));
    expect(Number(single("ns:base-q")) ** 2).toBe(49);
    const twoOnes = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => ones(n) === 2).length;
    expect(single("ns:props-two-ones")).toBe(String(twoOnes));
    expect(single("ns:b2d-diff")).toBe(String(dec("110100") - 33));
    // Наибольшее среди двоичных и десятичных записей.
    const largest = byId("ns:b2d-largest");
    if (largest.kind !== "single") throw new Error();
    const vals = largest.options.map((o) => {
      const s = ru(o);
      return s.endsWith("₂") ? dec(s) : parseInt(s, 10);
    });
    expect(vals.indexOf(Math.max(...vals))).toBe(largest.correct);
  });

  it("ответы multi и match совпадают с вычислениями", () => {
    const multi = (id: string, pred: (s: string) => boolean) => {
      const it = byId(id);
      if (it.kind !== "multi") throw new Error(`${id} не multi`);
      const expected = it.options.map((o, i) => (pred(ru(o)) ? i : -1)).filter((i) => i >= 0);
      expect([...it.correct].sort(), id).toEqual(expected);
    };
    multi("ns:base-binary-multi", (s) => /^[01]+$/.test(s));
    multi("ns:b2d-gt20", (s) => dec(s) > 20);
    multi("ns:d2b-three-ones", (s) => ones(Number(s)) === 3);
    multi("ns:d2b-even-two", (s) => Number(s) % 2 === 0 && ones(Number(s)) === 2);

    const match = (id: string, value: (s: string) => string) => {
      const it = byId(id);
      if (it.kind !== "match") throw new Error(`${id} не match`);
      it.items.forEach((x, i) => expect(ru(it.choices[it.answer[i]]), `${id}: ${ru(x)}`).toBe(value(ru(x))));
    };
    match("ns:match-b2d-small", (s) => String(dec(s)));
    match("ns:match-b2d-edge", (s) => String(dec(s)));
    match("ns:match-d2b", (s) => bin(Number(s)));
  });
});

describe("уроки двоичной системы: подсказки и разборы ошибок", () => {
  const INFO = new Set(["story", "theory", "worked", "video", "explore"]);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const lesson of [lessonBinary, lessonBits, lessonRead, lessonWrite, lessonTraps]) {
    it(`${lesson.id}: у каждого задания есть hint, у choice/multi — whyWrong`, () => {
      for (const step of lesson.steps) {
        if (INFO.has(step.type)) continue;
        expect(step.hint?.ru && step.hint.kk, `${step.id}: hint`).toBeTruthy();
        if (step.type === "choice" || step.type === "multi") {
          const right = step.type === "choice" ? [step.correct] : step.correct;
          expect(step.whyWrong?.length, `${step.id}: whyWrong`).toBe(step.options.length);
          step.whyWrong!.forEach((w, i) => expect(w === null, `${step.id}: whyWrong[${i}]`).toBe(right.includes(i)));
        }
        // Подсказка не выдаёт ответ (проверяем ответы длиной от 2 символов как отдельные слова).
        const answers =
          step.type === "input" ? step.answers : step.type === "choice" ? [ru(step.options[step.correct])] : [];
        for (const a of answers.filter((x) => x.length >= 2)) {
          const re = new RegExp(`(^|[^0-9a-zA-Zа-яё])${esc(a)}($|[^0-9a-zA-Zа-яё])`, "i");
          expect(re.test(step.hint!.ru) || re.test(step.hint!.kk), `${step.id}: подсказка содержит ответ ${a}`).toBe(false);
        }
      }
    });
  }
});
