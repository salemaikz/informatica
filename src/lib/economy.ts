import type { L } from "./types";
import type { SessionResult } from "./types";

export type LearningRunKind = "lesson" | "drill" | "review" | "code" | "section-test" | "ent" | "game";
export type SubscriptionPlan = "free" | "lite" | "unlimited";
export interface Subscription { plan: SubscriptionPlan; expiresAt: number | null }
export interface HeartWallet { count: number; refilledAt: number }
export interface ChipTransaction { id: string; reason: string; amount: number; at: number }

export const ECONOMY = {
  dailyGoal: 2,
  firstLesson: 2,
  perfectLesson: 3,
  sectionTest: 5,
  ent: 5,
  freeHearts: 5,
  liteHearts: 6,
  heartRefillMs: 4 * 60 * 60 * 1000,
  historyRetentionMs: 7 * 24 * 60 * 60 * 1000,
  xpBoostCost: 40,
  xpBoostDurationMs: 15 * 60 * 1000,
  refillPriceKzt: 490,
} as const;

export function activePlan(subscription: Subscription, now = Date.now()): SubscriptionPlan {
  return subscription.plan !== "free" && subscription.expiresAt !== null && subscription.expiresAt > now ? subscription.plan : "free";
}

export function heartStatus(wallet: HeartWallet, subscription: Subscription, now = Date.now()) {
  const plan = activePlan(subscription, now);
  const unlimited = plan === "unlimited";
  const maxHearts = plan === "lite" ? ECONOMY.liteHearts : ECONOMY.freeHearts;
  const refilledAt = Math.min(wallet.refilledAt || now, now);
  const elapsed = Math.max(0, Math.floor((now - refilledAt) / ECONOMY.heartRefillMs));
  const hearts = Math.min(maxHearts, Math.max(0, wallet.count) + elapsed);
  const anchor = hearts === maxHearts ? now : refilledAt + elapsed * ECONOMY.heartRefillMs;
  return { hearts, maxHearts, unlimited, refilledAt: anchor, nextRefillAt: hearts < maxHearts ? anchor + ECONOMY.heartRefillMs : null };
}

export function spendHeart(wallet: HeartWallet, subscription: Subscription, now = Date.now()): HeartWallet | null {
  const status = heartStatus(wallet, subscription, now);
  if (status.unlimited) return wallet;
  if (status.hearts <= 0) return null;
  return { count: status.hearts - 1, refilledAt: status.refilledAt };
}

export function recentChipHistory(history: ChipTransaction[], now = Date.now()): ChipTransaction[] {
  return history.filter((entry) => entry.at >= now - ECONOMY.historyRetentionMs && entry.at <= now);
}

/** Пропущенные задачи не могут превратить пустое занятие в пройденный урок. */
export function canFinishSession(result: Pick<SessionResult, "answers" | "skipped">): boolean {
  const attempts = new Set(result.answers.filter((answer) => !answer.retry).map((answer) => answer.stepId)).size;
  const skipped = Number.isFinite(result.skipped) ? Math.max(0, Math.floor(result.skipped ?? 0)) : 0;
  return attempts > 0 && attempts / (attempts + skipped) >= 0.7;
}

export const CHIP_REASONS: Record<string, L> = {
  daily: { ru: "Цель дня выполнена", kk: "Күндік мақсат орындалды" },
  lesson: { ru: "Урок пройден впервые", kk: "Сабақ алғаш рет аяқталды" },
  perfect: { ru: "Идеальный урок", kk: "Мінсіз сабақ" },
  "section-test": { ru: "Тест по разделу", kk: "Бөлім бойынша тест" },
  ent: { ru: "Пробный ЕНТ", kk: "Сынақ ҰБТ" },
  achievement: { ru: "Новое достижение", kk: "Жаңа жетістік" },
  boost: { ru: "Ускоритель опыта", kk: "Тәжірибе үдеткіші" },
};
