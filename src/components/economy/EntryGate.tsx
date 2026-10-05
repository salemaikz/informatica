"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { canAfford } from "@/lib/economy";
import { OutOfHearts } from "./OutOfHearts";
import { useHearts } from "./useEconomy";

/**
 * Вход по сердечкам (#40): не хватает на вход (need) и не безлимит — вместо детей полноэкранное «Сердечки закончились».
 * Сердечки списывает сам экран при первом действии (первый ответ, «Начать», «Играть»), здесь только проверка на входе.
 * Допуск запоминаем: если сердечки кончатся уже внутри (например, оплатили вход), экран не пропадает.
 * Дети приходят готовым элементом — пересчёт таймера сердечек их не перерисовывает.
 */
export function EntryGate({
  need,
  exitHref,
  theoryHref,
  children,
}: {
  /** Цена входа; 0 — вход уже оплачен (продолжение в течение 20 минут) или бесплатный. */
  need: number;
  /** Куда «Выйти». */
  exitHref: string;
  /** «Пока почитай теорию» — для урока. */
  theoryHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const v = useHearts();
  const [admitted, setAdmitted] = useState(false);
  const ok = canAfford(v, need);
  // «Предыдущее значение» при рендере (без эффекта с setState): сердечко вернулось или куплено — впускаем.
  if (!admitted && ok) setAdmitted(true);
  if (admitted || ok) return <>{children}</>;
  return <OutOfHearts layout="screen" need={need} onResume={() => setAdmitted(true)} onExit={() => router.push(exitHref)} theoryHref={theoryHref} />;
}
