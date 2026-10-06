import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AI_DAILY_CAP, AI_UNITS, HOUR, MINUTE, PLAN_FEATURES, yearSaving } from "@/lib/economy";
import { dict } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import { translate } from "@/i18n/useT";
import { AiLimitNote } from "@/components/plans/AiLimitNote";
import { aiLimitParams, closeAction, compareRows, formatHours, formatMult, formatNumber, parseFrom, planWhat, subtitleKey, yearDiscountPercent } from "@/components/plans/plans-helpers";

describe("parseFrom / closeAction", () => {
  it("принимает только известные источники", () => {
    expect(parseFrom("onboarding")).toBe("onboarding");
    expect(parseFrom("hearts")).toBe("hearts");
    expect(parseFrom("evil")).toBeUndefined();
    expect(parseFrom(null)).toBeUndefined();
  });
  it("онбординг и автопоказ закрываются на карту, остальные — назад", () => {
    expect(closeAction("onboarding", 5)).toBe("learn");
    expect(closeAction("auto", 5)).toBe("learn");
    expect(closeAction("shop", 5)).toBe("back");
    expect(closeAction("profile", 2)).toBe("back");
  });
  it("без истории — на карту", () => {
    expect(closeAction("shop", 1)).toBe("learn");
    expect(closeAction(undefined, 1)).toBe("learn");
    expect(closeAction(undefined, 3)).toBe("back");
  });
  it("подзаголовок зависит от источника", () => {
    expect(subtitleKey("hearts")).toBe("plans.sub.hearts");
    expect(subtitleKey("ai")).toBe("plans.sub.ai");
    expect(subtitleKey("chips")).toBe("plans.sub.chips");
    expect(parseFrom("chips")).toBe("chips");
    expect(subtitleKey("shop")).toBe("plans.sub.default");
  });
});

describe("форматирование", () => {
  it("множитель и часы с десятичной запятой", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatMult(2)).toBe("×2");
    expect(formatMult(1.5)).toBe("×1,5");
    expect(formatHours(2 * 3_600_000, "ru")).toBe("2 ч");
    expect(formatHours(4 * 3_600_000, "kk")).toBe("4 сағ");
  });
  it("часы: 150 минут — «2,5 ч» / «2,5 сағ», 5 часов — «5 ч»", () => {
    expect(formatHours(150 * MINUTE, "ru")).toBe("2,5 ч");
    expect(formatHours(150 * MINUTE, "kk")).toBe("2,5 сағ");
    expect(formatHours(5 * HOUR, "ru")).toBe("5 ч");
    expect(formatHours(5 * HOUR, "kk")).toBe("5 сағ");
  });
  it("подпись товара для шторки", () => {
    expect(planWhat("Безлимит", "19 990 ₸", "год")).toBe("Безлимит · 19 990 ₸ / год");
  });
  it("скидка за год — наименьшая из двух (честная для обоих тарифов)", () => {
    expect(yearDiscountPercent()).toBe(Math.min(yearSaving("lite").percent, yearSaving("unlimited").percent));
    expect(yearDiscountPercent()).toBeGreaterThanOrEqual(35);
  });
});

describe("compareRows", () => {
  const rows = compareRows("ru");
  const byId = (id: string) => rows.find((r) => r.id === id)!;
  it("сердечки 5 / 10 / ∞", () => {
    expect(["free", "lite", "unlimited"].map((t) => byId("hearts").cells[t as "free"])).toEqual([
      { kind: "text", text: String(PLAN_FEATURES.free.maxHearts) },
      { kind: "text", text: String(PLAN_FEATURES.lite.maxHearts) },
      { kind: "text", text: "∞" },
    ]);
  });
  it("возврат сердечка: 6 ч / 3 ч / прочерк", () => {
    expect(byId("regen").cells.free).toEqual({ kind: "text", text: "6 ч" });
    expect(byId("regen").cells.lite).toEqual({ kind: "text", text: "3 ч" });
    expect(byId("regen").cells.unlimited).toEqual({ kind: "dash" });
  });
  it("возврат сердечка по-казахски: 6 сағ / 3 сағ", () => {
    const kk = compareRows("kk").find((r) => r.id === "regen")!;
    expect(kk.cells.free).toEqual({ kind: "text", text: "6 сағ" });
    expect(kk.cells.lite).toEqual({ kind: "text", text: "3 сағ" });
  });
  it("ИИ: 3 всего / 30 в день / ∞ (#99; потолок 65 в таблице не пишем — он в кнопке «Ограничения ИИ») и множитель ×1 / ×1,5 / ×2", () => {
    expect(byId("ai").cells.free).toEqual({ kind: "text", text: "3 всего" });
    expect(byId("ai").cells.lite).toEqual({ kind: "text", text: "30 в день" });
    expect(byId("ai").cells.unlimited).toEqual({ kind: "text", text: "∞" });
    expect(byId("chips").cells.lite).toEqual({ kind: "text", text: "×1,5" });
    expect(byId("chips").cells.unlimited).toEqual({ kind: "text", text: "×2" });
  });
  it("уроки, тренировки, ЕНТ и история — везде", () => {
    for (const id of ["access", "history"]) for (const tier of ["free", "lite", "unlimited"] as const) expect(byId(id).cells[tier]).toEqual({ kind: "check" });
  });
});

describe("тексты тарифов без суточного пополнения", () => {
  const forbidden = /в день|каждый день|күніне жүрек|Күн сайын/;

  it("пункты про сердечки не обещают «в день»", () => {
    for (const key of ["plans.perk.lite.hearts", "plans.cmp.hearts"] as const) {
      expect(dict[key].ru, key).not.toMatch(forbidden);
      expect(dict[key].kk, key).not.toMatch(forbidden);
    }
    expect(dict["plans.perk.lite.hearts"].ru).toBe("{n} сердечек, новое каждые {time}");
    expect(dict["plans.cmp.hearts"].ru).toBe("Запас сердечек");
  });

  it("карточка профиля: запас, время возврата и бесплатный ИИ один раз (#99)", () => {
    const f = dict["plans.profile.freeText"];
    expect(f.ru).toBe("{hearts} сердечек, новое каждые {time}; ИИ бесплатно: {ai} всего");
    for (const p of ["{hearts}", "{time}", "{ai}"]) {
      expect(f.ru).toContain(p);
      expect(f.kk).toContain(p);
    }
  });

  it("у сердечек в магазине и в окне «закончились» нет обещания полного запаса каждый день", () => {
    for (const key of ["econ16c.hearts.hint", "econ16c.out.text"] as const) {
      expect(dict[key].ru, key).not.toMatch(/Каждый день|каждый день|снова полный/);
      expect(dict[key].kk, key).not.toMatch(/Күн сайын/);
    }
    expect(dict["econ16c.hearts.hint"].ru).toContain("{time}");
    expect(dict["econ16c.hearts.hint"].kk).toContain("{time}");
  });
});

describe("тексты тарифов про ИИ: прежний вид, без «до N обращений» (правка v0.9.1)", () => {
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  /** Ключи, чьи тексты 5ab0bf2 заменил на «до N обращений в день»; теперь они снова как до него. */
  const RESTORED = {
    "plans.sub.ai": ["Спрашивай ИИ-помощника сколько нужно — без лимита и без чипов.", "ЖИ-көмекшіден қанша керек болса, сонша сұра — лимитсіз, чипсіз."],
    "plans.perk.unl.ai": ["ИИ-помощник без ограничений", "ЖИ-көмекші шектеусіз"],
    "plans.cmp.ai": ["Бесплатный ИИ-помощник", "Тегін ЖИ-көмекші"],
    "plans.cmp.note": ["Сверх лимита ИИ — за чипы. Проверка решения по фото входит в лимит ИИ.", "ЖИ лимитінен тыс сұраулар чиппен төленеді. Шешімді фото арқылы тексеру ЖИ лимитіне кіреді."],
    "plans.card.unlimitedTag": ["Всё без ограничений", "Бәрі шектеусіз"],
    "shop.plan.freeTitle": ["Безлимит: ИИ и уроки без ограничений", "Шексіз: ЖИ мен сабақтар шектеусіз"],
    // Этап 11 (#40): сердечки — плата за вход в урок, тест или игру (с этапа 16В и тренировку, #111); ИИ — как в v0.9.1, без числа.
    "shop.plan.freeText": ["Уроки, тренировки, тесты и игры без сердечек, чипы ×2, ИИ-помощник без лимита.", "Сабаққа, жаттығуға, тестке және ойынға жүрек жұмсалмайды, чиптер ×2, ЖИ-көмекшіге лимит жоқ."],
    "shop.ai.unlimited": ["Без ограничений", "Шектеусіз"],
    "hearts.out.unlimitedDesc": ["И ИИ-помощник без ограничений", "ЖИ-көмекші де шектеусіз"],
    "aicost.aria.unlimited": ["Без ограничений", "Шектеусіз"],
    "aicost.need.earn": [
      "Чипы дают за уроки, цель дня и достижения. Или возьми Безлимит — ИИ без ограничений.",
      "Чиптер сабақ, күндік мақсат және жетістік үшін беріледі. Немесе «Шексіз» тарифін ал — ЖИ шектеусіз.",
    ],
  } as const;

  it("тексты тарифов — как до 5ab0bf2: «Безлимит» выглядит как безлимит", () => {
    for (const [k, [ru, kk]] of Object.entries(RESTORED)) {
      const d = dict[k as keyof typeof RESTORED];
      expect(d.ru, k).toBe(ru);
      expect(d.kk, k).toBe(kk);
    }
  });

  it("ни в одном из них нет «до N обращений» и параметров потолка ({cap}, {free}, {lite}, {photo}, {voice}); параметров нет (курса XP → чипы больше нет, #105)", () => {
    for (const k of Object.keys(RESTORED)) {
      const d = dict[k as keyof typeof RESTORED];
      for (const text of [d.ru, d.kk]) {
        expect(text, k).not.toMatch(/до\s+(\{n\}|\d+)\s+обращений|(\{n\}|\d+)\s+сұрауға дейін/);
        expect(text, k).not.toMatch(/\b(65|100|50|13)\b/);
      }
      expect(ph(d.ru), k).toEqual([]);
      expect(ph(d.kk), k).toEqual(ph(d.ru));
    }
  });

  it("«Лайт»: «{n} обращений в день» из PLAN_FEATURES — число бесплатных по тарифу, не потолок", () => {
    expect(dict["plans.perk.lite.ai"].ru).toBe("ИИ-помощник: {n} обращений в день");
    expect(PLAN_FEATURES.lite.aiFree).toBe(30);
  });
});

describe("кнопка «Ограничения ИИ» внизу окна тарифов (правка v0.9.1)", () => {
  const forbiddenDigits = /\d/;

  it("параметры — потолок из AI_DAILY_CAP (65, один на все тарифы) и веса фото, голоса и «Разбора от Бита» из AI_UNITS", () => {
    expect(AI_DAILY_CAP).toEqual({ free: 65, lite: 65, unlimited: 65 });
    expect(aiLimitParams()).toEqual({ n: 65, photo: AI_UNITS.photo, voice: AI_UNITS.voice });
    expect([AI_UNITS.photo, AI_UNITS.voice]).toEqual([2, 4]);
  });

  it("в словаре чисел нет: n, photo, voice — только параметры (ru и kk)", () => {
    for (const k of ["plans.limit.btn", "plans.limit.text"] as const) {
      for (const lang of ["ru", "kk"] as const) expect(dict[k][lang], `${k}.${lang}`).not.toMatch(forbiddenDigits);
    }
    for (const lang of ["ru", "kk"] as const) expect(ph(dict["plans.limit.text"][lang])).toEqual(["n", "photo", "voice"]);
    expect(ph(dict["plans.limit.btn"].ru)).toEqual([]);
    expect(ph(dict["plans.limit.btn"].kk)).toEqual([]);
  });

  function ph(s: string) {
    return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  }

  it("подставленный текст: до 65 раз в день на любом тарифе, фото — 2, расшифровка голоса — 4, готовые подсказки без ограничений; «Разбора от Бита» нет (#123)", () => {
    const ru = fmt(dict["plans.limit.text"].ru, aiLimitParams());
    expect(ru).toBe("Чтобы Бит быстро отвечал всем, на любом тарифе ИИ отвечает до 65 раз в день. Фото считается за 2 обращения, расшифровка голосового вопроса — за 4. Готовые подсказки и объяснения в заданиях — без ограничений.");
    expect(ru).not.toContain("Разбор от Бита");
    const kk = fmt(dict["plans.limit.text"].kk, aiLimitParams());
    expect(kk).toContain("65 реттен");
    expect(kk).toContain("Фото — 2 сұрау");
    expect(kk).toContain("мәтінге айналдыру — 4 сұрау");
    expect(kk).not.toContain("Биттің талдауы");
    expect(kk).not.toContain("{");
  });

  it("без глаголов с родом и без эмодзи, ҰБТ/ЕНТ не упоминаются", () => {
    for (const k of ["plans.limit.btn", "plans.limit.text"] as const) {
      for (const lang of ["ru", "kk"] as const) {
        const text = dict[k][lang];
        expect(text, k).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text, k).not.toMatch(/[Бб]ыл[аи]?\b|[Сс]делал|[Пп]олучил/);
        expect(text, k).not.toMatch(/ЕНТ/);
      }
    }
  });

  it("кнопка: по умолчанию закрыта (aria-expanded=false), текст с 65 лежит в скрытом абзаце; есть иконка и касание ≥ 44px", () => {
    const html = renderToStaticMarkup(createElement(AiLimitNote));
    expect(html).toContain("Ограничения ИИ");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/aria-controls="[^"]+"/);
    expect(html).toMatch(/<p[^>]*\bhidden(="")?[^>]*>[^<]*до 65 раз в день/);
    expect(html).toContain("min-h-11");
    expect(html).toContain("text-muted");
    expect(html).toContain("<svg");
  });

  it("кнопка по-казахски: подпись и текст с 65 (translate — тот же путь, что у useT)", () => {
    expect(translate("kk", "plans.limit.btn")).toBe("ЖИ шектеулері");
    expect(translate("kk", "plans.limit.text", aiLimitParams())).toContain("күніне 65 реттен артық");
  });

  it("окно тарифов показывает кнопку внизу — в подвале, после «Продолжить бесплатно»", () => {
    const src = readFileSync("src/components/plans/PlansScreen.tsx", "utf8");
    const footer = src.slice(src.indexOf("<footer"), src.indexOf("</footer>"));
    expect(footer).toContain("<AiLimitNote />");
    expect(footer.indexOf("<AiLimitNote />")).toBeGreaterThan(footer.indexOf('t("plans.foot.free")'));
    // таблица сравнения и карточки — выше подвала
    expect(src.indexOf("<CompareTable />")).toBeLessThan(src.indexOf("<footer"));
  });
});
