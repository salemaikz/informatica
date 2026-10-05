// Просьба включить уведомления (этап 15, отзыв владельца 2026-10-05): мягкое окно с первого входа; не включили —
// напоминаем: первую неделю раз в 3 дня, потом раз в неделю. Чистая логика без React (тесты — tests/push-ask.test.ts).
// Каркас — главная модель; правило показа (`shouldAskPush`) реализует пакет F3.

/** Когда последний раз показывали окно и сколько раз всего. */
export interface PushAskState {
  lastAt: number;
  count: number;
}

export const EMPTY_PUSH_ASK: PushAskState = { lastAt: 0, count: 0 };

/** Состояние из localStorage — недоверенные данные. */
export function sanitizePushAsk(raw: unknown): PushAskState {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Partial<PushAskState>;
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  return { lastAt: ok(r.lastAt) ? Math.floor(r.lastAt!) : 0, count: ok(r.count) ? Math.floor(r.count!) : 0 };
}
