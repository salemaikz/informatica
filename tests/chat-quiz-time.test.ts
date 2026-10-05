// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatQuiz } from "@/components/chat/quiz/ChatQuiz";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import type { ChoiceStep } from "@/lib/types";

// Время ответа в чат-тренировке — активное (#68, C18): вкладка в фоне не набивает «время по теме».

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clock = vi.hoisted(() => ({ ms: 0 }));
vi.mock("@/lib/active-clock", async (orig) => ({ ...(await orig<typeof import("@/lib/active-clock")>()), activeMs: () => clock.ms }));

const STEP: ChoiceStep = {
  id: "q-time-1",
  type: "choice",
  skill: "ns.bin2dec",
  prompt: { ru: "Сколько будет 2 + 2?", kk: "2 + 2 неше болады?" },
  options: [
    { ru: "3", kk: "3" },
    { ru: "4", kk: "4" },
  ],
  correct: 1,
  explanation: { ru: "Два плюс два — четыре.", kk: "Екі қосу екі — төрт." },
};
vi.mock("@/lib/chat-quiz", async (orig) => ({ ...(await orig<typeof import("@/lib/chat-quiz")>()), buildQuiz: () => [STEP] }));

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useApp.getState().resetProgress();
  clock.ms = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

describe("ChatQuiz: время ответа — активное", () => {
  it("в срез по навыку попадает разница показаний активных часов, а не настенное время", async () => {
    await act(async () => root.render(createElement(ChatQuiz, { count: 5, onDone: () => {} })));
    // Задание показано при показании часов 0; ученик отвечает, когда активные часы показывают 7 с.
    clock.ms = 7000;
    await act(async () => button("4")!.click());
    await act(async () => button("Проверить")!.click());
    const row = useApp.getState().skillDays[todayKey()]?.["ns.bin2dec"];
    expect(row?.n).toBe(1);
    // Настенное время за тест — десятки миллисекунд; 7 с могли набежать только из активных часов.
    expect(row?.sec).toBeCloseTo(7, 1);
  });

  it("часы активного времени не идут (вкладка в фоне) — время ответа 0", async () => {
    await act(async () => root.render(createElement(ChatQuiz, { count: 5, onDone: () => {} })));
    await act(async () => button("4")!.click());
    await act(async () => button("Проверить")!.click());
    const row = useApp.getState().skillDays[todayKey()]?.["ns.bin2dec"];
    expect(row?.n).toBe(1);
    expect(row?.sec ?? 0).toBe(0);
  });
});
