import type { L } from "@/lib/types";

// Этап 16В, пакет P1 (docs/specs/stage16c.md §3): украшения профиля — рамки, фоны, титулы. Ключи — `cosmetics.*`.
// Казахский — литературный, коротко; ЕНТ → ҰБТ; в русском нет глаголов с родом. Вычитано моделью, носителем — нет.
export const cosmeticsDict = {
  // Слоты (множественное — разделы и сегменты)
  "cosmetics.slot.frame": { ru: "Рамки", kk: "Жақтаулар" },
  "cosmetics.slot.banner": { ru: "Фоны", kk: "Фондар" },
  "cosmetics.slot.title": { ru: "Титулы", kk: "Атақтар" },

  // Полное название украшения для подписей (история чипов, приз кейса, доступность)
  "cosmetics.what.frame": { ru: "Рамка «{name}»", kk: "«{name}» жақтауы" },
  "cosmetics.what.banner": { ru: "Фон «{name}»", kk: "«{name}» фоны" },
  "cosmetics.what.title": { ru: "Титул «{name}»", kk: "«{name}» атағы" },

  // Рамки
  "cosmetics.name.frame-dots": { ru: "Точки", kk: "Нүктелер" },
  "cosmetics.name.frame-bits": { ru: "Биты", kk: "Биттер" },
  "cosmetics.name.frame-wave": { ru: "Волна", kk: "Толқын" },
  "cosmetics.name.frame-circuit": { ru: "Микросхема", kk: "Микросхема" },
  "cosmetics.name.frame-pixel": { ru: "Пиксели", kk: "Пиксельдер" },
  "cosmetics.name.frame-orbit": { ru: "Орбита", kk: "Орбита" },
  "cosmetics.name.frame-neon": { ru: "Неон", kk: "Неон" },
  "cosmetics.name.frame-galaxy": { ru: "Галактика", kk: "Галактика" },
  "cosmetics.name.frame-crown": { ru: "Корона", kk: "Тәж" },
  "cosmetics.name.frame-rainbow": { ru: "Радуга", kk: "Кемпірқосақ" },

  // Фоны карточки профиля
  "cosmetics.name.banner-grid": { ru: "Клетка тетради", kk: "Дәптер торы" },
  "cosmetics.name.banner-binary": { ru: "Двоичный код", kk: "Екілік код" },
  "cosmetics.name.banner-waves": { ru: "Волны", kk: "Толқындар" },
  "cosmetics.name.banner-circuit": { ru: "Схема платы", kk: "Плата сұлбасы" },
  "cosmetics.name.banner-night": { ru: "Ночное небо", kk: "Түнгі аспан" },
  "cosmetics.name.banner-aurora": { ru: "Северное сияние", kk: "Солтүстік шұғыласы" },
  "cosmetics.name.banner-gold": { ru: "Золотые лучи", kk: "Алтын сәулелер" },

  // Титулы
  "cosmetics.name.title-newbie": { ru: "Новичок кода", kk: "Код бастаушысы" },
  "cosmetics.name.title-bit-friend": { ru: "Друг Бита", kk: "Биттің досы" },
  "cosmetics.name.title-night-coder": { ru: "Ночной кодер", kk: "Түнгі кодер" },
  "cosmetics.name.title-bug-hunter": { ru: "Охотник за багами", kk: "Баг аңшысы" },
  "cosmetics.name.title-bit-lord": { ru: "Повелитель битов", kk: "Биттер әміршісі" },
  "cosmetics.name.title-algo-master": { ru: "Мастер алгоритмов", kk: "Алгоритм шебері" },
  "cosmetics.name.title-ent-storm": { ru: "Гроза ЕНТ", kk: "ҰБТ дауылы" },
  "cosmetics.name.title-legend": { ru: "Легенда информатики", kk: "Информатика аңызы" },

  // Состояния карточки
  "cosmetics.state.owned": { ru: "Есть", kk: "Бар" },
  "cosmetics.state.equipped": { ru: "Надето", kk: "Қолданылуда" },
  "cosmetics.state.caseOnly": { ru: "Только в кейсе", kk: "Тек кейсте" },

  // Действия
  "cosmetics.act.equip": { ru: "Надеть", kk: "Қолдану" },
  "cosmetics.act.unequip": { ru: "Снять", kk: "Алып тастау" },
  "cosmetics.act.buy": { ru: "Купить за {n}", kk: "{n} чипке сатып алу" },

  // Магазин
  "cosmetics.shop.title": { ru: "Украшения профиля", kk: "Профиль әшекейлері" },
  "cosmetics.shop.hint": {
    ru: "Рамки, фоны и титулы — за чипы. Легендарные выпадают только из кейса за уровень.",
    kk: "Жақтаулар, фондар мен атақтар — чипке. Аңыздық әшекейлер тек деңгей кейсінен түседі.",
  },
  "cosmetics.shop.tabs": { ru: "Вид украшения", kk: "Әшекей түрі" },
  "cosmetics.card.open": { ru: "{name}, {rarity}. Примерить", kk: "{name}, {rarity}. Сынап көру" },

  // Шторка «Примерка»
  "cosmetics.try.title": { ru: "Примерка", kk: "Сынап көру" },
  "cosmetics.try.hint": { ru: "Так будет выглядеть карточка профиля.", kk: "Профиль картасы осылай көрінеді." },
  "cosmetics.try.earn": { ru: "Как заработать чипы", kk: "Чиптерді қалай жинауға болады" },
  "cosmetics.try.caseOnly": {
    ru: "Это легендарное украшение нельзя купить: оно выпадает из кейса за новый уровень.",
    kk: "Бұл аңыздық әшекейді сатып алуға болмайды: ол жаңа деңгей кейсінен түседі.",
  },
  "cosmetics.try.bought": { ru: "Куплено и сразу надето", kk: "Сатып алынды және бірден қолданылды" },
  "cosmetics.try.owned": { ru: "Уже в твоей коллекции", kk: "Коллекцияңда бар" },

  // Профиль
  "cosmetics.card.aria": { ru: "Карточка профиля", kk: "Профиль картасы" },
  "cosmetics.mine.title": { ru: "Мои украшения", kk: "Менің әшекейлерім" },
  "cosmetics.mine.hint": { ru: "Надень или сними — карточка профиля изменится сразу.", kk: "Қолдансаң немесе алып тастасаң, профиль картасы бірден өзгереді." },
  "cosmetics.mine.empty": {
    ru: "Пока ничего нет: рамки, фоны и титулы ждут в магазине.",
    kk: "Әзірге ештеңе жоқ: жақтаулар, фондар мен атақтар дүкенде күтіп тұр.",
  },
  "cosmetics.mine.slotEmpty": { ru: "Пока нет", kk: "Әзірге жоқ" },
  "cosmetics.mine.shop": { ru: "В магазин", kk: "Дүкенге" },

  // Кейс за уровень: приз-украшение
  "cosmetics.noun.frame": { ru: "Рамка", kk: "Жақтау" },
  "cosmetics.noun.banner": { ru: "Фон", kk: "Фон" },
  "cosmetics.noun.title": { ru: "Титул", kk: "Атақ" },
  "cosmetics.case.new.frame": { ru: "Новая рамка!", kk: "Жаңа жақтау!" },
  "cosmetics.case.new.banner": { ru: "Новый фон!", kk: "Жаңа фон!" },
  "cosmetics.case.new.title": { ru: "Новый титул!", kk: "Жаңа атақ!" },
  "cosmetics.case.desc": {
    ru: "Украшение уже в коллекции. Надеть его можно сейчас или позже, в профиле.",
    kk: "Әшекей коллекцияңа қосылды. Оны қазір немесе кейінірек профильде қолдануға болады.",
  },
} satisfies Record<string, L>;
