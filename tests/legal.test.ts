import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultUrlTransform } from "react-markdown";
import { describe, expect, it } from "vitest";
import { LEGAL, LEGAL_CONTACT, LEGAL_IDS, legalMarkdown, type LegalDoc } from "@/content/legal";
import { dict } from "@/i18n/dict";
import { legalDict } from "@/i18n/parts/legal";
import { AI_UNITS, TRIAL_DAYS } from "@/lib/economy";
import { detectLang, GUEST_LANG_KEY, guestLangToApply, markLangChosen } from "@/lib/guest-lang";
import { ISSUE_LIMITS } from "@/lib/issue";
import { isPublicPath } from "@/lib/public-paths";
import { MAX_RECORD_SEC } from "@/lib/voice";

type Lang = "ru" | "kk";
const LANGS: Lang[] = ["ru", "kk"];
const root = join(__dirname, "..");
const EMOJI = /\p{Extended_Pictographic}/u;
// «ЕНТ» как отдельное слово (внутри «ҰБТ-ға» и других слов не ищем).
const ENT_WORD = /(?<![А-ЯЁӘҒҚҢӨҰҮҺІ])ЕНТ(?![А-ЯЁӘҒҚҢӨҰҮҺІ])/;
const II_WORD = /(?<![А-ЯЁӘҒҚҢӨҰҮҺІ])ИИ(?![А-ЯЁӘҒҚҢӨҰҮҺІ])/;
// Стек не раскрываем: ни подрядчиков, ни технологий, ни имени cookie, ни технических подробностей.
const STACK = /openai|vercel|upstash|jsdelivr|cdn|pyodide|sql\.js|gpt|inf_ai|hmac|httponly|indexeddb|localstorage|user-agent/i;
// Резервной копии больше нет: ни «копии данных», ни «скачай», ни выгрузки.
const BACKUP = /копи[юяиейь]|көшірме|скача|жүктеп ал|выгруз|резерв/i;

const docs = LEGAL_IDS.map((id) => LEGAL[id]);

/** Все тексты документа на языке. */
function textsOf(doc: LegalDoc, lang: Lang): string[] {
  return [doc.updated[lang], doc.intro[lang], ...doc.sections.flatMap((s) => [s.title[lang], s.body[lang]])];
}
const fullText = (doc: LegalDoc, lang: Lang) => textsOf(doc, lang).join("\n");

/** Текст раздела документа по русскому заголовку, на языке. */
const section = (doc: LegalDoc, titleRu: string, lang: Lang) => doc.sections.find((x) => x.title.ru === titleRu)?.body[lang] ?? "";

/** Абзацы (блоки через пустую строку) и пункты списка — форма текста, одинаковая на двух языках. */
const paragraphs = (s: string) => s.split(/\n{2,}/).filter((p) => p.trim()).length;
const bullets = (s: string) => s.split("\n").filter((l) => l.startsWith("- ")).length;

/** Текст без Markdown-ссылок на почту: в нём не должно остаться «[…]»-заготовок. */
const withoutMailLinks = (s: string) => s.replace(/\[[^\]]+\]\(mailto:[^)]+\)/g, "");

describe("правовые документы", () => {
  it("два документа: политика и условия; «Кто мы» убрано вместе со страницей", () => {
    expect([...LEGAL_IDS].sort()).toEqual(["privacy", "terms"]);
    expect(Object.keys(LEGAL).sort()).toEqual(["privacy", "terms"]);
    for (const id of LEGAL_IDS) expect(LEGAL[id].id).toBe(id);
    expect(existsSync(join(root, "src/app/about"))).toBe(false);
    for (const id of LEGAL_IDS) expect(existsSync(join(root, `src/app/${id}/page.tsx`)), id).toBe(true);
    for (const doc of docs) for (const lang of LANGS) expect(fullText(doc, lang), `${doc.id}.${lang}`).not.toMatch(/Кто мы|Біз кімбіз/);
    // Ссылки на документы — только на два.
    const links = readFileSync(join(root, "src/components/legal/LegalLinks.tsx"), "utf8");
    expect(links).not.toContain("/about");
    expect(links).toContain('"/privacy"');
    expect(links).toContain('"/terms"');
  });

  it("у каждого документа есть ru и kk: дата, вступление, заголовки и тексты разделов", () => {
    for (const doc of docs) {
      expect(doc.sections.length, doc.id).toBeGreaterThanOrEqual(5);
      for (const lang of LANGS) {
        for (const text of textsOf(doc, lang)) expect(text.trim(), `${doc.id}.${lang}`).not.toBe("");
      }
    }
  });

  it("дата редакции — 6 октября 2026, пометки «черновик» нет", () => {
    for (const doc of docs) {
      expect(doc.updated.ru, doc.id).toBe("6 октября 2026");
      expect(doc.updated.kk, doc.id).toBe("2026 жылғы 6 қазан");
    }
    expect(Object.keys(legalDict)).not.toContain("legal.draft");
    const page = readFileSync(join(root, "src/components/legal/LegalPage.tsx"), "utf8");
    expect(page).not.toContain("legal.draft");
    // «Черновик» как функция приложения (листы черновика) остаётся; пометки «текст проверит юрист» нет.
    for (const doc of docs) for (const lang of LANGS) expect(fullText(doc, lang), `${doc.id}.${lang}`).not.toMatch(/Черновик:|Қаралама:|юрист|заңгер|заполнит владелец/i);
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
    // В условиях и политике ҰБТ называется прямо.
    expect(fullText(LEGAL.terms, "kk")).toContain("ҰБТ");
    expect(fullText(LEGAL.privacy, "kk")).toContain("ҰБТ");
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

  it("контакт — salemai.astana@gmail.com на обоих языках в каждом документе, заготовок в скобках нет", () => {
    expect(LEGAL_CONTACT).toBe("salemai.astana@gmail.com");
    const link = `[${LEGAL_CONTACT}](mailto:${LEGAL_CONTACT})`;
    for (const doc of docs) {
      for (const lang of LANGS) {
        const text = fullText(doc, lang);
        expect(text, `${doc.id}.${lang}`).toContain(link);
        // Любые «[…]» — только ссылки на почту: заготовок «[контакт]», «[реквизиты]» не осталось.
        expect(withoutMailLinks(text).match(/\[[^\]]*\]/g), `${doc.id}.${lang}`).toBeNull();
        // Владельца и реквизитов в тексте нет (телефон добавим позже).
        expect(text, `${doc.id}.${lang}`).not.toMatch(/владелец проекта|реквизит|жоба иесі/i);
      }
      // Адрес на двух языках встречается одинаково часто.
      const count = (lang: Lang) => fullText(doc, lang).split(LEGAL_CONTACT).length - 1;
      expect(count("kk"), doc.id).toBe(count("ru"));
    }
  });

  it("ссылка на почту проходит проверку адресов Markdown (mailto разрешён)", () => {
    expect(defaultUrlTransform(`mailto:${LEGAL_CONTACT}`)).toBe(`mailto:${LEGAL_CONTACT}`);
  });

  it("ссылки в документах заметны: страница документа красит и подчёркивает их (в общем Markdown стиля ссылок нет)", () => {
    const page = readFileSync(join(root, "src/components/legal/LegalPage.tsx"), "utf8");
    expect(page).toMatch(/\[&_a\]:text-primary/);
    expect(page).toMatch(/\[&_a\]:underline\b/);
    expect(page).toMatch(/\[&_a\]:underline-offset-2/);
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

  it("стек не раскрыт: ни названий подрядчиков и технологий, ни имени cookie, ни технических подробностей", () => {
    for (const doc of docs) {
      for (const lang of LANGS) {
        const text = fullText(doc, lang);
        expect(text.match(STACK), `${doc.id}.${lang}`).toBeNull();
        // Адресов сайтов и хостинга в тексте тоже нет (кроме почты для связи).
        expect(withoutMailLinks(text).match(/https?:\/\/|\.vercel\.|\.app\b/i), `${doc.id}.${lang}`).toBeNull();
      }
    }
    // Сама проверка ловит то, что нужно.
    for (const word of ["OpenAI", "Vercel", "Upstash", "cdn.jsdelivr.net", "Pyodide", "sql.js", "gpt-5.4-mini", "inf_ai", "HMAC", "IndexedDB"]) {
      expect(STACK.test(word), word).toBe(true);
    }
  });

  it("резервной копии больше нет: в текстах нет «копии данных», «скачать», выгрузки", () => {
    for (const doc of docs) for (const lang of LANGS) expect(fullText(doc, lang).match(BACKUP), `${doc.id}.${lang}`).toBeNull();
    // «копировать» (об авторских правах) — другое слово и не ловится.
    expect(BACKUP.test("копировать, перепродавать")).toBe(false);
    expect(BACKUP.test("Сохрани копию данных")).toBe(true);
    expect(BACKUP.test("Скачать мои данные")).toBe(true);
  });

  it("политика: что хранится на устройстве и как удалить — по существу, обобщённо", () => {
    const privacy = LEGAL.privacy;
    const ru = fullText(privacy, "ru");
    const kk = fullText(privacy, "kk");
    expect(ru).toContain("в памяти браузера на твоём устройстве");
    expect(kk).toContain("құрылғыңдағы браузер жадында");
    // Что уходит ИИ о ученике: ключевые позиции.
    expect(ru).toMatch(/имя, класс, цель/);
    expect(kk).toMatch(/аты, сыныбы, мақсаты/);
    // Запись голоса — тот же предел, что в коде (lib/voice.ts).
    expect(ru).toContain(`до ${MAX_RECORD_SEC} секунд`);
    expect(kk).toContain(`${MAX_RECORD_SEC} секундқа дейін`);
    // Технический cookie со случайным номером устройства, срок — 400 дней.
    expect(ru).toContain("технический файл cookie со случайным номером устройства");
    expect(ru).toContain("до 400 дней");
    expect(kk).toContain("кездейсоқ құрылғы нөмірі бар техникалық cookie-файл");
    expect(kk).toContain("400 күнге дейін");
    // Путь к удалению — названия из словаря интерфейса; очистка данных сайта в браузере.
    for (const lang of LANGS) {
      expect(section(privacy, "Как удалить данные", lang)).toContain(`${dict["nav.profile"][lang]} → ${dict["prof.reset"][lang]}`);
    }
    expect(section(privacy, "Как удалить данные", "ru")).toContain("очисти данные сайта в настройках браузера");
    expect(section(privacy, "Как удалить данные", "kk")).toContain("сайт деректерін тазала");
  });

  it("сообщения и отчёты об ошибках: пределы — как в коде (lib/issue.ts), срок хранения — 30 дней", () => {
    const items = (lang: Lang) => {
      const list = section(LEGAL.privacy, "Что хранится у нас на сервере", lang)
        .split("\n")
        .filter((l) => l.startsWith("- "));
      return {
        report: list.find((l) => l.includes(dict["issue.button"][lang])) ?? "",
        crash: list.find((l) => l.startsWith(lang === "ru" ? "- **Автоматические отчёты о сбоях" : "- **Ақаулар туралы автоматты есептер")) ?? "",
      };
    };
    for (const lang of LANGS) {
      const { report, crash } = items(lang);
      expect(report, lang).toBeTruthy();
      expect(crash, lang).toBeTruthy();
      // Сообщение: комментарий, фрагмент (числа — из кода) и срок хранения. Число хранимых сообщений (ISSUE_CHANNELS.max) не называем.
      for (const n of [ISSUE_LIMITS.comment, ISSUE_LIMITS.snippet, 30]) expect(report, `${lang}: ${n}`).toContain(String(n));
      // Отчёт о сбое: текст ошибки и технические подробности.
      for (const n of [ISSUE_LIMITS.message, ISSUE_LIMITS.stack]) expect(crash, `${lang}: ${n}`).toContain(String(n));
    }
    // Страницы и браузера в сообщении об ошибке нет (в отчёте о сбое страница без параметров и сведения о браузере есть).
    expect(items("ru").report).toContain("страницы и браузера в сообщении нет");
    expect(items("ru").crash).toContain("без параметров");
    expect(items("ru").crash).toContain("но в тексте ошибки может оказаться фрагмент страницы");
    // Старое обещание «храним, пока разбираем» убрано.
    expect(fullText(LEGAL.privacy, "ru")).not.toContain("пока разбираем");
    expect(fullText(LEGAL.privacy, "kk")).not.toContain("талдап жатқанымызда");
  });

  it("«Коротко»: ИИ получает сведения о тебе, есть автоматические отчёты о сбоях", () => {
    const brief = LEGAL.privacy.sections[0].body;
    expect(brief.ru).toContain("имя, класс, слабые темы и начало твоих заметок");
    expect(brief.ru).toContain("внешний сервис искусственного интеллекта");
    expect(brief.ru).toContain("автоматические отчёты");
    expect(brief.kk).toContain("аты, сыныбы, әлсіз тақырыптары және өз жазбаларыңның басы");
    expect(brief.kk).toContain("жасанды интеллекттің сыртқы қызметі");
    expect(brief.kk).toContain("автоматты есептер");
    // Старая формулировка «на сервер уходит немногое: … и сообщения об ошибках» убрана.
    expect(brief.ru).not.toContain("На сервер уходит немногое");
  });

  it("«Дуэли и друзья»: сроки хранения, кто видит имя, бот остаётся на устройстве, путь удаления — как в интерфейсе", () => {
    const duels = (lang: Lang) => section(LEGAL.privacy, "Дуэли и друзья", lang);
    // Раздел стоит сразу после «Что хранится у нас на сервере».
    const titles = LEGAL.privacy.sections.map((s) => s.title.ru);
    expect(titles.indexOf("Дуэли и друзья")).toBe(titles.indexOf("Что хранится у нас на сервере") + 1);
    for (const lang of LANGS) {
      const text = duels(lang);
      expect(text, lang).toBeTruthy();
      // Сроки — как в коде серверной части соревнований.
      for (const n of ["400", "180", "14", "7", "30", "15"]) expect(text, `${lang}: ${n}`).toContain(n);
      // Путь удаления — названия из словаря интерфейса.
      expect(text, lang).toContain(`«${dict["duel.title"][lang]} → ${dict["social.friends.title"][lang]} → ${dict["social.delete"][lang]}»`);
      // Переключатель топа — как в интерфейсе.
      expect(text, lang).toContain(`«${dict["social.ft"][lang]}»`);
      // Бот: матчи остаются на устройстве, метка «бот» — как в интерфейсе.
      expect(text, lang).toContain(`«${dict["duel.bot.chip"][lang]}»`);
      expect(text, lang).toContain(`«${dict["duel.bot.name"][lang]}»`);
      // «Как удалить данные» и «Коротко» тоже говорят о соревнованиях.
      expect(section(LEGAL.privacy, "Как удалить данные", lang), lang).toContain(dict["social.delete"][lang]);
      expect(LEGAL.privacy.sections[0].body[lang], lang).toContain(lang === "ru" ? "Дуэли с людьми" : "Адамдармен жекпе-жек");
      // Условия: правила честной игры и жалоб, цена матча — 1 сердечко.
      expect(fullText(LEGAL.terms, lang), lang).toContain(lang === "ru" ? "В дуэлях играй честно" : "Жекпе-жекте адал ойна");
      expect(section(LEGAL.terms, "Бесплатно, тарифы и чипы", lang), lang).toContain(lang === "ru" ? "стоят 1 сердечко" : "1 жүрек тұрады");
    }
    expect(duels("ru")).toContain("Матчи против бота «Бит» остаются на твоём устройстве, а бот всегда помечен словом «бот»");
    expect(duels("kk")).toContain("«Бит» ботымен өтетін матчтар құрылғыңда қалады, ал бот әрқашан «бот» деп белгіленеді");
    // Имя по профилю найти нельзя — только по коду друга.
    expect(section(LEGAL.privacy, "Как удалить данные", "ru")).toContain("по имени из профиля соревнований найти тебя нельзя");
    expect(section(LEGAL.privacy, "Как удалить данные", "kk")).toContain("сайыс профиліндегі ат бойынша сені табу мүмкін емес");
  });

  it("фото: проверка в уроке — без сведений об ученике, фото в чате — со сведениями", () => {
    for (const lang of LANGS) {
      const ai = section(LEGAL.privacy, "Что уходит при обращении к ИИ", lang);
      const list = ai.split("\n").filter((l) => l.startsWith("- "));
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

  it("кнопки ИИ названы как в интерфейсе: «Спросить Бита», «Сообщить об ошибке»; «Разбора от Бита» и «памяти наставника» нет (#123)", () => {
    for (const lang of LANGS) {
      const ai = section(LEGAL.privacy, "Что уходит при обращении к ИИ", lang);
      expect(ai, lang).toContain(`«${dict["ai.askBit"][lang]}»`);
      for (const doc of docs) {
        expect(fullText(doc, lang), doc.id).not.toMatch(lang === "ru" ? /Разбор от Бита|память наставника/i : /Биттің талдауы|тәлімгер жазбалары/i);
      }
      expect(fullText(LEGAL.privacy, lang)).toContain(`«${dict["issue.button"][lang]}»`);
    }
  });

  it("голос: аудиозапись уходит на расшифровку, у нас не хранится", () => {
    const voice = (lang: Lang) =>
      section(LEGAL.privacy, "Что уходит при обращении к ИИ", lang)
        .split("\n")
        .find((l) => l.startsWith(`- **${lang === "ru" ? "Голос" : "Дауыс"}`)) ?? "";
    expect(voice("ru")).toContain("аудиозапись целиком");
    expect(voice("ru")).toContain("уходит на расшифровку в сервис ИИ");
    expect(voice("ru")).toContain("Аудио мы не храним");
    expect(voice("kk")).toContain("ЖИ қызметіне жіберіледі");
    expect(voice("kk")).toContain("Аудионы біз сақтамаймыз");
  });

  it("подрядчики — обобщённо, но правдиво: по нашему поручению, часть за пределами Казахстана", () => {
    const sent = (lang: Lang) => section(LEGAL.privacy, "Что уходит при обращении к ИИ", lang);
    expect(sent("ru")).toContain("внешний подрядчик");
    expect(sent("ru")).toContain("по нашему поручению и только для ответа на запрос");
    expect(sent("ru")).toContain("за пределами Казахстана");
    expect(sent("kk")).toContain("біздің тапсырмамыз бойынша");
    expect(sent("kk")).toContain("Қазақстаннан тыс жерде");

    const ru = section(LEGAL.privacy, "Кто ещё участвует", "ru");
    const kk = section(LEGAL.privacy, "Кто ещё участвует", "kk");
    expect(ru).toContain("внешних подрядчиков");
    for (const part of ["облачный хостинг", "облачное хранилище", "сервис искусственного интеллекта", "сервис раздачи файлов"]) expect(ru, part).toContain(part);
    expect(kk).toContain("сыртқы мердігерлердің");
    for (const part of ["бұлтты хостинг", "бұлтты қойма", "жасанды интеллект қызметі", "файл тарату қызметі"]) expect(kk, part).toContain(part);
    expect(ru).toContain("по нашему поручению");
    expect(ru).toContain("за пределами Казахстана");
    expect(ru).toContain("Рекламных и аналитических сервисов среди них нет");
    expect(kk).toContain("Қазақстаннан тыс жерде");
    // Практикум: инструменты загружаются при первом запуске, код выполняется на устройстве.
    expect(ru).toContain("в первый раз запускаешь практикум");
    expect(ru).toContain("код выполняется у тебя на устройстве");
    expect(kk).toContain("код құрылғыңда орындалады");
    // И это правда: движки практикума и вправду берутся по внешнему адресу.
    expect(readFileSync(join(root, "public/ide/python-worker.js"), "utf8")).toMatch(/https:\/\//);
    expect(readFileSync(join(root, "src/lib/ide/sql/db.ts"), "utf8")).toMatch(/https:\/\//);
  });

  it("число обращений к ИИ — словами владельца: до 65 на любом тарифе, готовые подсказки и разборы — без ограничений", () => {
    const ru = section(LEGAL.terms, "Бесплатно, тарифы и чипы", "ru");
    const kk = section(LEGAL.terms, "Бесплатно, тарифы и чипы", "kk");
    expect(ru).toContain("Число обращений к ИИ в день ограничено — до 65 на любом тарифе; готовые подсказки и разборы — без ограничений.");
    expect(kk).toContain("ЖИ-ге күніне жүгіну саны шектелген — кез келген тарифте ең көбі 65 жүгіну; дайын кеңестер мен талдаулар шектеусіз.");
    // Вес обращений — как в коде (AI_UNITS): фото дороже обычного вопроса, голос — ещё дороже.
    // Голосовой вопрос = распознавание (voice) + ответ в чате (chat).
    const voiceTotal = AI_UNITS.voice + AI_UNITS.chat;
    expect(ru).toContain(`считается за ${AI_UNITS.photo} обращения, голосовой вопрос — за ${voiceTotal} (${AI_UNITS.voice} — распознавание голоса и ${AI_UNITS.chat} — ответ)`);
    expect(kk).toContain(`${AI_UNITS.photo} жүгіну, дауыспен қойылған сұрақ ${voiceTotal} жүгіну (${AI_UNITS.voice} — дауысты тану, ${AI_UNITS.chat} — жауап)`);
    // Каждый ответ — одно обращение (#118), голос — как сообщение в чате.
    expect(ru).toContain("Каждый ответ Бита — одно обращение");
    expect(ru).toContain("распознавание голоса бесплатные обращения и чипы не тратит");
    expect(kk).toContain("Биттің әр жауабы — бір жүгіну");
    expect(kk).toContain("дауысты тану тегін жүгінулер мен чиптерді жұмсамайды");
    // Своих потолков у тарифов в документах нет, ИИ «без ограничений» не обещаем.
    for (const doc of docs) {
      expect(fullText(doc, "ru"), doc.id).not.toMatch(/до (?:50|100)\b|неограниченн|безгранично|без лимита/i);
      expect(fullText(doc, "kk"), doc.id).not.toMatch(/лимитсіз|шексіз ЖИ/i);
    }
  });

  it("ИИ отвечает по запросу, кроме короткого отзыва после урока", () => {
    expect(fullText(LEGAL.privacy, "ru")).toContain("кроме короткого автоматического отзыва после урока и тренировки");
    expect(fullText(LEGAL.privacy, "kk")).toContain("Сабақ пен жаттығудан кейінгі қысқа автоматты пікірді қоспағанда");
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

  it("сохранность прогресса: хранится на устройстве и пропадёт при очистке данных сайта", () => {
    const beta = (lang: Lang) => section(LEGAL.terms, "Бета и сохранность прогресса", lang);
    expect(beta("ru")).toContain("Прогресс хранится на твоём устройстве");
    expect(beta("ru")).toContain("он пропадёт");
    expect(beta("kk")).toContain("Прогресс сенің құрылғыңда сақталады");
    expect(beta("kk")).toContain("ол жоғалады");
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
  it("у каждого ключа legal.* есть ru и kk, эмодзи нет, кризисных текстов, «Кто мы» и «черновика» здесь нет", () => {
    const keys = Object.keys(legalDict);
    expect(keys.length).toBeGreaterThan(10);
    for (const [key, v] of Object.entries(legalDict)) {
      expect(key.startsWith("legal."), key).toBe(true);
      expect(key.startsWith("legal.crisis."), key).toBe(false);
      expect(key, key).not.toMatch(/about|draft/);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
      expect(EMOJI.test(v.ru + v.kk), key).toBe(false);
      expect(ENT_WORD.test(v.kk), key).toBe(false);
      expect(STACK.test(v.ru + v.kk), key).toBe(false);
      expect(v.ru + v.kk, key).not.toMatch(/Кто мы|Біз кімбіз/);
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

  it("у каждого документа есть заголовок страницы и название в ссылках", () => {
    for (const id of LEGAL_IDS) {
      expect(legalDict[`legal.title.${id}`].ru, id).toBeTruthy();
      expect(legalDict[`legal.nav.${id}`].kk, id).toBeTruthy();
    }
    expect(legalDict["legal.title.privacy"].ru).toBe("Политика конфиденциальности");
    expect(legalDict["legal.title.terms"].ru).toBe("Условия использования");
  });
});

describe("публичные страницы", () => {
  it("/privacy, /terms открываются без онбординга", () => {
    for (const p of ["/privacy", "/terms", "/onboarding"]) expect(isPublicPath(p), p).toBe(true);
  });

  it("/about убрана: страницы нет, путь не публичный", () => {
    expect(isPublicPath("/about")).toBe(false);
    expect(isPublicPath("/about/")).toBe(false);
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
