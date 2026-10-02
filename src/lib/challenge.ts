// Вызов другу: «У Айжан: 14 из 19. Попробуешь больше?». Данные едут в ссылке (`ch=` — base64url JSON), поэтому
// всё, что пришло из адреса, недоверенное: обрезаем имя, проверяем числа. Чистая логика без React.

export interface Challenge {
  /** Имя того, кто вызывает (до 20 символов); "" — имя не указано (показываем «У друга»). */
  n: string;
  /** Набранный балл. */
  s: number;
  /** Максимум баллов варианта. */
  m: number;
}

export const CHALLENGE_NAME_MAX = 20;
/** Максимум баллов, который вообще бывает (полный вариант — 55; берём с запасом). */
export const CHALLENGE_MAX_POINTS = 200;
/** Предел длины значения `ch` в адресе. */
const CH_MAX_LEN = 200;

/** Имя: без управляющих символов и лишних пробелов, не длиннее 20 символов (по символам, а не по байтам). */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e<>]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(s).slice(0, CHALLENGE_NAME_MAX).join("").trim();
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Проверка уже разобранного объекта; null — данные негодные. Пустое имя допустимо (аноним). */
export function sanitizeChallenge(raw: unknown): Challenge | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.n !== "string" || !isInt(r.s) || !isInt(r.m)) return null;
  const n = cleanName(r.n);
  if (r.m < 1 || r.m > CHALLENGE_MAX_POINTS || r.s < 0 || r.s > r.m) return null;
  return { n, s: r.s, m: r.m };
}

// ---------- base64url (UTF-8), без Buffer: работает и в браузере, и в Node ----------

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Значение для параметра `ch`. Данные сначала проходят ту же проверку, что и при чтении (лишнее отбрасывается). */
export function encodeChallenge(c: Challenge): string | null {
  const ok = sanitizeChallenge(c);
  if (!ok) return null;
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ n: ok.n, s: ok.s, m: ok.m })));
}

/** Разбор значения `ch` из адреса. null — нет, повреждено или не проходит проверку. */
export function decodeChallenge(raw: string | null | undefined): Challenge | null {
  if (!raw || raw.length > CH_MAX_LEN) return null;
  const bytes = fromBase64Url(raw);
  if (!bytes) return null;
  try {
    return sanitizeChallenge(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    return null;
  }
}

/** Добавляет `ch` к относительной ссылке на вариант (`/exam/run?...`). Негодный вызов — ссылка без изменений. */
export function withChallenge(link: string, c: Challenge): string {
  const ch = encodeChallenge(c);
  if (!ch) return link;
  return `${link}${link.includes("?") ? "&" : "?"}ch=${ch}`;
}

// ---------- Сравнение ----------

export type ChallengeOutcome = "more" | "same" | "less";

export interface ChallengeComparison {
  outcome: ChallengeOutcome;
  /** Разница в баллах (мой − друга); при разных максимумах — в процентных пунктах, округлённая. */
  diff: number;
  /** true — максимумы одинаковы, diff в баллах. */
  samePaper: boolean;
}

/** Сравнение результата с вызовом: на одном варианте — по баллам, иначе — по доле. */
export function compareWithChallenge(points: number, max: number, c: Challenge): ChallengeComparison {
  if (max === c.m) {
    const diff = points - c.s;
    return { outcome: diff > 0 ? "more" : diff < 0 ? "less" : "same", diff, samePaper: true };
  }
  const mine = max > 0 ? points / max : 0;
  const diff = Math.round((mine - c.s / c.m) * 100);
  return { outcome: diff > 0 ? "more" : diff < 0 ? "less" : "same", diff, samePaper: false };
}
