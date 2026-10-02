import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { buildExam, scoreExam, type ExamAnswers } from "@/lib/exam";
import { buildPrintPaper, contextStart, keyRows, keyTotal, parsePrintParams, printLink } from "@/components/exam/print-logic";
import { correctIndexes } from "@/components/exam/logic";

describe("печать варианта: параметры", () => {
  it("kind, seed, темы, язык", () => {
    expect(parsePrintParams({ kind: "full", seed: "123", lang: "kk" })).toEqual({ kind: "full", seed: 123, topics: [], lang: "kk" });
    expect(parsePrintParams({})).toEqual({ kind: "mini", seed: null, topics: [], lang: null });
    expect(parsePrintParams({ kind: "hack", seed: "x", lang: "en" })).toEqual({ kind: "mini", seed: null, topics: [], lang: null });
    expect(parsePrintParams({ kind: "topic", seed: "1", topics: "t04,t05,bad" }).topics).toEqual(["t04", "t05"]);
    expect(parsePrintParams({ kind: "mini", seed: "1", topics: "t04" }).topics).toEqual([]);
    expect(parsePrintParams({ seed: "99999999999" }).seed).toBeNull();
  });

  it("printLink разбирается обратно", () => {
    const p = { kind: "topic" as const, seed: 7, topics: ["t04" as const], lang: null };
    const sp = Object.fromEntries(new URL(printLink(p, "kk"), "http://x").searchParams);
    expect(parsePrintParams(sp)).toEqual({ ...p, lang: "kk" });
  });
});

describe("печать варианта: тот же вариант, что и в /exam/run", () => {
  it("одинаковый seed и параметры — одинаковые задания и порядок", () => {
    for (const kind of ["mini", "full"] as const) {
      const a = buildPrintPaper({ kind, seed: 4242, topics: [], lang: null });
      const b = buildExam({ kind, seed: 4242, pool: ENT_POOL, topics: [] });
      expect(a).toEqual(b);
    }
    const a = buildPrintPaper({ kind: "topic", seed: 5, topics: ["t04", "t05"], lang: null });
    expect(a).toEqual(buildExam({ kind: "topic", seed: 5, pool: ENT_POOL, topics: ["t04", "t05"] }));
  });
});

describe("печать варианта: ключ ответов", () => {
  const paper = buildPrintPaper({ kind: "full", seed: 99, topics: [], lang: null });

  it("строк столько же, сколько заданий; сумма баллов равна максимуму варианта", () => {
    const rows = keyRows(paper, "ru");
    expect(rows).toHaveLength(paper.items.length);
    expect(rows.map((r) => r.n)).toEqual(paper.items.map((_, i) => i + 1));
    expect(keyTotal(rows)).toBe(paper.maxPoints);
  });

  it("ключ — это ответы, которые код засчитывает на максимум", () => {
    const answers: ExamAnswers = {};
    for (const q of paper.items) {
      const it = q.item;
      if (it.kind === "match") answers[q.key] = { match: [...it.answer], timeMs: 0 };
      else if (it.kind === "multi") answers[q.key] = { multi: [...it.correct], timeMs: 0 };
      else answers[q.key] = { choice: correctIndexes(q)[0], timeMs: 0 };
    }
    expect(scoreExam(paper, answers).points).toBe(paper.maxPoints);
    // и текст ключа содержит буквы верных вариантов
    const rows = keyRows(paper, "ru");
    paper.items.forEach((q, i) => {
      if (q.item.kind === "multi") expect(rows[i].answer).toBe(q.item.correct.map((c) => "ABCDEF"[c]).join(", "));
      if (q.item.kind === "match") expect(rows[i].answer).toContain("A–");
      if (q.item.kind === "single") expect(rows[i].answer.startsWith(`${"ABCDEF"[q.item.correct]})`)).toBe(true);
    });
  });

  it("ключ на двух языках различается только текстом вариантов", () => {
    const ru = keyRows(paper, "ru");
    const kk = keyRows(paper, "kk");
    expect(kk.map((r) => r.max)).toEqual(ru.map((r) => r.max));
    expect(kk.map((r) => r.answer[0])).toEqual(ru.map((r) => r.answer[0]));
  });

  it("контекстное задание: диапазон вопросов только у первого", () => {
    const first = paper.items.findIndex((q) => q.item.kind === "context");
    expect(first).toBeGreaterThanOrEqual(0);
    const r = contextStart(paper.items, first);
    expect(r).toEqual({ from: first + 1, to: first + 5 });
    expect(contextStart(paper.items, first + 1)).toBeNull();
    expect(contextStart(paper.items, 0)).toBeNull();
  });
});
