"use client";

import { ShortfallSheet } from "./ShortfallSheet";

/**
 * «Сердечки закончились» / «Не хватает сердечек» (#40: сердечки — плата за вход в урок, тренировку, тест или игру).
 * С этапа 16Г — тонкая обёртка над единым окном «Не хватает» (ShortfallSheet, #121): подождать следующее (таймер),
 * купить за чипы (только недостающие), купить чипы (₸ — «Оплата скоро»), пополнить все за ₸, «Безлимит» (и пробный), заработать, выйти.
 * Бесплатной тренировки нет (этап 16В). Подпись диалога «Сердечки закончились» — по ней ищут окно тесты.
 * layout="sheet" — шторка поверх экрана (open/onClose); layout="screen" — полноэкранно на входе.
 * need — цена входа (0,5, 1 или 2): окно предлагает продолжить, когда сердечек хватает на вход.
 * what="theory" — окно открытия темы теории (0,5): другой текст. context="code" — открыто из задачи кода: подзаголовок упоминает задачи кода.
 * onResume — сердечек хватает (куплены, восстановились или пробный «Безлимит»): вызывающий продолжает вход.
 */
export function OutOfHearts({
  layout = "sheet",
  open = true,
  need = 1,
  onClose,
  what = "entry",
  context,
  onResume,
  onExit,
}: {
  layout?: "sheet" | "screen";
  open?: boolean;
  need?: number;
  onClose?: () => void;
  what?: "entry" | "theory";
  context?: "code";
  onResume: () => void;
  onExit: () => void;
}) {
  return <ShortfallSheet need="hearts" cost={need} layout={layout} open={open} onClose={onClose} what={what} context={context} onResume={onResume} onExit={onExit} plansFrom="hearts" />;
}
