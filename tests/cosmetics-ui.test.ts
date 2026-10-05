import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COSMETICS, cosmeticsOfSlot } from "@/lib/cosmetics";
import { AvatarFrame, FRAME_MIN_SIZE, frameOuterSize } from "@/components/cosmetics/AvatarFrame";
import { BannerArt } from "@/components/cosmetics/banner-art";
import { FrameArt } from "@/components/cosmetics/frame-art";
import { ProfileBanner } from "@/components/cosmetics/ProfileBanner";
import { TitleTag } from "@/components/cosmetics/TitleTag";
import { cosmeticName, cosmeticWhat } from "@/components/cosmetics/names";
import { translate } from "@/i18n/useT";
import {
  arcPath,
  bitString,
  gridPath,
  pixelRing,
  polar,
  rayPath,
  round,
  scatterStars,
  starPath,
  wavePath,
  wavyRingPath,
} from "@/components/cosmetics/geometry";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const svg = (child: Parameters<typeof renderToStaticMarkup>[0]) => html(createElement("svg", null, child));
const child = createElement("span", { id: "ava" }, "A");
const af = (props: Omit<ComponentProps<typeof AvatarFrame>, "children">) => html(createElement(AvatarFrame, props as ComponentProps<typeof AvatarFrame>, child));

describe("рисунки: каждое украшение рисуется", () => {
  it("каждая рамка даёт содержимое SVG; чужие id и нерисуемые — ничего", () => {
    for (const f of cosmeticsOfSlot("frame")) {
      const out = svg(createElement(FrameArt, { id: f.id, animate: true }));
      expect(out.length, f.id).toBeGreaterThan(40);
    }
    expect(html(createElement(FrameArt, { id: "banner-grid" }))).toBe("");
    expect(html(createElement(FrameArt, { id: "nope" as never }))).toBe("");
  });

  it("каждый фон даёт содержимое SVG; рамка в слоте фона — ничего", () => {
    for (const b of cosmeticsOfSlot("banner")) {
      const out = svg(createElement(BannerArt, { id: b.id, animate: true, uid: "t" }));
      expect(out.length, b.id).toBeGreaterThan(60);
    }
    expect(html(createElement(BannerArt, { id: "frame-dots" }))).toBe("");
  });

  it("цвет редкости берётся из токена: рамка редкой — var(--rarity-rare), эпической — var(--rarity-epic)", () => {
    expect(svg(createElement(FrameArt, { id: "frame-circuit" }))).toContain("var(--rarity-rare)");
    expect(svg(createElement(FrameArt, { id: "frame-neon" }))).toContain("var(--rarity-epic)");
    expect(svg(createElement(FrameArt, { id: "frame-crown" }))).toContain("var(--rarity-legendary)");
    // радуга — все цвета редкости
    const rainbow = svg(createElement(FrameArt, { id: "frame-rainbow" }));
    for (const r of ["common", "rare", "epic", "legendary"]) expect(rainbow).toContain(`var(--rarity-${r})`);
  });

  it("анимированные части получают класс только при animate", () => {
    const on = svg(createElement(FrameArt, { id: "frame-orbit", animate: true }));
    const off = svg(createElement(FrameArt, { id: "frame-orbit", animate: false }));
    expect(on).toContain("class=");
    expect(off).not.toContain("class=");
  });

  it("id градиентов не повторяются между разными рамками на странице (uid)", () => {
    const a = svg(createElement(FrameArt, { id: "frame-galaxy", uid: "a1" }));
    const b = svg(createElement(FrameArt, { id: "frame-galaxy", uid: "b2" }));
    expect(a).toContain('id="a1-galaxy"');
    expect(b).toContain('id="b2-galaxy"');
  });

  it("в исходниках рисунков нет «сырых» hex-цветов — только токены темы", () => {
    const dir = join(__dirname, "../src/components/cosmetics");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".css"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src.match(/#[0-9a-fA-F]{3,8}\b(?!\))/g) ?? [], f).toEqual([]);
      expect(src.match(/\brgba?\(/g) ?? [], f).toEqual([]);
    }
  });
});

describe("AvatarFrame", () => {
  it("нет рамки — аватар как есть (раскладка не меняется); с reserve — место под рамку", () => {
    expect(af({ frame: null, size: 76 })).toBe(html(child));
    expect(af({ frame: undefined, size: 76 })).toBe(html(child));
    const reserved = af({ frame: null, size: 76, reserve: true });
    expect(reserved).toContain(`width:${frameOuterSize(76)}px`);
    expect(reserved).toContain('id="ava"');
    expect(reserved).not.toContain("<svg");
  });

  it("украшение не из слота «рамка» рамкой не считается", () => {
    expect(af({ frame: "banner-grid", size: 76 })).toBe(html(child));
    expect(af({ frame: "title-newbie", size: 76 })).toBe(html(child));
  });

  it("аватар ≥ 40 px: рисунок рамки вокруг, аватар не обрезан и стоит в центре", () => {
    const out = af({ frame: "frame-neon", size: 76 });
    expect(out).toContain("<svg");
    expect(out).toContain('data-frame="frame-neon"');
    expect(out).toContain('id="ava"');
    // внешний блок на 25% больше аватара: 76 → 95, отступ (95 − 76) / 2
    expect(frameOuterSize(76)).toBe(95);
    expect(out).toContain("width:95px");
    expect(out).toContain("left:9.5px");
    expect(out).toContain('aria-hidden="true"');
  });

  it("аватар < 40 px: только тонкое кольцо цвета редкости, без рисунка; full — полная рамка", () => {
    expect(FRAME_MIN_SIZE).toBe(40);
    const thin = af({ frame: "frame-circuit", size: 28 });
    expect(thin).not.toContain("<svg");
    expect(thin).toContain("var(--rarity-rare)");
    expect(thin).toContain('id="ava"');
    const border = af({ frame: "frame-crown", size: 39 });
    expect(border).not.toContain("<svg");
    expect(border).toContain("var(--rarity-legendary)");
    const full = af({ frame: "frame-crown", size: 28, full: true });
    expect(full).toContain("<svg");
    const at40 = af({ frame: "frame-dots", size: 40 });
    expect(at40).toContain("<svg");
  });
});

describe("ProfileBanner и TitleTag", () => {
  it("фон: рисунок на всю полосу; без фона — запасной рисунок", () => {
    const withBanner = html(createElement(ProfileBanner, { banner: "banner-aurora", className: "h-24" }));
    expect(withBanner).toContain('data-banner="banner-aurora"');
    expect(withBanner).toContain("<svg");
    expect(withBanner).toContain('preserveAspectRatio="xMidYMid slice"');
    const none = html(createElement(ProfileBanner, { banner: null, className: "h-24" }));
    expect(none).toContain("<svg");
    expect(none).not.toContain("data-banner");
    // не из слота «фон» — как будто фона нет
    expect(html(createElement(ProfileBanner, { banner: "frame-neon" }))).not.toContain("data-banner");
  });

  it("титул: плашка с названием; не титул и пусто — ничего", () => {
    const tag = html(createElement(TitleTag, { title: "title-bug-hunter" }));
    expect(tag).toContain("Охотник за багами");
    expect(tag).toContain('data-title="title-bug-hunter"');
    expect(html(createElement(TitleTag, { title: null }))).toBe("");
    expect(html(createElement(TitleTag, { title: "frame-dots" }))).toBe("");
    // у каждого титула есть иконка и название
    for (const t of cosmeticsOfSlot("title")) expect(html(createElement(TitleTag, { title: t.id })), t.id).toContain("<svg");
  });

  it("цвет титула — по редкости (мягкий фон и цвет текста)", () => {
    expect(html(createElement(TitleTag, { title: "title-newbie" }))).toContain("text-rarity-common");
    expect(html(createElement(TitleTag, { title: "title-algo-master" }))).toContain("bg-rarity-epic-soft");
    expect(html(createElement(TitleTag, { title: "title-legend" }))).toContain("text-rarity-legendary");
  });
});

describe("названия украшений", () => {
  it("cosmeticName / cosmeticWhat: ru и kk, со слотом", () => {
    const ru = (key: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("ru", key, p);
    const kk = (key: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("kk", key, p);
    expect(cosmeticName("frame-neon", ru)).toBe("Неон");
    expect(cosmeticWhat("frame-neon", ru)).toBe("Рамка «Неон»");
    expect(cosmeticWhat("banner-night", ru)).toBe("Фон «Ночное небо»");
    expect(cosmeticWhat("title-legend", ru)).toBe("Титул «Легенда информатики»");
    expect(cosmeticWhat("title-ent-storm", kk)).toContain("ҰБТ");
    expect(cosmeticWhat("frame-neon", kk)).toContain("Неон");
    // «ЕНТ» в казахских названиях — только ҰБТ
    for (const c of COSMETICS) expect(cosmeticName(c.id, kk)).not.toMatch(/ЕНТ/);
  });
});

describe("геометрия рисунков", () => {
  it("polar: 0° — вверху, 90° — справа, по часовой", () => {
    expect(polar(60, 60, 50, 0)).toEqual({ x: 60, y: 10 });
    expect(polar(60, 60, 50, 90)).toEqual({ x: 110, y: 60 });
    expect(polar(60, 60, 50, 180)).toEqual({ x: 60, y: 110 });
    expect(polar(60, 60, 50, 270)).toEqual({ x: 10, y: 60 });
  });

  it("arcPath: дуга до 180° — малая, больше — большая; полный круг не вырождается", () => {
    expect(arcPath(60, 60, 50, 0, 90)).toBe("M60 10A50 50 0 0 1 110 60");
    expect(arcPath(60, 60, 50, 0, 270)).toContain("A50 50 0 1 1");
    const full = arcPath(60, 60, 50, 0, 360);
    expect(full).toMatch(/^M60 10A50 50 0 1 1 /);
    // конечная точка полного круга не совпадает с начальной (иначе SVG не нарисует дугу)
    expect(full.endsWith("60 10")).toBe(false);
  });

  it("wavyRingPath: замкнутый путь, точки в пределах r ± amp", () => {
    const d = wavyRingPath(60, 60, 54, 2.6, 14, 0, 96);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const pts = d
      .slice(1, -1)
      .split("L")
      .map((p) => p.split(" ").map(Number));
    expect(pts).toHaveLength(96);
    for (const [x, y] of pts) {
      const r = Math.hypot(x - 60, y - 60);
      expect(r).toBeGreaterThanOrEqual(54 - 2.6 - 0.1);
      expect(r).toBeLessThanOrEqual(54 + 2.6 + 0.1);
    }
  });

  it("pixelRing: клетки кольца — внутри заданных радиусов, сетка кратна шагу, оттенки чередуются", () => {
    const cells = pixelRing(6, 120, 48.4, 59.2);
    expect(cells.length).toBeGreaterThan(60);
    expect(cells.length).toBeLessThan(220);
    for (const c of cells) {
      expect(c.x % 6).toBe(0);
      expect(c.y % 6).toBe(0);
      const d = Math.hypot(c.x + 3 - 60, c.y + 3 - 60);
      expect(d).toBeGreaterThanOrEqual(48.4);
      expect(d).toBeLessThanOrEqual(59.2);
    }
    expect(cells.some((c) => c.alt)).toBe(true);
    expect(cells.some((c) => !c.alt)).toBe(true);
    // центр кольца пуст — аватар не закрыт
    expect(cells.some((c) => Math.hypot(c.x + 3 - 60, c.y + 3 - 60) < 40)).toBe(false);
  });

  it("детерминированность: тот же seed — те же биты и звёзды (сервер и клиент рисуют одно и то же)", () => {
    expect(bitString(24, 7)).toBe(bitString(24, 7));
    expect(bitString(24, 7)).toMatch(/^[01]{24}$/);
    expect(bitString(24, 7)).not.toBe(bitString(24, 8));
    expect(scatterStars(10, 3, { w: 320, h: 96 })).toEqual(scatterStars(10, 3, { w: 320, h: 96 }));
  });

  it("scatterStars: на кольце — между радиусами, в прямоугольнике — внутри него; параметры в диапазоне", () => {
    for (const s of scatterStars(40, 5, { cx: 60, cy: 60, rIn: 50.5, rOut: 57.5 })) {
      const d = Math.hypot(s.x - 60, s.y - 60);
      expect(d).toBeGreaterThanOrEqual(50.4);
      expect(d).toBeLessThanOrEqual(57.6);
      expect(s.o).toBeGreaterThanOrEqual(0.3);
      expect(s.o).toBeLessThanOrEqual(1);
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThanOrEqual(3);
    }
    for (const s of scatterStars(40, 5, { w: 320, h: 96 }, [0.6, 1.6])) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(320);
      expect(s.y).toBeLessThanOrEqual(96);
      expect(s.r).toBeGreaterThanOrEqual(0.6);
      expect(s.r).toBeLessThanOrEqual(1.6);
    }
  });

  it("мелочи: round, starPath, gridPath, wavePath, rayPath", () => {
    expect(round(1.23456)).toBe(1.23);
    expect(starPath(10, 10, 4).startsWith("M10 6L")).toBe(true);
    expect(starPath(10, 10, 4).endsWith("Z")).toBe(true);
    expect(gridPath(40, 40, 20)).toBe("M20 0V40M0 20H40");
    const wave = wavePath(320, 120, 50, 6, 100, 0, 8, 24);
    expect(wave.startsWith("M-24 ")).toBe(true);
    expect(wave).toContain("L344 120L-24 120Z");
    expect(rayPath(160, 132, 100, 0, 10)).toMatch(/^M160 132L160 32L/);
  });
});
