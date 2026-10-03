import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEVICE_ART, DEVICE_IDS } from "@/components/scenes/hardware/devices";
import type { HardwareId } from "@/lib/types";

// Все устройства ввода/вывода и «компьютеры вокруг нас» из HardwareId.
const EXPECTED: HardwareId[] = [
  "keyboard", "mouse", "touchpad", "touchscreen", "mic", "webcam", "scanner", "gamepad",
  "monitor", "printer", "speakers", "headphones", "projector",
  "desktop", "laptop", "phone", "tablet", "smartwatch", "atm", "pos", "car", "server", "router",
];

describe("DEVICE_ART", () => {
  it("рисует все 23 устройства", () => {
    expect(EXPECTED).toHaveLength(23);
    expect([...DEVICE_IDS].sort()).toEqual([...EXPECTED].sort());
    expect(Object.keys(DEVICE_ART).sort()).toEqual([...EXPECTED].sort());
  });

  it.each(EXPECTED)("%s — <svg> с viewBox 0 0 120 90, только цвета темы", (id) => {
    const Art = (DEVICE_ART as Partial<Record<HardwareId, () => ReactElement>>)[id];
    expect(Art).toBeTypeOf("function");
    const html = renderToStaticMarkup(createElement(Art!));
    expect(html.startsWith("<svg")).toBe(true);
    expect(html).toMatch(/^<svg[^>]*viewBox="0 0 120 90"/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
    // цвета — только токены темы (var(--…)), без hex/rgb; без внешних картинок
    expect(html).not.toMatch(/<image|href=/);
    // Все цветовые значения: атрибуты fill/stroke/stop-color и свойства в style="…".
    const attrs = [...html.matchAll(/(?:fill|stroke|stop-color|color)="([^"]+)"/g)].map((m) => m[1]);
    const styles = [...html.matchAll(/style="([^"]*)"/g)].flatMap((m) =>
      [...m[1].matchAll(/(?:fill|stroke|stop-color|color|background(?:-color)?)\s*:\s*([^;]+)/g)].map((x) => x[1]),
    );
    for (const c of [...attrs, ...styles]) {
      if (c === "none") continue;
      expect(c, `${id}: ${c}`).toContain("var(--");
      // после удаления имён переменных не должно остаться «сырых» цветов
      const rest = c.replace(/var\(--[\w-]+/g, "").replace(/color-mix\(in srgb/g, "");
      expect(rest, `${id}: ${c}`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black)\b/i);
    }
  });
});
