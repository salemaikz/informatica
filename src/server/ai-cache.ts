import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

// Кэш неперсональных ответов ИИ (подсказка/разбор на первый запрос, быстрые вопросы-кнопки).
// Два уровня: LRU в памяти процесса (500 записей) → Data Cache Next (`unstable_cache`, 30 дней,
// живёт между запросами и деплоями; на Vercel общий). Ошибки и пустые ответы не кэшируются.
// Правила выбора кэшируемых запросов и ключ — в src/lib/ai-cache.ts (там же тесты).

const MEM_MAX = 500;
const TTL_SECONDS = 30 * 24 * 3600;

const mem = new Map<string, string>();
const inflight = new Map<string, Promise<CachedAnswer>>();

export interface CachedAnswer {
  text: string;
  /** true — ответ взят из кэша (память или Data Cache), без обращения к модели. */
  hit: boolean;
  /** false — ответ-заглушка: его нельзя запоминать ни на сервере, ни на клиенте. */
  cacheable: boolean;
}

/** Бросается из генератора, когда есть ответ, но кэшировать его нельзя (например, подсказка выдавала ответ). */
export class SkipCache extends Error {
  constructor(public text: string) {
    super("skip_cache");
  }
}

export const sha256 = (payload: string): string => createHash("sha256").update(payload).digest("hex");

function memGet(key: string): string | undefined {
  const v = mem.get(key);
  if (v === undefined) return undefined;
  mem.delete(key);
  mem.set(key, v); // LRU: обращение переносит запись в конец
  return v;
}

function memSet(key: string, text: string) {
  mem.delete(key);
  mem.set(key, text);
  while (mem.size > MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

/**
 * Ответ из кэша или генерация. `produce` возвращает текст (пустой — ошибка) или бросает SkipCache.
 * Одновременные одинаковые запросы делят одну генерацию.
 */
export function cachedAnswer(key: string, produce: () => Promise<string>): Promise<CachedAnswer> {
  const cached = memGet(key);
  if (cached !== undefined) return Promise.resolve({ text: cached, hit: true, cacheable: true });
  const running = inflight.get(key);
  if (running) return running;

  const job = (async (): Promise<CachedAnswer> => {
    let ran = false;
    const st: { skipped: string | null; produced: string | null } = { skipped: null, produced: null };
    const generate = async () => {
      ran = true;
      try {
        const text = await produce();
        if (!text.trim()) throw new Error("empty_answer");
        st.produced = text;
        return text;
      } catch (e) {
        if (e instanceof SkipCache) st.skipped = e.text;
        throw e;
      }
    };
    try {
      const text = await unstable_cache(generate, ["ai-cache", key], { revalidate: TTL_SECONDS, tags: ["ai-cache"] })();
      memSet(key, text);
      return { text, hit: !ran, cacheable: true };
    } catch (e) {
      if (st.skipped !== null) return { text: st.skipped, hit: false, cacheable: false };
      // Ответ получен, но Data Cache не смог его сохранить — токены уже потрачены, отдаём ответ.
      if (st.produced !== null) {
        memSet(key, st.produced);
        return { text: st.produced, hit: false, cacheable: true };
      }
      if (ran) throw e;
      // Хранилище Next недоступно (dev/нестандартный хостинг) — работаем без него, только память.
      console.warn("[ai] data cache unavailable, using memory only");
      let text: string;
      try {
        text = await generate();
      } catch (e2) {
        if (st.skipped !== null) return { text: st.skipped, hit: false, cacheable: false };
        throw e2;
      }
      memSet(key, text);
      return { text, hit: false, cacheable: true };
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Лог по формату проекта: `[ai] route=tutor:hint cache=hit` / `cache=miss in=… out=…`. */
export function logCache(
  route: string,
  cache: "hit" | "miss" | "skip",
  model?: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null,
) {
  if (cache === "hit") {
    console.info(`[ai] route=${route} cache=hit`);
    return;
  }
  console.info(`[ai] route=${route} cache=${cache} model=${model ?? "?"} in=${usage?.prompt_tokens ?? 0} out=${usage?.completion_tokens ?? 0}`);
}
