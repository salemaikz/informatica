import type { IdeTask } from "../types";

// Задачи SQL для ЕНТ и школы: базовые запросы на учебной базе (src/lib/ide/sql/db.ts).
// Таблицы: students(id, name, class, city, score), classes(class, teacher, room), books(id, title, author, year, price, pages),
// orders(id, student_id, book_id, qty, ordered). Условия — по числам и латинским словам, чтобы не путать похожие русские/латинские буквы.
// Казахские тексты вычитаны моделью, носителем — нет.
export const TASKS: IdeTask[] = [
  {
    id: "sql-1-select",
    lang: "sql",
    level: 1,
    skill: "db.select",
    title: { ru: "Все данные таблицы", kk: "Кестедегі барлық деректер" },
    prompt: {
      ru: "Выведите **все столбцы и все строки** таблицы `students`.\n\nЗвёздочка `*` в `SELECT` означает «все столбцы».",
      kk: "`students` кестесінің **барлық бағандары мен барлық жолдарын** шығарыңыз.\n\n`SELECT` ішіндегі жұлдызша `*` «барлық бағандар» дегенді білдіреді.",
    },
    starter: "SELECT\nFROM students;",
    hint: {
      ru: "Запрос выглядит так: `SELECT` что выбрать `FROM` откуда. Здесь «что» — все столбцы, а «откуда» — таблица `students`.",
      kk: "Сұраныс былай жазылады: `SELECT` нені таңдау `FROM` қайдан. Мұнда «нені» — барлық бағандар, «қайдан» — `students` кестесі.",
    },
    solution: "SELECT * FROM students;",
    check: { kind: "sql", reference: "SELECT * FROM students" },
  },
  {
    id: "sql-2-columns",
    lang: "sql",
    level: 1,
    skill: "db.select",
    title: { ru: "Выбор столбцов", kk: "Бағандарды таңдау" },
    prompt: {
      ru: "Выведите **имя** и **город** каждого ученика (столбцы `name` и `city`) из таблицы `students`.",
      kk: "`students` кестесінен әр оқушының **атын** және **қаласын** (`name` және `city` бағандары) шығарыңыз.",
    },
    starter: "SELECT\nFROM students;",
    hint: {
      ru: "Названия столбцов перечисляют после `SELECT` через запятую: `SELECT a, b FROM ...`.",
      kk: "Бағандардың атаулары `SELECT` сөзінен кейін үтір арқылы тізіледі: `SELECT a, b FROM ...`.",
    },
    solution: "SELECT name, city FROM students;",
    check: { kind: "sql", reference: "SELECT name, city FROM students" },
  },
  {
    id: "sql-3-order",
    lang: "sql",
    level: 1,
    skill: "db.select",
    title: { ru: "Сортировка по убыванию", kk: "Кему ретімен сұрыптау" },
    prompt: {
      ru: "Выведите **имя** и **балл** (`name`, `score`) всех учеников так, чтобы **сначала шли самые высокие баллы**.",
      kk: "Барлық оқушылардың **атын** және **балын** (`name`, `score`) шығарыңыз: **ең жоғары балдар бірінші** тұрсын.",
    },
    starter: "SELECT name, score\nFROM students\n",
    hint: {
      ru: "Сортировка — `ORDER BY столбец`. По умолчанию она идёт по возрастанию (`ASC`), а по убыванию нужно добавить `DESC`.",
      kk: "Сұрыптау — `ORDER BY баған`. Әдепкіде ол өсу ретімен (`ASC`) жүреді, ал кему ретімен сұрыптау үшін `DESC` қосу керек.",
    },
    solution: "SELECT name, score\nFROM students\nORDER BY score DESC;",
    check: { kind: "sql", reference: "SELECT name, score FROM students ORDER BY score DESC", ordered: true },
  },
  {
    id: "sql-4-where",
    lang: "sql",
    level: 2,
    skill: "db.select",
    title: { ru: "Условие AND и OR", kk: "AND және OR шарты" },
    prompt: {
      ru: "Выведите **имя, класс и балл** (`name`, `class`, `score`) учеников, которые учатся в **10 или 11 классе** и набрали **больше 80 баллов**.",
      kk: "**10-сыныпта немесе 11-сыныпта** оқитын және **80 балдан жоғары** жинаған оқушылардың **атын, сыныбын және балын** (`name`, `class`, `score`) шығарыңыз.",
    },
    starter: "SELECT name, class, score\nFROM students\nWHERE ",
    hint: {
      ru: "Условия соединяют словами `AND` («и») и `OR` («или»). Если смешиваете их, группируйте скобками: `(a OR b) AND c`.",
      kk: "Шарттар `AND` («және») және `OR` («немесе») сөздерімен байланысады. Оларды араластырсаңыз, жақшамен топтаңыз: `(a OR b) AND c`.",
    },
    solution: "SELECT name, class, score\nFROM students\nWHERE (class = 10 OR class = 11) AND score > 80;",
    check: { kind: "sql", reference: "SELECT name, class, score FROM students WHERE (class = 10 OR class = 11) AND score > 80" },
  },
  {
    id: "sql-5-count",
    lang: "sql",
    level: 2,
    skill: "db.select",
    title: { ru: "Подсчёт строк: COUNT", kk: "Жолдарды санау: COUNT" },
    prompt: {
      ru: "Сколько учеников набрали **больше 80 баллов**? Выведите одно число — количество таких учеников.",
      kk: "Қанша оқушы **80 балдан жоғары** жинады? Бір сан шығарыңыз — осындай оқушылардың саны.",
    },
    starter: "SELECT\nFROM students\nWHERE ;",
    hint: {
      ru: "`COUNT(*)` считает строки. Сначала `WHERE` отбирает нужные строки, потом `COUNT(*)` их считает.",
      kk: "`COUNT(*)` жолдарды санайды. Алдымен `WHERE` керекті жолдарды іріктейді, содан кейін `COUNT(*)` оларды санайды.",
    },
    solution: "SELECT COUNT(*)\nFROM students\nWHERE score > 80;",
    check: { kind: "sql", reference: "SELECT COUNT(*) FROM students WHERE score > 80" },
  },
  {
    id: "sql-6-like",
    lang: "sql",
    level: 2,
    skill: "db.select",
    title: { ru: "Поиск по шаблону: LIKE", kk: "Үлгі бойынша іздеу: LIKE" },
    prompt: {
      ru: "В таблице `books` найдите **названия** (`title`) всех книг, в которых есть слово `Python` (в любом месте названия).",
      kk: "`books` кестесінен атауының кез келген жерінде `Python` сөзі бар барлық кітаптардың **атауын** (`title`) табыңыз.",
    },
    starter: "SELECT title\nFROM books\nWHERE title ",
    hint: {
      ru: "В `LIKE` знак `%` заменяет любое количество любых символов: `LIKE '%слово%'` ищет слово в любом месте.",
      kk: "`LIKE` ішіндегі `%` белгісі кез келген таңбалардың кез келген санын алмастырады: `LIKE '%сөз%'` сөзді кез келген жерден іздейді.",
    },
    solution: "SELECT title\nFROM books\nWHERE title LIKE '%Python%';",
    check: { kind: "sql", reference: "SELECT title FROM books WHERE title LIKE '%Python%'" },
  },
  {
    id: "sql-7-group",
    lang: "sql",
    level: 3,
    skill: "db.select",
    title: { ru: "Среднее по группам: AVG и GROUP BY", kk: "Топтар бойынша орташа мән: AVG және GROUP BY" },
    prompt: {
      ru: "Для каждого **класса** найдите **средний балл** учеников. Выведите два столбца: `class` и среднее значение `score`.",
      kk: "Әр **сынып** бойынша оқушылардың **орташа балын** табыңыз. Екі баған шығарыңыз: `class` және `score` бағанының орташа мәні.",
    },
    starter: "SELECT class,\nFROM students\nGROUP BY ",
    hint: {
      ru: "`GROUP BY class` собирает строки в группы по классам, а `AVG(score)` считает среднее отдельно в каждой группе.",
      kk: "`GROUP BY class` жолдарды сыныптар бойынша топтарға жинайды, ал `AVG(score)` орташа мәнді әр топта бөлек есептейді.",
    },
    solution: "SELECT class, AVG(score)\nFROM students\nGROUP BY class;",
    check: { kind: "sql", reference: "SELECT class, AVG(score) FROM students GROUP BY class" },
  },
  {
    id: "sql-8-update",
    lang: "sql",
    level: 3,
    skill: "db.modify",
    title: { ru: "Изменение данных: UPDATE", kk: "Деректерді өзгерту: UPDATE" },
    prompt: {
      ru: "Ученикам **9 класса** добавили по **5 баллов** за олимпиаду. Измените таблицу `students`: увеличьте `score` на 5 только у учеников 9 класса.\n\nПосле запуска ниже покажется таблица `students` — проверьте, что изменились только нужные строки.",
      kk: "**9-сынып** оқушыларына олимпиада үшін **5 балдан** қосылды. `students` кестесін өзгертіңіз: тек 9-сынып оқушыларының `score` мәнін 5-ке арттырыңыз.\n\nІске қосқаннан кейін төменде `students` кестесі көрсетіледі — тек керекті жолдардың өзгергенін тексеріңіз.",
    },
    starter: "UPDATE students\nSET \nWHERE ;",
    hint: {
      ru: "`UPDATE таблица SET столбец = значение WHERE условие`. Новое значение можно считать из старого: `score = score + 5`. Без `WHERE` изменятся все строки!",
      kk: "`UPDATE кесте SET баған = мән WHERE шарт`. Жаңа мәнді ескісінен есептеуге болады: `score = score + 5`. `WHERE` болмаса, барлық жолдар өзгереді!",
    },
    solution: "UPDATE students\nSET score = score + 5\nWHERE class = 9;",
    check: { kind: "sql", reference: "UPDATE students SET score = score + 5 WHERE class = 9", checkQuery: "SELECT * FROM students ORDER BY id" },
  },
];
