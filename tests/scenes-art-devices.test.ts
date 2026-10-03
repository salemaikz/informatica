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
    // цвета — токены темы (var(--…)) или нейтральные блик/тень; без внешних картинок
    expect(html).not.toMatch(/<image|href=/);
    const fills = [...html.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
    for (const c of fills) {
      expect(c === "none" || c.includes("var(--") || c === "#ffffff" || c === "#000000", `${id}: ${c}`).toBe(true);
    }
  });
});
