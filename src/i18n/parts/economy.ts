import type { L } from "@/lib/types";

// Экономика: сердечки, чипы, магазин, бустеры, цена ИИ (ru + kk). Казахский — литературный.
// Префиксы: shop.* — страница «Магазин», chipchip.* — значки шапки.
export const economyDict = {
  "economy.noChips": {
    ru: "Не хватает чипов для запроса к ИИ. Заработай их в уроках или загляни в магазин.",
    kk: "ЖИ-ге сұрау үшін чиптер жетпейді. Оларды сабақтарда жина немесе дүкенге кір.",
  },

  // Значки шапки
  "shop.chip.hearts": { ru: "Сердечки: {n}. Открыть магазин", kk: "Жүректер: {n}. Дүкенді ашу" },
  "shop.chip.heartsUnlimited": { ru: "Сердечки без ограничений. Открыть магазин", kk: "Жүректер шексіз. Дүкенді ашу" },
  "shop.chip.chips": { ru: "Чипы: {n}. Открыть магазин", kk: "Чиптер: {n}. Дүкенді ашу" },

  // Страница
  "shop.title": { ru: "Магазин", kk: "Дүкен" },
  "shop.subtitle": { ru: "Чипы зарабатываются в уроках — трать их на сердечки, множитель и ИИ.", kk: "Чиптерді сабақтарда жинайсың — оларды жүрекке, көбейткішке және ЖИ-ге жұмса." },

  // Баланс
  "shop.balance": { ru: "Твой баланс", kk: "Балансың" },
  "shop.balance.chips": { ru: "чипов", kk: "чип" },
  "shop.balance.hearts": { ru: "Сердечки", kk: "Жүректер" },
  "shop.balance.heartsOf": { ru: "{n} из {max}", kk: "{n} / {max}" },
  "shop.balance.unlimited": { ru: "Безлимит", kk: "Шексіз" },
  "shop.balance.next": { ru: "Следующее через {time}", kk: "Келесісі {time} кейін" },
  "shop.balance.full": { ru: "Полный запас", kk: "Қор толық" },
  "shop.balance.boost": { ru: "Бустер {mult} ещё {time}", kk: "Бустер {mult} тағы {time}" },
  "shop.balance.mult": { ru: "Множитель чипов {mult}", kk: "Чип көбейткіші {mult}" },
  "shop.balance.multHint": { ru: "тариф × бустер", kk: "тариф × бустер" },

  // Баннер тарифа
  "shop.plan.freeTitle": { ru: "Безлимит: ИИ и уроки без ограничений", kk: "Шексіз: ЖИ мен сабақтар шектеусіз" },
  "shop.plan.freeText": { ru: "Сердечки не заканчиваются, чипы ×2, ИИ-помощник без лимита.", kk: "Жүректер таусылмайды, чиптер ×2, ЖИ-көмекшіге лимит жоқ." },
  "shop.plan.trial": { ru: "{days} бесплатно", kk: "{days} тегін" },
  "shop.plan.more": { ru: "Тарифы", kk: "Тарифтер" },
  "shop.plan.current": { ru: "Твой тариф: {plan}", kk: "Тарифің: {plan}" },
  "shop.plan.left": { ru: "ещё {days}", kk: "тағы {days}" },
  "shop.plan.lite": { ru: "Лайт", kk: "Лайт" },
  "shop.plan.unlimited": { ru: "Безлимит", kk: "Шексіз" },
  "shop.plan.trialMark": { ru: "пробный", kk: "сынақ" },

  // Сердечки
  "shop.hearts.title": { ru: "Сердечки", kk: "Жүректер" },
  "shop.hearts.hint": { ru: "Сердечко тратится за ошибку в уроке. Каждый день запас снова полный.", kk: "Сабақтағы қате үшін жүрек кетеді. Күн сайын қор қайта толады." },
  "shop.item.heart-1": { ru: "+1 сердечко", kk: "+1 жүрек" },
  "shop.item.heart-1.desc": { ru: "Вернуть одно сердечко сразу", kk: "Бір жүректі бірден қайтару" },
  "shop.item.hearts-full": { ru: "Полный запас", kk: "Толық қор" },
  "shop.item.hearts-full.desc": { ru: "Все сердечки сразу", kk: "Барлық жүректі бірден" },
  "shop.item.boost-15": { ru: "Множитель ×2 на 15 мин", kk: "×2 көбейткіш 15 мин" },
  "shop.item.boost-15.desc": { ru: "Чипы за XP вдвое быстрее", kk: "XP үшін чиптер екі есе жылдам" },
  "shop.item.boost-60": { ru: "Множитель ×2 на 1 час", kk: "×2 көбейткіш 1 сағат" },
  "shop.item.boost-60.desc": { ru: "Час двойных чипов", kk: "Бір сағат қос чип" },
  "shop.buy": { ru: "Купить", kk: "Сатып алу" },
  "shop.bought": { ru: "Куплено", kk: "Сатып алынды" },
  "shop.fail.full": { ru: "Запас полный", kk: "Қор толық" },
  "shop.fail.unlimited": { ru: "У тебя безлимит", kk: "Сенде шексіз тариф" },
  "shop.fail.chips": { ru: "Не хватает {n}", kk: "{n} жетпейді" },
  "shop.free.practice": { ru: "Бесплатно: пройди тренировку — она вернёт сердечко", kk: "Тегін: жаттығуды орында — ол жүректі қайтарады" },

  // Множитель
  "shop.boost.title": { ru: "Множитель чипов", kk: "Чип көбейткіші" },
  "shop.boost.hint": { ru: "Пока бустер идёт, все чипы за XP, уроки и цели умножаются.", kk: "Бустер жүріп жатқанда XP, сабақ және мақсат үшін барлық чиптер көбейеді." },
  "shop.boost.active": { ru: "Сейчас {mult}, ещё {time}", kk: "Қазір {mult}, тағы {time}" },
  "shop.boost.pack": { ru: "{mult} на {span}", kk: "{mult} · {span}" },
  "shop.boost.packDesc": { ru: "Двойной заработок чипов", kk: "Чип табу екі есе" },

  // Чипы за деньги
  "shop.chips.title": { ru: "Чипы", kk: "Чиптер" },
  "shop.chips.hint": { ru: "Если хочется быстрее. Оплата скоро.", kk: "Тезірек болсын десең. Төлем жақында." },
  "shop.chips.pack": { ru: "{n} чипов", kk: "{n} чип" },
  "shop.chips.bonus": { ru: "+{n} в подарок", kk: "+{n} сыйлық" },
  "shop.chips.plain": { ru: "Без бонуса", kk: "Бонуссыз" },
  "shop.badge.popular": { ru: "Популярный", kk: "Танымал" },
  "shop.badge.best": { ru: "Выгодно", kk: "Тиімді" },
  "shop.soon.what": { ru: "{item} · {price}", kk: "{item} · {price}" },

  // Как заработать
  "shop.earn.title": { ru: "Как заработать чипы", kk: "Чипті қалай жинауға болады" },
  "shop.earn.xp": { ru: "За опыт: {xp} XP = 1 чип", kk: "Тәжірибе үшін: {xp} XP = 1 чип" },
  "shop.earn.lesson": { ru: "Пройти урок", kk: "Сабақты аяқтау" },
  "shop.earn.perfect": { ru: "Урок без ошибок", kk: "Қатесіз сабақ" },
  "shop.earn.dailyGoal": { ru: "Дневная цель", kk: "Күндік мақсат" },
  "shop.earn.achievement": { ru: "Новое достижение", kk: "Жаңа жетістік" },
  "shop.earn.exam": { ru: "Пробный ЕНТ", kk: "ҰБТ сынағы" },
  "shop.earn.mult": { ru: "Чипы умножаются: Лайт {lite}, Безлимит {unl}, бустер {boost}.", kk: "Чиптер көбейеді: Лайт {lite}, Шексіз {unl}, бустер {boost}." },

  // ИИ
  "shop.ai.title": { ru: "ИИ-помощник", kk: "ЖИ-көмекші" },
  "shop.ai.freeLeft": { ru: "Сегодня бесплатно: осталось {n} из {max}", kk: "Бүгін тегін: {max} ішінен {n} қалды" },
  "shop.ai.unlimited": { ru: "Без ограничений", kk: "Шектеусіз" },
  "shop.ai.over": { ru: "Сверх бесплатного — за чипы:", kk: "Тегін лимиттен тыс — чипке:" },
  "shop.ai.free": { ru: "бесплатно", kk: "тегін" },
  "shop.ai.hint": { ru: "Подсказка", kk: "Кеңес" },
  "shop.ai.explain": { ru: "Подробный разбор", kk: "Толық талдау" },
  "shop.ai.ask": { ru: "Вопрос Биту", kk: "Битке сұрақ" },
  "shop.ai.chat": { ru: "Сообщение в чате", kk: "Чаттағы хабарлама" },
  "shop.ai.photo": { ru: "Проверка решения по фото", kk: "Шешімді фото арқылы тексеру" },
  "shop.ai.review": { ru: "Разбор пробного ЕНТ", kk: "ҰБТ сынағын талдау" },
  "shop.ai.feedback": { ru: "Отзыв после урока", kk: "Сабақтан кейінгі пікір" },

  // История чипов
  "shop.ledger.title": { ru: "История чипов", kk: "Чиптер тарихы" },
  "shop.ledger.empty": { ru: "Пока пусто — пройди урок, и чипы появятся.", kk: "Әзірге бос — сабақты өтсең, чиптер пайда болады." },
  "shop.ledger.more": { ru: "Ещё", kk: "Тағы" },
  "shop.ledger.less": { ru: "Свернуть", kk: "Жасыру" },
  "shop.ledger.today": { ru: "Сегодня", kk: "Бүгін" },
  "shop.ledger.yesterday": { ru: "Вчера", kk: "Кеше" },
  "shop.ledger.welcome": { ru: "Подарок за старт", kk: "Бастауға сыйлық" },
  "shop.ledger.xp": { ru: "Опыт (XP)", kk: "Тәжірибе (XP)" },
  "shop.ledger.lesson": { ru: "Урок пройден", kk: "Сабақ аяқталды" },
  "shop.ledger.perfect": { ru: "Урок без ошибок", kk: "Қатесіз сабақ" },
  "shop.ledger.dailyGoal": { ru: "Дневная цель", kk: "Күндік мақсат" },
  "shop.ledger.achievement": { ru: "Достижение", kk: "Жетістік" },
  "shop.ledger.exam": { ru: "Пробный ЕНТ", kk: "ҰБТ сынағы" },
  "shop.ledger.buy": { ru: "Покупка: {what}", kk: "Сатып алу: {what}" },
  "shop.ledger.ai": { ru: "ИИ: {what}", kk: "ЖИ: {what}" },
  "shop.ledger.refund": { ru: "Возврат: {what}", kk: "Қайтару: {what}" },
} satisfies Record<string, L>;
