"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  BLOCK2_H,
  BOX_LAYERS,
  bandFont,
  boxGeometry,
  boxRuler,
  formatSides,
  sides4,
  layerDim,
  contentWidth,
  type BoxLayer,
  type Sides4,
} from "./box";

type BoxSceneData = Extract<Scene, { kind: "box" }>;

type BandLayer = Exclude<BoxLayer, "content">;

/** Цвет слоя: токен заливки, токен рамки, насколько густая заливка в обычном и приглушённом виде. */
const LAYER: Record<BoxLayer, { fill: string; stroke: string; on: number; off: number; width: number; dashed: boolean }> = {
  margin: { fill: "--warning-soft", stroke: "--warning", on: 100, off: 30, width: 1.5, dashed: true },
  border: { fill: "--muted", stroke: "--muted", on: 45, off: 15, width: 2, dashed: false },
  padding: { fill: "--success-soft", stroke: "--success", on: 100, off: 30, width: 1.5, dashed: false },
  content: { fill: "--primary-soft", stroke: "--primary", on: 100, off: 30, width: 1.5, dashed: false },
};

/** Пилюли чисел в линейке — цвета слоёв (классы целиком, чтобы Tailwind их увидел). */
const PILL: Record<BoxLayer | "total", string> = {
  margin: "bg-warning-soft text-warning-strong",
  border: "bg-surface-2 text-text",
  padding: "bg-success-soft text-success-strong",
  content: "bg-primary-soft text-primary-strong",
  total: "bg-surface text-text ring-1 ring-border",
};

/** Заливка слоя: color-mix поверх фона сцены (анимируется как background-color). */
function tint(layer: BoxLayer, dim: boolean): string {
  const s = LAYER[layer];
  return `color-mix(in srgb, var(${s.fill}) ${dim ? s.off : s.on}%, var(--surface))`;
}

function layerStyle(layer: BoxLayer, dim: boolean, th: Sides4 | null, visible: boolean, reduce: boolean): CSSProperties {
  const s = LAYER[layer];
  // Слой «пустой» (все стороны 0): рамку не рисуем, чтобы не вводить в заблуждение.
  const show = visible || layer === "content";
  return {
    padding: th ? `${th[0]}px ${th[1]}px ${th[2]}px ${th[3]}px` : undefined,
    backgroundColor: tint(layer, dim),
    borderWidth: show ? s.width : 0,
    borderStyle: s.dashed ? "dashed" : "solid",
    borderColor: dim ? "var(--border)" : `var(${s.stroke})`,
    transition: reduce ? undefined : "padding 300ms ease, border-color 250ms ease, background-color 250ms ease",
  };
}

/** Число на стороне слоя: в середине своей полосы (верх/низ — по ширине, лево/право — по высоте). */
function SideNumbers({ layer, th, values, on }: { layer: BandLayer; th: Sides4; values: Sides4; on: [boolean, boolean, boolean, boolean] }) {
  const cls = "pointer-events-none absolute flex items-center justify-center font-bold leading-none text-text";
  const style = { fontSize: bandFont(layer) };
  return (
    <>
      {on[0] && <span className={cls} style={{ ...style, left: 0, right: 0, top: 0, height: th[0] }}>{values[0]}</span>}
      {on[2] && <span className={cls} style={{ ...style, left: 0, right: 0, bottom: 0, height: th[2] }}>{values[2]}</span>}
      {on[3] && <span className={cls} style={{ ...style, top: 0, bottom: 0, left: 0, width: th[3] }}>{values[3]}</span>}
      {on[1] && <span className={cls} style={{ ...style, top: 0, bottom: 0, right: 0, width: th[1] }}>{values[1]}</span>}
    </>
  );
}

function Legend({ highlight }: { highlight: BoxSceneData["highlight"] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold text-muted" aria-hidden="true">
      {BOX_LAYERS.map((layer) => (
        <li key={layer} className={cn("flex items-center gap-1 transition-opacity", layerDim(layer, highlight) && "opacity-40")}>
          <span
            className="inline-block size-2.5 rounded-[3px]"
            style={{
              backgroundColor: `var(${LAYER[layer].fill})`,
              opacity: layer === "border" ? 0.6 : 1,
              border: `1.5px ${LAYER[layer].dashed ? "dashed" : "solid"} var(${LAYER[layer].stroke})`,
            }}
          />
          {layer}
        </li>
      ))}
    </ul>
  );
}

/** Блочная модель CSS: вложенные слои margin → border → padding → content, числа px на сторонах, линейка ширины. */
export function BoxScene({ scene }: { scene: BoxSceneData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const g = boxGeometry(scene);
  // Блок не сжимается сам (это HTML, не SVG): если контейнер уже блока — масштабируем целиком.
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvail(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = avail !== null && avail > 0 ? Math.min(1, avail / g.outerW) : 1;
  const hl = scene.highlight;
  const dim = (layer: BoxLayer) => layerDim(layer, hl);

  const layers: Record<BandLayer, { th: Sides4; values: Sides4 }> = {
    margin: { th: g.margin, values: sides4(scene.margin) },
    border: { th: g.border, values: sides4(scene.border) },
    padding: { th: g.padding, values: sides4(scene.padding) },
  };

  const wrap = (layer: BandLayer, children: ReactNode) => (
    <div className="relative" style={layerStyle(layer, dim(layer), layers[layer].th, g.visible[layer], reduce)}>
      <SideNumbers layer={layer} th={layers[layer].th} values={layers[layer].values} on={g.labelled[layer]} />
      {children}
    </div>
  );

  const aria =
    t("scene.box.aria", {
      content: contentWidth(scene),
      padding: formatSides(scene.padding),
      border: formatSides(scene.border),
      margin: formatSides(scene.margin),
    }) + (g.collapse ? t("scene.box.ariaCollapse", { gap: g.collapse.max }) : "");

  const c = g.collapse;
  const ruler = scene.total ? boxRuler(scene) : [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
      <Legend highlight={hl} />

      <div ref={ref} className="w-full">
        <div className="mx-auto" style={{ width: g.outerW * scale, height: g.totalH * scale }}>
          <div role="img" aria-label={aria} className="relative" style={{ width: g.outerW, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: "top left" }}>
        {wrap(
          "margin",
          wrap(
            "border",
            wrap(
              "padding",
              <div
                className="flex items-center justify-center text-center font-mono font-bold text-primary-strong"
                style={{ ...layerStyle("content", dim("content"), null, true, reduce), width: g.contentW, height: g.contentH, fontSize: g.contentFont }}
              >
                {g.contentLabel}
              </div>,
            ),
          ),
        )}

        {c && (
          <>
            {/* второй блок: его верхний margin заходит на нижний margin первого — виден один, больший, отступ */}
            <div style={{ marginTop: c.block2Top, transition: reduce ? undefined : "margin-top 300ms ease" }}>
              {c.dB > 0 && (
                <div
                  style={{
                    height: c.dB,
                    backgroundColor: tint("margin", dim("margin")),
                    border: `${LAYER.margin.width}px dashed ${dim("margin") ? "var(--border)" : "var(--warning)"}`,
                    borderBottom: 0,
                    transition: reduce ? undefined : "background-color 250ms ease, border-color 250ms ease",
                  }}
                />
              )}
              <div
                className="flex items-center justify-center rounded-sm font-bold text-muted"
                style={{
                  marginLeft: g.margin[3] + c.mStroke,
                  width: g.outerW - g.margin[1] - g.margin[3] - 2 * c.mStroke,
                  height: BLOCK2_H,
                  border: "2px solid var(--muted)",
                  backgroundColor: "var(--surface-2)",
                  fontSize: 12,
                }}
                aria-hidden="true"
              >
                2
              </div>
            </div>
            <div
              className="pointer-events-none absolute left-0 right-0 flex justify-center"
              style={{ top: c.labelTop, transform: "translateY(-50%)" }}
              aria-hidden="true"
            >
              <span className="rounded-md border border-warning bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-warning-strong">{c.label}</span>
            </div>
          </>
        )}
          </div>
        </div>
      </div>

      {ruler.length > 0 && (
        <div className="flex flex-col items-center gap-2.5">
          {ruler.map((line, i) => (
            <p key={i} className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center font-mono text-[13px] font-bold text-text">
              {line.head && <span className="whitespace-nowrap">{line.head}</span>}
              {line.terms.map((term, j) => (
                <span key={j} className="whitespace-nowrap">
                  <span className={cn("rounded-md px-1.5 py-0.5", PILL[term.layer])}>{term.text}</span>
                  {j < line.terms.length - 1 && <span className="text-muted"> +</span>}
                </span>
              ))}
              {line.total && <span className="whitespace-nowrap">= {line.total}</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
