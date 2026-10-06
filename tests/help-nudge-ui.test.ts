// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpNudge, useHelpNudge, type HelpKind } from "@/components/lesson/HelpNudge";
import { useGuideUi } from "@/components/guide/guide-state";
import { MAX_HELP_OFFERS, helpKindIn } from "@/lib/help-timer";
import { useApp } from "@/lib/store";
import type { ChoiceStep, L, Step } from "@/lib/types";

// «Нужна помощь?» (этап 16В, P8): плашка Бита у кнопки «Проверить». Часы активного времени, пауза (шторка, сцена проводника,
// скрытая вкладка), «один раз на шаг, не больше трёх за урок», уезжает от «Нет, спасибо» и от действия ученика, звук и «Меньше анимаций».

const h = vi.hoisted(() => ({ sounds: [] as string[], hints: [] as string[], asks: [] as string[] }));
vi.mock("@/lib/sound", () => ({ playSound: (name: string) => h.sounds.push(name) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

interface Props {
  kind: HelpKind | null;
  stepKey: string;
  offerKey: string;
  afterMs?: number;
  touch?: unknown;
  paused?: boolean;
  enabled?: boolean;
  freeHint?: boolean;
}

/** Мини-плеер: тот же хук и та же плашка, что в `LessonPlayer`; кнопка «взял помощь» — как `openAi` в плеере. */
function Harness(p: Props) {
  const nudge = useHelpNudge({
    enabled: p.enabled ?? true,
    kind: p.kind,
    stepKey: p.stepKey,
    offerKey: p.offerKey,
    afterMs: p.afterMs ?? 20_000,
    touch: p.touch ?? null,
    paused: p.paused ?? false,
  });
  return createElement(
    "div",
    null,
    nudge.kind &&
      createElement(HelpNudge, {
        kind: nudge.kind,
        freeHint: p.freeHint ?? true,
        onHint: () => {
          h.hints.push("hint");
          nudge.markHelped();
        },
        onAsk: () => {
          h.asks.push("ask");
          nudge.markHelped();
        },
        onNo: nudge.dismiss,
      }),
    createElement("button", { "data-took-help": "", onClick: nudge.markHelped }, "взял помощь"),
  );
}

const render = (p: Props) =>
  act(async () => {
    root.render(createElement(Harness, p));
  });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const nudge = () => document.querySelector<HTMLElement>('[role="group"]');
const say = () => nudge()?.textContent ?? "";
const button = (name: string) => [...(nudge()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes(name));
const click = (el: Element | undefined) =>
  act(async () => {
    (el as HTMLElement).click();
  });

const step = (n: number): Props => ({ kind: "hint", stepKey: `s${n}`, offerKey: `s${n}` });

/** Окно или шторка поверх страницы (как `Modal`). */
function openDialog(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  document.body.appendChild(el);
  return el;
}

let visibility: "visible" | "hidden" = "visible";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
  h.sounds = [];
  h.hints = [];
  h.asks = [];
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ profile: { ...s.profile, lang: "ru", sound: true, reduceMotion: false } }));
  useGuideUi.setState({ active: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll('[role="dialog"]').forEach((e) => e.remove());
  useGuideUi.setState({ active: false });
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("когда выходит плашка", () => {
  it("по порогу активного времени: раньше нет, позже — да; вопрос, подсказка и «Нет, спасибо»", async () => {
    await render(step(1));
    await wait(19_000);
    expect(nudge()).toBeNull();
    await wait(2_000);
    expect(say()).toContain("Долго думаешь? Могу дать подсказку.");
    expect(button("Подсказка")).toBeDefined();
    expect(button("Нет, спасибо")).toBeDefined();
  });

  it("шаг-рассказ: «Объяснить проще?» и кнопка «Спросить Бита»", async () => {
    await render({ ...step(1), kind: "simpler" });
    await wait(21_000);
    expect(say()).toContain("Объяснить проще?");
    expect(button("Спросить Бита")).toBeDefined();
    expect(button("Подсказка")).toBeUndefined();
    await click(button("Спросить Бита"));
    expect(h.asks).toHaveLength(1);
    expect(nudge()).toBeNull();
  });

  it("порог берётся из `afterMs`: 100 секунд — не раньше", async () => {
    await render({ ...step(1), afterMs: 100_000 });
    await wait(99_000);
    expect(nudge()).toBeNull();
    await wait(2_000);
    expect(nudge()).not.toBeNull();
  });

  it("по-казахски — казахский текст и кнопки", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await render(step(1));
    await wait(21_000);
    expect(say()).toContain("Ұзақ ойланып қалдың ба?");
    expect(button("Кеңес")).toBeDefined();
    expect(button("Жоқ, рахмет")).toBeDefined();
  });

  it("цена: у подсказки автора её нет, у ИИ — есть", async () => {
    await render({ ...step(1), freeHint: true });
    await wait(21_000);
    const free = button("Подсказка")!.textContent;
    await render({ ...step(2), freeHint: false });
    await wait(21_000);
    expect(button("Подсказка")!.textContent!.length).toBeGreaterThan(free!.length);
  });

  it("звук: один «буп» при появлении, не при каждом тике", async () => {
    await render(step(1));
    await wait(21_000);
    await wait(5_000);
    expect(h.sounds).toEqual(["bitPop"]);
  });

  it("звук выключен в профиле — тишина", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, sound: false } }));
    await render(step(1));
    await wait(21_000);
    expect(nudge()).not.toBeNull();
    expect(h.sounds).toEqual([]);
  });

  it("«Меньше анимаций»: плашка выходит без выезда Бита снизу", async () => {
    await render(step(1));
    await wait(21_000);
    // Бит — последний в колонке (первым идёт пузырь с хвостиком).
    const bit = nudge()!.parentElement!.lastElementChild as HTMLElement;
    expect(bit.getAttribute("style") ?? "").toContain("64px");
    await act(async () => root.unmount());
    host.remove();
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await render(step(1));
    await wait(21_000);
    const calm = nudge()!.parentElement!.lastElementChild as HTMLElement;
    expect(calm.getAttribute("style") ?? "").not.toContain("64px");
  });
});

describe("считается только активное время", () => {
  it("открытая шторка или окно ([role=dialog][aria-modal]) — пауза, после закрытия счёт продолжается", async () => {
    await render(step(1));
    await wait(10_000);
    const dlg = openDialog();
    await wait(100_000);
    expect(nudge()).toBeNull();
    dlg.remove();
    await wait(9_000);
    expect(nudge()).toBeNull();
    await wait(2_000);
    expect(nudge()).not.toBeNull();
  });

  it("сцена проводника (useGuideUi.active) — пауза", async () => {
    await render(step(1));
    await wait(10_000);
    useGuideUi.setState({ active: true });
    await wait(100_000);
    expect(nudge()).toBeNull();
    useGuideUi.setState({ active: false });
    await wait(9_000);
    expect(nudge()).toBeNull();
    await wait(2_000);
    expect(nudge()).not.toBeNull();
  });

  it("вкладка не видна — время не идёт", async () => {
    await render(step(1));
    visibility = "hidden";
    await wait(120_000);
    visibility = "visible";
    expect(nudge()).toBeNull();
    await wait(21_000);
    expect(nudge()).not.toBeNull();
  });

  it("пауза от самого плеера (`paused`: окно выхода, «нет сердечек», шторка ИИ)", async () => {
    await render({ ...step(1), paused: true });
    await wait(100_000);
    expect(nudge()).toBeNull();
    await render({ ...step(1), paused: false });
    await wait(21_000);
    expect(nudge()).not.toBeNull();
  });

  it("плашка не выходит, пока шаг не ждёт ответа (`enabled: false`: идёт проверка, показан разбор) или помощь не предлагается (`kind: null`)", async () => {
    await render({ ...step(1), enabled: false });
    await wait(60_000);
    expect(nudge()).toBeNull();
    await render({ ...step(1), kind: null });
    await wait(60_000);
    expect(nudge()).toBeNull();
  });

  it("шаг сменился — счёт заново", async () => {
    await render(step(1));
    await wait(15_000);
    await render(step(2));
    await wait(15_000);
    expect(nudge()).toBeNull();
    await wait(6_000);
    expect(nudge()).not.toBeNull();
  });
});

describe("один раз на шаг, не больше трёх за урок", () => {
  it("«Нет, спасибо» убирает плашку, и на том же шаге она не возвращается (в том числе при повторе задания после ошибки)", async () => {
    await render(step(1));
    await wait(21_000);
    await click(button("Нет, спасибо"));
    expect(nudge()).toBeNull();
    await wait(60_000);
    expect(nudge()).toBeNull();
    // Повтор того же задания: другой ключ счёта, тот же шаг.
    await render({ kind: "hint", stepKey: "s1:retry", offerKey: "s1" });
    await wait(60_000);
    expect(nudge()).toBeNull();
  });

  it("на следующем шаге — снова, но не больше трёх раз за урок", async () => {
    const shown: boolean[] = [];
    for (let n = 1; n <= MAX_HELP_OFFERS + 2; n++) {
      await render(step(n));
      await wait(21_000);
      shown.push(nudge() !== null);
      if (nudge()) await click(button("Нет, спасибо"));
    }
    expect(shown).toEqual([true, true, true, false, false]);
  });

  it("три показа считаются и когда плашку не закрывали, а ученик просто ответил", async () => {
    const shown: boolean[] = [];
    for (let n = 1; n <= 4; n++) {
      await render(step(n));
      await wait(21_000);
      shown.push(nudge() !== null);
    }
    expect(shown).toEqual([true, true, true, false]);
  });

  it("подсказка или «Спросить Бита» на плашке закрывают её; показ при этом уже считан", async () => {
    await render(step(1));
    await wait(21_000);
    await click(button("Подсказка"));
    expect(h.hints).toHaveLength(1);
    expect(nudge()).toBeNull();
    await wait(60_000);
    expect(nudge()).toBeNull();
    const shown: boolean[] = [];
    for (let n = 2; n <= 4; n++) {
      await render(step(n));
      await wait(21_000);
      shown.push(nudge() !== null);
    }
    expect(shown).toEqual([true, true, false]);
  });

  it("помощь, взятая до порога, показов не тратит", async () => {
    await render(step(1));
    await wait(10_000);
    await click(document.querySelector("[data-took-help]") as Element);
    const shown: boolean[] = [];
    for (let n = 2; n <= 5; n++) {
      await render(step(n));
      await wait(21_000);
      shown.push(nudge() !== null);
    }
    expect(shown).toEqual([true, true, true, false]);
  });

  it("помощь взята до порога — на этом шаге плашки не будет", async () => {
    await render(step(1));
    await wait(10_000);
    await click(document.querySelector("[data-took-help]") as Element);
    await wait(60_000);
    expect(nudge()).toBeNull();
  });

  it("на шаге, где помощь брали, плашки нет и после отката на него (повтор после ошибки)", async () => {
    await render(step(1));
    await click(document.querySelector("[data-took-help]") as Element);
    await render(step(2));
    await click(document.querySelector("[data-took-help]") as Element);
    await render({ kind: "hint", stepKey: "s1:retry", offerKey: "s1" });
    await wait(60_000);
    expect(nudge()).toBeNull();
  });
});

describe("плашка уезжает, когда ученик начал действовать", () => {
  it("ответ (touch) убирает плашку; если ответ потом стёрли, она не возвращается", async () => {
    await render({ ...step(1), touch: null });
    await wait(21_000);
    expect(nudge()).not.toBeNull();
    await render({ ...step(1), touch: { type: "choice", index: 2 } });
    expect(nudge()).toBeNull();
    await render({ ...step(1), touch: null });
    expect(nudge()).toBeNull();
    await wait(60_000);
    expect(nudge()).toBeNull();
  });

  it("открытый подшаг разбора убирает плашку", async () => {
    await render({ ...step(1), kind: "simpler", touch: 1 });
    await wait(21_000);
    expect(nudge()).not.toBeNull();
    await render({ ...step(1), kind: "simpler", touch: 2 });
    expect(nudge()).toBeNull();
  });
});

describe("где плашки нет", () => {
  const same = (s: string): L => ({ ru: s, kk: s });
  const choice: ChoiceStep = { id: "c", type: "choice", prompt: same("?"), options: ["а", "б"], correct: 0, explanation: same(".") };
  const video: Step = { id: "v", type: "video", videoId: "x", title: same("Видео") };

  it("тест (мини-тест): нет ни подсказки, ни «объяснить проще»", () => {
    expect(helpKindIn(choice, { testMode: true })).toBeNull();
    expect(helpKindIn(choice, { testMode: false })).toBe("hint");
    expect(helpKindIn(undefined, { testMode: false })).toBeNull();
    expect(helpKindIn(video, { testMode: false })).toBeNull();
  });

  const SRC = join(import.meta.dirname, "..", "src");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
  const files = walk(SRC);
  const using = (needle: string) =>
    files
      .filter((f) => readFileSync(f, "utf8").includes(needle))
      .map((f) => f.slice(SRC.length + 1).replaceAll("\\", "/"))
      .sort();

  it("хук плашки подключён только в плеере урока и тренировки: не в пробном ЕНТ, тестах по теме и разделу и не в играх", () => {
    expect(using("useHelpNudge")).toEqual(["components/lesson/HelpNudge.tsx", "components/lesson/LessonPlayer.tsx"]);
    expect(using("HelpNudge")).toEqual(["components/lesson/HelpNudge.tsx", "components/lesson/LessonPlayer.tsx"]);
  });

  it("плеер открывают только урок и тренировка; мини-тест тренировки идёт в `testMode`", () => {
    expect(using("<LessonPlayer")).toEqual(["app/drill/DrillScreen.tsx", "app/lesson/[id]/LessonScreen.tsx"]);
    const drill = readFileSync(join(SRC, "app/drill/DrillScreen.tsx"), "utf8");
    expect(drill).toContain('kind="drill"');
    expect(drill).toContain('testMode={mode === "minitest"}');
    const player = readFileSync(join(SRC, "components/lesson/LessonPlayer.tsx"), "utf8");
    expect(player).toContain("helpKindIn(step, { testMode })");
  });
});
