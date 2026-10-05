// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ResultLanding } from "@/components/share/ResultLanding";
import { ogImageTree } from "@/components/share/og-image";
import { Results } from "@/components/lesson/Results";
import { encodeShare, parseShare, type ShareResult } from "@/lib/share-code";
import { useApp } from "@/lib/store";
import type { SessionResult } from "@/lib/types";

// Этап 16В, M: «Поделиться» уроком — страница ссылки, картинка превью и кнопка на итогах урока.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, prefetch: () => undefined }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}
const text = () => host.textContent ?? "";

beforeEach(() => {
  useApp.getState().resetProgress();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

const lesson = (over: Partial<Extract<ShareResult, { t: "lesson" }>> = {}): Extract<ShareResult, { t: "lesson" }> => ({
  t: "lesson",
  accuracy: 85,
  xp: 35,
  perfect: false,
  n: 12,
  lang: "ru",
  ...over,
});

/** Все строки текста в дереве React-элементов (для картинки превью). */
function texts(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  const el = node as ReactElement<{ children?: unknown }>;
  return texts(el.props?.children);
}

describe("страница ссылки /r/<код> для урока", () => {
  it("число в кольце, строки результата; число не повторяется отдельной строкой", async () => {
    const code = encodeShare(lesson())!;
    await render(createElement(ResultLanding, { result: parseShare(code) }));
    expect(text()).toContain("Результат друга в уроке");
    expect(text()).toContain("85%");
    expect(text()).toContain("Урок пройден");
    expect(text()).toContain("+35 XP · Пройдено уроков: 12");
    expect(text().match(/85%/g)).toHaveLength(1);
    expect(text()).toContain("В ссылке нет имени");
  });

  it("идеальный урок, казахский", async () => {
    await render(createElement(ResultLanding, { result: lesson({ accuracy: 100, perfect: true, lang: "kk", n: 1 }) }));
    expect(text()).toContain("Бірде-бір қатесіз!");
    expect(text()).toContain("100%");
  });
});

describe("картинка превью для урока", () => {
  it("точность, строка про XP и число уроков; без имени", () => {
    const all = texts(ogImageTree(lesson())).join("|");
    expect(all).toContain("Урок пройден");
    expect(all).toContain("85%");
    expect(all).toContain("+35 XP · Пройдено уроков: 12");
    const perfect = texts(ogImageTree(lesson({ accuracy: 100, perfect: true, lang: "kk" }))).join("|");
    expect(perfect).toContain("Бірде-бір қатесіз!");
  });
});

describe("итоги урока: кнопка «Поделиться»", () => {
  // «Меньше анимаций» — без конфетти (в happy-dom нет canvas).
  beforeEach(() => {
    useApp.getState().updateProfile({ reduceMotion: true });
  });

  const session = (over: Partial<SessionResult> = {}): SessionResult => ({
    kind: "lesson",
    lessonId: "ns-1-bits",
    title: "Урок",
    answers: [{ prompt: "p", given: "1", expected: "1", correct: true, skill: "ns.base", timeMs: 1000 } as SessionResult["answers"][number]],
    xp: 30,
    maxCombo: 1,
    durationSec: 60,
    accuracy: 1,
    ...over,
  });
  const props = (result: SessionResult, kind: "lesson" | "drill" = "lesson") => ({
    kind,
    lessonId: kind === "lesson" ? "ns-1-bits" : undefined,
    title: "Урок",
    result,
    bonusXp: 5,
    achievements: [],
    feedback: { status: "failed" } as const,
  });

  it("у урока — небольшая вторичная кнопка; по нажатию открывается шторка со ссылкой /r/<код> (только числа)", async () => {
    useApp.setState({ lessons: { "ns-1-bits": { completions: 1, lastAt: 1, best: 1, dueAt: 1 } as never } });
    await render(createElement(Results, props(session())));
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Поделиться"))!;
    expect(btn).toBeTruthy();
    // не крупная: «призрачная» кнопка, не основная
    expect(btn.className).not.toContain("bg-primary");
    await act(async () => btn.click());
    expect(document.body.textContent).toContain("Поделиться уроком");
    // ссылка уходит в кнопки WhatsApp и Telegram
    const hrefs = [...document.querySelectorAll("a")].map((a) => decodeURIComponent(a.getAttribute("href") ?? ""));
    const link = hrefs.join(" ").match(/\/r\/(l1-[0-9a-z-]+)/)?.[1];
    expect(link).toBeTruthy();
    const parsed = parseShare(link);
    expect(parsed).toMatchObject({ t: "lesson", accuracy: 100, xp: 35, perfect: true, n: 1 });
  });

  it("у тренировки кнопки нет", async () => {
    await render(createElement(Results, props(session({ kind: "drill", lessonId: undefined }), "drill")));
    expect([...host.querySelectorAll("button")].some((b) => b.textContent?.includes("Поделиться"))).toBe(false);
  });
});
