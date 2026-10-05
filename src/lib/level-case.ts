// Кейс за новый уровень (волна 1Б, R3; docs/specs/stage16b-wave1b.md). Чистая логика без React.
// Приз выбирает код ДО анимации (честно: лента только показывает уже выпавшее). Кейс нельзя купить ни за чипы, ни за деньги.
// Веса и размеры призов — в lib/economy.ts (LEVEL_CASE_*). Тесты — tests/level-case.test.ts.

import { pickCaseCosmetic, type CosmeticId, type CosmeticsState } from "./cosmetics";
import {
  LEVEL_CASE_BOOST,
  LEVEL_CASE_CHIPS,
  LEVEL_CASE_HEARTS_SUBSTITUTE_CHIPS,
  LEVEL_CASE_WEIGHTS,
  LEVEL_CASE_XP,
  extendBoost,
  heartsView,
  pushLedger,
  refillHearts,
  type Boost,
  type CasePrizeId,
  type Hearts,
  type LedgerEntry,
  type PlanTier,
  type Wallet,
} from "./economy";
import { MAX_PENDING_CASES } from "./rewards-state";
import { seeded } from "./text";

/** Что реально выдаётся: chips15 — замена сердечкам, когда запас полон. */
export type CasePrizeKey = CasePrizeId | "chips15";

export interface CasePrize {
  id: CasePrizeKey;
  kind: "xp" | "hearts" | "chips" | "boost" | "cosmetic";
  /** XP или чипы; для бустера — множитель; для сердечек и украшения 0. */
  amount: number;
  /** Только у `kind: "cosmetic"`: какое украшение выпало (выбрано кодом до анимации). */
  cosmetic?: CosmeticId;
}

/** Длина ленты и позиция приза в ней (лента «докручивается» до приза). */
export const CASE_STRIP_LENGTH = 40;
export const CASE_WIN_INDEX = 34;

export interface LevelCaseRoll {
  level: number;
  prize: CasePrize;
  /** Лента карточек для анимации; на позиции CASE_WIN_INDEX — выпавший приз. */
  strip: CasePrize[];
  /** Где внутри карточки-победителя остановится указатель, 0.15..0.85 (чтобы остановка не была «ровной»). */
  landing: number;
}

const IDS = Object.keys(LEVEL_CASE_WEIGHTS) as CasePrizeId[];

/** Приз по id. Для `cosmetic` нужен выбранный id украшения; без него (выдавать нечего) — чипы вместо украшения (`chips30`). */
export function prizeOf(id: CasePrizeKey, cosmetic?: CosmeticId): CasePrize {
  if (id === "cosmetic") return cosmetic ? { id, kind: "cosmetic", amount: 0, cosmetic } : prizeOf("chips30");
  if (id === "chips15") return { id, kind: "chips", amount: LEVEL_CASE_HEARTS_SUBSTITUTE_CHIPS };
  if (id === "hearts") return { id, kind: "hearts", amount: 0 };
  if (id === "boost") return { id, kind: "boost", amount: LEVEL_CASE_BOOST.mult };
  const xp = LEVEL_CASE_XP[id];
  if (xp) return { id, kind: "xp", amount: xp };
  return { id, kind: "chips", amount: LEVEL_CASE_CHIPS[id] ?? 0 };
}

/** Взвешенный выбор по равномерному числу r ∈ [0, 1). */
export function pickPrizeId(r: number): CasePrizeId {
  const total = IDS.reduce((sum, id) => sum + LEVEL_CASE_WEIGHTS[id], 0);
  let x = r * total;
  for (const id of IDS) {
    x -= LEVEL_CASE_WEIGHTS[id];
    if (x < 0) return id;
  }
  return IDS[IDS.length - 1];
}

/** Приз с заменами: полные сердечки → чипы 15; украшение выбирает код (`pickCaseCosmetic`), нечего выдать → чипы 30. */
function resolve(id: CasePrizeId, heartsFull: boolean, owned: readonly CosmeticId[], rand: () => number): CasePrize {
  if (id === "cosmetic") return prizeOf("cosmetic", pickCaseCosmetic(owned, rand()) ?? undefined);
  return prizeOf(id === "hearts" && heartsFull ? "chips15" : id);
}

/**
 * Бросок кейса: детерминирован по (level, seed, owned). Если сердечки уже полные (heartsFull) — «полное восстановление»
 * заменяется чипами; если выпало украшение — код выбирает его среди тех, которых у ученика ещё нет (owned), а когда выдавать
 * нечего, вместо него чипы. То же в ленте, чтобы показанное совпадало с выдаваемым.
 */
export function rollLevelCase(level: number, seed: number, heartsFull = false, owned: readonly CosmeticId[] = []): LevelCaseRoll {
  const rand = seeded((seed ^ Math.imul(level | 0, 0x9e3779b1)) >>> 0);
  const prize = resolve(pickPrizeId(rand()), heartsFull, owned, rand);
  const strip: CasePrize[] = [];
  for (let i = 0; i < CASE_STRIP_LENGTH; i++) strip.push(i === CASE_WIN_INDEX ? prize : resolve(pickPrizeId(rand()), heartsFull, owned, rand));
  return { level, prize, strip, landing: 0.15 + rand() * 0.7 };
}

// ---------- Очередь неоткрытых кейсов ----------

/** Уровни, за которые добавить кейс при росте опыта: от prevLevel (не включая) до nextLevel (включая). */
export function casesForLevelUp(prevLevel: number, nextLevel: number): number[] {
  const out: number[] = [];
  for (let l = Math.max(2, prevLevel + 1); l <= nextLevel; l++) out.push(l);
  return out;
}

/** Добавляет кейсы в очередь: без повторов, по возрастанию, не больше MAX_PENDING_CASES (старейшие отбрасываются). */
export function queueCases(pending: number[], levels: number[]): number[] {
  if (!levels.length) return pending;
  return [...new Set([...pending, ...levels])].sort((a, b) => a - b).slice(-MAX_PENDING_CASES);
}

// ---------- Выдача приза ----------

/** Часть состояния, которую трогает открытие кейса. */
export interface CaseState {
  xp: number;
  wallet: Wallet;
  hearts: Hearts;
  boost: Boost | null;
  ledger: LedgerEntry[];
  pendingCases: number[];
  /** Украшения профиля: приз-украшение добавляется в `owned` (сам кейс его не надевает). */
  cosmetics: CosmeticsState;
}

export interface CaseClaim {
  roll: LevelCaseRoll;
  state: CaseState;
}

/**
 * Открывает кейс уровня level: бросок, выдача приза, кейс убирается из очереди. Нет такого кейса — null.
 * Опыт из приза просто прибавляется к xp: новых кейсов от него не бывает (очередь пополняет только стор при обычном
 * начислении), так что кейс не порождает кейс.
 */
export function claimLevelCase(
  s: CaseState,
  level: number,
  seed: number,
  ctx: { now: number; today: string; tier: PlanTier; ledgerId: string },
): CaseClaim | null {
  if (!s.pendingCases.includes(level)) return null;
  const view = heartsView(s.hearts, ctx.tier, ctx.now, ctx.today);
  const roll = rollLevelCase(level, seed, view.unlimited || view.count >= view.max, s.cosmetics.owned);
  const { prize } = roll;
  const next: CaseState = { ...s, pendingCases: s.pendingCases.filter((l) => l !== level) };
  if (prize.kind === "xp") next.xp = s.xp + prize.amount;
  else if (prize.kind === "hearts") next.hearts = refillHearts(ctx.tier, ctx.now, ctx.today);
  else if (prize.kind === "boost") next.boost = extendBoost(s.boost, LEVEL_CASE_BOOST.mult, LEVEL_CASE_BOOST.minutes, ctx.now);
  else if (prize.kind === "cosmetic" && prize.cosmetic && !s.cosmetics.owned.includes(prize.cosmetic)) next.cosmetics = { ...s.cosmetics, owned: [...s.cosmetics.owned, prize.cosmetic] };
  else if (prize.kind === "chips") {
    next.wallet = { ...s.wallet, chips: s.wallet.chips + prize.amount, earned: s.wallet.earned + prize.amount };
    next.ledger = pushLedger(s.ledger, { id: ctx.ledgerId, at: ctx.now, amount: prize.amount, reason: "case", note: String(level) });
  }
  return { roll, state: next };
}
