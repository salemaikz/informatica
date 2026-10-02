import type { L } from "@/lib/types";

// Строки раздела «Цели» (ru + kk): карточка на главной и панель на странице «Прогресс». Префикс goals.
// Казахский — вычитан моделью, носителем — нет.
export const goalsDict = {
  // Карточка цели на главной
  "goals.card.until": { ru: "До ЕНТ {days}", kk: "ҰБТ-ға дейін {days}" },
  "goals.card.today": { ru: "ЕНТ сегодня", kk: "ҰБТ бүгін" },
  "goals.card.past": { ru: "Дата ЕНТ уже прошла", kk: "ҰБТ күні өтіп кетті" },
  "goals.card.set": { ru: "Поставь цель", kk: "Мақсат қой" },
  "goals.card.setHint": { ru: "Дата ЕНТ и целевой балл помогут спланировать неделю", kk: "ҰБТ күні мен мақсатты балл аптаны жоспарлауға көмектеседі" },
  "goals.card.forecast": { ru: "Прогноз ~{score} из 50 · цель {target}", kk: "Болжам ~{score} / 50 · мақсат {target}" },
  "goals.card.noForecast": { ru: "Прогноз появится после первых заданий · цель {target}", kk: "Болжам алғашқы тапсырмалардан кейін шығады · мақсат {target}" },
  "goals.card.weekRing": { ru: "{done}/{goal}", kk: "{done}/{goal}" },
  "goals.card.weekLabel": { ru: "уроков за неделю", kk: "апта ішіндегі сабақ" },

  // Статус прогноза против цели
  "goals.status.none": { ru: "Нет данных", kk: "Дерек жоқ" },
  "goals.status.below": { ru: "Ниже цели", kk: "Мақсаттан төмен" },
  "goals.status.on": { ru: "На уровне цели", kk: "Мақсат деңгейінде" },
  "goals.status.above": { ru: "Выше цели", kk: "Мақсаттан жоғары" },

  // Панель на странице «Прогресс»
  "goals.panel.title": { ru: "Цель и прогноз", kk: "Мақсат және болжам" },
  "goals.panel.edit": { ru: "Изменить", kk: "Өзгерту" },
  "goals.panel.countdown": { ru: "До ЕНТ", kk: "ҰБТ-ға дейін" },
  "goals.panel.examOn": { ru: "ЕНТ: {date}", kk: "ҰБТ: {date}" },
  "goals.panel.noDate": { ru: "Дата ЕНТ не указана", kk: "ҰБТ күні көрсетілмеген" },
  "goals.panel.setDate": { ru: "Указать дату", kk: "Күнін көрсету" },
  "goals.forecast.title": { ru: "Прогноз балла", kk: "Балл болжамы" },
  "goals.forecast.value": { ru: "~{score} из 50", kk: "~{score} / 50" },
  "goals.forecast.range": { ru: "Вероятно {low}–{high} баллов", kk: "Ықтимал {low}–{high} балл" },
  "goals.forecast.target": { ru: "Цель: {target}", kk: "Мақсат: {target}" },
  "goals.forecast.gap": { ru: "Не хватает ~{n} б.", kk: "Жетпейтіні ~{n} б." },
  "goals.forecast.reserve": { ru: "Запас ~{n} б.", kk: "Қор ~{n} б." },
  "goals.forecast.none": {
    ru: "Пройди несколько уроков или мини-ЕНТ — и здесь появится прогноз балла.",
    kk: "Бірнеше сабақ немесе шағын ҰБТ өт — осында балл болжамы шығады.",
  },
  "goals.forecast.honest": {
    ru: "Интервал сужается по мере ответов: чем больше заданий, тем точнее прогноз.",
    kk: "Жауап көбейген сайын аралық тарылады: тапсырма көп болса, болжам дәлірек.",
  },
  "goals.week.title": { ru: "Неделя", kk: "Апта" },
  "goals.week.progress": { ru: "{done} из {goal} уроков", kk: "{done} / {goal} сабақ" },
  "goals.week.reached": { ru: "Цель недели выполнена", kk: "Апталық мақсат орындалды" },
  "goals.week.left": { ru: "Осталось: {n}", kk: "Қалды: {n}" },
  "goals.week.today": { ru: "сегодня", kk: "бүгін" },
  "goals.plan.title": { ru: "План на неделю", kk: "Аптаға жоспар" },
  "goals.plan.hint": { ru: "Темы, на которых можно добрать больше всего баллов", kk: "Ең көп балл жинауға болатын тақырыптар" },
  "goals.plan.gain": { ru: "до +{n} б.", kk: "+{n} б. дейін" },
  "goals.plan.mastery": { ru: "освоено {n}%", kk: "меңгерілгені {n}%" },
  "goals.plan.lesson": { ru: "Урок", kk: "Сабақ" },
  "goals.plan.train": { ru: "Тренировка", kk: "Жаттығу" },
  "goals.plan.empty": { ru: "Все темы освоены — так держать!", kk: "Барлық тақырып меңгерілді — осылай жалғастыр!" },
  "goals.history.title": { ru: "Пробные ЕНТ", kk: "Сынақ ҰБТ" },
  "goals.history.last": { ru: "Последний: {score} из 50", kk: "Соңғысы: {score} / 50" },
  "goals.history.empty": { ru: "Пробников пока нет. Мини-ЕНТ — 15 заданий за 30 минут.", kk: "Сынақ тесттері әзірге жоқ. Шағын ҰБТ — 30 минутта 15 тапсырма." },
  "goals.history.start": { ru: "Пройти мини-ЕНТ", kk: "Шағын ҰБТ өту" },
  "goals.history.chart": { ru: "Баллы пробных ЕНТ (из 50)", kk: "Сынақ ҰБТ баллдары (50-ден)" },

  // Серия и заморозки (страница «Прогресс»)
  "goals.streak.freezes": { ru: "Заморозки: {n}", kk: "Мұздатулар: {n}" },
  "goals.streak.freezeHint": {
    ru: "Заморозка спасёт серию, если пропустишь день. Новая — каждые 7 дней подряд.",
    kk: "Күн жіберіп алсаң, мұздату серияны сақтап қалады. Жаңасы — қатарынан әр 7 күн сайын.",
  },
} satisfies Record<string, L>;
