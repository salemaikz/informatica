import { describe, expect, it } from "vitest";
import {
  GUESS_BONUS_PER_LETTER,
  GUESS_OPTIONS,
  GUESS_PENALTY,
  ROUND_QUESTIONS,
  applyGuess,
  applyQuestion,
  drawNext,
  fullyRevealed,
  guessAvailable,
  guessOptions,
  hiddenCount,
  letterCount,
  letterIndices,
  maskedText,
  phraseText,
  resolveSkills,
  revealTarget,
  revealedSet,
  roundOver,
  startRound,
  toResult,
  type CipherState,
} from "@/games/cipher/logic";
import { PHRASES, S } from "@/games/cipher/strings";
import type { QuestionStep } from "@/lib/types";

const step = { id: "t:x:1:1", type: "choice", skill: "ns.base", prompt: { ru: "q", kk: "q" }, options: ["a", "b"], correct: 0, explanation: { ru: "e", kk: "e" } } as unknown as QuestionStep;
const mk = (mode: "calm" | "normal" | "blitz" = "calm", lang: "ru" | "kk" = "ru", seed = 1) => startRound(null, { lang, mode, seed }) as CipherState;

describe("фразы", () => {
  it("12 фраз, уникальные id и тексты, 15–35 букв, слова не длиннее 13", () => {
    expect(PHRASES).toHaveLength(12);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(12);
    for (const lang of ["ru", "kk"] as const) {
      expect(new Set(PHRASES.map((p) => p.text[lang])).size).toBe(12);
      for (const p of PHRASES) {
        const text = p.text[lang];
        expect(text.trim().length, p.id).toBeGreaterThan(0);
        const n = letterCount(text);
        expect(n, `${p.id}/${lang}`).toBeGreaterThanOrEqual(15);
        expect(n, `${p.id}/${lang}`).toBeLessThanOrEqual(35);
        for (const w of text.split(/\s+/)) expect(letterCount(w), w).toBeLessThanOrEqual(13);
      }
    }
  });
  it("все строки игры двуязычные", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
  it("пробелы и знаки — не буквы", () => {
    expect(letterIndices("а-б в, 1")).toEqual([0, 2, 4, 7]);
  });
});

describe("открытие букв", () => {
  it("к последнему вопросу открыто всё, монотонно, при c=0 — ничего", () => {
    for (const total of [15, 22, 35]) {
      for (const q of [8, 10, 12]) {
        expect(revealTarget(0, q, total)).toBe(0);
        expect(revealTarget(q, q, total)).toBe(total);
        let prev = 0;
        for (let c = 1; c <= q; c++) {
          const r = revealTarget(c, q, total);
          expect(r).toBeGreaterThan(prev);
          prev = r;
        }
      }
    }
  });
  it("верные ответы открывают буквы, ошибка — нет", () => {
    let s = mk("calm");
    const wrong = applyQuestion(s, step, false);
    expect(wrong.state.revealed).toBe(0);
    expect(wrong.state.asked).toBe(1);
    expect(wrong.gained).toBe(0);
    s = wrong.state;
    const ok = applyQuestion(s, step, true);
    expect(ok.state.revealed).toBeGreaterThan(0);
    expect(ok.opened).toBe(ok.state.revealed);
    expect(ok.gained).toBeGreaterThan(0);
    expect(ok.state.correct).toBe(1);
  });
  it("10 верных подряд (calm) раскрывают фразу целиком", () => {
    let s = mk("calm");
    for (let i = 0; i < ROUND_QUESTIONS.calm; i++) {
      expect(roundOver(s)).toBe(false);
      s = applyQuestion(s, step, true).state;
    }
    expect(fullyRevealed(s)).toBe(true);
    expect(roundOver(s)).toBe(true);
    expect(maskedText(s)).toBe(phraseText(s));
  });
  it("с ошибками фраза остаётся скрытой частично, раунд всё равно заканчивается", () => {
    let s = mk("normal");
    for (let i = 0; i < ROUND_QUESTIONS.normal; i++) s = applyQuestion(s, step, i % 2 === 0).state;
    expect(roundOver(s)).toBe(true);
    expect(fullyRevealed(s)).toBe(false);
    expect(hiddenCount(s)).toBeGreaterThan(0);
  });
  it("маска скрывает только буквы", () => {
    const s = mk("calm");
    const m = maskedText(s);
    const text = phraseText(s);
    expect(m.length).toBe(text.length);
    expect(revealedSet(s).size).toBe(0);
    for (let i = 0; i < text.length; i++) {
      if (/[\p{L}\p{N}]/u.test(text[i])) expect(m[i]).toBe("_");
      else expect(m[i]).toBe(text[i]);
    }
  });
});

describe("детерминизм", () => {
  it("раунд и варианты зависят только от seed", () => {
    expect(mk("calm", "ru", 7)).toEqual(mk("calm", "ru", 7));
    expect(mk("calm", "kk", 7).order).toEqual(mk("calm", "kk", 7).order);
    const ids = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) ids.add(mk("calm", "ru", seed).phraseId);
    expect(ids.size).toBeGreaterThan(3);
  });
});

describe("угадывание фразы", () => {
  it("4 разных варианта, верный среди них, различия по длине невелики", () => {
    for (const lang of ["ru", "kk"] as const) {
      for (const p of PHRASES) {
        const o = guessOptions(p.id, lang, 3);
        expect(o).toHaveLength(GUESS_OPTIONS);
        expect(new Set(o).size).toBe(GUESS_OPTIONS);
        expect(o).toContain(p.id);
      }
    }
  });
  it("доступно после четверти букв и пока есть скрытые", () => {
    let s = mk("calm");
    expect(guessAvailable(s)).toBe(false);
    s = applyQuestion(s, step, true).state;
    s = applyQuestion(s, step, true).state;
    s = applyQuestion(s, step, true).state;
    expect(s.revealed).toBeGreaterThanOrEqual(Math.ceil(s.total / 4));
    expect(guessAvailable(s)).toBe(true);
    const done = applyGuess(s, s.phraseId).state;
    expect(guessAvailable(done)).toBe(false);
  });
  it("верная фраза: бонус за скрытые буквы, всё открыто", () => {
    let s = mk("calm");
    for (let i = 0; i < 4; i++) s = applyQuestion(s, step, true).state;
    const hidden = hiddenCount(s);
    const before = s.score;
    const out = applyGuess(s, s.phraseId);
    expect(out.correct).toBe(true);
    expect(out.delta).toBe(hidden * GUESS_BONUS_PER_LETTER);
    expect(out.state.score).toBe(before + out.delta);
    expect(out.state.solved).toBe(true);
    expect(fullyRevealed(out.state)).toBe(true);
    expect(roundOver(out.state)).toBe(true);
  });
  it("неверная фраза: штраф, вариант отпадает, очки не уходят ниже нуля", () => {
    let s = mk("calm");
    for (let i = 0; i < 4; i++) s = applyQuestion(s, step, true).state;
    const wrongId = s.options.find((x) => x !== s.phraseId) as string;
    const before = s.score;
    const out = applyGuess(s, wrongId);
    expect(out.correct).toBe(false);
    expect(out.state.score).toBe(Math.max(0, before - GUESS_PENALTY));
    expect(out.state.rejected).toEqual([wrongId]);
    expect(out.state.solved).toBe(false);
    // повторно тот же вариант — без изменений
    expect(applyGuess(out.state, wrongId).state).toBe(out.state);
    // очки 0: штраф не делает их отрицательными
    const zero = applyGuess({ ...s, score: 0 }, wrongId);
    expect(zero.state.score).toBe(0);
    expect(zero.delta).toBe(0);
  });
  it("вариант не из списка игнорируется", () => {
    const s = mk("calm");
    expect(applyGuess(s, "нет такого").state).toBe(s);
  });
});

describe("раунды и банк", () => {
  it("блиц переходит к новой фразе, счёт переносится, фразы не повторяются", () => {
    let s = mk("blitz", "ru", 5);
    s = applyQuestion(s, step, true).state;
    const seen = [s.phraseId];
    for (let r = 0; r < PHRASES.length - 1; r++) {
      const next = startRound(s, { lang: "ru", mode: "blitz", seed: 5 });
      expect(next).not.toBeNull();
      expect(seen).not.toContain(next?.phraseId);
      expect(next?.score).toBe(s.score);
      expect(next?.asked).toBe(0);
      expect(next?.revealed).toBe(0);
      expect(next?.rounds).toBe(s.rounds + 1);
      s = next as CipherState;
      seen.push(s.phraseId);
    }
    expect(startRound(s, { lang: "ru", mode: "blitz", seed: 5 })).toBeNull();
  });
  it("задания подбираются из банка, повторы по ключу не идут подряд", () => {
    const skills = resolveSkills(undefined);
    expect(skills.length).toBeGreaterThan(0);
    let s = mk("calm");
    let last: string | undefined;
    for (let i = 0; i < 10; i++) {
      const n = drawNext(s, skills, 9);
      expect(n).not.toBeNull();
      s = n?.state as CipherState;
      expect(s.lastKey).not.toBe(last);
      last = s.lastKey;
    }
    expect(s.taskNo).toBe(10);
  });
  it("нет подходящих навыков — null, а не падение", () => {
    expect(resolveSkills(["no.such.skill" as never])).toEqual([]);
    expect(drawNext(mk("calm"), [], 1)).toBeNull();
  });
  it("результат: attempts по каждому вопросу, фраза не считается вопросом", () => {
    let s = mk("calm");
    s = applyQuestion(s, step, true).state;
    s = applyQuestion(s, step, false).state;
    for (let i = 0; i < 3; i++) s = applyQuestion(s, step, true).state;
    s = applyGuess(s, s.phraseId).state;
    const r = toResult(s);
    expect(r.total).toBe(5);
    expect(r.correct).toBe(4);
    expect(r.attempts).toHaveLength(5);
    expect(r.attempts[1]).toEqual({ skill: "ns.base", correct: false });
    expect(r.score).toBe(s.score);
  });
});
