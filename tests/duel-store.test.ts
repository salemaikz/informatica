import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp, type DuelFinish } from "@/lib/store";
import { DUEL_WIN_XP, ENTRY_COST, FREE_PLAN, MINUTE } from "@/lib/economy";
import { XP } from "@/lib/gamification";
import { duelEntryKey } from "@/lib/entry-paid";
import { DUEL_HISTORY_MAX, botResults, duelOutcome, duelXpBase, pushDuel, sanitizeDuels, type DuelRecord } from "@/lib/duel/record";
import { ADJ_STEP } from "@/lib/duel/bot";

// Этап 16Д, Ф1: срез стора `duels` (история, «резинка» бота), recordDuel (XP с бустером, освоение, ошибки), вход 1 сердечко.

const side = (score: number, correct: number, answered = correct, timeMs = 30_000) => ({ score, correct, answered, timeMs });

const finish = (over: Partial<DuelFinish> = {}): DuelFinish => ({
  id: `d-${Math.random().toString(36).slice(2)}`,
  matchId: "bot.blitz.-.1.42",
  mode: "blitz",
  opp: "bot",
  you: side(10, 6, 7),
  rival: side(5, 4, 5),
  attempts: [
    ...Array.from({ length: 4 }, () => ({ skill: "ns.bin2dec", correct: true })),
    { skill: "ns.bin2dec", correct: false },
    { skill: "ns.dec2bin", correct: true },
    { skill: "ns.dec2bin", correct: true },
  ],
  wrong: [{ stepId: "q:bin-1", skill: "ns.bin2dec", prompt: "1011₂ = ?", given: "10", expected: "11" }],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState({ plan: FREE_PLAN, hearts: { count: 5, updatedAt: Date.now(), day: "2027-01-15" } });
});

afterEach(() => {
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("вход в дуэль: 1 сердечко один раз", () => {
  it("ENTRY_COST.duel = 1; payEntryOnce по ключу матча списывает один раз, реванш (новый ключ) — снова", () => {
    expect(ENTRY_COST.duel).toBe(1);
    const key = duelEntryKey("bot.blitz.-.1.42");
    expect(key).toBe("duel:bot.blitz.-.1.42");
    const a = useApp.getState().payEntryOnce(key, ENTRY_COST.duel);
    const b = useApp.getState().payEntryOnce(key, ENTRY_COST.duel);
    expect(a).toMatchObject({ ok: true, paid: 1 });
    expect(b).toMatchObject({ ok: true, paid: 0 });
    expect(useApp.getState().hearts.count).toBe(4);
    useApp.getState().payEntryOnce(duelEntryKey("bot.blitz.-.1.43"), ENTRY_COST.duel);
    expect(useApp.getState().hearts.count).toBe(3);
  });

  it("итог матча снимает оплаченный вход: тот же матч заново — новое сердечко", () => {
    const key = duelEntryKey("bot.blitz.-.1.42");
    useApp.getState().payEntryOnce(key, 1);
    expect(useApp.getState().entryPaid[key]).toBeDefined();
    useApp.getState().recordDuel(finish());
    expect(useApp.getState().entryPaid[key]).toBeUndefined();
    expect(useApp.getState().payEntryOnce(key, 1).paid).toBe(1);
  });

  it("не хватает сердечек — ничего не списано", () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: "2027-01-15" } });
    expect(useApp.getState().payEntryOnce(duelEntryKey("m"), 1)).toMatchObject({ ok: false, paid: 0 });
    expect(useApp.getState().entryPaid[duelEntryKey("m")]).toBeUndefined();
  });
});

describe("recordDuel", () => {
  it("победа над ботом: XP.correct за верный + 2, история, освоение, ошибка в «Ошибках», без чипов за матч", () => {
    // Дневная цель не достигается (её чипы — общее правило, не награда за матч).
    useApp.setState((st) => ({ profile: { ...st.profile, dailyGoalXp: 10_000 } }));
    const chips0 = useApp.getState().wallet.chips;
    const r = useApp.getState().recordDuel(finish());
    expect(r.result).toBe("win");
    expect(r.xp).toBe(6 * XP.correct + DUEL_WIN_XP.bot);
    expect(DUEL_WIN_XP.bot).toBe(2);
    const s = useApp.getState();
    expect(s.xp).toBe(r.xp);
    expect(s.duels.history).toHaveLength(1);
    expect(s.duels.history[0]).toMatchObject({ mode: "blitz", opp: "bot", result: "win", xp: r.xp, you: { score: 10 }, rival: { score: 5 } });
    expect(s.duels.history[0].oppName).toBeUndefined();
    // навык с ≥ 3 ответами — в освоение (как у мини-игры), с 2 ответами — нет
    expect(s.skills["ns.bin2dec"]).toBeDefined();
    expect(s.skills["ns.dec2bin"]).toBeUndefined();
    expect(s.mistakes.map((m) => m.stepId)).toEqual(["q:bin-1"]);
    expect(s.missLog["q:bin-1"].n).toBe(1);
    expect(s.wallet.chips).toBe(chips0);
    // дуэль — как игра: в точность дня не входит
    const day = Object.values(s.days)[0];
    expect(day.games).toBe(7);
    expect(day.gameCorrect).toBe(6);
    expect(day.answers).toBe(0);
  });

  it("бустер умножает опыт (#122)", () => {
    useApp.setState({ boost: { mult: 2, until: Date.now() + 15 * MINUTE } });
    const r = useApp.getState().recordDuel(finish());
    expect(r.xp).toBe(2 * (6 * XP.correct + DUEL_WIN_XP.bot));
  });

  it("поражение и ничья — без бонуса; повтор того же id ничего не начисляет", () => {
    const loss = useApp.getState().recordDuel(finish({ id: "a", you: side(2, 2), rival: side(9, 5) }));
    expect(loss).toMatchObject({ result: "loss", xp: 2 * XP.correct, duplicate: false });
    const draw = useApp.getState().recordDuel(finish({ id: "b", you: side(4, 3, 3, 20_000), rival: side(4, 3, 3, 20_500) }));
    expect(draw).toMatchObject({ result: "draw", xp: 3 * XP.correct });
    const xp = useApp.getState().xp;
    const again = useApp.getState().recordDuel(finish({ id: "a", you: side(2, 2), rival: side(9, 5) }));
    expect(again.duplicate).toBe(true);
    expect(useApp.getState().xp).toBe(xp);
    expect(useApp.getState().duels.history).toHaveLength(2);
  });

  it("«резинка»: 3 победы над ботом подряд — бот точнее на 0,05; матч с человеком её не трогает", () => {
    for (let k = 0; k < 3; k++) useApp.getState().recordDuel(finish());
    expect(useApp.getState().duels.botAdj).toBe(ADJ_STEP);
    useApp.getState().recordDuel(finish({ opp: "human", oppName: "Ерлан", oppLevel: 7 }));
    expect(useApp.getState().duels.botAdj).toBe(ADJ_STEP);
    expect(useApp.getState().duels.history[0]).toMatchObject({ opp: "human", oppName: "Ерлан", oppLevel: 7 });
    for (let k = 0; k < 3; k++) useApp.getState().recordDuel(finish({ you: side(0, 0), rival: side(5, 3) }));
    expect(useApp.getState().duels.botAdj).toBe(0);
  });

  it("история — не больше 50, новые первыми", () => {
    for (let k = 0; k < DUEL_HISTORY_MAX + 5; k++) {
      vi.setSystemTime(new Date(2027, 0, 15, 12, 0, k));
      useApp.getState().recordDuel(finish({ id: `m${k}` }));
    }
    const h = useApp.getState().duels.history;
    expect(h).toHaveLength(DUEL_HISTORY_MAX);
    expect(h[0].id).toBe(`m${DUEL_HISTORY_MAX + 4}`);
  });
});

describe("чистые функции и санитайзер", () => {
  it("duelOutcome / duelXpBase / botResults / pushDuel", () => {
    expect(duelOutcome(side(3, 3), side(2, 2))).toBe("win");
    expect(duelOutcome(side(3, 3, 3, 10_000), side(3, 3, 3, 10_400))).toBe("draw");
    expect(duelOutcome(side(-1, 0), side(0, 0))).toBe("loss");
    expect(duelXpBase(3, "win", "human")).toBe(3 * XP.correct + DUEL_WIN_XP.human);
    expect(duelXpBase(-2, "loss", "bot")).toBe(0);
    const rec = (id: string, result: DuelRecord["result"], opp: DuelRecord["opp"] = "bot"): DuelRecord => ({
      id, at: 1, mode: "ten", opp, result, you: side(1, 1), rival: side(0, 0), xp: 0,
    });
    const h = pushDuel(pushDuel(pushDuel([], rec("a", "win")), rec("b", "loss", "human")), rec("c", "draw"));
    expect(h.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(botResults(h)).toEqual(["win", "draw"]);
    expect(pushDuel(h, rec("b", "win")).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sanitizeDuels: мусор отбрасывается, повторы id убираются, botAdj в пределах ±0,1, у бота имени нет", () => {
    const good = { id: "x", at: 5, mode: "blitz", opp: "bot", oppName: "Хакер", result: "win", you: side(3, 2), rival: side(1, 1), xp: 22 };
    const out = sanitizeDuels({
      history: [good, { ...good }, { ...good, id: "y", mode: "chess" }, { ...good, id: "z", result: "lost" }, null, 7, { ...good, id: "w", at: 9, you: { score: "1" } }, { ...good, id: "v", at: 7, topic: "t03" }],
      botAdj: 5,
    });
    expect(out.history.map((r) => r.id)).toEqual(["v", "x"]);
    expect(out.history[1].oppName).toBeUndefined();
    expect(out.history[0].topic).toBe("t03");
    expect(out.botAdj).toBe(0.1);
    expect(sanitizeDuels(null)).toEqual({ history: [], botAdj: 0 });
    expect(sanitizeDuels({ botAdj: Number.NaN, history: "x" })).toEqual({ history: [], botAdj: 0 });
  });

  it("mergeState: срез duels проходит санитайзер; старое сохранение без поля — пустой срез", () => {
    const cur = useApp.getState();
    expect(mergeState({}, cur).duels).toEqual({ history: [], botAdj: 0 });
    const m = mergeState({ duels: { history: [{ id: "x", at: 1, mode: "ten", opp: "bot", result: "loss", you: side(1, 1), rival: side(2, 2) }], botAdj: -0.05 } }, cur);
    expect(m.duels.history).toHaveLength(1);
    expect(m.duels.history[0].xp).toBe(0);
    expect(m.duels.botAdj).toBe(-0.05);
  });
});
