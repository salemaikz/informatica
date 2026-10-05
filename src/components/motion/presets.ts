import type { Transition } from "motion/react";

// Общие «характеры» движения: быстрые и пружинистые, но без долгого раскачивания (≤ 400 мс на отклик).

/** Нажатия, переключатели: резко и без заметного перелёта. */
export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 32 };
/** Появление панелей и карточек. */
export const springSoft: Transition = { type: "spring", stiffness: 340, damping: 28 };
/** Награды и «поп»: с лёгким перелётом. */
export const springBouncy: Transition = { type: "spring", stiffness: 460, damping: 17 };
/** Кривая «ease-out expo» для переходов между шагами и страницами. */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Задержка появления i-го элемента «лесенки» (плитки итогов), с. */
export const staggerDelay = (i: number, base = 0.1, step = 0.12) => base + i * step;
