import { legalDict } from "@/i18n/parts/legal";
import { metaDict } from "@/i18n/parts/meta";
import type { LegalId } from "@/content/legal";
import type { L } from "./types";

// Метаданные сайта для превью ссылки и вкладки браузера (app/layout.tsx и правовые страницы). Без React.

export const APP_NAME = "Informatica";

/** Адрес сайта по умолчанию (боевой деплой); свой — через NEXT_PUBLIC_SITE_URL. */
export const DEFAULT_SITE_URL = "https://informatica-chi.vercel.app";

/** Адрес сайта: NEXT_PUBLIC_SITE_URL, если это http(s)-адрес, иначе адрес по умолчанию. Без пути и «/» на конце. */
export function siteUrl(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const raw = (env ?? "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    } catch {
      // не адрес — берём по умолчанию
    }
  }
  return DEFAULT_SITE_URL;
}

/** Двуязычная строка «ru · kk»: сервер не знает язык читателя ссылки. */
export function biText(v: L, sep = " · "): string {
  return `${v.ru}${sep}${v.kk}`;
}

/** Название вкладки по умолчанию: «Informatica — Информатика к ЕНТ · ҰБТ информатикасы». */
export function siteTitle(): string {
  return `${APP_NAME} — ${biText(metaDict["meta.title"])}`;
}

/** Описание сайта: русская и казахская фразы подряд. */
export function siteDescription(): string {
  return biText(metaDict["meta.description"], " ");
}

/** Подпись картинки превью. */
export function ogAlt(): string {
  return biText(metaDict["meta.og.alt"]);
}

/** Название вкладки правовой страницы (к нему layout добавляет « · Informatica»). */
export function legalTitle(id: LegalId): string {
  return biText(legalDict[`legal.title.${id}`]);
}
