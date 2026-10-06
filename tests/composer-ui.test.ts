// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Composer } from "@/components/chat/Composer";
import { dict } from "@/i18n/dict";
import { useApp } from "@/lib/store";

// Поле ввода чата Бита: подсказка в пустом поле — в одну строку с многоточием. Родной placeholder у textarea
// переносится, и на 360 px вторая строка казахского «Кез келген сұрақ қой…» торчала срезанной (dock-panel-kk-dark).

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

const noop = () => {};
const render = (draft: string, placeholder: string) =>
  act(async () => {
    root.render(
      createElement(Composer, {
        draft,
        onDraft: noop,
        onImage: noop,
        placeholder,
        streaming: false,
        onSend: noop,
        onStop: noop,
        onAttach: noop,
        onVoiceText: noop,
        onVoiceError: noop,
      }),
    );
  });
const hint = () => host.querySelector<HTMLElement>("[data-composer-hint]");
const field = () => host.querySelector("textarea")!;

describe("Composer: подсказка в пустом поле", () => {
  for (const lang of ["kk", "ru"] as const) {
    for (const key of ["tutor.placeholder", "chat2.check.placeholder"] as const) {
      it(`${lang}, ${key}: одна строка с многоточием поверх поля; родной placeholder — прозрачный, для читалок`, async () => {
        useApp.setState((s) => ({ profile: { ...s.profile, lang } }));
        const text = dict[key][lang];
        await render("", text);
        const h = hint()!;
        expect(h.textContent).toBe(text);
        // truncate: одна строка (nowrap), лишнее — многоточием, без переноса на срезанную вторую строку.
        expect(h.className).toContain("truncate");
        expect(h.getAttribute("aria-hidden")).toBe("true");
        expect(h.className).toContain("pointer-events-none");
        // Родная подсказка остаётся (имя поля для читалок, getByPlaceholder в e2e), но не видна.
        expect(field().getAttribute("placeholder")).toBe(text);
        expect(field().className).toContain("placeholder:text-transparent");
        expect(field().getAttribute("rows")).toBe("1");
      });
    }
  }

  it("начали печатать — подсказки нет", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await render("Екілік", dict["tutor.placeholder"].kk);
    expect(hint()).toBeNull();
  });
});
