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

export const SKILLS: Skill[] = [
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

  // ---------- Раздел 2: логика ----------
  { id: "logic.ops", ent: "t05", topic: LOGIC, title: { ru: "Логические операции", kk: "Логикалық амалдар" } },
  { id: "logic.tables", ent: "t05", topic: LOGIC, title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" } },
  { id: "logic.circuits", ent: "t05", topic: LOGIC, title: { ru: "Логические схемы", kk: "Логикалық схемалар" } },
  { id: "logic.laws", ent: "t05", topic: LOGIC, title: { ru: "Законы логики", kk: "Логика заңдары" } },

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

  // ---------- Раздел 4: базы данных ----------
  { id: "db.model", ent: "t09", topic: DB, title: { ru: "Реляционная модель данных", kk: "Деректердің реляциялық моделі" } },
  { id: "db.select", ent: "t10", topic: DB, title: { ru: "Запросы SELECT", kk: "SELECT сұраныстары" } },
  { id: "db.modify", ent: "t10", topic: DB, title: { ru: "Изменение данных и итоги", kk: "Деректерді өзгерту және қорытындылар" } },

  // ---------- Раздел 5: устройство компьютера и ПО ----------
  { id: "pc.devices", ent: "t01", topic: PC, title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" } },
  { id: "pc.cpu", ent: "t01", topic: PC, title: { ru: "Процессор и память", kk: "Процессор және жад" } },
  { id: "pc.software", ent: "t08", topic: PC, title: { ru: "Программное обеспечение", kk: "Программалық қамтамасыз ету" } },

  // ---------- Раздел 6: сети и безопасность ----------
  { id: "net.basics", ent: "t02", topic: NET, title: { ru: "Компьютерные сети", kk: "Компьютерлік желілер" } },
  { id: "net.addr", ent: "t02", topic: NET, title: { ru: "IP-адреса, URL и DNS", kk: "IP мекенжайлар, URL және DNS" } },
  { id: "net.speed", ent: "t02", topic: NET, title: { ru: "Скорость передачи данных", kk: "Деректерді беру жылдамдығы" } },
  { id: "net.security", ent: "t02", topic: NET, title: { ru: "Информационная безопасность", kk: "Ақпараттық қауіпсіздік" } },

  // ---------- Раздел 7: таблицы, документы и веб ----------
  { id: "sheets.formulas", ent: "t12", topic: OFFICE, title: { ru: "Формулы в электронных таблицах", kk: "Электрондық кестелердегі формулалар" } },
  { id: "sheets.refs", ent: "t12", topic: OFFICE, title: { ru: "Ссылки и функции", kk: "Сілтемелер және функциялар" } },
  { id: "web.html", ent: "t13", topic: OFFICE, title: { ru: "HTML", kk: "HTML" } },
  { id: "web.css", ent: "t13", topic: OFFICE, title: { ru: "CSS и веб-проектирование", kk: "CSS және Web-жобалау" } },

  // ---------- Раздел 8: современные IT ----------
  { id: "it.trends", ent: "t11", topic: IT, title: { ru: "ИИ, облака, интернет вещей", kk: "ЖИ, бұлтты технологиялар, заттар интернеті" } },
  { id: "it.startup", ent: "t11", topic: IT, title: { ru: "IT-стартап", kk: "IT-стартап" } },
  { id: "it.3d", ent: "t11", topic: IT, title: { ru: "3D-моделирование", kk: "3D жобалау" } },

  // ---------- Раздел 9: как решать ЕНТ ----------
  { id: "ent.strategy", topic: ENT, title: { ru: "Стратегия ЕНТ", kk: "ҰБТ стратегиясы" } },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
