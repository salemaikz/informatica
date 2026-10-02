"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { useT } from "@/i18n/useT";

type PixelsScene = Extract<Scene, { kind: "pixels" }>;

/** Фокус пришёл с клавиатуры (старые браузеры без :focus-visible — считаем, что да). */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** Максимальный размер клетки, px. */
const CELL_MAX = 28;

/**
 * Растровая картинка: сетка квадратов, цвета — из палитры. С `codes` рядом строки кодов (как в данных);
 * наведение, фокус или нажатие на строку подсвечивает её в картинке.
 */
export function PixelsScene({ scene }: { scene: PixelsScene }) {
  const { t } = useT();
  const w = scene.rows[0]?.length ?? 1;
  const h = scene.rows.length;
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const focusRow = hover ?? pinned;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 min-[520px]:flex-row min-[520px]:justify-center min-[520px]:gap-5">
      <div
        role="img"
        aria-label={t("scene.pixels.aria", { w, h })}
        className="grid w-full gap-px overflow-hidden rounded-lg border border-border bg-border"
        style={{ gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))`, maxWidth: w * CELL_MAX + 2 }}
      >
        {scene.rows.map((row, r) =>
          row.split("").map((ch, c) => (
            <span
              key={`${r}:${c}`}
              className={cn("aspect-square transition-opacity duration-200", focusRow !== null && focusRow !== r && "opacity-35")}
              style={{ background: scene.palette[ch] }}
            />
          )),
        )}
      </div>

      {scene.codes && (
        <div className="flex flex-col gap-1">
          {scene.rows.map((row, r) => (
            <button
              key={r}
              type="button"
              aria-label={t("scene.pixels.row", { n: r + 1 })}
              aria-pressed={pinned === r}
              // Наведение — только мышью/пером: на телефоне касание закрепляет строку (onClick), а «залипший»
              // hover/фокус после касания не давал бы снять подсветку. Фокус подсвечивает только с клавиатуры.
              onPointerEnter={(e) => e.pointerType !== "touch" && setHover(r)}
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => focusVisible(e.currentTarget) && setHover(r)}
              onBlur={() => setHover(null)}
              onClick={() => setPinned((p) => (p === r ? null : r))}
              className={cn(
                "min-h-10 rounded-lg border px-2.5 py-1 text-left font-mono text-[13px] font-bold leading-5 tracking-[0.18em] transition-colors duration-200",
                focusRow === r ? "border-primary bg-primary-soft text-primary-strong" : "border-border bg-surface text-text",
              )}
            >
              {row}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
