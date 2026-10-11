import type { ComponentType } from "react";

// Эскизы стилей битвы (этап 16Е, docs/specs/battle.md §5): общий контракт варианта. Страница /dev/battle рисует экран
// варианта в рамке телефона и управляет демо-боем; вариант только рисует и анимирует. Только для выбора стиля владельцем.

/** Событие боя, которое запускает анимацию (смена nonce — новая анимация, даже если kind тот же). */
export type BattleEventKind =
  | "hit" // вы ударили соперника
  | "crit" // вы ударили критом (комбо ≥ 5)
  | "taken" // соперник ударил вас
  | "miss" // вы ошиблись: комбо сброшено, ваш персонаж «оглушён» 1,5 с
  | "ko" // соперник нокаутирован — вы победили
  | "lose"; // вы нокаутированы

export interface BattleEvent {
  kind: BattleEventKind;
  /** Урон удара (0 у miss). */
  dmg: number;
  nonce: number;
}

export interface Fighter {
  name: string;
  level: number;
  /** Здоровье 0…100. */
  hp: number;
  /** id скина из variant.skins. */
  skin: string;
}

export interface DemoQuestion {
  prompt: string;
  options: string[];
  correct: number;
}

export interface BattleScreenProps {
  you: Fighter;
  opp: Fighter;
  /** Верных подряд у вас (0 — комбо нет). */
  combo: number;
  /** Последнее событие; null — бой только начался. */
  event: BattleEvent | null;
  question: DemoQuestion;
  /** Выбранный вариант текущего вопроса (подсветка верно/неверно); null — ещё не ответили. */
  picked: number | null;
  /** Ваш персонаж оглушён после ошибки — ответы не принимаются. */
  stunned: boolean;
  onAnswer: (i: number) => void;
  /** Осталось на часах боя, мс. */
  timeLeftMs: number;
}

export type SkinRarity = "common" | "rare" | "epic" | "legendary";

export interface SkinDef {
  id: string;
  /** Название скина (только по-русски — страница для разработчика). */
  name: string;
  rarity: SkinRarity;
}

export interface BattleVariant {
  id: "creatures" | "robots" | "pixel" | "space";
  title: string;
  /** Одна-две фразы: в чём идея стиля. */
  pitch: string;
  /** Первый — базовый (бесплатный у всех); дальше по возрастанию редкости. */
  skins: readonly SkinDef[];
  /** Экран боя на ширину телефона (360–430 px). */
  Screen: ComponentType<BattleScreenProps>;
  /** Персонаж в покое — для витрины скинов. */
  SkinPreview: ComponentType<{ skin: string; size: number }>;
}
