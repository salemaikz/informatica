// Чистая логика сцены message: разбор текста сообщения на куски с подсвеченными подстроками (признаками).
// Подстроку ищет код в тексте нужного языка. Без React; покрыта тестами (tests/scene-web-ext.test.ts).

import type { Lang, Scene, Text } from "@/lib/types";
import { tx } from "@/lib/text";

export type MessageData = Extract<Scene, { kind: "message" }>;

export interface MessageSegment {
  text: string;
  /** Номер признака (1, 2, …) — по порядку в marks; у обычного текста нет. */
  mark?: number;
}

/**
 * Куски текста: обычные и подсвеченные. Каждый признак — первое вхождение, не пересекающееся с уже занятыми;
 * не найденный (или пустой) признак пропускается, номера остальных не меняются.
 */
export function splitMarks(text: string, marks: readonly string[]): MessageSegment[] {
  const taken: { from: number; to: number; mark: number }[] = [];
  marks.forEach((m, i) => {
    if (m === "") return;
    let at = text.indexOf(m);
    while (at >= 0) {
      const to = at + m.length;
      if (!taken.some((t) => at < t.to && to > t.from)) {
        taken.push({ from: at, to, mark: i + 1 });
        return;
      }
      at = text.indexOf(m, at + 1);
    }
  });
  taken.sort((a, b) => a.from - b.from);
  const out: MessageSegment[] = [];
  let pos = 0;
  for (const t of taken) {
    if (t.from > pos) out.push({ text: text.slice(pos, t.from) });
    out.push({ text: text.slice(t.from, t.to), mark: t.mark });
    pos = t.to;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Текст сообщения на языке с подсвеченными признаками. */
export function messageSegments(scene: MessageData, lang: Lang): MessageSegment[] {
  return splitMarks(tx(scene.text, lang), (scene.marks ?? []).map((m) => tx(m.text, lang)));
}

/** Признаки с пояснением — для списка под сообщением: номер и текст пояснения. */
export function markNotes(marks: MessageData["marks"], lang: Lang): { n: number; note: string }[] {
  return (marks ?? []).flatMap((m, i) => (m.note !== undefined ? [{ n: i + 1, note: tx(m.note as Text, lang) }] : []));
}

/** Первая буква отправителя — для кружка-аватара. */
export function senderInitial(from: string): string {
  const ch = [...from.trim()][0];
  return ch ? ch.toUpperCase() : "?";
}
