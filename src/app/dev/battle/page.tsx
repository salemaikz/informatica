import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BattleLab } from "./BattleLab";

// Эскизы стилей битвы (этап 16Е, docs/specs/battle.md §5): владелец выбирает стиль персонажей. Только для разработки
// и превью: в продакшене — 404 (кроме BATTLE_LAB=1). Только по-русски.

export const metadata: Metadata = { title: "Битва: стили", robots: { index: false, follow: false, nocache: true } };

export default async function BattleLabPage() {
  // Сначала запрос: иначе при сборке ответ запёкся бы в статику.
  await connection();
  if (process.env.VERCEL_ENV === "production" && process.env.BATTLE_LAB !== "1") notFound();
  return (
    <Suspense>
      <BattleLab />
    </Suspense>
  );
}
