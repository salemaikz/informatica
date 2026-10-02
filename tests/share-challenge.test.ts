import { describe, expect, it } from "vitest";
import { cleanName, compareWithChallenge, decodeChallenge, encodeChallenge, sanitizeChallenge, withChallenge } from "@/lib/challenge";
import { examLink, parseRunParams } from "@/components/exam/logic";
import { sanitizeState } from "@/lib/exam-store";
import { buildExam } from "@/lib/exam";
import { ENT_POOL } from "@/content/ent";

describe("challenge: кодирование", () => {
  it("туда и обратно, включая кириллицу и казахские буквы", () => {
    for (const n of ["Айжан", "Әлихан Ұлы", "Ann"]) {
      const ch = encodeChallenge({ n, s: 14, m: 19 });
      expect(ch).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeChallenge(ch)).toEqual({ n, s: 14, m: 19 });
    }
  });

  it("имя обрезается до 20 символов (по символам, не по байтам)", () => {
    const long = "Ә".repeat(30);
    expect(cleanName(long)).toHaveLength(20);
    expect(decodeChallenge(encodeChallenge({ n: long, s: 1, m: 2 }))?.n).toBe("Ә".repeat(20));
  });

  it("имя: управляющие символы и теги заменяются пробелами, пустое имя — аноним, не строка — отказ", () => {
    expect(cleanName("  A\u0000\n B<script>  ")).toBe("A B script");
    expect(sanitizeChallenge({ n: "   ", s: 1, m: 2 })).toEqual({ n: "", s: 1, m: 2 });
    expect(decodeChallenge(encodeChallenge({ n: "", s: 3, m: 5 }))).toEqual({ n: "", s: 3, m: 5 });
    expect(sanitizeChallenge({ n: 5, s: 1, m: 2 })).toBeNull();
    expect(sanitizeChallenge({ s: 1, m: 2 })).toBeNull();
  });

  it("числа: целые, 0 ≤ s ≤ m ≤ 200", () => {
    expect(sanitizeChallenge({ n: "A", s: 0, m: 1 })).toEqual({ n: "A", s: 0, m: 1 });
    for (const bad of [
      { n: "A", s: -1, m: 5 },
      { n: "A", s: 6, m: 5 },
      { n: "A", s: 1.5, m: 5 },
      { n: "A", s: 1, m: 0 },
      { n: "A", s: 1, m: 201 },
      { n: "A", s: "1", m: 5 },
      { n: "A", s: NaN, m: 5 },
      { n: "A", s: Infinity, m: Infinity },
    ])
      expect(sanitizeChallenge(bad)).toBeNull();
    expect(encodeChallenge({ n: "A", s: 9, m: 5 })).toBeNull();
  });

  it("мусор из адреса не ломает разбор", () => {
    for (const raw of [undefined, null, "", "!!!", "abc", "e30", "x".repeat(500), "%%%"]) expect(decodeChallenge(raw)).toBeNull();
    // base64url от не-JSON и от «чужого» JSON
    const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallenge(b64("not json"))).toBeNull();
    expect(decodeChallenge(b64(JSON.stringify({ n: "A", s: 99, m: 5 })))).toBeNull();
    expect(decodeChallenge(b64(JSON.stringify([1, 2])))).toBeNull();
    // лишние поля отбрасываются
    expect(decodeChallenge(b64(JSON.stringify({ n: "A", s: 1, m: 5, evil: "x" })))).toEqual({ n: "A", s: 1, m: 5 });
  });

  it("примеры из ТЗ: «У Айжан: 14 из 19»", () => {
    expect(decodeChallenge(encodeChallenge({ n: "Айжан", s: 14, m: 19 }))).toEqual({ n: "Айжан", s: 14, m: 19 });
  });
});

describe("challenge: ссылки и хранение", () => {
  it("examLink добавляет ch, parseRunParams его не ломает", () => {
    const link = examLink("mini", 42, [], { n: "Айжан", s: 14, m: 19 });
    expect(link).toMatch(/^\/exam\/run\?kind=mini&seed=42&ch=[A-Za-z0-9_-]+$/);
    const sp = Object.fromEntries(new URL(link, "http://x").searchParams);
    expect(parseRunParams(sp)).toEqual({ kind: "mini", seed: 42, topics: [] });
    expect(decodeChallenge(sp.ch)).toEqual({ n: "Айжан", s: 14, m: 19 });
    expect(examLink("mini", 42)).toBe("/exam/run?kind=mini&seed=42");
  });

  it("негодный вызов не попадает в ссылку", () => {
    expect(withChallenge("/exam/run?kind=mini&seed=1", { n: "A", s: 9, m: 5 })).toBe("/exam/run?kind=mini&seed=1");
  });

  it("sanitizeState сохраняет проверенный вызов и отбрасывает битый", () => {
    const paper = buildExam({ kind: "mini", seed: 1, pool: ENT_POOL });
    const base = { id: "ex-1", answers: {}, current: 0, startedAt: 1, elapsedMs: 0 };
    expect(sanitizeState({ ...base, challenge: { n: "A", s: 3, m: 9, x: 1 } }, paper)?.challenge).toEqual({ n: "A", s: 3, m: 9 });
    expect(sanitizeState({ ...base, challenge: { n: "A", s: 30, m: 9 } }, paper)?.challenge).toBeUndefined();
    expect(sanitizeState(base, paper)?.challenge).toBeUndefined();
  });
});

describe("challenge: сравнение", () => {
  const ch = { n: "A", s: 14, m: 19 };
  it("один вариант — по баллам", () => {
    expect(compareWithChallenge(15, 19, ch)).toEqual({ outcome: "more", diff: 1, samePaper: true });
    expect(compareWithChallenge(14, 19, ch).outcome).toBe("same");
    expect(compareWithChallenge(10, 19, ch)).toEqual({ outcome: "less", diff: -4, samePaper: true });
  });
  it("разные максимумы — по доле", () => {
    const r = compareWithChallenge(20, 20, ch);
    expect(r.samePaper).toBe(false);
    expect(r.outcome).toBe("more");
    expect(compareWithChallenge(0, 0, ch).outcome).toBe("less");
  });
});
