import { describe, expect, it } from "vitest";
import { generateLeveled } from "@/lib/generators";
import { bankFor } from "@/lib/bank";
import { checkInput, toBinary } from "@/lib/check";
import { evaluate } from "@/lib/evaluate";
import { kkSuffix, type KkCase } from "@/lib/kk";
import type { ChoiceStep, InputStep, Level, QuestionStep, Text } from "@/lib/types";
import { validateStep } from "./validate";

// Этап 14, C8: уровень C систем счисления «по сути» (аудит C5), ноль и единица на уровне A (аудит C8).
// Верный ответ каждого нового вида пересчитывается здесь заново из текста условия — независимо от генератора.

const SKILLS = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"] as const;
const SEEDS = 1000;

const txt = (t: Text, lang: "ru" | "kk" = "ru") => (typeof t === "string" ? t : t[lang]);
const kindOf = (step: QuestionStep) => step.id.split(":")[2];
/** Верный ответ как строка: верный вариант или эталон ввода. */
function answerOf(step: QuestionStep): string {
  if (step.type === "choice") return txt(step.options[step.correct]);
  if (step.type === "input") return step.answers[0];
  throw new Error(`${step.id}: нет простого ответа`);
}
const sup = (s: string) => [..."⁰¹²³⁴⁵⁶⁷⁸⁹"].reduce((acc, ch, i) => acc.replaceAll(ch, String(i)), s);
const unsub = (s: string) => s.replace(/[₀-₉]/g, (c) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(c)));

/** Новые виды заданий уровня C — по навыкам. */
const NEW_KINDS: Record<(typeof SKILLS)[number], string[]> = {
  "ns.bin2dec": ["findx", "sum", "cmp"],
  "ns.dec2bin": ["sumbin", "shift", "allones"],
  "ns.base": ["minbase", "maxrec"],
  "ns.props": ["maxk", "mink", "lenedge", "evencount"],
};

const all = (skill: string, level: Level) => Array.from({ length: SEEDS }, (_, i) => generateLeveled(skill, level, i + 1));

describe("уровень C: новые виды заданий по сути", () => {
  for (const skill of SKILLS) {
    it(`${skill}: все новые виды встречаются, и их большинство`, () => {
      const steps = all(skill, 3);
      const seen = new Set(steps.map(kindOf));
      for (const k of NEW_KINDS[skill]) expect(seen.has(k), `${skill}: нет вида ${k}`).toBe(true);
      const fresh = steps.filter((s) => NEW_KINDS[skill].includes(kindOf(s))).length;
      expect(fresh / steps.length, `${skill}: доля новых видов`).toBeGreaterThan(0.5);
    });
  }

  it("найди цифру x: подстановка даёт заданное число, вторая цифра — нет", () => {
    let n = 0;
    for (const step of all("ns.bin2dec", 3)) {
      if (kindOf(step) !== "findx") continue;
      n++;
      const m = step.prompt.ru.match(/^Найди цифру x: ([01x]+)₂ = (\d+)$/);
      expect(m, step.id).not.toBeNull();
      const [, masked, value] = m!;
      expect(masked.startsWith("1"), `${step.id}: x не на первом месте`).toBe(true);
      const d = answerOf(step);
      expect(parseInt(masked.replace("x", d), 2), step.id).toBe(Number(value));
      expect(parseInt(masked.replace("x", d === "0" ? "1" : "0"), 2), step.id).not.toBe(Number(value));
    }
    expect(n).toBeGreaterThan(100);
  });

  it("сумма двоичных чисел в десятичной системе: ответ верен, ловушки не совпадают с ним", () => {
    let n = 0;
    for (const step of all("ns.bin2dec", 3)) {
      if (kindOf(step) !== "sum") continue;
      n++;
      const m = step.prompt.ru.match(/сумма ([01]+)₂ \+ ([01]+)₂\?/);
      expect(m, step.id).not.toBeNull();
      const a = parseInt(m![1], 2);
      const b = parseInt(m![2], 2);
      expect(Number(answerOf(step)), step.id).toBe(a + b);
      if (step.type === "choice") {
        const naive = Number(m![1]) + Number(m![2]); // сложили «как десятичные»
        step.options.forEach((o, i) => {
          if (i !== step.correct) expect(Number(txt(o)), `${step.id}: ловушка равна верному`).not.toBe(a + b);
        });
        // верный ответ не совпадает с типичными ошибками по построению
        expect(a + b).not.toBe(naive);
        expect(a + b).not.toBe(a ^ b);
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it("двоичное против десятичного: верен вариант «больше»/«равны», есть оба вида ответа", () => {
    let n = 0;
    const picked = new Set<string>();
    for (const step of all("ns.bin2dec", 3)) {
      if (kindOf(step) !== "cmp" || step.type !== "choice") continue;
      n++;
      const m = step.prompt.ru.match(/^Какое число больше: ([01]+)₂ или (\d+)₁₀\?$/);
      expect(m, step.id).not.toBeNull();
      const b = parseInt(m![1], 2);
      const d = Number(m![2]);
      const expected = b === d ? "Числа равны" : b > d ? `${m![1]}₂` : `${d}₁₀`;
      expect(txt(step.options[step.correct]), step.id).toBe(expected);
      expect(step.options.length).toBe(4);
      picked.add(b === d ? "eq" : b > d ? "bin" : "dec");
    }
    expect(n).toBeGreaterThan(50);
    expect([...picked].sort()).toEqual(["bin", "dec", "eq"]);
  });

  it("сумма в двоичную систему: сложить, затем перевести", () => {
    let n = 0;
    for (const step of all("ns.dec2bin", 3)) {
      if (kindOf(step) !== "sumbin") continue;
      n++;
      const m = step.prompt.ru.match(/сумму (\d+) \+ (\d+)$/);
      expect(m, step.id).not.toBeNull();
      expect(answerOf(step), step.id).toBe((Number(m![1]) + Number(m![2])).toString(2));
    }
    expect(n).toBeGreaterThan(100);
  });

  it("сдвиг: «известно, что …» — умножение и деление на 2ᵏ без перевода заново", () => {
    let mul = 0;
    let div = 0;
    for (const step of all("ns.dec2bin", 3)) {
      if (kindOf(step) !== "shift") continue;
      const m = step.prompt.ru.match(/^Известно, что (\d+) = ([01]+)₂\. Не переводя заново, запиши в двоичной системе число (\d+)$/);
      expect(m, step.id).not.toBeNull();
      const given = Number(m![1]);
      const ask = Number(m![3]);
      expect(parseInt(m![2], 2), step.id).toBe(given);
      expect(answerOf(step), step.id).toBe(ask.toString(2));
      if (ask > given) mul++;
      else div++;
      // ловушек нужно ровно три и все — разные записи
      if (step.type === "choice") expect(new Set(step.options.map((o) => txt(o))).size).toBe(4);
    }
    expect(mul).toBeGreaterThan(30);
    expect(div).toBeGreaterThan(30);
  });

  it("2ᵏ − 1 в двоичной системе — k единиц", () => {
    let n = 0;
    for (const step of all("ns.dec2bin", 3)) {
      if (kindOf(step) !== "allones") continue;
      n++;
      const m = step.prompt.ru.match(/число (2[⁰¹²³⁴⁵⁶⁷⁸⁹]+) − 1$/);
      expect(m, step.id).not.toBeNull();
      const k = Number(sup(m![1]).slice(1));
      expect(answerOf(step), step.id).toBe("1".repeat(k));
      expect(parseInt(answerOf(step), 2)).toBe(2 ** k - 1);
    }
    expect(n).toBeGreaterThan(100);
  });

  it("наименьшее основание: самая большая цифра + 1 (без восьмеричной и шестнадцатеричной систем)", () => {
    let n = 0;
    for (const step of all("ns.base", 3)) {
      if (kindOf(step) !== "minbase") continue;
      n++;
      const m = step.prompt.ru.match(/записано число (\d+)\?$/);
      expect(m, step.id).not.toBeNull();
      const digits = m![1].split("").map(Number);
      const answer = Math.max(...digits) + 1;
      expect(Number(answerOf(step)), step.id).toBe(answer);
      expect([3, 4, 5, 6, 7, 10], `${step.id}: основание ${answer}`).toContain(answer === 8 ? -1 : answer);
      // запись возможна в системе с найденным основанием и невозможна в системе на единицу меньше
      expect(digits.every((x) => x < answer)).toBe(true);
      expect(digits.every((x) => x < answer - 1)).toBe(false);
    }
    expect(n).toBeGreaterThan(100);
  });

  it("наибольшее число из m цифр в системе с основанием b: во всех разрядах наибольшая цифра", () => {
    let n = 0;
    for (const step of all("ns.base", 3)) {
      if (kindOf(step) !== "maxrec") continue;
      n++;
      const m = step.prompt.ru.match(/^Какое наибольшее (двузначное|трёхзначное) число можно записать в системе счисления с основанием (\d+)\?$/);
      expect(m, step.id).not.toBeNull();
      const len = m![1] === "двузначное" ? 2 : 3;
      const b = Number(m![2]);
      expect(answerOf(step), step.id).toBe(String(b - 1).repeat(len));
      // это действительно наибольшее: следующее число уже длиннее
      expect(parseInt(answerOf(step), b) + 1).toBe(b ** len);
      if (step.type === "choice")
        step.options.forEach((o, i) => {
          if (i !== step.correct) expect(txt(o), step.id).not.toBe(answerOf(step));
        });
    }
    expect(n).toBeGreaterThan(100);
  });

  it("наибольшее и наименьшее число из k двоичных цифр", () => {
    let max = 0;
    let min = 0;
    for (const step of all("ns.props", 3)) {
      const kind = kindOf(step);
      if (kind !== "maxk" && kind !== "mink") continue;
      const k = Number(step.prompt.ru.match(/состоит из (\d+) цифр\?$/)![1]);
      if (kind === "maxk") {
        max++;
        expect(Number(answerOf(step)), step.id).toBe(parseInt("1".repeat(k), 2));
        expect(toBinary(Number(answerOf(step))).length).toBe(k);
        expect(toBinary(Number(answerOf(step)) + 1).length).toBe(k + 1);
      } else {
        min++;
        expect(step.prompt.ru.includes("без ведущих нулей")).toBe(true);
        expect(Number(answerOf(step)), step.id).toBe(parseInt(`1${"0".repeat(k - 1)}`, 2));
        expect(toBinary(Number(answerOf(step))).length).toBe(k);
        expect(toBinary(Number(answerOf(step)) - 1).length).toBe(k - 1);
      }
    }
    expect(max).toBeGreaterThan(50);
    expect(min).toBeGreaterThan(50);
  });

  it("число цифр на границе степени двойки: 2ᵏ − 1 и 2ᵏ", () => {
    const kinds = new Set<string>();
    for (const step of all("ns.props", 3)) {
      if (kindOf(step) !== "lenedge") continue;
      const N = Number(step.prompt.ru.match(/числа (\d+)\?$/)![1]);
      expect(Number(answerOf(step)), step.id).toBe(N.toString(2).length);
      const isPow = (N & (N - 1)) === 0;
      const isAllOnes = ((N + 1) & N) === 0;
      expect(isPow || isAllOnes, `${step.id}: число не на границе`).toBe(true);
      kinds.add(isPow ? "pow" : "ones");
    }
    expect([...kinds].sort()).toEqual(["ones", "pow"]);
  });

  it("сколько чётных чисел среди набора: считается по последней цифре", () => {
    let n = 0;
    for (const step of all("ns.props", 3)) {
      if (kindOf(step) !== "evencount") continue;
      n++;
      const list = [...step.prompt.ru.matchAll(/([01]+)₂/g)].map((m) => m[1]);
      expect(list.length, step.id).toBe(5);
      expect(Number(answerOf(step)), step.id).toBe(list.filter((b) => b.endsWith("0")).length);
      // есть и чётные, и нечётные
      expect(list.some((b) => b.endsWith("1")) && list.some((b) => b.endsWith("0"))).toBe(true);
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe("ноль и единица на уровне A (аудит C8)", () => {
  /** Задания уровня A про 0 и 1 — по id. */
  const isEdge = (step: QuestionStep) => {
    const [, skill, kind, arg] = step.id.split(":");
    if (skill === "ns.bin2dec") return kind === "input" && (arg === "0" || arg === "1");
    if (skill === "ns.dec2bin") return (kind === "input" || kind === "choice") && (arg === "0" || arg === "1");
    if (skill === "ns.base") return kind === "digitset";
    return kind === "len01" || kind === "cnt01" || (kind === "parity" && (arg === "0" || arg === "1"));
  };

  for (const skill of SKILLS) {
    it(`${skill}: 0 и 1 встречаются примерно в одном задании из десяти, на других уровнях их нет`, () => {
      const edge = all(skill, 1).filter(isEdge);
      expect(edge.length / SEEDS, `${skill}: доля`).toBeGreaterThan(0.06);
      expect(edge.length / SEEDS, `${skill}: доля`).toBeLessThan(0.14);
      for (const level of [2, 3] as const) expect(all(skill, level).some(isEdge), `${skill} ${level}`).toBe(false);
    });
  }

  it("верные ответы: 0₂ = 0, 1₂ = 1, 0₁₀ = 0₂, 1₁₀ = 1₂, цифр у нуля — одна", () => {
    const seen = new Set<string>();
    for (const step of all("ns.bin2dec", 1)) {
      if (!isEdge(step)) continue;
      const m = step.prompt.ru.match(/: ([01])₂ = \?$/);
      expect(m, step.id).not.toBeNull();
      expect(answerOf(step), step.id).toBe(m![1]);
      seen.add(`b2d${m![1]}`);
    }
    for (const step of all("ns.dec2bin", 1)) {
      if (!isEdge(step)) continue;
      const n = step.id.split(":")[3];
      const ans = answerOf(step);
      expect(unsub(ans).replace(/₂$/, "").replace(/2$/, ""), step.id).toBe(n);
      seen.add(`d2b${n}${step.type}`);
    }
    for (const step of all("ns.props", 1)) {
      if (!isEdge(step)) continue;
      const kind = kindOf(step);
      const n = step.id.split(":")[3];
      if (kind === "len01") {
        expect(answerOf(step), step.id).toBe("1");
        seen.add(`len${n}`);
      }
      if (kind === "cnt01") {
        expect(answerOf(step), step.id).toBe("0");
        seen.add(`cnt${n}`);
      }
      if (kind === "parity") {
        expect(txt((step as ChoiceStep).options[(step as ChoiceStep).correct]), step.id).toBe(n === "0" ? "Чётное" : "Нечётное");
        seen.add(`par${n}`);
      }
    }
    for (const step of all("ns.base", 1)) {
      if (kindOf(step) !== "digitset") continue;
      expect(txt((step as ChoiceStep).options[(step as ChoiceStep).correct]), step.id).toBe("0 и 1");
      seen.add("digitset");
    }
    expect([...seen].sort()).toEqual(
      ["b2d0", "b2d1", "cnt0", "cnt1", "d2b0choice", "d2b0input", "d2b1choice", "d2b1input", "digitset", "len0", "len1", "par0", "par1"].sort(),
    );
  });

  it("ответ «0» не превращается в пустую строку: checkInput принимает 0, 00 и «0₂»", () => {
    for (const mode of ["number", "binary"] as const) {
      expect(checkInput("0", ["0"], mode)).toBe(true);
      expect(checkInput("00", ["0"], mode)).toBe(true);
      expect(checkInput("0₂", ["0"], mode)).toBe(true);
      expect(checkInput("1", ["0"], mode)).toBe(false);
      expect(checkInput("", ["0"], mode)).toBe(false);
    }
    // и все задания с ответом «0» проходят свою проверку
    let zeroes = 0;
    for (const skill of SKILLS)
      for (const step of all(skill, 1)) {
        if (step.type !== "input" || step.answers[0] !== "0") continue;
        zeroes++;
        expect(evaluate(step, { type: "input", value: "0" }, "ru").correct, step.id).toBe(true);
        expect(evaluate(step, { type: "input", value: "00" }, "ru").correct, step.id).toBe(true);
      }
    expect(zeroes).toBeGreaterThan(10);
  });

  it("банк: утверждения и короткие вопросы про 0 и 1 на уровне A", () => {
    const stmt = { b2d: 0, d2b: 0, len: 0, par: 0, min: 0, shortB2d: 0, shortD2b: 0, shortLen: 0 };
    const b2d = bankFor("ns.bin2dec")!;
    const d2b = bankFor("ns.dec2bin")!;
    const props = bankFor("ns.props")!;
    const base = bankFor("ns.base")!;
    const val = (digits: string, sub: string) => parseInt(digits, sub === "₂" ? 2 : 10);
    for (let seed = 1; seed <= SEEDS; seed++) {
      let st = b2d.statement!(1, seed);
      let m = st.text.ru.match(/^([01])₂ = (\d+)₁₀$/);
      if (m && /^[01]$/.test(m[1]) && st.id.split(":")[2] === m[1]) {
        stmt.b2d++;
        expect(st.value, st.text.ru).toBe(val(m[1], "₂") === Number(m[2]));
      }
      st = d2b.statement!(1, seed);
      m = st.text.ru.match(/^([01])₁₀ = (\d+)₂$/);
      if (m && /^[01]$/.test(m[1])) {
        stmt.d2b++;
        expect(st.value, st.text.ru).toBe(m[1] === m[2]);
      }
      st = props.statement!(1, seed);
      let mm = st.text.ru.match(/^Количество цифр в двоичной записи числа ([01]): (\d+)$/);
      if (mm) {
        stmt.len++;
        expect(st.value, st.text.ru).toBe(mm[2] === "1");
      }
      mm = st.text.ru.match(/^([01])₂ — (чётное|нечётное) число$/);
      if (mm) {
        stmt.par++;
        expect(st.value, st.text.ru).toBe((mm[1] === "0") === (mm[2] === "чётное"));
      }
      st = base.statement!(1, seed);
      mm = st.text.ru.match(/^Наименьшая цифра в двоичной системе — (\d)$/);
      if (mm) {
        stmt.min++;
        expect(st.value, st.text.ru).toBe(mm[1] === "0");
      }
      let q = b2d.short!(1, seed);
      let qm = q.prompt.ru.match(/^([01])₂ = \?₁₀$/);
      if (qm) {
        stmt.shortB2d++;
        expect(q.answer).toBe(qm[1]);
        expect(checkInput(q.answer, [q.answer], q.mode)).toBe(true);
      }
      q = d2b.short!(1, seed);
      qm = q.prompt.ru.match(/^([01])₁₀ = \?₂$/);
      if (qm) {
        stmt.shortD2b++;
        expect(q.answer).toBe(qm[1]);
        expect(checkInput(q.answer, [q.answer], q.mode)).toBe(true);
      }
      q = props.short!(1, seed);
      qm = q.prompt.ru.match(/^Сколько цифр в двоичной записи числа ([01])\?$/);
      if (qm) {
        stmt.shortLen++;
        expect(q.answer).toBe("1");
      }
    }
    for (const [k, v] of Object.entries(stmt)) expect(v, k).toBeGreaterThan(10);
  });
});

describe("статические утверждения уровня C (банк)", () => {
  it("сумма, сдвиг и наибольшее число из k цифр — истинность пересчитана", () => {
    const b2d = bankFor("ns.bin2dec")!;
    const d2b = bankFor("ns.dec2bin")!;
    const props = bankFor("ns.props")!;
    const seen = { sum: 0, shift: 0, maxk: 0 };
    let t = 0;
    let f = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s1 = b2d.statement!(3, seed);
      const m1 = s1.text.ru.match(/^([01]+)₂ \+ ([01]+)₂ = (\d+)₁₀$/);
      if (m1) {
        seen.sum++;
        expect(s1.value, s1.text.ru).toBe(parseInt(m1[1], 2) + parseInt(m1[2], 2) === Number(m1[3]));
        if (s1.value) t++;
        else f++;
      }
      const s2 = d2b.statement!(3, seed);
      const m2 = s2.text.ru.match(/^Если (\d+)₁₀ = ([01]+)₂, то (\d+)₁₀ = ([01]+)₂$/);
      if (m2) {
        seen.shift++;
        expect(parseInt(m2[2], 2)).toBe(Number(m2[1]));
        expect(s2.value, s2.text.ru).toBe(parseInt(m2[4], 2) === Number(m2[3]));
        if (s2.value) t++;
        else f++;
      }
      const s3 = props.statement!(3, seed);
      const m3 = s3.text.ru.match(/^Наибольшее число из (\d+) двоичных цифр равно (\d+)$/);
      if (m3) {
        seen.maxk++;
        expect(s3.value, s3.text.ru).toBe(2 ** Number(m3[1]) - 1 === Number(m3[2]));
        if (s3.value) t++;
        else f++;
      }
      for (const st of [s1, s2, s3]) expect(st.hint?.ru && st.hint?.kk, st.id).toBeTruthy();
    }
    expect(seen.sum).toBeGreaterThan(100);
    expect(seen.shift).toBeGreaterThan(100);
    expect(seen.maxk).toBeGreaterThan(50);
    expect(t).toBeGreaterThan(100);
    expect(f).toBeGreaterThan(100);
  });
});

describe("каждое задание: корректно, ответ проходит проверку, ru и kk, подсказка без ответа", () => {
  const KK_CASES: KkCase[] = ["acc", "dat", "loc", "abl", "gen", "ins"];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  it(`${SEEDS} seed × 4 навыка × 3 уровня`, () => {
    for (const skill of SKILLS)
      for (const level of [1, 2, 3] as const)
        for (let seed = 1; seed <= SEEDS; seed++) {
          const step = generateLeveled(skill, level, seed);
          expect(validateStep(step), step.id).toEqual([]);
          expect(step.level).toBe(level);
          // обе языковые версии: условие, разбор, подсказка
          expect(step.prompt.ru.trim() && step.prompt.kk.trim(), `${step.id}: prompt`).toBeTruthy();
          if (!("explanation" in step)) continue;
          expect(step.explanation.ru.trim() && step.explanation.kk.trim(), `${step.id}: explanation`).toBeTruthy();
          expect(step.hint?.ru.trim() && step.hint?.kk.trim(), `${step.id}: hint`).toBeTruthy();
          // повторяющихся вариантов нет, whyWrong у каждого неверного
          if (step.type === "choice") {
            const keys = step.options.map((o) => JSON.stringify(o));
            expect(new Set(keys).size, `${step.id}: повтор вариантов`).toBe(keys.length);
            expect(step.whyWrong?.length, `${step.id}: whyWrong`).toBe(step.options.length);
            step.whyWrong!.forEach((w, i) => {
              if (i === step.correct) expect(w).toBeNull();
              else expect(w?.ru.trim() && w?.kk.trim(), `${step.id}: whyWrong[${i}]`).toBeTruthy();
            });
            // верный вариант проходит проверку, неверные — нет
            expect(evaluate(step, { type: "choice", index: step.correct }, "ru").correct, step.id).toBe(true);
            step.options.forEach((_, i) => {
              if (i !== step.correct) expect(evaluate(step, { type: "choice", index: i }, "kk").correct, step.id).toBe(false);
            });
          }
          if (step.type === "input") {
            const s = step as InputStep;
            for (const a of s.answers) expect(evaluate(s, { type: "input", value: a }, "ru").correct, `${s.id}: ответ ${a}`).toBe(true);
            expect(evaluate(s, { type: "input", value: "9999" }, "ru").correct, s.id).toBe(false);
          }
          // подсказка не выдаёт ответ (ответы из 3+ символов — отдельным словом)
          let ans: string | null = null;
          if (step.type === "choice") ans = txt(step.options[step.correct]);
          if (step.type === "input") ans = step.answers[0];
          if (ans && ans.length >= 3) {
            const re = new RegExp(`(^|[^0-9a-zA-Zа-яё])${esc(ans)}($|[^0-9a-zA-Zа-яё])`, "i");
            expect(re.test(step.hint!.ru) || re.test(step.hint!.kk), `${step.id}: подсказка содержит ответ ${ans}`).toBe(false);
          }
          // окончания после чисел в казахском — только как у kkSuffix
          const texts = [step.prompt.kk, step.hint?.kk ?? "", step.explanation.kk, ...(step.type === "choice" ? step.whyWrong!.map((w) => w?.kk ?? "") : [])];
          for (const t of texts)
            for (const m of t.matchAll(/(\d+)-([а-яәіңғүұқөһ]+)/g)) {
              const ok = KK_CASES.map((c) => kkSuffix(Number(m[1]), c).split("-").slice(1).join("-"));
              expect(ok.includes(m[2]), `${step.id}: «${m[0]}»`).toBe(true);
            }
        }
  });

  it("детерминированы по seed", () => {
    for (const skill of SKILLS)
      for (const level of [1, 2, 3] as const)
        for (let seed = 1; seed <= 200; seed++) expect(generateLeveled(skill, level, seed)).toEqual(generateLeveled(skill, level, seed));
  });

  it("на уровне C выбор из вариантов всегда на 4 варианта, как в ЕНТ", () => {
    for (const skill of SKILLS)
      for (let seed = 1; seed <= SEEDS; seed++) {
        const step = generateLeveled(skill, 3, seed);
        if (step.type === "choice") expect(step.options.length, step.id).toBe(4);
      }
  });
});
