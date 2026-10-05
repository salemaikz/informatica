import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/components/scenes/samples/web";
import { URL_COLS, URL_COLS_MIN, colsForWidth, labelCols, layoutUrl, partTones, urlLock, urlText, wrapUrl, URL_ROLES } from "@/components/scenes/url";
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
    expect(lines.map((l) => l.map((x) => x.text).join("").length)).toEqual([URL_COLS, 40 - URL_COLS]);
  });
  it("предельный адрес (48 символов) с худшим разбиением на части (16+15+16+1) — не больше 3 строк", () => {
    const parts = [
      { text: "https://aaaaaaaa", role: "protocol" as const },
      { text: "bbbbbbbbbbbbbbb", role: "domain" as const },
      { text: "cccccccccccccccc", role: "path" as const },
      { text: "?", role: "query" as const },
    ];
    expect(urlText(parts)).toHaveLength(48);
    const lines = wrapUrl(parts);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.flat().map((x) => x.text).join("")).toBe(urlText(parts));
  });
  it("колонки по ширине контейнера: узкая сцена — меньше колонок, но не меньше предела", () => {
    expect(colsForWidth(220)).toBeLessThan(colsForWidth(400));
    expect(colsForWidth(10)).toBe(URL_COLS_MIN);
    expect(colsForWidth(URL_COLS * 8.4)).toBeLessThanOrEqual(URL_COLS);
  });
  it("полный адрес на узкой строке переносится без потерь, все подписи внутри строки", () => {
    const full = urls.find((s) => s.parts.length === 8)!;
    const cols = colsForWidth(200);
    const lines = layoutUrl(full.parts, full.highlight, name, cols);
    expect(lines.flatMap((l) => l.segments).map((x) => x.text).join("")).toBe(urlText(full.parts));
    for (const l of lines) for (const lb of l.labels) expect(lb.center + lb.width / 2).toBeLessThanOrEqual(cols + 0.001);
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
  it("подписи, которым хватает места, стоят на одном ярусе; тесные — на разных", () => {
    const roomy = [
      { text: "https://", role: "protocol" as const },
      { text: "kaspi-bonus-example", role: "domain" as const },
    ];
    expect(layoutUrl(roomy, ["protocol", "domain"], name)[0].levels).toBe(1);
    const tight = [
      { text: "a", role: "domain" as const },
      { text: ".kz", role: "zone" as const },
      { text: ":80", role: "port" as const },
    ];
    const l = layoutUrl(tight, ["domain", "zone", "port"], name)[0];
    expect(l.levels).toBeGreaterThanOrEqual(2);
    expect(l.labels.some((x) => x.level === 1)).toBe(true);
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
  it("тона: только primary и muted (без ai, gold, success, warning), соседние подсвеченные части — разные", () => {
    const full = urls.find((s) => s.parts.length === 8)!;
    const tones = partTones(full.parts, full.highlight);
    for (const t of tones) expect(["primary", "muted"]).toContain(t);
    for (let i = 1; i < tones.length; i++) expect(tones[i]).not.toBe(tones[i - 1]);
    expect(partTones(full.parts, ["zone"]).filter((t) => t !== null)).toEqual(["primary"]);
    expect(partTones(full.parts)).toEqual(full.parts.map(() => null));
  });
  it("роли на kk совпадают с глоссарием: хаттама, субдомен", () => {
    expect(dict["scene.url.role.protocol"].kk).toBe("хаттама");
    expect(dict["scene.url.role.subdomain"].kk).toBe("субдомен");
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
  it("короткий признак внутри длинного не вытесняет длинный; номера — по исходному порядку", () => {
    const segs = splitMarks("Перейдите на kaspi-bonus.top", ["kaspi", "kaspi-bonus.top"]);
    expect(segs.filter((s) => s.mark).map((s) => [s.text, s.mark])).toEqual([["kaspi-bonus.top", 2]]);
    expect(segs.map((s) => s.text).join("")).toBe("Перейдите на kaspi-bonus.top");
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
