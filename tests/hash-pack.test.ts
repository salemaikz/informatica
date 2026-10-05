import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_LINK_LENGTH, MAX_UNPACKED_BYTES, bytesToBase64Url, dataFromHash, linkFits, packData, reportLink, unpackData } from "@/lib/hash-pack";

afterEach(() => vi.unstubAllGlobals());

/** Сырой deflate без нашей упаковки: чтобы собрать «бомбу», которую packData сам не выпустит. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("packData / unpackData", () => {
  it("круг: объект → строка → объект (в том числе казахские буквы)", async () => {
    const obj = { name: "Айдана", xp: 1234, list: [1, 2, 3], kk: "Қазақша ӘІҢҒҮҰҚӨҺ" };
    const s = await packData(obj);
    expect(s[0]).toBe("z");
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await unpackData(s)).toEqual(obj);
  });

  it("сжатие уменьшает повторяющиеся данные", async () => {
    const obj = { a: "информатика ".repeat(500) };
    expect((await packData(obj)).length).toBeLessThan(JSON.stringify(obj).length / 5);
  });

  it("без CompressionStream: префикс «r», круг работает", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    vi.stubGlobal("DecompressionStream", undefined);
    const obj = { x: 1, y: "Қаз" };
    const s = await packData(obj);
    expect(s[0]).toBe("r");
    expect(await unpackData(s)).toEqual(obj);
    // сжатую ссылку без DecompressionStream не прочитать — null, а не исключение
    vi.unstubAllGlobals();
    const z = await packData(obj);
    vi.stubGlobal("DecompressionStream", undefined);
    expect(await unpackData(z)).toBeNull();
  });

  it("мусор → null", async () => {
    expect(await unpackData("")).toBeNull();
    expect(await unpackData("z")).toBeNull();
    expect(await unpackData("q123")).toBeNull();
    expect(await unpackData("zAAAA")).toBeNull();
    expect(await unpackData("r!!!")).toBeNull();
    expect(await unpackData("rbm90LWpzb24")).toBeNull(); // «not-json»
    expect(await unpackData(123 as unknown as string)).toBeNull();
  });

  it("«бомба» распаковки отклоняется", async () => {
    const raw = new TextEncoder().encode(JSON.stringify({ a: "0".repeat(MAX_UNPACKED_BYTES * 4) }));
    const bomb = "z" + bytesToBase64Url(await deflate(raw));
    expect(bomb.length).toBeLessThan(MAX_LINK_LENGTH); // сжалось в крошечную строку
    expect(await unpackData(bomb)).toBeNull();
  });

  it("слишком большой объект упаковать нельзя; слишком длинную строку не разбираем", async () => {
    await expect(packData({ a: "0".repeat(MAX_UNPACKED_BYTES + 1) })).rejects.toThrow();
    expect(await unpackData("r" + "A".repeat(MAX_LINK_LENGTH * 2))).toBeNull();
  });

  it("«r»-строка больше лимита распакованного отклоняется", async () => {
    const big = new Uint8Array(MAX_UNPACKED_BYTES + 1).fill(0x20);
    // длина больше MAX_PACKED_CHARS — отсекается ещё до разбора
    expect(await unpackData("r" + bytesToBase64Url(big))).toBeNull();
  });
});

describe("ссылка", () => {
  it("dataFromHash", () => {
    expect(dataFromHash("#d=zAbc_-1")).toBe("zAbc_-1");
    expect(dataFromHash("d=zAbc")).toBe("zAbc");
    expect(dataFromHash("#x=1&d=zAbc")).toBe("zAbc");
    expect(dataFromHash("")).toBeNull();
    expect(dataFromHash("#d=")).toBeNull();
  });

  it("reportLink и лимит длины", () => {
    const link = reportLink("https://example.kz", "zAbc");
    expect(link).toBe("https://example.kz/report#d=zAbc");
    expect(dataFromHash(new URL(link).hash)).toBe("zAbc");
    expect(linkFits(link)).toBe(true);
    expect(linkFits("x".repeat(MAX_LINK_LENGTH + 1))).toBe(false);
    expect(linkFits("x".repeat(MAX_LINK_LENGTH))).toBe(true);
  });
});
