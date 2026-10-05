"use client";

import { Award, Binary, Bug, CloudLightning, Crown, Handshake, Moon, Sprout, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import type { Rarity } from "@/lib/rarity";
import { useT } from "@/i18n/useT";
import { RARITY_SOFT, RARITY_TEXT } from "@/components/ui/rarity";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import s from "./cosmetics.module.css";
import { cosmeticName } from "./names";

/** Иконка титула (lucide; в данных `lib` хранится только id). */
const TITLE_ICON: Partial<Record<CosmeticId, LucideIcon>> = {
  "title-newbie": Sprout,
  "title-bit-friend": Handshake,
  "title-night-coder": Moon,
  "title-bug-hunter": Bug,
  "title-bit-lord": Binary,
  "title-algo-master": Workflow,
  "title-ent-storm": CloudLightning,
  "title-legend": Crown,
};

/** Значок титула (для плитки в ленте кейса и самой плашки). */
export function TitleGlyph({ id, size, className, strokeWidth = 2.4 }: { id: CosmeticId; size: number; className?: string; strokeWidth?: number }) {
  const Icon = TITLE_ICON[id] ?? Award;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

// Статические классы (Tailwind не видит собранные на лету): тонкая рамка плашки — цвет редкости, полупрозрачный.
const TAG_BORDER: Record<Rarity, string> = {
  common: "border-rarity-common/40",
  rare: "border-rarity-rare/50",
  epic: "border-rarity-epic/50",
  legendary: "border-rarity-legendary/60",
};

/** Плашка титула под именем: мягкий фон и цвет редкости; у легендарного — блик. Нет титула — ничего не рисует. */
export function TitleTag({ title, size = "md", className }: { title: CosmeticId | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const def = cosmeticDef(title);
  if (!def || def.slot !== "title") return null;
  return (
    <span
      data-title={def.id}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border text-center font-extrabold leading-tight",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : size === "lg" ? "gap-1.5 px-4 py-1.5 text-base" : "px-2.5 py-1 text-xs",
        RARITY_SOFT[def.rarity],
        RARITY_TEXT[def.rarity],
        TAG_BORDER[def.rarity],
        def.rarity === "legendary" && !reduce && s.shine,
        className,
      )}
    >
      <TitleGlyph id={def.id} size={size === "lg" ? 18 : size === "sm" ? 12 : 14} className="shrink-0" />
      <span className="min-w-0 break-words">{cosmeticName(def.id, t)}</span>
    </span>
  );
}
