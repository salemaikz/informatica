// Черновик (рисунок + текст) хранится в IndexedDB: рисунки могут быть тяжёлыми для localStorage.
// В приватном режиме IndexedDB может бросать ошибки — тогда работаем из памяти (до закрытия вкладки).
// Рисунок — вектор (`strokes`); старые сохранения с PNG (`image`) показываются как подложка.

import { get, set } from "idb-keyval";
import { hasInk, sanitizeStrokes, type Stroke } from "./strokes";

export const MAX_SCRATCH_PAGES = 10;
/** Сколько листов создаём, когда ничего не сохранено. */
export const DEFAULT_SCRATCH_PAGES = 3;
const KEY = "informatica:scratch:v1";

export interface ScratchPage {
  id: string;
  text: string;
  /** Старый формат: PNG/JPEG dataURL рисунка (подложка). Новые рисунки хранятся в `strokes`. */
  image?: string;
  /** Рисунок вектором. */
  strokes?: Stroke[];
  updatedAt: number;
}

/** Запасное хранилище, если IndexedDB недоступна. */
let memory: ScratchPage[] = [];
/** В memory — актуальные листы (их читали из IndexedDB или сохраняли), а не пустой начальный список. */
let inMemoryTrusted = false;

const copy = (pages: ScratchPage[]): ScratchPage[] => pages.map((p) => ({ ...p }));

/** Данные из хранилища недоверенные: оставляем только корректные листы, не больше MAX_SCRATCH_PAGES. */
export function sanitizePages(raw: unknown): ScratchPage[] {
  if (!Array.isArray(raw)) return [];
  const pages: ScratchPage[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (pages.length >= MAX_SCRATCH_PAGES) break;
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id || typeof p.text !== "string" || ids.has(p.id)) continue;
    ids.add(p.id);
    const page: ScratchPage = {
      id: p.id,
      text: p.text,
      updatedAt: typeof p.updatedAt === "number" && Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
    };
    if (typeof p.image === "string" && /^data:image\/(png|jpeg);base64,/.test(p.image)) page.image = p.image;
    const strokes = sanitizeStrokes(p.strokes);
    if (strokes.length) page.strokes = strokes;
    pages.push(page);
  }
  return pages;
}

/** Пустой лист с заданным id. */
export const emptyPage = (id: string): ScratchPage => ({ id, text: "", updatedAt: 0 });

/** Начальный набор листов (когда ничего не сохранено). */
export const blankPages = (n: number = DEFAULT_SCRATCH_PAGES): ScratchPage[] =>
  Array.from({ length: n }, (_, i) => emptyPage(`p${i + 1}`));

/** Есть ли на листе что-то, кроме пустоты (текст, старый рисунок или штрихи; одни ластики не считаются). */
export const pageHasContent = (p: ScratchPage): boolean => p.text.trim() !== "" || !!p.image || hasInk(p.strokes);

/** Свободный id вида p<N>. */
export function nextPageId(pages: readonly ScratchPage[]): string {
  const used = new Set(pages.map((p) => p.id));
  let n = 1;
  while (used.has(`p${n}`)) n++;
  return `p${n}`;
}

/** Добавляет пустой лист в конец; на пределе MAX_SCRATCH_PAGES возвращает тот же массив. */
export function addPage(pages: ScratchPage[]): ScratchPage[] {
  if (pages.length >= MAX_SCRATCH_PAGES) return pages;
  return [...pages, emptyPage(nextPageId(pages))];
}

/** Удаляет лист; последний оставшийся лист не удаляется (только очищается снаружи). */
export function removePage(pages: ScratchPage[], index: number): ScratchPage[] {
  if (pages.length <= 1 || index < 0 || index >= pages.length) return pages;
  return pages.filter((_, i) => i !== index);
}

/** Листы и признак сбоя чтения: failed — IndexedDB есть, но прочитать не вышло, а в памяти ничего не было загружено или сохранено. */
export async function loadScratchChecked(): Promise<{ pages: ScratchPage[]; failed: boolean }> {
  try {
    const raw = await get(KEY);
    if (raw !== undefined) memory = sanitizePages(raw);
    inMemoryTrusted = true;
    return { pages: copy(memory), failed: false };
  } catch {
    // IndexedDB недоступна — отдаём то, что есть в памяти.
    return { pages: copy(memory), failed: !inMemoryTrusted && typeof indexedDB !== "undefined" };
  }
}

export async function loadScratch(): Promise<ScratchPage[]> {
  return (await loadScratchChecked()).pages;
}

/** Сохраняет листы. true — записано в IndexedDB; false — осталось только в памяти. */
export async function saveScratch(pages: ScratchPage[]): Promise<boolean> {
  memory = copy(pages.slice(0, MAX_SCRATCH_PAGES));
  inMemoryTrusted = true;
  try {
    await set(KEY, memory);
    return true;
  } catch {
    // Не страшно: данные остаются в памяти.
    return false;
  }
}
