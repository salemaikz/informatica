import {
  BookOpen,
  BookText,
  ChartColumn,
  Code2,
  Crown,
  Dumbbell,
  History,
  Library,
  NotebookPen,
  ScrollText,
  Search,
  Sparkles,
  Store,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { DictKey } from "@/i18n/dict";

// Навигация v0.8: пять групп (Учиться, Практика, ИИ-чат, Материалы, Прогресс). Единый источник
// для нижней панели телефона, бокового меню компьютера и строки подразделов (SectionTabs).

export type GroupId = "learn" | "practice" | "tutor" | "materials" | "progress";

export interface NavSub {
  id: string;
  /** Страница подраздела; у «Шпаргалки» её нет — она открывает панель «Инструменты». */
  href?: string;
  /** Особое действие вместо перехода по ссылке. */
  action?: "cheat";
  label: DictKey;
  icon: LucideIcon;
  /** Какие пути считать этим подразделом (по границе сегмента: `/exam` ловит `/exam/run`). */
  match: string[];
}

export interface NavGroup {
  id: GroupId;
  href: string;
  label: DictKey;
  icon: LucideIcon;
  /** Всё, что делает ИИ, — фиолетовым. */
  ai?: boolean;
  /** Пути группы (по границе сегмента). */
  match: string[];
  subs: NavSub[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "learn", href: "/learn", label: "nav.learn", icon: BookOpen, match: ["/learn", "/lesson", "/plan"], subs: [] },
  {
    id: "practice",
    href: "/practice",
    label: "nav.practice",
    icon: Dumbbell,
    match: ["/practice", "/drill", "/game", "/exam", "/code", "/history"],
    subs: [
      { id: "train", href: "/practice", label: "nav2.train", icon: Dumbbell, match: ["/practice", "/drill", "/game"] },
      { id: "exam", href: "/exam", label: "nav2.exam", icon: Target, match: ["/exam"] },
      { id: "code", href: "/code", label: "nav2.code", icon: Code2, match: ["/code"] },
      { id: "history", href: "/history", label: "nav2.history", icon: History, match: ["/history"] },
    ],
  },
  { id: "tutor", href: "/tutor", label: "nav.tutor", icon: Sparkles, ai: true, match: ["/tutor"], subs: [] },
  {
    id: "materials",
    href: "/materials",
    label: "nav2.materials",
    icon: Library,
    match: ["/materials", "/notes", "/theory", "/search"],
    subs: [
      { id: "notes", href: "/notes", label: "nav2.notes", icon: NotebookPen, match: ["/notes"] },
      { id: "theory", href: "/theory", label: "nav2.theory", icon: BookText, match: ["/theory"] },
      { id: "cheat", action: "cheat", label: "nav2.cheat", icon: ScrollText, match: [] },
      { id: "search", href: "/search", label: "nav2.search", icon: Search, match: ["/search"] },
    ],
  },
  {
    id: "progress",
    href: "/stats",
    label: "nav.stats",
    icon: ChartColumn,
    match: ["/stats", "/shop", "/plans", "/profile"],
    subs: [
      { id: "stats", href: "/stats", label: "nav2.stats", icon: ChartColumn, match: ["/stats"] },
      { id: "shop", href: "/shop", label: "nav2.shop", icon: Store, match: ["/shop"] },
      { id: "plans", href: "/plans", label: "nav2.plans", icon: Crown, match: ["/plans"] },
      { id: "profile", href: "/profile", label: "nav2.profile", icon: UserRound, match: ["/profile"] },
    ],
  },
];

/** Путь без query/hash и без хвостового «/» (корень остаётся «/»). */
export function normalizePath(pathname: string): string {
  const p = pathname.split(/[?#]/)[0] || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
}

/** Путь лежит внутри префикса: `/exam` и `/exam/run` — да, `/examples` — нет. */
export function underPath(pathname: string, prefix: string): boolean {
  const p = normalizePath(pathname);
  return p === prefix || p.startsWith(`${prefix}/`);
}

/** Какая группа активна для пути (null — путь вне навигации: вход, онбординг…). */
export function groupOf(pathname: string): GroupId | null {
  return NAV_GROUPS.find((g) => g.match.some((m) => underPath(pathname, m)))?.id ?? null;
}

export function groupById(id: GroupId): NavGroup {
  return NAV_GROUPS.find((g) => g.id === id)!;
}

/** Активный подраздел группы для пути (id) или null. */
export function subOf(pathname: string): string | null {
  const group = groupOf(pathname);
  if (!group) return null;
  return groupById(group).subs.find((s) => s.match.some((m) => underPath(pathname, m)))?.id ?? null;
}

/**
 * Показывать ли строку подразделов: только на главных страницах подразделов
 * (`/practice`, `/exam`, `/code`, `/history`, `/notes`, `/theory`, `/search`, `/materials`, `/stats`, `/shop`, `/profile`),
 * не на внутренних экранах (урок, задача кода, чат, заметка, результат теста).
 */
export function hubGroup(pathname: string): NavGroup | null {
  const p = normalizePath(pathname);
  for (const g of NAV_GROUPS) {
    if (!g.subs.length) continue;
    if (p === g.href || g.subs.some((s) => s.href === p)) return g;
  }
  return null;
}
