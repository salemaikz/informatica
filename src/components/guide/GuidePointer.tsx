"use client";

import { Pointer } from "lucide-react";
import { m } from "motion/react";
import type { FingerPose, Rect } from "@/lib/guide";

/** Размер пальца-указателя, px; кончик пальца у иконки Pointer — в точке (8; 2) из 24. Сколько места он занимает с «тычком» — `fingerRect` в lib/guide.ts. */
export const FINGER = 40;
const TIP_X = (8 / 24) * FINGER;
const TIP_Y = (2 / 24) * FINGER;

const FADE = { duration: 0.2 } as const;

/**
 * Затемнение с вырезом и рамка у цели. Видимое затемнение — тень вокруг скруглённого выреза (повторяет форму элемента),
 * а нажатия ловят 4 прозрачных прямоугольника вокруг выреза: над самой целью ничего нет, поэтому она нажимается.
 * Выреза нет (шаг без цели) — затемнён и закрыт для нажатий весь экран: шаг модальный.
 * Нажатие на затемнение — `onDimTap` (Бит качает головой), страница его не получает.
 */
export function GuideDim({
  stepKey,
  hole,
  radius,
  vw,
  vh,
  reduce,
  onDimTap,
}: {
  /** Новый шаг — рамка появляется заново (затемнение просто переезжает). */
  stepKey: string;
  hole: Rect | null;
  radius: number;
  vw: number;
  vh: number;
  reduce: boolean;
  onDimTap: () => void;
}) {
  const catchers: Rect[] = hole
    ? [
        { x: 0, y: 0, w: vw, h: hole.y },
        { x: 0, y: hole.y + hole.h, w: vw, h: Math.max(0, vh - hole.y - hole.h) },
        { x: 0, y: hole.y, w: hole.x, h: hole.h },
        { x: hole.x + hole.w, y: hole.y, w: Math.max(0, vw - hole.x - hole.w), h: hole.h },
      ]
    : [{ x: 0, y: 0, w: vw, h: vh }];
  const r = hole ? Math.min(radius, hole.h / 2, hole.w / 2) : 0;
  const box = hole ? { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: r } : null;
  return (
    <m.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
      {catchers.map((d, i) => (
        <div
          key={i}
          aria-hidden
          data-guide-dim=""
          className="pointer-events-auto absolute touch-none"
          style={{ left: d.x, top: d.y, width: d.w, height: d.h }}
          onPointerDown={(e) => {
            e.preventDefault();
            onDimTap();
          }}
        />
      ))}
      {box ? (
        <>
          {/* Лёгкое затемнение (≈35 %) — огромная тень вокруг выреза. */}
          <div aria-hidden className="pointer-events-none absolute shadow-[0_0_0_200vmax_rgb(0_0_0/0.35)]" style={box} />
          {/* Рамка повторяет форму цели и пульсирует (кольцо `pulse-ring`; «Меньше анимаций» гасит его в CSS). */}
          <m.div
            key={`frame:${stepKey}`}
            aria-hidden
            className="pointer-events-none absolute border-[3px] border-primary motion-safe:animate-pulse-ring"
            style={box}
            initial={{ opacity: 0, scale: reduce ? 1 : 1.12 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          />
        </>
      ) : (
        // Без цели — то же лёгкое затемнение на весь экран.
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/35" />
      )}
    </m.div>
  );
}

/**
 * Палец-указатель: обёртка стоит кончиком на цели и повёрнута к ней (`fingerPose`), внутри — «тычок» вдоль пальца.
 * Палец сверху (`flip`) ещё и отражён вдоль своей оси: кисть смотрит вниз, а не лежит «вверх ногами».
 * Рисуется поверх пузыря: короткий палец не прячется за ним, когда цель близко к Биту.
 */
export function GuideFinger({ stepKey, finger, reduce }: { stepKey: string; finger: FingerPose; reduce: boolean }) {
  return (
    <m.div
      aria-hidden
      data-guide-finger=""
      data-flip={finger.flip ? "" : undefined}
      className="pointer-events-none absolute left-0 top-0"
      style={{ x: finger.x, y: finger.y, rotate: finger.angle, originX: 0, originY: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
    >
      <div style={{ transform: finger.flip ? "scaleX(-1)" : undefined, transformOrigin: "0 0" }}>
        <m.div
          key={stepKey}
          className="absolute text-primary drop-shadow-[0_2px_3px_rgb(0_0_0/0.3)]"
          style={{ left: -TIP_X, top: -TIP_Y, width: FINGER, height: FINGER }}
          initial={{ y: 22 }}
          animate={reduce ? { y: 4 } : { y: [16, 2, 16] }}
          transition={reduce ? FADE : { duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Белая «подложка» — палец виден и на затемнении, и на светлом фоне. */}
          <Pointer size={FINGER} strokeWidth={4.5} className="absolute inset-0 text-surface" aria-hidden />
          <Pointer size={FINGER} strokeWidth={2.25} className="absolute inset-0" aria-hidden />
        </m.div>
      </div>
    </m.div>
  );
}
