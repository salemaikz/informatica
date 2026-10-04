import { describe, expect, it } from "vitest";
import { LEGAL, LEGAL_IDS, LEGAL_PLACEHOLDERS, legalMarkdown, type LegalDoc } from "@/content/legal";
import { dict } from "@/i18n/dict";
import { legalDict } from "@/i18n/parts/legal";
import { TRIAL_DAYS } from "@/lib/economy";
import { detectLang } from "@/lib/guest-lang";
import { isPublicPath } from "@/lib/public-paths";
import { MAX_RECORD_SEC } from "@/lib/voice";

type Lang = "ru" | "kk";
const LANGS: Lang[] = ["ru", "kk"];
const EMOJI = /\p{Extended_Pictographic}/u;
// «ЕНТ» как отдельное слово (внутри «ҰБТ-ға» и других слов не ищем).
const ENT_WORD = /(?<![А-ЯЁӘҒҚҢӨҰҮҺІ])ЕНТ(?![А-ЯЁӘҒҚҢӨҰҮҺІ])/;
const II_WORD = /(?<![А-ЯЁӘҒҚҢӨҰҮҺІ])ИИ(?![А-ЯЁӘҒҚҢӨҰҮҺІ])/;

const docs = LEGAL_IDS.map((id) => LEGAL[id]);

/** Все тексты документа на языке. */
function textsOf(doc: LegalDoc, lang: Lang): string[] {
  return [doc.updated[lang], doc.intro[lang], ...doc.sections.flatMap((s) => [s.title[lang], s.body[lang]])];
}
const fullText = (doc: LegalDoc, lang: Lang) => textsOf(doc, lang).join("\n");

/** Абзацы (блоки через пустую строку) и пункты списка — форма текста, одинаковая на двух языках. */
const paragraphs = (s: string) => s.split(/\n{2,}/).filter((p) => p.trim()).length;
const bullets = (s: string) => s.split("\n").filter((l) => l.startsWith("- ")).length;

describe("правовые документы", () => {
  it("три документа: «Кто мы», политика, условия", () => {
    expect([...LEGAL_IDS].sort()).toEqual(["about", "privacy", "terms"]);
    for (const id of LEGAL_IDS) expect(LEGAL[id].id).toBe(id);
  });

  it("у каждого документа есть ru и kk: дата, вступление, заголовки и тексты разделов", () => {
    for (const doc of docs) {
      expect(doc.sections.length, doc.id).toBeGreaterThanOrEqual(5);
      for (const lang of LANGS) {
        for (const text of textsOf(doc, lang)) expect(text.trim(), `${doc.id}.${lang}`).not.toBe("");
      }
    }
  });

  it("на двух языках одинаковое число разделов, абзацев и пунктов списка", () => {
    for (const doc of docs) {
      const md = Object.fromEntries(LANGS.map((l) => [l, legalMarkdown(doc, l)])) as Record<Lang, string>;
      const h2 = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
      expect(h2(md.ru), doc.id).toBe(doc.sections.length);
      expect(h2(md.kk), doc.id).toBe(doc.sections.length);
      doc.sections.forEach((s, i) => {
        expect(paragraphs(s.body.kk), `${doc.id} раздел ${i + 1}: абзацы`).toBe(paragraphs(s.body.ru));
        expect(bullets(s.body.kk), `${doc.id} раздел ${i + 1}: пункты`).toBe(bullets(s.body.ru));
      });
    }
  });

  it("нет эмодзи", () => {
    for (const doc of docs) for (const lang of LANGS) expect(EMOJI.test(fullText(doc, lang)), `${doc.id}.${lang}`).toBe(false);
  });

  it("в казахском тексте ҰБТ, а не ЕНТ, и ЖИ, а не ИИ", () => {
    for (const doc of docs) {
      const kk = fullText(doc, "kk");
      expect(ENT_WORD.test(kk), `${doc.id}: «ЕНТ» в kk`).toBe(false);
      expect(II_WORD.test(kk), `${doc.id}: «ИИ» в kk`).toBe(false);
    }
    // О проекте и условиях ҰБТ называется прямо.
    expect(fullText(LEGAL.about, "kk")).toContain("ҰБТ");
    expect(fullText(LEGAL.terms, "kk")).toContain("ҰБТ");
  });

  it("в казахском нет слов, склеенных из латиницы и кириллицы (опечатка с латинской буквой)", () => {
    const mixed = /[а-яёәғқңөұүһі][a-z]|[a-z][а-яёәғқңөұүһі]/i;
    for (const doc of docs) for (const lang of LANGS) expect(fullText(doc, lang).match(mixed), `${doc.id}.${lang}`).toBeNull();
  });

  it("разметка простая: без HTML, картинок, маркера ==, заголовков внутри разделов", () => {
    for (const doc of docs) {
      for (const lang of LANGS) {
        for (const s of doc.sections) {
          expect(s.body[lang], `${doc.id}.${lang}`).not.toMatch(/^#/m);
        }
        expect(fullText(doc, lang), `${doc.id}.${lang}`).not.toMatch(/==|<[a-z/!]|!\[/i);
      }
    }
  });

  it("без глаголов с родом в обращении «ты … -л / -ла»", () => {
    const gendered = /(?<![а-яё])ты (?:сам |уже |потом )?[а-яё]+(?:л|ла|ли)(?![а-яё])/iu;
    for (const doc of docs) expect(fullText(doc, "ru").match(gendered), doc.id).toBeNull();
  });

  it("реквизиты и контакты — в квадратных скобках, на двух языках одинаково", () => {
    for (const doc of docs) {
      for (const lang of LANGS) {
        const text = fullText(doc, lang);
        const known = LEGAL_PLACEHOLDERS.map((p) => p[lang]);
        // Любое слово в [скобках] должно быть одним из плейсхолдеров — случайных «[…]» нет.
        for (const m of text.match(/\[[^\]]+\]/g) ?? []) expect(known, `${doc.id}.${lang}: ${m}`).toContain(m);
        // Контакт и владелец указаны в каждом документе.
        expect(text, `${doc.id}.${lang}`).toContain(LEGAL_PLACEHOLDERS[2][lang]);
        expect(text, `${doc.id}.${lang}`).toContain(LEGAL_PLACEHOLDERS[0][lang]);
      }
      for (const p of LEGAL_PLACEHOLDERS) {
        const count = (lang: Lang) => fullText(doc, lang).split(p[lang]).length - 1;
        expect(count("kk"), `${doc.id} ${p.ru}`).toBe(count("ru"));
      }
    }
  });

  it("законы: только №94-V, без выдуманных статей", () => {
    for (const doc of docs) {
      for (const lang of LANGS) {
        const text = fullText(doc, lang);
        expect(text, `${doc.id}.${lang}`).not.toMatch(/ст\.\s*\d|стать[яи]\s+\d|\d+\s*-?\s*бап|(?<![а-яё])бап\s+\d/i);
        for (const m of text.matchAll(/№\s*([^\s)]+)/g)) expect(m[1], `${doc.id}.${lang}`).toBe("94-V");
      }
    }
  });

  it("политика сверена с кодом: что хранится и куда уходит", () => {
    const privacy = LEGAL.privacy;
    for (const lang of LANGS) {
      const text = fullText(privacy, lang);
      // Сервер и OpenAI.
      expect(text).toContain("OpenAI");
      expect(text).toContain("inf_ai");
      expect(text).toContain("HttpOnly");
      expect(text).toContain("IndexedDB");
      expect(text).toContain("localStorage");
      // Запись голоса — тот же предел, что в коде.
      expect(text).toContain(String(MAX_RECORD_SEC));
      // Что именно уходит ИИ о ученике (src/lib/student-context.ts): ключевые позиции.
      expect(text).toMatch(lang === "ru" ? /имя, класс, цель/ : /аты, сыныбы, мақсаты/);
    }
    // Путь к удалению и копии — названия кнопок из словаря интерфейса.
    for (const lang of LANGS) {
      const text = fullText(privacy, lang);
      expect(text).toContain(`${dict["nav.profile"][lang]} → ${dict["prof.reset"][lang]}`);
      expect(text).toContain(`${dict["nav.profile"][lang]} → ${dict["prof.export"][lang]}`);
    }
  });

  it("условия сверены с тарифами: названия и пробный период", () => {
    for (const lang of LANGS) {
      const text = fullText(LEGAL.terms, lang);
      expect(text).toContain(`«${dict["plans.tier.lite"][lang]}»`);
      expect(text).toContain(`«${dict["plans.tier.unlimited"][lang]}»`);
      expect(text).toContain(`${TRIAL_DAYS} ${lang === "ru" ? "дней" : "күн"}`);
    }
    // Платёж не подключён — об этом сказано прямо.
    expect(fullText(LEGAL.terms, "ru")).toContain("Оплата пока не подключена");
    expect(fullText(LEGAL.privacy, "ru")).toContain("оплата пока не подключена");
  });

  it("про детей: несовершеннолетние и родители — в политике и в условиях", () => {
    expect(fullText(LEGAL.privacy, "ru")).toMatch(/несовершеннолетн/);
    expect(fullText(LEGAL.privacy, "ru")).toContain("родител");
    expect(fullText(LEGAL.privacy, "kk")).toContain("кәмелетке толмағандар");
    expect(fullText(LEGAL.terms, "ru")).toContain("18 лет");
    expect(fullText(LEGAL.terms, "kk")).toContain("18 жасқа");
  });
});

describe("строки страниц документов", () => {
  it("у каждого ключа legal.* есть ru и kk, эмодзи нет, кризисных текстов здесь нет", () => {
    const keys = Object.keys(legalDict);
    expect(keys.length).toBeGreaterThan(10);
    for (const [key, v] of Object.entries(legalDict)) {
      expect(key.startsWith("legal."), key).toBe(true);
      expect(key.startsWith("legal.crisis."), key).toBe(false);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
      expect(EMOJI.test(v.ru + v.kk), key).toBe(false);
      expect(ENT_WORD.test(v.kk), key).toBe(false);
    }
  });

  it("строка согласия складывается в целое предложение (как в LegalConsentNote)", () => {
    const compose = (lang: Lang) => {
      const t = (k: keyof typeof legalDict) => legalDict[k][lang];
      return `${t("legal.consent.pre")} ${t("legal.consent.terms")} ${t("legal.consent.and")} ${t("legal.consent.privacy")}${lang === "kk" ? " " : ""}${t("legal.consent.post")}`;
    };
    expect(compose("ru")).toBe("Продолжая, ты соглашаешься с Условиями использования и Политикой конфиденциальности.");
    expect(compose("kk")).toBe("Жалғастыра отырып, сен Пайдалану шарттарымен және Құпиялылық саясатымен келісесің.");
  });

  it("заголовки страниц совпадают с названиями в ссылках", () => {
    expect(legalDict["legal.title.about"].ru).toBe(legalDict["legal.nav.about"].ru);
    expect(legalDict["legal.title.about"].kk).toBe(legalDict["legal.nav.about"].kk);
  });
});

describe("публичные страницы", () => {
  it("/about, /privacy, /terms открываются без онбординга", () => {
    for (const p of ["/about", "/privacy", "/terms", "/onboarding"]) expect(isPublicPath(p), p).toBe(true);
  });

  it("остальные страницы приложения — только после онбординга", () => {
    for (const p of ["/", "/learn", "/profile", "/tutor", "/plans", "/aboutx", "/privacy-policy"]) expect(isPublicPath(p), p).toBe(false);
  });
});

describe("язык гостя", () => {
  it("kk* → казахский, остальное → русский", () => {
    expect(detectLang("kk")).toBe("kk");
    expect(detectLang("kk-KZ")).toBe("kk");
    expect(detectLang("KK-kz")).toBe("kk");
    expect(detectLang("ru-RU")).toBe("ru");
    expect(detectLang("en-US")).toBe("ru");
    expect(detectLang("")).toBe("ru");
    expect(detectLang(undefined)).toBe("ru");
    expect(detectLang(null)).toBe("ru");
  });
});
