"use client";

import { useEffect, useRef, useState } from "react";
import { padRect, placeBubble, type Rect } from "@/lib/tour";
import { useT } from "@/i18n/useT";
import { MascotSays, type Mood } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";

/** Максимальная ширина пузыря с маскотом, px. */
const BUBBLE_W = 360;
/** Зазор вокруг подсвеченного элемента, px. */
const HOLE_PAD = 6;

interface Box {
  vw: number;
  vh: number;
  ph: number;
}

/**
 * Затемнение экрана с вырезом вокруг `rect` и пузырь Бита рядом. `rect = null` — без выреза, пузырь по центру.
 * Нажатие на вырез = главная кнопка (подсвеченный элемент не «проваливается» под затемнение). Escape — `onEscape`
 * (закрыть весь проводник). Фокус — на главной кнопке; страница под затемнением не прокручивается.
 */
export function Spotlight({
  rect,
  mood = "happy",
  title,
  text,
  step,
  primary,
  onSkip,
  onEscape,
}: {
  rect: Rect | null;
  mood?: Mood;
  title?: string;
  text: string;
  step?: { n: number; total: number };
  primary: { label: string; onClick: () => void };
  onSkip?: () => void;
  onEscape: () => void;
}) {
  const { t } = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ vw: 0, vh: 0, ph: 0 });
  const escRef = useRef(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  });

  // Размеры окна и пузыря: меняем только из обратных вызовов (кадр, resize, ResizeObserver).
  useEffect(() => {
    const el = panelRef.current;
    const update = () => {
      const next = { vw: window.innerWidth, vh: window.innerHeight, ph: el?.offsetHeight ?? 0 };
      setBox((p) => (p.vw === next.vw && p.vh === next.vh && p.ph === next.ph ? p : next));
    };
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(update) : null;
    if (el) ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  // Escape и запрет прокрутки страницы под затемнением.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const measured = box.vw > 0;
  // Пузырь становится видимым после первого замера — тогда и переводим фокус.
  useEffect(() => {
    if (measured) panelRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [measured]);
  const hole = rect && measured ? padRect(rect, HOLE_PAD, box.vw, box.vh) : null;
  const pos = measured ? placeBubble(hole, { w: BUBBLE_W, h: box.ph, vw: box.vw, vh: box.vh }) : null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("tour.aria")}>
      {hole ? (
        <>
          {/* Затемнение — тень вокруг выреза; вырез повторяет подсвеченный элемент. */}
          <div aria-hidden className="absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
            style={{ top: hole.y, left: hole.x, width: hole.w, height: hole.h }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="absolute rounded-2xl"
            style={{ top: hole.y, left: hole.x, width: hole.w, height: hole.h }}
            onClick={primary.onClick}
          />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      )}

      <div
        ref={panelRef}
        className="absolute animate-fade-in"
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { top: 0, left: 12, width: `min(${BUBBLE_W}px, calc(100vw - 24px))`, visibility: "hidden" }}
      >
        <MascotSays mood={mood} size={56}>
          {title && <span className="block font-extrabold">{title}</span>}
          <span className="block">{text}</span>
          <span className="mt-3 flex items-center gap-2">
            {step && <span className="text-xs font-extrabold text-muted">{t("tour.step", { n: step.n, total: step.total })}</span>}
            <span className="ml-auto flex items-center gap-2">
              {onSkip && (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  {t("common.skip")}
                </Button>
              )}
              <Button size="md" data-primary onClick={primary.onClick}>
                {primary.label}
              </Button>
            </span>
          </span>
        </MascotSays>
      </div>
    </div>
  );
}
