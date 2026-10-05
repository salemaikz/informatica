import type { Rarity } from "@/lib/rarity";
import type { DictKey } from "@/i18n/dict";

// Статические классы редкости (Tailwind не видит собранные на лету). Токены — globals.css, обе темы.

export const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-rarity-common",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  legendary: "text-rarity-legendary",
};

export const RARITY_SOFT: Record<Rarity, string> = {
  common: "bg-rarity-common-soft",
  rare: "bg-rarity-rare-soft",
  epic: "bg-rarity-epic-soft",
  legendary: "bg-rarity-legendary-soft",
};

export const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-rarity-common",
  rare: "border-rarity-rare",
  epic: "border-rarity-epic",
  legendary: "border-rarity-legendary",
};

export const RARITY_BG: Record<Rarity, string> = {
  common: "bg-rarity-common",
  rare: "bg-rarity-rare",
  epic: "bg-rarity-epic",
  legendary: "bg-rarity-legendary",
};

/** CSS-переменная цвета редкости — для SVG (`stroke`, `fill`) и градиентов. */
export const RARITY_VAR: Record<Rarity, string> = {
  common: "var(--rarity-common)",
  rare: "var(--rarity-rare)",
  epic: "var(--rarity-epic)",
  legendary: "var(--rarity-legendary)",
};

export const RARITY_LABEL: Record<Rarity, DictKey> = {
  common: "rarity.common",
  rare: "rarity.rare",
  epic: "rarity.epic",
  legendary: "rarity.legendary",
};
