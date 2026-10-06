import type { ChoiceStep, L, Level, MultiStep, Text } from "./types";
import { CURRICULUM_QUESTIONS } from "./bank/curriculum";
import { CONTEXTS, buildContextPractice } from "@/content/contexts";
import { seeded, shuffle } from "./text";

// Правила оценивания ЕНТ (Правила проведения ЕНТ, п. 18; подробности — docs/ENT.md).

/** Баллы за задание «один или несколько верных» / «соответствие» (максимум 2, верных — не больше трёх). */
export function entPoints(totalCorrect: number, chosenCorrect: number, chosenWrong: number): 0 | 1 | 2 {
  if (chosenWrong >= 2 || chosenCorrect === 0) return 0;
  if (chosenCorrect === totalCorrect && chosenWrong === 0) return 2;
  // 1 балл: все верные + один лишний; при двух/трёх верных — хотя бы (верных − 1) без двух лишних.
  // При трёх верных один угаданный — 0.
  return chosenCorrect >= Math.max(1, totalCorrect - 1) ? 1 : 0;
}

/** Баллы ЕНТ за выбор вариантов в задании с несколькими верными ответами. */
export function multiPoints(correct: number[], chosen: number[]): 0 | 1 | 2 {
  const right = new Set(correct);
  const picked = new Set(chosen);
  let c = 0;
  let w = 0;
  for (const i of picked) {
    if (right.has(i)) c++;
    else w++;
  }
  return entPoints(right.size, c, w);
}

/** Уровень сложности по освоению навыка: новичку — A, уверенному — C. */
export function levelFromMastery(mastery: number): Level {
  if (mastery < 0.5) return 1;
  if (mastery < 0.8) return 2;
  return 3;
}

/** Буква уровня как в спецификации ЕНТ. */
export const LEVEL_LETTER: Record<Level, "A" | "B" | "C"> = { 1: "A", 2: "B", 3: "C" };

export interface EntMatchQuestion {
  id: string;
  type: "ent-match";
  skill: string;
  level: Level;
  prompt: L;
  left: Text[];
  options: Text[];
  correct: number[];
  explanation: L;
}

export type EntQuestion = ChoiceStep | MultiStep | EntMatchQuestion;
export interface EntMock { id: string; title: L; questions: EntQuestion[]; contextId: string; maxPoints: 50 }
const l = (ru: string, kk: string): L => ({ ru, kk });

function matching(id: string, skill: string, level: Level, left: Text[], options: Text[], explanation: L): EntMatchQuestion {
  return { id: `ent-match:${id}`, type: "ent-match", skill, level, prompt: l("Для каждого пункта выбери одно подходящее описание.", "Әр тармаққа бір сәйкес сипаттаманы таңда."), left, options, correct: [0, 1], explanation };
}

export const ENT_MATCH_QUESTIONS: EntMatchQuestion[] = [
  matching("units", "info.units", 1, ["1 байт", "1 Кбайт"], ["8 бит", "1024 байт", "8 байт", "1000 бит"], l("1 байт=8 бит; в условии курса 1 Кбайт=1024 байта.", "1 байт=8 бит; курс шартында 1 Кбайт=1024 байт.")),
  matching("logic", "logic.ops", 1, ["∧", "∨"], [l("И", "ЖӘНЕ"), l("ИЛИ", "НЕМЕСЕ"), l("НЕ", "ЕМЕС"), l("Исключающее ИЛИ", "Айырықша НЕМЕСЕ")], l("∧ — конъюнкция, ∨ — дизъюнкция.", "∧ — конъюнкция, ∨ — дизъюнкция.")),
  matching("memory", "pc.devices", 1, [l("ОЗУ", "Жедел жад"), "SSD"], [l("Рабочая память, теряет данные без питания", "Жұмыс жады, қуатсыз деректерді жоғалтады"), l("Накопитель для постоянного хранения файлов", "Файлдарды тұрақты сақтайтын жинақтауыш"), l("Устройство печати", "Басып шығару құрылғысы"), l("Устройство ввода звука", "Дыбыс енгізу құрылғысы")], l("ОЗУ хранит текущие данные, SSD — файлы без питания.", "Жедел жад ағымдағы деректерді, SSD файлдарды қуатсыз да сақтайды.")),
  matching("web", "web.htmlcss", 1, ["a", "img"], [l("Ссылка", "Сілтеме"), l("Изображение", "Кескін"), l("Строка таблицы", "Кесте жолы"), l("Абзац", "Абзац")], l("a задаёт ссылку, img вставляет изображение.", "a сілтеме береді, img кескін кірістіреді.")),
  matching("objects", "data.documents", 1, ["SVG", "CSV"], [l("Векторная графика", "Векторлық графика"), l("Текстовые табличные данные", "Мәтіндік кесте деректері"), l("Сжатый звук", "Сығылған дыбыс"), l("Команда SQL", "SQL командасы")], l("SVG хранит фигуры, CSV — строки табличных значений.", "SVG фигураларды, CSV кестелік мән жолдарын сақтайды.")),
  matching("net", "net.basics", 2, ["DNS", "TCP"], [l("Сопоставление имени с IP", "Атауды IP-мен сәйкестендіру"), l("Упорядоченная доставка потока", "Ағынның реттелген жеткізілуі"), l("Глубина цвета", "Түс тереңдігі"), l("Макет документа", "Құжат үлгісі")], l("DNS отвечает за имена, TCP — за транспорт потока.", "DNS атауларға, TCP ағынды тасымалдауға жауап береді.")),
  matching("keys", "db.relational", 2, [l("Первичный ключ", "Бастапқы кілт"), l("Внешний ключ", "Сыртқы кілт")], [l("Уникально идентифицирует запись", "Жазбаны бірегей анықтайды"), l("Ссылается на ключ связанной таблицы", "Байланысқан кесте кілтіне сілтейді"), l("Любая повторяющаяся подпись", "Кез келген қайталанатын атау"), l("Только цвет ячейки", "Тек ұяшық түсі")], l("Первичный ключ идентифицирует, внешний связывает таблицы.", "Бастапқы кілт анықтайды, сыртқы кілт кестелерді байланыстырады.")),
  matching("sheets", "data.sheets", 2, ["$A2", "B$1"], [l("Столбец закреплён, строка меняется", "Баған бекітілген, жол өзгереді"), l("Строка закреплена, столбец меняется", "Жол бекітілген, баған өзгереді"), l("Обе части закреплены", "Екі бөлік те бекітілген"), l("Обе части меняются", "Екі бөлік те өзгереді")], l("$ закрепляет следующий компонент адреса.", "$ мекенжайдың келесі бөлігін бекітеді.")),
  matching("files", "py.files", 2, ["w", "a"], [l("Запись с очисткой прежнего содержимого", "Бұрынғы мазмұнды тазалап жазу"), l("Добавление в конец", "Соңына қосу"), l("Только чтение", "Тек оқу"), l("Сортировка строк", "Жолдарды сұрыптау")], l("w очищает файл, a дописывает.", "w файлды тазартады, a соңына қосады.")),
  matching("security", "net.security", 2, [l("Подпись", "Қолтаңба"), l("Шифрование", "Шифрлау")], [l("Подтверждение автора и целостности", "Автор мен тұтастықты растау"), l("Защита содержания от постороннего чтения", "Мазмұнды бөгде оқудан қорғау"), l("Увеличение объёма ОЗУ", "Жедел жад көлемін арттыру"), l("Ускорение печати", "Баспаны тездету")], l("Подпись и шифрование имеют разные цели.", "Қолтаңба мен шифрлаудың мақсаттары бөлек.")),
];

function sample<T>(pool: T[], count: number, rand: () => number): T[] {
  if (pool.length < count) throw new Error(`Банк недостаточен: ${pool.length}/${count}`);
  return shuffle(pool, rand).slice(0, count);
}

/** Авторский тренировочный вариант в структуре НЦТ 2026; темы не имеют официальных весов. */
export function buildEntMock(seed: number): EntMock {
  const rand = seeded(seed);
  const group = CONTEXTS[Math.floor(rand() * CONTEXTS.length)];
  const questions: EntQuestion[] = [];
  const singles = CURRICULUM_QUESTIONS.filter((q): q is ChoiceStep => q.type === "choice" && q.options.length === 4 && q.skill !== "ent.strategy");
  const multis = CURRICULUM_QUESTIONS.filter((q): q is MultiStep => q.type === "multi" && q.options.length === 6 && q.correct.length <= 3 && q.skill !== "ent.strategy");
  // 25 обычных: 13A+7B+5C. Контекст: 2A+2B+1C.
  for (const [level, count] of [[1, 13], [2, 7], [3, 5]] as const) questions.push(...sample(singles.filter((q) => q.level === level), count, rand));
  const ordinary = shuffle(questions, rand);
  questions.length = 0; questions.push(...ordinary, ...buildContextPractice(group.id));
  // В написанном банке multi проверяет составные знания и относится к C.
  // Для A/B есть отдельные простые наборы ниже; уровни не переименовываются случайно.
  const easyMulti: MultiStep[] = [
    { id: "ent-multi:input", type: "multi", skill: "pc.devices", level: 1, prompt: l("Выбери устройства ввода.", "Енгізу құрылғыларын таңда."), options: [l("Клавиатура", "Пернетақта"), l("Микрофон", "Микрофон"), l("Сканер", "Сканер"), l("Принтер", "Принтер"), l("Колонка", "Дыбыс зорайтқыш"), l("Обычный монитор", "Кәдімгі монитор")], correct: [0, 1, 2], explanation: l("Клавиатура, микрофон, сканер вводят данные.", "Пернетақта, микрофон, сканер деректерді енгізеді.") },
    { id: "ent-multi:binary", type: "multi", skill: "ns.base", level: 1, prompt: l("Выбери допустимые двоичные записи.", "Дұрыс екілік жазбаларды таңда."), options: ["101", "1110", "1001", "102", "210", "8"], correct: [0, 1, 2], explanation: l("Двоичная запись использует только 0 и 1.", "Екілік жазба тек 0 және 1 қолданады.") },
    { id: "ent-multi:sql", type: "multi", skill: "db.sql", level: 2, prompt: l("Выбери запросы, которые только читают данные.", "Деректерді тек оқитын сұраныстарды таңда."), options: ["SELECT * FROM students", "SELECT COUNT(*) FROM students", "SELECT name FROM students WHERE score>80", "DELETE FROM students", "UPDATE students SET score=0", "INSERT INTO students VALUES(1,'A',90)"], correct: [0, 1, 2], explanation: l("SELECT читает данные;DELETE/UPDATE/INSERT меняют их.", "SELECT деректерді оқиды;DELETE/UPDATE/INSERT өзгертеді.") },
  ];
  questions.push(...easyMulti, ...sample(multis.filter((q) => q.level === 3), 2, rand));
  questions.push(...sample(ENT_MATCH_QUESTIONS.filter((q) => q.level === 1), 3, rand), ...sample(ENT_MATCH_QUESTIONS.filter((q) => q.level === 2), 2, rand));
  const randomized = questions.map((q): EntQuestion => {
    const indices = shuffle(q.options.map((_, index) => index), rand);
    const options = indices.map((index) => q.options[index]);
    if (q.type === "choice") return { ...q, options, correct: indices.indexOf(q.correct), ent: true };
    if (q.type === "multi") return { ...q, options, correct: q.correct.map((index) => indices.indexOf(index)), ent: true };
    return { ...q, options, correct: q.correct.map((index) => indices.indexOf(index)) };
  });
  return { id: `ent:${seed}`, title: l("Пробный ЕНТ по информатике", "Информатикадан сынақ ҰБТ"), questions: randomized, contextId: group.id, maxPoints: 50 };
}
