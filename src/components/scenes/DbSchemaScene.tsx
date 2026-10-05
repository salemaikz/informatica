"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Link as LinkIcon } from "lucide-react";
import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { DB_GEO, dbSchemaAria, layoutDbSchema, roundedPath, type DbCard, type DbFieldBox } from "./db-schema";

type DbSchemaSceneData = Extract<Scene, { kind: "db-schema" }>;

/** Строка поля: значок (ключ / ссылка), имя (PK — жирнее), тип приглушённо; не влезло рядом — тип под именем. */
function FieldRow({ f, scale, first }: { f: DbFieldBox; scale: number; first: boolean }) {
  const nameStyle = { fontSize: DB_GEO.namePx * scale };
  const typeStyle = { fontSize: DB_GEO.typePx * scale };
  const Icon = f.pk ? KeyRound : f.fk ? LinkIcon : null;
  return (
    <div
      className={cn(
        "flex items-center transition-colors duration-200",
        !first && "border-t border-border/70",
        f.highlighted ? "bg-primary-soft" : "bg-surface",
      )}
      style={{ height: f.h, paddingLeft: DB_GEO.padX, paddingRight: DB_GEO.padX, gap: DB_GEO.iconGap }}
    >
      <span className="flex shrink-0 items-center justify-center text-primary-strong" style={{ width: DB_GEO.icon }} aria-hidden="true">
        {Icon && <Icon size={DB_GEO.icon} strokeWidth={2.4} />}
      </span>
      {f.stacked ? (
        <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
          <span className={cn("truncate", f.pk ? "font-extrabold" : "font-semibold", f.highlighted ? "text-primary-strong" : "text-text")} style={nameStyle}>
            {f.name}
          </span>
          <span className="truncate font-semibold text-muted" style={typeStyle}>
            {f.type}
          </span>
        </span>
      ) : (
        <>
          <span className={cn("min-w-0 truncate leading-none", f.pk ? "font-extrabold" : "font-semibold", f.highlighted ? "text-primary-strong" : "text-text")} style={nameStyle}>
            {f.name}
          </span>
          {f.type && (
            <span className="ml-auto shrink-0 pl-1 font-semibold leading-none text-muted" style={typeStyle}>
              {f.type}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Card({ card, scale, reduce }: { card: DbCard; scale: number; reduce: boolean }) {
  const t = reduce ? { duration: 0 } : springSoft;
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, scale: 0.96, x: card.x, y: card.y }}
      animate={{ opacity: 1, scale: 1, x: card.x, y: card.y }}
      transition={t}
      className={cn(
        "absolute left-0 top-0 overflow-hidden rounded-2xl border-2 bg-surface transition-colors duration-200",
        card.highlighted ? "border-primary" : "border-border",
      )}
      style={{ width: card.w, height: card.h }}
    >
      <div
        className={cn(
          "flex items-center justify-center truncate px-2 text-center font-extrabold leading-none transition-colors duration-200",
          card.highlighted ? "bg-primary-soft text-primary-strong" : "bg-surface-2 text-text",
        )}
        style={{ height: DB_GEO.headH, fontSize: card.headFont }}
      >
        <span className="truncate">{card.name}</span>
      </div>
      {card.fields.map((f, i) => (
        <FieldRow key={f.name} f={f} scale={scale} first={i === 0} />
      ))}
    </m.div>
  );
}

/**
 * Схема БД: карточки таблиц (имя, поля с типами, значки PK и FK) и линии связей FK → PK с подписями «1» и «N» у концов.
 * Раскладку считает `layoutDbSchema`; линии идут по коридору между колонками и не задевают текст полей.
 */
export function DbSchemaScene({ scene }: { scene: DbSchemaSceneData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvail(Math.max(120, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => layoutDbSchema(scene, avail), [scene, avail]);
  const hasPk = scene.tables.some((x) => x.fields.some((f) => f.pk));
  const hasFk = scene.tables.some((x) => x.fields.some((f) => f.fk));

  return (
    <div ref={ref} className="mx-auto w-full max-w-xl">
      <div role="img" aria-label={dbSchemaAria(scene, t)} className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
        {layout.cards.map((c) => (
          <Card key={c.name} card={c} scale={layout.scale} reduce={reduce} />
        ))}
        <svg width={layout.width} height={layout.height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {layout.links.map((l) => (
            <m.g
              key={`${l.id}|${l.points.map((p) => p.join(",")).join(" ")}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : 0.12 }}
            >
              <path
                d={roundedPath(l.points, 6)}
                fill="none"
                strokeWidth={l.highlighted ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-colors duration-200", l.highlighted ? "stroke-primary" : "stroke-muted")}
              />
              <circle cx={l.fk.x} cy={l.fk.y} r={3.5} className={cn("transition-colors duration-200", l.highlighted ? "fill-primary" : "fill-muted")} />
              <circle cx={l.pk.x} cy={l.pk.y} r={3.5} className={cn("transition-colors duration-200", l.highlighted ? "fill-primary" : "fill-muted")} />
            </m.g>
          ))}
          {layout.labels.map((lb, i) => (
            <text
              key={i}
              x={lb.x}
              y={lb.y}
              textAnchor={lb.anchor}
              fontSize={DB_GEO.cardLabelPx}
              fontWeight={800}
              className={cn("transition-colors duration-200", lb.highlighted ? "fill-primary-strong" : "fill-text")}
            >
              {lb.text}
            </text>
          ))}
        </svg>
      </div>
      {(hasPk || hasFk) && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-bold text-muted" aria-hidden="true">
          {hasPk && (
            <span className="inline-flex items-center gap-1">
              <KeyRound size={13} strokeWidth={2.4} className="text-primary-strong" />
              {t("scene.db.pk")}
            </span>
          )}
          {hasFk && (
            <span className="inline-flex items-center gap-1">
              <LinkIcon size={13} strokeWidth={2.4} className="text-primary-strong" />
              {t("scene.db.fk")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
