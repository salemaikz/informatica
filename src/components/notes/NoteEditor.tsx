"use client";

import {
  Bold,
  Check,
  ChevronLeft,
  Code,
  Ellipsis,
  FileCode,
  Heading2,
  Highlighter,
  ImagePlus,
  List,
  ListChecks,
  ListOrdered,
  PenTool,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { lessonMeta } from "@/content/catalog";
import { Markdown } from "@/components/Markdown";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/image";
import { NoteImageError, deleteImages, putImage } from "@/lib/note-images";
import {
  MARK_COLORS,
  codeBlock,
  imageIds,
  insertBlock,
  insertText,
  markSyntax,
  prefixLines,
  toggleTaskAt,
  wrapSelection,
  type Edit,
  type LineKind,
  type MarkColor,
} from "@/lib/note-markdown";
import { NOTE_LIMITS, type Note } from "@/lib/notebook";
import { useApp } from "@/lib/store";
import { DrawingModal } from "./DrawingModal";
import { useFolderName } from "./folder-ui";
import { NoteMenu } from "./NoteMenu";

type ToolKey = "h" | "b" | "mark" | "ul" | "ol" | "todo" | "code" | "block" | "sym" | "photo" | "draw";

const SYMBOLS = ["₂", "₈", "₁₀", "₁₆", "²", "³", "ⁱ", "→", "≤", "≥", "≠", "¬", "∧", "∨", "·"];

const MARK_STYLE: Record<MarkColor, string> = {
  y: "bg-gold-soft border-gold/50",
  g: "bg-success-soft border-success/50",
  b: "bg-primary-soft border-primary/50",
  p: "bg-danger-soft border-danger/50",
};

const btn = "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border-2 border-transparent px-2 text-text transition-colors hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-3 focus-visible:outline-primary";

/** Экран записи: по id записи из стора. Нет записи — спокойное сообщение. */
export function NoteEditor({ id }: { id: string }) {
  const { t } = useT();
  const note = useApp((s) => s.notebook.notes.find((n) => n.id === id));
  // Запись удалили из меню — пока идёт переход, не мигаем сообщением «не найдена».
  const [seen, setSeen] = useState(false);
  if (note && !seen) setSeen(true);
  if (!note)
    return seen ? null : (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-extrabold">{t("notes2.note.notFound")}</p>
        <p className="font-semibold text-muted">{t("notes2.note.notFoundHint")}</p>
        <ButtonLink href="/notes">{t("notes2.toNotes")}</ButtonLink>
      </Card>
    );
  // Поля стартуют со значений записи; дальше правит редактор (key — смена записи пересоздаёт его).
  return <EditorBody key={id} note={note} />;
}

function EditorBody({ note }: { note: Note }) {
  const { t, l } = useT();
  const router = useRouter();
  const id = note.id;
  const folder = useApp((s) => s.notebook.folders.find((f) => f.id === note.folderId));
  const folderName = useFolderName();
  const lesson = note.lessonId ? lessonMeta(note.lessonId) : undefined;

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [panel, setPanel] = useState<null | "mark" | "symbols">(null);
  const [menu, setMenu] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  /** Последнее выделение в тексте: поле пересоздаётся при смене вкладки и теряет курсор. */
  const lastSel = useRef<[number, number] | null>(null);
  const latest = useRef({ title, body });
  useEffect(() => {
    latest.current = { title, body };
  }, [title, body]);

  // ---- автосохранение: 500 мс после ввода, на blur и при уходе ----
  const flush = useCallback(() => {
    const cur = useApp.getState().notebook.notes.find((n) => n.id === id);
    if (!cur) return;
    const { title: ti, body: bo } = latest.current;
    if (cur.title !== ti || cur.body !== bo) useApp.getState().updateNote(id, { title: ti, body: bo });
  }, [id]);

  useEffect(() => {
    if (title === note.title && body === note.body) return;
    const timer = setTimeout(() => {
      flush();
      setStatus("saved");
    }, 500);
    return () => clearTimeout(timer);
    // note.* — исходные значения записи; нужны только для первого сравнения, пересоздавать таймер при их смене не надо.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
      // Уходим из записи: фото и рисунки, ссылки на которые стёрли из текста, удаляем из IndexedDB (иначе копятся).
      const cur = useApp.getState().notebook.notes.find((n) => n.id === id);
      if (!cur?.images?.length) return;
      const used = new Set(imageIds(cur.body));
      const orphans = cur.images.filter((x) => !used.has(x));
      if (!orphans.length) return;
      useApp.getState().updateNote(id, { images: cur.images.filter((x) => used.has(x)) });
      void deleteImages(orphans);
    };
  }, [flush, id]);

  const change = (setter: (v: string) => void, v: string, max: number) => {
    setter(v.slice(0, max));
    setStatus("saving");
  };

  // Высота поля растёт вместе с текстом (страница прокручивается, а не само поле).
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [body, tab]);

  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [title]);

  // Выделение после правки панелью (поле перерисовалось — возвращаем курсор).
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    const ta = taRef.current;
    if (!sel || !ta) return;
    pendingSel.current = null;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(sel[0], sel[1]);
  }, [body]);

  const apply = (fn: (v: string, s: number, e: number) => Edit) => {
    const ta = taRef.current;
    const cur = latest.current.body;
    // Поле в фокусе — берём его выделение; иначе последнее запомненное; иначе конец текста.
    const sel: [number, number] = ta && document.activeElement === ta ? [ta.selectionStart, ta.selectionEnd] : (lastSel.current ?? [cur.length, cur.length]);
    const r = fn(cur, Math.min(sel[0], cur.length), Math.min(sel[1], cur.length));
    pendingSel.current = [r.start, r.end];
    change(setBody, r.value, NOTE_LIMITS.body);
  };

  const line = (kind: LineKind) => apply((v, s, e) => prefixLines(v, s, e, kind));
  const mark = (c: MarkColor) => {
    const [b, a] = markSyntax(c);
    apply((v, s, e) => wrapSelection(v, s, e, b, a, "…"));
    setPanel(null);
  };

  // ---- картинки ----
  const attach = async (dataUrl: string) => {
    try {
      const imgId = await putImage(dataUrl);
      const cur = useApp.getState().notebook.notes.find((n) => n.id === id);
      useApp.getState().updateNote(id, { images: [...(cur?.images ?? []), imgId] });
      apply((v, s, e) => {
        const r = insertBlock(v, Math.max(s, e), `![](note-img:${imgId})`);
        return r;
      });
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof NoteImageError && e.reason === "size" ? t("notes2.imgTooBig") : t("notes2.imgError"));
    }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      await attach(await compressImage(file, 1280));
    } catch {
      setNotice(t("notes2.imgError"));
    }
  };

  const onToggleTask = useCallback((offset: number) => {
    const next = toggleTaskAt(latest.current.body, offset);
    if (next === null) return;
    setBody(next);
    setStatus("saving");
  }, []);

  const runTool = (key: ToolKey) => {
    switch (key) {
      case "h":
        return line("h2");
      case "b":
        return apply((v, s, e) => wrapSelection(v, s, e, "**", "**", "…"));
      case "mark":
        return setPanel(panel === "mark" ? null : "mark");
      case "ul":
        return line("ul");
      case "ol":
        return line("ol");
      case "todo":
        return line("todo");
      case "code":
        return apply((v, s, e) => wrapSelection(v, s, e, "`", "`", "code"));
      case "block":
        return apply((v, s, e) => codeBlock(v, s, e));
      case "sym":
        return setPanel(panel === "symbols" ? null : "symbols");
      case "photo":
        return fileRef.current?.click();
      case "draw":
        return setDrawing(true);
    }
  };

  const tools: { key: ToolKey; label: DictKey; icon: LucideIcon; active?: boolean }[] = [
    { key: "h", label: "notes2.tb.heading", icon: Heading2 },
    { key: "b", label: "notes2.tb.bold", icon: Bold },
    { key: "mark", label: "notes2.tb.mark", icon: Highlighter, active: panel === "mark" },
    { key: "ul", label: "notes2.tb.ul", icon: List },
    { key: "ol", label: "notes2.tb.ol", icon: ListOrdered },
    { key: "todo", label: "notes2.tb.todo", icon: ListChecks },
    { key: "code", label: "notes2.tb.code", icon: Code },
    { key: "block", label: "notes2.tb.codeBlock", icon: FileCode },
    { key: "sym", label: "notes2.tb.symbols", icon: Sigma, active: panel === "symbols" },
    { key: "photo", label: "notes2.tb.photo", icon: ImagePlus },
    { key: "draw", label: "notes2.tb.draw", icon: PenTool },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={folder ? `/notes/folder/${encodeURIComponent(folder.id)}` : "/notes"}
          className="flex min-h-11 min-w-0 items-center gap-1 rounded-xl pr-2 font-bold text-muted hover:text-text"
          aria-label={folder ? t("notes2.toFolder", { folder: folderName(folder) }) : t("notes2.toNotes")}
        >
          <ChevronLeft size={20} aria-hidden className="shrink-0" />
          <span className="truncate">{folder ? folderName(folder) : t("notes.title")}</span>
        </Link>
        <span className="flex-1" />
        <span className={cn("flex items-center gap-1 text-xs font-extrabold", status === "saved" ? "text-success" : "text-muted")} aria-live="polite">
          {status === "saved" ? (
            <>
              <Check size={14} aria-hidden /> {t("common.saved")}
            </>
          ) : (
            t("notes2.saving")
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            flush();
            setMenu(true);
          }}
          aria-label={t("notes2.menu")}
          className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface hover:bg-surface-2"
        >
          <Ellipsis size={20} aria-hidden />
        </button>
      </div>

      {/* Заголовок переносится на несколько строк — длинные казахские названия видны целиком. */}
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(e) => change(setTitle, e.target.value.replace(/\s*\n+\s*/g, " "), NOTE_LIMITS.title)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (tab === "edit") taRef.current?.focus();
        }}
        onBlur={flush}
        placeholder={t("notes2.note.title")}
        aria-label={t("notes2.note.title")}
        maxLength={NOTE_LIMITS.title}
        className="w-full resize-none overflow-hidden bg-transparent text-2xl leading-tight font-extrabold outline-none placeholder:text-muted/60"
      />
      {lesson && (
        <Link
          href={`/notes/lesson/${lesson.id}`}
          className="flex w-fit max-w-full items-center gap-1.5 rounded-full border-2 border-success/30 bg-success-soft px-3 py-1 text-xs font-extrabold text-success-strong"
        >
          <span className="truncate">{l(lesson.title)}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
        {(["edit", "preview"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              if (k === "preview") flush();
              setTab(k);
              setPanel(null);
            }}
            className={cn("h-10 rounded-xl font-extrabold transition-colors", tab === k ? "bg-surface text-primary shadow-sm" : "text-muted")}
          >
            {t(k === "edit" ? "notes2.tab.edit" : "notes2.tab.preview")}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <>
          <div className="sticky top-14 z-10 -mx-1 rounded-2xl border-2 border-border bg-surface/95 backdrop-blur lg:top-2" role="toolbar" aria-label={t("notes2.tb.label")}>
            <div className="relative">
              {/* Подсказка, что панель прокручивается: затухание справа. */}
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-2xl bg-gradient-to-l from-surface to-transparent" />
            <div className="no-scrollbar flex gap-0.5 overflow-x-auto p-1 pr-8">
              {tools.map(({ key, label, icon: Icon, active }) => (
                <button
                  key={key}
                  type="button"
                  // Не отбираем фокус у поля — выделение текста сохраняется.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runTool(key)}
                  aria-label={t(label)}
                  title={t(label)}
                  aria-pressed={active}
                  className={cn(btn, active && "border-primary bg-primary-soft text-primary")}
                >
                  <Icon size={20} aria-hidden />
                </button>
              ))}
            </div>
            </div>
            {panel === "mark" && (
              <div className="flex gap-2 border-t-2 border-border p-2">
                {MARK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => mark(c)}
                    aria-label={t(`notes2.mark.${c}` as DictKey)}
                    title={t(`notes2.mark.${c}` as DictKey)}
                    className={cn("flex h-11 flex-1 items-center justify-center rounded-xl border-2 text-base font-extrabold", MARK_STYLE[c])}
                  >
                    Аа
                  </button>
                ))}
              </div>
            )}
            {panel === "symbols" && (
              <div className="no-scrollbar flex gap-1 overflow-x-auto border-t-2 border-border p-1.5">
                {SYMBOLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => apply((v, a, b) => insertText(v, a, b, s))}
                    className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface-2 px-2 text-lg font-bold hover:bg-primary-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {notice && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{notice}</p>}
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => change(setBody, e.target.value, NOTE_LIMITS.body)}
            onBlur={(e) => {
              lastSel.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd];
              flush();
            }}
            placeholder={t("notes2.note.placeholder")}
            aria-label={t("notes2.note.body")}
            maxLength={NOTE_LIMITS.body}
            className="min-h-[45dvh] w-full resize-none rounded-2xl border-2 border-border bg-surface p-3.5 text-base font-semibold leading-relaxed outline-none placeholder:font-medium placeholder:text-muted focus:border-primary"
          />
        </>
      ) : (
        <Card className="min-h-[45dvh]">
          {title.trim() && <h2 className="mb-2 text-xl font-extrabold">{title}</h2>}
          {body.trim() ? <Markdown onToggleTask={onToggleTask} className="[&_table]:block [&_table]:overflow-x-auto">{body}</Markdown> : <p className="font-semibold text-muted">{t("notes2.note.previewEmpty")}</p>}
        </Card>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <DrawingModal open={drawing} onClose={() => setDrawing(false)} onInsert={(url) => void attach(url)} />
      <NoteMenu id={id} open={menu} onClose={() => setMenu(false)} onDeleted={() => router.replace(folder ? `/notes/folder/${encodeURIComponent(folder.id)}` : "/notes")} />
    </div>
  );
}
