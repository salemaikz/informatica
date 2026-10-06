import { describe, expect, it } from "vitest";
import { glueQuestionTail } from "@/lib/text";

// Знак вопроса в хвосте «число = ?» не должен уходить один на вторую строку (360 px): хвост склеен неразрывными пробелами.

const NB = " ";

describe("glueQuestionTail", () => {
  it("«1100₂ = ?» — число, знак и вопрос склеены", () => {
    expect(glueQuestionTail("Переведи в десятичную: 1100₂ = ?")).toBe(`Переведи в десятичную: 1100₂${NB}=${NB}?`);
    expect(glueQuestionTail("Ондық жүйеге аудар: 1100₂ = ?")).toBe(`Ондық жүйеге аудар: 1100₂${NB}=${NB}?`);
    expect(glueQuestionTail("2 + 2 = ?")).toBe(`2 + 2${NB}=${NB}?`);
  });

  it("другие знаки сравнения и хвостовой пробел", () => {
    expect(glueQuestionTail("A → ? ")).toBe(`A${NB}→${NB}?`);
    expect(glueQuestionTail("x ≈ ?")).toBe(`x${NB}≈${NB}?`);
  });

  it("обычный вопрос и текст без хвоста не меняются", () => {
    for (const s of ["Что выведет программа?", "Чему равно 2³?", "x = 5", "a = ? и дальше", "`x = ?`", ""]) expect(glueQuestionTail(s)).toBe(s);
  });

  it("только показ: после замены пробелы остаются пробельными символами (проверка ответов их не видит)", () => {
    expect(glueQuestionTail("1 = ?").replace(/\s/gu, " ")).toBe("1 = ?");
  });
});
