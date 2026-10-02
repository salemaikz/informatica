"use client";

import { BookmarkPlus, Info, Maximize2, Minimize2, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DrawingCanvas, type DrawingHandle } from "@/components/lesson/DrawingCanvas";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import {
  addPage,
  blankPages,
  loadScratch,
  MAX_SCRATCH_PAGES,
  pageHasContent,
  removePage,
  saveScratch,
  type ScratchPage,
} from "@/lib/scratch";
import type { Stroke } from "@/lib/strokes";
import { useToolbox } from "./useToolbox";

const SAVE_DELAY = 600;
/** Сколько секунд после первого нажатия «Очистить»/«Удалить» ждём подтверждения вторым нажатием. */
const CONFIRM_MS = 3000;
const CANVAS_HEIGHT = 320;
/** Высота текстового поля вне полноэкранного режима: холст + панель инструментов (2 ряда: 48 + 40 px, отступы, рамка). */
const TEXT_HEIGHT = CANVAS_HEIGHT + 108;

type Mode = "draw" | "text";
type Armed = { kind: "clear" | "delete"; id: string } | null;

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Черновик — как лист А4 на ЕНТ: рисуй пальцем или пиши текстом, всё сохраняется само. Листов до 10, можно на весь экран. */
export function Scratchpad() {
  const { t } = useT();
  const toolboxOpen = useToolbox((s) => s.open);
  const [pages, setPages] = useState<ScratchPage[]>(() => blankPages());
  const [loaded, setLoaded] = useState(false);
  const [cur, setCur] = useState(0);
  const [mode, setMode] = useState<Mode>("draw");
  const [fullscreen, setFullscreen] = useState(false);
  // Действие, ожидающее подтверждения (второе нажатие в течение CONFIRM_MS).
  const [armed, setArmed] = useState<Armed>(null);
  // Меняется при загрузке и очистке — пересоздаёт холст (он читает сохранённый рисунок только при монтировании).
  const [gen, setGen] = useState(0);
  const canvas = useRef<DrawingHandle>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const fsBtn = useRef<HTMLButtonElement>(null);
  const prevFullscreen = useRef(false);
  const dirty = useRef(false);
  const latest = useRef(pages);

  // Панель инструментов закрылась (например, по Esc) — полноэкранный режим закрываем вместе с ней.
  if (fullscreen && !toolboxOpen) setFullscreen(false);

  useEffect(() => {
    latest.current = pages;
  }, [pages]);

  // Загрузка при открытии.
  useEffect(() => {
    let alive = true;
    loadScratch().then((saved) => {
      if (!alive) return;
      const next = saved.length ? saved : blankPages();
      setPages(next);
      setCur((c) => Math.min(c, next.length - 1));
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

  // Подтверждение гаснет само.
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);

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

  // Полный экран: Esc выходит. Пока панель инструментов перехватывает Esc сама (Toolbox, фаза capture),
  // Esc закрывает панель целиком, а полный экран сбрасывается вместе с ней (см. проверку toolboxOpen выше).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // При входе/выходе из полного экрана фокус — на кнопку переключения (она перерисована в новом месте).
  useEffect(() => {
    if (prevFullscreen.current === fullscreen) return;
    prevFullscreen.current = fullscreen;
    const raf = requestAnimationFrame(() => fsBtn.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [fullscreen]);

  // Выбранный лист всегда виден в ряду вкладок.
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cur, pages.length, fullscreen, loaded]);

  const patch = useCallback((idx: number, change: Partial<ScratchPage>) => {
    dirty.current = true;
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...change, updatedAt: Date.now() } : p)));
  }, []);

  const page = pages[cur] ?? pages[0];
  const isArmed = (kind: "clear" | "delete") => armed?.kind === kind && armed.id === page.id;

  // Штрихи сохраняем вектором сразу после каждого изменения (холст может скрыться при смене вкладки).
  const onStrokes = (list: Stroke[]) => patch(cur, { strokes: list.length ? list : undefined });
  // Холст очистили целиком — старая PNG-подложка тоже должна уйти из сохранения.
  const onDraw = (empty: boolean) => {
    if (empty && latest.current[cur]?.image) patch(cur, { image: undefined });
  };

  const selectPage = (i: number) => {
    setCur(i);
    setArmed(null);
  };

  // До загрузки листы не меняем: иначе автосохранение может записать пустые листы поверх сохранённых.
  const onAddPage = () => {
    if (!loaded) return;
    const next = addPage(pages);
    if (next === pages) return;
    dirty.current = true;
    setPages(next);
    setCur(next.length - 1);
    setArmed(null);
  };

  // Первое нажатие только «взводит» кнопку, второе (в течение 3 с) стирает текст и рисунок листа.
  const clearPage = () => {
    if (!isArmed("clear")) {
      setArmed({ kind: "clear", id: page.id });
      return;
    }
    setArmed(null);
    patch(cur, { text: "", image: undefined, strokes: undefined });
    setGen((g) => g + 1);
  };

  const deletePage = () => {
    if (!loaded || pages.length <= 1) return;
    if (!isArmed("delete")) {
      setArmed({ kind: "delete", id: page.id });
      return;
    }
    const next = removePage(pages, cur);
    dirty.current = true;
    setPages(next);
    setCur(Math.min(cur, next.length - 1));
    setArmed(null);
    setGen((g) => g + 1);
  };

  const toNotes = () => {
    const image = canvas.current?.exportPaper() ?? undefined;
    const text = page.text.trim() ? page.text : undefined;
    if (!image && !text) return;
    // Шторка выбора папки открывается поверх приложения — выходим из полного экрана, чтобы она была видна.
    setFullscreen(false);
    useSaveToNotes.getState().open({ source: "scratch", title: t("canvas.noteTitle", { n: cur + 1 }), image, text });
  };

  const iconBtn = cn(
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-border text-muted transition-colors",
    "hover:text-text disabled:cursor-not-allowed disabled:opacity-50",
    focusRing,
  );

  const renderPad = (fs: boolean) => (
    <>
      <div className="flex items-center gap-2">
        <div
          ref={tabsRef}
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t("canvas.pages")}
        >
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={cur === i}
              onClick={() => selectPage(i)}
              className={cn(
                "relative h-10 min-w-[4.5rem] shrink-0 rounded-xl border-2 px-3 text-sm font-bold transition-colors",
                focusRing,
                cur === i ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
              )}
            >
              {t("tools.page", { n: i + 1 })}
              {i !== cur && pageHasContent(p) && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddPage}
          disabled={!loaded || pages.length >= MAX_SCRATCH_PAGES}
          aria-label={t("canvas.addPage")}
          title={t("canvas.addPage")}
          className={cn(iconBtn, "h-10 w-10 shrink-0")}
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t("tools.scratch")}>
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
                focusRing,
                mode === m ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon size={16} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toNotes}
          disabled={!pageHasContent(page)}
          aria-label={t("canvas.toNotes")}
          title={t("canvas.toNotes")}
          className={cn(iconBtn, "hover:text-ai")}
        >
          <BookmarkPlus size={20} aria-hidden />
        </button>
        <button
          ref={fsBtn}
          type="button"
          onClick={() => setFullscreen(!fs)}
          aria-label={fs ? t("canvas.exitFullscreen") : t("canvas.fullscreen")}
          title={fs ? t("canvas.exitFullscreen") : t("canvas.fullscreen")}
          className={iconBtn}
        >
          {fs ? <Minimize2 size={20} aria-hidden /> : <Maximize2 size={20} aria-hidden />}
        </button>
      </div>

      {loaded && (
        <>
          <div className={cn(mode === "draw" ? (fs ? "flex min-h-0 flex-1 flex-col" : "block") : "hidden")}>
            <DrawingCanvas
              key={`${page.id}-${gen}-${fs ? "fs" : "in"}`}
              ref={canvas}
              initialImage={page.image}
              initialStrokes={page.strokes}
              onStrokes={onStrokes}
              onChange={onDraw}
              height={fs ? undefined : CANVAS_HEIGHT}
              fill={fs}
              className={fs ? "min-h-0 flex-1" : undefined}
            />
          </div>
          <textarea
            hidden={mode !== "text"}
            value={page.text}
            onChange={(e) => patch(cur, { text: e.target.value })}
            placeholder={t("tools.textPlaceholder")}
            aria-label={t("tools.text")}
            spellCheck={false}
            style={fs ? undefined : { height: TEXT_HEIGHT }}
            className={cn(
              "w-full resize-none rounded-2xl border-2 border-border bg-surface-2 p-3 font-mono text-base leading-relaxed text-text outline-none placeholder:text-muted focus:border-primary",
              fs && "min-h-0 flex-1",
            )}
          />
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearPage}
          disabled={!pageHasContent(page)}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
            isArmed("clear")
              ? "border-danger bg-danger-soft text-danger"
              : "border-border text-muted hover:text-danger disabled:hover:text-muted",
          )}
        >
          <Trash2 size={16} aria-hidden /> {isArmed("clear") ? t("common.delete") : t("tools.clear")}
        </button>
        <button
          type="button"
          onClick={deletePage}
          disabled={!loaded || pages.length <= 1}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
            isArmed("delete")
              ? "border-danger bg-danger-soft text-danger"
              : "border-border text-muted hover:text-danger disabled:hover:text-muted",
          )}
        >
          <X size={16} aria-hidden /> {isArmed("delete") ? t("canvas.deleteConfirm") : t("canvas.deletePage")}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {fullscreen ? (
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("tools.scratch")}
            data-scratch-fullscreen
            className="fixed inset-0 z-[60] flex flex-col gap-2 bg-bg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
          >
            {renderPad(true)}
          </div>,
          document.body,
        )
      ) : (
        <>
          {renderPad(false)}
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
            {t("tools.scratchHint")}
          </p>
        </>
      )}
    </div>
  );
}
