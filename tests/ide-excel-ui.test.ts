// @vitest-environment happy-dom
import { createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Workspace } from "@/components/ide/excel/Workspace";
import { TASKS } from "@/lib/ide/excel/tasks";
import type { CheckResult } from "@/lib/ide/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

interface Probe {
  code: string;
  checks: CheckResult[];
}

function mount(taskId: string | null): Probe {
  const probe: Probe = { code: "", checks: [] };
  const task = taskId ? TASKS.find((t) => t.id === taskId)! : null;
  function Harness() {
    const [code, setCode] = useState(task?.starter ?? "{}");
    probe.code = code;
    return createElement(Workspace, { task, code, onCodeChange: setCode, onCheck: (r: CheckResult) => probe.checks.push(r) });
  }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(Harness)));
  return probe;
}

const input = () => host!.querySelector<HTMLInputElement>("input")!;
const cell = (addr: string) => host!.querySelector<HTMLButtonElement>(`[data-addr="${addr}"]`)!;
const buttonByText = (re: RegExp) => [...host!.querySelectorAll("button")].find((b) => re.test(b.textContent ?? ""))!;

function type(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    el.focus();
    set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const press = (el: Element, key: string) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
const click = (el: Element) => act(() => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("Workspace Excel в DOM", () => {
  it("рисует сетку A–H × 1–15 и начинает с ячейки, которую нужно заполнить", () => {
    mount("xl-1-sum");
    expect(host!.querySelectorAll("[data-addr]").length).toBe(8 * 15);
    expect(input().previousElementSibling).not.toBeNull();
    expect(host!.textContent).toContain("E1");
    expect(cell("A1").textContent).toBe("12");
  });

  it("ввод формулы в строке формул и Enter: значение посчитано, выбор ушёл вниз", () => {
    const probe = mount("xl-1-sum");
    type(input(), "=СУММ(A1:D1)");
    press(input(), "Enter");
    expect(cell("E1").textContent).toBe("33");
    expect(JSON.parse(probe.code).E1).toBe("=СУММ(A1:D1)");
    expect(cell("E2").tabIndex).toBe(0);
  });

  it("«Проверить» применяет ещё не подтверждённый ввод и отдаёт результат", () => {
    const probe = mount("xl-1-sum");
    type(input(), "=SUM(A1:D1)");
    click(buttonByText(/Проверить|Тексеру/));
    expect(probe.checks).toHaveLength(1);
    expect(probe.checks[0].ok).toBe(true);
  });

  it("неверное решение — проверка не пройдена", () => {
    const probe = mount("xl-1-sum");
    type(input(), "=A1+B1");
    press(input(), "Enter");
    click(buttonByText(/Проверить|Тексеру/));
    expect(probe.checks[0].ok).toBe(false);
  });

  it("«Протянуть вниз» копирует формулу со сдвигом ссылок", () => {
    const probe = mount("xl-5-abs");
    type(input(), "=B2/$B$6*100");
    press(input(), "Enter");
    click(cell("C2"));
    click(buttonByText(/Протянуть вниз|Төмен созу/));
    const saved = JSON.parse(probe.code);
    expect(saved.C3).toBe("=B3/$B$6*100");
    expect(saved.C5).toBe("=B5/$B$6*100");
    expect(cell("C4").textContent).toBe("15");
    click(buttonByText(/Проверить|Тексеру/));
    expect(probe.checks[0].ok).toBe(true);
  });

  it("ошибка в ячейке объясняется", () => {
    mount(null);
    click(cell("A1"));
    type(input(), "=1/0");
    press(input(), "Enter");
    expect(cell("A1").textContent).toBe("#ДЕЛ/0!");
    click(cell("A1"));
    expect(host!.querySelector("[role=alert]")?.textContent).toContain("#ДЕЛ/0!");
  });

  it("нажатие на ячейку при наборе формулы вставляет её адрес", () => {
    mount(null);
    click(cell("A1"));
    type(input(), "=");
    const el = input();
    el.setSelectionRange(1, 1);
    click(cell("B2"));
    expect(input().value).toBe("=B2");
  });

  it("стрелки двигают выбор, Delete очищает, символ начинает ввод", () => {
    const probe = mount(null);
    click(cell("A1"));
    press(cell("A1"), "ArrowDown");
    expect(cell("A2").tabIndex).toBe(0);
    press(cell("A2"), "5");
    expect(input().value).toBe("5");
    press(input(), "Enter");
    expect(JSON.parse(probe.code).A2).toBe("5");
    click(cell("A2"));
    press(cell("A2"), "Delete");
    expect(JSON.parse(probe.code).A2).toBeUndefined();
  });

  it("быстрый ввод вставляет функцию с курсором внутри скобок", () => {
    mount(null);
    click(cell("B2"));
    click(buttonByText(/^=$/));
    click(buttonByText(/^СУММ$/));
    expect(input().value).toBe("=СУММ()");
  });

  it("«Показать формулы» заменяет значения формулами", () => {
    mount("xl-7-copy");
    expect(cell("B2").textContent).toBe("2");
    click(buttonByText(/Показать формулы|Формулаларды көрсету/));
    expect(cell("B2").textContent).toBe("=$A2*B$1");
  });
});
