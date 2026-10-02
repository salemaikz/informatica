import type { Lesson, Unit } from "@/lib/types";
import { lessonBinary } from "./lessons/ns-1-binary";
import { lessonBits } from "./lessons/ns-1-bits";
import { lessonRead } from "./lessons/ns-2-read";
import { lessonWrite } from "./lessons/ns-3-write";
import { lessonTraps } from "./lessons/ns-4-traps";

// Карта курса подготовки к ЕНТ по информатике: 9 разделов по спецификации ЕНТ-2026 (docs/ENT.md).
// status: "soon" — урок запланирован, но ещё не написан (см. docs/PLAN.md).

export const UNITS: Unit[] = [
  {
    id: "u1",
    title: { ru: "Информация и системы счисления", kk: "Ақпарат және санау жүйелері" },
    description: { ru: "Как компьютер хранит и измеряет информацию", kk: "Компьютер ақпаратты қалай сақтайды және өлшейді" },
    color: "#1a91d6",
    lessons: [
      { id: "ns-1-bits", title: lessonBits.title, status: "available" },
      { id: "ns-2-read", title: lessonRead.title, status: "available" },
      { id: "ns-3-write", title: lessonWrite.title, status: "available" },
      { id: "ns-4-traps", title: lessonTraps.title, status: "available" },
      { id: "ns-5-oct-hex", title: { ru: "Восьмеричная и шестнадцатеричная", kk: "Сегіздік және он алтылық жүйелер" }, status: "soon" },
      { id: "ns-6-arith", title: { ru: "Арифметика в двоичной системе", kk: "Екілік жүйедегі арифметика" }, status: "soon" },
      { id: "info-1-units", title: { ru: "Единицы измерения информации", kk: "Ақпараттың өлшем бірліктері" }, status: "soon" },
      { id: "info-2-coding", title: { ru: "Кодирование текста, изображений и звука", kk: "Мәтінді, суретті және дыбысты кодтау" }, status: "soon" },
    ],
  },
  {
    id: "u2",
    title: { ru: "Логика", kk: "Логика" },
    description: { ru: "Логические основы компьютера", kk: "Компьютердің логикалық негіздері" },
    color: "#0f9f8f",
    lessons: [
      { id: "logic-1-ops", title: { ru: "Логические операции", kk: "Логикалық амалдар" }, status: "soon" },
      { id: "logic-2-tables", title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" }, status: "soon" },
      { id: "logic-3-circuits", title: { ru: "Логические схемы", kk: "Логикалық схемалар" }, status: "soon" },
    ],
  },
  {
    id: "u3",
    title: { ru: "Python и алгоритмы", kk: "Python және алгоритмдер" },
    description: { ru: "От блок-схем до программ — и задания «что выведет программа»", kk: "Блок-сызбалардан бағдарламаларға дейін — «бағдарлама не шығарады» тапсырмалары" },
    color: "#e0457b",
    lessons: [
      { id: "algo-1-basics", title: { ru: "Алгоритмы и блок-схемы", kk: "Алгоритмдер және блок-сызбалар" }, status: "soon" },
      { id: "py-1-vars", title: { ru: "Переменные и типы данных", kk: "Айнымалылар және деректер типтері" }, status: "soon" },
      { id: "py-2-if", title: { ru: "Ветвления", kk: "Тармақталу" }, status: "soon" },
      { id: "py-3-loops", title: { ru: "Циклы", kk: "Циклдер" }, status: "soon" },
      { id: "py-4-strings", title: { ru: "Строки и списки", kk: "Жолдар және тізімдер" }, status: "soon" },
      { id: "py-5-functions", title: { ru: "Функции и рекурсия", kk: "Функциялар және рекурсия" }, status: "soon" },
      { id: "py-6-algos", title: { ru: "Сортировка, файлы, графы", kk: "Сұрыптау, файлдар, графтар" }, status: "soon" },
      { id: "py-7-trace", title: { ru: "Что выведет программа", kk: "Бағдарлама не шығарады" }, status: "soon" },
    ],
  },
  {
    id: "u4",
    title: { ru: "Базы данных и SQL", kk: "Деректер қоры және SQL" },
    description: { ru: "Таблицы, связи и запросы", kk: "Кестелер, байланыстар және сұраныстар" },
    color: "#c2410c",
    lessons: [
      { id: "db-1-relational", title: { ru: "Реляционные базы данных", kk: "Реляциялық деректер қоры" }, status: "soon" },
      { id: "db-2-sql", title: { ru: "SQL-запросы", kk: "SQL сұраныстары" }, status: "soon" },
    ],
  },
  {
    id: "u5",
    title: { ru: "Устройство компьютера и ПО", kk: "Компьютердің құрылымы және бағдарламалық қамтамасыз ету" },
    description: { ru: "Процессор, память, устройства, программы", kk: "Процессор, жад, құрылғылар, бағдарламалар" },
    color: "#5b63e6",
    lessons: [
      { id: "pc-1-arch", title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" }, status: "soon" },
      { id: "pc-2-memory", title: { ru: "Процессор и память", kk: "Процессор және жад" }, status: "soon" },
      { id: "pc-3-software", title: { ru: "Программное обеспечение", kk: "Бағдарламалық қамтамасыз ету" }, status: "soon" },
    ],
  },
  {
    id: "u6",
    title: { ru: "Сети и безопасность", kk: "Желілер және қауіпсіздік" },
    description: { ru: "Как устроены сети и интернет, как защищать информацию", kk: "Желілер мен интернет қалай құрылған, ақпаратты қалай қорғау керек" },
    color: "#0e8fb0",
    lessons: [
      { id: "net-1-basics", title: { ru: "Компьютерные сети", kk: "Компьютерлік желілер" }, status: "soon" },
      { id: "net-2-internet", title: { ru: "Интернет: IP, URL, скорость передачи", kk: "Интернет: IP, URL, жіберу жылдамдығы" }, status: "soon" },
      { id: "net-3-security", title: { ru: "Информационная безопасность", kk: "Ақпараттық қауіпсіздік" }, status: "soon" },
    ],
  },
  {
    id: "u7",
    title: { ru: "Таблицы, документы и веб", kk: "Кестелер, құжаттар және веб" },
    description: { ru: "Формулы и ссылки в электронных таблицах, HTML", kk: "Электрондық кестелердегі формулалар мен сілтемелер, HTML" },
    color: "#b7791f",
    lessons: [
      { id: "data-1-sheets", title: { ru: "Электронные таблицы", kk: "Электрондық кестелер" }, status: "soon" },
      { id: "web-1-html", title: { ru: "Веб-страница: HTML и CSS", kk: "Веб-бет: HTML және CSS" }, status: "soon" },
    ],
  },
  {
    id: "u8",
    title: { ru: "Современные IT", kk: "Заманауи IT" },
    description: { ru: "Стартапы, 3D-моделирование, ИИ, облака", kk: "Стартаптар, 3D жобалау, ЖИ, бұлттар" },
    color: "#64748b",
    lessons: [{ id: "it-1-trends", title: { ru: "Тенденции развития IT", kk: "IT дамуының үрдістері" }, status: "soon" }],
  },
  {
    id: "u9",
    title: { ru: "Как решать ЕНТ", kk: "ҰБТ тапсырмаларын қалай орындау керек" },
    description: { ru: "Стратегия, время, частичные баллы, пробный тест", kk: "Стратегия, уақыт, ішінара ұпайлар, сынақ тест" },
    color: "#334155",
    lessons: [{ id: "ent-1-strategy", title: { ru: "Стратегия и пробный ЕНТ", kk: "Стратегия және сынақ ҰБТ" }, status: "soon" }],
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
};

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
