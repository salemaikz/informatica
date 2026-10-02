// Чистая логика листа для печати (/exam/print): параметры адреса, нумерация, ключ ответов.
// Вариант строится тем же buildExam и теми же параметрами, что и в /exam/run, поэтому один seed — один вариант.

import { ENT_POOL } from "@/content/ent";
import { buildExam, type ExamKind, type ExamPaper, type ExamQuestion } from "@/lib/exam";
import type { EntTopicId, Lang } from "@/lib/types";
import { correctText, parseTopics } from "./logic";

export interface PrintParams {
  kind: ExamKind;
  /** null — в адресе нет корректного номера варианта (печатать нечего). */
  seed: number | null;
  topics: EntTopicId[];
  /** null — язык не указан (берём язык интерфейса). */
  lang: Lang | null;
}

const KINDS: readonly ExamKind[] = ["full", "mini", "topic"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Параметры /exam/print?kind=&seed=&topics=&lang=. Негодный kind — «mini», как самый короткий. */
export function parsePrintParams(sp: Record<string, string | string[] | undefined>): PrintParams {
  const k = first(sp.kind);
  const kind = KINDS.includes(k as ExamKind) ? (k as ExamKind) : "mini";
  const rawSeed = first(sp.seed);
  const n = rawSeed && /^\d{1,10}$/.test(rawSeed) ? Number(rawSeed) : NaN;
  const l = first(sp.lang);
  return {
    kind,
    seed: Number.isInteger(n) && n < 2 ** 32 ? n : null,
    topics: kind === "topic" ? parseTopics(first(sp.topics)) : [],
    lang: l === "ru" || l === "kk" ? l : null,
  };
}

/** Вариант для печати: ровно как в /exam/run. */
export function buildPrintPaper(p: PrintParams & { seed: number }): ExamPaper {
  return buildExam({ kind: p.kind, seed: p.seed, pool: ENT_POOL, topics: p.topics });
}

/** Ссылка на ту же страницу печати на другом языке (для переключателя). */
export function printLink(p: PrintParams & { seed: number }, lang: Lang): string {
  const q = new URLSearchParams({ kind: p.kind, seed: String(p.seed), lang });
  if (p.kind === "topic" && p.topics.length) q.set("topics", p.topics.join(","));
  return `/exam/print?${q.toString()}`;
}

export interface KeyRow {
  n: number;
  key: string;
  answer: string;
  max: number;
}

/** Строки ключа ответов: номер, верный ответ (буквы и текст), максимум баллов. Ответы всегда считает код. */
export function keyRows(paper: ExamPaper, lang: Lang): KeyRow[] {
  return paper.items.map((q, i) => ({ n: i + 1, key: q.key, answer: correctText(q, lang, 400), max: q.maxPoints }));
}

/** Сумма максимальных баллов ключа (должна равняться paper.maxPoints). */
export const keyTotal = (rows: KeyRow[]) => rows.reduce((s, r) => s + r.max, 0);

export interface ContextRange {
  /** Номера (с 1) первого и последнего вопроса, относящегося к контексту. */
  from: number;
  to: number;
}

/** Для вопроса с индексом i: если это первый вопрос контекстного задания — диапазон его вопросов, иначе null. */
export function contextStart(items: ExamQuestion[], i: number): ContextRange | null {
  const q = items[i];
  if (!q || q.item.kind !== "context") return null;
  if (i > 0 && items[i - 1].item === q.item) return null;
  let to = i;
  while (to + 1 < items.length && items[to + 1].item === q.item) to++;
  return { from: i + 1, to: to + 1 };
}
