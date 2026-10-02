// Экономика приложения: сердечки, чипы (внутренняя валюта), бустеры, тарифы и цена ИИ.
// Чистые функции без React; состояние лежит в сторе (lib/store.ts), интерфейс — components/economy и components/plans.
//
// Правила (решение #31, docs/DECISIONS.md):
// - сердечки тратятся только в уроках (ошибка с первой попытки); тренировка, пробный ЕНТ и игры их не тратят;
// - каждый день — полный запас, потерянное сердечко возвращается само через regenMs;
// - тренировка (в том числе работа над ошибками) возвращает сердечко — бесплатный путь всегда есть;
// - чипы зарабатываются опытом (5 XP = 1 чип) и бонусами; на чипы покупаются сердечки, бустеры и ИИ сверх бесплатного;
// - оплата деньгами (тарифы, наборы чипов) пока не подключена — экран «скоро» без имитации платежа.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// ---------- Тарифы ----------

export type PlanTier = "free" | "lite" | "unlimited";
export type PaidTier = Exclude<PlanTier, "free">;
export type BillingPeriod = "month" | "year";

export interface Plan {
  tier: PlanTier;
  period?: BillingPeriod;
  /** До какого момента действует платный тариф (мс). Истёк — снова free. */
  until?: number;
  /** Текущий тариф — пробный период. */
  trial?: boolean;
  /** Пробный период уже был (один раз на устройство). */
  trialUsed?: boolean;
}

export interface PlanFeatures {
  /** Сердечек в запасе; Infinity — безлимит. */
  maxHearts: number;
  /** Через сколько возвращается одно сердечко, мс (0 — не нужно). */
  regenMs: number;
  /** Бесплатных обращений к ИИ в день, дальше — за чипы; Infinity — без ограничений. */
  aiFree: number;
  /** Множитель заработка чипов. */
  chipMultiplier: number;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: { maxHearts: 5, regenMs: 4 * HOUR, aiFree: 3, chipMultiplier: 1 },
  lite: { maxHearts: 10, regenMs: 2 * HOUR, aiFree: 30, chipMultiplier: 1.5 },
  unlimited: { maxHearts: Infinity, regenMs: 0, aiFree: Infinity, chipMultiplier: 2 },
};

/** Цены тарифов, ₸. Год — со скидкой против 12 месяцев. */
export const PRICES: Record<PaidTier, Record<BillingPeriod, number>> = {
  lite: { month: 1290, year: 9990 },
  unlimited: { month: 2590, year: 19990 },
};

export const PAID_TIERS: PaidTier[] = ["lite", "unlimited"];

/** Экономия годового тарифа против помесячной оплаты: сумма (₸) и процент (целый). */
export function yearSaving(tier: PaidTier): { amount: number; percent: number } {
  const full = PRICES[tier].month * 12;
  const amount = full - PRICES[tier].year;
  return { amount, percent: Math.round((amount / full) * 100) };
}

/** Сколько в месяц выходит годовой тариф, ₸ (округлено до целых). */
export function perMonthOfYear(tier: PaidTier): number {
  return Math.round(PRICES[tier].year / 12);
}

/** «1 290 ₸» — цена с неразрывным пробелом между разрядами. */
export function formatTenge(n: number): string {
  return `${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

export const TRIAL_DAYS = 7;

export const FREE_PLAN: Plan = { tier: "free" };

/** Действующий тариф: платный с истёкшим сроком считается бесплатным. */
export function effectiveTier(plan: Plan | undefined, now: number): PlanTier {
  if (!plan || plan.tier === "free") return "free";
  if (plan.until !== undefined && plan.until <= now) return "free";
  return plan.tier;
}

/** Сколько полных дней осталось у платного тарифа (0 — истёк или бесплатный). */
export function planDaysLeft(plan: Plan | undefined, now: number): number {
  if (!plan || effectiveTier(plan, now) === "free" || plan.until === undefined) return 0;
  return Math.max(0, Math.ceil((plan.until - now) / DAY));
}

/** Пробный период «Безлимита» на TRIAL_DAYS дней — один раз; иначе тариф не меняется. */
export function startTrial(plan: Plan | undefined, now: number): Plan {
  const p = plan ?? FREE_PLAN;
  if (p.trialUsed || effectiveTier(p, now) !== "free") return p;
  return { tier: "unlimited", until: now + TRIAL_DAYS * DAY, trial: true, trialUsed: true };
}

export function canStartTrial(plan: Plan | undefined, now: number): boolean {
  const p = plan ?? FREE_PLAN;
  return !p.trialUsed && effectiveTier(p, now) === "free";
}

/** Проверка сохранённого тарифа (данные из localStorage — недоверенные). */
export function sanitizePlan(raw: unknown): Plan {
  const p = (raw ?? {}) as Partial<Plan>;
  const tier: PlanTier = p.tier === "lite" || p.tier === "unlimited" ? p.tier : "free";
  const plan: Plan = { tier };
  if (tier !== "free") {
    if (p.period === "month" || p.period === "year") plan.period = p.period;
    plan.until = typeof p.until === "number" && Number.isFinite(p.until) ? p.until : 0;
    if (p.trial) plan.trial = true;
  }
  if (p.trialUsed) plan.trialUsed = true;
  return plan;
}

// ---------- Сердечки ----------

export interface Hearts {
  count: number;
  /** С какого момента идёт восстановление (мс). */
  updatedAt: number;
  /** День последнего полного запаса «ГГГГ-ММ-ДД». */
  day: string;
}

export interface HeartsView {
  count: number;
  max: number;
  unlimited: boolean;
  /** Когда вернётся следующее сердечко (мс); null — запас полон или безлимит. */
  nextAt: number | null;
}

export const START_HEARTS: Hearts = { count: PLAN_FEATURES.free.maxHearts, updatedAt: 0, day: "" };

/**
 * Сердечки на момент now: новый день — полный запас; иначе прибавляем восстановленные.
 * При безлимите состояние не меняется.
 */
export function heartsNow(h: Hearts, tier: PlanTier, now: number, today: string): Hearts {
  const { maxHearts: max, regenMs } = PLAN_FEATURES[tier];
  if (!Number.isFinite(max)) return h;
  if (h.day !== today) return { count: max, updatedAt: now, day: today };
  if (h.count >= max) return h.count === max && h.updatedAt <= now ? h : { count: max, updatedAt: now, day: today };
  const gained = regenMs > 0 ? Math.floor(Math.max(0, now - h.updatedAt) / regenMs) : 0;
  if (gained <= 0) return h;
  const count = Math.min(max, h.count + gained);
  return { count, updatedAt: count >= max ? now : h.updatedAt + gained * regenMs, day: today };
}

export function heartsView(h: Hearts, tier: PlanTier, now: number, today: string): HeartsView {
  const max = PLAN_FEATURES[tier].maxHearts;
  if (!Number.isFinite(max)) return { count: Infinity, max: Infinity, unlimited: true, nextAt: null };
  const cur = heartsNow(h, tier, now, today);
  return { count: cur.count, max, unlimited: false, nextAt: cur.count < max ? cur.updatedAt + PLAN_FEATURES[tier].regenMs : null };
}

/** Минус одно сердечко (не ниже нуля). С полного запаса восстановление начинается с этого момента. */
export function loseHeart(h: Hearts, tier: PlanTier, now: number, today: string): Hearts {
  if (!Number.isFinite(PLAN_FEATURES[tier].maxHearts)) return h;
  const cur = heartsNow(h, tier, now, today);
  if (cur.count <= 0) return cur;
  const wasFull = cur.count >= PLAN_FEATURES[tier].maxHearts;
  return { count: cur.count - 1, updatedAt: wasFull ? now : cur.updatedAt, day: today };
}

/** Плюс n сердечек (не выше запаса). */
export function addHearts(h: Hearts, n: number, tier: PlanTier, now: number, today: string): Hearts {
  const max = PLAN_FEATURES[tier].maxHearts;
  if (!Number.isFinite(max)) return h;
  const cur = heartsNow(h, tier, now, today);
  const count = Math.min(max, cur.count + Math.max(0, Math.floor(n)));
  return { count, updatedAt: count >= max ? now : cur.updatedAt, day: today };
}

export function refillHearts(tier: PlanTier, now: number, today: string): Hearts {
  return { count: PLAN_FEATURES[tier].maxHearts, updatedAt: now, day: today };
}

/** Можно ли начать урок (есть хотя бы одно сердечко или безлимит). */
export const canStartLesson = (v: HeartsView): boolean => v.unlimited || v.count > 0;

export function sanitizeHearts(raw: unknown): Hearts {
  const h = (raw ?? {}) as Partial<Hearts>;
  const count = typeof h.count === "number" && Number.isFinite(h.count) ? Math.max(0, Math.min(99, Math.floor(h.count))) : START_HEARTS.count;
  const updatedAt = typeof h.updatedAt === "number" && Number.isFinite(h.updatedAt) ? h.updatedAt : 0;
  const day = typeof h.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.day) ? h.day : "";
  return { count, updatedAt, day };
}

/** Сколько тренировок в день могут вернуть сердечко. */
export const PRACTICE_HEART_DAILY = 5;
/** Тренировка возвращает сердечко, если ответов не меньше и точность не ниже. */
export const PRACTICE_HEART_MIN_ANSWERS = 3;
export const PRACTICE_HEART_MIN_ACCURACY = 0.6;

export function practiceEarnsHeart(answers: number, accuracy: number): boolean {
  return answers >= PRACTICE_HEART_MIN_ANSWERS && accuracy >= PRACTICE_HEART_MIN_ACCURACY;
}

// ---------- Чипы ----------

export interface Wallet {
  chips: number;
  /** Всего заработано и потрачено (для статистики и итогов урока). */
  earned: number;
  spent: number;
}

export type ChipReason =
  | "welcome"
  | "xp"
  | "lesson"
  | "perfect"
  | "dailyGoal"
  | "achievement"
  | "exam"
  | "buy"
  | "ai"
  | "refund";

export interface LedgerEntry {
  id: string;
  at: number;
  /** + заработано, − потрачено. */
  amount: number;
  reason: ChipReason;
  /** Уточнение: id товара или вид запроса к ИИ. */
  note?: string;
}

export const WELCOME_CHIPS = 100;
export const START_WALLET: Wallet = { chips: WELCOME_CHIPS, earned: WELCOME_CHIPS, spent: 0 };
/** 5 XP = 1 чип. */
export const CHIPS_PER_XP = 0.2;
export const CHIP_BONUS = { lesson: 5, perfect: 5, dailyGoal: 15, achievement: 20, exam: 10 } as const;
export const MAX_LEDGER = 50;
/** Начисления одной причины в пределах этого окна склеиваются в одну строку истории. */
export const LEDGER_MERGE_MS = 15 * MINUTE;

/** Заработок с учётом множителя (вниз до целого). */
export function earnAmount(base: number, multiplier: number): number {
  if (!(base > 0) || !(multiplier > 0)) return 0;
  return Math.floor(base * multiplier + 1e-9);
}

/** Чипы за опыт: 5 XP = 1 чип, умножается на множитель тарифа и бустера. */
export function chipsForXp(xp: number, multiplier: number): number {
  return earnAmount(xp * CHIPS_PER_XP, multiplier);
}

/** Добавляет запись в историю чипов: свежие записи той же причины склеиваются. Новые — первыми. */
export function pushLedger(ledger: LedgerEntry[], entry: LedgerEntry): LedgerEntry[] {
  if (entry.amount === 0) return ledger;
  const top = ledger[0];
  if (
    top &&
    top.reason === entry.reason &&
    top.note === entry.note &&
    Math.sign(top.amount) === Math.sign(entry.amount) &&
    entry.at - top.at >= 0 &&
    entry.at - top.at <= LEDGER_MERGE_MS
  ) {
    return [{ ...top, amount: top.amount + entry.amount, at: entry.at }, ...ledger.slice(1)];
  }
  return [entry, ...ledger].slice(0, MAX_LEDGER);
}

export function sanitizeWallet(raw: unknown): Wallet {
  const w = (raw ?? {}) as Partial<Wallet>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  return { chips: num(w.chips, START_WALLET.chips), earned: num(w.earned, START_WALLET.earned), spent: num(w.spent, 0) };
}

// ---------- Бустеры (множитель чипов) ----------

export interface Boost {
  mult: number;
  until: number;
}

export function boostActive(b: Boost | null | undefined, now: number): b is Boost {
  return !!b && b.until > now && b.mult > 1;
}

/** Итоговый множитель чипов: тариф × активный бустер. */
export function chipMultiplier(tier: PlanTier, boost: Boost | null | undefined, now: number): number {
  return PLAN_FEATURES[tier].chipMultiplier * (boostActive(boost, now) ? boost.mult : 1);
}

/** Продлевает бустер: время складывается, множитель — наибольший. */
export function extendBoost(b: Boost | null | undefined, mult: number, minutes: number, now: number): Boost {
  const base = boostActive(b, now) ? b.until : now;
  return { mult: Math.max(mult, boostActive(b, now) ? b.mult : 1), until: base + minutes * MINUTE };
}

export function sanitizeBoost(raw: unknown): Boost | null {
  const b = raw as Partial<Boost> | null | undefined;
  if (!b || typeof b.mult !== "number" || typeof b.until !== "number" || !Number.isFinite(b.until)) return null;
  return { mult: Math.min(3, Math.max(1, b.mult)), until: b.until };
}

// ---------- Магазин (за чипы) ----------

export type ShopItemId = "heart-1" | "hearts-full" | "boost-15" | "boost-60";

export interface ShopItem {
  id: ShopItemId;
  kind: "heart" | "refill" | "boost";
  /** Цена в чипах. */
  price: number;
  /** Бустер: множитель и длительность. */
  mult?: number;
  minutes?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "heart-1", kind: "heart", price: 40 },
  { id: "hearts-full", kind: "refill", price: 150 },
  { id: "boost-15", kind: "boost", price: 60, mult: 2, minutes: 15 },
  { id: "boost-60", kind: "boost", price: 180, mult: 2, minutes: 60 },
];

export const shopItem = (id: ShopItemId): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id);

export type BuyFail = "chips" | "full" | "unlimited" | "unknown";

export interface BuyState {
  wallet: Wallet;
  hearts: Hearts;
  boost: Boost | null;
}

/** Покупка за чипы. Сердечки при безлимите и при полном запасе не продаём. */
export function buyItem(
  state: BuyState,
  id: ShopItemId,
  tier: PlanTier,
  now: number,
  today: string,
): ({ ok: true } & BuyState) | { ok: false; reason: BuyFail } {
  const item = shopItem(id);
  if (!item) return { ok: false, reason: "unknown" };
  let hearts = state.hearts;
  let boost = state.boost;
  if (item.kind === "heart" || item.kind === "refill") {
    const v = heartsView(state.hearts, tier, now, today);
    if (v.unlimited) return { ok: false, reason: "unlimited" };
    if (v.count >= v.max) return { ok: false, reason: "full" };
    hearts = item.kind === "heart" ? addHearts(state.hearts, 1, tier, now, today) : refillHearts(tier, now, today);
  }
  if (state.wallet.chips < item.price) return { ok: false, reason: "chips" };
  if (item.kind === "boost") boost = extendBoost(state.boost, item.mult ?? 2, item.minutes ?? 15, now);
  const wallet = { ...state.wallet, chips: state.wallet.chips - item.price, spent: state.wallet.spent + item.price };
  return { ok: true, wallet, hearts, boost };
}

// ---------- За деньги (оплата пока не подключена) ----------

export interface ChipPack {
  id: string;
  chips: number;
  /** Подарок сверху. */
  bonus: number;
  /** ₸ */
  price: number;
  badge?: "popular" | "best";
}

export const CHIP_PACKS: ChipPack[] = [
  { id: "chips-300", chips: 300, bonus: 0, price: 390 },
  { id: "chips-1000", chips: 1000, bonus: 100, price: 990, badge: "popular" },
  { id: "chips-3000", chips: 3000, bonus: 600, price: 2490, badge: "best" },
];

export interface BoostPack {
  id: string;
  mult: number;
  hours: number;
  /** ₸ */
  price: number;
}

export const BOOST_PACKS: BoostPack[] = [
  { id: "boost-24h", mult: 2, hours: 24, price: 490 },
  { id: "boost-7d", mult: 2, hours: 24 * 7, price: 1490 },
];

// ---------- ИИ: бесплатно по тарифу, дальше за чипы ----------

/** Вид обращения к ИИ. feedback — отзыв после урока: всегда бесплатен (дешёвая модель, без запроса ученика). */
export type AiKind = "hint" | "explain" | "ask" | "chat" | "photo" | "review" | "feedback";

/** Цена сверх бесплатных обращений, чипов. */
export const AI_COST: Record<AiKind, number> = { hint: 5, explain: 5, ask: 10, chat: 10, photo: 30, review: 20, feedback: 0 };

/** Потолок обращений в день по тарифу — защита от перерасхода (в том числе при безлимите). */
export const AI_DAILY_CAP: Record<PlanTier, number> = { free: 60, lite: 150, unlimited: 300 };

export interface AiUsage {
  day: string;
  /** Всего обращений за день. */
  count: number;
  /** Из них бесплатных по тарифу. */
  free: number;
}

export type AiPay = "free" | "plan" | "chips";

/** Квитанция обращения к ИИ: по ней же делается возврат, если запрос не удался или ответ из кэша. */
export interface AiReceipt {
  ok: boolean;
  kind: AiKind;
  day: string;
  pay?: AiPay;
  /** Списано чипов (0, если бесплатно). */
  cost: number;
  /** Почему нельзя: не хватает чипов или дневной потолок. */
  reason?: "chips" | "cap";
}

export function usageToday(u: AiUsage | undefined, today: string): AiUsage {
  return u && u.day === today ? { day: today, count: u.count || 0, free: u.free || 0 } : { day: today, count: 0, free: 0 };
}

/** Сколько бесплатных обращений осталось сегодня (Infinity — без ограничений). */
export function aiFreeLeft(tier: PlanTier, u: AiUsage | undefined, today: string): number {
  const f = PLAN_FEATURES[tier].aiFree;
  if (!Number.isFinite(f)) return Infinity;
  return Math.max(0, f - usageToday(u, today).free);
}

/** Как будет оплачено обращение (без изменения состояния). */
export function quoteAi(kind: AiKind, tier: PlanTier, usage: AiUsage | undefined, chips: number, today: string): AiReceipt {
  const u = usageToday(usage, today);
  if (u.count >= AI_DAILY_CAP[tier]) return { ok: false, kind, day: today, cost: 0, reason: "cap" };
  if (kind === "feedback") return { ok: true, kind, day: today, pay: "free", cost: 0 };
  if (tier === "unlimited") return { ok: true, kind, day: today, pay: "plan", cost: 0 };
  if (aiFreeLeft(tier, u, today) > 0) return { ok: true, kind, day: today, pay: "free", cost: 0 };
  const cost = AI_COST[kind];
  if (chips >= cost) return { ok: true, kind, day: today, pay: "chips", cost };
  return { ok: false, kind, day: today, cost, reason: "chips" };
}

/** Учёт обращения по квитанции. */
export function applyAiUsage(u: AiUsage | undefined, r: AiReceipt): AiUsage {
  const cur = usageToday(u, r.day);
  if (!r.ok) return cur;
  const usesFree = r.pay === "free" && r.kind !== "feedback";
  return { day: r.day, count: cur.count + 1, free: cur.free + (usesFree ? 1 : 0) };
}

/** Возврат обращения по квитанции (тот же день). */
export function refundAiUsage(u: AiUsage | undefined, r: AiReceipt): AiUsage {
  const base: AiUsage = u ? { day: u.day, count: u.count || 0, free: u.free || 0 } : { day: r.day, count: 0, free: 0 };
  // Неудачная квитанция ничего не списывала; за другой день не возвращаем.
  if (!r.ok || base.day !== r.day) return base;
  const usesFree = r.pay === "free" && r.kind !== "feedback";
  return { day: r.day, count: Math.max(0, base.count - 1), free: Math.max(0, base.free - (usesFree ? 1 : 0)) };
}

export function sanitizeAiUsage(raw: unknown): AiUsage {
  const u = (raw ?? {}) as Partial<AiUsage>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return { day: typeof u.day === "string" ? u.day : "", count: n(u.count), free: n(u.free) };
}

// ---------- Окно тарифов ----------

/** Как часто показывать окно тарифов бесплатным ученикам (и сразу после онбординга). */
export const PAYWALL_EVERY_DAYS = 3;

export interface PaywallState {
  /** Когда окно показывали в последний раз (мс), 0 — не показывали. */
  lastShownAt: number;
  views: number;
}

export function shouldShowPaywall(tier: PlanTier, p: PaywallState | undefined, now: number): boolean {
  if (tier !== "free") return false;
  return now - (p?.lastShownAt ?? 0) >= PAYWALL_EVERY_DAYS * DAY;
}

export function sanitizePaywall(raw: unknown): PaywallState {
  const p = (raw ?? {}) as Partial<PaywallState>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  return { lastShownAt: n(p.lastShownAt), views: Math.floor(n(p.views)) };
}
