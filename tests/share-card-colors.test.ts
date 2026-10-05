import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_COLORS } from "@/lib/share-card";

// Canvas не читает CSS-переменные: цвета карточки — hex-копии токенов светлой темы (:root в globals.css).
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const token = (name: string) => rootBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))?.[1]?.toLowerCase();
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("карточка: палитра совпадает с globals.css", () => {
  for (const [key, hex] of Object.entries(CARD_COLORS)) {
    it(`--${kebab(key)}`, () => {
      expect(token(kebab(key)), `нет токена --${kebab(key)} в :root`).toBe(hex.toLowerCase());
    });
  }
});
