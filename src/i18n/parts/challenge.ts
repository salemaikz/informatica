import type { L } from "@/lib/types";

// Вызов другу (#73): баннер перед вариантом, сравнение после итогов (ru + kk). Ключи — `challenge.*`.
// Без имён: «У друга: 14 из 19». Казахский — литературный, порядок «19 ішінен 14».
export const challengeDict = {} satisfies Record<string, L>;
