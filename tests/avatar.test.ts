import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "@/components/app/Avatar";
import { AVATAR_PRESETS, findPreset } from "@/components/app/avatars/presets";
import {
  AVATAR_COLORS,
  AVATAR_PRESET_IDS,
  PHOTO_MAX_CHARS,
  PHOTO_PREFIX,
  avatarInitial,
  centerSquare,
  dataUrlBytes,
  defaultAvatar,
  isPresetId,
  nextQuality,
  sanitizeAvatar,
} from "@/lib/avatar";

const DEFAULT = { kind: "initial", color: "primary" };
const photo = (n: number) => PHOTO_PREFIX + "A".repeat(n);

describe("defaultAvatar", () => {
  it("буква на primary", () => expect(defaultAvatar()).toEqual(DEFAULT));
});

describe("sanitizeAvatar", () => {
  it("мусор → по умолчанию", () => {
    for (const raw of [null, undefined, 5, "x", [], {}, { kind: "?" }, { kind: 1 }]) expect(sanitizeAvatar(raw)).toEqual(DEFAULT);
  });

  it("initial: известный цвет сохраняется, неизвестный → по умолчанию", () => {
    for (const color of AVATAR_COLORS) expect(sanitizeAvatar({ kind: "initial", color })).toEqual({ kind: "initial", color });
    expect(sanitizeAvatar({ kind: "initial", color: "pink" })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "initial" })).toEqual(DEFAULT);
  });

  it("preset: известный id сохраняется, неизвестный → по умолчанию", () => {
    expect(sanitizeAvatar({ kind: "preset", id: "bit-crown" })).toEqual({ kind: "preset", id: "bit-crown" });
    expect(sanitizeAvatar({ kind: "preset", id: "nope" })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "preset", id: 3 })).toEqual(DEFAULT);
  });

  it("photo: только JPEG base64 и не длиннее лимита", () => {
    const ok = photo(1000);
    expect(sanitizeAvatar({ kind: "photo", data: ok })).toEqual({ kind: "photo", data: ok });
    expect(sanitizeAvatar({ kind: "photo", data: PHOTO_PREFIX + "A".repeat(PHOTO_MAX_CHARS - PHOTO_PREFIX.length) })).toMatchObject({ kind: "photo" });
    expect(sanitizeAvatar({ kind: "photo", data: photo(PHOTO_MAX_CHARS) })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: "data:image/png;base64,AAAA" })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: "data:image/svg+xml;base64,AAAA" })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: "https://evil.example/a.jpg" })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: PHOTO_PREFIX + '"><script>' })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: PHOTO_PREFIX })).toEqual(DEFAULT);
    expect(sanitizeAvatar({ kind: "photo", data: 42 })).toEqual(DEFAULT);
  });

  it("лишние поля отбрасываются", () => {
    expect(sanitizeAvatar({ kind: "preset", id: "rocket", extra: "x" })).toEqual({ kind: "preset", id: "rocket" });
  });
});

describe("геометрия и качество фото", () => {
  it("centerSquare режет по центру", () => {
    expect(centerSquare(400, 300)).toEqual({ sx: 50, sy: 0, side: 300 });
    expect(centerSquare(300, 400)).toEqual({ sx: 0, sy: 50, side: 300 });
    expect(centerSquare(160, 160)).toEqual({ sx: 0, sy: 0, side: 160 });
  });

  it("dataUrlBytes считает байты base64", () => {
    expect(dataUrlBytes("data:image/jpeg;base64,QUJD")).toBe(3);
    expect(dataUrlBytes("data:image/jpeg;base64,QUI=")).toBe(2);
    expect(dataUrlBytes("data:image/jpeg;base64,QQ==")).toBe(1);
  });

  it("nextQuality снижает шаг 0.1 и останавливается на 0.3", () => {
    expect(nextQuality(0.8)).toBe(0.7);
    expect(nextQuality(0.4)).toBe(0.3);
    expect(nextQuality(0.3)).toBeNull();
  });
});

describe("avatarInitial", () => {
  it("первая буква заглавная, пусто → ?", () => {
    expect(avatarInitial("  айдана")).toBe("А");
    expect(avatarInitial("әлия")).toBe("Ә");
    expect(avatarInitial("ілияс")).toBe("І");
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial("   ")).toBe("?");
    expect(avatarInitial(undefined)).toBe("?");
  });

  it("суррогатная пара не режется пополам", () => {
    const s = avatarInitial("\u{1D400}bc");
    expect(s).toBe("\u{1D400}");
    expect(s.length).toBe(2);
  });
});

describe("набор рисованных аватаров", () => {
  it("12 аватаров, id совпадают со списком в lib/avatar.ts и уникальны", () => {
    const ids = AVATAR_PRESETS.map((p) => p.id);
    expect(ids).toEqual([...AVATAR_PRESET_IDS]);
    expect(new Set(ids).size).toBe(12);
    for (const id of ids) expect(isPresetId(id)).toBe(true);
    expect(isPresetId("nope")).toBe(false);
    expect(isPresetId(5)).toBe(false);
  });

  it("у каждого есть подпись ru и kk, рисунок без эмодзи и внешних картинок", () => {
    for (const p of AVATAR_PRESETS) {
      expect(p.label.ru.trim()).not.toBe("");
      expect(p.label.kk.trim()).not.toBe("");
      const svg = renderToStaticMarkup(createElement(p.Component, { size: 48 }));
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/<image|href=|\p{Extended_Pictographic}/u);
    }
    expect(findPreset("rocket")?.id).toBe("rocket");
    expect(findPreset("nope")).toBeUndefined();
  });
});

describe("<Avatar>", () => {
  const html = (config: Parameters<typeof Avatar>[0]["config"], name = "Айдана") => renderToStaticMarkup(createElement(Avatar, { config, name, size: 40 }));

  it("буква на цвете", () => {
    const out = html({ kind: "initial", color: "ai" });
    expect(out).toContain("bg-ai-soft");
    expect(out).toContain(">А<");
  });

  it("preset рисуется SVG", () => {
    expect(html({ kind: "preset", id: "bit-crown" })).toContain("<svg");
  });

  it("неизвестный preset, чужое фото и старое сохранение без аватара → буква на primary", () => {
    for (const config of [
      { kind: "preset" as const, id: "nope" },
      { kind: "photo" as const, data: "https://evil.example/a.jpg" },
      undefined,
      null,
    ]) {
      const out = html(config);
      expect(out).toContain("bg-primary-soft");
      expect(out).not.toContain("<img");
    }
  });

  it("фото — img с object-cover", () => {
    const data = photo(100);
    const out = html({ kind: "photo", data });
    expect(out).toContain("<img");
    expect(out).toContain("object-cover");
  });
});
