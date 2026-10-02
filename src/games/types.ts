import type { ComponentType } from "react";
import type { L, Lang, SkillId } from "@/lib/types";

// Контракт мини-игры. Игра — один React-компонент: рисует только игровое поле,
// сама ведёт таймер и ровно один раз вызывает onFinish. Вступление и итоги рисует GameShell.

export interface GameAttempt {
  skill: SkillId;
  correct: boolean;
}

export interface GameResult {
  /** Очки игры (для рекорда). */
  score: number;
  correct: number;
  total: number;
  /** Каждое оцениваемое действие → навык и верность (для модели освоения). */
  attempts: GameAttempt[];
}

export interface GameProps {
  lang: Lang;
  sound: boolean;
  onFinish: (result: GameResult) => void;
}

export interface GameMeta {
  id: string;
  title: L;
  description: L;
  /** Короткие правила для экрана перед игрой (markdown не нужен). */
  rules: L;
  icon: string;
  /** CSS-цвет акцента карточки. */
  color: string;
  skills: SkillId[];
  /** Примерная длительность, сек. */
  durationSec: number;
}

/** Ленивый компонент игры (реестр компонентов — src/games/components.ts). */
export type GameComponent = ComponentType<GameProps>;
