import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, NoteImageError, checkImageDataUrl, deleteImages, getImage, putImage } from "@/lib/note-images";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("проверка dataURL картинки", () => {
  it("принимает png и jpeg", () => {
    expect(checkImageDataUrl(PNG)).toBe("ok");
    expect(checkImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe("ok");
  });

  it("отклоняет другие форматы и мусор", () => {
    expect(checkImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe("format");
    expect(checkImageDataUrl("data:image/gif;base64,R0lGODlh")).toBe("format");
    expect(checkImageDataUrl("data:text/html;base64,PGI+")).toBe("format");
    expect(checkImageDataUrl("https://example.com/a.png")).toBe("format");
    expect(checkImageDataUrl("data:image/png;base64,не base64!")).toBe("format");
    expect(checkImageDataUrl(42)).toBe("format");
    expect(checkImageDataUrl(undefined)).toBe("format");
  });

  it("ограничивает размер 3 МБ", () => {
    const big = `data:image/png;base64,${"A".repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100)}`;
    expect(checkImageDataUrl(big)).toBe("size");
    const ok = `data:image/png;base64,${"A".repeat(4 * 1000)}`;
    expect(checkImageDataUrl(ok)).toBe("ok");
  });
});

describe("хранилище (запасной режим в памяти — в тестах IndexedDB нет)", () => {
  it("put → get → delete", async () => {
    const id = await putImage(PNG);
    expect(id).toMatch(/^i[a-z0-9]+$/);
    expect(await getImage(id)).toBe(PNG);
    await deleteImages([id]);
    expect(await getImage(id)).toBeUndefined();
  });

  it("не принимает плохие картинки", async () => {
    await expect(putImage("data:image/gif;base64,AAAA")).rejects.toBeInstanceOf(NoteImageError);
    await expect(putImage("data:image/png;base64," + "A".repeat(5_000_000))).rejects.toMatchObject({ reason: "size" });
  });

  it("неизвестный id — undefined; удаление нескольких не падает", async () => {
    expect(await getImage("nope1234")).toBeUndefined();
    const a = await putImage(PNG);
    const b = await putImage(PNG);
    await deleteImages([a, b, "unknown1"]);
    expect(await getImage(a)).toBeUndefined();
    await deleteImages([]);
  });
});
