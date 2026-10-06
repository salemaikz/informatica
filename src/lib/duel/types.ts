import type { Statement } from "../bank/types";
import type { CosmeticId } from "../cosmetics";
import type { ChoiceStep, Level, SkillId } from "../types";

// Общие типы дуэлей «Жекпе-жек» (этап 16Д, docs/specs/duels.md §5–§6). Чистые, без React и без сервера:
// один и тот же код у клиента, у сервера и у бота.

/** Режим дуэли: «Блиц», «Верю — не верю», «10 вопросов», «10 вопросов по теме». */
export type DuelModeId = "blitz" | "truth" | "ten" | "topic";

/** Полоса уровня (по TIER_STARTS): 1 — ур. 1–4, 2 — 5–9, 3 — 10–19, 4 — 20+. */
export type DuelBand = 1 | 2 | 3 | 4;

/** Форма задания в дуэли: выбор варианта или утверждение «верю — не верю». Ввода с клавиатуры в фазе 1 нет. */
export type DuelShape = "choice" | "statement";

/** Тема режима «по теме»: id темы ЕНТ (`t01`…`t13`) или раздела курса (`u0`…, `school`). */
export type DuelTopic = string;

interface DuelItemBase {
  /** Номер в наборе (0…n−1). */
  i: number;
  /** Ключ задания: не зависит от языка (тест «ru = kk»). */
  key: string;
  mode: DuelModeId;
  skill: SkillId;
  level: Level;
  /** Лимит на задание, мс («10 вопросов»); null — общие часы режима. */
  limitMs: number | null;
}

export interface DuelChoiceItem extends DuelItemBase {
  shape: "choice";
  step: ChoiceStep;
}

export interface DuelStatementItem extends DuelItemBase {
  shape: "statement";
  statement: Statement;
}

export type DuelItem = DuelChoiceItem | DuelStatementItem;

/**
 * Ответ: индекс варианта (выбор) или true/false (утверждение). Тайм-аут на задании «10 вопросов» — любой негодный
 * ответ (например −1): он засчитывается как неверный.
 */
export type DuelAnswer = boolean | number;

/** Событие таймлайна соперника: задание i, верно или нет, t — мс от старта матча (накопленно). */
export interface DuelEvent {
  i: number;
  ok: boolean;
  t: number;
}

/** Ответ, который клиент отправляет серверу: ms — время на задание по часам клиента. */
export interface AnswerIn {
  i: number;
  a: DuelAnswer;
  ms: number;
}

/** Публичная карточка игрока (имя уже отфильтровано сервером; null → «Игрок 4821» на языке зрителя). */
export interface PublicCard {
  code: string;
  name: string | null;
  lv: number;
  frame: CosmeticId | null;
  title: CosmeticId | null;
  bot?: true;
}

/** Место в матче (выдаёт сервер; seat — подписанный токен). */
export interface MatchJoin {
  matchId: string;
  seat: string;
  seed: number;
  mode: DuelModeId;
  band: DuelBand;
  n: number;
  deckTag: string;
  startAt: number;
  endsAt: number;
  topic?: DuelTopic;
}

export interface SideView {
  card: PublicCard;
  answered: number;
  correct: number;
  score: number;
  done: boolean;
  idleMs: number;
  /** Подтвердил готовность (живой матч, до старта). */
  ready?: boolean;
}

/** Почему матч не попал в топ (плашка на итогах). */
export type NotCountedWhy = "bot" | "fast" | "short" | "pair_limit" | "daily_limit";

export interface MatchView {
  id: string;
  kind: "live" | "room";
  state: "lobby" | "countdown" | "playing" | "finished" | "cancelled";
  serverNow: number;
  you: SideView;
  opp: SideView | null;
  oppTl: DuelEvent[];
  /** Свои принятые ответы — только по запросу (?me=1): продолжить матч после перезагрузки вкладки. */
  youTl?: DuelEvent[];
  result?: {
    winner: "you" | "opp" | "draw";
    reason: "score" | "correct" | "time" | "left" | "idle";
    weekPts: number;
    counted: boolean;
    why?: NotCountedWhy;
  };
  rematch?: { you: boolean; opp: boolean; next?: MatchJoin };
  /** Своё место в матче — до старта (хозяин комнаты узнаёт его, когда друг вошёл). */
  join?: MatchJoin;
  /** Почему матч отменён: соперник не подтвердил готовность, кто-то ушёл до старта, комната истекла. */
  cancelled?: "no_ready" | "left" | "expired";
}
