// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CountUp } from "@/components/motion/CountUp";
import { useApp } from "@/lib/store";

// Пакет P7 этапа 16В: при «Меньше анимаций» счётчик сразу показывает итог (spring.jump() оставлял на экране 0).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });

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

describe("CountUp и «Меньше анимаций»", () => {
  it("включено — сразу итоговое число обычным текстом, без пружины и без задержки", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    await render(createElement(CountUp, { value: 45, delay: 5, className: "x" }));
    const span = host.querySelector("span.x");
    expect(span?.textContent).toBe("45");
    // сразу, без ожидания: итог не ждёт delay
    expect(host.textContent).toBe("45");
  });

  it("формат применяется к итогу (проценты, разделители)", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    await render(createElement(CountUp, { value: 7.5, format: (n: number) => `${n.toFixed(1)}%` }));
    expect(host.textContent).toBe("7.5%");
  });

  it("при смене значения показывает новое сразу", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    await render(createElement(CountUp, { value: 10 }));
    expect(host.textContent).toBe("10");
    await render(createElement(CountUp, { value: 99 }));
    expect(host.textContent).toBe("99");
  });

  it("выключено — счёт начинается с from (не показывает итог до начала)", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: false } }));
    await render(createElement(CountUp, { value: 45, from: 3, delay: 5 }));
    expect(host.textContent).toBe("3");
  });
});
