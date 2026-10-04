import type { DictKey } from "@/i18n/dict";

// Код ошибки ИИ → ключ словаря. Без React и без "use client": им пользуются и lib/ai.ts, и lib/voice.ts
// (его импортирует серверный маршрут расшифровки). Тест — tests/ai-stream.test.ts.

/**
 * rate_limited — всплеск запросов; daily_limit — дневной лимит устройства или адреса; ai_busy — общий запас сайта;
 * stream_cut — ответ оборвался. Остальное — общая ошибка.
 */
export function aiCodeKey(code: string | undefined): DictKey {
  switch (code) {
    case "rate_limited":
    case "http_429":
      return "ai.err.burst";
    case "daily_limit":
      return "tutor.limit";
    case "ai_busy":
      return "ai.err.busy";
    case "stream_cut":
      return "ai.err.cut";
    default:
      return "tutor.error";
  }
}

/** После этих ошибок есть смысл «Повторить» (сбой, обрыв, всплеск запросов); дневной лимит, общий запас и чипы — нет. */
export function canRetryAiError(key: DictKey | null): boolean {
  return key === "tutor.error" || key === "ai.err.cut" || key === "ai.err.burst";
}
