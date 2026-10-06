// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuelPlay } from "@/components/duel/DuelPlay";
import { COUNT_STEP_MS, VS_INTRO_MS } from "@/components/duel/VsScreen";
import { buildDeck, correctAnswer } from "@/lib/duel/deck";
import { DUEL_MODES } from "@/lib/duel/modes";
import { duelEntryKey } from "@/lib/entry-paid";
import { FREE_PLAN } from "@/lib/economy";
import { useApp } from "@/lib/store";
import type { DuelItem } from "@/lib/duel/types";

// Этап 16Д, Ф1: матч с Битом на экране (часы подменены): набор с сервера → VS и отсчёт → сердечко −1 ровно один раз в конце
// отсчёта → ответы → конец часов блица → итоги и запись в историю; «бот» виден на VS, в матче и на итогах.

const replace = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/duel/play", useRouter: () => ({ push: () => {}, replace, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
vi.mock("canvas-confetti", () => ({ default: () => {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const text = () => host.textContent ?? "";
const flush = () => act(async () => {});
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const SEED = 4242;
let deck: DuelItem[] = [];
let deckMode: "blitz" | "ten" = "blitz";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState((s) => ({
    onboarded: true,
    plan: FREE_PLAN,
    profile: { ...s.profile, name: "Аян", lang: "ru", sound: false },
    hearts: { count: 3, updatedAt: Date.now(), day: "2027-01-15" },
  }));
  deckMode = "blitz";
  deck = buildDeck("blitz", SEED, 1);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toBe(`/api/duel/deck?mode=${deckMode}&band=1&seed=${SEED}`);
      return new Response(JSON.stringify({ mode: deckMode, band: 1, seed: SEED, deckTag: "dev", items: deck }), { status: 200 });
    }),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  replace.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const item = () => host.querySelector<HTMLElement>('[data-testid="duel-item"]');

/** Ответить на текущее задание: верно или неверно (клик по варианту). */
async function answer(right: boolean) {
  const card = item();
  expect(card).not.toBeNull();
  const it = deck[Number(card!.dataset.item)];
  const a = right ? correctAnswer(it) : it.shape === "statement" ? !it.statement.value : (it.step.correct + 1) % it.step.options.length;
  const el = it.shape === "statement" ? host.querySelector<HTMLElement>(`[data-answer="${a}"]`) : host.querySelector<HTMLElement>(`[data-option="${a}"]`);
  await act(async () => {
    el!.click();
  });
}

describe("DuelPlay: матч с Битом", () => {
  it("VS → отсчёт → −1 сердечко один раз → блиц → итоги и история", async () => {
    await act(async () => root.render(createElement(DuelPlay, { mode: "blitz", seed: SEED })));
    await flush();
    await flush();
    // VS: Бит подписан «бот», сердечко ещё не списано
    expect(host.querySelector('[data-testid="duel-vs"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="duel-vs"] [data-testid="bot-chip"]')).not.toBeNull();
    expect(text()).toContain("ур. 1–4");
    expect(useApp.getState().hearts.count).toBe(3);
    await advance(VS_INTRO_MS + 2 * COUNT_STEP_MS + 100);
    expect(useApp.getState().hearts.count).toBe(3);
    await advance(COUNT_STEP_MS);
    // конец отсчёта: списано одно сердечко, матч идёт, в матче — чип «бот»
    expect(useApp.getState().hearts.count).toBe(2);
    expect(useApp.getState().entryPaid[duelEntryKey(`bot.blitz.-.1.${SEED}`)]).toBeDefined();
    expect(item()).not.toBeNull();
    expect(host.querySelector('[data-testid="duel-opp"] [data-testid="bot-chip"]')).not.toBeNull();

    await advance(1_000);
    await answer(true);
    await advance(800);
    await answer(true);
    await advance(800);
    await answer(false);
    expect(host.querySelector('[data-testid="duel-you-score"]')!.textContent).toBe("3");
    // пауза после ошибки: ответ не принимается
    const before = item()!.dataset.item;
    await answer(true);
    expect(item()!.dataset.item).toBe(before);
    await advance(DUEL_MODES.blitz.errorPauseMs + 100);
    await answer(true);
    expect(host.querySelector('[data-testid="duel-you-score"]')!.textContent).toBe("5");
    // Бит отвечает по своему таймлайну
    await advance(20_000);
    expect(Number(host.querySelector('[data-testid="duel-opp-score"]')!.textContent)).not.toBeNaN();

    await advance(DUEL_MODES.blitz.clockMs!);
    expect(host.querySelector('[data-testid="duel-result"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="duel-result"] [data-testid="bot-chip"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="duel-final-score"]')!.textContent).toMatch(/^5 : -?\d+$/);
    const h = useApp.getState().duels.history;
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ mode: "blitz", opp: "bot", you: { score: 5, correct: 3, answered: 4 } });
    // сердечко списано ровно одно; ключ входа снят; ошибка — в «Ошибках»
    expect(useApp.getState().hearts.count).toBe(2);
    expect(useApp.getState().entryPaid[duelEntryKey(`bot.blitz.-.1.${SEED}`)]).toBeUndefined();
    expect(useApp.getState().mistakes).toHaveLength(1);
    expect(text()).toContain("Разобрать ошибки");
    // реванш — новый матч (новый seed в адресе)
    const rematch = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Реванш"))!;
    await act(async () => rematch.click());
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/duel\/play\?mode=blitz&seed=\d+$/));
  });

  it("сердечек нет — в конце отсчёта окно «Сердечки закончились», матч не начинается", async () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: "2027-01-15" } });
    await act(async () => root.render(createElement(DuelPlay, { mode: "blitz", seed: SEED })));
    await flush();
    await flush();
    await advance(VS_INTRO_MS + 3 * COUNT_STEP_MS + 100);
    expect(text()).toContain("Сердечки закончились");
    expect(item()).toBeNull();
    expect(useApp.getState().duels.history).toHaveLength(0);
  });

  it("10 вопросов: тайм-аут — неверно; доиграл раньше Бита — «Бит ещё отвечает» и «Показать итоги»", async () => {
    deckMode = "ten";
    deck = buildDeck("ten", SEED, 1);
    await act(async () => root.render(createElement(DuelPlay, { mode: "ten", seed: SEED })));
    await flush();
    await flush();
    await advance(VS_INTRO_MS + 3 * COUNT_STEP_MS + 100);
    expect(item()!.dataset.item).toBe("0");
    // первое задание пропущено по времени (20 с), разбор, затем следующее
    await advance(deck[0].limitMs! + 100);
    await advance(2_000);
    expect(item()!.dataset.item).toBe("1");
    for (let k = 1; k < deck.length; k++) {
      await answer(true);
      await advance(1_000);
    }
    expect(text()).toContain("Бит ещё отвечает");
    const skip = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Показать итоги"))!;
    await act(async () => skip.click());
    expect(host.querySelector('[data-testid="duel-result"]')).not.toBeNull();
    expect(useApp.getState().duels.history[0]).toMatchObject({ mode: "ten", you: { correct: 9, answered: 10, score: 9 } });
  });
});
