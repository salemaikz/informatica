import { describe, expect, it } from "vitest";
import type { Level } from "@/lib/types";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { ENT_POOL } from "@/content/ent";
import { ENT_TOPICS } from "@/content/ent-topics";
import { bankFor } from "@/lib/bank";
import { GENERATED_BANKS } from "@/lib/bank/generated";
import { checkInput } from "@/lib/check";
import { validateEnt, validateStep } from "./validate";

// Банки заданий и задания ЕНТ всех уроков контент-потока (подключаются scripts/register-content.mjs).

describe("банки заданий", () => {
  const known = new Set(SKILLS.map((s) => s.id));

  it("у каждого навыка готового урока есть банк", () => {
    for (const lesson of Object.values(LESSONS)) {
      for (const skill of lesson.skills) {
        if (skill === "ent.strategy" || !lesson.entTopics) continue;
        expect(bankFor(skill), `${lesson.id}: ${skill}`).toBeDefined();
      }
    }
  });

  for (const bank of GENERATED_BANKS) {
    it(`${bank.skill}: задания корректны на всех уровнях`, () => {
      expect(known.has(bank.skill)).toBe(true);
      for (const level of [1, 2, 3] as Level[]) {
        for (let seed = 1; seed <= 25; seed++) {
          const q = bank.question(level, seed * 7919);
          expect(validateStep(q), q.id).toEqual([]);
          expect(q.skill).toBe(bank.skill);
          if (bank.short) {
            const sq = bank.short(level, seed * 104729);
            expect(checkInput(sq.answer, [sq.answer], sq.mode), sq.id).toBe(true);
          }
          if (bank.statement) {
            const st = bank.statement(level, seed * 31337);
            expect(typeof st.value).toBe("boolean");
            expect(st.text.ru && st.text.kk && st.explanation.ru && st.explanation.kk, st.id).toBeTruthy();
          }
        }
      }
    });
  }
});

describe("задания ЕНТ", () => {
  it("все задания корректны и id уникальны", () => {
    const errors = ENT_POOL.flatMap(validateEnt);
    expect(errors).toEqual([]);
    const ids = ENT_POOL.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("навыки и темы заданий существуют", () => {
    const skills = new Set(SKILLS.map((s) => s.id));
    const topics = new Set(ENT_TOPICS.map((t) => t.id));
    for (const item of ENT_POOL) {
      expect(skills.has(item.skill), item.id).toBe(true);
      expect(topics.has(item.topic), item.id).toBe(true);
    }
  });

  it("карта курса: готовые уроки подключены, названия совпадают", () => {
    for (const u of UNITS) {
      for (const ref of u.lessons) {
        if (ref.status === "available") expect(LESSONS[ref.id]?.title.ru, ref.id).toBe(ref.title.ru);
        if (LESSONS[ref.id]) expect(LESSONS[ref.id].unitId, ref.id).toBe(u.id);
      }
    }
  });
});
