import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  audioExt,
  baseAudioType,
  formatTimer,
  isIosUserAgent,
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPT_LEN,
  pickRecorderMime,
  pickVoice,
  speechLang,
  speechText,
  splitForSpeech,
  transcribe,
  voiceErrorKey,
  VoiceError,
} from "@/lib/voice";

describe("формат записи", () => {
  it("берёт первый поддерживаемый формат (webm — по умолчанию)", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeUndefined();
  });
  it("на iPhone сначала audio/mp4", () => {
    expect(pickRecorderMime(() => true, true)).toBe("audio/mp4");
  });
  it("исключение isTypeSupported не ломает выбор", () => {
    expect(
      pickRecorderMime((m) => {
        if (m.startsWith("audio/webm")) throw new Error("boom");
        return m === "audio/mp4";
      }),
    ).toBe("audio/mp4");
  });
  it("определяет iPhone и iPad (в том числе iPadOS под видом Mac)", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
  it("тип без параметров и расширение файла", () => {
    expect(baseAudioType("Audio/WebM;codecs=opus")).toBe("audio/webm");
    expect(audioExt("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExt("audio/mp4")).toBe("mp4");
    expect(audioExt("audio/x-wav")).toBe("wav");
    expect(audioExt("video/webm")).toBeUndefined();
    expect(audioExt("text/plain")).toBeUndefined();
  });
  it("таймер записи", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(7.9)).toBe("0:07");
    expect(formatTimer(60)).toBe("1:00");
    expect(formatTimer(-3)).toBe("0:00");
  });
});

describe("ошибки сервера → ключи словаря", () => {
  it("маппинг статусов", () => {
    expect(voiceErrorKey(429)).toBe("tutor.limit");
    expect(voiceErrorKey(413)).toBe("voice.err.tooLong");
    expect(voiceErrorKey(400, "too_large")).toBe("voice.err.tooLong");
    expect(voiceErrorKey(415)).toBe("voice.err.unsupported");
    expect(voiceErrorKey(502)).toBe("voice.err.failed");
    expect(voiceErrorKey(503, "ai_not_configured")).toBe("voice.err.failed");
  });
});

describe("transcribe (клиент)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("шлёт multipart с audio и lang, возвращает текст", async () => {
    fetchMock.mockResolvedValue(Response.json({ text: "  Что такое байт?  " }));
    const text = await transcribe(new Blob(["abc"], { type: "audio/webm;codecs=opus" }), "kk");
    expect(text).toBe("Что такое байт?");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai/transcribe");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("lang")).toBe("kk");
    const file = form.get("audio") as File;
    expect(file.name).toBe("voice.webm");
    expect(file.type).toBe("audio/webm");
  });

  it("ошибки сервера и сети — VoiceError с ключом", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "rate_limited" }, { status: 429 }));
    await expect(transcribe(new Blob(["a"], { type: "audio/mp4" }), "ru")).rejects.toMatchObject({ key: "tutor.limit" });
    fetchMock.mockResolvedValue(new Response("oops", { status: 502 }));
    await expect(transcribe(new Blob(["a"], { type: "audio/mp4" }), "ru")).rejects.toBeInstanceOf(VoiceError);
    fetchMock.mockRejectedValue(new TypeError("network"));
    await expect(transcribe(new Blob(["a"], { type: "audio/mp4" }), "ru")).rejects.toMatchObject({ key: "voice.err.failed" });
  });
});

describe("озвучка", () => {
  it("язык и выбор голоса", () => {
    expect(speechLang("ru")).toBe("ru-RU");
    expect(speechLang("kk")).toBe("kk-KZ");
    const voices = [
      { lang: "en-US", name: "en" },
      { lang: "ru-UA", name: "ru-ua", localService: true },
      { lang: "ru-RU", name: "ru", localService: false },
      { lang: "kk-KZ", name: "kk" },
    ];
    expect(pickVoice(voices, "ru")?.name).toBe("ru");
    expect(pickVoice(voices, "kk")?.name).toBe("kk");
    expect(pickVoice(voices.filter((v) => v.lang !== "kk-KZ"), "kk")).toBeNull();
    expect(pickVoice([], "ru")).toBeNull();
    expect(pickVoice([{ lang: "kk_KZ", name: "android" }], "kk")?.name).toBe("android");
    expect(pickVoice([{ lang: "ru", name: "short", localService: true }], "ru")?.name).toBe("short");
  });

  it("markdown → простой текст", () => {
    const md = "## Заголовок\n\n**Байт** — это *8 бит*.\n\n- первый пункт\n- второй `пункт`\n\n```python\nprint(1)\n```\n\nСмотри [статью](https://example.com) ![схема](x.png)";
    const out = speechText(md);
    expect(out).toBe("Заголовок. Байт — это 8 бит. первый пункт. второй пункт. Смотри статью");
    expect(out).not.toMatch(/[*#`\[\]]|print|http/);
  });

  it("математика не портится", () => {
    expect(speechText("2*3 = 6 и x_1 + x_2")).toBe("2*3 = 6 и x_1 + x_2");
  });

  it("таблицы читаются через запятую", () => {
    const out = speechText("| Единица | Бит |\n|---|---|\n| Байт | 8 |");
    expect(out).not.toContain("|");
    expect(out).not.toContain("---");
    expect(out).toContain("Байт");
  });

  it("кусочки для озвучки: по предложениям, не длиннее предела", () => {
    const s = "Первое предложение. Второе предложение! Третье?";
    expect(splitForSpeech(s, 200)).toEqual([s]);
    expect(splitForSpeech(s, 25)).toEqual(["Первое предложение.", "Второе предложение!", "Третье?"]);
    const long = `${"слово ".repeat(100)}конец.`;
    const parts = splitForSpeech(long, 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(" ")).toBe(long.trim());
    expect(splitForSpeech("я".repeat(130), 50).every((p) => p.length <= 50)).toBe(true);
    expect(splitForSpeech("", 50)).toEqual([]);
  });
});

describe("пределы", () => {
  it("общие константы", () => {
    expect(MAX_AUDIO_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_TRANSCRIPT_LEN).toBe(2000);
  });
});

describe("speechText: сравнения", () => {
  it("сохраняет > и >=", () => {
    expect(speechText("Если `x > 5`")).toContain(">");
    expect(speechText("a >= b")).toContain(">=");
  });
});
