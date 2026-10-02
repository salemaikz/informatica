"use client";

import { IndentDecrease, IndentIncrease } from "lucide-react";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import { TOKEN_CLASS, tokenizeLine } from "@/components/scenes/highlight";
import { cn } from "@/lib/cn";
import { applyEdit, backspaceEdit, enterEdit, lineOffset, tabEdit, type Edit } from "@/lib/python/editing";
import { useT } from "@/i18n/useT";

export interface PythonEditorHandle {
  /** Фокус и выделение строки (с 1) — «показать строку с ошибкой». */
  revealLine: (line: number) => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Строка с ошибкой (с 1) — подсвечивается красным. */
  errorLine?: number | null;
  /** Ctrl/Cmd+Enter. */
  onRun?: () => void;
  /** Первое касание редактора — повод заранее загрузить Python. */
  onFocus?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<PythonEditorHandle>;
}

/** Символы, которых нет «под рукой» на телефонной клавиатуре. */
const KEYS = [":", "(", ")", "[", "]", '"', "=", "+", "-", "*", "/", "%", "<", ">", "#", "_"];

/** Общие метрики слоя подсветки и textarea: должны совпадать до пикселя. */
// Без лигатур: «==» и «<=» должны выглядеть как в учебнике, а не «═» и «≤».
const LAYER = "m-0 py-3 pl-2 pr-4 font-mono text-[16px] leading-6 whitespace-pre [tab-size:4] [font-variant-ligatures:none]";

/**
 * Редактор Python: textarea поверх слоя подсветки, номера строк, Tab → 4 пробела, автоотступ после «:»,
 * Backspace по ступеням отступа. Внизу — панель символов для телефона.
 */
export function PythonEditor({ value, onChange, errorLine, onRun, onFocus, id, className, ref }: Props) {
  const { t } = useT();
  const ta = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Esc, затем Tab — выйти из редактора (Tab не перехватываем).
  const tabEscape = useRef(false);
  // Выделение после правки, если пришлось менять значение напрямую (без execCommand).
  const pendingSel = useRef<[number, number] | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useLayoutEffect(() => {
    const el = ta.current;
    const sel = pendingSel.current;
    if (el && sel) {
      pendingSel.current = null;
      el.setSelectionRange(sel[0], sel[1]);
    }
  }, [value]);

  /** Применяет правку так, чтобы работала отмена (Ctrl+Z): через execCommand, иначе — напрямую. */
  const apply = (e: Edit) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(e.start, e.end);
    let ok = false;
    try {
      ok = e.text ? document.execCommand("insertText", false, e.text) : document.execCommand("delete");
    } catch {
      ok = false;
    }
    if (ok && el.value === applyEdit(value, e)) {
      el.setSelectionRange(e.selStart, e.selEnd);
    } else if (!ok) {
      pendingSel.current = [e.selStart, e.selEnd];
      onChangeRef.current(applyEdit(value, e));
    }
  };
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  // Enter ловим через beforeinput: так автоотступ работает и с экранной клавиатурой телефона.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    const onBeforeInput = (ev: InputEvent) => {
      if (ev.inputType !== "insertLineBreak" && ev.inputType !== "insertParagraph") return;
      if (ev.isComposing) return;
      ev.preventDefault();
      applyRef.current(enterEdit(el.value, el.selectionStart, el.selectionEnd));
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  useImperativeHandle(ref, () => ({
    revealLine(line: number) {
      const el = ta.current;
      if (!el) return;
      const { start, end } = lineOffset(el.value, line);
      el.focus();
      el.setSelectionRange(start, end);
      // Строку — в видимую область страницы.
      const lineEl = scroller.current?.querySelector<HTMLElement>(`[data-line="${line}"]`);
      lineEl?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
  }));

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Escape") {
      tabEscape.current = true;
      return;
    }
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (tabEscape.current) {
        tabEscape.current = false;
        return;
      }
      e.preventDefault();
      apply(tabEdit(el.value, el.selectionStart, el.selectionEnd, e.shiftKey));
      return;
    }
    tabEscape.current = false;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === "Backspace" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const edit = backspaceEdit(el.value, el.selectionStart, el.selectionEnd);
      if (edit) {
        e.preventDefault();
        apply(edit);
      }
    }
  };

  const insert = (text: string) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart;
    apply({ start: s, end: el.selectionEnd, text, selStart: s + text.length, selEnd: s + text.length });
  };
  const indent = (shift: boolean) => {
    const el = ta.current;
    if (!el) return;
    // С кнопки отступ всегда сдвигает строку целиком (как Shift+Tab / Tab по строке).
    const s = el.selectionStart;
    const e = el.selectionEnd;
    if (!shift && s === e) {
      const from = el.value.lastIndexOf("\n", s - 1) + 1;
      apply({ start: from, end: from, text: "    ", selStart: s + 4, selEnd: s + 4 });
    } else apply(tabEdit(el.value, s, e, shift));
  };
  // Кнопки панели не забирают фокус: клавиатура телефона не прячется.
  const keepFocus = (e: PointerEvent) => e.preventDefault();

  const lines = value.split("\n");
  const keyBtn =
    "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface px-2 font-mono text-[16px] font-bold text-text active:translate-y-px hover:bg-surface-2";

  return (
    <div className={cn("overflow-hidden rounded-2xl border-2 border-border bg-surface-2 focus-within:border-primary", className)}>
      <div className="flex">
        <div aria-hidden className="shrink-0 select-none border-r border-border py-3 pl-2 pr-2 text-right font-mono text-[14px] leading-6 text-muted">
          {lines.map((_, i) => (
            <div key={i} className={cn("min-w-5", errorLine === i + 1 && "font-extrabold text-danger")}>
              {i + 1}
            </div>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative w-max min-w-full">
            <pre aria-hidden className={cn(LAYER, "text-text")}>
              {lines.map((line, i) => (
                <div key={i} data-line={i + 1} className={cn(errorLine === i + 1 && "bg-danger-soft")}>
                  {line.length === 0
                    ? " "
                    : tokenizeLine(line, "python").map((tk, j) => (
                        <span key={j} className={TOKEN_CLASS[tk.type]}>
                          {tk.text}
                        </span>
                      ))}
                </div>
              ))}
            </pre>
            <textarea
              ref={ta}
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              aria-label={t("python.editor.label")}
              aria-describedby={id ? `${id}-help` : undefined}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              data-gramm="false"
              className={cn(
                LAYER,
                "absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-text outline-none selection:bg-primary/25",
              )}
            />
          </div>
        </div>
      </div>
      <div role="toolbar" aria-label={t("python.keys.label")} className="flex gap-1.5 overflow-x-auto border-t border-border bg-surface px-2 py-2">
        <button type="button" onPointerDown={keepFocus} onClick={() => indent(false)} aria-label={t("python.keys.indent")} title={t("python.keys.indent")} className={keyBtn}>
          <IndentIncrease size={18} aria-hidden />
        </button>
        <button type="button" onPointerDown={keepFocus} onClick={() => indent(true)} aria-label={t("python.keys.dedent")} title={t("python.keys.dedent")} className={keyBtn}>
          <IndentDecrease size={18} aria-hidden />
        </button>
        {KEYS.map((k) => (
          <button key={k} type="button" onPointerDown={keepFocus} onClick={() => insert(k)} className={keyBtn}>
            {k}
          </button>
        ))}
      </div>
      {id && (
        <p id={`${id}-help`} className="sr-only">
          {t("python.editor.help")}
        </p>
      )}
    </div>
  );
}
