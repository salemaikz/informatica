import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/components/scenes/samples/web";
import { URL_COLS, labelCols, layoutUrl, roleTone, urlLock, urlText, wrapUrl, URL_ROLES } from "@/components/scenes/url";
import { markNotes, messageSegments, senderInitial, splitMarks } from "@/components/scenes/message";
import { buildWebDoc, webHtml } from "@/components/scenes/web";
import { dict } from "@/i18n/dict";
import type { Scene, UrlRole } from "@/lib/types";

type UrlScene = Extract<Scene, { kind: "url" }>;
type MessageScene = Extract<Scene, { kind: "message" }>;
const urls = SAMPLES.filter((s): s is UrlScene => s.kind === "url");
const messages = SAMPLES.filter((s): s is MessageScene => s.kind === "message");

const name = (r: UrlRole) => dict[`scene.url.role.${r}` as keyof typeof dict].ru;

describe("url: перенос по частям", () => {
  it("склейка сегментов — исходный адрес, ни одна часть не режется, если влезает в строку", () => {
    for (const s of urls) {
      const lines = wrapUrl(s.parts, s.highlight);
      expect(lines.flat().map((x) => x.text).join("")).toBe(urlText(s.parts));
      for (const line of lines) {
        const cols = line.reduce((a, x) => a + [...x.text].length, 0);
        expect(cols).toBeLessThanOrEqual(URL_COLS);
      }
      for (const [i, p] of s.parts.entries()) {
        if ([...p.text].length <= URL_COLS) expect(lines.flat().filter((x) => x.part === i)).toHaveLength(1);
      }
    }
  });
  it("часть, не влезшая в остаток строки, переходит на следующую целиком", () => {
    const parts = [
      { text: "https://", role: "protocol" as const },
      { text: "www.", role: "subdomain" as const },
      { text: "informatika-ent-podgotovka", role: "domain" as const },
    ];
    const lines = wrapUrl(parts);
    expect(lines).toHaveLength(2);
    expect(lines[1].map((x) => x.text)).toEqual(["informatika-ent-podgotovka"]);
    expect(lines[1][0].col).toBe(0);
  });
  it("часть длиннее строки режется по колонкам", () => {
    const lines = wrapUrl([{ text: "a".repeat(40), role: "path" }]);
    expect(lines.map((l) => l.map((x) => x.text).join("").length)).toEqual([URL_COLS, 10]);
  });
  it("предельный адрес (48 символов) — не больше 3 строк", () => {
    const max = urls.reduce((a, s) => Math.max(a, wrapUrl(s.parts).length), 0);
    expect(max).toBeLessThanOrEqual(3);
  });
});

describe("url: подписи ролей", () => {
  it("подпись под каждой подсвеченной частью — по одной, внутри строки", () => {
    for (const s of urls) {
      const lines = layoutUrl(s.parts, s.highlight, name);
      const labels = lines.flatMap((l) => l.labels);
      expect(labels).toHaveLength(s.parts.filter((p) => (s.highlight ?? []).includes(p.role)).length);
      for (const l of lines)
        for (const lb of l.labels) {
          expect(lb.center - lb.width / 2).toBeGreaterThanOrEqual(-0.001);
          expect(lb.center + lb.width / 2).toBeLessThanOrEqual(URL_COLS + 0.001);
        }
    }
  });
  it("подписи одного яруса не наезжают друг на друга", () => {
    for (const s of urls)
      for (const l of layoutUrl(s.parts, s.highlight, name)) {
        for (let lv = 0; lv < l.levels; lv++) {
          const row = l.labels.filter((x) => x.level === lv).sort((a, b) => a.center - b.center);
          for (let i = 1; i < row.length; i++) expect(row[i].center - row[i].width / 2).toBeGreaterThanOrEqual(row[i - 1].center + row[i - 1].width / 2);
        }
      }
  });
  it("тесные подписи (.top, kaspi-bonus) уходят на разные ярусы только при нехватке места", () => {
    const s = urls.find((x) => x.parts.some((p) => p.text === ".top"))!;
    const lines = layoutUrl(s.parts, s.highlight, name);
    expect(lines[0].labels).toHaveLength(3);
    expect(lines[0].levels).toBeGreaterThanOrEqual(1);
  });
  it("kk: самые длинные подписи тоже помещаются в строку", () => {
    const kk = (r: UrlRole) => dict[`scene.url.role.${r}` as keyof typeof dict].kk;
    for (const r of URL_ROLES) expect(labelCols(kk(r))).toBeLessThan(URL_COLS / 2);
    for (const s of urls)
      for (const l of layoutUrl(s.parts, s.highlight, kk))
        for (const lb of l.labels) {
          expect(lb.center - lb.width / 2).toBeGreaterThanOrEqual(-0.001);
          expect(lb.center + lb.width / 2).toBeLessThanOrEqual(URL_COLS + 0.001);
        }
  });
  it("тон роли задан у каждой роли; соседние части образца с полным адресом — разного тона", () => {
    for (const r of URL_ROLES) expect(roleTone(r)).toBeTruthy();
    const full = urls.find((s) => s.parts.length === 8)!;
    for (let i = 1; i < full.parts.length; i++) expect(roleTone(full.parts[i].role)).not.toBe(roleTone(full.parts[i - 1].role));
  });
  it("замок: https закрыт, http открыт, без протокола — нет", () => {
    expect(urlLock([{ text: "https://", role: "protocol" }])).toBe("secure");
    expect(urlLock([{ text: "http://", role: "protocol" }])).toBe("open");
    expect(urlLock([{ text: "ent.kz", role: "domain" }])).toBe("none");
  });
});

describe("message: подсветка подстрок", () => {
  it("куски склеиваются в исходный текст, номера — по порядку marks", () => {
    const segs = splitMarks("Срочно перейдите по ссылке kaspi-bonus.top сейчас", ["kaspi-bonus.top", "Срочно"]);
    expect(segs.map((s) => s.text).join("")).toBe("Срочно перейдите по ссылке kaspi-bonus.top сейчас");
    expect(segs.filter((s) => s.mark).map((s) => [s.text, s.mark])).toEqual([
      ["Срочно", 2],
      ["kaspi-bonus.top", 1],
    ]);
  });
  it("не найденный и пустой признак пропускаются, пересечения не дублируют текст", () => {
    expect(splitMarks("abc def", ["zzz", ""])).toEqual([{ text: "abc def" }]);
    const segs = splitMarks("abcdef", ["abcd", "cdef"]);
    expect(segs.map((s) => s.text).join("")).toBe("abcdef");
    expect(segs.filter((s) => s.mark)).toHaveLength(1);
  });
  it("повторяющийся фрагмент — следующие вхождения", () => {
    const segs = splitMarks("a b a b", ["a", "a"]);
    expect(segs.filter((s) => s.mark).map((s) => s.mark)).toEqual([1, 2]);
    expect(segs.map((s) => s.text).join("")).toBe("a b a b");
  });
  it("подстроку ищет код в тексте нужного языка; все образцы находят все признаки на ru и kk", () => {
    for (const s of messages) {
      for (const lang of ["ru", "kk"] as const) {
        const segs = messageSegments(s, lang);
        expect(segs.filter((x) => x.mark)).toHaveLength((s.marks ?? []).length);
        const text = typeof s.text === "string" ? s.text : s.text[lang];
        expect(segs.map((x) => x.text).join("")).toBe(text);
      }
    }
  });
  it("список пояснений: номер = позиция признака, без note — нет строки", () => {
    const sms = messages.find((m) => m.channel === "chat")!;
    expect(markNotes(sms.marks, "ru")).toEqual([]);
    const email = messages.find((m) => m.channel === "email")!;
    expect(markNotes(email.marks, "kk").map((n) => n.n)).toEqual([1, 2]);
    expect(markNotes(email.marks, "kk")[0].note).toBe("банк құпия сөзді сұрамайды");
  });
  it("первая буква отправителя", () => {
    expect(senderInitial("Kaspi-Bonus")).toBe("K");
    expect(senderInitial("  айдар")).toBe("А");
    expect(senderInitial("")).toBe("?");
  });
});

describe("web: page и htmlKk", () => {
  it("htmlKk — только для казахского; без него одна разметка", () => {
    const a = { html: "<p>ru</p>", htmlKk: "<p>kk</p>" };
    expect(webHtml(a, "ru")).toBe("<p>ru</p>");
    expect(webHtml(a, "kk")).toBe("<p>kk</p>");
    expect(webHtml({ html: "<p>x</p>" }, "kk")).toBe("<p>x</p>");
  });
  it("документ строится из выбранной разметки, запрет внешнего сохраняется", () => {
    const doc = buildWebDoc(webHtml({ html: "<p>ru</p>", htmlKk: "<p>kk</p>" }, "kk"), "p{color:red}");
    expect(doc).toContain("<p>kk</p>");
    expect(doc).not.toContain("<p>ru</p>");
    expect(doc).toContain("default-src 'none'");
  });
  it("старые сцены (без page/htmlKk) строятся как раньше", () => {
    expect(buildWebDoc("<b>x</b>")).toContain("<body><b>x</b></body>");
  });
});
