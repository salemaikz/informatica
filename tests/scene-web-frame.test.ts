// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebScene } from "@/components/scenes/WebScene";
import { SAMPLES } from "@/components/scenes/samples/web";
import { WEB_BASE_CSS, buildWebDoc, webFrameHeight, webHtml } from "@/components/scenes/web";
import { useApp } from "@/lib/store";
import type { Scene } from "@/lib/types";

// Ревью v18b: на снимках окно index.html показывало серую заглушку вместо страницы. Причина — снимок до события load; здесь доказано,
// что документ строится корректно (sandbox, CSP, высота, белый фон), а заглушка снимается по load.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type WebScene = Extract<Scene, { kind: "web" }>;
const pages = SAMPLES.filter((s): s is WebScene => s.kind === "web" && !!s.page);

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
  vi.restoreAllMocks();
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

describe("web: окно page рисуется (iframe srcDoc)", () => {
  it("образцы page есть, у каждого страница непустая и белая: она закрывает подложку целиком", () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const s of pages) {
      const doc = buildWebDoc(webHtml(s, "ru"), s.css);
      expect(doc.startsWith("<!doctype html>")).toBe(true);
      expect(doc).toContain('<meta charset="utf-8">');
      expect(doc).toContain(`<body>${s.html}</body>`);
      // фон страницы непрозрачный белый: под iframe лежит подложка, сквозь страницу она не просвечивает
      expect(WEB_BASE_CSS).toMatch(/background:\s*#fff/);
      expect(doc).toContain(WEB_BASE_CSS);
    }
  });

  it("CSP документа не мешает показу: инлайновые стили разрешены, картинки — только data:, ни скриптов, ни сети; директивы sandbox / frame-ancestors нет", () => {
    const doc = buildWebDoc("<h1>x</h1>", "h1{color:red}");
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(doc)![1];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).toContain("img-src data:");
    expect(csp).not.toMatch(/script-src|connect-src|frame-ancestors|sandbox/);
    // стиль сцены внутри <style> — под разрешённый unsafe-inline
    expect(doc).toMatch(/<style>[^<]*h1\{color:red\}<\/style>/);
  });

  it("разметка: sandbox пустой, srcdoc целиком с содержимым страницы, высота окна не меньше 140 px, подложка под iframe", () => {
    for (const s of pages) {
      const out = renderToStaticMarkup(createElement(WebScene, { scene: s }));
      expect(out).toContain('sandbox=""');
      expect(out).not.toContain("allow-scripts");
      expect(out).not.toContain("allow-same-origin");
      const m = /srcDoc="([^"]*)"|srcdoc="([^"]*)"/.exec(out)!;
      const attr = (m[1] ?? m[2]).replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      expect(attr).toBe(buildWebDoc(s.html, s.css));
      const h = Number(/height:(\d+)px/.exec(out)![1]);
      expect(h).toBe(webFrameHeight(s.html));
      expect(h).toBeGreaterThanOrEqual(140);
      // подложка стоит раньше iframe (под ним) и до load есть
      expect(out.indexOf("data-web-placeholder")).toBeGreaterThan(-1);
      expect(out.indexOf("data-web-placeholder")).toBeLessThan(out.indexOf("<iframe"));
      expect(out).toContain('class="relative block size-full border-0 bg-transparent"');
    }
  });

  it("подложка снимается по событию load iframe; при смене документа (язык) возвращается до следующего load", async () => {
    // happy-dom сам шлёт load у iframe с srcdoc (в requestAnimationFrame после вставки) — гасим эти события, а своё посылаем вручную, как браузер после отрисовки
    let manual = false;
    const proto = window.HTMLIFrameElement.prototype;
    const orig = proto.dispatchEvent;
    const spy = vi.spyOn(proto, "dispatchEvent").mockImplementation(function (this: HTMLIFrameElement, e: Event) {
      return e.type === "load" && !manual ? true : orig.call(this, e);
    });
    const load = async (el: Element) => {
      manual = true;
      await act(async () => {
        el.dispatchEvent(new Event("load"));
      });
      manual = false;
    };
    const s = pages[0];
    await render(createElement(WebScene, { scene: s }));
    const frame = host.querySelector("iframe") as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain("Концерт");
    // до load подложка есть
    expect(host.querySelector("[data-web-placeholder]")).not.toBeNull();
    await load(frame);
    expect(host.querySelector("[data-web-placeholder]")).toBeNull();
    // другой документ (казахский текст) — новая страница, подложка снова до её load
    await act(async () => {
      useApp.setState((st) => ({ profile: { ...st.profile, lang: "kk" } }));
    });
    expect(host.querySelector("iframe")!.getAttribute("srcdoc")).toContain("Сенбі");
    expect(host.querySelector("[data-web-placeholder]")).not.toBeNull();
    await load(host.querySelector("iframe")!);
    expect(host.querySelector("[data-web-placeholder]")).toBeNull();
    spy.mockRestore();
  });
});
