// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { bareHeading, textHeight } from "@/components/guide/targets";

// Цели проводника: «голый» заголовок (рамке нужен зазор побольше) и «линейка» для высоты реплики.

afterEach(() => {
  document.body.innerHTML = "";
});

function el(html: string): HTMLElement {
  const box = document.createElement("div");
  box.innerHTML = html;
  document.body.appendChild(box);
  return box.firstElementChild as HTMLElement;
}

describe("bareHeading", () => {
  it("заголовок с подсказкой без своей карточки («Мини-игры», «Сердечки») — голый", () => {
    expect(bareHeading(el('<div data-tour="practice-games"><h2>Мини-игры</h2><p>Короткие игры</p></div>'))).toBe(true);
    expect(bareHeading(el("<h2>Сердечки</h2>"))).toBe(true);
  });
  it("карточка (фон, рамка или тень) или блок без заголовка — не голый", () => {
    expect(bareHeading(el('<div style="background-color: rgb(255, 255, 255)"><h2>Тема</h2></div>'))).toBe(false);
    expect(bareHeading(el('<div style="border-top: 2px solid red"><h3>Тема</h3></div>'))).toBe(false);
    expect(bareHeading(el('<div style="box-shadow: 0 4px 0 red"><h2>Тема</h2></div>'))).toBe(false);
    expect(bareHeading(el("<div><span>Язык</span><button>Қазақша</button></div>"))).toBe(false);
  });
});

describe("textHeight", () => {
  it("нет вёрстки (тесты) — null: высота пузыря берётся на глаз", () => {
    expect(textHeight("Привет! Я Бит.", 300)).toBeNull();
    expect(textHeight("", 300)).toBeNull();
  });
});
