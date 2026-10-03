"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { SQLite, sql } from "@codemirror/lang-sql";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers, type Command } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { EditorLanguage } from "@/lib/ide/types";
import { cn } from "@/lib/cn";
import type { CodeEditorProps } from "./CodeEditor";

// Редактор кода на CodeMirror 6. Грузится только в браузере (см. CodeEditor.tsx). Цвета — CSS-переменные
// из globals.css, поэтому светлая и тёмная темы переключаются сами, без пересборки редактора.

function languageExtension(lang: EditorLanguage): Extension {
  switch (lang) {
    case "python":
      return [python(), indentUnit.of("    ")];
    case "sql":
      return [sql({ dialect: SQLite, upperCaseKeywords: true }), indentUnit.of("    ")];
    case "html":
      return [html(), indentUnit.of("  ")];
    case "javascript":
      return [javascript(), indentUnit.of("  ")];
  }
}

/** Tab = пробелы до ближайшей позиции кратной 4; при выделении — сдвиг блока; в режиме «только чтение» Tab уходит дальше по странице. */
const tabKey: Command = (view) => {
  const { state } = view;
  if (state.readOnly) return false;
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view);
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const col = range.head - state.doc.lineAt(range.head).from;
        const ins = " ".repeat(4 - (col % 4));
        return { changes: { from: range.head, insert: ins }, range: EditorSelection.cursor(range.head + ins.length) };
      }),
      { scrollIntoView: true, userEvent: "input" },
    ),
  );
  return true;
};
const shiftTabKey: Command = (view) => (view.state.readOnly ? false : indentLess(view));

// Подсветка строки (пошаговое выполнение Python): номер строки хранится в поле и переживает правки текста.
const setHighlight = StateEffect.define<number | null>();

function buildLineDeco(state: EditorState, line: number | null): DecorationSet {
  if (line === null || !Number.isInteger(line) || line < 1 || line > state.doc.lines) return Decoration.none;
  return Decoration.set([Decoration.line({ class: "cm-hl-line" }).range(state.doc.line(line).from)]);
}

const highlightField = StateField.define<{ line: number | null; deco: DecorationSet }>({
  create: () => ({ line: null, deco: Decoration.none }),
  update(value, tr) {
    let line = value.line;
    let changed = tr.docChanged;
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        line = e.value;
        changed = true;
      }
    }
    return changed ? { line, deco: buildLineDeco(tr.state, line) } : value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

const theme = EditorView.theme({
  "&": { backgroundColor: "var(--surface)", color: "var(--text)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6", overflow: "auto" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--text)", minHeight: "var(--ce-min, 200px)" },
  ".cm-line": { padding: "0 10px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 28%, transparent)",
  },
  ".cm-gutters": { backgroundColor: "var(--surface-2)", color: "var(--muted)", border: "none", borderRight: "2px solid var(--border)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px", minWidth: "34px" },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--primary-soft)", outline: "1px solid var(--primary)" },
  "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "var(--danger-soft)", outline: "1px solid var(--danger)" },
  ".cm-hl-line": { backgroundColor: "var(--warning-soft)", boxShadow: "inset 3px 0 0 var(--warning)" },
});

// Только токены дизайн-системы: ключевые слова — голубой, строки — зелёный, числа — янтарный, комментарии — приглушённый.
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword], color: "var(--primary-strong)", fontWeight: "700" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--success-strong)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--warning-strong)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--muted)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], fontWeight: "700" },
  { tag: [t.tagName, t.className, t.typeName], color: "var(--primary-strong)" },
  { tag: [t.attributeName, t.propertyName], color: "var(--warning-strong)" },
  { tag: [t.attributeValue], color: "var(--success-strong)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--muted)" },
  { tag: t.invalid, color: "var(--danger)" },
]);

export default function CmEditor({ value, onChange, language, ariaLabel, minHeight = 200, readOnly = false, highlightLine, className }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  // Признак «правка пришла снаружи» — её не отдаём обратно в onChange.
  const external = useRef(false);
  const [comp] = useState(() => ({ lang: new Compartment(), ro: new Compartment(), aria: new Compartment() }));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Создание редактора — один раз; дальнейшие изменения пропсов применяют эффекты ниже.
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          EditorView.lineWrapping,
          EditorState.tabSize.of(4),
          syntaxHighlighting(highlightStyle),
          theme,
          highlightField,
          keymap.of([
            { key: "Tab", run: tabKey, shift: shiftTabKey },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          comp.lang.of(languageExtension(language)),
          comp.ro.of(EditorState.readOnly.of(readOnly)),
          comp.aria.of(EditorView.contentAttributes.of({ "aria-label": ariaLabel, spellcheck: "false", autocapitalize: "off", autocorrect: "off" })),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !external.current) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Значение изменили снаружи (сброс, загрузка черновика) — подменяем документ.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur === value) return;
    external.current = true;
    try {
      view.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    } finally {
      external.current = false;
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: comp.lang.reconfigure(languageExtension(language)) });
  }, [language, comp]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: comp.ro.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly, comp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: comp.aria.reconfigure(EditorView.contentAttributes.of({ "aria-label": ariaLabel, spellcheck: "false", autocapitalize: "off", autocorrect: "off" })),
    });
  }, [ariaLabel, comp]);

  // Подсветка строки + прокрутка к ней.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = highlightLine ?? null;
    if (view.state.field(highlightField).line === next) return;
    const effects: StateEffect<unknown>[] = [setHighlight.of(next)];
    if (next !== null && Number.isInteger(next) && next >= 1 && next <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(next).from, { y: "nearest" }));
    }
    view.dispatch({ effects });
  }, [highlightLine]);

  return (
    <div
      ref={host}
      style={{ "--ce-min": `${minHeight}px` } as CSSProperties}
      className={cn(
        "overflow-hidden rounded-2xl border-2 border-border bg-surface text-base focus-within:border-primary sm:text-[15px]",
        readOnly && "bg-surface-2",
        className,
      )}
    />
  );
}
