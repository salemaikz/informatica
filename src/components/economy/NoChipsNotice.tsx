"use client";

import { AI_COST, type AiKind } from "@/lib/economy";
import { ShortfallSheet } from "./ShortfallSheet";

/**
 * Вместо текста ошибки «не хватает чипов» (receipt.reason === "chips"): встроенная карточка в ИИ-панели или чате.
 * С этапа 16Г — вариант единого окна «Не хватает» (ShortfallSheet, #121): «Нужно N чипов, у тебя M», купить чипы
 * (₸ — «Оплата скоро» поверх, со страницы не уходим), «Безлимит» и пробный период. Остаток читает из кошелька — обновляется сам.
 */
export function NoChipsNotice({ kind, className }: { kind: AiKind; className?: string }) {
  return <ShortfallSheet need="chips" cost={AI_COST[kind]} where="ai" layout="inline" plansFrom="ai" className={className} />;
}
