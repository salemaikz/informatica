import { describe, expect, it, vi } from "vitest";
import { absoluteUrl, canShareFile, canShareNative, copyText, messageOf, shareNative, telegramUrl, whatsappUrl } from "@/lib/share";

const URL_ = "https://informatica.example/r/s1-12-30-k";

describe("ссылки мессенджеров", () => {
  it("WhatsApp — текст и ссылка одним сообщением", () => {
    expect(whatsappUrl("12 күн қатарынан!", URL_)).toBe(`https://wa.me/?text=${encodeURIComponent(`12 күн қатарынан!\n${URL_}`)}`);
    expect(whatsappUrl("  ", URL_)).toBe(`https://wa.me/?text=${encodeURIComponent(URL_)}`);
  });
  it("Telegram — ссылка и текст отдельно", () => {
    expect(telegramUrl("Сможешь больше?", URL_)).toBe(`https://t.me/share/url?url=${encodeURIComponent(URL_)}&text=${encodeURIComponent("Сможешь больше?")}`);
    expect(telegramUrl("", URL_)).toBe(`https://t.me/share/url?url=${encodeURIComponent(URL_)}`);
  });
  it("messageOf и absoluteUrl", () => {
    expect(messageOf("a", "b")).toBe("a\nb");
    expect(absoluteUrl("/r/x", "https://s.kz")).toBe("https://s.kz/r/x");
    expect(absoluteUrl("r/x", "https://s.kz")).toBe("https://s.kz/r/x");
  });
});

describe("системное меню и буфер", () => {
  const file = new File(["x"], "card.png", { type: "image/png" });

  it("нет navigator.share — нет меню", async () => {
    expect(canShareNative({} as never)).toBe(false);
    expect(await shareNative({ title: "t", text: "x", url: URL_ }, {} as never)).toBe("failed");
  });

  it("с файлом: файл + текст со ссылкой, если меню примет файл", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = { share, canShare: () => true } as never;
    expect(canShareFile(file, nav)).toBe(true);
    expect(await shareNative({ title: "t", text: "x", url: URL_, file }, nav)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "t", text: `x\n${URL_}` });
  });

  it("файл не принимают — только ссылка", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await shareNative({ title: "t", text: "x", url: URL_, file }, { share, canShare: () => false } as never);
    expect(share).toHaveBeenCalledWith({ title: "t", text: "x", url: URL_ });
  });

  it("закрыли меню — cancelled, другая ошибка — failed", async () => {
    const abort = { share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")) } as never;
    expect(await shareNative({ title: "t", text: "x", url: URL_ }, abort)).toBe("cancelled");
    const deny = { share: vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")) } as never;
    expect(await shareNative({ title: "t", text: "x", url: URL_ }, deny)).toBe("failed");
  });

  it("буфер: успех, отказ, нет API", async () => {
    expect(await copyText("a", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } } as never)).toBe(true);
    expect(await copyText("a", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } } as never)).toBe(false);
    expect(await copyText("a", {} as never)).toBe(false);
  });
});
