import type { Lesson, Unit } from "@/lib/types";
import { lessonBinary } from "./lessons/ns-1-binary";
import { lessonBits } from "./lessons/ns-1-bits";
import { lessonRead } from "./lessons/ns-2-read";
import { lessonWrite } from "./lessons/ns-3-write";
import { lessonTraps } from "./lessons/ns-4-traps";
import { GENERATED_LESSONS } from "./lessons/generated";

// Карта курса подготовки к ЕНТ по информатике: 9 разделов по спецификации ЕНТ-2026 (docs/ENT.md).
// status: "soon" — урок запланирован, но ещё не написан (см. docs/PLAN.md).

export const UNITS: Unit[] = [
  // Старт с нуля: для тех, кто не знает, как устроен компьютер (решение #36). Знающие основы пропускают раздел (profile.skipBasics).
  {
    id: "u0",
    title: { ru: "Старт: компьютер с нуля", kk: "Бастау: компьютер нөлден" },
    description: {
      ru: "Что внутри компьютера, носители, процессор и память, ОС и файлы, горячие клавиши",
      kk: "Компьютердің ішінде не бар, тасығыштар, процессор мен жад, ОЖ және файлдар, жылдам пернелер",
    },
    color: "#0ea5a4",
    icon: "laptop",
    theme: "hardware",
    entTopics: ["t01", "t08", "t03"],
    lessons: [
      { id: "base-1-computer", title: { ru: "Что такое компьютер", kk: "Компьютер деген не" }, status: "soon" },
      { id: "base-2-inside", title: { ru: "Что внутри компьютера", kk: "Компьютердің ішінде не бар" }, status: "soon" },
      { id: "base-3-devices", title: { ru: "Устройства ввода и вывода", kk: "Енгізу және шығару құрылғылары" }, status: "soon" },
      { id: "base-4-media", title: { ru: "Носители информации", kk: "Ақпарат тасығыштар" }, status: "soon" },
      { id: "base-5-cpu", title: { ru: "Как компьютер вычисляет", kk: "Компьютер қалай есептейді" }, status: "soon" },
      { id: "base-6-os", title: { ru: "Операционная система и файлы", kk: "Операциялық жүйе және файлдар" }, status: "soon" },
      { id: "base-7-keys", title: { ru: "Клавиатура и горячие клавиши", kk: "Пернетақта және жылдам пернелер" }, status: "soon" },
      { id: "base-8-info", title: { ru: "Информация вокруг нас", kk: "Айналамыздағы ақпарат" }, status: "soon" },
    ],
  },
  {
    id: "u1",
    title: { ru: "Информация и системы счисления", kk: "Ақпарат және санау жүйелері" },
    description: { ru: "Системы счисления, единицы и объём информации, кодирование текста, графики и звука", kk: "Санау жүйелері, ақпарат бірліктері мен көлемі, мәтінді, графиканы және дыбысты кодтау" },
    color: "#1a91d6",
    icon: "binary",
    theme: "numbers",
    entTopics: ["t04", "t03"],
    lessons: [
      { id: "ns-1-bits", title: lessonBits.title, status: "available" },
      { id: "ns-2-read", title: lessonRead.title, status: "available" },
      { id: "ns-3-write", title: lessonWrite.title, status: "available" },
      { id: "ns-4-traps", title: lessonTraps.title, status: "available" },
      { id: "ns-5-oct-hex", title: { ru: "Восьмеричная и шестнадцатеричная системы", kk: "Сегіздік және он алтылық жүйелер" }, status: "soon" },
      { id: "ns-6-any-base", title: { ru: "Любая система счисления", kk: "Кез келген санау жүйесі" }, status: "soon" },
      { id: "ns-7-arith", title: { ru: "Арифметика в двоичной системе", kk: "Екілік жүйедегі арифметика" }, status: "soon" },
      { id: "ns-8-compare", title: { ru: "Сравнение чисел в разных системах", kk: "Әртүрлі жүйедегі сандарды салыстыру" }, status: "soon" },
      { id: "ns-9-count", title: { ru: "Сколько единиц в двоичной записи", kk: "Екілік жазбада неше бірлік бар" }, status: "soon" },
      { id: "info-1-units", title: { ru: "Единицы измерения информации", kk: "Ақпараттың өлшем бірліктері" }, status: "soon" },
      { id: "info-2-formula", title: { ru: "Сколько информации в сообщении", kk: "Хабарламада қанша ақпарат бар" }, status: "soon" },
      { id: "info-5-alphabet", title: { ru: "Алфавитный подход: N = 2ⁱ", kk: "Әліпбилік тәсіл: N = 2ⁱ" }, status: "soon" },
      { id: "info-6-text-volume", title: { ru: "Объём текста: задачи ЕНТ", kk: "Мәтін көлемі: ҰБТ есептері" }, status: "soon" },
      { id: "info-3-text", title: { ru: "Кодирование текста", kk: "Мәтінді кодтау" }, status: "soon" },
      { id: "info-7-encodings", title: { ru: "Кодировки: ASCII, KZ-1048, Unicode", kk: "Кодтаулар: ASCII, KZ-1048, Unicode" }, status: "soon" },
      { id: "info-4-media", title: { ru: "Кодирование изображений и звука", kk: "Кескінді және дыбысты кодтау" }, status: "soon" },
      { id: "info-8-graphics", title: { ru: "Растровая графика: пиксели и палитра", kk: "Растрлық графика: пиксельдер және палитра" }, status: "soon" },
      { id: "info-9-sound", title: { ru: "Звук и видео: оцифровка и объём", kk: "Дыбыс және бейне: цифрлау және көлем" }, status: "soon" },
    ],
  },
  {
    id: "u2",
    title: { ru: "Логика", kk: "Логика" },
    description: { ru: "Операции, таблицы истинности, схемы, законы, множества и логические задачи", kk: "Амалдар, ақиқат кестелері, схемалар, заңдар, жиындар және логикалық есептер" },
    color: "#0f9f8f",
    icon: "split",
    theme: "logic",
    entTopics: ["t05"],
    lessons: [
      { id: "logic-1-ops", title: { ru: "Высказывания и логические операции", kk: "Пікірлер және логикалық амалдар" }, status: "soon" },
      { id: "logic-5-impl", title: { ru: "Импликация и эквиваленция", kk: "Импликация және эквиваленция" }, status: "soon" },
      { id: "logic-2-tables", title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" }, status: "soon" },
      { id: "logic-6-build", title: { ru: "Таблица истинности сложного выражения", kk: "Күрделі өрнектің ақиқат кестесі" }, status: "soon" },
      { id: "logic-3-circuits", title: { ru: "Логические схемы", kk: "Логикалық схемалар" }, status: "soon" },
      { id: "logic-7-schemes", title: { ru: "Схемы и формулы: задачи уровня C", kk: "Схемалар мен формулалар: C деңгейіндегі есептер" }, status: "soon" },
      { id: "logic-4-laws", title: { ru: "Законы логики и упрощение", kk: "Логика заңдары және ықшамдау" }, status: "soon" },
      { id: "logic-8-numbers", title: { ru: "Логика с числами: при каком X истинно", kk: "Сандармен логика: X қандай болғанда ақиқат" }, status: "soon" },
      { id: "logic-9-sets", title: { ru: "Множества и запросы: круги Эйлера", kk: "Жиындар және сұраныстар: Эйлер дөңгелектері" }, status: "soon" },
      { id: "logic-10-reasoning", title: { ru: "Логические задачи: кто прав", kk: "Логикалық есептер: кім дұрыс" }, status: "soon" },
    ],
  },
  {
    id: "u3",
    title: { ru: "Python и алгоритмы", kk: "Python және алгоритмдер" },
    description: { ru: "От первой программы до рекурсии, сортировок и графов — и контекстные задания ЕНТ", kk: "Алғашқы программадан рекурсияға, сұрыптау мен графтарға дейін — және ҰБТ контекстік тапсырмалары" },
    color: "#e0457b",
    icon: "code",
    theme: "code",
    entTopics: ["t06", "t07"],
    lessons: [
      { id: "algo-1-basics", title: { ru: "Алгоритмы и блок-схемы", kk: "Алгоритмдер және блок-сызбалар" }, status: "soon" },
      { id: "py-0-start", title: { ru: "Первая программа: print и input", kk: "Алғашқы программа: print және input" }, status: "soon" },
      { id: "py-1-vars", title: { ru: "Переменные и выражения", kk: "Айнымалылар және өрнектер" }, status: "soon" },
      { id: "py-1b-types", title: { ru: "Типы данных: int, float, str, bool", kk: "Деректер типтері: int, float, str, bool" }, status: "soon" },
      { id: "py-1c-ops", title: { ru: "Операции: //, %, ** и порядок действий", kk: "Амалдар: //, %, ** және амалдар реті" }, status: "soon" },
      // Микроуроки цепочки «Ветвления» (этап 14, #46): if → if-else → elif, затем py-2-if собирает всё вместе.
      { id: "py-2a-if", title: { ru: "if: если условие верно", kk: "if: шарт ақиқат болса" }, status: "soon" },
      { id: "py-2a-else", title: { ru: "if–else: два пути", kk: "if–else: екі жол" }, status: "soon" },
      { id: "py-2a-elif", title: { ru: "elif: выбор из нескольких", kk: "elif: бірнеше нұсқадан таңдау" }, status: "soon" },
      { id: "py-2-if", title: { ru: "Ветвления", kk: "Тармақталу" }, status: "soon" },
      { id: "py-2b-logic", title: { ru: "Сложные условия: and, or, not, elif", kk: "Күрделі шарттар: and, or, not, elif" }, status: "soon" },
      { id: "py-3-loops", title: { ru: "Циклы", kk: "Циклдер" }, status: "soon" },
      // Микроуроки цепочки «range» (этап 14): перед подробным уроком про for.
      { id: "py-3a-range", title: { ru: "range(n): повторить n раз", kk: "range(n): n рет қайталау" }, status: "soon" },
      { id: "py-3a-range2", title: { ru: "range(a, b): от и до", kk: "range(a, b): бастау мен тоқтау" }, status: "soon" },
      { id: "py-3a-step", title: { ru: "range с шагом и счёт вниз", kk: "Қадамы бар range және кері санау" }, status: "soon" },
      { id: "py-3b-for", title: { ru: "Цикл for и range подробно", kk: "for циклі және range толығырақ" }, status: "soon" },
      { id: "py-3c-while", title: { ru: "Цикл while, break и continue", kk: "while циклі, break және continue" }, status: "soon" },
      { id: "py-3d-nested", title: { ru: "Вложенные циклы", kk: "Кірістірілген циклдер" }, status: "soon" },
      { id: "py-3e-patterns", title: { ru: "Типовые алгоритмы: сумма, счётчик, максимум", kk: "Типтік алгоритмдер: қосынды, санағыш, максимум" }, status: "soon" },
      { id: "py-4-strings", title: { ru: "Строки", kk: "Жолдар" }, status: "soon" },
      // Микроуроки цепочки «Срезы» (этап 14): перед уроком про срезы с шагом и методы строк.
      { id: "py-4a-index", title: { ru: "Индексы строки: с начала и с конца", kk: "Жол индекстері: басынан және соңынан" }, status: "soon" },
      { id: "py-4a-slice", title: { ru: "Срез [a:b]: где начало и конец", kk: "[a:b] тілімі: басы мен соңы қайда" }, status: "soon" },
      { id: "py-4a-step", title: { ru: "Срез с шагом: [::2] и [::-1]", kk: "Қадамы бар тілім: [::2] және [::-1]" }, status: "soon" },
      { id: "py-4b-methods", title: { ru: "Срезы и методы строк", kk: "Жол тілімдері және әдістері" }, status: "soon" },
      { id: "py-5-lists", title: { ru: "Списки", kk: "Тізімдер" }, status: "soon" },
      { id: "py-5b-listops", title: { ru: "Списки: методы и обработка", kk: "Тізімдер: әдістер және өңдеу" }, status: "soon" },
      { id: "py-5c-matrix", title: { ru: "Двумерные списки", kk: "Екіөлшемді тізімдер" }, status: "soon" },
      { id: "py-6-functions", title: { ru: "Функции и рекурсия", kk: "Функциялар және рекурсия" }, status: "soon" },
      { id: "py-6b-params", title: { ru: "Функции: параметры и return", kk: "Функциялар: параметрлер және return" }, status: "soon" },
      { id: "py-6c-recursion", title: { ru: "Рекурсия по шагам", kk: "Рекурсия қадам бойынша" }, status: "soon" },
      { id: "py-7-algos", title: { ru: "Сортировка, поиск, файлы и графы", kk: "Сұрыптау, іздеу, файлдар және графтар" }, status: "soon" },
      { id: "py-7a-sort", title: { ru: "Сортировки", kk: "Сұрыптау" }, status: "soon" },
      { id: "py-7b-search", title: { ru: "Линейный и бинарный поиск", kk: "Сызықтық және екілік іздеу" }, status: "soon" },
      { id: "py-7c-files", title: { ru: "Работа с файлами", kk: "Файлдармен жұмыс" }, status: "soon" },
      { id: "py-7d-graphs", title: { ru: "Графы и кратчайший путь", kk: "Графтар және ең қысқа жол" }, status: "soon" },
      { id: "py-8-trace", title: { ru: "Что выведет программа", kk: "Программа не шығарады" }, status: "soon" },
      { id: "py-8b-context", title: { ru: "Контекстные задания: касса", kk: "Контекстік тапсырмалар: касса" }, status: "soon" },
      { id: "py-8c-debug", title: { ru: "Ошибки в программах и отладка", kk: "Программадағы қателер және жөндеу" }, status: "soon" },
    ],
  },
  {
    id: "u4",
    title: { ru: "Базы данных и SQL", kk: "Деректер қоры және SQL" },
    description: { ru: "Таблицы, ключи и связи, проектирование, SQL: SELECT, WHERE, GROUP BY, JOIN", kk: "Кестелер, кілттер мен байланыстар, жобалау, SQL: SELECT, WHERE, GROUP BY, JOIN" },
    color: "#c2410c",
    icon: "database",
    theme: "data",
    entTopics: ["t09", "t10"],
    lessons: [
      { id: "db-1-relational", title: { ru: "Реляционные базы данных", kk: "Реляциялық деректер қоры" }, status: "soon" },
      { id: "db-4-keys", title: { ru: "Ключи и связи таблиц", kk: "Кестелердің кілттері және байланыстары" }, status: "soon" },
      { id: "db-5-design", title: { ru: "Проектирование базы данных", kk: "Деректер қорын жобалау" }, status: "soon" },
      { id: "db-2-select", title: { ru: "Запросы SELECT", kk: "SELECT сұраныстары" }, status: "soon" },
      { id: "db-6-where", title: { ru: "Условия WHERE", kk: "WHERE шарттары" }, status: "soon" },
      { id: "db-7-order", title: { ru: "Сортировка и уникальные значения", kk: "Сұрыптау және бірегей мәндер" }, status: "soon" },
      { id: "db-3-modify", title: { ru: "Изменение данных и итоги", kk: "Деректерді өзгерту және қорытындылар" }, status: "soon" },
      { id: "db-8-group", title: { ru: "Итоги: COUNT, SUM, AVG, GROUP BY", kk: "Қорытындылар: COUNT, SUM, AVG, GROUP BY" }, status: "soon" },
      { id: "db-9-join", title: { ru: "Запросы к двум таблицам", kk: "Екі кестеге сұраныстар" }, status: "soon" },
      { id: "db-10-ddl", title: { ru: "Создание и изменение таблиц", kk: "Кестелерді құру және өзгерту" }, status: "soon" },
    ],
  },
  {
    id: "u5",
    title: { ru: "Устройство компьютера и ПО", kk: "Компьютер құрылғысы және программалық қамтамасыз ету" },
    description: { ru: "Процессор и принципы фон Неймана, виды памяти, ОС, лицензии, архивация", kk: "Процессор және фон Нейман принциптері, жад түрлері, ОЖ, лицензиялар, мұрағаттау" },
    color: "#5b63e6",
    icon: "cpu",
    theme: "hardware",
    entTopics: ["t01", "t08"],
    lessons: [
      { id: "pc-1-devices", title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" }, status: "soon" },
      { id: "pc-2-cpu", title: { ru: "Процессор и память", kk: "Процессор және жад" }, status: "soon" },
      { id: "pc-4-neumann", title: { ru: "Принципы фон Неймана и магистраль", kk: "Фон Нейман принциптері және магистраль" }, status: "soon" },
      { id: "pc-5-memory", title: { ru: "Виды памяти: от регистров до облака", kk: "Жад түрлері: регистрлерден бұлтқа дейін" }, status: "soon" },
      { id: "pc-3-software", title: { ru: "Программное обеспечение", kk: "Программалық қамтамасыз ету" }, status: "soon" },
      { id: "pc-6-os", title: { ru: "Операционные системы и файловые системы", kk: "Операциялық жүйелер және файлдық жүйелер" }, status: "soon" },
      { id: "pc-7-licenses", title: { ru: "Виды программ и лицензии", kk: "Программа түрлері және лицензиялар" }, status: "soon" },
      { id: "pc-8-archives", title: { ru: "Архивация и форматы файлов", kk: "Мұрағаттау және файл пішімдері" }, status: "soon" },
    ],
  },
  {
    id: "u6",
    title: { ru: "Сети и безопасность", kk: "Желілер және қауіпсіздік" },
    description: { ru: "Как устроены сети и интернет, как защищать информацию", kk: "Желілер мен интернет қалай құрылған, ақпаратты қалай қорғау керек" },
    color: "#0e8fb0",
    icon: "globe",
    theme: "network",
    entTopics: ["t02"],
    lessons: [
      { id: "net-1-basics", title: { ru: "Компьютерные сети", kk: "Компьютерлік желілер" }, status: "soon" },
      { id: "net-5-topology", title: { ru: "Виды сетей и топологии", kk: "Желі түрлері және топологиялар" }, status: "soon" },
      { id: "net-6-hardware", title: { ru: "Сетевое оборудование", kk: "Желілік жабдықтар" }, status: "soon" },
      { id: "net-2-internet", title: { ru: "IP-адреса, URL и DNS", kk: "IP мекенжайлар, URL және DNS" }, status: "soon" },
      { id: "net-7-protocols", title: { ru: "Протоколы и модель TCP/IP", kk: "Хаттамалар және TCP/IP моделі" }, status: "soon" },
      { id: "net-8-mask", title: { ru: "IP-адрес и маска сети", kk: "IP мекенжай және желі маскасы" }, status: "soon" },
      { id: "net-3-speed", title: { ru: "Скорость передачи данных", kk: "Деректерді беру жылдамдығы" }, status: "soon" },
      { id: "net-4-security", title: { ru: "Информационная безопасность", kk: "Ақпараттық қауіпсіздік" }, status: "soon" },
      { id: "net-9-malware", title: { ru: "Вредоносные программы", kk: "Зиянды программалар" }, status: "soon" },
      { id: "net-10-crypto", title: { ru: "Шифрование и цифровая подпись", kk: "Шифрлау және цифрлық қолтаңба" }, status: "soon" },
    ],
  },
  {
    id: "u7",
    title: { ru: "Таблицы, документы и веб", kk: "Кестелер, құжаттар және веб" },
    description: { ru: "Формулы, функции и ссылки в таблицах, диаграммы, документы, HTML и CSS", kk: "Кестелердегі формулалар, функциялар мен сілтемелер, диаграммалар, құжаттар, HTML және CSS" },
    color: "#b7791f",
    icon: "table",
    theme: "office",
    entTopics: ["t12", "t13"],
    lessons: [
      { id: "data-1-sheets", title: { ru: "Электронные таблицы и формулы", kk: "Электрондық кестелер және формулалар" }, status: "soon" },
      // Микроуроки цепочки «Ссылки» (этап 14): относительная → абсолютная → смешанная, затем data-2-refs.
      { id: "data-2a-relative", title: { ru: "Относительная ссылка: формула едет следом", kk: "Салыстырмалы сілтеме: формула бірге жылжиды" }, status: "soon" },
      { id: "data-2a-absolute", title: { ru: "Абсолютная ссылка: знак $", kk: "Абсолютті сілтеме: $ белгісі" }, status: "soon" },
      { id: "data-2a-mixed", title: { ru: "Смешанная ссылка: $A1 и A$1", kk: "Аралас сілтеме: $A1 және A$1" }, status: "soon" },
      { id: "data-2-refs", title: { ru: "Ссылки и функции", kk: "Сілтемелер және функциялар" }, status: "soon" },
      { id: "data-3-functions", title: { ru: "Функции СУММ, СРЗНАЧ, МАКС, МИН, СЧЁТ", kk: "СУММ, СРЗНАЧ, МАКС, МИН, СЧЁТ функциялары" }, status: "soon" },
      { id: "data-4-if", title: { ru: "Функция ЕСЛИ и условия", kk: "ЕСЛИ функциясы және шарттар" }, status: "soon" },
      { id: "data-5-text", title: { ru: "Текстовые функции", kk: "Мәтіндік функциялар" }, status: "soon" },
      { id: "data-6-copy", title: { ru: "Копирование формул: задачи ЕНТ", kk: "Формулаларды көшіру: ҰБТ есептері" }, status: "soon" },
      { id: "data-7-charts", title: { ru: "Диаграммы, сортировка и фильтр", kk: "Диаграммалар, сұрыптау және сүзгі" }, status: "soon" },
      { id: "doc-1-text", title: { ru: "Текстовые документы", kk: "Мәтіндік құжаттар" }, status: "soon" },
      { id: "web-1-html", title: { ru: "HTML: структура страницы", kk: "HTML: беттің құрылымы" }, status: "soon" },
      { id: "web-3-content", title: { ru: "HTML: текст, списки, ссылки, картинки", kk: "HTML: мәтін, тізімдер, сілтемелер, суреттер" }, status: "soon" },
      { id: "web-4-tables", title: { ru: "HTML: таблицы и формы", kk: "HTML: кестелер және формалар" }, status: "soon" },
      { id: "web-2-css", title: { ru: "CSS и веб-проектирование", kk: "CSS және Web-жобалау" }, status: "soon" },
      { id: "web-5-layout", title: { ru: "CSS: блоки, отступы, выравнивание", kk: "CSS: блоктар, шегіністер, туралау" }, status: "soon" },
    ],
  },
  {
    id: "u8",
    title: { ru: "Современные IT", kk: "Заманауи IT" },
    description: { ru: "Искусственный интеллект, облака, стартапы, 3D-моделирование", kk: "Жасанды интеллект, бұлтты технологиялар, стартаптар, 3D жобалау" },
    color: "#64748b",
    icon: "rocket",
    theme: "future",
    entTopics: ["t11"],
    lessons: [
      { id: "it-1-trends", title: { ru: "ИИ, облака и интернет вещей", kk: "ЖИ, бұлтты технологиялар және заттар интернеті" }, status: "soon" },
      { id: "it-4-ai", title: { ru: "Как учится искусственный интеллект", kk: "Жасанды интеллект қалай үйренеді" }, status: "soon" },
      { id: "it-5-data", title: { ru: "Большие данные, облака и IoT", kk: "Үлкен деректер, бұлт және IoT" }, status: "soon" },
      { id: "it-2-startup", title: { ru: "IT-стартап", kk: "IT-стартап" }, status: "soon" },
      { id: "it-6-business", title: { ru: "Бизнес-модель и питч стартапа", kk: "Стартаптың бизнес-моделі және питчі" }, status: "soon" },
      { id: "it-3-3d", title: { ru: "3D-моделирование", kk: "3D жобалау" }, status: "soon" },
      { id: "it-7-print", title: { ru: "3D-печать и форматы моделей", kk: "3D басып шығару және модель пішімдері" }, status: "soon" },
    ],
  },
  {
    id: "u9",
    title: { ru: "Как решать ЕНТ", kk: "ҰБТ тапсырмаларын қалай орындау керек" },
    description: { ru: "Стратегия, время, частичные баллы, пробный тест", kk: "Стратегия, уақыт, ішінара ұпайлар, сынақ тест" },
    color: "#334155",
    icon: "check",
    theme: "summit",
    lessons: [{ id: "ent-1-strategy", title: { ru: "Стратегия ЕНТ", kk: "ҰБТ стратегиясы" }, status: "soon" }],
  },
];

export const LESSONS: Record<string, Lesson> = {
  [lessonBits.id]: lessonBits,
  [lessonRead.id]: lessonRead,
  [lessonWrite.id]: lessonWrite,
  [lessonTraps.id]: lessonTraps,
  // Старый урок 1 (до серии из 4 уроков): не на карте, но нужен для прогресса,
  // открытых навыков и «работы над ошибками» тех, кто его уже прошёл.
  [lessonBinary.id]: lessonBinary,
  // Уроки контент-потока (этап 3): подключаются скриптом scripts/register-content.mjs.
  ...Object.fromEntries(GENERATED_LESSONS.map((l) => [l.id, l])),
};

// Урок на карте «готов», если он есть в LESSONS; название — из самого урока.
for (const unit of UNITS) {
  for (const ref of unit.lessons) {
    const lesson = LESSONS[ref.id];
    ref.status = lesson ? "available" : "soon";
    if (lesson) ref.title = lesson.title;
  }
}

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

/** Порядковый номер урока в курсе (1-based). */
export function lessonNumber(id: string): number {
  let n = 0;
  for (const u of UNITS) {
    for (const l of u.lessons) {
      n++;
      if (l.id === id) return n;
    }
  }
  return 0;
}

/** Навыки, открытые пройденными уроками — их можно тренировать. */
export function unlockedSkills(completedLessonIds: string[]): string[] {
  const set = new Set<string>();
  for (const id of completedLessonIds) LESSONS[id]?.skills.forEach((s) => set.add(s));
  return [...set];
}

/** Ищет шаг урока по id (для работы над ошибками). */
export function findStep(lessonId: string | undefined, stepId: string) {
  if (!lessonId) return undefined;
  return LESSONS[lessonId]?.steps.find((s) => s.id === stepId);
}
