import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkNameFormat, cleanName, graphemeCount, type NameFail } from "@/lib/moderation/name-format";
import { hasSkeletonWord, skeleton, skeletonSet } from "@/lib/moderation/skeleton";

const NAMES = readFileSync(join(__dirname, "fixtures/names-ok.txt"), "utf8")
  .split("\n")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("#"));

const code = (raw: string): NameFail | "ok" => {
  const r = checkNameFormat(raw);
  return r.ok ? "ok" : r.code;
};

describe("обычные имена проходят", () => {
  it(`${NAMES.length} казахских, русских и латинских имён — без ложных срабатываний`, () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(200);
    const failed = NAMES.filter((n) => !checkNameFormat(n).ok).map((n) => `${n}: ${code(n)}`);
    expect(failed).toEqual([]);
  });

  it("имя чистится: NFC, пробелы, дефис", () => {
    expect(cleanName("  Анна   -  Мария ")).toBe("Анна-Мария");
    expect(checkNameFormat("  Ерлан   Т ")).toEqual({ ok: true, name: "Ерлан Т" });
    // «й», набранная как «и» + знак краткости, склеивается в одну букву.
    expect(checkNameFormat("Ий").ok).toBe(true);
    expect(graphemeCount("Әсем")).toBe(4);
  });
});

describe("формат", () => {
  it("длина 2–16 графем и хотя бы 2 буквы", () => {
    expect(code("А")).toBe("short");
    expect(code("")).toBe("short");
    expect(code("   ")).toBe("short");
    expect(code("А1")).toBe("short");
    expect(code("Аб")).toBe("ok");
    expect(code("Абвгдеёжзиклмноп")).toBe("ok"); // 16
    expect(code("Абвгдеёжзиклмнопр")).toBe("long"); // 17
    expect(code("x".repeat(500))).toBe("long");
    expect(code(42 as unknown as string)).toBe("short");
  });

  it("только буквы ru/kk/en, цифры, пробел и дефис", () => {
    for (const bad of ["Ерлан!", "Ерлан_07", "Ер.лан", "Ерлан😀", "Ерлан​", "Ер‮лан", "-Ерлан", "Ерлан-", "Ер--лан", "Ерлан'", "Zoë", "Ерлан#1", "Ерлан/1"]) {
      expect(code(bad), bad).toBe("chars");
    }
  });

  it("не больше 4 цифр", () => {
    expect(code("Ерлан 2009")).toBe("ok");
    expect(code("Ерлан 20091")).toBe("digits");
    expect(code("Ер1ан 2009")).toBe("digits");
  });

  it("одна письменность в слове: латинская «a» в «Сaша» — подмена", () => {
    expect(code("Сaша")).toBe("script_mix"); // латинская a
    expect(code("Saшa")).toBe("script_mix");
    expect(code("Саша Ivanov")).toBe("ok"); // разные слова — можно
  });

  it("контакты: ссылки, телефоны, ники мессенджеров", () => {
    for (const bad of ["+7 701 123 45 67", "87011234567", "8 701 123 45 67", "@erlan", "erlan.kz", "t.me erlan", "www erlan", "http erlan", "Ерлан тг", "Ерлан inst", "Инста Ерлан", "Ерлан вк", "Ерлан whatsapp", "T me Erlan", "Ерлан номер", "Ерлан kz"]) {
      expect(code(bad), bad).toBe("contact");
    }
  });

  it("зарезервированные слова — по скелету: бот, бит, админ, поддержка, «Игрок 4821»", () => {
    for (const bad of ["Бот", "бот", "БОТ", "Б0т", "6от", "Bot", "B0T", "b o t", "Б о т", "Бооот", "Бит", "Bit", "Админ", "Admin", "Поддержка", "Support", "Модератор", "Игрок 4821", "Игрок4821", "Ойыншы 12", "Player 7", "Информатика", "Әкімші", "Мұғалім", "Бит Бот"]) {
      expect(code(bad), bad).toBe("reserved");
    }
    // Похожие, но обычные имена.
    for (const ok of ["Ботагөз", "Бота", "Вит", "Битимбай", "Игорь", "Ботай Ерлан"]) expect(code(ok), ok).toBe("ok");
  });
});

describe("скелет", () => {
  it("l33t, двойники, разделители, невидимые знаки, повторы, казахские буквы", () => {
    expect(skeleton("Б0т").squashed).toBe("бот");
    expect(skeleton("6ot").cyr.squashed).toBe("бот");
    expect(skeleton("b.o.t").lat.squashed).toBe("bot");
    expect(skeleton("б​о­т").squashed).toBe("бот");
    expect(skeleton("б-о-т").words).toEqual(["б", "о", "т"]);
    expect(skeleton("бооот").cyrDedup.squashed).toBe("бот");
    expect(skeleton("Қайрат").squashed).toBe("каират");
    expect(skeleton("Ёлка").squashed).toBe("елка");
    expect(skeleton("ＢＯＴ").lat.squashed).toBe("bot"); // полноширинные
    expect(skeleton("$up").lat.squashed).toBe("sup");
  });

  it("набор корней совпадает словом целиком или всей строкой без разделителей", () => {
    const set = skeletonSet(["поддержка"], "cyr");
    expect(set.has("подержка")).toBe(true); // форма без повторов
    expect(hasSkeletonWord(skeleton("п о д д е р ж к а"), set, "cyr")).toBe(true);
    expect(hasSkeletonWord(skeleton("подддержка"), set, "cyr")).toBe(true);
    expect(hasSkeletonWord(skeleton("поддержками"), set, "cyr")).toBe(false);
  });
});
