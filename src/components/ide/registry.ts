"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { L } from "@/lib/types";
import type { EditorLanguage, IdeLang, IdeTask, WorkspaceProps } from "@/lib/ide/types";
import { TASKS as PYTHON_TASKS } from "@/lib/ide/python/tasks";
import { TASKS as SQL_TASKS } from "@/lib/ide/sql/tasks";
import { TASKS as WEB_TASKS } from "@/lib/ide/web/tasks";
import { TASKS as JS_TASKS } from "@/lib/ide/js/tasks";
import { TASKS as EXCEL_TASKS } from "@/lib/ide/excel/tasks";

// Реестр языков практикума (решение #35). Рабочие области грузятся лениво и только в браузере
// (Pyodide, sql.js, iframe) — страница-хаб остаётся лёгкой.

export interface IdeLangInfo {
  id: IdeLang;
  title: L;
  /** Подзаголовок на карточке языка. */
  about: L;
  /** Имя иконки lucide (компонент выбирает оболочка). */
  icon: "python" | "database" | "globe" | "braces" | "table";
  /** Цвет-токен карточки. */
  tone: "primary" | "success" | "warning" | "ai" | "gold";
  editor: EditorLanguage | null;
  tasks: IdeTask[];
  Workspace: ComponentType<WorkspaceProps>;
}

const loading = () => null;

export const IDE_REGISTRY: Record<IdeLang, IdeLangInfo> = {
  python: {
    id: "python",
    title: { ru: "Python", kk: "Python" },
    about: { ru: "Программы, ввод и вывод, циклы, пошаговое выполнение", kk: "Программалар, енгізу-шығару, циклдер, қадамдап орындау" },
    icon: "python",
    tone: "primary",
    editor: "python",
    tasks: PYTHON_TASKS,
    Workspace: dynamic(() => import("./python/Workspace").then((m) => m.Workspace), { ssr: false, loading }),
  },
  sql: {
    id: "sql",
    title: { ru: "SQL", kk: "SQL" },
    about: { ru: "Запросы к учебной базе данных", kk: "Оқу деректер қорына сұраныстар" },
    icon: "database",
    tone: "success",
    editor: "sql",
    tasks: SQL_TASKS,
    Workspace: dynamic(() => import("./sql/Workspace").then((m) => m.Workspace), { ssr: false, loading }),
  },
  web: {
    id: "web",
    title: { ru: "HTML и CSS", kk: "HTML және CSS" },
    about: { ru: "Веб-страница с живым предпросмотром", kk: "Тірі алдын ала қараумен веб-бет" },
    icon: "globe",
    tone: "warning",
    editor: "html",
    tasks: WEB_TASKS,
    Workspace: dynamic(() => import("./web/Workspace").then((m) => m.Workspace), { ssr: false, loading }),
  },
  js: {
    id: "js",
    title: { ru: "JavaScript", kk: "JavaScript" },
    about: { ru: "Переменные, условия, циклы и функции", kk: "Айнымалылар, шарттар, циклдер және функциялар" },
    icon: "braces",
    tone: "gold",
    editor: "javascript",
    tasks: JS_TASKS,
    Workspace: dynamic(() => import("./js/Workspace").then((m) => m.Workspace), { ssr: false, loading }),
  },
  excel: {
    id: "excel",
    title: { ru: "Excel", kk: "Excel" },
    about: { ru: "Формулы, функции, относительные и абсолютные ссылки", kk: "Формулалар, функциялар, салыстырмалы және абсолют сілтемелер" },
    icon: "table",
    tone: "success",
    editor: null,
    tasks: EXCEL_TASKS,
    Workspace: dynamic(() => import("./excel/Workspace").then((m) => m.Workspace), { ssr: false, loading }),
  },
};

export const isIdeLang = (v: unknown): v is IdeLang => typeof v === "string" && Object.hasOwn(IDE_REGISTRY, v);

export function findTask(lang: IdeLang, id: string): IdeTask | undefined {
  return IDE_REGISTRY[lang].tasks.find((t) => t.id === id);
}
