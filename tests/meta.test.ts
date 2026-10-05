import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_IDS } from "@/content/legal";
import { metaDict } from "@/i18n/parts/meta";
import { APP_NAME, biText, DEFAULT_SITE_URL, legalTitle, ogAlt, siteDescription, siteTitle, siteUrl } from "@/lib/site-meta";

const root = join(__dirname, "..");
const EMOJI = /\p{Extended_Pictographic}/u;
const ENT_WORD = /(?<![А-ЯЁӘҒҚҢӨҰҮҺІ])ЕНТ(?![А-ЯЁӘҒҚҢӨҰҮҺІ])/;

describe("адрес сайта для превью", () => {
  it("по умолчанию — боевой адрес", () => {
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("   ")).toBe(DEFAULT_SITE_URL);
  });

  it("NEXT_PUBLIC_SITE_URL берётся без пути и слэша на конце", () => {
    expect(siteUrl("https://informatica.kz")).toBe("https://informatica.kz");
    expect(siteUrl("https://informatica.kz/")).toBe("https://informatica.kz");
    expect(siteUrl(" https://app.informatica.kz/start/ ")).toBe("https://app.informatica.kz");
    expect(siteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("не адрес и чужие схемы — адрес по умолчанию", () => {
    expect(siteUrl("informatica.kz")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
    expect(siteUrl("ftp://informatica.kz")).toBe(DEFAULT_SITE_URL);
  });
});

describe("тексты превью ссылки", () => {
  it("у каждого ключа meta.* есть ru и kk, нет эмодзи, в kk — ҰБТ, а не ЕНТ", () => {
    for (const [key, v] of Object.entries(metaDict)) {
      expect(key.startsWith("meta."), key).toBe(true);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
      expect(EMOJI.test(v.ru + v.kk), key).toBe(false);
      expect(ENT_WORD.test(v.kk), key).toBe(false);
    }
  });

  it("название и описание двуязычные и помещаются в превью", () => {
    const title = siteTitle();
    expect(title.startsWith(APP_NAME)).toBe(true);
    expect(title).toContain(metaDict["meta.title"].ru);
    expect(title).toContain(metaDict["meta.title"].kk);
    expect(title.length).toBeLessThanOrEqual(80);

    const desc = siteDescription();
    expect(desc).toContain(metaDict["meta.description"].ru);
    expect(desc).toContain(metaDict["meta.description"].kk);
    expect(desc.length).toBeLessThanOrEqual(200);

    expect(ogAlt()).toContain(metaDict["meta.og.alt"].kk);
  });

  it("ЕНТ по-русски и ҰБТ по-казахски названы в заголовке", () => {
    expect(metaDict["meta.title"].ru).toContain("ЕНТ");
    expect(metaDict["meta.title"].kk).toContain("ҰБТ");
  });

  it("заголовки правовых страниц — на двух языках в одной строке; страниц две (политика и условия)", () => {
    expect([...LEGAL_IDS].sort()).toEqual(["privacy", "terms"]);
    for (const id of LEGAL_IDS) {
      const t = legalTitle(id);
      expect(t, id).toContain(" · ");
      expect(t.length, id).toBeLessThanOrEqual(70);
    }
    expect(legalTitle("privacy")).toBe("Политика конфиденциальности · Құпиялылық саясаты");
    expect(legalTitle("terms")).toBe("Условия использования · Пайдалану шарттары");
    expect(biText({ ru: "а", kk: "б" })).toBe("а · б");
    expect(biText({ ru: "а", kk: "б" }, " ")).toBe("а б");
  });

  it("в превью и заголовках нет названий подрядчиков и технологий, «Кто мы» нет", () => {
    const stack = /openai|vercel|upstash|jsdelivr|cdn|pyodide|sql\.js|gpt|inf_ai/i;
    const all = [
      ...Object.values(metaDict).flatMap((v) => [v.ru, v.kk]),
      siteTitle(),
      siteDescription(),
      ogAlt(),
      ...LEGAL_IDS.map((id) => legalTitle(id)),
    ];
    for (const text of all) {
      expect(text.match(stack), text).toBeNull();
      expect(text, text).not.toMatch(/Кто мы|Біз кімбіз/);
    }
  });
});

describe("картинка превью public/og.png", () => {
  const file = join(root, "public", "og.png");

  it("PNG 1200×630 не тяжелее 300 КБ", () => {
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // IHDR: ширина и высота — 4 байта каждая, big-endian, со смещения 16.
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    expect(statSync(file).size).toBeLessThanOrEqual(300 * 1024);
  });

  it("layout подключает её в openGraph и twitter, а скрипт сборки лежит рядом", () => {
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('url: "/og.png"');
    expect(layout).toContain("width: 1200");
    expect(layout).toContain("height: 630");
    expect(layout).toContain("summary_large_image");
    expect(layout).toContain("metadataBase");
    expect(statSync(join(root, "scripts/og-image.mjs")).size).toBeGreaterThan(0);
  });
});
