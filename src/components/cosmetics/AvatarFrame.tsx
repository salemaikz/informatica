"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import { RARITY_VAR } from "@/components/ui/rarity";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { FRAME_AVATAR_RATIO, FRAME_BOX, FrameArt } from "./frame-art";

/** Меньше этого размера аватара рамка — только тонкое кольцо цвета редкости (рисунок не разглядеть). */
export const FRAME_MIN_SIZE = 40;

/** Внешний размер блока с рамкой для аватара `size` (рамка добавляет по 12,5% с каждой стороны). */
export const frameOuterSize = (size: number): number => size / FRAME_AVATAR_RATIO;

/**
 * Рамка аватара: `<AvatarFrame frame={id | null} size={n}><Avatar … size={n} /></AvatarFrame>`.
 * Рамка рисуется SVG вокруг круга и не обрезает аватар; блок становится на 25% больше аватара (рамка занимает это место,
 * поэтому не налезает на соседей). Нет рамки — возвращает аватар как есть (с `reserve` — оставляет место под рамку,
 * чтобы раскладка не «прыгала» при смене). При size < 40 — только тонкое кольцо (`full` рисует полную рамку).
 * Анимации (орбита, неон, галактика, радуга) — CSS; выключаются «Меньше анимаций» и prefers-reduced-motion.
 */
export function AvatarFrame({
  frame,
  size,
  children,
  className,
  full,
  reserve,
}: {
  frame: CosmeticId | null | undefined;
  /** Диаметр аватара (того, что в children), px. */
  size: number;
  children: ReactNode;
  className?: string;
  full?: boolean;
  reserve?: boolean;
}) {
  const reduce = useReduceMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const def = cosmeticDef(frame);
  const thin = size < FRAME_MIN_SIZE && !full;

  if (!def || def.slot !== "frame") {
    if (!reserve || thin) return <>{children}</>;
    const outer = frameOuterSize(size);
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ width: outer, height: outer }}>
        {children}
      </span>
    );
  }

  if (thin) {
    return (
      <span
        className={cn("inline-flex shrink-0 rounded-full", className)}
        data-frame={def.id}
        style={{ boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${RARITY_VAR[def.rarity]}` }}
      >
        {children}
      </span>
    );
  }

  const outer = frameOuterSize(size);
  const pad = (outer - size) / 2;
  return (
    <span className={cn("relative inline-block shrink-0 align-middle", className)} data-frame={def.id} style={{ width: outer, height: outer }}>
      <span className="absolute flex" style={{ left: pad, top: pad, width: size, height: size }}>
        {children}
      </span>
      <svg viewBox={`0 0 ${FRAME_BOX} ${FRAME_BOX}`} width={outer} height={outer} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true" focusable="false">
        <FrameArt id={def.id} animate={!reduce} uid={uid} />
      </svg>
    </span>
  );
}
