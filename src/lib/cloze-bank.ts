// Банк плашек для пропусков со словами (этап 16Б, P5): верные слова текстовых пропусков + отвлекатели шага.
// Чистая функция без React; порядок детерминирован (одинаковый при каждом рендере и в тестах).

import { normalizeAnswer } from "./check";
import type { ClozeStep, L } from "./types";

/** Детерминированный хеш строки (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Плашки шага: label текстовых пропусков (без повторов) + step.bank, перемешано по хешу от id шага.
 * Пустой массив — у шага нет текстовых пропусков с label (ввод с клавиатуры, как раньше).
 */
export function clozeBank(step: ClozeStep, lang: "ru" | "kk"): string[] {
  const labels: L[] = [];
  for (const line of step.lines) {
    for (const token of line) {
      if (typeof token === "object" && "blank" in token && token.mode === "text" && token.label) labels.push(token.label);
    }
  }
  if (labels.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...labels, ...(step.bank ?? [])]) {
    const text = item[lang];
    const key = normalizeAnswer(text, "text");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out
    .map((text, i) => ({ text, k: hash(`${step.id}|${lang}|${text}`), i }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.text);
}
