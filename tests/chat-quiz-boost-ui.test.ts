// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatQuiz } from "@/components/chat/quiz/ChatQuiz";
import { FREE_PLAN } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import type { ChoiceStep } from "@/lib/types";

// «Дай задачи» в чате (этап 16Г): опыт с бустером — показываем и пишем в итог начисленное стором (как LessonPlayer);
// нехватка сердечек — одно событие hearts_out за квиз, сколько бы раз ни нажимали.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({ events: [] as { e: string; where?: string }[] }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  track: (ev: { e: string; where?: string }) => h.events.push(ev),
}));

const STEP: ChoiceStep = {
  id: "q-boost-1",
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
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false } }));
  useApp.setState({ hearts: { count: 5, updatedAt: Date.now(), day: todayKey() } });
  h.events.length = 0;
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

describe("ChatQuiz: бустер опыта и hearts_out", () => {
  it("«Опыт ×2»: «+N XP» за ответ, итог и запись истории — то, что прибавил стор", async () => {
    useApp.setState({ boost: { mult: 2, until: Date.now() + 3_600_000 } });
    await act(async () => root.render(createElement(ChatQuiz, { count: 5, onDone: () => {} })));
    const before = useApp.getState().xp;
    await act(async () => button("4")!.click());
    await act(async () => button("Проверить")!.click());
    const credited = useApp.getState().xp - before;
    expect(credited).toBeGreaterThan(0);
    expect(host.textContent).toContain(`+${credited} XP`);
    // Последнее задание — «Готово»/«Дальше»: итог.
    const last = [...host.querySelectorAll("button")].filter((b) => !b.disabled).pop()!;
    await act(async () => last.click());
    expect(useApp.getState().history[0]?.xp).toBe(credited);
  });

  it("сердечек нет: два нажатия на число заданий — одно событие hearts_out", async () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: todayKey() } });
    await act(async () => root.render(createElement(ChatQuiz, { onDone: () => {} })));
    await act(async () => button("5")!.click());
    await act(async () => button("5")!.click());
    expect(h.events.filter((e) => e.e === "hearts_out")).toEqual([{ e: "hearts_out", where: "drill" }]);
  });
});
