import { describe, expect, it } from "vitest";
import { kkLastWord, kkSuffix, type KkCase } from "@/lib/kk";

// Независимая эталонная таблица: последнее слово числительного → окончания по падежам.
// Составлена вручную по правилам (сингармонизм + ассимиляция), код kk.ts не использует.
const REF: Record<string, Record<KkCase, string>> = {
  нөл: { acc: "ді", dat: "ге", loc: "де", abl: "ден", gen: "дің", ins: "мен" },
  бір: { acc: "ді", dat: "ге", loc: "де", abl: "ден", gen: "дің", ins: "мен" },
  екі: { acc: "ні", dat: "ге", loc: "де", abl: "ден", gen: "нің", ins: "мен" },
  үш: { acc: "ті", dat: "ке", loc: "те", abl: "тен", gen: "тің", ins: "пен" },
  төрт: { acc: "ті", dat: "ке", loc: "те", abl: "тен", gen: "тің", ins: "пен" },
  бес: { acc: "ті", dat: "ке", loc: "те", abl: "тен", gen: "тің", ins: "пен" },
  алты: { acc: "ны", dat: "ға", loc: "да", abl: "дан", gen: "ның", ins: "мен" },
  жеті: { acc: "ні", dat: "ге", loc: "де", abl: "ден", gen: "нің", ins: "мен" },
  сегіз: { acc: "ді", dat: "ге", loc: "де", abl: "ден", gen: "дің", ins: "бен" },
  тоғыз: { acc: "ды", dat: "ға", loc: "да", abl: "дан", gen: "дың", ins: "бен" },
  он: { acc: "ды", dat: "ға", loc: "да", abl: "нан", gen: "ның", ins: "мен" },
  жиырма: { acc: "ны", dat: "ға", loc: "да", abl: "дан", gen: "ның", ins: "мен" },
  отыз: { acc: "ды", dat: "ға", loc: "да", abl: "дан", gen: "дың", ins: "бен" },
  қырық: { acc: "ты", dat: "қа", loc: "та", abl: "тан", gen: "тың", ins: "пен" },
  елу: { acc: "ді", dat: "ге", loc: "де", abl: "ден", gen: "дің", ins: "мен" },
  алпыс: { acc: "ты", dat: "қа", loc: "та", abl: "тан", gen: "тың", ins: "пен" },
  жетпіс: { acc: "ті", dat: "ке", loc: "те", abl: "тен", gen: "тің", ins: "пен" },
  сексен: { acc: "ді", dat: "ге", loc: "де", abl: "нен", gen: "нің", ins: "мен" },
  тоқсан: { acc: "ды", dat: "ға", loc: "да", abl: "нан", gen: "ның", ins: "мен" },
  жүз: { acc: "ді", dat: "ге", loc: "де", abl: "ден", gen: "дің", ins: "бен" },
  мың: { acc: "ды", dat: "ға", loc: "да", abl: "нан", gen: "ның", ins: "мен" },
};

const ONES = ["", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз"];
const TENS = ["", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан"];

/** Полное числительное словами (0..1999) — эталон для проверки последнего слова. */
function spoken(n: number): string[] {
  if (n === 0) return ["нөл"];
  const words: string[] = [];
  const th = Math.floor(n / 1000);
  if (th) words.push(...(th === 1 ? [] : [ONES[th]]), "мың");
  const rest = n % 1000;
  const h = Math.floor(rest / 100);
  if (h) words.push(...(h === 1 ? [] : [ONES[h]]), "жүз");
  const t = Math.floor((rest % 100) / 10);
  if (t) words.push(TENS[t]);
  const o = rest % 10;
  if (o) words.push(ONES[o]);
  return words;
}

const CASES: KkCase[] = ["acc", "dat", "loc", "abl", "gen", "ins"];

describe("kkSuffix: падежные окончания после чисел", () => {
  it("ручные проверки из ТЗ", () => {
    const cases: [number, KkCase, string][] = [
      [25, "acc", "25-ті"],
      [40, "acc", "40-ты"],
      [6, "abl", "6-дан"],
      [10, "dat", "10-ға"],
      [100, "dat", "100-ге"],
      [1000, "dat", "1000-ға"],
      [3, "dat", "3-ке"],
      [4, "dat", "4-ке"],
      [7, "dat", "7-ге"],
      [2, "dat", "2-ге"],
      [9, "dat", "9-ға"],
      [20, "dat", "20-ға"],
      [30, "dat", "30-ға"],
      [50, "dat", "50-ге"],
      [60, "dat", "60-қа"],
      [70, "dat", "70-ке"],
      [80, "dat", "80-ге"],
      [90, "dat", "90-ға"],
      [0, "abl", "0-ден"],
      [1, "dat", "1-ге"],
      [8, "ins", "8-бен"],
      [5, "ins", "5-пен"],
      [255, "gen", "255-тің"],
    ];
    for (const [n, c, want] of cases) expect(kkSuffix(n, c), `${n} ${c}`).toBe(want);
  });

  it("0..1100 для каждого падежа совпадает с эталонной таблицей", () => {
    for (let n = 0; n <= 1100; n++) {
      const last = spoken(n).at(-1)!;
      expect(kkLastWord(n), String(n)).toBe(last);
      for (const c of CASES) expect(kkSuffix(n, c), `${n} ${c}`).toBe(`${n}-${REF[last][c]}`);
    }
  });

  it("принимает строку из цифр и большие числа", () => {
    expect(kkSuffix("25", "acc")).toBe("25-ті");
    expect(kkSuffix("007", "dat")).toBe("007-ге");
    expect(kkLastWord(2_000_000)).toBe("миллион");
    expect(kkSuffix(5_000_000, "dat")).toBe("5000000-ға");
    expect(kkLastWord(1_000_000_000)).toBe("миллиард");
    expect(kkLastWord(1234)).toBe("төрт");
    // конечное «д» оглушается: миллиардқа, миллиардты, миллиардпен
    expect(kkSuffix(3_000_000_000, "dat")).toBe("3000000000-қа");
    expect(kkSuffix(3_000_000_000, "acc")).toBe("3000000000-ты");
    expect(kkSuffix(3_000_000_000, "ins")).toBe("3000000000-пен");
    expect(kkSuffix(2_000_000, "abl")).toBe("2000000-нан");
  });

  it("не числа — ошибка, а не молчаливо неверное окончание", () => {
    expect(() => kkSuffix("abc", "acc")).toThrow();
    expect(() => kkSuffix(2.5, "acc")).toThrow();
  });
});
