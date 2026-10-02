import { describe, expect, it } from "vitest";
import { hasShape } from "@/lib/bank";
import type { GameMode } from "@/games/types";
import {
  BLITZ_MS,
  DEFAULT_SKILLS,
  EXTRA_PENALTY,
  MIN_PAIRS,
  MODE_CONFIG,
  PAIRS_PER_ROUND,
  PERFECT_BONUS,
  MemoEngine,
  cardTextClass,
  columnsFor,
  isFormula,
  levelsForRound,
  meaningKeys,
  numericValue,
  pairPoints,
  pickRoundPairs,
  resolveSkills,
  roundLimitMs,
  textKey,
} from "@/games/memo/logic";
import { S } from "@/games/memo/strings";

const MODES: GameMode[] = ["calm", "normal", "blitz"];

/** Индексы карточек поля по паре: [левая, правая]. */
function indexOfPairs(e: MemoEngine): Map<number, [number, number]> {
  // порядок — по номеру пары в раунде
  const res = new Map<number, [number, number]>();
  e.view().forEach((c, i) => {
    const cur = res.get(c.pairIndex) ?? [-1, -1];
    cur[c.side === "left" ? 0 : 1] = i;
    res.set(c.pairIndex, cur);
  });
  return new Map([...res.entries()].sort((x, y) => x[0] - y[0]));
}

function solveClean(e: MemoEngine) {
  for (const [a, b] of indexOfPairs(e).values()) {
    e.flip(a);
    e.flip(b);
  }
}

describe("memo: настройки темпа", () => {
  it("calm — 1 раунд без таймера, normal — 2 раунда, blitz — 90 с", () => {
    expect(MODE_CONFIG.calm.rounds).toBe(1);
    expect(MODE_CONFIG.calm.clockMs).toBeNull();
    expect(MODE_CONFIG.calm.perPairMs).toBeNull();
    expect(MODE_CONFIG.normal.rounds).toBe(2);
    expect(MODE_CONFIG.blitz.rounds).toBeNull();
    expect(MODE_CONFIG.blitz.clockMs).toBe(BLITZ_MS);
    expect(BLITZ_MS).toBe(90_000);
  });

  it("мягкое время normal — по уровню 30/45/60 с на пару, в calm/blitz лимита раунда нет", () => {
    const pairs = [1, 2, 3].map((level) => ({
      id: `x${level}`,
      skill: "s",
      level: level as 1 | 2 | 3,
      left: `l${level}`,
      right: `r${level}`,
    }));
    expect(roundLimitMs("normal", pairs)).toBe(135_000);
    expect(roundLimitMs("calm", pairs)).toBeNull();
    expect(roundLimitMs("blitz", pairs)).toBeNull();
  });

  it("уровни: calm A–C, normal и blitz — сначала A–B, потом B–C", () => {
    expect(levelsForRound("calm", 0)).toEqual({ min: 1, max: 3 });
    expect(levelsForRound("normal", 0)).toEqual({ min: 1, max: 2 });
    expect(levelsForRound("normal", 1)).toEqual({ min: 2, max: 3 });
    expect(levelsForRound("blitz", 5)).toEqual({ min: 2, max: 3 });
  });

  it("очки за пару растут с уровнем", () => {
    expect([1, 2, 3].map((l) => pairPoints("calm", l as 1 | 2 | 3))).toEqual([10, 15, 20]);
  });
});

describe("memo: колода пар", () => {
  it("навыки по умолчанию умеют форму pair; пустой список props → по умолчанию", () => {
    expect(DEFAULT_SKILLS.every((s) => hasShape(s, "pair"))).toBe(true);
    expect(resolveSkills([])).toEqual(resolveSkills(undefined));
    expect(resolveSkills(["нет.такого"])).toEqual([]);
  });

  it("6 пар без повторов; тексты на карточках различны", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pairs = pickRoundPairs({ pool: DEFAULT_SKILLS, count: PAIRS_PER_ROUND, seed, minLevel: 1, maxLevel: 3 });
      expect(pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS);
      const texts = pairs.flatMap((p) => [textKey(p.left), textKey(p.right)]);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("numericValue: одно число в разных записях даёт одно значение", () => {
    expect(numericValue("1011₂")).toBe(11);
    expect(numericValue("B₁₆")).toBe(11);
    expect(numericValue("11₁₀")).toBe(11);
    expect(numericValue("11")).toBe(11);
    expect(numericValue("2³")).toBe(8);
    expect(numericValue("2¹⁰")).toBe(1024);
    expect(numericValue("1012₂")).toBeNull(); // нет такой цифры в системе
    expect(numericValue("Двоичная")).toBeNull();
    expect(numericValue("0–9, A–F")).toBeNull();
    expect(meaningKeys({ ru: "Двоичная", kk: "Екілік" })).toEqual(["t:двоичная", "t:екілік"]);
  });

  it("на поле нет двух разных пар с совпадающим смыслом (B₁₆ и 1011₂ — обе 11)", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [minLevel, maxLevel] of [[1, 3], [1, 2], [2, 3]] as const) {
        const pairs = pickRoundPairs({ pool: DEFAULT_SKILLS, count: PAIRS_PER_ROUND, seed, minLevel, maxLevel });
        const owner = new Map<string, number>();
        pairs.forEach((p, i) => {
          for (const k of [...meaningKeys(p.left), ...meaningKeys(p.right)]) {
            expect(owner.get(k) ?? i, `${seed}: ${k}`).toBe(i);
            owner.set(k, i);
          }
        });
      }
    }
  });

  it("обычно набирается полное поле из 6 пар", () => {
    let full = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const pairs = pickRoundPairs({ pool: DEFAULT_SKILLS, count: PAIRS_PER_ROUND, seed, minLevel: 1, maxLevel: 2 });
      if (pairs.length === PAIRS_PER_ROUND) full++;
    }
    expect(full).toBeGreaterThanOrEqual(38);
  });

  it("exclude исключает уже сыгранные пары", () => {
    const first = pickRoundPairs({ pool: DEFAULT_SKILLS, count: 6, seed: 7, minLevel: 1, maxLevel: 2 });
    const used = new Set(first.map((p) => `${textKey(p.left)}→${textKey(p.right)}`));
    const second = pickRoundPairs({ pool: DEFAULT_SKILLS, count: 6, seed: 7, minLevel: 1, maxLevel: 2, exclude: used });
    for (const p of second) expect(used.has(`${textKey(p.left)}→${textKey(p.right)}`)).toBe(false);
  });

  it("при пустом пуле — пустой результат", () => {
    expect(pickRoundPairs({ pool: [], count: 6, seed: 1, minLevel: 1, maxLevel: 3 })).toEqual([]);
  });
});

describe("memo: переворот и пары", () => {
  it("поле: каждая пара — левая и правая карточка, всего 12", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    expect(e.active).toBe(true);
    const view = e.view();
    expect(view.length).toBe(e.pairCount * 2);
    for (const [l, r] of indexOfPairs(e).values()) {
      expect(view[l].side).toBe("left");
      expect(view[r].side).toBe("right");
    }
    expect(view.every((c) => c.status === "down")).toBe(true);
  });

  it("верная пара остаётся открытой и даёт очки", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const [l, r] = [...indexOfPairs(e).values()][0];
    expect(e.flip(l).kind).toBe("first");
    const res = e.flip(r);
    expect(res.kind).toBe("match");
    expect(e.score).toBeGreaterThan(0);
    expect(e.view()[l].status).toBe("matched");
    expect(e.view()[r].status).toBe("matched");
    expect(e.foundCount).toBe(1);
  });

  it("неверная пара подсвечивается как miss и закрывается через closeMiss", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    const res = e.flip(pairs[1][1]);
    expect(res.kind).toBe("miss");
    expect(e.hasPendingMiss).toBe(true);
    expect(e.view()[pairs[0][0]].status).toBe("miss");
    e.closeMiss();
    expect(e.hasPendingMiss).toBe(false);
    expect(e.view()[pairs[0][0]].status).toBe("down");
    e.closeMiss(); // повторный вызов безопасен
  });

  it("две левые карточки — не пара", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    expect(e.flip(pairs[1][0]).kind).toBe("miss");
  });

  it("повторное нажатие на открытую или найденную карточку игнорируется", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const [l, r] = [...indexOfPairs(e).values()][0];
    e.flip(l);
    expect(e.flip(l).kind).toBe("ignored");
    e.flip(r);
    expect(e.flip(l).kind).toBe("ignored");
    expect(e.flip(99).kind).toBe("ignored");
  });

  it("нажатие во время «паузы» после ошибки закрывает пару и открывает новую карточку", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    e.flip(pairs[1][1]);
    expect(e.flip(pairs[2][0]).kind).toBe("first");
    expect(e.hasPendingMiss).toBe(false);
    expect(e.view()[pairs[0][0]].status).toBe("down");
    expect(e.view()[pairs[2][0]].status).toBe("up");
  });
});

describe("memo: ошибки, очки и attempts", () => {
  it("первая ошибка на двух новых карточках — не «лишняя», штрафа нет", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    const res = e.flip(pairs[1][1]);
    expect(res).toEqual({ kind: "miss", extra: false, penalty: 0 });
    expect(e.score).toBe(0);
  });

  it("ошибка на уже виденной карточке — «лишняя»: штраф, очки не ниже 0", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    e.flip(pairs[1][1]); // обе новые
    e.closeMiss();
    e.flip(pairs[0][0]);
    const res = e.flip(pairs[2][1]); // pairs[0][0] уже видели
    expect(res.kind).toBe("miss");
    if (res.kind === "miss") {
      expect(res.extra).toBe(true);
      expect(res.penalty).toBe(0); // счёт был 0 — ниже нуля не уходим
    }
    expect(e.score).toBe(0);
    e.closeMiss();
    // найдём одну пару и ошибёмся ещё раз: штраф вычитается из набранного
    e.flip(pairs[3][0]);
    e.flip(pairs[3][1]);
    const before = e.score;
    e.flip(pairs[0][0]);
    const again = e.flip(pairs[2][1]);
    expect(again.kind === "miss" && again.extra).toBe(true);
    expect(e.score).toBe(before - EXTRA_PENALTY);
    expect(e.score).toBeGreaterThanOrEqual(0);
  });

  it("забытая пара: открыта новая карточка, её пару уже видели, а открыта другая — «лишняя» ошибка", () => {
    const e = new MemoEngine({ mode: "calm", seed: 5 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][1]);
    e.flip(pairs[1][1]); // разведка: обе новые
    e.closeMiss();
    e.flip(pairs[0][0]); // новая, но её пару (pairs[0][1]) уже видели
    const res = e.flip(pairs[2][0]); // тоже новая
    expect(res.kind === "miss" && res.extra).toBe(true);
    e.closeMiss();
    solveClean(e);
    const sum = e.finishRound();
    expect(sum.pairs[0].outcome).toBe("missed");
    expect(sum.pairs[1].outcome).toBe("clean");
    expect(sum.pairs[2].outcome).toBe("clean");
    expect(sum.extraMisses).toBe(1);
  });

  it("чистый раунд: все attempts верны, бонус, total = число пар", () => {
    const e = new MemoEngine({ mode: "calm", seed: 11 });
    solveClean(e);
    expect(e.roundComplete).toBe(true);
    const sum = e.finishRound();
    expect(sum.perfect).toBe(true);
    expect(sum.bonus).toBe(PERFECT_BONUS);
    expect(sum.pairs.every((p) => p.outcome === "clean")).toBe(true);
    const r = e.result();
    expect(r.total).toBe(e.pairCount);
    expect(r.correct).toBe(e.pairCount);
    expect(r.attempts.every((a) => a.correct)).toBe(true);
  });

  it("пара, найденная после ошибки на её карточке, засчитывается как неверная", () => {
    const e = new MemoEngine({ mode: "calm", seed: 11 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    e.flip(pairs[1][1]); // новые
    e.closeMiss();
    e.flip(pairs[0][0]);
    e.flip(pairs[2][1]); // pairs[0][0] виденная → пара 0 помечена, pairs[2][1] — новая (но в miss отмечена seen)
    e.closeMiss();
    for (const [a, b] of pairs) {
      e.flip(a);
      e.flip(b);
      e.closeMiss();
    }
    solveClean(e);
    const sum = e.finishRound();
    expect(sum.perfect).toBe(false);
    expect(sum.extraMisses).toBeGreaterThan(0);
    const byOutcome = sum.pairs.map((p) => p.outcome);
    expect(byOutcome[0]).toBe("missed");
    expect(e.result().correct).toBeLessThan(e.result().total);
  });

  it("конец времени раунда (normal): ненайденные пары — ошибки, разбор показывает notFound", () => {
    const e = new MemoEngine({ mode: "normal", seed: 3 });
    const pairs = [...indexOfPairs(e).values()];
    e.flip(pairs[0][0]);
    e.flip(pairs[0][1]);
    const sum = e.timeoutRound();
    expect(sum.timedOut).toBe(true);
    expect(sum.perfect).toBe(false);
    expect(sum.pairs.filter((p) => p.outcome === "notFound").length).toBe(e.pairCount - 1);
    const r = e.result();
    expect(r.total).toBe(e.pairCount);
    expect(r.correct).toBe(1);
  });

  it("после конца раунда ходы игнорируются", () => {
    const e = new MemoEngine({ mode: "calm", seed: 3 });
    solveClean(e);
    e.finishRound();
    expect(e.active).toBe(false);
    expect(e.flip(0).kind).toBe("ignored");
  });
});

describe("memo: раунды по режимам", () => {
  it("calm: один раунд, второго нет", () => {
    const e = new MemoEngine({ mode: "calm", seed: 9 });
    solveClean(e);
    e.finishRound();
    expect(e.moreRounds).toBe(false);
    expect(e.nextRound()).toBe(false);
  });

  it("normal: два раунда с разными парами", () => {
    const e = new MemoEngine({ mode: "normal", seed: 9 });
    const first = new Set(e.view().map((c) => textKey(c.text)));
    solveClean(e);
    e.finishRound();
    expect(e.moreRounds).toBe(true);
    expect(e.nextRound()).toBe(true);
    expect(e.round).toBe(2);
    expect(e.roundLimit).not.toBeNull();
    const second = e.view().map((c) => textKey(c.text));
    // пары не повторяются целиком
    const overlap = second.filter((t) => first.has(t)).length;
    expect(overlap).toBeLessThan(second.length);
    solveClean(e);
    e.finishRound();
    expect(e.nextRound()).toBe(false);
    expect(e.roundsCleared).toBe(2);
  });

  it("blitz: раундов сколько успеешь, пока в банке есть новые пары", () => {
    const e = new MemoEngine({ mode: "blitz", seed: 9 });
    let rounds = 0;
    while (e.active && rounds < 50) {
      solveClean(e);
      e.finishRound();
      rounds++;
      if (!e.nextRound()) break;
    }
    expect(rounds).toBeGreaterThanOrEqual(2);
    expect(e.roundsCleared).toBe(rounds);
    expect(e.result().total).toBeGreaterThanOrEqual(rounds * MIN_PAIRS);
  });

  it("blitz: пары в раундах не повторяются", () => {
    const e = new MemoEngine({ mode: "blitz", seed: 21 });
    const seen = new Set<string>();
    for (let i = 0; i < 4 && e.active; i++) {
      const byPair = new Map<number, string[]>();
      for (const c of e.view()) byPair.set(c.pairIndex, [...(byPair.get(c.pairIndex) ?? []), textKey(c.text)]);
      for (const texts of byPair.values()) {
        const key = texts.sort().join("↔");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      solveClean(e);
      e.finishRound();
      if (!e.nextRound()) break;
    }
  });

  it("нет навыков с формой pair — раунда нет, результат нулевой", () => {
    for (const mode of MODES) {
      const e = new MemoEngine({ mode, seed: 1, skills: ["нет.такого"] });
      // «нет.такого» отфильтруется → навыки по умолчанию не подставляются из-за непустого списка
      expect(e.active).toBe(false);
      expect(e.result()).toEqual({ score: 0, correct: 0, total: 0, attempts: [] });
    }
  });

  it("свои навыки из props ограничивают пары этими навыками", () => {
    const e = new MemoEngine({ mode: "calm", seed: 4, skills: ["ns.base"] });
    expect(e.pool).toEqual(["ns.base"]);
    expect(e.active).toBe(true);
    solveClean(e);
    e.finishRound();
    expect(e.result().attempts.every((a) => a.skill === "ns.base")).toBe(true);
  });
});

describe("memo: вёрстка и тексты", () => {
  it("колонки: 4 для обычного поля, 3 для малого", () => {
    expect(columnsFor(6)).toBe(4);
    expect(columnsFor(4)).toBe(4);
    expect(columnsFor(3)).toBe(3);
  });

  it("isFormula: числа и системы — моноширинные, слова — нет", () => {
    expect(isFormula("1011₂")).toBe(true);
    expect(isFormula("25")).toBe(true);
    expect(isFormula("Двоичная")).toBe(false);
    expect(isFormula("Ағымдағы")).toBe(false);
    expect(isFormula("D₁₆")).toBe(true);
    expect(isFormula("1A₁₆")).toBe(true);
  });

  it("размер шрифта уменьшается с длиной", () => {
    expect(cardTextClass("11", true)).toBe("text-xl");
    expect(cardTextClass("1011011101₂", true)).toBe("text-[11px]");
    expect(cardTextClass("Да", false)).toBe("text-base");
  });

  it("все строки игры двуязычные", () => {
    for (const [key, v] of Object.entries(S)) {
      expect(v.ru.trim(), key).not.toBe("");
      expect(v.kk.trim(), key).not.toBe("");
    }
  });
});
