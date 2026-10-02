import { highlightParts } from "@/lib/theory";

/** Текст с подсветкой совпадений: `<mark>` на мягком янтарном фоне (токен warning-soft). */
export function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  return (
    <>
      {highlightParts(text, ranges).map((p, i) =>
        p.mark ? (
          <mark key={i} className="hl-mark font-extrabold">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
