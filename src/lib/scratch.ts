// Черновик (рисунок + текст) хранится в IndexedDB: рисунки — это dataURL и могут быть тяжёлыми для localStorage.
// В приватном режиме IndexedDB может бросать ошибки — тогда работаем из памяти (до закрытия вкладки).

import { get, set } from "idb-keyval";

export const MAX_SCRATCH_PAGES = 3;
const KEY = "informatica:scratch:v1";

export interface ScratchPage {
  id: string;
  text: string;
  /** PNG/JPEG dataURL рисунка. */
  image?: string;
  updatedAt: number;
}

/** Запасное хранилище, если IndexedDB недоступна. */
let memory: ScratchPage[] = [];

const copy = (pages: ScratchPage[]): ScratchPage[] => pages.map((p) => ({ ...p }));

/** Данные из хранилища недоверенные: оставляем только корректные листы, не больше MAX_SCRATCH_PAGES. */
export function sanitizePages(raw: unknown): ScratchPage[] {
  if (!Array.isArray(raw)) return [];
  const pages: ScratchPage[] = [];
  for (const item of raw) {
    if (pages.length >= MAX_SCRATCH_PAGES) break;
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id || typeof p.text !== "string") continue;
    const page: ScratchPage = {
      id: p.id,
      text: p.text,
      updatedAt: typeof p.updatedAt === "number" && Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
    };
    if (typeof p.image === "string" && /^data:image\/(png|jpeg);base64,/.test(p.image)) page.image = p.image;
    pages.push(page);
  }
  return pages;
}

export async function loadScratch(): Promise<ScratchPage[]> {
  try {
    const raw = await get(KEY);
    if (raw !== undefined) memory = sanitizePages(raw);
  } catch {
    // IndexedDB недоступна — отдаём то, что есть в памяти.
  }
  return copy(memory);
}

export async function saveScratch(pages: ScratchPage[]): Promise<void> {
  memory = copy(pages.slice(0, MAX_SCRATCH_PAGES));
  try {
    await set(KEY, memory);
  } catch {
    // Не страшно: данные остаются в памяти.
  }
}
