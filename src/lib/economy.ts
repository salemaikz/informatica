// Экономика приложения: сердечки, чипы (внутренняя валюта), бустеры, тарифы и цена ИИ.
// Чистые функции без React; состояние лежит в сторе (lib/store.ts), интерфейс — components/economy и components/plans.
//
// Правила (решения #31, #34, #40, #65 — docs/DECISIONS.md):
// - сердечки — плата за вход, а не за ошибки: урок 1 (большой 2), «Проверить себя» и пробный ЕНТ 1, контрольная
//   и экстерн 2, игра 1 (каждый запуск), чтение конспекта урока 0,5 (этап 15: lib/theory-pay.ts);
//   тренировка, повторение, работа над ошибками, практикум, шпаргалка, чат — бесплатно;
// - сердечки считаются с шагом 0,5 (halfFloor): половинка бывает только после платы за теорию, восстановление и покупки — целые;
// - потраченное сердечко возвращается само через regenMs (полного запаса «каждый день» нет — решение #34);
// - тренировка (в том числе работа над ошибками) возвращает сердечко — бесплатный путь всегда есть;
// - чипы дают за дела, а не за опыт (решение #105, CHIP_REWARD): урок 3 (повтор 1), идеальный урок +5, цель дня, тест, ЕНТ,
//   достижение; тренировка, игры и практикум чипов не дают (опыт и освоение). На чипы покупаются сердечки, бустеры и ИИ сверх бесплатного;
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
  free: { maxHearts: 5, regenMs: 6 * HOUR, aiFree: 3, chipMultiplier: 1 },
  lite: { maxHearts: 10, regenMs: 3 * HOUR, aiFree: 30, chipMultiplier: 1.5 },
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

/** Вниз до шага 0,5: 1,9 → 1,5; 2 → 2. Сердечки считаются половинками (теория стоит 0,5). */
export function halfFloor(x: number): number {
  return Math.floor(x * 2 + 1e-9) / 2;
}

/** «4,5» / «5»: запятая и в русском, и в казахском (число — как строка для подстановки в `{n}`). */
export function formatHearts(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return String(halfFloor(n)).replace(".", ",");
}

export interface Hearts {
  count: number;
  /** С какого момента идёт восстановление (мс). */
  updatedAt: number;
  /** День последнего изменения «ГГГГ-ММ-ДД» (справочно; полного запаса по дням нет). */
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
 * Сердечки на момент now: прибавляем восстановленные (одно за regenMs, не выше запаса).
 * Запас больше максимума (переход на тариф ниже) обрезается. При безлимите состояние не меняется.
 */
export function heartsNow(h: Hearts, tier: PlanTier, now: number, today: string): Hearts {
  const { maxHearts: max, regenMs } = PLAN_FEATURES[tier];
  if (!Number.isFinite(max)) return h;
  if (h.count >= max) return h.count === max ? h : { count: max, updatedAt: now, day: today };
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

/**
 * Списать n сердечек (плата за вход, #40). Не хватает — null, ничего не меняется. При безлимите — состояние как есть.
 * С полного запаса восстановление начинается с этого момента.
 */
export function spendHearts(h: Hearts, n: number, tier: PlanTier, now: number, today: string): Hearts | null {
  if (!Number.isFinite(PLAN_FEATURES[tier].maxHearts)) return h;
  const cost = Math.max(0, halfFloor(n));
  const cur = heartsNow(h, tier, now, today);
  if (cost === 0) return cur;
  if (cur.count < cost) return null;
  const wasFull = cur.count >= PLAN_FEATURES[tier].maxHearts;
  return { count: cur.count - cost, updatedAt: wasFull ? now : cur.updatedAt, day: today };
}

/** Плюс n сердечек (не выше запаса), с шагом 0,5. */
export function addHearts(h: Hearts, n: number, tier: PlanTier, now: number, today: string): Hearts {
  const max = PLAN_FEATURES[tier].maxHearts;
  if (!Number.isFinite(max)) return h;
  const cur = heartsNow(h, tier, now, today);
  const count = Math.min(max, cur.count + Math.max(0, halfFloor(n)));
  return { count, updatedAt: count >= max ? now : cur.updatedAt, day: today };
}

export function refillHearts(tier: PlanTier, now: number, today: string): Hearts {
  return { count: PLAN_FEATURES[tier].maxHearts, updatedAt: now, day: today };
}

/** Хватает ли сердечек на вход стоимостью cost (безлимит — всегда). */
export const canAfford = (v: HeartsView, cost: number): boolean => v.unlimited || v.count >= cost;

// ---------- Плата за вход (#40) ----------

/** Что стоит сердечек. Тренировка, повторение, работа над ошибками, практикум, шпаргалка и чат — бесплатно. */
export type EntryKind = "lesson" | "check" | "exam" | "checkpoint" | "extern" | "game" | "theory";

/**
 * Цена входа в сердечках: урок 1 (большой урок — поле lesson.hearts = 2), «Проверить себя» 1, пробный ЕНТ любого вида 1,
 * контрольная раздела 2, экстерн (зачёт раздела тестом) 2, игра 1 — каждый запуск, в том числе «ещё раз»,
 * чтение конспекта урока (`/theory/<id>`) 0,5 — когда платить, решает lib/theory-pay.ts.
 */
export const ENTRY_COST: Record<EntryKind, number> = { lesson: 1, check: 1, exam: 1, checkpoint: 2, extern: 2, game: 1, theory: 0.5 };

/** Вход в урок в режиме «Учиться»: 1, у большого урока — 2. */
export function lessonCost(lesson: { hearts?: number } | undefined): number {
  return lesson?.hearts === 2 ? 2 : ENTRY_COST.lesson;
}

/** Цена входа: игра с привязкой к уроку («урок игрой») стоит как сам урок. */
export function entryCost(kind: EntryKind, lesson?: { hearts?: number }): number {
  if (kind === "lesson" || (kind === "game" && lesson)) return lessonCost(lesson);
  return ENTRY_COST[kind];
}

export function sanitizeHearts(raw: unknown): Hearts {
  const h = (raw ?? {}) as Partial<Hearts>;
  // Старые сохранения с целыми сердечками читаются как есть; дробь — только половинки.
  const count = typeof h.count === "number" && Number.isFinite(h.count) ? Math.max(0, Math.min(99, halfFloor(h.count))) : START_HEARTS.count;
  const updatedAt = typeof h.updatedAt === "number" && Number.isFinite(h.updatedAt) ? h.updatedAt : 0;
  const day = typeof h.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.day) ? h.day : "";
  return { count, updatedAt, day };
}

/** Сколько тренировок в день могут вернуть сердечко (#65: строже, чем было — вход теперь платный, а не ошибки). */
export const PRACTICE_HEART_DAILY = 3;
/** Тренировка возвращает сердечко, если ответов с первой попытки не меньше и точность не ниже. */
export const PRACTICE_HEART_MIN_ANSWERS = 6;
export const PRACTICE_HEART_MIN_ACCURACY = 0.7;

export function practiceEarnsHeart(answers: number, accuracy: number): boolean {
  return answers >= PRACTICE_HEART_MIN_ANSWERS && accuracy >= PRACTICE_HEART_MIN_ACCURACY;
}

/** Сколько раз сегодня тренировка ещё может вернуть сердечко (счётчик за другой день — сброшен). */
export function practiceHeartsLeft(ph: { day: string; count: number } | undefined, today: string): number {
  const used = ph && ph.day === today ? Math.max(0, ph.count) : 0;
  return Math.max(0, PRACTICE_HEART_DAILY - used);
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
  /** Старые записи: до решения #105 чипы капали из опыта. Новых не бывает. */
  | "xp"
  | "lesson"
  | "perfect"
  | "dailyGoal"
  | "achievement"
  | "exam"
  /** Тест по разделу сдан. */
  | "unit"
  /** Кейс за новый уровень (волна 1Б, R3). */
  | "case"
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

export const WELCOME_CHIPS = 20;
export const START_WALLET: Wallet = { chips: WELCOME_CHIPS, earned: WELCOME_CHIPS, spent: 0 };
/**
 * Сколько чипов дают за дела (решение #105). Единственное место с числами: интерфейс и стор берут отсюда.
 * Множитель тарифа и бустера — сверху (`earnAmount`). Чипы не считаются из опыта: опыт — для уровня и цели дня.
 * Тренировка, игры, практикум и повторение вне урока чипов не дают.
 */
export const CHIP_REWARD = {
  /** Урок пройден впервые. */
  lessonFirst: 3,
  /** Урок пройден повторно (в том числе плановое повторение). */
  lessonRepeat: 1,
  /** Идеальный урок: без ошибок, с первой попытки; только при первом прохождении (как бонус XP, #23). */
  perfect: 5,
  dailyGoal: 5,
  /** Тест по разделу сдан (≥ 80% баллов). */
  unit: 10,
  /** Пробный ЕНТ завершён. */
  exam: 10,
  achievement: 10,
} as const;
export const MAX_LEDGER = 50;
/** Начисления одной причины в пределах этого окна склеиваются в одну строку истории. */
export const LEDGER_MERGE_MS = 15 * MINUTE;

/** Заработок с учётом множителя (вниз до целого). */
export function earnAmount(base: number, multiplier: number): number {
  if (!(base > 0) || !(multiplier > 0)) return 0;
  return Math.floor(base * multiplier + 1e-9);
}

/** Чипы за прохождение урока (до множителя): первое прохождение — 3, повтор — 1. */
export function lessonChipBase(first: boolean): number {
  return first ? CHIP_REWARD.lessonFirst : CHIP_REWARD.lessonRepeat;
}

/** Чипы за прохождение урока с учётом множителя тарифа и бустера; `first` — урок проходят впервые. */
export function lessonChips(first: boolean, multiplier: number): number {
  return earnAmount(lessonChipBase(first), multiplier);
}

/** Чипов в награде за «Идеальный урок» с учётом множителя. */
export function perfectChips(multiplier: number): number {
  return earnAmount(CHIP_REWARD.perfect, multiplier);
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

export type ShopItemId = "heart-1" | "hearts-3" | "hearts-full" | "boost-15" | "boost-60";

export interface ShopItem {
  id: ShopItemId;
  kind: "heart" | "refill" | "boost";
  /** Цена в чипах; у полного запаса (refill) — за каждое недостающее сердечко, итог — itemPrice. */
  price: number;
  /** Сердечки: сколько штук (по умолчанию 1). */
  amount?: number;
  /** Бустер: множитель и длительность. */
  mult?: number;
  minutes?: number;
}

/**
 * За чипы (#65). Вход в урок стоит сердечко, а урок приносит 3–8 чипов (#105). Цены оставлены прежними:
 * после недели на новых числах решим, менять ли их.
 * Чем больше берёшь — тем дешевле штука: 1 — 60, 3 — 150 (по 50), полный запас — по 45 за каждое недостающее
 * (продаётся, когда не хватает хотя бы REFILL_MIN_MISSING). Бустер: 15 мин — 40, час — 120.
 */
export const SHOP_ITEMS: ShopItem[] = [
  { id: "heart-1", kind: "heart", price: 60, amount: 1 },
  { id: "hearts-3", kind: "heart", price: 150, amount: 3 },
  /** price — за каждое недостающее сердечко (итог — refillPrice). */
  { id: "hearts-full", kind: "refill", price: 45 },
  { id: "boost-15", kind: "boost", price: 40, mult: 2, minutes: 15 },
  { id: "boost-60", kind: "boost", price: 120, mult: 2, minutes: 60 },
];

/** Полный запас продаётся, когда не хватает хотя бы стольких сердечек (меньше — выгоднее по одному или тройкой). */
export const REFILL_MIN_MISSING = 4;

/** Цена полного запаса: по item.price за каждое недостающее сердечко; половинка считается как целое (покупки — целые). */
export function refillPrice(missing: number): number {
  const item = SHOP_ITEMS.find((i) => i.kind === "refill")!;
  return Math.max(0, Math.ceil(missing - 1e-9)) * item.price;
}

/**
 * Цена товара прямо сейчас: у полного запаса зависит от того, сколько сердечек не хватает (v — запас на сейчас).
 * Без v (или при безлимите) у полного запаса — цена полного запаса бесплатного тарифа.
 */
export function itemPrice(item: ShopItem, v?: HeartsView): number {
  if (item.kind !== "refill") return item.price;
  const missing = v && !v.unlimited ? v.max - v.count : PLAN_FEATURES.free.maxHearts;
  return refillPrice(missing);
}

export const shopItem = (id: ShopItemId): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id);

/** chips — не хватает чипов; full — запас полный; overflow — столько не поместится; unlimited — безлимит. */
export type BuyFail = "chips" | "full" | "overflow" | "unlimited" | "unknown";

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
    const amount = item.amount ?? 1;
    const missing = v.max - v.count;
    // Набор больше, чем не хватает, — переплата: предлагаем брать поштучно (полный запас — когда не хватает многих).
    if (item.kind === "heart" && amount > 1 && missing < amount) return { ok: false, reason: "overflow" };
    if (item.kind === "refill" && missing < REFILL_MIN_MISSING) return { ok: false, reason: "overflow" };
    hearts = item.kind === "heart" ? addHearts(state.hearts, amount, tier, now, today) : refillHearts(tier, now, today);
  }
  const price = itemPrice(item, heartsView(state.hearts, tier, now, today));
  if (state.wallet.chips < price) return { ok: false, reason: "chips" };
  if (item.kind === "boost") boost = extendBoost(state.boost, item.mult ?? 2, item.minutes ?? 15, now);
  const wallet = { ...state.wallet, chips: state.wallet.chips - price, spent: state.wallet.spent + price };
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

/** Чипы чуть дороже сердечек; чем больше набор, тем дешевле чип (скидка — против самого маленького набора). */
export const CHIP_PACKS: ChipPack[] = [
  { id: "chips-100", chips: 100, bonus: 0, price: 249 },
  { id: "chips-300", chips: 300, bonus: 0, price: 590 },
  { id: "chips-750", chips: 750, bonus: 0, price: 1290, badge: "popular" },
  { id: "chips-2000", chips: 2000, bonus: 0, price: 2990, badge: "best" },
];

/** Насколько набор выгоднее самого маленького (целые проценты, 0 — у самого маленького). */
export function packSaving(pack: ChipPack): number {
  const base = CHIP_PACKS[0];
  const perChip = (p: ChipPack) => p.price / (p.chips + p.bonus);
  return Math.max(0, Math.round((1 - perChip(pack) / perChip(base)) * 100));
}

/** Сердечки без ограничений на время (за ₸, оплата скоро) — для тех, кто не готов к подписке. */
export interface HeartPass {
  id: string;
  hours: number;
  /** ₸ */
  price: number;
}

export const HEART_PASSES: HeartPass[] = [
  { id: "hearts-24h", hours: 24, price: 149 },
  { id: "hearts-7d", hours: 24 * 7, price: 590 },
];

export interface BoostPack {
  id: string;
  mult: number;
  hours: number;
  /** ₸ */
  price: number;
}

export const BOOST_PACKS: BoostPack[] = [
  { id: "boost-24h", mult: 2, hours: 24, price: 290 },
  { id: "boost-7d", mult: 2, hours: 24 * 7, price: 990 },
];

// ---------- ИИ: бесплатно по тарифу, дальше за чипы ----------

/**
 * Вид обращения к ИИ. feedback — отзыв после урока: всегда бесплатен (дешёвая модель, без запроса ученика);
 * voice — расшифровка голосового вопроса (сам ответ — отдельное обращение chat).
 */
export type AiKind = "hint" | "explain" | "ask" | "chat" | "photo" | "review" | "voice" | "feedback";

/** Цена сверх бесплатных обращений, чипов (решение #34). */
export const AI_COST: Record<AiKind, number> = { hint: 3, explain: 5, ask: 5, chat: 7, photo: 10, review: 15, voice: 2, feedback: 0 };

/**
 * Вес вида обращения в «обращениях» дневного потолка (решение #48): фото — 2, голос — 4, отзыв после урока — 0
 * (у него свой потолок на сервере). Те же числа использует серверный страж (server/ai-guard.ts).
 */
export const AI_UNITS: Record<AiKind, number> = { hint: 1, explain: 1, ask: 1, chat: 1, photo: 2, review: 2, voice: 4, feedback: 0 };

/**
 * Потолок в обращениях в день — защита от перерасхода; одинаковый для всех тарифов (решение #48, правка v0.9.1): «Бесплатный» и «Лайт»
 * покупают или зарабатывают ответы ИИ, «Безлимит» — нет, но потолок нужен и ему. Бесплатные обращения по тарифу
 * (3 / 30 / без счёта) идут внутри потолка, сверх них — за чипы, но не больше потолка в сумме.
 * Серверный потолок устройства (AI_LIMIT_DEFAULTS.deviceDaily в server/ai-guard.ts) — то же число.
 */
export const AI_DAILY_CAP: Record<PlanTier, number> = { free: 65, lite: 65, unlimited: 65 };

export interface AiUsage {
  day: string;
  /** Обращений за день в «обращениях» (вес вида — AI_UNITS: фото 2, голос 4). */
  count: number;
  /** Из них бесплатных по тарифу за день (считаются штуками; для «Лайт» — дневной запас). */
  free: number;
  /**
   * Бесплатных обращений за всё время (решение #99): тариф «Бесплатный» получает {@link PLAN_FEATURES}.free.aiFree
   * бесплатных ответов ИИ один раз, а не каждый день. Не сбрасывается со сменой дня. Нет поля — 0 (санитайзер хранилища
   * добавляет его при загрузке).
   */
  freeTotal?: number;
}

/** Бесплатные ИИ-обращения тарифа даются один раз (всего), а не каждый день? Только «Бесплатный» (#99). */
export function aiFreeIsLifetime(tier: PlanTier): boolean {
  return tier === "free";
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
  const total = u?.freeTotal || 0;
  return u && u.day === today ? { day: today, count: u.count || 0, free: u.free || 0, freeTotal: total } : { day: today, count: 0, free: 0, freeTotal: total };
}

/**
 * Сколько бесплатных обращений осталось (Infinity — без ограничений): у «Бесплатного» — за всё время (#99),
 * у «Лайт» — на сегодня.
 */
export function aiFreeLeft(tier: PlanTier, u: AiUsage | undefined, today: string): number {
  const f = PLAN_FEATURES[tier].aiFree;
  if (!Number.isFinite(f)) return Infinity;
  const cur = usageToday(u, today);
  const used = aiFreeIsLifetime(tier) ? (cur.freeTotal ?? 0) : cur.free;
  return Math.max(0, f - used);
}

/** Как будет оплачено обращение (без изменения состояния). */
export function quoteAi(kind: AiKind, tier: PlanTier, usage: AiUsage | undefined, chips: number, today: string): AiReceipt {
  const u = usageToday(usage, today);
  if (u.count + AI_UNITS[kind] > AI_DAILY_CAP[tier]) return { ok: false, kind, day: today, cost: 0, reason: "cap" };
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
  return { day: r.day, count: cur.count + AI_UNITS[r.kind], free: cur.free + (usesFree ? 1 : 0), freeTotal: (cur.freeTotal ?? 0) + (usesFree ? 1 : 0) };
}

/** Возврат обращения по квитанции (тот же день). */
export function refundAiUsage(u: AiUsage | undefined, r: AiReceipt): AiUsage {
  const base: AiUsage = u
    ? { day: u.day, count: u.count || 0, free: u.free || 0, freeTotal: u.freeTotal || 0 }
    : { day: r.day, count: 0, free: 0, freeTotal: 0 };
  // Неудачная квитанция ничего не списывала.
  if (!r.ok) return base;
  const usesFree = r.pay === "free" && r.kind !== "feedback";
  // Бесплатное «за всё время» возвращается и в другой день: ответ не получен — попытка не потрачена.
  const freeTotal = Math.max(0, (base.freeTotal ?? 0) - (usesFree ? 1 : 0));
  // Дневные счётчики за другой день не возвращаем.
  if (base.day !== r.day) return { ...base, freeTotal };
  return { day: r.day, count: Math.max(0, base.count - AI_UNITS[r.kind]), free: Math.max(0, base.free - (usesFree ? 1 : 0)), freeTotal };
}

/**
 * Санитайзер учёта ИИ из хранилища. Миграция (#99): у старых данных нет `freeTotal` — считаем потраченными из «трёх навсегда»
 * те бесплатные, что уже потрачены сегодня (`today` — ключ сегодняшнего дня).
 */
export function sanitizeAiUsage(raw: unknown, today = ""): AiUsage {
  const u = (raw ?? {}) as Partial<AiUsage>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const day = typeof u.day === "string" ? u.day : "";
  const free = n(u.free);
  const hasTotal = typeof u.freeTotal === "number" && Number.isFinite(u.freeTotal);
  const freeTotal = hasTotal ? n(u.freeTotal) : day !== "" && day === today ? free : 0;
  return { day, count: n(u.count), free, freeTotal };
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

// ---------- Кейс за новый уровень (волна 1Б, R3: lib/level-case.ts) ----------

export type CasePrizeId = "xp50" | "xp100" | "hearts" | "chips10" | "chips20" | "chips30" | "boost" | "cosmetic";

/**
 * Веса призов кейса (сумма 110). Кейс не продаётся и не покупается — награда за обучение.
 * `cosmetic` — украшение профиля (lib/cosmetics.ts); когда выдавать нечего (всё редкое уже есть), вместо него `chips30`.
 */
export const LEVEL_CASE_WEIGHTS: Record<CasePrizeId, number> = {
  xp50: 24,
  xp100: 8,
  hearts: 18,
  chips10: 22,
  chips20: 14,
  chips30: 6,
  boost: 8,
  cosmetic: 10,
};
/** Опыт и чипы в призах кейса (всё остальное — по id). */
export const LEVEL_CASE_XP: Partial<Record<CasePrizeId, number>> = { xp50: 50, xp100: 100 };
export const LEVEL_CASE_CHIPS: Partial<Record<CasePrizeId, number>> = { chips10: 10, chips20: 20, chips30: 30 };
/** Сердечки уже полные (или безлимит) — вместо них столько чипов. */
export const LEVEL_CASE_HEARTS_SUBSTITUTE_CHIPS = 15;
/** Бустер из кейса: множитель и длительность, мин. */
export const LEVEL_CASE_BOOST = { mult: 2, minutes: 15 } as const;
