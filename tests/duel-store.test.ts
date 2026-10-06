import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp, type DuelFinish } from "@/lib/store";
import { DUEL_WIN_XP, ENTRY_COST, FREE_PLAN, MINUTE } from "@/lib/economy";
import { GAME_XP } from "@/lib/games";
import { duelEntryKey } from "@/lib/entry-paid";
import {
  DUEL_HISTORY_MAX,
  DUEL_MISTAKES_MAX,
  botResults,
  duelOutcome,
  duelXpAnswers,
  duelXpBase,
  pickDuelMistakes,
  pushDuel,
  sanitizeDuels,
  type DuelRecord,
} from "@/lib/duel/record";
import { DUEL_MODES } from "@/lib/duel/modes";
import type { DuelModeId } from "@/lib/duel/types";
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
  it("победа над ботом: опыт как у мини-игры + 2, история, освоение, ошибка в «Ошибках», без чипов за матч", () => {
    // Дневная цель не достигается (её чипы — общее правило, не награда за матч).
    useApp.setState((st) => ({ profile: { ...st.profile, dailyGoalXp: 10_000 } }));
    const chips0 = useApp.getState().wallet.chips;
    const r = useApp.getState().recordDuel(finish());
    expect(r.result).toBe("win");
    expect(r.xp).toBe(6 * GAME_XP.perCorrect + DUEL_WIN_XP.bot);
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
    expect(r.xp).toBe(2 * (6 * GAME_XP.perCorrect + DUEL_WIN_XP.bot));
  });

  it("поражение и ничья — без бонуса; повтор того же id ничего не начисляет", () => {
    const loss = useApp.getState().recordDuel(finish({ id: "a", you: side(2, 2), rival: side(9, 5) }));
    expect(loss).toMatchObject({ result: "loss", xp: 2 * GAME_XP.perCorrect, duplicate: false });
    const draw = useApp.getState().recordDuel(finish({ id: "b", you: side(4, 3, 3, 20_000), rival: side(4, 3, 3, 20_500) }));
    expect(draw).toMatchObject({ result: "draw", xp: 3 * GAME_XP.perCorrect });
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

  it("ошибки матча: в «Ошибки» не больше DUEL_MISTAKES_MAX, разные навыки первыми; ошибки уроков не вытесняются", () => {
    const lesson = Array.from({ length: 10 }, (_, k) => ({ id: `L${k}`, stepId: `lesson-step-${k}`, skill: "ns.bin2dec", prompt: "p", given: "a", expected: "b", at: 1, misses: 1 }));
    useApp.setState({ mistakes: lesson });
    const wrong = Array.from({ length: 25 }, (_, k) => ({ stepId: `st:${k}`, skill: k % 2 ? "ns.dec2bin" : k % 3 ? "ns.add" : "ns.bin2dec", prompt: `p${k}`, given: "x", expected: "y" }));
    useApp.getState().recordDuel(finish({ mode: "truth", wrong }));
    useApp.getState().recordDuel(finish({ mode: "truth", wrong: wrong.map((w) => ({ ...w, stepId: `${w.stepId}b` })) }));
    const s = useApp.getState();
    const fromDuels = s.mistakes.filter((m) => m.stepId.startsWith("st:"));
    expect(fromDuels).toHaveLength(2 * DUEL_MISTAKES_MAX);
    expect(s.mistakes.filter((m) => m.stepId.startsWith("lesson-step-"))).toHaveLength(10);
    // первый матч: три разных навыка
    expect(new Set(fromDuels.slice(DUEL_MISTAKES_MAX).map((m) => m.skill)).size).toBe(3);
  });

  it("pickDuelMistakes: без повторов задания, разные навыки первыми, порядок матча", () => {
    const w = (stepId: string, skill: string) => ({ stepId, skill, prompt: "p", given: "a", expected: "b" });
    const out = pickDuelMistakes([w("a", "s1"), w("a", "s1"), w("b", "s1"), w("c", "s2"), w("d", "s1"), w("e", "s3")]);
    expect(out.map((x) => x.stepId)).toEqual(["a", "c", "e"]);
    expect(pickDuelMistakes([w("a", "s1"), w("b", "s1"), w("c", "s1"), w("d", "s1")]).map((x) => x.stepId)).toEqual(["a", "b", "c"]);
    expect(pickDuelMistakes([])).toEqual([]);
  });

  it("нажатия наугад не дают опыта больше мини-игры (блиц, «верю — не верю»)", () => {
    // Наугад: в «верю — не верю» половина верных, в блице — четверть; ответ раз в ~1,5 с плюс пауза после ошибки.
    const tapper = (mode: DuelModeId, pRight: number, seed: number) => {
      let x = seed;
      const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
      const { clockMs, errorPauseMs, pts } = DUEL_MODES[mode];
      let t = 0, correct = 0, answered = 0, score = 0;
      while (t < clockMs!) {
        t += 600;
        const ok = rnd() < pRight;
        answered++;
        if (ok) correct++;
        score += ok ? pts.ok : pts.bad;
        if (!ok) t += errorPauseMs;
      }
      return side(score, correct, answered, clockMs!);
    };
    for (let k = 0; k < 20; k++) {
      for (const [mode, p] of [["truth", 0.5], ["blitz", 0.25]] as const) {
        useApp.getState().resetProgress();
        useApp.setState({ boost: null });
        const r = useApp.getState().recordDuel(finish({ mode, you: tapper(mode, p, 7 + k), rival: side(30, 30, 30) }));
        expect(r.result).toBe("loss");
        expect(r.xp).toBeLessThanOrEqual(GAME_XP.cap);
      }
    }
    // средний случай «верю — не верю» наугад — почти без опыта
    const r = useApp.getState().recordDuel(finish({ mode: "truth", you: side(0, 14, 29), rival: side(20, 22, 24) }));
    expect(r.xp).toBe(0);
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
    expect(duelXpBase("ten", side(3, 3), "win", "human")).toBe(3 * GAME_XP.perCorrect + DUEL_WIN_XP.human);
    expect(duelXpBase("blitz", side(-2, 4, 14), "loss", "bot")).toBe(0);
    // «10 вопросов»: все верные; часы: не больше очков со штрафом; потолок — как у мини-игры
    expect(duelXpAnswers("ten", side(7, 7, 10))).toBe(7);
    expect(duelXpAnswers("truth", side(22, 25, 28))).toBe(22);
    expect(duelXpAnswers("blitz", side(38, 20, 22))).toBe(20);
    expect(duelXpBase("blitz", side(60, 30, 30), "win", "bot")).toBe(GAME_XP.cap + DUEL_WIN_XP.bot);
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
    expect(sanitizeDuels(null)).toEqual({ history: [], botAdj: 0, hiddenNames: [] });
    expect(sanitizeDuels({ botAdj: Number.NaN, history: "x" })).toEqual({ history: [], botAdj: 0, hiddenNames: [] });
  });

  it("mergeState: срез duels проходит санитайзер; старое сохранение без поля — пустой срез", () => {
    const cur = useApp.getState();
    expect(mergeState({}, cur).duels).toEqual({ history: [], botAdj: 0, hiddenNames: [] });
    const m = mergeState({ duels: { history: [{ id: "x", at: 1, mode: "ten", opp: "bot", result: "loss", you: side(1, 1), rival: side(2, 2) }], botAdj: -0.05 } }, cur);
    expect(m.duels.history).toHaveLength(1);
    expect(m.duels.history[0].xp).toBe(0);
    expect(m.duels.botAdj).toBe(-0.05);
  });
});

describe("адрес матча и отметки перезагрузки (lib/duel/api.ts)", () => {
  it("parseDuelSeed / duelPlayHref с entry / duelPlayed по префиксу id матча", async () => {
    const { duelPlayHref, duelPlayId, duelPlayed, parseDuelSeed } = await import("@/lib/duel/api");
    expect(parseDuelSeed("42")).toBe(42);
    expect(parseDuelSeed("4294967296")).toBeNull();
    expect(parseDuelSeed("-1")).toBeNull();
    expect(parseDuelSeed(undefined)).toBeNull();
    expect(duelPlayHref("blitz", 7)).toBe("/duel/play?mode=blitz&seed=7");
    expect(duelPlayHref("topic", 7, "t03", 5)).toBe("/duel/play?mode=topic&topic=t03&seed=7&entry=5");
    const id = duelPlayId("bot.blitz.-.1.42", 1_000);
    expect(duelPlayed([{ id }], "bot.blitz.-.1.42")).toBe(true);
    expect(duelPlayed([{ id }], "bot.blitz.-.1.4")).toBe(false);
  });
});

describe("Ф3: вызовы в истории, серверный итог, скрытые имена", () => {
  const ghost = (over: Partial<DuelFinish> = {}) =>
    finish({ matchId: "ch.Ab_-12cdEF", mode: "ten", opp: "ghost", oppName: "Болат", oppLevel: 7, oppCode: "K7QF29XM", chId: "Ab_-12cdEF", you: side(8, 8, 10), rival: side(6, 6, 10), ...over });

  it("recordDuel solo: исход по своим же итогам (ничья), бонуса за победу нет, имя/код соперника не пишутся", () => {
    const r = useApp.getState().recordDuel(finish({ matchId: "rec.42", mode: "ten", opp: "solo", oppName: "x", oppCode: "K7QF29XM", you: side(7, 7, 10), rival: side(7, 7, 10) }));
    expect(r.result).toBe("draw");
    expect(r.xp).toBe(duelXpBase("ten", side(7, 7), "draw", "solo"));
    expect(duelXpBase("ten", side(7, 7), "win", "solo")).toBe(r.xp);
    expect(r.record.oppCode).toBeUndefined();
    expect(r.record.oppName).toBe("x"); // имя хранится у не-бота, но экран solo его не показывает
    expect(r.record.chId).toBeUndefined();
  });

  it("recordDuel ghost: код и id вызова проходят санитайзер; мусорные — отбрасываются при загрузке", () => {
    const r = useApp.getState().recordDuel(ghost());
    expect(r.record).toMatchObject({ opp: "ghost", oppCode: "K7QF29XM", chId: "Ab_-12cdEF", result: "win" });
    const bad = sanitizeDuels({ history: [{ ...r.record, oppCode: "k7qf<b>", chId: "../../x" }] });
    expect(bad.history[0].oppCode).toBeUndefined();
    expect(bad.history[0].chId).toBeUndefined();
  });

  it("settleDuel: solo получает id вызова (ссылка из истории), повтор — null", () => {
    const r = useApp.getState().recordDuel(finish({ matchId: "rec.42", mode: "ten", opp: "solo", you: side(7, 7, 10), rival: side(7, 7, 10) }));
    const xp = useApp.getState().xp;
    expect(useApp.getState().settleDuel(r.record.id, { chId: "Ab_-12cdEF" })).toMatchObject({ xpDelta: 0, record: { chId: "Ab_-12cdEF" } });
    expect(useApp.getState().duels.history[0].chId).toBe("Ab_-12cdEF");
    expect(useApp.getState().settleDuel(r.record.id, { chId: "Ab_-12cdEF" })).toBeNull();
    expect(useApp.getState().settleDuel(r.record.id, { chId: "bad id" })).toBeNull();
    expect(useApp.getState().settleDuel("nope", { chId: "Ab_-12cdEF" })).toBeNull();
    // У бота id вызова и серверный итог не применяются.
    const bot = useApp.getState().recordDuel(finish());
    expect(useApp.getState().settleDuel(bot.record.id, { chId: "Ab_-12cdEF", result: "loss" })).toBeNull();
    expect(useApp.getState().xp).toBe(xp + bot.xp);
  });

  it("settleDuel ghost: сервер засчитал поражение — исход и бонус за победу снимаются (с тем же бустером)", () => {
    useApp.setState({ boost: { mult: 2, until: Date.now() + 15 * MINUTE } });
    const r = useApp.getState().recordDuel(ghost());
    expect(r.result).toBe("win");
    const before = useApp.getState().xp;
    const dayBefore = Object.values(useApp.getState().days)[0].xp;
    const s = useApp.getState().settleDuel(r.record.id, { result: "loss" })!;
    expect(s.xpDelta).toBe(-DUEL_WIN_XP.human * 2);
    expect(useApp.getState().xp).toBe(before - DUEL_WIN_XP.human * 2);
    expect(Object.values(useApp.getState().days)[0].xp).toBe(dayBefore - DUEL_WIN_XP.human * 2);
    expect(useApp.getState().duels.history[0]).toMatchObject({ result: "loss", xp: r.xp - DUEL_WIN_XP.human * 2 });
    // Обратно: сервер подтвердил победу, которую клиент не насчитал.
    const back = useApp.getState().settleDuel(r.record.id, { result: "win" })!;
    expect(back.xpDelta).toBe(DUEL_WIN_XP.human * 2);
    expect(useApp.getState().xp).toBe(before);
    expect(useApp.getState().settleDuel(r.record.id, { result: "win" })).toBeNull();
  });

  it("hidePlayerName: только код друга, без повторов, свежий — первым, не больше 200", () => {
    const hide = (c: string) => useApp.getState().hidePlayerName(c);
    hide("K7QF29XM");
    hide("bad");
    hide("k7qf29xm");
    hide("K7QF29XM");
    expect(useApp.getState().duels.hiddenNames).toEqual(["K7QF29XM"]);
    for (let k = 0; k < 205; k++) hide(String(10_000_000 + k));
    const list = useApp.getState().duels.hiddenNames;
    expect(list).toHaveLength(200);
    expect(list[0]).toBe("10000204");
    expect(list).not.toContain("K7QF29XM");
    hide("10000010");
    expect(useApp.getState().duels.hiddenNames[0]).toBe("10000010");
    expect(useApp.getState().duels.hiddenNames).toHaveLength(200);
  });
});

describe("Ф3: отметка «просмотрено» входящих (lib/social/inbox-seen.ts)", () => {
  it("считаются только итоги новее отметки; отметка не уменьшается; хранилище недоступно — 0 без ошибок", async () => {
    const { readInboxSeen, seenAfter, unseenCount, writeInboxSeen } = await import("@/lib/social/inbox-seen");
    const items = [{ at: 300 }, { at: 200 }, { at: 100 }];
    expect(unseenCount(items, 0)).toBe(3);
    expect(unseenCount(items, 200)).toBe(1);
    expect(seenAfter(items, 0)).toBe(300);
    expect(seenAfter(items, 500)).toBe(500);
    expect(seenAfter([], 7)).toBe(7);
    expect(readInboxSeen()).toBe(0);
    expect(() => writeInboxSeen(1)).not.toThrow();
  });
});
