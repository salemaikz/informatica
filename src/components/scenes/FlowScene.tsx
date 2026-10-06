"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { iconFor } from "./icons";
import { pointsAttr } from "./circuit";
import { layoutFlow, type FlowBox, type FlowScene as FlowSceneData } from "./flow";

/** Контур блока по форме. Активный блок — primary, остальные нейтральные; смена подсветки плавная (~200 мс). */
function Shape({ box, active }: { box: FlowBox; active: boolean }) {
  const l = box.cx - box.w / 2;
  const r = box.cx + box.w / 2;
  const t = box.cy - box.h / 2;
  const b = box.cy + box.h / 2;
  const cls = cn(
    "transition-colors duration-200",
    active ? "fill-primary-soft stroke-primary" : box.shape === "start" || box.shape === "end" ? "fill-surface-2 stroke-muted" : "fill-surface stroke-muted",
  );
  const common = { strokeWidth: active ? 2.5 : 2, strokeLinejoin: "round" as const, className: cls };
  switch (box.shape) {
    case "if":
      return <polygon {...common} points={`${box.cx},${t} ${r},${box.cy} ${box.cx},${b} ${l},${box.cy}`} />;
    case "io":
      return <polygon {...common} points={`${l + 14},${t} ${r},${t} ${r - 14},${b} ${l},${b}`} />;
    case "start":
    case "end":
      return <rect {...common} x={l} y={t} width={box.w} height={box.h} rx={box.h / 2} />;
    case "box":
    case "device":
      return <rect {...common} x={l} y={t} width={box.w} height={box.h} rx={14} />;
    default:
      return <rect {...common} x={l} y={t} width={box.w} height={box.h} rx={6} />;
  }
}

/**
 * Блок-схема на сетке: овалы, прямоугольники, ромбы, параллелограммы и карточки устройств, стрелки с одним изломом.
 * Размеры считаются по ширине контейнера (не масштабируем картинку целиком): подписи 13 px, а если слово не влезает
 * в блок — 12 или 11 px (см. flowFit). Переносим строки только между словами; если схема всё равно шире экрана — прокрутка.
 */
export function FlowScene({ scene }: { scene: FlowSceneData }) {
  const { t, l, lang } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(336);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvail(Math.max(120, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => layoutFlow(scene, avail, lang), [scene, avail, lang]);
  const nodeById = new Map(scene.nodes.map((n) => [n.id, n]));

  return (
    // Если слова не влезают даже на кегле 11 px (или ячейка < 56 px), схема прокручивается внутри сцены.
    <div ref={ref} className="mx-auto w-full max-w-xl overflow-x-auto">
      <div
        role="img"
        aria-label={`${t("scene.flow.aria")}: ${scene.nodes.map((n) => l(n.label)).join(", ")}`}
        className="relative mx-auto"
        style={{ width: layout.width, height: layout.height }}
      >
        <svg width={layout.width} height={layout.height} className="absolute inset-0 overflow-visible" aria-hidden>
          {layout.boxes.map((box) => (
            <Shape key={box.id} box={box} active={scene.active === box.id} />
          ))}
          {layout.edges.map((e, i) => (
            <g key={`${e.from}>${e.to}:${i}`}>
              <polyline points={pointsAttr(e.points)} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-muted" />
              <polygon points={e.arrow.map((p) => p.join(",")).join(" ")} className="fill-muted stroke-muted" strokeWidth={1} strokeLinejoin="round" />
            </g>
          ))}
          {scene.edges.map((edge, i) => {
            const geom = layout.edges.find((g) => g.from === edge.from && g.to === edge.to);
            if (!geom || !edge.label) return null;
            return (
              <text key={`lbl:${i}`} x={geom.labelAt[0]} y={geom.labelAt[1]} textAnchor={geom.labelAnchor} fontSize={layout.fontPx} fontWeight={800} className="fill-muted">
                {l(edge.label)}
              </text>
            );
          })}
        </svg>

        {layout.boxes.map((box) => {
          const node = nodeById.get(box.id)!;
          const Icon = node.icon ? iconFor(node.icon) : null;
          const showIcon = Icon && node.shape === "device";
          return (
            <div
              key={box.id}
              lang={lang}
              className={cn(
                "absolute flex items-center justify-center overflow-hidden text-center font-bold leading-tight text-text",
                node.shape === "device" && "flex-col gap-0.5",
              )}
              style={{ left: box.cx - box.w / 2, top: box.cy - box.h / 2, width: box.w, height: box.h, fontSize: layout.fontPx }}
            >
              {showIcon && <Icon size={22} strokeWidth={2.2} className={cn("shrink-0", scene.active === box.id ? "text-ink-primary" : "text-primary-strong")} />}
              {/* Колонка текста посчитана в layoutFlow (у ромба — вписанный прямоугольник). Рвать слова не даём; дефис — только если слово почти во всю колонку. */}
              <span className={cn("line-clamp-3 max-w-full break-normal", box.tight ? "hyphens-auto" : "hyphens-none")} style={{ width: box.textW }}>
                {l(node.label)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
