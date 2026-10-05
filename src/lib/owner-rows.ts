// Жалобы, отзывы и ошибки с телефонов для страницы владельца: строки списков `issues` и `client-errors` → типизированные строки.
// Чистые функции без React и сервера: покрыты tests/owner-report.test.ts. Всё — текст: страница рисует его как текст, не как HTML.

/** Строка списка жалоб и отзывов. */
export interface IssueRow {
  type: string;
  where: string;
  reason: string;
  comment?: string;
  itemId?: string;
  lessonId?: string;
  snippet?: string;
  lang?: string;
  version?: string;
  at?: string;
}

/** Строка списка ошибок с телефонов. */
export interface ErrorRow {
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  lang?: string;
  version?: string;
  at?: string;
}

const text = (v: unknown, max: number): string | undefined => (typeof v === "string" && v ? v.slice(0, max) : undefined);

function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(line);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Жалобы и отзывы из строк списка (новые первыми, как лежат в списке). Битые строки пропускаются. */
export function parseIssueRows(lines: readonly string[]): IssueRow[] {
  const out: IssueRow[] = [];
  for (const line of lines) {
    const o = parseJsonObject(line);
    if (!o || typeof o.type !== "string") continue;
    out.push({
      type: o.type.slice(0, 20),
      where: text(o.where, 20) ?? "",
      reason: text(o.reason, 30) ?? "",
      comment: text(o.comment, 1000),
      itemId: text(o.itemId, 80),
      lessonId: text(o.lessonId, 80),
      snippet: text(o.snippet, 600),
      lang: text(o.lang, 4),
      version: text(o.version, 16),
      at: text(o.at, 40),
    });
  }
  return out;
}

/** Ошибки с телефонов из строк списка. Строки без сообщения пропускаются. */
export function parseErrorRows(lines: readonly string[]): ErrorRow[] {
  const out: ErrorRow[] = [];
  for (const line of lines) {
    const o = parseJsonObject(line);
    const message = o ? text(o.message, 500) : undefined;
    if (!o || !message) continue;
    out.push({
      message,
      stack: text(o.stack, 1500),
      path: text(o.path, 200),
      userAgent: text(o.userAgent, 160),
      lang: text(o.lang, 4),
      version: text(o.version, 16),
      at: text(o.at, 40),
    });
  }
  return out;
}

/** Время записи для таблицы: «05.10 14:32» по Астане (UTC+5); не время — как есть. */
export function formatAt(at: string | undefined): string {
  if (!at) return "";
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at;
  const d = new Date(t + 5 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
}
