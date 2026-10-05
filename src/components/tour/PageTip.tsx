"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { showPageTip } from "@/lib/tour";
import { entVisible } from "@/lib/school";
import type { TipId } from "@/lib/tips";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Mascot } from "@/components/mascot/Mascot";

type PageTipId = Extract<TipId, `page-${string}`>;

const TEXT: Record<PageTipId, DictKey> = {
  "page-practice": "tour.page.practice",
  "page-tutor": "tour.page.tutor",
  "page-materials": "tour.page.materials",
  "page-progress": "tour.page.progress",
  "page-school": "tour.page.school",
};

/**
 * Карточка «что здесь» вверху страницы (#104): Бит и одно предложение. Один раз: крестик или уход со страницы — и больше
 * не показывается. Пока идёт проводник первого входа (до обзора панели), не показывается совсем.
 */
export function PageTip({ id }: { id: PageTipId }) {
  const { t } = useT();
  const tips = useApp((s) => s.tips);
  const noteTip = useApp((s) => s.noteTip);
  const ent = useApp((s) => entVisible(s.profile));
  const shown = showPageTip(tips, id);

  // Ушли со страницы, пока карточка была видна, — считаем показанной. Отложено на такт: двойной монтаж React в разработке
  // (размонтирование → сразу монтирование) не должен убрать карточку.
  const shownRef = useRef(shown);
  const mounted = useRef(false);
  useEffect(() => {
    shownRef.current = shown;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (!mounted.current && shownRef.current) useApp.getState().noteTip(id);
      }, 0);
    };
  }, [id]);

  if (!shown) return null;
  return (
    <div role="note" className="flex items-center gap-3 rounded-3xl border-2 border-border bg-surface p-3 animate-fade-in">
      <Mascot mood="happy" size={44} className="shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{t(id === "page-practice" && !ent ? "tour.page.practice.school" : TEXT[id])}</p>
      <button
        type="button"
        onClick={() => noteTip(id)}
        aria-label={t("tour.page.close")}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted after:absolute after:-inset-1 hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
