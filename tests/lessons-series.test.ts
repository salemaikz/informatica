import { describe, expect, it } from "vitest";
import { lessonBits } from "@/content/lessons/ns-1-bits";
import { lessonRead } from "@/content/lessons/ns-2-read";
import { lessonWrite } from "@/content/lessons/ns-3-write";
import { lessonTraps } from "@/content/lessons/ns-4-traps";
import { SKILLS } from "@/content/skills";
import { divisionLadder } from "@/lib/check";
import type { ClozeBlank, ClozeStep, Lesson, QuestionStep, Scene, Step } from "@/lib/types";
import { validateStep } from "./validate";

// Серия «Двоичная система» (уроки 1.1–1.4): структура, двуязычность, сцены и все числовые утверждения.

const SERIES: { lesson: Lesson; skills: string[]; durationMin: number }[] = [
  { lesson: lessonBits, skills: ["ns.base"], durationMin: 6 },
  { lesson: lessonRead, skills: ["ns.bin2dec"], durationMin: 7 },
  { lesson: lessonWrite, skills: ["ns.dec2bin"], durationMin: 7 },
  { lesson: lessonTraps, skills: ["ns.props", "ns.base"], durationMin: 6 },
];

const QUESTION_TYPES = new Set(["choice", "multi", "input", "bits", "ladder", "match", "order", "solution", "cloze"]);
const isQuestion = (s: Step): s is QuestionStep => QUESTION_TYPES.has(s.type);
const byId = (lesson: Lesson, id: string): Step => {
  const step = lesson.steps.find((s) => s.id === id);
  if (!step) throw new Error(`нет шага ${id} в ${lesson.id}`);
  return step;
};
const bin = (s: string) => parseInt(s, 2);
const rev = (s: string) => [...s].reverse().join("");
const isBlank = (t: unknown): t is ClozeBlank => typeof t === "object" && t !== null && "blank" in t;

// ---------- Сбор строк ----------

interface Collected {
  all: string[];
  ru: string[];
  kk: string[];
}
function collect(value: unknown, out: Collected = { all: [], ru: [], kk: [] }): Collected {
  if (typeof value === "string") {
    out.all.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, out);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.ru === "string" && typeof o.kk === "string") {
      out.ru.push(o.ru);
      out.kk.push(o.kk);
      out.all.push(o.ru, o.kk);
    } else {
      for (const v of Object.values(o)) collect(v, out);
    }
  }
  return out;
}

function scenesOf(step: Step): Scene[] {
  const scenes: Scene[] = [];
  if ((step.type === "theory" || step.type === "story" || step.type === "cloze") && step.scene) scenes.push(step.scene);
  if (step.type === "worked") for (const s of step.steps) if (s.scene) scenes.push(s.scene);
  if (step.reveal) scenes.push(step.reveal);
  return scenes;
}

// ---------- Проверка арифметики, написанной в текстах ----------

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const supToNum = (s: string) => Number([...s].map((c) => SUP[c]).join(""));
const SUPC = "[⁰¹²³⁴⁵⁶⁷⁸⁹]+";
const NOT_NUM = "(?![\\d₀-₉])";
const sumOf = (terms: string) => terms.split(" + ").reduce((a, b) => a + Number(b), 0);

/** Находит в тексте утверждения вида «8 + 4 = 12», «110₂ (6)», «22 → 11 (остаток 0)» и проверяет их. */
function verifyArithmetic(text: string, errors: string[]): number {
  let checked = 0;
  const fail = (m: string, why: string) => errors.push(`«${m}»: ${why}`);

  // 8 + 4 + 1 = 13
  for (const m of text.matchAll(new RegExp(`((?:\\d+ \\+ )+\\d+) = (\\d+)${NOT_NUM}`, "g"))) {
    checked++;
    if (sumOf(m[1]) !== Number(m[2])) fail(m[0], "сумма не сходится");
  }
  // 19 − 16 = 3
  for (const m of text.matchAll(new RegExp(`(\\d+) − (\\d+) = (\\d+)${NOT_NUM}`, "g"))) {
    checked++;
    if (Number(m[1]) - Number(m[2]) !== Number(m[3])) fail(m[0], "разность не сходится");
  }
  // 2 · 2 · 2 = 8
  for (const m of text.matchAll(/((?:\d+ · )+\d+) = (\d+)(?!\d)/g)) {
    checked++;
    if (m[1].split(" · ").reduce((a, b) => a * Number(b), 1) !== Number(m[2])) fail(m[0], "произведение не сходится");
  }
  // 38 = 19 · 2
  for (const m of text.matchAll(/(\d+) = (\d+) · (\d+)(?!\d)/g)) {
    checked++;
    if (Number(m[2]) * Number(m[3]) !== Number(m[1])) fail(m[0], "произведение не сходится");
  }
  // 2⁴ = 16 (но не 2⁶ = 2 · 2 …)
  for (const m of text.matchAll(new RegExp(`2(${SUPC}) = (\\d+)${NOT_NUM}(?! ·)`, "g"))) {
    checked++;
    if (2 ** supToNum(m[1]) !== Number(m[2])) fail(m[0], "степень не сходится");
  }
  // 2⁴ − 1 = 15
  for (const m of text.matchAll(new RegExp(`2(${SUPC}) − 1 = (\\d+)${NOT_NUM}`, "g"))) {
    checked++;
    if (2 ** supToNum(m[1]) - 1 !== Number(m[2])) fail(m[0], "2ᵏ − 1 не сходится");
  }
  // 64 ≤ 100 < 128 и 2⁶ ≤ 100 < 2⁷
  for (const m of text.matchAll(/(\d+) ≤ (\d+) < (\d+)/g)) {
    checked++;
    if (!(Number(m[1]) <= Number(m[2]) && Number(m[2]) < Number(m[3]))) fail(m[0], "неравенство неверно");
  }
  for (const m of text.matchAll(new RegExp(`2(${SUPC}) ≤ (\\d+) < 2(${SUPC})`, "g"))) {
    checked++;
    if (!(2 ** supToNum(m[1]) <= Number(m[2]) && Number(m[2]) < 2 ** supToNum(m[3]))) fail(m[0], "неравенство неверно");
  }
  // 1101₂ = 8 + 4 + 0 + 1  и  1101₂ = 13
  for (const m of text.matchAll(new RegExp(`([01]+)₂ = ((?:\\d+ \\+ )*\\d+)${NOT_NUM}`, "g"))) {
    checked++;
    const bits = m[1];
    const terms = m[2].split(" + ").map(Number);
    if (sumOf(m[2]) !== bin(bits)) fail(m[0], `сумма ≠ ${bin(bits)}`);
    if (terms.length > 1) {
      const expected = [...bits].map((d, i) => (d === "1" ? 2 ** (bits.length - 1 - i) : 0)).filter(Boolean);
      if (terms.filter(Boolean).join() !== expected.join()) fail(m[0], `слагаемые должны быть ${expected.join(" + ")}`);
    }
  }
  // 19 = 10011₂ и 128 + 64 + 8 = 11001000₂
  for (const m of text.matchAll(/((?:\d+ \+ )*\d+) = ([01]+)₂/g)) {
    checked++;
    if (sumOf(m[1]) !== bin(m[2])) fail(m[0], `двоичная запись равна ${bin(m[2])}`);
  }
  // 1101₂ (13)
  for (const m of text.matchAll(/([01]+)₂ \((\d+)\)/g)) {
    checked++;
    if (bin(m[1]) !== Number(m[2])) fail(m[0], `должно быть ${bin(m[1])}`);
  }
  // 1111₂ (4 цифры)
  for (const m of text.matchAll(/([01]+)₂ \((\d+) цифр/g)) {
    checked++;
    if (m[1].length !== Number(m[2])) fail(m[0], `цифр ${m[1].length}`);
  }
  // 100 — это 7 цифр (1100100₂)
  for (const m of text.matchAll(/(\d+) — (?:это|бұл) (\d+) цифр \(([01]+)₂\)/g)) {
    checked++;
    if (bin(m[3]) !== Number(m[1]) || m[3].length !== Number(m[2])) fail(m[0], "число/длина записи не сходятся");
  }
  // 19 : 2 = 9, остаток 1
  for (const m of text.matchAll(/(\d+) : 2 = (\d+), (?:остаток|қалдығы) (?:\*\*)?(\d)/g)) {
    checked++;
    if (Number(m[1]) !== 2 * Number(m[2]) + Number(m[3]) || Number(m[3]) > 1) fail(m[0], "деление не сходится");
  }
  // 22 → 11 (остаток 0)  и  45 → 22 (1)
  for (const m of text.matchAll(/(\d+) → (\d+) \((?:(?:остаток|қалдығы) )?(\d)\)/g)) {
    checked++;
    if (Number(m[1]) !== 2 * Number(m[2]) + Number(m[3]) || Number(m[3]) > 1) fail(m[0], "деление не сходится");
  }
  return checked;
}

function ladderBitsFrom(n: number): string {
  return divisionLadder(n)
    .map((r) => r.remainder)
    .reverse()
    .join("");
}

// ---------- Общие проверки для каждого урока ----------

for (const { lesson, skills, durationMin } of SERIES) {
  describe(`${lesson.id}: структура`, () => {
    const questions = lesson.steps.filter(isQuestion);

    it("метаданные и навыки", () => {
      expect(lesson.unitId).toBe("u1");
      expect(lesson.skills).toEqual(skills);
      expect(lesson.durationMin).toBe(durationMin);
      const known = new Set(SKILLS.map((s) => s.id));
      for (const s of lesson.skills) expect(known.has(s), s).toBe(true);
      for (const s of lesson.steps) if (s.skill) expect(lesson.skills.includes(s.skill), `${s.id}: ${s.skill}`).toBe(true);
    });

    it("все шаги проходят validateStep", () => {
      expect(lesson.steps.flatMap(validateStep)).toEqual([]);
    });

    it("id шагов уникальны", () => {
      const ids = lesson.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("урок открывается и закрывается сюжетными карточками", () => {
      expect(lesson.steps[0].type).toBe("story");
      expect(lesson.steps.at(-1)?.type).toBe("story");
    });

    it("вопросов 5–8, у каждого есть level, не больше двух одинаковых типов подряд", () => {
      expect(questions.length).toBeGreaterThanOrEqual(5);
      expect(questions.length).toBeLessThanOrEqual(8);
      for (const q of questions) expect([1, 2, 3], q.id).toContain(q.level);
      for (let i = 2; i < questions.length; i++) {
        const same = questions[i].type === questions[i - 1].type && questions[i].type === questions[i - 2].type;
        expect(same, `три «${questions[i].type}» подряд на ${questions[i].id}`).toBe(false);
      }
    });

    it("уровни идут A → B → C, последний вопрос — ЕНТ-босс уровня 2–3", () => {
      const boss = questions.at(-1)!;
      expect(boss.ent, "у последнего вопроса ent: true").toBe(true);
      expect([2, 3]).toContain(boss.level);
      const rest = questions.slice(0, -1).map((q) => q.level!);
      expect(rest, rest.join()).toEqual([...rest].sort((a, b) => a - b));
    });

    it("есть конспект с таблицей и разделом ошибок на обоих языках", () => {
      for (const lang of ["ru", "kk"] as const) {
        const text = lesson.conspect[lang];
        expect(text.length).toBeGreaterThan(400);
        expect(text).toContain("|---");
        expect(text).toContain("## ");
      }
    });
  });

  describe(`${lesson.id}: тексты`, () => {
    const { all, ru, kk } = collect(lesson);

    it("нет эмодзи и LaTeX", () => {
      for (const s of all) {
        expect(/\p{Extended_Pictographic}|️|‍/u.test(s), `эмодзи в «${s.slice(0, 60)}»`).toBe(false);
        expect(/\$|\\\(|\\\[|\\frac|\\cdot/.test(s), `LaTeX в «${s.slice(0, 60)}»`).toBe(false);
      }
    });

    it("нет слов, смешивающих латиницу и кириллицу", () => {
      for (const s of all) {
        for (const [word] of s.matchAll(/\p{L}+/gu)) {
          const mixed = /\p{Script=Latin}/u.test(word) && /\p{Script=Cyrillic}/u.test(word);
          expect(mixed, `смешанное слово «${word}» в «${s.slice(0, 60)}»`).toBe(false);
        }
      }
    });

    it("в русском нет глаголов с родом при обращении к ученику", () => {
      const gendered =
        /(?<![\p{L}])(сделал|попал|выбрал|решил|понял|запомнил|справил|смог|нашёл|нашел|увидел|выучил|прошёл|прошел|получил|перепутал|забыл|записал|посчитал)(а|ся|ась)?(?![\p{L}])|(?<![\p{L}])(нашла|прошла|смогла|ошибся|ошиблась|уверен|готов|должен)(?![\p{L}])/iu;
      for (const s of ru) expect(gendered.test(s), `род в «${s.slice(0, 80)}»`).toBe(false);
    });

    it("казахский текст не скопирован с русского", () => {
      for (let i = 0; i < ru.length; i++) {
        if ((ru[i].match(/[а-яё]/gi) ?? []).length >= 8) expect(kk[i], ru[i].slice(0, 40)).not.toBe(ru[i]);
        if (kk[i].length > 60) expect(/[әғқңөұүһі]/i.test(kk[i]), `нет казахских букв: «${kk[i].slice(0, 60)}»`).toBe(true);
      }
    });

    it("арифметика в текстах (ru и kk) сходится", () => {
      const errors: string[] = [];
      let checked = 0;
      for (const s of all) checked += verifyArithmetic(s, errors);
      expect(errors).toEqual([]);
      expect(checked).toBeGreaterThanOrEqual(8);
    });
  });

  describe(`${lesson.id}: сцены и песочницы`, () => {
    it("двоичные сцены и лампочки содержат только 0 и 1", () => {
      for (const step of lesson.steps) {
        for (const sc of scenesOf(step)) {
          if (sc.kind === "binary") {
            expect(sc.bits, step.id).toMatch(/^[01]+$/);
            for (const i of sc.highlight ?? []) expect(i >= 0 && i < sc.bits.length, `${step.id}: highlight ${i}`).toBe(true);
          }
          if (sc.kind === "lamps") expect(sc.states, step.id).toMatch(/^[01]+$/);
          if (sc.kind === "decimal") expect(sc.number, step.id).toMatch(/^\d+$/);
          if (sc.kind === "quest" && sc.art === "locker") expect(sc.code ?? "", step.id).toMatch(/^[01]*$/);
        }
      }
    });

    it("лесенки и монеты в сценах согласованы с числами", () => {
      for (const step of lesson.steps) {
        for (const sc of scenesOf(step)) {
          if (sc.kind === "ladder") {
            const total = divisionLadder(sc.number, sc.base ?? 2).length;
            expect(sc.rows ?? total, step.id).toBeGreaterThanOrEqual(1);
            expect(sc.rows ?? total, step.id).toBeLessThanOrEqual(total);
          }
          if (sc.kind === "coins") {
            for (const v of sc.values) expect(Number.isInteger(Math.log2(v)), `${step.id}: ${v}`).toBe(true);
            const picked = sc.picked ?? [];
            for (const v of picked) expect(sc.values, step.id).toContain(v);
            if (sc.target !== undefined) expect(picked.reduce((a, b) => a + b, 0), step.id).toBeLessThanOrEqual(sc.target);
          }
        }
      }
    });

    it("песочницы: цель достижима", () => {
      for (const step of lesson.steps) {
        if (step.type !== "explore" || !step.goal) continue;
        if (step.tool === "lamps") expect(step.goal.target, step.id).toBeLessThanOrEqual(8);
        else expect(step.goal.target, step.id).toBeLessThan(2 ** step.size);
      }
    });
  });
}

describe("серия: id шагов уникальны во всех четырёх уроках", () => {
  it("нет повторов", () => {
    const ids = SERIES.flatMap((s) => s.lesson.steps.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------- Проверки ответов по урокам ----------

describe("ns-1-bits: ответы", () => {
  const opt = (id: string) => {
    const s = byId(lessonBits, id);
    if (s.type !== "choice") throw new Error(id);
    return { texts: s.options.map((o) => (typeof o === "string" ? o : o.ru)), correct: s.options[s.correct], step: s };
  };
  const num = (id: string) => {
    const s = byId(lessonBits, id);
    if (s.type !== "input") throw new Error(id);
    return s.answers;
  };

  it("число сигналов N = 2ⁱ", () => {
    expect(opt("bits-q-lamps3").correct).toBe(String(2 ** 3));
    expect(opt("bits-q-lamps3").texts).toContain(String(3 * 2)); // ловушка 6
    expect(num("bits-q-lamps5")).toEqual([String(2 ** 5)]);
    expect(opt("bits-q-ent-6lamps").correct).toBe(String(2 ** 6));
    expect(opt("bits-q-ent-6lamps").texts).toEqual(expect.arrayContaining([String(6 * 2), String(6 * 6)]));
    expect(byId(lessonBits, "bits-q-ent-6lamps").ent).toBe(true);
  });

  it("1 бит — 2 значения; вес пятого разряда — 16; цифры 0 и 1", () => {
    expect(opt("bits-q-bit-values").correct).toBe("2");
    expect(num("bits-q-weight5")).toEqual([String(2 ** 4)]);
    expect(opt("bits-q-digits").texts[opt("bits-q-digits").step.correct]).toBe("0 и 1");
  });

  it("песочницы: лампы (цель 5 ламп = 32 сигнала) и веса (13 помещается в 4 разряда)", () => {
    const lamps = byId(lessonBits, "bits-explore-lamps");
    const weights = byId(lessonBits, "bits-explore-weights");
    if (lamps.type !== "explore" || weights.type !== "explore") throw new Error("explore");
    expect(2 ** lamps.goal!.target).toBe(32);
    expect(lamps.goal!.text.ru).toContain("32");
    expect(weights.tool).toBe("weights");
    expect(weights.size).toBe(4);
    expect(weights.goal!.target).toBe(bin("1101"));
  });
});

describe("ns-2-read: ответы", () => {
  const B2D: Record<string, string> = {
    "read-q-b2d-19": "10011",
    "read-q-b2d-54": "110110",
    "read-q-b2d-75": "1001011",
    "read-q-ent-53": "110101",
  };

  it("перевод 2 → 10 совпадает с parseInt и ловушки на месте", () => {
    for (const [id, bits] of Object.entries(B2D)) {
      const s = byId(lessonRead, id);
      const expected = String(bin(bits));
      if (s.type === "input") {
        expect(s.answers, id).toEqual([expected]);
        expect(s.prompt.ru, id).toContain(bits);
        expect(s.prompt.kk, id).toContain(bits);
      } else if (s.type === "choice") {
        expect(s.options[s.correct], id).toBe(expected);
        expect(s.prompt.ru, id).toContain(bits);
        expect(s.prompt.kk, id).toContain(bits);
        // ловушки: прочитано наоборот, потерян вес 1, ошибка на 1
        const options = s.options.map(String);
        expect(options, id).toContain(String(bin(rev(bits))));
        expect(options, id).toContain(String(bin(bits) - 1));
        expect(s.explanation.ru, id).toContain(rev(bits));
      } else throw new Error(`${id}: неожиданный тип`);
    }
    expect(byId(lessonRead, "read-q-ent-53").ent).toBe(true);
  });

  it("задание «собери 22» (bits)", () => {
    const s = byId(lessonRead, "read-q-bits-22");
    if (s.type !== "bits") throw new Error("bits");
    expect(s.target).toBe(bin("10110"));
    expect(s.bits).toBe(5);
    expect(s.explanation.ru).toContain("10110₂");
  });

  it("решаем вместе: слагаемые и суммы совпадают с двоичной записью", () => {
    const CLOZE: Record<string, string> = { "read-q-cloze-1110": "1110", "read-q-cloze-11010": "11010" };
    for (const [id, bits] of Object.entries(CLOZE)) {
      const s = byId(lessonRead, id) as ClozeStep;
      const expected = [...bits].map((d, i) => (d === "1" ? 2 ** (bits.length - 1 - i) : 0)).filter(Boolean);
      const last = s.lines.at(-1)!;
      const blanks = last.filter(isBlank).map((b) => b.blank[0]);
      // слагаемые (все пропуски, кроме последнего) и сумма
      expect(blanks.slice(0, -1).map(Number), id).toEqual(expected);
      expect(Number(blanks.at(-1)), id).toBe(bin(bits));
    }
    // в 11010₂ веса 1, 2, 4 даны, 8 и 16 — пропуски
    const s = byId(lessonRead, "read-q-cloze-11010") as ClozeStep;
    expect(s.lines[0].filter(isBlank).map((b) => b.blank[0])).toEqual(["8", "16"]);
  });

  it("разборы: сумма на последнем шаге и ловушка 1 + 2 + 8 = 11", () => {
    const WORKED: Record<string, [string, number]> = {
      "read-worked-101": ["101", 5],
      "read-worked-1101": ["1101", 13],
      "read-worked-code": ["101101", 45],
    };
    for (const [id, [bits, value]] of Object.entries(WORKED)) {
      const s = byId(lessonRead, id);
      if (s.type !== "worked") throw new Error(id);
      expect(bin(bits)).toBe(value);
      expect(s.result?.ru).toBe(`${bits}₂ = ${value}`);
      const binaries = s.steps.flatMap((x) => (x.scene?.kind === "binary" ? [x.scene] : []));
      expect(binaries.every((sc) => sc.bits === bits), id).toBe(true);
      expect(s.steps.some((x) => x.text.ru.includes(`= ${value}`)), id).toBe(true);
    }
    const trap = byId(lessonRead, "read-worked-trap");
    if (trap.type !== "worked") throw new Error("trap");
    expect(trap.steps[0].scene).toMatchObject({ kind: "binary", bits: "1101", wrongDirection: true });
    expect(bin(rev("1101"))).toBe(11);
    expect(trap.steps[1].text.ru).toContain("1 + 2 + 8 = **11**");
    const last = byId(lessonRead, "read-worked-code");
    if (last.type !== "worked") throw new Error("code");
    expect(last.steps.at(-1)!.scene).toMatchObject({ kind: "quest", art: "locker-open" });
  });
});

describe("ns-3-write: ответы", () => {
  it("перевод 10 → 2 совпадает с toString(2); ловушки на месте", () => {
    const six = byId(lessonWrite, "write-q-d2b-6");
    if (six.type !== "choice") throw new Error("choice");
    expect(six.options[six.correct]).toBe((6).toString(2));
    expect(six.options).toContain(rev((6).toString(2)).padStart(3, "0")); // 011 — остатки сверху вниз

    const boss = byId(lessonWrite, "write-q-ent-77");
    if (boss.type !== "choice") throw new Error("choice");
    const b77 = (77).toString(2);
    expect(boss.options[boss.correct]).toBe(b77);
    expect(boss.options).toContain(rev(b77)); // наоборот
    expect(boss.options).toContain((77 - 1).toString(2)); // потерян последний остаток
    expect(boss.ent).toBe(true);

    for (const [id, n] of [["write-q-d2b-45", 45], ["write-q-d2b-100", 100]] as const) {
      const s = byId(lessonWrite, id);
      if (s.type !== "input") throw new Error(id);
      expect(s.mode).toBe("binary");
      expect(s.answers, id).toEqual([n.toString(2)]);
      expect(s.prompt.ru).toContain(String(n));
    }
  });

  it("лесенка 22", () => {
    const s = byId(lessonWrite, "write-q-ladder-22");
    if (s.type !== "ladder") throw new Error("ladder");
    expect(s.number).toBe(22);
    expect(s.explanation.ru).toContain(`${ladderBitsFrom(22)}₂`);
    expect(s.explanation.kk).toContain(`${ladderBitsFrom(22)}₂`);
  });

  it("предскажи → проверь: 38 = 19 · 2, ответ — запись 19 с нулём справа", () => {
    const s = byId(lessonWrite, "write-q-predict-38");
    if (s.type !== "choice") throw new Error("choice");
    const b19 = (19).toString(2);
    expect(s.options[s.correct]).toBe((38).toString(2));
    expect(s.options[s.correct]).toBe(`${b19}0`);
    expect(s.reveal).toMatchObject({ kind: "binary", bits: (38).toString(2) });
    expect(s.options).toContain("20022"); // цифры удвоены поразрядно — не двоичная запись
    expect(s.options).toContain((19 * 4).toString(2));
    expect(s.level).toBe(2);
  });

  it("решаем вместе: лесенка 25 — цепочка делений и ответ", () => {
    const s = byId(lessonWrite, "write-q-cloze-25") as ClozeStep;
    const rows = s.lines.slice(0, -1).map((line) => {
      const text = line.map((t) => (typeof t === "string" ? t : isBlank(t) ? t.blank[0] : t.ru)).join("");
      const m = text.match(/^(\d+) : 2 = (\d+), остаток (\d)$/);
      expect(m, text).not.toBeNull();
      return { n: Number(m![1]), q: Number(m![2]), r: Number(m![3]) };
    });
    expect(rows[0].n).toBe(25);
    rows.forEach((row, i) => {
      expect(row.n).toBe(2 * row.q + row.r);
      if (i > 0) expect(row.n).toBe(rows[i - 1].q);
    });
    expect(rows.at(-1)!.q).toBe(0);
    const answer = s.lines.at(-1)!.filter(isBlank)[0];
    expect(answer.mode).toBe("binary");
    expect(answer.blank).toEqual([(25).toString(2)]);
    expect(rows.map((r) => r.r).reverse().join("")).toBe((25).toString(2));
  });

  it("разбор «монеты»: жадный выбор для 19 даёт 16, 2, 1", () => {
    const s = byId(lessonWrite, "write-worked-coins");
    if (s.type !== "worked") throw new Error("worked");
    const coinScenes = s.steps.flatMap((x) => (x.scene?.kind === "coins" ? [x.scene] : []));
    const values = coinScenes[0].values;
    let rest = 19;
    const greedy: number[] = [];
    for (const v of values) {
      if (v <= rest) {
        greedy.push(v);
        rest -= v;
      }
    }
    expect(greedy).toEqual([16, 2, 1]);
    expect(rest).toBe(0);
    expect(coinScenes.at(-1)!.picked).toEqual(greedy);
    // набор монет только растёт от шага к шагу
    for (let i = 1; i < coinScenes.length; i++) expect(coinScenes[i].picked!.length).toBeGreaterThanOrEqual(coinScenes[i - 1].picked!.length);
    expect(s.result?.ru).toBe("19 = 10011₂");
    const explore = byId(lessonWrite, "write-explore-coins");
    if (explore.type !== "explore") throw new Error("explore");
    expect([explore.tool, explore.size, explore.goal?.target]).toEqual(["coins", 5, 19]);
  });

  it("разбор «деление на 2»: 19 → 10011, остатки читаются снизу вверх", () => {
    const s = byId(lessonWrite, "write-worked-ladder");
    if (s.type !== "worked") throw new Error("worked");
    const ladders = s.steps.flatMap((x) => (x.scene?.kind === "ladder" ? [x.scene] : []));
    expect(ladders.every((l) => l.number === 19)).toBe(true);
    expect(ladders.map((l) => l.rows)).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(ladders.slice(-2).every((l) => l.readUp)).toBe(true);
    expect(ladderBitsFrom(19)).toBe("10011");
    expect(divisionLadder(19)).toHaveLength(5);
  });

  it("проверка обратным переводом: 10011 → 16 + 2 + 1 = 19", () => {
    const s = byId(lessonWrite, "write-worked-check");
    if (s.type !== "worked") throw new Error("worked");
    expect(s.steps.at(-1)!.scene).toMatchObject({ kind: "binary", bits: "10011", weights: true, cross: true, sum: true });
    expect(s.steps.at(-1)!.text.ru).toContain("16 + 2 + 1 = 19");
    expect(bin("10011")).toBe(19);
  });
});

describe("ns-4-traps: ответы", () => {
  it("чётность: нечётное — только то, что оканчивается на 1", () => {
    const s = byId(lessonTraps, "traps-q-parity");
    if (s.type !== "choice") throw new Error("choice");
    const values = s.options.map((o) => bin(String(o).replace("₂", "")));
    expect(values.map((v) => v % 2 === 1)).toEqual(values.map((_, i) => i === s.correct));
  });

  it("«не двоичная»: цифра 2+ только в верном варианте", () => {
    const s = byId(lessonTraps, "traps-q-nonbin");
    if (s.type !== "choice") throw new Error("choice");
    s.options.forEach((o, i) => expect(/[2-9]/.test(String(o)), String(o)).toBe(i === s.correct));
  });

  it("число цифр: 200 → 8", () => {
    const s = byId(lessonTraps, "traps-q-digits-200");
    if (s.type !== "input") throw new Error("input");
    expect(s.answers).toEqual([String((200).toString(2).length)]);
    expect(128 <= 200 && 200 < 256).toBe(true);
  });

  it("степень двойки: 2⁶ = 1 и шесть нулей", () => {
    const s = byId(lessonTraps, "traps-q-power-2-6");
    if (s.type !== "input") throw new Error("input");
    expect(s.mode).toBe("binary");
    expect(s.answers).toEqual([(2 ** 6).toString(2)]);
    expect(s.answers[0]).toBe(`1${"0".repeat(6)}`);
    expect((2 ** 4 - 1).toString(2)).toBe("1".repeat(4));
    expect((2 ** 8 - 1).toString(2)).toBe("1".repeat(8));
  });

  it("multi (ЕНТ): 6 вариантов, 2–3 верных — ровно чётные; в объяснении правило 2/1/0", () => {
    const s = byId(lessonTraps, "traps-q-ent-even");
    if (s.type !== "multi") throw new Error("multi");
    expect(s.ent).toBe(true);
    expect(s.options).toHaveLength(6);
    expect(s.correct.length).toBeGreaterThanOrEqual(2);
    expect(s.correct.length).toBeLessThanOrEqual(3);
    const even = s.options.map((o, i) => (bin(String(o).replace("₂", "")) % 2 === 0 ? i : -1)).filter((i) => i >= 0);
    expect(s.correct).toEqual(even);
    for (const text of [s.explanation.ru, s.explanation.kk]) expect(text).toMatch(/2.*1.*0/);
    expect(s.explanation.ru).toMatch(/2 балла/);
    expect(s.explanation.ru).toMatch(/1 балл/);
    expect(s.explanation.ru).toMatch(/лишняя галочка стоит балла/i);
  });

  it("match (ЕНТ): число ↔ длина двоичной записи", () => {
    const s = byId(lessonTraps, "traps-q-ent-match");
    if (s.type !== "match") throw new Error("match");
    expect(s.ent).toBe(true);
    expect(s.pairs.length).toBeGreaterThanOrEqual(3);
    for (const p of s.pairs) {
      const n = Number(p.left);
      const right = typeof p.right === "string" ? p.right : p.right.ru;
      expect(Number(right.match(/^(\d+)/)![1]), String(p.left)).toBe(n.toString(2).length);
      if (typeof p.right !== "string") expect(Number(p.right.kk.match(/^(\d+)/)![1])).toBe(n.toString(2).length);
    }
  });

  it("разборы: чётность, число цифр, степени двойки", () => {
    const parity = byId(lessonTraps, "traps-worked-parity");
    if (parity.type !== "worked") throw new Error("worked");
    const lastIdx = (bits: string) => bits.length - 1;
    const highlighted = parity.steps.flatMap((x) => (x.scene?.kind === "binary" && x.scene.highlight ? [x.scene] : []));
    expect(highlighted.some((sc) => sc.highlight!.length === 1 && sc.highlight![0] === lastIdx(sc.bits))).toBe(true);
    expect(bin("101110") % 2).toBe(0);
    expect(bin("10111") % 2).toBe(1);

    const digits = byId(lessonTraps, "traps-worked-digits");
    if (digits.type !== "worked") throw new Error("worked");
    expect((100).toString(2)).toBe("1100100");
    expect(digits.steps.some((x) => x.scene?.kind === "binary" && x.scene.bits === "1100100")).toBe(true);

    const powers = byId(lessonTraps, "traps-worked-powers");
    if (powers.type !== "worked") throw new Error("worked");
    const bitsShown = powers.steps.flatMap((x) => (x.scene?.kind === "binary" ? [x.scene.bits] : []));
    expect(bitsShown).toEqual([(2 ** 4).toString(2), (2 ** 4).toString(2), (2 ** 4 - 1).toString(2), (2 ** 8 - 1).toString(2)]);
  });
});
