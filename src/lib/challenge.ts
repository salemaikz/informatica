// Вызов другу (#73): «У друга: 14 из 19. Сможешь больше?». Друг открывает тот же вариант (/exam/run?kind&seed[&topics])
// с параметром `ch=<баллы>-<максимум>-<тег банка>`. Имени в вызове нет (#72): отправителя и так видно в мессенджере.
// Всё, что пришло из адреса, недоверенное. Чистая логика без React: tests/challenge.test.ts.

/** Вызов: результат того, кто вызывает, и тег банка, на котором собран его вариант. */
export interface Challenge {
  /** Набранный балл. */
  s: number;
  /** Максимум баллов варианта. */
  m: number;
  /** Тег банка и сборки варианта (`poolTag`, 4 знака [a-z0-9]). */
  pool: string;
}

/** Максимум баллов варианта, который принимаем (полный вариант — 50). */
export const CHALLENGE_MAX_POINTS = 100;
const POOL_RE = /^[a-z0-9]{4}$/;
const CH_RE = /^(0|[1-9]\d{0,2})-([1-9]\d{0,2})-([a-z0-9]{4})$/;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Проверка уже разобранного объекта (например, из сохранённой попытки); null — данные негодные. */
export function sanitizeChallenge(raw: unknown): Challenge | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isInt(r.s) || !isInt(r.m) || typeof r.pool !== "string" || !POOL_RE.test(r.pool)) return null;
  if (r.m < 1 || r.m > CHALLENGE_MAX_POINTS || r.s < 0 || r.s > r.m) return null;
  return { s: r.s, m: r.m, pool: r.pool };
}

/** Значение параметра `ch`; null — данные негодные. */
export function encodeChallenge(c: Challenge): string | null {
  const ok = sanitizeChallenge(c);
  return ok ? `${ok.s}-${ok.m}-${ok.pool}` : null;
}

/** Разбор `ch` из адреса (строго каноническая запись). null — нет, повреждено или не проходит проверку. */
export function decodeChallenge(raw: string | null | undefined): Challenge | null {
  if (typeof raw !== "string" || raw.length > 16) return null;
  const m = CH_RE.exec(raw);
  if (!m) return null;
  return sanitizeChallenge({ s: Number(m[1]), m: Number(m[2]), pool: m[3] });
}

/** Добавляет `ch` к относительной ссылке на вариант (`/exam/run?...`). Негодный вызов — ссылка без изменений. */
export function withChallenge(link: string, c: Challenge): string {
  const ch = encodeChallenge(c);
  if (!ch) return link;
  return `${link}${link.includes("?") ? "&" : "?"}ch=${ch}`;
}

// ---------- Тег банка ----------

/**
 * Тег «неизвестен»: попытка начата до версии с тегами (или тег потерян). Такой вариант честно считаем другим:
 * баннер «вариант может отличаться», сравнение по доле.
 */
export const UNKNOWN_POOL = "0000";

/**
 * Тег банка заданий: FNV-1a по отсортированным подписям заданий + версия сборки варианта, 4 знака base36.
 * Подпись задания — всё, от чего зависит выбор и перемешивание (`lib/exam-pool.ts → itemSignature`: id, вид, тема, уровень,
 * число вариантов). Тот же seed даёт тот же вариант, только если банк и алгоритм сборки не менялись: не совпал тег — «вариант
 * мог измениться».
 */
export function poolTag(ids: readonly string[], buildVersion: number): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  feed(`v${buildVersion}|`);
  for (const id of [...ids].sort()) feed(`${id}|`);
  // 36⁴ = 1 679 616 вариантов тега: случайное совпадение у разных банков маловероятно.
  return (h % 36 ** 4).toString(36).padStart(4, "0");
}

// ---------- Сравнение ----------

export type ChallengeOutcome = "more" | "same" | "less";

export interface ChallengeComparison {
  outcome: ChallengeOutcome;
  /** Разница (мой − друга): на том же варианте — в баллах, иначе — в процентных пунктах. */
  diff: number;
  /** true — тот же вариант (тот же максимум и тот же известный тег банка): сравниваем баллы. */
  samePaper: boolean;
}

/** Тот же вариант: теги совпадают и известны. */
export const samePool = (a: string | undefined, b: string | undefined): boolean => !!a && a === b && a !== UNKNOWN_POOL;

/** Сравнение результата с вызовом: на том же варианте — по баллам, иначе — по доле (в процентных пунктах). */
export function compareWithChallenge(points: number, max: number, c: Challenge, pool: string | undefined): ChallengeComparison {
  if (max === c.m && samePool(pool, c.pool)) {
    const diff = points - c.s;
    return { outcome: diff > 0 ? "more" : diff < 0 ? "less" : "same", diff, samePaper: true };
  }
  const mine = max > 0 ? points / max : 0;
  const diff = Math.round((mine - c.s / c.m) * 100);
  return { outcome: diff > 0 ? "more" : diff < 0 ? "less" : "same", diff, samePaper: false };
}
