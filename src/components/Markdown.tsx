"use client";

import { createContext, useContext, useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { NoteImage } from "@/components/notes/NoteImage";
import { cn } from "@/lib/cn";
import { noteImageId, remarkNoteMark, type MarkColor } from "@/lib/note-markdown";

const REMARK_PLUGINS = [remarkGfm, remarkNoteMark];

/** Цвета маркера — токены, читаются в обеих темах. */
const MARK_CLASS: Record<MarkColor, string> = {
  y: "bg-gold-soft",
  g: "bg-success-soft",
  b: "bg-primary-soft",
  p: "bg-danger-soft",
};

// Адрес картинки конспекта (note-img:<id>) — «свой», стандартная проверка адресов его бы стёрла.
const urlTransform = (url: string, key: string) => (key === "src" && noteImageId(url) ? url : defaultUrlTransform(url));

/** Позиция (offset) текущего пункта чек-листа в исходном тексте — нужна, чтобы переключить `[ ]` ↔ `[x]`. */
const TaskOffset = createContext<number | null>(null);

function makeComponents(onToggleTask?: (offset: number) => void): Components {
  return {
    mark: ({ children, ...props }) => {
      const c = (props as Record<string, unknown>)["data-color"];
      const color: MarkColor = c === "g" || c === "b" || c === "p" ? c : "y";
      return <mark className={cn("rounded px-0.5 text-inherit [box-decoration-break:clone]", MARK_CLASS[color])}>{children}</mark>;
    },
    img: ({ src, alt }) => {
      const id = noteImageId(typeof src === "string" ? src : undefined);
      // eslint-disable-next-line @next/next/no-img-element
      return id ? <NoteImage id={id} alt={alt} /> : <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="h-auto max-w-full rounded-xl" />;
    },
    li: ({ node, className, children }) => {
      const task = typeof className === "string" && className.includes("task-list-item");
      const offset = node?.position?.start.offset;
      if (!task) return <li className={className}>{children}</li>;
      return (
        <TaskOffset.Provider value={typeof offset === "number" ? offset : null}>
          <li className={cn(className, "list-none -ml-5")}>{children}</li>
        </TaskOffset.Provider>
      );
    },
    input: ({ type, checked }) => <TaskBox type={type} checked={checked} onToggle={onToggleTask} />,
  };
}

function TaskBox({ type, checked, onToggle }: { type?: string; checked?: boolean; onToggle?: (offset: number) => void }) {
  const offset = useContext(TaskOffset);
  if (type !== "checkbox") return <input type={type} readOnly />;
  const live = !!onToggle && offset !== null;
  return (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={!live}
      onChange={() => live && onToggle(offset)}
      className={cn("mr-2 h-5 w-5 translate-y-1 accent-[var(--primary)]", live ? "cursor-pointer" : "cursor-default")}
    />
  );
}

/**
 * Markdown для теории, конспектов и ответов ИИ. Сырые HTML-теги не рендерятся (безопасно).
 * Поддерживает маркер ==текст== (цвета =={g}…==), картинки note-img:<id> и — если передан onToggleTask — кликабельные чек-листы.
 */
export function Markdown({
  children,
  className,
  onToggleTask,
}: {
  children: string;
  className?: string;
  /** Нажатие на чек-бокс: offset пункта в исходном тексте (см. toggleTaskAt). Без него чек-листы только для чтения. */
  onToggleTask?: (offset: number) => void;
}) {
  const components = useMemo(() => makeComponents(onToggleTask), [onToggleTask]);
  return (
    <div className={cn("prose-app", className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components} urlTransform={urlTransform}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
