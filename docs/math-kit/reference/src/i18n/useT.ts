"use client";

import { useCallback } from "react";
import { useApp } from "@/lib/store";
import { fmt, tx } from "@/lib/text";
import type { Lang, Text } from "@/lib/types";
import { dict, type DictKey } from "./dict";

export function translate(lang: Lang, key: DictKey, params?: Record<string, string | number>): string {
  return fmt(dict[key][lang], params);
}

/** Хук перевода: t("ключ") для интерфейса, l(текст) для контента. */
export function useT() {
  const lang = useApp((s) => s.profile.lang);
  const t = useCallback(
    (key: DictKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );
  const l = useCallback((text: Text) => tx(text, lang), [lang]);
  return { t, l, lang };
}
