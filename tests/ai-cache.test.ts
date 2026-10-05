import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_CACHE_KEY,
  cacheableRequest,
  cacheKeyPayload,
  cacheStyle,
  cacheTask,
  clientCacheGet,
  clientCacheKey,
  clientCachePut,
  isQuickQuestion,
  leaksAnswer,
  PROMPT_VERSION,
  type KV,
} from "@/lib/ai-cache";
import { dict } from "@/i18n/dict";
import type { TaskContext } from "@/lib/ai-types";

vi.mock("server-only", () => ({}));

const task: TaskContext = { prompt: "Переведи 1011₂ в десятичную", options: ["9", "11", "13"], correct: "11", explanation: "8+2+1" };

const key = (over: Partial<Parameters<typeof cacheKeyPayload>[0]> = {}) =>
  cacheKeyPayload({ mode: "hint", lang: "ru", style: "short", task, ...over });

describe("ключ кэша", () => {
  it("одинаковые задания дают один ключ, лишние пробелы не важны", () => {
    expect(key()).toBe(key({ task: { ...task, prompt: "  Переведи   1011₂ в\nдесятичную " } }));
  });

  it("язык, стиль, режим и верный ответ меняют ключ", () => {
    const base = key();
    expect(key({ lang: "kk" })).not.toBe(base);
    expect(key({ style: "steps" })).not.toBe(base);
    expect(key({ mode: "explain" })).not.toBe(base);
    expect(key({ task: { ...task, correct: "13" } })).not.toBe(base);
    expect(key({ task: { ...task, options: ["9", "11"] } })).not.toBe(base);
  });

  it("неизвестный стиль приравнивается к short", () => {
    expect(cacheStyle("whatever")).toBe("short");
    expect(key({ style: "whatever" })).toBe(key({ style: "short" }));
  });

  it("ответ ученика (given) учитывается только в разборе ошибки", () => {
    const a = { ...task, given: "9" };
    const b = { ...task, given: "13" };
    expect(key({ task: a })).toBe(key({ task: b }));
    expect(key({ mode: "explain", task: a })).not.toBe(key({ mode: "explain", task: b }));
  });

  it("вопрос влияет на ключ ask", () => {
    expect(key({ mode: "ask", question: "объясни проще" })).not.toBe(key({ mode: "ask", question: "приведи пример" }));
  });

  it("в нейтральное задание не попадают данные, не нужные режиму", () => {
    const full: TaskContext = { ...task, given: "9", answered: true, hint: "h", whyWrong: "w", stepKey: "k" };
    const h = cacheTask("hint", full);
    expect(h.given).toBeUndefined();
    expect(h.explanation).toBeUndefined();
    expect(h.hint).toBe("h");
    expect(cacheTask("explain", full).given).toBe("9");
    expect(cacheTask("ask", full).given).toBeUndefined();
    expect(cacheTask("ask", { ...full, answered: false }).explanation).toBeUndefined();
  });

  it("клиентский ключ стабилен и зависит от содержимого", () => {
    expect(clientCacheKey(key())).toBe(clientCacheKey(key()));
    expect(clientCacheKey(key())).not.toBe(clientCacheKey(key({ lang: "kk" })));
  });
});

describe("cacheableRequest", () => {
  it("подсказка и разбор — только первый запрос без истории", () => {
    expect(cacheableRequest("hint", [], task)).toEqual({});
    expect(cacheableRequest("explain", [], task)).toEqual({});
    expect(cacheableRequest("hint", [{ role: "user", content: "а если так?" }], task)).toBeNull();
  });

  it("ask — только быстрая кнопка первым сообщением", () => {
    const ru = dict["tutor.q.simpler"].ru;
    const kk = dict["tutor.q.example"].kk;
    expect(cacheableRequest("ask", [{ role: "user", content: ru }], task)).toEqual({ question: ru.toLowerCase() });
    expect(cacheableRequest("ask", [{ role: "user", content: `  ${kk.toUpperCase()} ` }], task)).not.toBeNull();
    expect(cacheableRequest("ask", [{ role: "user", content: "Почему так?" }], task)).toBeNull();
    expect(
      cacheableRequest("ask", [{ role: "user", content: ru }, { role: "assistant", content: "..." }], task),
    ).toBeNull();
  });

  it("чат, картинка и пустое задание не кэшируются", () => {
    expect(cacheableRequest("chat", [], task)).toBeNull();
    expect(cacheableRequest("hint", [], task, true)).toBeNull();
    expect(cacheableRequest("hint", [], undefined)).toBeNull();
    expect(cacheableRequest("hint", [], { prompt: "" })).toBeNull();
  });

  it("isQuickQuestion узнаёт кнопки на обоих языках", () => {
    for (const k of ["tutor.q.simpler", "tutor.q.example", "tutor.q.why", "tutor.q.start"] as const) {
      expect(isQuickQuestion(dict[k].ru)).toBe(true);
      expect(isQuickQuestion(dict[k].kk)).toBe(true);
    }
    expect(isQuickQuestion("Привет")).toBe(false);
  });
});

describe("leaksAnswer", () => {
  it("число отдельным токеном — утечка", () => {
    expect(leaksAnswer("Получится 11, если сложить.", "11")).toBe(true);
    expect(leaksAnswer("Ответ: 11.", "11")).toBe(true);
  });

  it("число внутри другого числа — не утечка", () => {
    expect(leaksAnswer("Смотри на 1011₂ и на 110.", "11")).toBe(false);
    expect(leaksAnswer("Сложи 8 + 2 + 1.", "11")).toBe(false);
    expect(leaksAnswer("1010", "10")).toBe(false);
  });

  it("двоичные: нижний индекс не мешает", () => {
    expect(leaksAnswer("Должно получиться 1011.", "1011₂")).toBe(true);
    expect(leaksAnswer("Должно получиться 1011₂.", "1011₂")).toBe(true);
    expect(leaksAnswer("Прочитай остатки: 101 и 1.", "1011₂")).toBe(false);
    expect(leaksAnswer("Число 10111 длиннее.", "1011₂")).toBe(false);
  });

  it("короткие (1 символ) ответы не проверяем", () => {
    expect(leaksAnswer("Это 4 бита", "4")).toBe(false);
    expect(leaksAnswer("Ответ — б", "б")).toBe(false);
  });

  it("текстовый вариант: полное вхождение целыми словами, регистр и ё не важны", () => {
    expect(leaksAnswer("Это, конечно, Оперативная память.", "оперативная память")).toBe(true);
    expect(leaksAnswer("Подумай про память вообще.", "оперативная память")).toBe(false);
    expect(leaksAnswer("Всё ещё", "все еще")).toBe(true);
  });

  it("слово как подстрока другого слова — не утечка", () => {
    expect(leaksAnswer("Это системная программа", "ram")).toBe(false);
    expect(leaksAnswer("Используй bit и byte", "bi")).toBe(false);
    expect(leaksAnswer("Это сеть", "сет")).toBe(false);
  });

  it("короткий текстовый вариант choice (< 3 символов) не проверяем, число — проверяем", () => {
    expect(leaksAnswer("Скорее да, чем нет.", "да", { isOption: true })).toBe(false);
    expect(leaksAnswer("Здесь 16.", "16", { isOption: true })).toBe(true);
    expect(leaksAnswer("Это ЦП", "цп")).toBe(true);
  });

  it("составные ответы: каждая часть по отдельности", () => {
    expect(leaksAnswer("Среди них точно есть 7.", "3, 7")).toBe(false); // 1 символ
    expect(leaksAnswer("Выбери «принтер» тоже.", "монитор, принтер")).toBe(true);
    expect(leaksAnswer("Двоичная 1011 равна 11.", "1011₂ = 11")).toBe(true);
    expect(leaksAnswer("Начни с самой правой цифры.", "монитор, принтер")).toBe(false);
  });

  it("часть ответа, которая есть в условии, — не утечка", () => {
    // «Набери 11 битами»: подсказка вправе назвать 11, но не двоичную запись.
    expect(leaksAnswer("Разложи 11 на степени двойки.", "1011₂ = 11", { known: "Набери число 11" })).toBe(false);
    expect(leaksAnswer("Получится 1011.", "1011₂ = 11", { known: "Набери число 11" })).toBe(true);
    // Верный вариант прямо в условии («что больше: 101₂ или 110₂?») — его упоминание ничего не выдаёт.
    expect(leaksAnswer("Сравни 110₂ и 101₂ по старшему разряду.", "110₂", { isOption: true, known: "Что больше: 101₂ или 110₂?" })).toBe(false);
  });

  it("сопоставление: утечка — только пара целиком, одна сторона видна на экране", () => {
    const answer = "1 байт = 8 бит; 1 Кбайт = 1024 байт";
    expect(leaksAnswer("Вспомни, сколько бит в 1 байт.", answer)).toBe(false);
    expect(leaksAnswer("Подумай, что больше: 1 Кбайт или 8 бит.", answer)).toBe(false);
    expect(leaksAnswer("Запомни: 1 байт = 8 бит.", answer)).toBe(true);
  });

  it("варианты multi: короткий текстовый вариант не проверяем, длинный — проверяем", () => {
    const options = ["да", "монитор", "принтер", "ОЗУ"];
    expect(leaksAnswer("Скорее да, чем нет.", "да, монитор", { options })).toBe(false);
    expect(leaksAnswer("Посмотри на монитор.", "да, монитор", { options })).toBe(true);
  });

  it("пустой ответ — не утечка", () => {
    expect(leaksAnswer("что угодно", "")).toBe(false);
  });
});

function memStore(initial?: string): KV & { raw: () => string | null } {
  let data: string | null = initial ?? null;
  return {
    getItem: () => data,
    setItem: (_k, v) => {
      data = v;
    },
    raw: () => data,
  };
}

describe("клиентский кэш (LRU)", () => {
  it("кладёт и достаёт", () => {
    const s = memStore();
    clientCachePut("a", "ответ A", s);
    expect(clientCacheGet("a", s)).toBe("ответ A");
    expect(clientCacheGet("zzz", s)).toBeNull();
  });

  it("вытесняет самые старые при переполнении", () => {
    const s = memStore();
    for (const k of ["a", "b", "c", "d"]) clientCachePut(k, `t${k}`, s, 3);
    expect(clientCacheGet("a", s)).toBeNull();
    expect(clientCacheGet("d", s)).toBe("td");
  });

  it("обращение освежает запись и она переживает вытеснение", () => {
    const s = memStore();
    for (const k of ["a", "b", "c"]) clientCachePut(k, `t${k}`, s, 3);
    expect(clientCacheGet("a", s)).toBe("ta"); // a теперь самая свежая
    clientCachePut("d", "td", s, 3); // вытесняется b
    expect(clientCacheGet("b", s)).toBeNull();
    expect(clientCacheGet("a", s)).toBe("ta");
  });

  it("повторная запись того же ключа не плодит дубликатов", () => {
    const s = memStore();
    clientCachePut("a", "1", s, 3);
    clientCachePut("a", "2", s, 3);
    expect(JSON.parse(s.raw()!)).toEqual([["a", "2"]]);
  });

  it("повреждённые данные не ломают кэш", () => {
    for (const bad of ["{не json", '{"a":1}', "[1,2]", '[["a"]]', '[["a",5]]', "null"]) {
      const s = memStore(bad);
      expect(clientCacheGet("a", s)).toBeNull();
      clientCachePut("a", "ok", s);
      expect(clientCacheGet("a", s)).toBe("ok");
    }
  });

  it("частично повреждённые записи отбрасываются, остальные живы", () => {
    const s = memStore(JSON.stringify([["a", "ok"], 5, ["b"], ["c", 3]]));
    expect(clientCacheGet("a", s)).toBe("ok");
  });

  it("недоступное хранилище (приватный режим) — молча без кэша", () => {
    const broken: KV = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => clientCachePut("a", "x", broken)).not.toThrow();
    expect(clientCacheGet("a", broken)).toBeNull();
    expect(clientCacheGet("a", null)).toBeNull();
  });

  it("пустой ответ не кладём; ключ хранилища версионирован", () => {
    const s = memStore();
    clientCachePut("a", "   ", s);
    expect(s.raw()).toBeNull();
    expect(CLIENT_CACHE_KEY).toBe("informatica:ai-cache:v5");
  });

  it("v3: записи старых ключей v1 и v2 (ответы до правок промпта) не читаются и стираются при первой записи", () => {
    const store = new Map<string, string>([
      ["informatica:ai-cache:v1", JSON.stringify([["k", "Обрезанный отв"]])],
      ["informatica:ai-cache:v2", JSON.stringify([["k", "Ответ до v0.9.1"]])],
      ["informatica:ai-cache:v4", JSON.stringify([["k", "Ответ до этапа 16В"]])],
    ]);
    const s = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    expect(clientCacheGet("k", s)).toBeNull();
    clientCachePut("n", "Новый ответ", s);
    expect(store.has("informatica:ai-cache:v1")).toBe(false);
    expect(store.has("informatica:ai-cache:v2")).toBe(false);
    expect(store.has("informatica:ai-cache:v4")).toBe(false);
    expect(clientCacheGet("n", s)).toBe("Новый ответ");
    expect(clientCacheGet("k", s)).toBeNull();
  });

  it("версия в ключе кэша ответов поднята: ключи прежних версий не совпадают", () => {
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(cacheKeyPayload({ mode: "hint", lang: "ru", style: "short", task: { prompt: "x" } })).v).toBe(PROMPT_VERSION);
  });
});

describe("ключ кэша: ответы нерешённого задания (#100)", () => {
  const key = (secrets?: string[][], answered?: boolean) =>
    cacheKeyPayload({ mode: "ask", lang: "ru", style: "short", task: { prompt: "p", secrets, answered }, question: "объясни проще" });

  it("стоп-слова входят в ключ: запрос без них не получит чужой ответ из кэша", () => {
    expect(key([["ввод"]])).not.toBe(key());
    expect(key([["ввод"]])).not.toBe(key([["вывод"]]));
    expect(key([["ввод"]])).toBe(key([["ввод"]]));
  });

  it("у решённого задания стоп-слов нет — ключ их не хранит", () => {
    expect(key([["ввод"]], true)).toBe(key(undefined, true));
  });
});

describe("sameOrigin", () => {
  const req = (headers: Record<string, string>) => new Request("https://app.example/api/ai/tutor", { method: "POST", headers });

  it("без Origin вне production — пропускаем (curl, тесты), в production — отказ", async () => {
    const { sameOrigin } = await import("@/server/context");
    expect(sameOrigin(req({ host: "app.example" }))).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(sameOrigin(req({ host: "app.example" }))).toBe(false);
      expect(sameOrigin(req({ origin: "https://app.example", host: "app.example" }))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("Sec-Fetch-Site, если есть, должен быть same-origin", async () => {
    const { sameOrigin } = await import("@/server/context");
    const base = { origin: "https://app.example", host: "app.example" };
    expect(sameOrigin(req({ ...base, "sec-fetch-site": "same-origin" }))).toBe(true);
    for (const site of ["cross-site", "same-site", "none"]) expect(sameOrigin(req({ ...base, "sec-fetch-site": site }))).toBe(false);
    expect(sameOrigin(req({ host: "app.example", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("Origin совпадает с Host или x-forwarded-host", async () => {
    const { sameOrigin } = await import("@/server/context");
    expect(sameOrigin(req({ origin: "https://app.example", host: "app.example" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" }))).toBe(true);
    expect(sameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });

  it("чужой, пустой и кривой Origin — отказ", async () => {
    const { sameOrigin } = await import("@/server/context");
    expect(sameOrigin(req({ origin: "https://evil.example", host: "app.example" }))).toBe(false);
    expect(sameOrigin(req({ origin: "https://app.example.evil.com", host: "app.example" }))).toBe(false);
    expect(sameOrigin(req({ origin: "null", host: "app.example" }))).toBe(false);
    expect(sameOrigin(req({ origin: "https://app.example" }))).toBe(false);
  });
});
