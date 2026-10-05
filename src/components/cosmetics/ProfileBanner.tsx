"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { BANNER_H, BANNER_W, BannerArt, DefaultBannerArt } from "./banner-art";

/**
 * Фон карточки профиля: полоса с SVG-рисунком на токенах темы (`banner` — id фона; нет — мягкий фон по умолчанию).
 * Размер задаёт вызывающий (`className="h-24"`): рисунок подгоняется по ширине и обрезается по высоте.
 * `children` кладётся поверх рисунка (в превью — имя на «плашке»); в самой карточке профиля текст стоит под полосой.
 * Анимации (плывущее сияние, вращение лучей, мерцание) — CSS; выключаются «Меньше анимаций» и prefers-reduced-motion.
 */
export function ProfileBanner({ banner, className, children }: { banner: CosmeticId | null | undefined; className?: string; children?: ReactNode }) {
  const reduce = useReduceMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const def = cosmeticDef(banner);
  const art = def && def.slot === "banner" ? def : null;
  return (
    <div className={cn("relative isolate overflow-hidden bg-primary-soft", className)} data-banner={art?.id}>
      <svg viewBox={`0 0 ${BANNER_W} ${BANNER_H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
        {art ? <BannerArt id={art.id} animate={!reduce} uid={uid} /> : <DefaultBannerArt />}
      </svg>
      {children && <div className="relative flex h-full w-full items-center justify-center">{children}</div>}
    </div>
  );
}
