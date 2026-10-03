import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// OpenAI не вызывается: клиент подменён, проверяем порядок защит и проверку входа.
const create = vi.fn();
const state = { client: true };
vi.mock("@/server/openai", () => ({
  MODELS: { stt: "test-stt" },
  getOpenAI: () => (state.client ? { audio: { transcriptions: { create } } } : null),
  jsonError: (status: number, code: string) => Response.json({ error: code }, { status }),
}));

const { POST } = await import("@/app/api/ai/transcribe/route");

let n = 0;
const nextIp = () => `10.0.0.${++n}`;

function req(
  parts: { audio?: Blob | string | null; lang?: string },
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  if (parts.audio !== null && parts.audio !== undefined) {
    if (typeof parts.audio === "string") form.append("audio", parts.audio);
    else form.append("audio", parts.audio, "voice.webm");
  }
  if (parts.lang) form.append("lang", parts.lang);
  return new Request("http://localhost/api/ai/transcribe", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": nextIp(), host: "localhost", ...headers },
  });
}

const audio = (type = "audio/webm;codecs=opus", size = 2000) => new Blob([new Uint8Array(size)], { type });
const code = async (r: Response) => (await r.json()).error;

describe("POST /api/ai/transcribe — вход", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ text: "  Привет, Бит  " });
    state.client = true;
  });

  it("чужой Origin — 403, без вызова ИИ", async () => {
    const res = await POST(req({ audio: audio(), lang: "ru" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("ИИ не настроен — 503", async () => {
    state.client = false;
    const res = await POST(req({ audio: audio() }));
    expect(res.status).toBe(503);
    expect(await code(res)).toBe("ai_not_configured");
  });

  it("лимит: 21-й запрос за 10 минут с одного IP — 429", async () => {
    const ip = "10.99.99.99";
    for (let i = 0; i < 20; i++) {
      const r = await POST(req({ audio: audio("audio/webm", 10) }, { "x-forwarded-for": ip }));
      expect(r.status).toBe(200);
    }
    const res = await POST(req({ audio: audio() }, { "x-forwarded-for": ip }));
    expect(res.status).toBe(429);
  });

  it("не multipart — 400 bad_form", async () => {
    const res = await POST(
      new Request("http://localhost/api/ai/transcribe", {
        method: "POST",
        body: "not a form",
        headers: { "content-type": "text/plain", "x-forwarded-for": nextIp() },
      }),
    );
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("bad_form");
  });

  it("нет файла, строка вместо файла или пустой файл — 400 no_audio", async () => {
    for (const a of [null, "строка", new Blob([], { type: "audio/webm" })]) {
      const res = await POST(req({ audio: a }));
      expect(res.status).toBe(400);
      expect(await code(res)).toBe("no_audio");
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("больше 2 МБ — 413", async () => {
    const res = await POST(req({ audio: audio("audio/webm", MAX + 1) }));
    expect(res.status).toBe(413);
    expect(await code(res)).toBe("too_large");
    expect(create).not.toHaveBeenCalled();
  });

  it("заявленный Content-Length заведомо больше предела — 413 без чтения тела", async () => {
    const res = await POST(req({ audio: audio() }, { "content-length": String(MAX * 3) }));
    expect(res.status).toBe(413);
  });

  it("не аудио — 415", async () => {
    for (const type of ["video/mp4", "text/plain", "application/octet-stream", ""]) {
      const res = await POST(req({ audio: audio(type, 100) }));
      expect(res.status).toBe(415);
      expect(await code(res)).toBe("bad_type");
    }
    expect(create).not.toHaveBeenCalled();
  });
});

const MAX = 2 * 1024 * 1024;

describe("POST /api/ai/transcribe — успех и сбои", () => {
  beforeEach(() => {
    create.mockReset();
    state.client = true;
  });

  it("отдаёт { text } и передаёт модель, язык и файл", async () => {
    create.mockResolvedValue({ text: "  Привет, Бит  " });
    const res = await POST(req({ audio: audio("audio/mp4", 1500), lang: "kk" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Привет, Бит" });
    const args = create.mock.calls[0][0];
    expect(args.model).toBe("test-stt");
    expect(args.language).toBe("kk");
    expect(args.file.name).toBe("voice.mp4");
  });

  it("неизвестный язык — ru; webm с параметрами принимается", async () => {
    create.mockResolvedValue({ text: "ok" });
    const res = await POST(req({ audio: audio("audio/webm;codecs=opus"), lang: "xx" }));
    expect(res.status).toBe(200);
    expect(create.mock.calls[0][0].language).toBe("ru");
    expect(create.mock.calls[0][0].file.name).toBe("voice.webm");
  });

  it("текст обрезается до 2000 символов", async () => {
    create.mockResolvedValue({ text: "а".repeat(5000) });
    const res = await POST(req({ audio: audio() }));
    expect((await res.json()).text).toHaveLength(2000);
  });

  it("сбой ИИ — 502 stt_failed", async () => {
    create.mockRejectedValue(new Error("upstream"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ audio: audio() }));
    expect(res.status).toBe(502);
    expect(await code(res)).toBe("stt_failed");
  });
});
