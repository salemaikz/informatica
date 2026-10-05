import { describe, expect, it } from "vitest";
import { bankFor, draw, hasShape, rampLevel, skillsWithShape } from "@/lib/bank";
import { NS_BANKS, LEVELS } from "@/lib/bank/ns";
import { buildDrill, generateLeveled } from "@/lib/generators";
import { entPoints, levelFromMastery, matchPoints, multiPoints } from "@/lib/ent";
import { evaluate } from "@/lib/evaluate";
import type { MatchStep, MultiStep } from "@/lib/types";
import { kkSuffix, type KkCase } from "@/lib/kk";
import { validateStep } from "./validate";

const SKILLS = NS_BANKS.map((b) => b.skill);
const fromSub = (s: string) => s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(c)));

/** Разбор формулы «X₂ = Y₁₀» / «X₁₀ = Y₂» — проверяем, что код правильно вычислил истинность. */
function formulaTruth(text: string): boolean | null {
  const m = text.match(/^([0-9A-F]+)(₂|₁₀) = ([0-9A-F]+)(₂|₁₀)$/);
  if (!m) return null;
  const val = (digits: string, sub: string) => parseInt(digits, fromSub(sub) === "2" ? 2 : 10);
  return val(m[1], m[2]) === val(m[3], m[4]);
}

describe("ЕНТ: баллы за несколько ответов", () => {
  it("совпадают с таблицей п. 18 Правил ЕНТ", () => {
    // [верных всего, выбрано верных, выбрано неверных] → баллы
    const table: [number, number, number, number][] = [
      [1, 1, 0, 2], [1, 1, 1, 1], [1, 1, 2, 0], [1, 0, 1, 0],
      [2, 2, 0, 2], [2, 1, 0, 1], [2, 1, 1, 1], [2, 2, 1, 1], [2, 2, 2, 0], [2, 0, 1, 0],
      [3, 3, 0, 2], [3, 2, 0, 1], [3, 2, 1, 1], [3, 3, 1, 1], [3, 1, 0, 0], [3, 1, 1, 0], [3, 3, 2, 0],
    ];
    for (const [k, c, w, p] of table) expect(entPoints(k, c, w), `${k}/${c}/${w}`).toBe(p);
  });

  it("multiPoints считает по выбранным индексам", () => {
    expect(multiPoints([0, 2], [2, 0])).toBe(2);
    expect(multiPoints([0, 2], [0])).toBe(1);
    expect(multiPoints([0, 2], [0, 1, 3])).toBe(0);
  });

  it("частичный ответ в уроке — score 0.5 и пометка partial", () => {
    const step: MultiStep = {
      id: "m",
      type: "multi",
      prompt: { ru: "?", kk: "?" },
      options: ["a", "b", "c", "d"],
      correct: [0, 2],
      explanation: { ru: "", kk: "" },
    };
    expect(evaluate(step, { type: "multi", indices: [0, 2] }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(step, { type: "multi", indices: [0] }, "ru")).toMatchObject({ correct: false, score: 0.5, partial: true });
    expect(evaluate(step, { type: "multi", indices: [1, 3] }, "ru")).toMatchObject({ correct: false, score: 0 });
  });

  it("соответствие ЕНТ (2 пункта): оба верно — 2, один — 1, ни одного — 0", () => {
    expect(matchPoints([2, 0], [2, 0])).toBe(2);
    expect(matchPoints([2, 0], [2, 3])).toBe(1);
    expect(matchPoints([2, 0], [1, 3])).toBe(0);
    expect(matchPoints([2, 0], [])).toBe(0);
    expect(matchPoints([], [])).toBe(0);
  });

  it("соответствие в уроке — самопроверка: каждый промах снижает оценку на четверть", () => {
    const step: MatchStep = {
      id: "mt",
      type: "match",
      prompt: { ru: "?", kk: "?" },
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
      ],
      explanation: { ru: "", kk: "" },
    };
    expect(evaluate(step, { type: "match", done: true, wrong: 0 }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(step, { type: "match", done: true, wrong: 1 }, "ru")).toMatchObject({ correct: false, score: 0.75 });
    expect(evaluate(step, { type: "match", done: true, wrong: 5 }, "ru")).toMatchObject({ correct: false, score: 0 });
  });
});

describe("уровни A/B/C", () => {
  it("уровень по освоению", () => {
    expect(levelFromMastery(0)).toBe(1);
    expect(levelFromMastery(0.6)).toBe(2);
    expect(levelFromMastery(0.9)).toBe(3);
  });

  it("генераторы ставят уровень и дают корректные шаги", () => {
    for (const skill of SKILLS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 120; seed++) {
          const step = generateLeveled(skill, level, seed);
          expect(step.level).toBe(level);
          expect(validateStep(step), step.id).toEqual([]);
        }
  });

  it("тренировка идёт от лёгкого к сложному", () => {
    for (let seed = 1; seed < 30; seed++) {
      const steps = buildDrill(SKILLS, {}, { seed, count: 9 });
      const levels = steps.map((s) => s.level ?? 1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(levels.at(-1)).toBeGreaterThan(levels[0]);
    }
  });

  it("rampLevel растёт равномерно", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => rampLevel(i, 6, 1, 3))).toEqual([1, 1, 2, 2, 3, 3]);
    expect(rampLevel(0, 1, 2, 3)).toBe(2);
  });
});

describe("банк заданий", () => {
  it("у всех навыков системы счисления есть все формы", () => {
    for (const s of SKILLS) for (const shape of ["question", "statement", "pair", "short"] as const) expect(hasShape(s, shape)).toBe(true);
    expect(skillsWithShape(["ns.bin2dec", "nope"], "pair")).toEqual(["ns.bin2dec"]);
  });

  it("утверждения: оба языка, истинность вычислена верно, есть и верные, и неверные", () => {
    for (const b of NS_BANKS)
      for (const level of LEVELS) {
        let t = 0;
        let f = 0;
        for (let seed = 1; seed < 200; seed++) {
          const s = b.statement!(level, seed);
          expect(s.text.ru && s.text.kk && s.explanation.ru && s.explanation.kk).toBeTruthy();
          expect(s.level).toBe(level);
          const truth = formulaTruth(s.text.ru);
          if (truth !== null) expect(s.value, s.text.ru).toBe(truth);
          if (s.value) t++;
          else f++;
        }
        expect(t, `${b.skill} L${level}`).toBeGreaterThan(20);
        expect(f, `${b.skill} L${level}`).toBeGreaterThan(20);
      }
  });

  it("утверждения и короткие вопросы имеют подсказку на двух языках", () => {
    for (const b of NS_BANKS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 60; seed++) {
          for (const item of [b.statement!(level, seed), b.short!(level, seed)]) {
            expect(item.hint?.ru && item.hint?.kk, `${item.id}`).toBeTruthy();
          }
        }
  });

  it("казахские тексты банка ns: окончания после чисел только как у kkSuffix", () => {
    const CASES: KkCase[] = ["acc", "dat", "loc", "abl", "gen", "ins"];
    for (const b of NS_BANKS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 80; seed++) {
          const st = b.statement!(level, seed);
          const sh = b.short!(level, seed);
          for (const t of [st.text.kk, st.explanation.kk, st.hint?.kk ?? "", sh.prompt.kk, sh.explanation.kk, sh.hint?.kk ?? ""])
            for (const m of t.matchAll(/(\d+)-([а-яәіңғүұқөһ]+)/g)) {
              const ok = CASES.map((c) => kkSuffix(Number(m[1]), c).split("-")[1]);
              expect(ok.includes(m[2]), `${st.id} / ${sh.id}: «${m[0]}»`).toBe(true);
            }
        }
  });

  it("пары и короткие вопросы вычислены верно", () => {
    for (let seed = 1; seed < 200; seed++) {
      const p = NS_BANKS.find((b) => b.skill === "ns.bin2dec")!.pair!(2, seed);
      expect(parseInt(fromSub(String(p.left)).replace(/2$/, ""), 2)).toBe(Number(p.right));
      const q = NS_BANKS.find((b) => b.skill === "ns.dec2bin")!.short!(3, seed);
      expect(parseInt(q.answer, 2)).toBe(parseInt(q.prompt.ru, 10));
    }
  });

  it("draw: нужное количество, без повторов, с ростом сложности", () => {
    for (const shape of ["question", "statement", "pair", "short"] as const) {
      const items = draw(shape, { skills: SKILLS, count: 12, seed: 7 });
      expect(items.length).toBe(12);
      const levels = items.map((i) => (i as { level?: number }).level ?? 1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
    const st = draw("statement", { skills: SKILLS, count: 30, seed: 3 });
    expect(new Set(st.map((s) => s.text.ru)).size).toBe(st.length);
    expect(draw("pair", { skills: ["unknown"], count: 5, seed: 1 })).toEqual([]);
  });
});

describe("цифры 8/16 и буквы A–F: ns.base → ns.octhex (аудит C6)", () => {
  const MENTION = /восьмерич|шестнадцатерич|сегіздік|он алтылық|A–F|₈|₁₆/;
  const base = bankFor("ns.base")!;
  const octhex = bankFor("ns.octhex")!;
  const text = (x: string | { ru: string; kk: string }) => (typeof x === "string" ? x : x.ru);

  it("ns.base: ни одного задания про 8/16, A–F и восьмеричные записи во всех формах", () => {
    for (const level of LEVELS)
      for (let seed = 1; seed < 300; seed++) {
        for (const item of [base.question(level, seed), base.statement!(level, seed), base.pair!(level, seed), base.short!(level, seed)]) {
          // id содержит seed, поэтому сверяем содержимое без id
          expect(MENTION.test(JSON.stringify({ ...item, id: "" })), item.id).toBe(false);
        }
      }
  });

  it("ns.base: утверждения, пары и короткие вопросы вычислены верно", () => {
    for (const level of LEVELS)
      for (let seed = 1; seed < 300; seed++) {
        const st = base.statement!(level, seed);
        const t = st.text.ru;
        let m: RegExpMatchArray | null;
        if ((m = t.match(/основанием (\d+) используется цифр: (\d+)/))) expect(st.value, t).toBe(m[1] === m[2]);
        else if ((m = t.match(/основанием (\d+) наибольшая цифра — (\d+)/))) expect(st.value, t).toBe(Number(m[2]) === Number(m[1]) - 1);
        else if ((m = t.match(/Запись (\d+) может быть числом в (двоичной|троичной) системе/))) {
          const limit = m[2] === "двоичной" ? 2 : 3;
          expect(st.value, t).toBe(m[1].split("").every((d) => Number(d) < limit));
        } else if ((m = t.match(/^Наименьшая цифра в двоичной системе — (\d)$/))) expect(st.value, t).toBe(m[1] === "0");
        else throw new Error(`неизвестное утверждение: ${t}`);

        const p = base.pair!(level, seed);
        const left = text(p.left);
        const right = text(p.right);
        if ((m = left.match(/^Основание (\d+)$/))) {
          const b = Number(m[1]);
          expect(right, p.id).toBe(b === 2 ? "0, 1" : `0–${b - 1}`);
        } else if ((m = left.match(/^Наибольшая цифра (\d+)$/))) expect(right, p.id).toBe(`Основание ${Number(m[1]) + 1}`);
        else throw new Error(`неизвестная пара: ${p.id}`);

        const q = base.short!(level, seed);
        if ((m = q.prompt.ru.match(/основанием (\d+)\?$/)) && q.id.includes(":count:")) expect(Number(q.answer), q.id).toBe(Number(m[1]));
        else if (q.id.includes(":max:")) expect(Number(q.answer), q.id).toBe(Number(q.prompt.ru.match(/основанием (\d+)\?$/)![1]) - 1);
        else if (q.id.includes(":inv:")) expect(Number(q.answer), q.id).toBe(Number(q.prompt.ru.match(/цифра — (\d+)\./)![1]) + 1);
        else throw new Error(`неизвестный вопрос: ${q.id}`);
      }
  });

  it("ns.octhex: цифры 8/16 и A–F подмешаны на уровнях A и B, на уровне C их нет", () => {
    const moved = (id: string) => /^(g:ns\.octhex:(digits|invalid8)|s:ns\.octhex:(count|hex|valid8)|p:ns\.octhex:(sys|letter)|q:ns\.octhex:(count|letter)):/.test(id);
    const seen: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const own: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const level of LEVELS)
      for (let seed = 1; seed < 300; seed++)
        for (const item of [octhex.question(level, seed), octhex.statement!(level, seed), octhex.pair!(level, seed), octhex.short!(level, seed)]) {
          expect(item.skill).toBe("ns.octhex");
          if (moved(item.id)) seen[level]++;
          else own[level]++;
        }
    expect(seen[1]).toBeGreaterThan(100);
    expect(seen[2]).toBeGreaterThan(30);
    expect(seen[3]).toBe(0);
    // собственные задания урока не вытеснены: на A и B они всё ещё большинство, на C — все
    expect(own[1]).toBeGreaterThan(seen[1]);
    expect(own[2]).toBeGreaterThan(seen[2]);
    expect(own[3]).toBe(4 * 299);
  });

  it("ns.octhex: перенесённые задания верны и проходят проверку", () => {
    for (const level of [1, 2] as const)
      for (let seed = 1; seed < 400; seed++) {
        const q = octhex.question(level, seed);
        if (q.type === "choice" && q.id.startsWith("g:ns.octhex:digits:")) {
          expect(validateStep(q), q.id).toEqual([]);
          expect(Number(q.options[q.correct])).toBe(Number(q.id.split(":")[3]));
          expect([8, 16]).toContain(Number(q.id.split(":")[3]));
        }
        if (q.type === "choice" && q.id.startsWith("g:ns.octhex:invalid8:")) {
          expect(validateStep(q), q.id).toEqual([]);
          q.options.forEach((o, i) => expect(/[89]/.test(String(o)), `${q.id}: вариант ${i}`).toBe(i === q.correct));
        }
        const st = octhex.statement!(level, seed);
        let m: RegExpMatchArray | null;
        if ((m = st.text.ru.match(/цифра ([A-F]) означает (\d+)/))) expect(st.value, st.text.ru).toBe(parseInt(m[1], 16) === Number(m[2]));
        if ((m = st.text.ru.match(/Запись (\d+) может быть числом в восьмеричной системе/))) expect(st.value, st.text.ru).toBe(m[1].split("").every((d) => Number(d) < 8));
        if ((m = st.text.ru.match(/основанием (\d+) используется цифр: (\d+)/))) {
          expect([8, 16]).toContain(Number(m[1]));
          expect(st.value, st.text.ru).toBe(m[1] === m[2]);
        }
        const p = octhex.pair!(level, seed);
        if (p.id.startsWith("p:ns.octhex:letter:")) expect(parseInt(String(p.left)[0], 16)).toBe(Number(p.right));
        const sh = octhex.short!(level, seed);
        if (sh.id.startsWith("q:ns.octhex:letter:")) expect(parseInt(sh.prompt.ru[0], 16)).toBe(Number(sh.answer));
        if (sh.id.startsWith("q:ns.octhex:count:")) expect(Number(sh.answer)).toBe(Number(sh.id.split(":")[3]));
        // у перенесённых заданий подсказка есть (как была в ns.base)
        if (/^q:ns\.octhex:(letter|count):/.test(sh.id)) expect(sh.hint?.ru && sh.hint?.kk, sh.id).toBeTruthy();
        if (/^s:ns\.octhex:(hex|count|valid8):/.test(st.id)) expect(st.hint?.ru && st.hint?.kk, st.id).toBeTruthy();
      }
  });

  it("ns.octhex: задания по-казахски без неверных окончаний после чисел", () => {
    const CASES: KkCase[] = ["acc", "dat", "loc", "abl", "gen", "ins"];
    for (const level of [1, 2] as const)
      for (let seed = 1; seed < 200; seed++) {
        const q = octhex.question(level, seed);
        const st = octhex.statement!(level, seed);
        const texts = [q.prompt.kk, q.hint?.kk ?? "", "explanation" in q ? q.explanation.kk : "", st.text.kk, st.explanation.kk, st.hint?.kk ?? ""];
        for (const t of texts)
          for (const m of t.matchAll(/(\d+)-([а-яәіңғүұқөһ]+)/g)) {
            const ok = CASES.map((c) => kkSuffix(Number(m[1]), c).split("-")[1]);
            expect(ok.includes(m[2]), `${q.id} / ${st.id}: «${m[0]}»`).toBe(true);
          }
      }
  });
});
