import type { L, Skill } from "@/lib/types";

// Навыки курса. Навык = одно умение, которое тренируют задания; у каждого — тема ЕНТ (docs/ENT.md).
// Термины на казахском — по глоссарию НЦТ (docs/ENT.md, раздел 4).

const NUMBER_SYSTEMS: L = { ru: "Системы счисления", kk: "Санау жүйелері" };
const INFO: L = { ru: "Информация и её измерение", kk: "Ақпарат және оны өлшеу" };
const LOGIC: L = { ru: "Логика", kk: "Логика" };
const PYTHON: L = { ru: "Python и алгоритмы", kk: "Python және алгоритмдер" };
const DB: L = { ru: "Базы данных и SQL", kk: "Деректер қоры және SQL" };
const PC: L = { ru: "Устройство компьютера и ПО", kk: "Компьютер құрылғысы және ПҚ" };
const NET: L = { ru: "Сети и безопасность", kk: "Желілер және қауіпсіздік" };
const OFFICE: L = { ru: "Таблицы и веб", kk: "Кестелер және веб" };
const IT: L = { ru: "Современные IT", kk: "Заманауи IT" };
const ENT: L = { ru: "Как решать ЕНТ", kk: "ҰБТ-ны қалай шешу керек" };
const BASICS: L = { ru: "Компьютер с нуля", kk: "Компьютер нөлден" };

export const SKILLS: Skill[] = [
  // ---------- Раздел 0: старт — компьютер с нуля (решение #36) ----------
  { id: "base.computer", ent: "t01", topic: BASICS, title: { ru: "Что такое компьютер", kk: "Компьютер деген не" } },
  { id: "base.inside", ent: "t01", topic: BASICS, title: { ru: "Что внутри компьютера", kk: "Компьютердің ішінде не бар" } },
  { id: "base.devices", ent: "t01", topic: BASICS, title: { ru: "Устройства ввода и вывода", kk: "Енгізу және шығару құрылғылары" } },
  { id: "base.media", ent: "t01", topic: BASICS, title: { ru: "Носители информации", kk: "Ақпарат тасығыштар" } },
  { id: "base.cpu", ent: "t01", topic: BASICS, title: { ru: "Как работают процессор и память", kk: "Процессор мен жад қалай жұмыс істейді" } },
  { id: "base.os", ent: "t08", topic: BASICS, title: { ru: "Операционная система и файлы", kk: "Операциялық жүйе және файлдар" } },
  { id: "base.keys", ent: "t08", topic: BASICS, title: { ru: "Клавиатура и горячие клавиши", kk: "Пернетақта және жылдам пернелер" } },
  { id: "base.info", ent: "t03", topic: BASICS, title: { ru: "Информация и её объём", kk: "Ақпарат және оның көлемі" } },

  // ---------- Раздел 1: информация и системы счисления ----------
  { id: "ns.base", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Основание и цифры систем", kk: "Жүйе негізі мен цифрлары" } },
  { id: "ns.bin2dec", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Перевод 2 → 10", kk: "2 → 10 аудару" } },
  { id: "ns.dec2bin", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Перевод 10 → 2", kk: "10 → 2 аудару" } },
  { id: "ns.props", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Свойства двоичных чисел", kk: "Екілік сандардың қасиеттері" } },
  { id: "ns.octhex", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Перевод 2 ↔ 8 ↔ 16", kk: "2 ↔ 8 ↔ 16 аудару" } },
  { id: "ns.anybase", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Любое основание ↔ 10", kk: "Кез келген негіз ↔ 10" } },
  { id: "ns.arith", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Арифметика в двоичной системе", kk: "Екілік жүйедегі арифметика" } },
  { id: "info.units", ent: "t03", topic: INFO, title: { ru: "Единицы информации", kk: "Ақпарат өлшем бірліктері" } },
  { id: "info.formula", ent: "t03", topic: INFO, title: { ru: "Формулы N = 2ⁱ и I = K·i", kk: "N = 2ⁱ және I = K·i формулалары" } },
  { id: "info.text", ent: "t03", topic: INFO, title: { ru: "Кодирование текста", kk: "Мәтінді кодтау" } },
  { id: "info.media", ent: "t03", topic: INFO, title: { ru: "Кодирование изображений и звука", kk: "Кескінді және дыбысты кодтау" } },
  { id: "ns.compare", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Сравнение чисел в разных системах", kk: "Әртүрлі жүйедегі сандарды салыстыру" } },
  { id: "ns.count", ent: "t04", topic: NUMBER_SYSTEMS, title: { ru: "Подсчёт цифр в двоичной записи", kk: "Екілік жазбадағы цифрларды санау" } },
  { id: "info.alphabet", ent: "t03", topic: INFO, title: { ru: "Алфавитный подход", kk: "Әліпбилік тәсіл" } },
  { id: "info.textvol", ent: "t03", topic: INFO, title: { ru: "Информационный объём текста", kk: "Мәтіннің ақпараттық көлемі" } },
  { id: "info.encodings", ent: "t03", topic: INFO, title: { ru: "Кодировки символов", kk: "Таңбаларды кодтау кестелері" } },
  { id: "info.graphics", ent: "t03", topic: INFO, title: { ru: "Кодирование растровых изображений", kk: "Растрлық кескіндерді кодтау" } },
  { id: "info.sound", ent: "t03", topic: INFO, title: { ru: "Кодирование звука и видео", kk: "Дыбыс пен бейнені кодтау" } },

  // ---------- Раздел 2: логика ----------
  { id: "logic.ops", ent: "t05", topic: LOGIC, title: { ru: "Логические операции", kk: "Логикалық амалдар" } },
  { id: "logic.tables", ent: "t05", topic: LOGIC, title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" } },
  { id: "logic.circuits", ent: "t05", topic: LOGIC, title: { ru: "Логические схемы", kk: "Логикалық схемалар" } },
  { id: "logic.laws", ent: "t05", topic: LOGIC, title: { ru: "Законы логики", kk: "Логика заңдары" } },
  { id: "logic.impl", ent: "t05", topic: LOGIC, title: { ru: "Импликация и эквиваленция", kk: "Импликация және эквиваленция" } },
  { id: "logic.build", ent: "t05", topic: LOGIC, title: { ru: "Построение таблиц истинности", kk: "Ақиқат кестесін құру" } },
  { id: "logic.schemes", ent: "t05", topic: LOGIC, title: { ru: "Схемы ↔ формулы", kk: "Схемалар ↔ формулалар" } },
  { id: "logic.numbers", ent: "t05", topic: LOGIC, title: { ru: "Логические выражения с числами", kk: "Сандары бар логикалық өрнектер" } },
  { id: "logic.sets", ent: "t05", topic: LOGIC, title: { ru: "Множества и круги Эйлера", kk: "Жиындар және Эйлер дөңгелектері" } },
  { id: "logic.reasoning", ent: "t05", topic: LOGIC, title: { ru: "Логические задачи на рассуждение", kk: "Пайымдауға арналған логикалық есептер" } },

  // ---------- Раздел 3: Python и алгоритмы ----------
  { id: "algo.basics", ent: "t07", topic: PYTHON, title: { ru: "Алгоритмы и блок-схемы", kk: "Алгоритмдер және блок-сызбалар" } },
  { id: "py.vars", ent: "t06", topic: PYTHON, title: { ru: "Переменные и выражения", kk: "Айнымалылар және өрнектер" } },
  { id: "py.if", ent: "t06", topic: PYTHON, title: { ru: "Ветвления", kk: "Тармақталу" } },
  { id: "py.loops", ent: "t06", topic: PYTHON, title: { ru: "Циклы", kk: "Циклдер" } },
  { id: "py.strings", ent: "t07", topic: PYTHON, title: { ru: "Строки", kk: "Жолдар" } },
  { id: "py.lists", ent: "t06", topic: PYTHON, title: { ru: "Списки", kk: "Тізімдер" } },
  { id: "py.functions", ent: "t07", topic: PYTHON, title: { ru: "Функции и рекурсия", kk: "Функциялар және рекурсия" } },
  { id: "py.algos", ent: "t07", topic: PYTHON, title: { ru: "Сортировка, поиск, файлы, графы", kk: "Сұрыптау, іздеу, файлдар, графтар" } },
  { id: "py.trace", ent: "t06", topic: PYTHON, title: { ru: "Что выведет программа", kk: "Программа не шығарады" } },
  { id: "py.io", ent: "t06", topic: PYTHON, title: { ru: "Ввод и вывод", kk: "Енгізу және шығару" } },
  { id: "py.types", ent: "t06", topic: PYTHON, title: { ru: "Типы данных", kk: "Деректер типтері" } },
  { id: "py.ops", ent: "t06", topic: PYTHON, title: { ru: "Арифметические операции", kk: "Арифметикалық амалдар" } },
  { id: "py.cond", ent: "t06", topic: PYTHON, title: { ru: "Сложные условия", kk: "Күрделі шарттар" } },
  { id: "py.for", ent: "t06", topic: PYTHON, title: { ru: "Цикл for", kk: "for циклі" } },
  { id: "py.while", ent: "t06", topic: PYTHON, title: { ru: "Цикл while", kk: "while циклі" } },
  { id: "py.nested", ent: "t06", topic: PYTHON, title: { ru: "Вложенные циклы", kk: "Кірістірілген циклдер" } },
  { id: "py.patterns", ent: "t07", topic: PYTHON, title: { ru: "Типовые алгоритмы", kk: "Типтік алгоритмдер" } },
  { id: "py.strmethods", ent: "t07", topic: PYTHON, title: { ru: "Срезы и методы строк", kk: "Жол тілімдері және әдістері" } },
  { id: "py.listops", ent: "t06", topic: PYTHON, title: { ru: "Обработка списков", kk: "Тізімдерді өңдеу" } },
  { id: "py.matrix", ent: "t06", topic: PYTHON, title: { ru: "Двумерные списки", kk: "Екіөлшемді тізімдер" } },
  { id: "py.params", ent: "t07", topic: PYTHON, title: { ru: "Параметры и return", kk: "Параметрлер және return" } },
  { id: "py.recursion", ent: "t07", topic: PYTHON, title: { ru: "Рекурсия", kk: "Рекурсия" } },
  { id: "py.sort", ent: "t07", topic: PYTHON, title: { ru: "Сортировка", kk: "Сұрыптау" } },
  { id: "py.search", ent: "t07", topic: PYTHON, title: { ru: "Поиск", kk: "Іздеу" } },
  { id: "py.files", ent: "t07", topic: PYTHON, title: { ru: "Работа с файлами", kk: "Файлдармен жұмыс" } },
  { id: "py.graphs", ent: "t07", topic: PYTHON, title: { ru: "Графы", kk: "Графтар" } },
  { id: "py.context", ent: "t06", topic: PYTHON, title: { ru: "Контекстные задания", kk: "Контекстік тапсырмалар" } },
  { id: "py.debug", ent: "t06", topic: PYTHON, title: { ru: "Ошибки и отладка", kk: "Қателер және жөндеу" } },

  // ---------- Раздел 4: базы данных ----------
  { id: "db.model", ent: "t09", topic: DB, title: { ru: "Реляционная модель данных", kk: "Деректердің реляциялық моделі" } },
  { id: "db.select", ent: "t10", topic: DB, title: { ru: "Запросы SELECT", kk: "SELECT сұраныстары" } },
  { id: "db.modify", ent: "t10", topic: DB, title: { ru: "Изменение данных и итоги", kk: "Деректерді өзгерту және қорытындылар" } },
  { id: "db.keys", ent: "t09", topic: DB, title: { ru: "Ключи и связи", kk: "Кілттер және байланыстар" } },
  { id: "db.design", ent: "t10", topic: DB, title: { ru: "Проектирование БД", kk: "ДҚ жобалау" } },
  { id: "db.where", ent: "t10", topic: DB, title: { ru: "Условия WHERE", kk: "WHERE шарттары" } },
  { id: "db.order", ent: "t10", topic: DB, title: { ru: "ORDER BY и DISTINCT", kk: "ORDER BY және DISTINCT" } },
  { id: "db.group", ent: "t10", topic: DB, title: { ru: "Агрегатные функции и группировка", kk: "Агрегаттық функциялар және топтау" } },
  { id: "db.join", ent: "t10", topic: DB, title: { ru: "Запросы к нескольким таблицам", kk: "Бірнеше кестеге сұраныстар" } },
  { id: "db.ddl", ent: "t10", topic: DB, title: { ru: "CREATE, INSERT, UPDATE, DELETE", kk: "CREATE, INSERT, UPDATE, DELETE" } },

  // ---------- Раздел 5: устройство компьютера и ПО ----------
  { id: "pc.devices", ent: "t01", topic: PC, title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" } },
  { id: "pc.cpu", ent: "t01", topic: PC, title: { ru: "Процессор и память", kk: "Процессор және жад" } },
  { id: "pc.software", ent: "t08", topic: PC, title: { ru: "Программное обеспечение", kk: "Программалық қамтамасыз ету" } },
  { id: "pc.neumann", ent: "t01", topic: PC, title: { ru: "Принципы фон Неймана", kk: "Фон Нейман қағидалары" } },
  { id: "pc.memory", ent: "t01", topic: PC, title: { ru: "Виды памяти", kk: "Жад түрлері" } },
  { id: "pc.os", ent: "t08", topic: PC, title: { ru: "ОС и файловые системы", kk: "ОЖ және файлдық жүйелер" } },
  { id: "pc.licenses", ent: "t08", topic: PC, title: { ru: "Виды ПО и лицензии", kk: "ПҚ түрлері және лицензиялар" } },
  { id: "pc.archives", ent: "t08", topic: PC, title: { ru: "Сжатие и форматы файлов", kk: "Сығу және файл пішімдері" } },

  // ---------- Раздел 6: сети и безопасность ----------
  { id: "net.basics", ent: "t02", topic: NET, title: { ru: "Компьютерные сети", kk: "Компьютерлік желілер" } },
  { id: "net.addr", ent: "t02", topic: NET, title: { ru: "IP-адреса, URL и DNS", kk: "IP мекенжайлар, URL және DNS" } },
  { id: "net.speed", ent: "t02", topic: NET, title: { ru: "Скорость передачи данных", kk: "Деректерді беру жылдамдығы" } },
  { id: "net.security", ent: "t02", topic: NET, title: { ru: "Информационная безопасность", kk: "Ақпараттық қауіпсіздік" } },
  { id: "net.topology", ent: "t02", topic: NET, title: { ru: "Виды сетей и топологии", kk: "Желі түрлері және топологиялар" } },
  { id: "net.hardware", ent: "t02", topic: NET, title: { ru: "Сетевое оборудование", kk: "Желілік жабдықтар" } },
  { id: "net.protocols", ent: "t02", topic: NET, title: { ru: "Сетевые протоколы", kk: "Желілік хаттамалар" } },
  { id: "net.mask", ent: "t02", topic: NET, title: { ru: "Маска и адрес сети", kk: "Маска және желі мекенжайы" } },
  { id: "net.malware", ent: "t02", topic: NET, title: { ru: "Вредоносные программы", kk: "Зиянды программалар" } },
  { id: "net.crypto", ent: "t02", topic: NET, title: { ru: "Шифрование и ЭЦП", kk: "Шифрлау және ЭЦҚ" } },

  // ---------- Раздел 7: таблицы, документы и веб ----------
  { id: "sheets.formulas", ent: "t12", topic: OFFICE, title: { ru: "Формулы в электронных таблицах", kk: "Электрондық кестелердегі формулалар" } },
  { id: "sheets.refs", ent: "t12", topic: OFFICE, title: { ru: "Ссылки и функции", kk: "Сілтемелер және функциялар" } },
  { id: "web.html", ent: "t13", topic: OFFICE, title: { ru: "HTML", kk: "HTML" } },
  { id: "web.css", ent: "t13", topic: OFFICE, title: { ru: "CSS и веб-проектирование", kk: "CSS және Web-жобалау" } },
  { id: "sheets.functions", ent: "t12", topic: OFFICE, title: { ru: "Стандартные функции таблиц", kk: "Кестелердің стандартты функциялары" } },
  { id: "sheets.if", ent: "t12", topic: OFFICE, title: { ru: "Функция ЕСЛИ", kk: "ЕСЛИ функциясы" } },
  { id: "sheets.text", ent: "t12", topic: OFFICE, title: { ru: "Текстовые функции", kk: "Мәтіндік функциялар" } },
  { id: "sheets.copy", ent: "t12", topic: OFFICE, title: { ru: "Копирование формул", kk: "Формулаларды көшіру" } },
  { id: "sheets.charts", ent: "t12", topic: OFFICE, title: { ru: "Диаграммы и фильтры", kk: "Диаграммалар және сүзгілер" } },
  { id: "docs.text", ent: "t12", topic: OFFICE, title: { ru: "Текстовые документы", kk: "Мәтіндік құжаттар" } },
  { id: "web.content", ent: "t13", topic: OFFICE, title: { ru: "Теги текста, списков и ссылок", kk: "Мәтін, тізім және сілтеме тегтері" } },
  { id: "web.tables", ent: "t13", topic: OFFICE, title: { ru: "HTML-таблицы и формы", kk: "HTML кестелері және формалары" } },
  { id: "web.layout", ent: "t13", topic: OFFICE, title: { ru: "Блочная модель CSS", kk: "CSS блоктық моделі" } },

  // ---------- Раздел 8: современные IT ----------
  { id: "it.trends", ent: "t11", topic: IT, title: { ru: "ИИ, облака, интернет вещей", kk: "ЖИ, бұлтты технологиялар, заттар интернеті" } },
  { id: "it.startup", ent: "t11", topic: IT, title: { ru: "IT-стартап", kk: "IT-стартап" } },
  { id: "it.3d", ent: "t11", topic: IT, title: { ru: "3D-моделирование", kk: "3D жобалау" } },
  { id: "it.ai", ent: "t11", topic: IT, title: { ru: "Искусственный интеллект", kk: "Жасанды интеллект" } },
  { id: "it.data", ent: "t11", topic: IT, title: { ru: "Большие данные и облака", kk: "Үлкен деректер және бұлт" } },
  { id: "it.business", ent: "t11", topic: IT, title: { ru: "Бизнес-модель стартапа", kk: "Стартаптың бизнес-моделі" } },
  { id: "it.print", ent: "t11", topic: IT, title: { ru: "3D-печать", kk: "3D басып шығару" } },

  // ---------- Раздел 9: как решать ЕНТ ----------
  { id: "ent.strategy", topic: ENT, title: { ru: "Стратегия ЕНТ", kk: "ҰБТ стратегиясы" } },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
