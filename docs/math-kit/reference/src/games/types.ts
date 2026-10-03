import type { LucideIcon } from "lucide-react";
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

/**
 * Темп игры (выбирает ученик перед началом):
 * - calm — без таймера, после ошибки показывается разбор, доступны все инструменты, рекорд не ставится;
 * - normal — время на задание зависит от его сложности, доступен калькулятор «как на ЕНТ»;
 * - blitz — на скорость и рекорд, без инструментов.
 */
export type GameMode = "calm" | "normal" | "blitz";

export interface GameProps {
  lang: Lang;
  sound: boolean;
  mode: GameMode;
  onFinish: (result: GameResult) => void;
}

export interface GameMeta {
  id: string;
  title: L;
  description: L;
  /** Короткие правила для экрана перед игрой (markdown не нужен). */
  rules: L;
  /** Рисованная иконка (lucide), не эмодзи. */
  icon: LucideIcon;
  /** CSS-цвет фона плитки игры. */
  color: string;
  /** CSS-цвет иконки на плитке. */
  ink: string;
  skills: SkillId[];
  /** Примерная длительность, сек. */
  durationSec: number;
}

/** Ленивый компонент игры (реестр компонентов — src/games/components.ts). */
export type GameComponent = ComponentType<GameProps>;
