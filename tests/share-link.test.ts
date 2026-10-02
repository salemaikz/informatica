import { describe, expect, it } from "vitest";
import { buildBackupData, buildLink, dataFromHash, linkFit, notesWithImages, packData, previewBackup, unpackData, MAX_LINK_LENGTH } from "@/lib/share-link";
import { cleanBackup } from "@/components/goals/backup";
import { useApp } from "@/lib/store";

describe("packData / unpackData", () => {
  it("круг: объект → строка → объект", async () => {
    const obj = { name: "Айдана", xp: 1234, list: [1, 2, 3], kk: "Қазақша ӘІҢҒҮҰҚӨҺ", emoji: "😀" };
    const s = await packData(obj);
    expect(s[0]).toBe("z");
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await unpackData(s)).toEqual(obj);
  });

  it("сжатие уменьшает повторяющиеся данные", async () => {
    const obj = { a: "информатика ".repeat(500) };
    expect((await packData(obj)).length).toBeLessThan(JSON.stringify(obj).length / 5);
  });

  it("версия без сжатия читается", async () => {
    const b64 = Buffer.from(JSON.stringify({ x: 1 })).toString("base64url");
    expect(await unpackData("r" + b64)).toEqual({ x: 1 });
  });

  it("мусор → null", async () => {
    expect(await unpackData("")).toBeNull();
    expect(await unpackData("z")).toBeNull();
    expect(await unpackData("q123")).toBeNull();
    expect(await unpackData("zAAAA")).toBeNull();
    expect(await unpackData("r!!!")).toBeNull();
    expect(await unpackData("rbm90LWpzb24")).toBeNull();
  });

  it("«бомба» распаковки отклоняется", async () => {
    const huge = await packData({ a: "0".repeat(6 * 1024 * 1024) }).catch(() => null);
    // упаковать не дадим (лимит), а если упаковалось — распаковать не должны
    if (huge) expect(await unpackData(huge)).toBeNull();
    else expect(huge).toBeNull();
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
  it("buildLink и linkFit", () => {
    expect(buildLink("https://a.kz", "/restore", "zAB")).toBe("https://a.kz/restore#d=zAB");
    expect(linkFit("x".repeat(100))).toBe("ok");
    expect(linkFit("x".repeat(3500))).toBe("noqr");
    expect(linkFit("x".repeat(MAX_LINK_LENGTH + 1))).toBe("toobig");
  });
});

describe("копия для ссылки", () => {
  const base = useApp.getState();
  const state = {
    ...base,
    xp: 321,
    profile: { ...base.profile, name: "Тест", avatar: { kind: "photo" as const, data: "data:image/jpeg;base64,AAAA" } },
    chat: [{ id: "1", role: "user" as const, content: "привет", at: 1 }],
    notebook: {
      ...base.notebook,
      notes: [{ id: "n1", folderId: "sys-general", title: "T", body: "до ![](note-img:abc) после", source: "own" as const, images: ["abc"], createdAt: 1, updatedAt: 1 }],
    },
  };

  it("без картинок, фото-аватара и чата; проходит cleanBackup", async () => {
    const data = buildBackupData(state);
    expect(JSON.stringify(data)).not.toContain("note-img");
    expect(JSON.stringify(data)).not.toContain("data:image");
    expect(data.chat).toBeUndefined();
    expect(data.version).toBe(2);
    const back = cleanBackup(await unpackData(await packData(data)));
    expect(back).not.toBeNull();
    expect(previewBackup(back!)).toMatchObject({ name: "Тест", xp: 321, notes: 1 });
  });

  it("notesWithImages", () => {
    expect(notesWithImages(state)).toBe(1);
    expect(notesWithImages(base)).toBe(0);
  });
});
