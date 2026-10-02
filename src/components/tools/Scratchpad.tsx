"use client";

import { Info, Pencil, Trash2, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingCanvas, type DrawingHandle } from "@/components/lesson/DrawingCanvas";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { loadScratch, MAX_SCRATCH_PAGES, saveScratch, type ScratchPage } from "@/lib/scratch";

const SAVE_DELAY = 600;
/** Сколько секунд после первого нажатия «Очистить» ждём подтверждения вторым нажатием. */
const CONFIRM_MS = 3000;
const CANVAS_HEIGHT = 320;

const emptyPage = (i: number): ScratchPage => ({ id: `p${i + 1}`, text: "", updatedAt: 0 });
const blankPages = () => Array.from({ length: MAX_SCRATCH_PAGES }, (_, i) => emptyPage(i));

/** Всегда три листа: недостающие добавляем пустыми. */
function fillPages(saved: ScratchPage[]): ScratchPage[] {
  return Array.from({ length: MAX_SCRATCH_PAGES }, (_, i) => saved[i] ?? emptyPage(i));
}

type Mode = "draw" | "text";

/** Черновик — как лист А4 на ЕНТ: рисуй пальцем или пиши текстом, всё сохраняется само. */
export function Scratchpad() {
  const { t } = useT();
  const [pages, setPages] = useState<ScratchPage[]>(blankPages);
  const [loaded, setLoaded] = useState(false);
  const [cur, setCur] = useState(0);
  const [mode, setMode] = useState<Mode>("draw");
  // Лист, для которого «Очистить» ждёт подтверждения (второе нажатие в течение CONFIRM_MS).
  const [armedPage, setArmedPage] = useState<number | null>(null);
  // Меняется при загрузке и очистке — пересоздаёт холст (он читает сохранённый рисунок только при монтировании).
  const [gen, setGen] = useState(0);
  const canvas = useRef<DrawingHandle>(null);
  const dirty = useRef(false);
  const latest = useRef(pages);

  useEffect(() => {
    latest.current = pages;
  }, [pages]);

  // Загрузка при открытии.
  useEffect(() => {
    let alive = true;
    loadScratch().then((saved) => {
      if (!alive) return;
      setPages(fillPages(saved));
      setLoaded(true);
      setGen((g) => g + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Автосохранение с задержкой: каждое изменение сбрасывает таймер.
  useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => {
      dirty.current = false;
      void saveScratch(pages);
    }, SAVE_DELAY);
    return () => clearTimeout(id);
  }, [pages]);

  // Подтверждение очистки гаснет само.
  useEffect(() => {
    if (armedPage === null) return;
    const id = setTimeout(() => setArmedPage(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armedPage]);

  // Не теряем несохранённое при закрытии вкладки и размонтировании.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      void saveScratch(latest.current);
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const patch = useCallback((idx: number, change: Partial<ScratchPage>) => {
    dirty.current = true;
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...change, updatedAt: Date.now() } : p)));
  }, []);

  // Конец штриха / отмена / очистка холста: снимаем рисунок сразу (холст может скрыться при смене вкладки).
  const onDraw = () => {
    const img = canvas.current?.exportImage();
    if (img === null || img === undefined) return;
    patch(cur, { image: img || undefined });
  };

  const page = pages[cur];
  const hasContent = (p: ScratchPage) => p.text.trim() !== "" || !!p.image;
  const armed = armedPage === cur && hasContent(page);

  // Первое нажатие только «взводит» кнопку, второе (в течение 3 с) стирает текст и рисунок листа.
  const clearPage = () => {
    if (!armed) {
      setArmedPage(cur);
      return;
    }
    setArmedPage(null);
    patch(cur, { text: "", image: undefined });
    setGen((g) => g + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1.5" role="tablist" aria-label={t("tools.scratch")}>
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={cur === i}
              onClick={() => {
                setCur(i);
                setArmedPage(null);
              }}
              className={cn(
                "relative h-10 flex-1 rounded-xl border-2 px-2 text-sm font-bold transition-colors",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                cur === i ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
              )}
            >
              {t("tools.page", { n: i + 1 })}
              {i !== cur && hasContent(p) && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t("tools.scratch")}>
          {(
            [
              ["draw", Pencil, t("tools.draw")],
              ["text", Type, t("tools.text")],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                mode === m ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon size={16} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clearPage}
          disabled={!hasContent(page)}
          className={cn(
            "flex h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
            armed
              ? "border-danger bg-danger-soft text-danger"
              : "border-border text-muted hover:text-danger disabled:hover:text-muted",
          )}
        >
          <Trash2 size={16} aria-hidden /> {armed ? t("common.delete") : t("tools.clear")}
        </button>
      </div>

      {loaded && (
        <>
          <div hidden={mode !== "draw"}>
            <DrawingCanvas
              key={`${page.id}-${gen}`}
              ref={canvas}
              initialImage={page.image}
              height={CANVAS_HEIGHT}
              onChange={onDraw}
            />
          </div>
          <textarea
            hidden={mode !== "text"}
            value={page.text}
            onChange={(e) => patch(cur, { text: e.target.value })}
            placeholder={t("tools.textPlaceholder")}
            aria-label={t("tools.text")}
            spellCheck={false}
            style={{ height: CANVAS_HEIGHT + 56 }}
            className="w-full resize-none rounded-2xl border-2 border-border bg-surface-2 p-3 font-mono text-base leading-relaxed text-text outline-none placeholder:text-muted focus:border-primary"
          />
        </>
      )}

      <p className="flex items-start gap-1.5 text-sm text-muted">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        {t("tools.scratchHint")}
      </p>
    </div>
  );
}
