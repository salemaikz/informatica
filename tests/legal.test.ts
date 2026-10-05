import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL, LEGAL_IDS, LEGAL_PLACEHOLDERS, legalMarkdown, type LegalDoc } from "@/content/legal";
import { dict } from "@/i18n/dict";
import { legalDict } from "@/i18n/parts/legal";
import { BACKUP_STATE_KEYS } from "@/lib/backup";
import { AI_DAILY_CAP, AI_UNITS, TRIAL_DAYS } from "@/lib/economy";
import { detectLang, GUEST_LANG_KEY, guestLangToApply, markLangChosen } from "@/lib/guest-lang";
import { ISSUE_CHANNELS, ISSUE_LIMITS } from "@/lib/issue";
import { kkSuffix } from "@/lib/kk";
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

  it("без слов «сам», «сама», «самому», «самой»: пол ученика неизвестен", () => {
    // «можно сделать самому» → «самостоятельно»: слово целиком, поэтому «самостоятельно» не совпадает.
    const self = /(?<![а-яё])(?:сам|сама|самому|самой)(?![а-яё])/iu;
    for (const doc of docs) expect(fullText(doc, "ru").match(self), doc.id).toBeNull();
    expect(self.test("это можно сделать самому")).toBe(true);
    expect(self.test("Сама аудиозапись")).toBe(true);
    expect(self.test("это можно сделать самостоятельно")).toBe(false);
  });

  it("без слов с родом рядом с «ты»: должен, готов, согласен, рад, уверен", () => {
    const gendered = /(?<![а-яё])ты\s+(?:уже\s+)?(?:должен|должна|готов|готова|согласен|согласна|рад|рада|уверен|уверена)(?![а-яё])/iu;
    for (const doc of docs) expect(fullText(doc, "ru").match(gendered), doc.id).toBeNull();
    expect(gendered.test("Ты должен прочитать")).toBe(true);
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

  it("сообщения и отчёты об ошибках: пределы и хранение — как в коде (lib/issue.ts)", () => {
    const items = (lang: Lang) => {
      const text = LEGAL.privacy.sections.find((x) => x.title.ru === "Что хранится у нас на сервере")?.body[lang] ?? "";
      const list = text.split("\n").filter((l) => l.startsWith("- "));
      return { report: list.find((l) => l.includes(dict["issue.button"][lang])) ?? "", crash: list.find((l) => l.includes("User-Agent")) ?? "" };
    };
    for (const lang of LANGS) {
      const { report, crash } = items(lang);
      expect(report, lang).toBeTruthy();
      expect(crash, lang).toBeTruthy();
      // Сообщение: комментарий, фрагмент, число и срок хранения.
      for (const n of [ISSUE_LIMITS.comment, ISSUE_LIMITS.snippet, ISSUE_CHANNELS.issue.max, 30]) expect(report, `${lang}: ${n}`).toContain(String(n));
      // Отчёт о сбое: текст ошибки, стек и число отчётов.
      for (const n of [ISSUE_LIMITS.message, ISSUE_LIMITS.stack, ISSUE_CHANNELS.client_error.max]) expect(crash, `${lang}: ${n}`).toContain(String(n));
    }
    // Страницы и браузера в сообщении об ошибке нет (в отчёте о сбое страница без параметров и User-Agent есть).
    expect(items("ru").report).toContain("страницы и браузера в сообщении нет");
    expect(items("ru").crash).toContain("без параметров");
    expect(items("ru").crash).toContain("но в тексте ошибки может оказаться фрагмент страницы");
    // Старое обещание «храним, пока разбираем» убрано.
    expect(fullText(LEGAL.privacy, "ru")).not.toContain("пока разбираем");
    expect(fullText(LEGAL.privacy, "kk")).not.toContain("талдап жатқанымызда");
  });

  it("«Коротко»: ИИ получает сведения о тебе, есть автоматические отчёты о сбоях", () => {
    const brief = LEGAL.privacy.sections[0].body;
    expect(brief.ru).toContain("имя, класс, слабые темы, память наставника и начало твоих заметок");
    expect(brief.ru).toContain("автоматические отчёты");
    expect(brief.kk).toContain("аты, сыныбы, әлсіз тақырыптары, тәлімгер жазбалары");
    expect(brief.kk).toContain("автоматты есептер");
    // Старая формулировка «на сервер уходит немногое: … и сообщения об ошибках» убрана.
    expect(brief.ru).not.toContain("На сервер уходит немногое");
  });

  it("фото: проверка в уроке — без сведений об ученике, фото в чате — со сведениями", () => {
    for (const lang of LANGS) {
      const openai = LEGAL.privacy.sections.find((x) => x.title.ru === "Что уходит в OpenAI")?.body[lang] ?? "";
      const list = openai.split("\n").filter((l) => l.startsWith("- "));
      const lesson = list.find((l) => l.includes(lang === "ru" ? "Фото решения при проверке в уроке" : "Сабақта тексеруге жіберілетін шешім фотосы")) ?? "";
      const chat = list.find((l) => l.includes(lang === "ru" ? "Фото в чате с Битом" : "Битпен чаттағы фото")) ?? "";
      expect(lesson, lang).toBeTruthy();
      expect(chat, lang).toBeTruthy();
      expect(lesson, lang).toContain(lang === "ru" ? "кроме стиля объяснений, не добавляются" : "түсіндіру стилінен басқа");
      // «Кроме стиля» — только про проверку в уроке.
      expect(chat, lang).not.toContain(lang === "ru" ? "кроме стиля" : "стилінен басқа");
      expect(chat, lang).toContain(lang === "ru" ? "со сведениями о тебе" : "өзің туралы мәліметтермен");
    }
  });

  it("кнопки ИИ названы как в интерфейсе: «Спросить Бита», «Разбор от Бита», «Сообщить об ошибке»", () => {
    for (const lang of LANGS) {
      const openai = LEGAL.privacy.sections.find((x) => x.title.ru === "Что уходит в OpenAI")?.body[lang] ?? "";
      expect(openai, lang).toContain(`«${dict["ai.askBit"][lang]}»`);
      expect(openai, lang).toContain(`«${dict["exam.ai.title"][lang]}»`);
      expect(fullText(LEGAL.privacy, lang)).toContain(`«${dict["issue.button"][lang]}»`);
    }
  });

  it("копия данных: состав как в lib/backup.ts", () => {
    for (const k of ["profile", "xp", "notebook", "wallet", "history", "chats"]) expect(BACKUP_STATE_KEYS as readonly string[], k).toContain(k);
    for (const k of ["plan", "onboarded"]) expect(BACKUP_STATE_KEYS as readonly string[], k).not.toContain(k);
    const device = LEGAL.privacy.sections.find((x) => x.title.ru === "Что хранится на твоём устройстве")!;
    expect(device.body.ru).toContain("В копию входят прогресс и конспекты, чипы, история, чаты с сообщениями, фото конспектов и листы черновика");
    expect(device.body.ru).toContain("Не входят код из практикума");
    expect(device.body.ru).toContain("и тариф");
    expect(device.body.kk).toContain("Практикумдағы код");
    expect(device.body.kk).toContain("және тариф кірмейді");
  });

  it("голос: аудиозапись уходит в OpenAI, у нас не хранится", () => {
    const voice = (lang: Lang) =>
      LEGAL.privacy.sections
        .find((x) => x.title.ru === "Что уходит в OpenAI")!
        .body[lang].split("\n")
        .find((l) => l.startsWith(`- **${lang === "ru" ? "Голос" : "Дауыс"}`)) ?? "";
    expect(voice("ru")).toContain("аудиозапись целиком");
    expect(voice("ru")).toContain("уходит в OpenAI");
    expect(voice("ru")).toContain("Аудио мы не храним");
    expect(voice("kk")).toContain("OpenAI-ға барады");
    expect(voice("kk")).toContain("Аудионы біз сақтамаймыз");
  });

  it("кто ещё участвует: хостинг, хранилище, OpenAI и CDN движков практикума — адреса сверены с кодом", () => {
    const who = LEGAL.privacy.sections.find((x) => x.title.ru === "Кто ещё участвует");
    expect(who).toBeTruthy();
    for (const lang of LANGS) {
      for (const name of ["Vercel", "Upstash", "OpenAI", "cdn.jsdelivr.net"]) expect(who!.body[lang], `${lang}: ${name}`).toContain(name);
    }
    const python = readFileSync(join(__dirname, "../public/ide/python-worker.js"), "utf8");
    const sql = readFileSync(join(__dirname, "../src/lib/ide/sql/db.ts"), "utf8");
    expect(python).toContain("https://cdn.jsdelivr.net/");
    expect(sql).toContain("https://cdn.jsdelivr.net/");
    // Хранилище сервера — Upstash (src/server/kv.ts).
    expect(readFileSync(join(__dirname, "../src/server/kv.ts"), "utf8")).toContain("Upstash");
  });

  it("«ИИ без ограничений» нигде не обещаем: у «Безлимита» — потолок в день (AI_DAILY_CAP)", () => {
    expect(AI_DAILY_CAP.unlimited).toBeGreaterThan(0);
    // Потолок один на всех тарифах (правка v0.9.1): в «Условиях» — это число, без «у Лайта — N, у Безлимита — M».
    expect(new Set(Object.values(AI_DAILY_CAP)).size).toBe(1);
    for (const doc of docs) {
      expect(fullText(doc, "ru"), doc.id).not.toMatch(/без ограничений|без лимита|безгранично|неограниченн/i);
      expect(fullText(doc, "kk"), doc.id).not.toMatch(/шектеусіз|лимитсіз|шексіз ЖИ/i);
    }
    const terms = fullText(LEGAL.terms, "ru");
    const cap = AI_DAILY_CAP.unlimited;
    expect(terms).toContain(`не больше ${cap} обращений к ИИ в день на любом тарифе`);
    expect(terms).toContain(`на любом тарифе — не больше ${cap}`);
    expect(terms).not.toContain("зависит от тарифа");
    const termsKk = fullText(LEGAL.terms, "kk");
    expect(termsKk).toContain(`кез келген тарифте күніне ЖИ-ге ең көбі ${cap} жүгіну`);
    expect(termsKk).toContain(`кез келген тарифте ${kkSuffix(cap, "abl")} аспайды`);
    expect(termsKk).not.toContain("тарифке және жалпы жүктемеге байланысты");
    // Вес обращений: фото и «Разбор от Бита» — одинаково, голос — дороже.
    expect(AI_UNITS.review).toBe(AI_UNITS.photo);
    expect(terms).toContain(`считаются за ${AI_UNITS.photo} обращения, голосовой вопрос — за ${AI_UNITS.voice}`);
    expect(fullText(LEGAL.terms, "kk")).toContain(`${AI_UNITS.photo} жүгіну, дауыспен қойылған сұрақ ${AI_UNITS.voice} жүгіну`);
  });

  it("Бит не «решает за тебя» — написано честно; ИИ работает не только «по кнопке»", () => {
    const about = (lang: Lang) => fullText(LEGAL.about, lang);
    expect(about("ru")).not.toContain("не решает за тебя");
    expect(about("ru")).toContain("В подсказках не даёт готового ответа, а в чате может показать решение, если попросить");
    expect(about("ru")).not.toContain("Работает по кнопке");
    expect(about("ru")).toContain("У заданий есть готовые подсказки и разборы");
    expect(about("kk")).toContain("Кеңестерде дайын жауапты бермейді");
    expect(fullText(LEGAL.privacy, "ru")).toContain("кроме короткого автоматического отзыва после урока и тренировки");
  });

  it("условия сверены с окном тарифов: кнопка «Выбрать» открывает «Оплата скоро появится»", () => {
    for (const lang of LANGS) {
      const terms = fullText(LEGAL.terms, lang);
      expect(terms, lang).toContain(`«${dict["plans.card.choose"][lang]}»`);
      expect(terms, lang).toContain(`«${dict["soon.title"][lang]}»`);
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

  it("гостю без онбординга язык подставляется по браузеру, если не выбран", () => {
    expect(guestLangToApply({ onboarded: false, chosen: false, navLang: "kk-KZ", current: "ru" })).toBe("kk");
    expect(guestLangToApply({ onboarded: false, chosen: false, navLang: "ru-RU", current: "kk" })).toBe("ru");
    expect(guestLangToApply({ onboarded: false, chosen: false, navLang: "en-US", current: "kk" })).toBe("ru");
    // Язык уже совпал — менять нечего.
    expect(guestLangToApply({ onboarded: false, chosen: false, navLang: "kk", current: "kk" })).toBeNull();
  });

  it("язык, выбранный вручную в онбординге (флаг стоит), не перезаписывается языком браузера", () => {
    // Ссылка из согласия открыта в новой вкладке: язык в сохранении — ru (выбран на шаге 0), а браузер казахский.
    expect(guestLangToApply({ onboarded: false, chosen: true, navLang: "kk-KZ", current: "ru" })).toBeNull();
    expect(guestLangToApply({ onboarded: false, chosen: true, navLang: "ru-RU", current: "kk" })).toBeNull();
  });

  it("после онбординга язык не трогаем", () => {
    expect(guestLangToApply({ onboarded: true, chosen: false, navLang: "kk-KZ", current: "ru" })).toBeNull();
  });

  it("выбор языка ставит флаг; хранилище недоступно — без ошибки", () => {
    const calls: [string, string][] = [];
    expect(markLangChosen({ setItem: (k, v) => void calls.push([k, v]) })).toBe(true);
    expect(calls).toEqual([[GUEST_LANG_KEY, "1"]]);
    expect(
      markLangChosen({
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    ).toBe(false);
    expect(markLangChosen(null)).toBe(false);
    expect(GUEST_LANG_KEY).toBe("informatica-lang-auto");
  });
});
