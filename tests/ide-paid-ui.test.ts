// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdeShell } from "@/components/ide/IdeShell";
import { Workspace as ExcelWorkspace } from "@/components/ide/excel/Workspace";
import { FREE_PLAN, heartsView } from "@/lib/economy";
import { codeEntryKey } from "@/lib/entry-paid";
import { TASKS as EXCEL_TASKS } from "@/lib/ide/excel/tasks";
import { TASKS as SQL_TASKS } from "@/lib/ide/sql/tasks";
import type { CheckResult, WorkspaceProps } from "@/lib/ide/types";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

// Этап 16Г, #120: задача практикума кода стоит сердечко при первом «Запустить» / «Проверить» (beforeRun оболочки).
// Пока задача открыта — второй раз не платим, даже после 20 минут работы; песочница и «Безлимит» — бесплатно.

const h = vi.hoisted(() => ({ events: [] as { e: string; where?: string }[], runs: 0, checks: 0 }));
vi.mock("next/navigation", () => ({ usePathname: () => "/code/sql", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", async () => {
  const { createElement: ce } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => ce("a", { href, ...rest }, children as never) };
});
vi.mock("canvas-confetti", () => ({ default: () => {} }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  track: (ev: { e: string; where?: string }) => h.events.push(ev),
}));
// Рабочая область-заглушка (sql.js в тестах не грузим): «Запустить» и «Проверить» зовут beforeRun, как настоящие.
vi.mock("@/components/ide/registry", async (orig) => {
  const m = await orig<typeof import("@/components/ide/registry")>();
  const { createElement: ce } = await import("react");
  function StubWorkspace({ onCheck, beforeRun }: WorkspaceProps) {
    return ce(
      "div",
      null,
      ce("button", { "data-test": "run", onClick: () => (!beforeRun || beforeRun()) && h.runs++ }, "run"),
      ce("button", { "data-test": "check", onClick: () => (!beforeRun || beforeRun()) && (h.checks++, onCheck({ ok: false } as CheckResult)) }, "check"),
    );
  }
  return { ...m, IDE_REGISTRY: { ...m.IDE_REGISTRY, sql: { ...m.IDE_REGISTRY.sql, Workspace: StubWorkspace } } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const hearts = () => heartsView(useApp.getState().hearts, "free", Date.now(), todayKey()).count;
const setHearts = (count: number) => useApp.setState({ hearts: { count, updatedAt: Date.now(), day: todayKey() } });
const click = (name: "run" | "check") => act(async () => host.querySelector<HTMLButtonElement>(`[data-test="${name}"]`)!.click());
const outShown = () => (document.body.textContent ?? "").includes("Сердечки закончились");

const task = SQL_TASKS[0];
const shell = (t: typeof task | null = task) => createElement(IdeShell, { key: t?.id ?? "sandbox", lang: "sql", task: t });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false } }));
  setHearts(5);
  h.events.length = 0;
  h.runs = 0;
  h.checks = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("практикум кода: сердечко за задачу", () => {
  it("открытие задачи бесплатно; первый «Запустить» — −1, дальше запуски и проверки бесплатны", async () => {
    await render(shell());
    expect(hearts()).toBe(5);
    await click("run");
    expect(hearts()).toBe(4);
    expect(useApp.getState().entryPaid[codeEntryKey("sql", task.id)]).toBe(Date.now());
    await click("run");
    await click("check");
    expect(hearts()).toBe(4);
    expect(h.runs).toBe(2);
    expect(h.checks).toBe(1);
  });

  it("работа над задачей дольше 20 минут — второй раз не списываем", async () => {
    await render(shell());
    await click("run");
    expect(hearts()).toBe(4);
    vi.setSystemTime(Date.now() + 25 * 60_000);
    await click("run");
    await click("check");
    expect(hearts()).toBe(4);
    expect(h.runs).toBe(2);
  });

  it("другая задача — новое сердечко", async () => {
    await render(shell());
    await click("run");
    await render(shell(SQL_TASKS[1]));
    await click("check");
    expect(hearts()).toBe(3);
  });

  it("песочница и «Безлимит» — бесплатно", async () => {
    await render(shell(null));
    await click("run");
    expect(hearts()).toBe(5);
    expect(h.runs).toBe(1);
    await act(async () => root.unmount());
    root = createRoot(host);
    useApp.setState({ plan: { tier: "unlimited", until: Date.now() + 86_400_000 } });
    await render(shell());
    await click("run");
    await click("check");
    expect(h.runs).toBe(2);
    expect(h.checks).toBe(1);
    expect(useApp.getState().hearts.count).toBe(5);
  });

  it("сердечек нет — «Сердечки закончились», запуск не начинается; hearts_out «code» один раз на задачу", async () => {
    setHearts(0);
    await render(shell());
    await click("run");
    await click("check");
    await click("run");
    expect(outShown()).toBe(true);
    expect(h.runs).toBe(0);
    expect(h.checks).toBe(0);
    expect(useApp.getState().entryPaid[codeEntryKey("sql", task.id)]).toBeUndefined();
    expect(h.events.filter((e) => e.e === "hearts_out")).toEqual([{ e: "hearts_out", where: "code" }]);
  });
});

describe("рабочая область зовёт beforeRun перед проверкой", () => {
  it("Excel: beforeRun = false — проверки нет; true — проверка идёт", async () => {
    const t = EXCEL_TASKS[0];
    const checks: CheckResult[] = [];
    let allow = false;
    let asked = 0;
    function Harness() {
      const [code, setCode] = useState(t.starter);
      return createElement(ExcelWorkspace, {
        task: t,
        code,
        onCodeChange: setCode,
        onCheck: (r: CheckResult) => checks.push(r),
        beforeRun: () => (asked++, allow),
      });
    }
    await render(createElement(Harness));
    const checkBtn = () => [...host.querySelectorAll("button")].find((b) => /Проверить/.test(b.textContent ?? ""))!;
    await act(async () => checkBtn().click());
    expect(asked).toBe(1);
    expect(checks).toHaveLength(0);
    allow = true;
    await act(async () => checkBtn().click());
    expect(asked).toBe(2);
    expect(checks).toHaveLength(1);
  });
});
