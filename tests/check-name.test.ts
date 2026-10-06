import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkName, checkNameFormat, hasBlockedStem } = await import("@/server/moderation/check-name");
const { BLOCKLIST } = await import("@/server/moderation/blocklist");
const { skeleton } = await import("@/server/moderation/skeleton");

// Обычные имена учеников: ни одного ложного срабатывания (docs/specs/duels.md §11).
const KAZAKH = [
  "Әсем", "Іңкәр", "Ұлжан", "Нұрасыл", "Шыңғыс", "Бөкей", "Хусаин", "Дәурен", "Құдайберген", "Сүйінбике", "Еркеұлан", "Айгерім",
  "Айдана", "Ақбота", "Аружан", "Әлихан", "Ернұр", "Жансая", "Мадина", "Нұрсұлтан", "Санжар", "Тоғжан", "Ерасыл", "Бекзат",
  "Дамир", "Асель", "Алия", "Камила", "Аслан", "Арман", "Бауыржан", "Ғалым", "Қуаныш", "Мұхтар", "Абай", "Абылай", "Ақжол",
  "Әйгерім", "Балжан", "Гүлназ", "Гүлжан", "Дана", "Даяна", "Динара", "Жанар", "Жұлдыз", "Зарина", "Индира", "Қарлығаш",
  "Ләззат", "Мөлдір", "Назерке", "Назира", "Нұргүл", "Сабина", "Салтанат", "Сәуле", "Томирис", "Ұлпан", "Шұғыла", "Айсұлу",
  "Аяжан", "Ботагөз", "Еңлік", "Жібек", "Кәусар", "Меруерт", "Аңсар", "Азамат", "Айбек", "Алмас", "Асқар", "Асылбек",
  "Бақытжан", "Бексұлтан", "Ғабит", "Дархан", "Ержан", "Ерлан", "Есенгелді", "Жандос", "Жәнібек", "Қайрат", "Қанат", "Мағжан",
  "Мейіржан", "Мирас", "Нұрлан", "Олжас", "Рахат", "Сағат", "Серік", "Сұлтан", "Талғат", "Темірлан", "Төлеген", "Ұлан",
  "Хамит", "Хасен", "Хадиша", "Шерхан", "Ілияс", "Әділет", "Әлібек", "Сексенбай", "Хуршид", "Хұсайын", "Мұхаммед", "Ахмет",
  "Ебейсін", "Бекарыс", "Ернар", "Нұржан", "Тимур", "Алихан", "Аян", "Әмір", "Бексейіт", "Сүндет", "Қасым", "Жасұлан",
];

const RUSSIAN = [
  "Александр", "Алексей", "Анастасия", "Анна", "Арина", "Артём", "Богдан", "Вадим", "Валерия", "Варвара", "Василиса", "Вера",
  "Виктор", "Виктория", "Владимир", "Глеб", "Григорий", "Даниил", "Дарья", "Денис", "Дмитрий", "Евгений", "Екатерина", "Елена",
  "Елизавета", "Есения", "Захар", "Злата", "Иван", "Игорь", "Илья", "Кирилл", "Константин", "Ксения", "Лев", "Леонид",
  "Любовь", "Маргарита", "Марк", "Марина", "Мария", "Матвей", "Михаил", "Надежда", "Никита", "Николай", "Олег", "Ольга",
  "Павел", "Полина", "Роман", "Савелий", "Святослав", "Семён", "Сергей", "Софья", "Станислав", "Степан", "Тимофей", "Ульяна",
  "Фёдор", "Юлия", "Юрий", "Ярослав", "Яна", "Эвелина", "Эмилия", "Таисия", "Мирослава", "Всеволод",
];

const LATIN_AND_FULL = [
  "Assel", "Aigerim", "Nursultan", "Dauren", "Bekzat", "Askar", "Ainur", "Zhansaya", "Erasyl", "Sanzhar", "Shyngys", "Nazira",
  "Kuanysh", "Dana", "Alex", "Max", "Emma", "Olivia", "Sophia", "Daniel", "Michael", "Nicholas", "Analiya", "Dickson", "Shital",
  "Аня Хлебникова", "Глеб Сукачев", "Айгерім Сұлтан", "Иван Петров", "Анна-Мария", "Мұхаммед Хусаин", "Асель Бекова",
  "Нурлан 2010", "Ерасыл 07", "Дамир Ли", "Ли Ен", "Сабина Хуанова", "Алибек Уалиев", "Мадина Ибраева", "Хусаин Ебеков",
];

// Фамилии (в том числе с «опасными» кусками: Москаленко — «москал», Вагин — «вагин», Хусаинов — «хуса…»).
const SURNAMES = [
  "Москаленко", "Москалёв", "Москалев", "Москалюк", "Москаль", "Вагин", "Вагина", "Вагинов", "Сукачев", "Хачатурян",
  "Хуснутдинов", "Хусаинов", "Хабибуллин", "Хайруллин", "Хасанов", "Хамзин", "Хохлов", "Козлов", "Дураков", "Петухов",
  "Лохматов", "Членов", "Мудрый", "Говоров", "Жданов", "Иванов", "Смирнов", "Кузнецов", "Попов",
  "Соколов", "Лебедев", "Морозов", "Волков", "Орлов", "Макаров", "Никитин", "Зайцев", "Соловьёв", "Воробьёв", "Королёв",
  "Киселёв", "Ковалёв", "Медведев", "Тарасов", "Баранов", "Комаров", "Сидоров", "Крылов", "Карпов", "Мельников", "Гаврилов",
  "Шевченко", "Бондаренко", "Ткаченко", "Коваленко", "Кравченко", "Руденко", "Олейник", "Шевчук", "Пономарёв", "Кудрявцев",
  "Ахметов", "Омаров", "Жұмабаев", "Кенжебеков", "Абдрахманов", "Есенов", "Сүлейменов", "Тоқаев", "Құнанбаев", "Әбішев",
  "Бекмұханбетов", "Исмаилов", "Қасымов", "Ермеков", "Сәтбаев", "Әуезов", "Жансүгіров", "Сейфуллин", "Байтұрсынов",
  "Дулатов", "Бөкейханов", "Уәлиханов", "Алтынсарин", "Қонаев", "Нұрғалиев", "Кожахметов", "Темірбеков", "Хасенов",
  "Ким", "Пак", "Цой", "Тен", "Хан", "Шин", "Югай", "Тян", "Хегай", "Ни", "Ебейсінов", "Ебеков", "Сексенбаев",
];

// Латинские пары «имя фамилия»: стоп-корень не должен находиться на стыке слов («Alex Ye…» → «…хуе…»).
const LATIN_PAIRS = [
  "Alex Yerlanov", "Max Yerbol", "Felix Yermek", "Alex Yesset", "Rex Yerzhan", "Max Yessenov", "Alex Yeskendir",
  "Felix Yerkebulan", "Nurlan Yesenov", "Assel Yermekova", "Marko Takhirov", "Ade Bilal", "Dias Yerbolov", "Alex Yelemes",
  "Max Yerasyl", "Hyejin Pak", "Yerbol Kim", "Yesset Tsoi", "Ainur Sukhanova", "Daniyar Yermekov", "Aminet Khut",
  "Khachik Avetis", "Xurshid Xolmatov", "Xue Li", "Yerlan Bek", "Aruzhan Kotova",
];

// Имена из разных народов Казахстана и соседей, похожие на корни.
const OTHER_NAMES = ["Хачик", "Аминет", "Аминат", "Хуан", "Хуанита", "Хусейн", "Марко Тахиров", "Аде Билал", "Алекс Ербол"];

const ALL_OK = [...KAZAKH, ...RUSSIAN, ...LATIN_AND_FULL, ...SURNAMES, ...LATIN_PAIRS, ...OTHER_NAMES];

describe("обычные имена проходят (ложных срабатываний 0)", () => {
  it(`список не меньше 200 имён: ${ALL_OK.length}`, () => {
    expect(ALL_OK.length).toBeGreaterThanOrEqual(200);
  });

  it("каждое имя проходит формат и стоп-корни", () => {
    const failed = ALL_OK.map((n) => [n, checkName(n)] as const).filter(([, r]) => !r.ok);
    expect(failed).toEqual([]);
  });

  it("имя нормализуется: NFC, крайние пробелы, повторные пробелы", () => {
    expect(checkName("  Анна   Мария ")).toEqual({ ok: true, name: "Анна Мария" });
    expect(checkName("Ербол".normalize("NFD"))).toEqual({ ok: true, name: "Ербол" });
  });
});

describe("формат", () => {
  const code = (s: unknown) => {
    const r = checkNameFormat(s);
    return r.ok ? "ok" : r.code;
  };

  it("длина 2–16 графем, хотя бы 2 буквы", () => {
    expect(code("А")).toBe("short");
    expect(code("")).toBe("short");
    expect(code("   ")).toBe("short");
    expect(code(null)).toBe("short");
    expect(code("Аб")).toBe("ok");
    expect(code("Абвгдежзийклмноп")).toBe("ok");
    expect(code("Абвгдежзийклмнопр")).toBe("long");
    expect(code("А1")).toBe("short");
    expect(code("x".repeat(500))).toBe("long");
  });

  it("эмодзи, невидимые, комбинирующие и знаки — chars", () => {
    for (const s of ["Аня😀", "Ан​я", "Ан‮я", "Аня!", "a.b", "Ann_a", "Аня#1", "Ан́я", "-Аня", "Аня-", "Ан--я"]) {
      expect(code(s), s).toBe("chars");
    }
    // «@» — признак контакта (общий формат, src/lib/moderation/name-format.ts).
    expect(code("Ann@")).toBe("contact");
    // Пробелы вокруг дефиса общий формат убирает: «Ан - я» → «Ан-я».
    expect(checkNameFormat("Ан - я")).toEqual({ ok: true, name: "Ан-я" });
  });

  it("не больше 4 цифр (телефон не пройдёт)", () => {
    expect(code("Нурлан 2010")).toBe("ok");
    expect(code("Нурлан 87012")).toBe("digits");
    expect(code("Аня 8 701 234 56 78")).not.toBe("ok");
  });

  it("смешение письменностей в слове — script_mix (подмена букв)", () => {
    expect(code("Сaша")).toBe("script_mix"); // латинская a
    expect(code("Aйгерім")).toBe("script_mix");
    expect(code("Саша Smith")).toBe("ok");
  });

  it("контакты", () => {
    for (const s of ["Аня tg", "Аня inst", "t me Аня", "Аня вк", "Даня ватсап", "Ernur kz", "Аня тел"]) expect(code(s), s).toBe("contact");
  });

  it("служебные слова и «Игрок 4821»", () => {
    for (const s of ["Бот", "Bot", "Бит", "admin", "Админ", "Модератор", "Поддержка", "Учитель", "Игрок 4821", "Ойыншы 12", "Player 7", "Ученик 5", "Мұғалім"]) {
      expect(code(s), s).toBe("reserved");
    }
    expect(code("Игрок")).toBe("ok");
    expect(code("Битимбай")).toBe("ok");
  });
});

describe("стоп-корни и обходы", () => {
  const blocked = (s: string) => {
    const r = checkName(s);
    return !r.ok && r.code === "blocked";
  };

  it("каждый корень списка ловится сам по себе (кроме служебно-коротких, проверяемых формой)", () => {
    // Корни короче 2 букв формат не пропустит; остальные — сами по себе блокируются.
    const missed = BLOCKLIST.filter((e) => checkNameFormat(e.stem).ok && !blocked(e.stem)).map((e) => e.stem);
    expect(missed).toEqual([]);
  });

  it("регистр, повторы, разделители, l33t, казахские буквы, латинские двойники", () => {
    for (const s of [
      "ХУЙ", "хуууй", "х у й", "х-у-й", "Пиздец", "П1здец", "Бля", "Блядина", "Сука", "Cyka", "сука 228", "Ебать", "Ёбаный", "Заебал",
      "Долбоёб", "Мудак", "Мудила", "Пидор", "Пидорас", "Шлюха", "Гандон", "Залупа", "Жопа", "Жопорук", "Дебил", "Идиотка",
      "Хуесос", "Нахуй", "Даун", "Порно", "Ниггер", "Чурка", "Хач", "Гитлер", "Нацист", "Суицид",
      "Fuck", "fuuuck", "F u c k", "Shit", "Bitch", "B1tch", "Pussy", "Asshole", "Nigga", "Porn", "Sex", "Dick", "Cunt",
      "Blyat", "Pizdec", "Suka", "Hui", "Pidor", "Huesos", "Nahuy",
      "Қотақ", "Котак", "Сігейін", "Амыңды", "Шешеңді", "Қаншық", "Ақымақ", "Жалап", "Боқ", "Qotaq", "Siktir",
      "Аня Хуйло", "Петя Мудак",
      // латинские двойники и транслит главного мата (замечание ревью)
      "Xyi", "XYI", "Xyilo", "Huilo", "Xuilo", "Hyesos", "Xyesos", "Yebat", "Yobany", "Yoban", "Yeblan",
      // склейка через короткий шов
      "ху йло", "Хуй ня", "F u ck", "Москали", "Вагинальный",
    ]) {
      expect(blocked(s), s).toBe(true);
    }
  });

  it("корни в режиме word/start не задевают обычные слова", () => {
    for (const s of ["Бөкей", "Хусаин", "Хуршид", "Сексенбай", "Назира", "Nazira", "Assel", "Shital", "Глеб", "Сергей", "Даурен", "Сукачев", "Хлеб"]) {
      expect(hasBlockedStem(s), s).toBe(false);
    }
  });

  it("скелет: невидимые убраны, казахские → русские, повторы схлопнуты, склейка коротких кусков", () => {
    const sk = skeleton("Х​у у у й Әсем");
    expect(sk.cyr).toContain("асем");
    expect(sk.squashed.some((s) => s.includes("хуи"))).toBe(true);
    expect(skeleton("с у к а").cyr).toContain("сука");
  });

  it("скелет: два обычных слова не склеиваются (шов только через кусок ≤ 2 знаков)", () => {
    expect(skeleton("Alex Yerlanov").squashed).toEqual([]);
    expect(skeleton("Ade Bilal").squashed).toEqual([]);
    expect(skeleton("ху йло").squashed).toContain("хуило");
    expect(skeleton("Ли Ен").squashed).toContain("лиен");
  });
});

describe("код друга без стоп-корней", () => {
  it("hasBlockedStem годится и для кодов", async () => {
    const { newFriendCode, normalizeFriendCode, formatFriendCode, FRIEND_CODE_ALPHABET } = await import("@/server/social/code");
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = newFriendCode();
      expect(c).toMatch(new RegExp(`^[${FRIEND_CODE_ALPHABET}]{8}$`));
      expect(hasBlockedStem(c)).toBe(false);
      seen.add(c);
    }
    expect(seen.size).toBe(300);
    expect(normalizeFriendCode(" k7qf-29xm ")).toBe("K7QF29XM");
    expect(normalizeFriendCode("K7QF-29X!")).toBeNull(); // знака нет в алфавите
    expect(formatFriendCode("K7QF29XM")).toBe("K7QF-29XM");
    // Код с корнем внутри перевыпускается: подменный источник сначала даёт байты «FCKZZZZZ», потом «ABCDEFGH»
    // (общий формат — src/lib/friend-code.ts: 5 байтов = 8 знаков по 5 бит).
    const bytesOf = (code: string) => {
      let acc = 0;
      for (const ch of code) acc = acc * 32 + FRIEND_CODE_ALPHABET.indexOf(ch);
      return Uint8Array.from({ length: 5 }, (_, k) => Math.floor(acc / 256 ** (4 - k)) % 256);
    };
    expect(hasBlockedStem("FCKZZZZZ")).toBe(true);
    const calls = [bytesOf("FCKZZZZZ"), bytesOf("ABCDEFGH")];
    const rand = () => calls.shift() ?? bytesOf("22222222");
    expect(newFriendCode(rand)).toBe("ABCDEFGH");
  });
});
