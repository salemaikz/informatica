// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LevelCase } from "@/components/rewards/LevelCase";
import { useApp } from "@/lib/store";

// Кейс за уровень: «Новый уровень!» — один раз (в заголовке), над ним номер и звание; бейдж уровня на золотом свечении — на подложке.

vi.mock("@/lib/sound", () => ({ playSound: () => {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const render = (level: number) =>
  act(async () => {
    root.render(createElement(LevelCase, { level, onClose: () => {} }));
  });
const count = (needle: string) => (document.body.textContent ?? "").split(needle).length - 1;

beforeEach(() => {
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ profile: { ...s.profile, lang: "ru", sound: false, vibration: false, reduceMotion: true } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

describe("кейс за уровень: экран закрытого кейса", () => {
  it("фраза «Новый уровень!» стоит один раз; над заголовком — номер уровня и его звание", async () => {
    await render(3);
    expect(count("Новый уровень!")).toBe(1);
    expect(document.querySelector("h1")!.textContent).toBe("Новый уровень!");
    expect(document.body.textContent).toContain("Байт"); // звание 3-го уровня
    expect(document.querySelector('[role="img"][aria-label="Уровень 3"]')).not.toBeNull();
  });

  it("по-казахски — то же: один раз «Жаңа деңгей!», звание уровня над ним", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await render(1);
    expect(count("Жаңа деңгей!")).toBe(1);
    expect(document.body.textContent).toContain("Жаңадан бастаушы");
  });

  it("бейдж уровня — на подложке цвета карточки с золотым кольцом, а не бледно-серый кружок (обычная ступень)", async () => {
    await render(3);
    const badge = document.querySelector<HTMLElement>('[role="img"][aria-label="Уровень 3"]')!;
    expect(badge.className).toContain("ring-gold");
    expect(badge.className).toContain("bg-surface");
    const fill = badge.querySelector("span.rounded-full.overflow-hidden")!;
    expect(fill.className).toContain("bg-surface");
    expect(fill.className).not.toContain("bg-rarity-common-soft");
  });

  it("кнопка «Открыть кейс»: кольцо фокуса не рисуется на сенсорном экране (без двойной рамки)", async () => {
    await render(3);
    const open = [...document.querySelectorAll("button")].find((b) => b.textContent === "Открыть кейс")!;
    expect(open.className).toContain("pointer-coarse:focus-visible:outline-0");
  });
});
