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
  {
    id: "u1",
    title: { ru: "Информация и системы счисления", kk: "Ақпарат және санау жүйелері" },
    description: { ru: "Как компьютер хранит и измеряет информацию", kk: "Компьютер ақпаратты қалай сақтайды және өлшейді" },
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
      { id: "info-1-units", title: { ru: "Единицы измерения информации", kk: "Ақпараттың өлшем бірліктері" }, status: "soon" },
      { id: "info-2-formula", title: { ru: "Сколько информации в сообщении", kk: "Хабарламада қанша ақпарат бар" }, status: "soon" },
      { id: "info-3-text", title: { ru: "Кодирование текста", kk: "Мәтінді кодтау" }, status: "soon" },
      { id: "info-4-media", title: { ru: "Кодирование изображений и звука", kk: "Кескінді және дыбысты кодтау" }, status: "soon" },
    ],
  },
  {
    id: "u2",
    title: { ru: "Логика", kk: "Логика" },
    description: { ru: "Логические основы компьютера", kk: "Компьютердің логикалық негіздері" },
    color: "#0f9f8f",
    icon: "split",
    theme: "logic",
    entTopics: ["t05"],
    lessons: [
      { id: "logic-1-ops", title: { ru: "Высказывания и логические операции", kk: "Пікірлер және логикалық амалдар" }, status: "soon" },
      { id: "logic-2-tables", title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" }, status: "soon" },
      { id: "logic-3-circuits", title: { ru: "Логические схемы", kk: "Логикалық схемалар" }, status: "soon" },
      { id: "logic-4-laws", title: { ru: "Законы логики и упрощение", kk: "Логика заңдары және ықшамдау" }, status: "soon" },
    ],
  },
  {
    id: "u3",
    title: { ru: "Python и алгоритмы", kk: "Python және алгоритмдер" },
    description: { ru: "От блок-схем до программ — и задания «что выведет программа»", kk: "Блок-сызбалардан программаларға дейін — «программа не шығарады» тапсырмалары" },
    color: "#e0457b",
    icon: "code",
    theme: "code",
    entTopics: ["t06", "t07"],
    lessons: [
      { id: "algo-1-basics", title: { ru: "Алгоритмы и блок-схемы", kk: "Алгоритмдер және блок-сызбалар" }, status: "soon" },
      { id: "py-1-vars", title: { ru: "Переменные и выражения", kk: "Айнымалылар және өрнектер" }, status: "soon" },
      { id: "py-2-if", title: { ru: "Ветвления", kk: "Тармақталу" }, status: "soon" },
      { id: "py-3-loops", title: { ru: "Циклы", kk: "Циклдер" }, status: "soon" },
      { id: "py-4-strings", title: { ru: "Строки", kk: "Жолдар" }, status: "soon" },
      { id: "py-5-lists", title: { ru: "Списки", kk: "Тізімдер" }, status: "soon" },
      { id: "py-6-functions", title: { ru: "Функции и рекурсия", kk: "Функциялар және рекурсия" }, status: "soon" },
      { id: "py-7-algos", title: { ru: "Сортировка, поиск, файлы и графы", kk: "Сұрыптау, іздеу, файлдар және графтар" }, status: "soon" },
      { id: "py-8-trace", title: { ru: "Что выведет программа", kk: "Программа не шығарады" }, status: "soon" },
    ],
  },
  {
    id: "u4",
    title: { ru: "Базы данных и SQL", kk: "Деректер қоры және SQL" },
    description: { ru: "Таблицы, связи и запросы", kk: "Кестелер, байланыстар және сұраныстар" },
    color: "#c2410c",
    icon: "database",
    theme: "data",
    entTopics: ["t09", "t10"],
    lessons: [
      { id: "db-1-relational", title: { ru: "Реляционные базы данных", kk: "Реляциялық деректер қоры" }, status: "soon" },
      { id: "db-2-select", title: { ru: "Запросы SELECT", kk: "SELECT сұраныстары" }, status: "soon" },
      { id: "db-3-modify", title: { ru: "Изменение данных и итоги", kk: "Деректерді өзгерту және қорытындылар" }, status: "soon" },
    ],
  },
  {
    id: "u5",
    title: { ru: "Устройство компьютера и ПО", kk: "Компьютер құрылғысы және программалық қамтамасыз ету" },
    description: { ru: "Процессор, память, устройства, программы", kk: "Процессор, жад, құрылғылар, программалар" },
    color: "#5b63e6",
    icon: "cpu",
    theme: "hardware",
    entTopics: ["t01", "t08"],
    lessons: [
      { id: "pc-1-devices", title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" }, status: "soon" },
      { id: "pc-2-cpu", title: { ru: "Процессор и память", kk: "Процессор және жад" }, status: "soon" },
      { id: "pc-3-software", title: { ru: "Программное обеспечение", kk: "Программалық қамтамасыз ету" }, status: "soon" },
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
      { id: "net-2-internet", title: { ru: "IP-адреса, URL и DNS", kk: "IP мекенжайлар, URL және DNS" }, status: "soon" },
      { id: "net-3-speed", title: { ru: "Скорость передачи данных", kk: "Деректерді беру жылдамдығы" }, status: "soon" },
      { id: "net-4-security", title: { ru: "Информационная безопасность", kk: "Ақпараттық қауіпсіздік" }, status: "soon" },
    ],
  },
  {
    id: "u7",
    title: { ru: "Таблицы, документы и веб", kk: "Кестелер, құжаттар және веб" },
    description: { ru: "Формулы и ссылки в электронных таблицах, HTML и CSS", kk: "Электрондық кестелердегі формулалар мен сілтемелер, HTML және CSS" },
    color: "#b7791f",
    icon: "table",
    theme: "office",
    entTopics: ["t12", "t13"],
    lessons: [
      { id: "data-1-sheets", title: { ru: "Электронные таблицы и формулы", kk: "Электрондық кестелер және формулалар" }, status: "soon" },
      { id: "data-2-refs", title: { ru: "Ссылки и функции", kk: "Сілтемелер және функциялар" }, status: "soon" },
      { id: "web-1-html", title: { ru: "HTML: структура страницы", kk: "HTML: беттің құрылымы" }, status: "soon" },
      { id: "web-2-css", title: { ru: "CSS и веб-проектирование", kk: "CSS және Web-жобалау" }, status: "soon" },
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
      { id: "it-2-startup", title: { ru: "IT-стартап", kk: "IT-стартап" }, status: "soon" },
      { id: "it-3-3d", title: { ru: "3D-моделирование", kk: "3D жобалау" }, status: "soon" },
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
