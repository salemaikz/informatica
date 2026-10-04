// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useApp } from "@/lib/store";
import { QuickActions } from "@/components/learn/QuickActions";
import { EntOnly } from "@/components/school/EntOnly";

// Школьный трек без ЕНТ-элементов (#52): быстрые действия и стража разделов /exam и /plan отрисовываем в DOM.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

const hrefs = () => [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
const setTrack = (track: "ent" | "school") => act(() => useApp.getState().updateProfile({ track }));

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().updateProfile({ track: "ent" });
});

describe("быстрые действия", () => {
  it("трек ЕНТ — есть «Тест ЕНТ» (/exam)", async () => {
    await setTrack("ent");
    await render(createElement(QuickActions, { dueCount: 0 }));
    expect(hrefs()).toContain("/exam");
  });

  it("школьный трек — нет ссылки на /exam, остальные действия на месте", async () => {
    await setTrack("school");
    await render(createElement(QuickActions, { dueCount: 0 }));
    expect(hrefs()).not.toContain("/exam");
    expect(hrefs()).toEqual(expect.arrayContaining(["/theory", "/code", "/search"]));
  });
});

describe("EntOnly — страж разделов /exam и /plan", () => {
  const page = () => createElement("div", { "data-testid": "page" }, "СТРАНИЦА РАЗДЕЛА");

  it("трек ЕНТ — страница как есть", async () => {
    await setTrack("ent");
    await render(createElement(EntOnly, null, page()));
    expect(host.textContent).toContain("СТРАНИЦА РАЗДЕЛА");
  });

  it("школьный трек — карточка вместо страницы, с двумя выходами", async () => {
    await setTrack("school");
    await render(createElement(EntOnly, null, page()));
    expect(host.textContent).not.toContain("СТРАНИЦА РАЗДЕЛА");
    expect(host.textContent).toContain("Этот раздел — для подготовки к ЕНТ");
    expect(host.textContent).toContain("Переключиться на ЕНТ");
    expect(hrefs()).toContain("/learn");
    expect(host.textContent).toContain("К школьной программе");
  });

  it("«Переключиться на ЕНТ» меняет трек действием стора и тут же открывает страницу", async () => {
    await setTrack("school");
    await render(createElement(EntOnly, null, page()));
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Переключиться на ЕНТ"));
    expect(btn).toBeTruthy();
    await act(async () => btn!.click());
    expect(useApp.getState().profile.track).toBe("ent");
    expect(host.textContent).toContain("СТРАНИЦА РАЗДЕЛА");
  });
});
