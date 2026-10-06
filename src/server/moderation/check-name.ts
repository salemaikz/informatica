import "server-only";
import { BLOCKLIST, type BlockEntry } from "@/server/moderation/blocklist";
import { checkNameFormat, type NameCheck } from "@/lib/moderation/name-format";
import { baseForm, cyrStem, latStem, skeleton, type Skeleton } from "@/server/moderation/skeleton";

// Серверная проверка имени игрока (docs/specs/duels.md §7): формат → скелет → стоп-корни. Сервер проверяет всегда,
// даже если клиент уже проверил формат. Причину-слово ученику не называем: наружу уходит только код отказа.
// Формат — общий с клиентом (src/lib/moderation/name-format.ts); здесь только стоп-корни (список — server-only).

export { checkNameFormat, NAME_MAX, NAME_MIN, type NameCheck, type NameFail } from "@/lib/moderation/name-format";

/** Кириллический ли корень (сравниваем с кириллическим скелетом, иначе с латинским). */
const CYR = /[а-яёәғқңөұүһі]/i;

// ---------- стоп-корни ----------

interface Compiled {
  stem: string;
  mode: BlockEntry["mode"];
  /** Корень в кириллице — сравниваем с кириллическим скелетом, иначе с латинским. */
  cyr: boolean;
}

const COMPILED: Compiled[] = BLOCKLIST.map((e) => {
  const cyr = CYR.test(e.stem);
  return { stem: cyr ? cyrStem(e.stem) : latStem(e.stem), mode: e.mode, cyr };
});

function hit(c: Compiled, sk: Skeleton): boolean {
  const words = c.cyr ? sk.cyr : sk.lat;
  switch (c.mode) {
    case "any":
      return words.some((w) => w.includes(c.stem)) || sk.squashed.some((s) => s.includes(c.stem));
    case "start":
      return words.some((w) => w.startsWith(c.stem));
    case "word":
      return words.some((w) => w === c.stem);
  }
}

/** В строке есть стоп-корень (по скелету). Без проверки формата — годится и для кодов друзей. */
export function hasBlockedStem(raw: string): boolean {
  if (baseForm(raw).length === 0) return false;
  const sk = skeleton(raw);
  return COMPILED.some((c) => hit(c, sk));
}

/** Полная серверная проверка имени: формат → стоп-корни. */
export function checkName(raw: unknown): NameCheck {
  const f = checkNameFormat(raw);
  if (!f.ok) return f;
  if (hasBlockedStem(f.name)) return { ok: false, code: "blocked" };
  return f;
}
