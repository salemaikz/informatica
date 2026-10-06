// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfileCard } from "@/components/cosmetics/ProfileCard";
import { LEVEL_TITLES } from "@/lib/gamification";
import { useApp } from "@/lib/store";

// Звание уровня в карточке профиля (и в шторке примерки — там та же карточка) не обрезается многоточием:
// казахское «Жаңадан бастаушы» (~158 px) шире места рядом с аватаром (~130 px) и переносится на вторую строку.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

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

/** Абзац со званием уровня на нужном языке. */
const titleLine = (lang: "ru" | "kk"): HTMLElement => [...host.querySelectorAll("p")].find((p) => LEVEL_TITLES.some((x) => x[lang] === p.textContent))!;

describe("ProfileCard: звание уровня", () => {
  it("казахское звание 1-го уровня выводится целиком и без truncate", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await act(async () => root.render(createElement(ProfileCard)));
    const line = titleLine("kk");
    expect(line.textContent).toBe("Жаңадан бастаушы");
    expect(line.className).not.toMatch(/truncate|text-ellipsis|line-clamp|whitespace-nowrap/);
    // Перенос слов разрешён: длинное слово не вылезает за карточку.
    expect(line.className).toContain("break-words");
  });

  it("по-русски — то же правило", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "ru" } }));
    await act(async () => root.render(createElement(ProfileCard)));
    const line = titleLine("ru");
    expect(line.textContent).toBe("Новичок");
    expect(line.className).not.toMatch(/truncate|text-ellipsis|line-clamp|whitespace-nowrap/);
  });
});

describe("ProfileCard: уровень не повторяется на странице профиля", () => {
  it("по умолчанию (превью, примерка) уровень справа от аватара есть; showLevel={false} — его нет (на странице профиля ниже LevelCard)", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "ru" } }));
    await act(async () => root.render(createElement(ProfileCard)));
    expect(host.textContent).toContain("Новичок");
    expect(host.textContent).toContain("Уровень");
    await act(async () => root.render(createElement(ProfileCard, { showLevel: false })));
    expect(host.textContent).not.toContain("Новичок");
    expect(host.textContent).not.toContain("Уровень");
  });
});
