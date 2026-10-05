// Базовые типы платформы. Контент всегда двуязычный (ru + kk).

export type Lang = "ru" | "kk";

/** Локализованная строка: обязательно оба языка. */
export type L = { ru: string; kk: string };

/** Текст, который не нужно переводить (числа, код), либо локализованная строка. */
export type Text = string | L;

export type SkillId = string;

/** Уровень сложности задания — как в ЕНТ: 1 = A (базовый), 2 = B (средний), 3 = C (высокий). */
export type Level = 1 | 2 | 3;

export interface Skill {
  id: SkillId;
  title: L;
  topic: L;
  /** Тема спецификации ЕНТ-2026 (docs/ENT.md). */
  ent?: EntTopicId;
}

// ---------- Темы ЕНТ ----------

/** 13 тем спецификации ЕНТ-2026 по информатике (docs/ENT.md, раздел 2). */
export type EntTopicId = "t01" | "t02" | "t03" | "t04" | "t05" | "t06" | "t07" | "t08" | "t09" | "t10" | "t11" | "t12" | "t13";

/**
 * Имя рисованной иконки (lucide) для данных из content/lib. Компонент выбирается в components
 * (components/scenes/icons.ts). Эмодзи в интерфейсе запрещены.
 */
export type IconName =
  | "cpu" | "memory" | "hard-drive" | "usb" | "keyboard" | "mouse" | "monitor" | "printer" | "speaker" | "mic" | "camera" | "scanner"
  | "laptop" | "phone" | "server" | "router" | "wifi" | "network" | "globe" | "cloud" | "database" | "table" | "file" | "folder"
  | "code" | "terminal" | "bug" | "lock" | "unlock" | "key" | "shield" | "virus" | "mail" | "user" | "users" | "brain" | "bot"
  | "cube" | "rocket" | "lightbulb" | "chart" | "image" | "music" | "video" | "text" | "binary" | "calculator" | "clock" | "zap"
  | "check" | "x" | "arrow-right" | "repeat" | "split" | "search" | "settings" | "link" | "download" | "upload" | "battery" | "box";

// ---------- Наглядные сцены ----------

/**
 * Параметризованная схема (рисуется компонентом SceneView). Одна и та же сцена используется
 * в теории, ситуациях, пошаговых разборах и как «раскрытие» после ответа.
 */
export type Scene =
  /** Двоичная запись: цифры, под ними веса (справа налево), нули зачёркнуты, сумма. */
  | {
      kind: "binary";
      bits: string;
      /** Показать веса под цифрами. */
      weights?: boolean;
      /** Зачеркнуть веса под нулями. */
      cross?: boolean;
      /** Показать строку суммы «32 + 8 + 4 + 1 = 45». */
      sum?: boolean;
      /** Ошибка-ловушка: веса подписаны слева направо (красным). */
      wrongDirection?: boolean;
      /** Подсветить разряды (индексы слева направо). */
      highlight?: number[];
    }
  /** Деление на основание с остатками («лесенка»). rows — сколько строк уже показано. */
  | { kind: "ladder"; number: number; base?: number; rows?: number; readUp?: boolean }
  /** Лампочки: состояния «1011», опционально веса и сумма. */
  | { kind: "lamps"; states: string; weights?: boolean; sum?: boolean }
  /** Монеты-веса (1, 2, 4, 8…): какие взяты, сколько набрано. */
  | { kind: "coins"; values: number[]; picked?: number[]; target?: number }
  /** Обычное десятичное число с весами разрядов ×100 ×10 ×1. */
  | { kind: "decimal"; number: string }
  /** Иллюстрация сюжета «квест-комната». */
  | { kind: "quest"; art: QuestArt; code?: string; caption?: Text }
  /**
   * Таблица: таблица истинности, таблица БД, электронная таблица (sheet: заголовки A, B, C… и 1, 2, 3…),
   * трассировочная таблица. Индексы строк/столбцов — с 0, без учёта заголовков.
   */
  | {
      kind: "table";
      columns?: Text[];
      rows: Text[][];
      highlightRows?: number[];
      highlightCols?: number[];
      highlightCells?: [number, number][];
      /** Режим электронной таблицы: буквы столбцов и номера строк по краям. */
      sheet?: boolean;
      /** Моноширинный шрифт ячеек (код, двоичные числа). */
      mono?: boolean;
      caption?: Text;
    }
  /** Код с подсветкой текущей строки, значениями переменных и выводом — трассировка программы. */
  | {
      kind: "code";
      lang?: "python" | "sql" | "html" | "css" | "text";
      lines: string[];
      /** Текущая (исполняемая) строка, с 0. */
      active?: number;
      /** Строки, которые нужно отметить (ошибка, важное), с 0. */
      marks?: number[];
      vars?: { name: string; value: string }[];
      output?: string[];
      caption?: Text;
      /**
       * Кнопка «Запустить» под кодом (только lang "python", этап 14): ученик может выполнить программу в браузере
       * со своим вводом. Ставит сборщик сессии (контекстные задания практикума), не автор урока.
       */
      run?: boolean;
    }
  /**
   * Логическая схема: входы, вентили (вход вентиля — имя входа или id другого вентиля), выход.
   * values — показать значения на проводах (0/1) для входов; значения вентилей считает код.
   */
  | {
      kind: "circuit";
      inputs: string[];
      gates: { id: string; op: "and" | "or" | "not" | "xor" | "nand" | "nor"; in: string[] }[];
      /** id вентиля, чей выход — результат схемы. */
      output: string;
      values?: Record<string, 0 | 1>;
      caption?: Text;
    }
  /**
   * Схема из блоков и стрелок: блок-схема алгоритма, топология сети, устройство компьютера.
   * x — столбец 0..4, y — строка 0..9 (сетка; блоки не должны совпадать по клетке).
   */
  | {
      kind: "flow";
      nodes: { id: string; shape: "start" | "end" | "action" | "if" | "io" | "box" | "device"; label: Text; icon?: IconName; x: number; y: number }[];
      edges: { from: string; to: string; label?: Text }[];
      /** Подсвеченный блок (текущий шаг алгоритма). */
      active?: string;
      caption?: Text;
    }
  /** Карточки с иконками: устройства, виды ПО, угрозы, понятия — для тем «на знание». */
  | {
      kind: "cards";
      items: { icon: IconName; title: Text; text?: Text; tone?: "primary" | "success" | "danger" | "warning" | "ai" | "gold" | "muted" }[];
      columns?: 2 | 3;
      caption?: Text;
    }
  /** Растровая картинка: строки одинаковой длины из символов палитры; codes — показать коды пикселей. */
  | { kind: "pixels"; rows: string[]; palette: Record<string, string>; codes?: boolean; caption?: Text }
  /** HTML-код и его вид в браузере (рендерится в изолированном iframe без скриптов). */
  | { kind: "web"; html: string; css?: string; caption?: Text }
  // ---- v0.7: иллюстрации «компьютер с нуля» (решение #36) ----
  /** Галерея рисунков устройств и деталей (SVG): items — что показать, highlight — что выделить. */
  | { kind: "hardware"; items: HardwareId[]; highlight?: HardwareId[]; labels?: boolean; caption?: Text }
  /** Системный блок изнутри с выносками: подсветить детали (по шагам разбора — разные). */
  | { kind: "pc-inside"; highlight?: PcPart[]; labels?: boolean; caption?: Text }
  /** Цикл процессора: выборка → декодирование → выполнение → запись. step — активный этап (0–3). */
  | { kind: "cpu-cycle"; step?: 0 | 1 | 2 | 3; instr?: string; caption?: Text }
  /** Клавиатура с подсвеченными клавишами (сочетание — по порядку нажатия): ["Ctrl", "C"]; combo: false — просто список клавиш. */
  | { kind: "keyboard"; keys: string[]; combo?: boolean; caption?: Text }
  /** Сравнение объёмов: полосы в логарифмическом масштабе с подписью размера (Б, КБ, МБ, ГБ, ТБ). */
  | { kind: "sizes"; items: { label: Text; bytes: number; icon?: IconName }[]; caption?: Text }
  /** Дерево папок и файлов; active — путь к выделенному элементу («Учёба/Информатика/урок.docx»). */
  | { kind: "files"; tree: FileNode[]; active?: string; caption?: Text }
  /** Слои (стопка): ОС между программами и железом, уровни памяти и т.п. axis — подписи шкалы сверху и снизу. */
  | { kind: "layers"; items: { title: Text; text?: Text; icon?: IconName }[]; highlight?: number; axis?: { top: Text; bottom: Text }; caption?: Text }
  /**
   * Круги Эйлера (диаграмма Венна) на 2 или 3 множества, нарисованные в SVG.
   * sets — названия множеств по порядку A, B, C (короткие: «A», «Футбол»);
   * values — текст внутри области (обычно число элементов): ключ — область (VennRegion);
   * highlight — области, залитые сильнее (остальные приглушены); universe — подпись внешнего прямоугольника
   * (универсума); рамка рисуется, если задан universe или используется область "out" (значение или подсветка).
   */
  | { kind: "venn"; sets: Text[]; values?: Partial<Record<VennRegion, string>>; highlight?: VennRegion[]; universe?: Text; caption?: Text };

/**
 * Область диаграммы Эйлера для сцены venn. Область = «лежит РОВНО в этих кругах и ни в каких других»:
 * буквы — круги, в которых элемент лежит (a — первое множество, b — второе, c — третье).
 * Для двух множеств (a, b): "a" — только A (A без B); "b" — только B; "ab" — A ∩ B; "out" — ни A, ни B (вне кругов, внутри рамки).
 * Для трёх (a, b, c) дополнительно: "c" — только C; "ab" — A ∩ B без C; "ac" — A ∩ C без B; "bc" — B ∩ C без A;
 * "abc" — A ∩ B ∩ C (центр); "out" — ни в одном множестве.
 * Области не пересекаются между собой, вместе они покрывают весь универсум. Для двух множеств ключи c, ac, bc, abc недопустимы.
 */
export type VennRegion = "a" | "b" | "c" | "ab" | "ac" | "bc" | "abc" | "out";

/** Рисунки устройств и деталей для сцены hardware (components/scenes/hardware). */
export type HardwareId =
  // внутри системного блока
  | "case" | "motherboard" | "cpu" | "cooler" | "ram" | "ssd" | "hdd" | "gpu" | "psu"
  // носители
  | "flash" | "sd" | "cd" | "cloud" | "ext-hdd"
  // ввод
  | "keyboard" | "mouse" | "touchpad" | "touchscreen" | "mic" | "webcam" | "scanner" | "gamepad"
  // вывод
  | "monitor" | "printer" | "speakers" | "headphones" | "projector"
  // компьютеры вокруг нас
  | "desktop" | "laptop" | "phone" | "tablet" | "smartwatch" | "atm" | "pos" | "car" | "server" | "router";

/** Детали на схеме «системный блок изнутри». */
export type PcPart = "motherboard" | "cpu" | "cooler" | "ram" | "ssd" | "hdd" | "gpu" | "psu" | "fans" | "ports";

/** Узел дерева файлов: папка (children) или файл. */
export interface FileNode {
  name: string;
  children?: FileNode[];
}

export type QuestArt = "door" | "door-open" | "locker" | "locker-open" | "window-lamps" | "room";

// ---------- Шаги урока ----------

interface StepBase {
  id: string;
  /** Навык, который тренирует шаг. У теории/видео может отсутствовать. */
  skill?: SkillId;
  /** Формат ЕНТ — помечается бейджем. */
  ent?: boolean;
  /** Сложность A/B/C. В уроке и тренировке задания идут от лёгкого к сложному. */
  level?: Level;
  /** «Предскажи → проверь»: схема, которая показывается после ответа на вопрос. */
  reveal?: Scene;
  /**
   * Задания: схема-условие под текстом задания (код программы, таблица, логическая схема).
   * У теории/ситуации своя `scene`.
   */
  scene?: Scene;
  /**
   * Задания: бесплатная подсказка автора (не выдаёт ответ). Кнопка «Подсказка» сначала показывает её,
   * ИИ — только по кнопке «Ещё подсказка от Бита».
   */
  hint?: L;
}

export interface VideoStep extends StepBase {
  type: "video";
  videoId: string;
  title: L;
}

export interface TheoryStep extends StepBase {
  type: "theory";
  title: L;
  /** Markdown. */
  body: L;
  /** Встроенная иллюстрация (React-компонент из components/visuals). */
  visual?: VisualId;
  /** Параметризованная сцена (предпочтительнее visual в новых уроках). */
  scene?: Scene;
}

/** Ситуация из жизни/сюжета: сцена-картинка + короткий текст (реплика Бита или рассказчика). */
export interface StoryStep extends StepBase {
  type: "story";
  title?: L;
  body: L;
  scene: Scene;
  speaker?: "bit" | "narrator";
}

/** Пошаговый разбор («смотри, как решаю»): шаги открываются по нажатию, схема меняется вместе с шагом. */
export interface WorkedStep extends StepBase {
  type: "worked";
  title: L;
  steps: { text: L; scene?: Scene }[];
  /** Итог после последнего шага (подсвечивается зелёным). */
  result?: L;
}

/** Песочница: интерактивная схема. Если есть goal — «Продолжить» откроется, когда цель достигнута. */
export interface ExploreStep extends StepBase {
  type: "explore";
  title: L;
  body?: L;
  tool: "lamps" | "weights" | "coins";
  /** Количество ламп/разрядов/монет. */
  size: number;
  goal?: { target: number; text: L };
}

export interface ChoiceStep extends StepBase {
  type: "choice";
  prompt: L;
  options: Text[];
  correct: number;
  explanation: L;
  /**
   * Почему неверен каждый вариант (тот же порядок, что options; у верного — null).
   * Показывается бесплатно при ошибке — до ИИ-разбора.
   */
  whyWrong?: (L | null)[];
}

export interface MultiStep extends StepBase {
  type: "multi";
  prompt: L;
  options: Text[];
  correct: number[];
  explanation: L;
  whyWrong?: (L | null)[];
}

export interface InputStep extends StepBase {
  type: "input";
  prompt: L;
  /** Допустимые ответы (после нормализации). */
  answers: string[];
  mode: "number" | "binary" | "text";
  /** Подпись после поля, например «₂». */
  suffix?: string;
  explanation: L;
}

/** Интерактив: переключай биты, чтобы собрать число. */
export interface BitsStep extends StepBase {
  type: "bits";
  prompt: L;
  target: number;
  bits: number;
  explanation: L;
}

/** Интерактив: «лесенка» деления на 2 — ученик выбирает остатки. */
export interface LadderStep extends StepBase {
  type: "ladder";
  prompt: L;
  number: number;
  explanation: L;
}

export interface MatchStep extends StepBase {
  type: "match";
  prompt: L;
  pairs: { left: Text; right: Text }[];
  explanation: L;
}

export interface OrderStep extends StepBase {
  type: "order";
  prompt: L;
  /** Элементы в ПРАВИЛЬНОМ порядке; на экране перемешиваются. */
  items: L[];
  explanation: L;
}

/** Развёрнутое решение: рисунок на платформе или фото тетради, проверяет ИИ. */
export interface SolutionStep extends StepBase {
  type: "solution";
  prompt: L;
  /** Эталонное решение — уходит в промпт ИИ-проверки. */
  reference: L;
  /** Итоговый ответ для быстрой проверки без ИИ. */
  answer: string;
  answerMode: "number" | "binary" | "text";
  explanation: L;
}

/** Поле-пропуск в «решаем вместе»: допустимые ответы и режим нормализации. */
export interface ClozeBlank {
  blank: string[];
  mode: "number" | "binary" | "text";
  /** Ширина поля в символах (по умолчанию по длине ответа). */
  width?: number;
}
export type ClozeToken = string | L | ClozeBlank;

/** Решаем вместе: пример с пропусками — строки из текста и полей для ввода. */
export interface ClozeStep extends StepBase {
  type: "cloze";
  prompt: L;
  scene?: Scene;
  lines: ClozeToken[][];
  explanation: L;
}

/**
 * «Соответствие» как на ЕНТ (этап 14): два пункта (A, B), четыре описания, у каждого пункта ровно одно верное.
 * Баллы 2/1/0 (matchPoints в lib/ent.ts) → оценка 1 / 0,5 (частично) / 0.
 * answer — два разных индекса 0..3 (как в EntMatch). Без «A. », «1) » в начале текстов.
 */
export interface EntMatchStep extends StepBase {
  type: "entmatch";
  prompt: L;
  /** Ровно 2 пункта (A, B). */
  items: Text[];
  /** Ровно 4 описания. */
  choices: Text[];
  /** answer[i] — индекс верного описания для пункта i; два разных индекса 0..3. */
  answer: number[];
  explanation: L;
}

/**
 * Задача практикума внутри урока (этап 14): ученик пишет программу на Python, код проверяет тестами в браузере.
 * Условие, начальный код, подсказка и эталон — из задачи практикума (`lib/ide/python/tasks.ts`) по id.
 * Прошло с первой проверки — 1; со второй и дальше — 0,5 (частично); «Показать решение» — 0.
 */
export interface CodeStep extends StepBase {
  type: "code";
  /** id задачи практикума на Python («py-3-parity»). Навык шага = навык урока; у задачи — тот же или близкий. */
  task: string;
  /** Короткая вводная к задаче в контексте урока (условие покажется из задачи). */
  prompt: L;
  /** Разбор после ответа (что важно в эталоне). */
  explanation: L;
}

export type QuestionStep =
  | ChoiceStep
  | MultiStep
  | InputStep
  | BitsStep
  | LadderStep
  | MatchStep
  | OrderStep
  | SolutionStep
  | ClozeStep
  | EntMatchStep
  | CodeStep;

export type Step = VideoStep | TheoryStep | StoryStep | WorkedStep | ExploreStep | QuestionStep;

/** Шаги без проверки ответа. */
export type InfoStep = VideoStep | TheoryStep | StoryStep | WorkedStep | ExploreStep;

export type StepType = Step["type"];

export type VisualId = "place-values" | "binary-weights" | "division-ladder" | "lamps";

export interface Lesson {
  id: string;
  unitId: string;
  title: L;
  description: L;
  skills: SkillId[];
  durationMin: number;
  steps: Step[];
  /** Конспект урока (markdown) — сохраняется ученику после прохождения. */
  conspect: L;
  /** Темы ЕНТ, к которым относится урок. */
  entTopics?: EntTopicId[];
  /** Большой урок: вход стоит 2 сердечка (#40). Нет поля — 1. */
  hearts?: 2;
  /**
   * Микроурок (этап 14, #46): одна маленькая часть сложного навыка (if → if-else → elif). 9–12 шагов, 4–6 заданий,
   * 3–5 минут. Навык — общий с «родительским» уроком цепочки: свой банк и задания ЕНТ не нужны.
   */
  micro?: true;
}

export interface LessonRef {
  id: string;
  title: L;
  /** available — урок готов, soon — в разработке. */
  status: "available" | "soon";
}

/** Местность раздела на карте курса (иллюстрация фона и декор). */
export type UnitTheme = "numbers" | "logic" | "code" | "data" | "hardware" | "network" | "office" | "future" | "summit";

export interface Unit {
  id: string;
  title: L;
  description: L;
  /** CSS-цвет акцента раздела. */
  color: string;
  /** Рисованная иконка раздела. */
  icon?: IconName;
  theme?: UnitTheme;
  /** Темы ЕНТ раздела. */
  entTopics?: EntTopicId[];
  lessons: LessonRef[];
}

// ---------- Задания в формате ЕНТ (пробный ЕНТ, мини-ЕНТ, тест по теме) ----------

interface EntBase {
  /** Уникальный id во всём банке: `<урок>:<короткое имя>`. */
  id: string;
  topic: EntTopicId;
  skill: SkillId;
  level: Level;
  /** Условие (markdown без HTML). */
  prompt: L;
  /** Схема-условие: код, таблица, логическая схема. */
  scene?: Scene;
  /** Разбор после теста — бесплатно, без ИИ. */
  explanation: L;
  /** Подсказка (работа над ошибками, тренировка): подталкивает к первому шагу, ответ не выдаёт. Одна на всех — без ИИ. */
  hint?: L;
}

/** Один верный из 4 вариантов — 1 балл. */
export interface EntSingle extends EntBase {
  kind: "single";
  options: Text[];
  correct: number;
  whyWrong?: (L | null)[];
}

/** Один или несколько верных (2–3) из 6 вариантов — 2/1/0 баллов (lib/ent.ts). */
export interface EntMulti extends EntBase {
  kind: "multi";
  options: Text[];
  correct: number[];
}

/**
 * Соответствие: два пункта (A, B), каждому — одно из 4 описаний. 2 балла — оба верно, 1 — один.
 * answer[i] — индекс верного описания для пункта i.
 */
export interface EntMatch extends EntBase {
  kind: "match";
  items: Text[];
  choices: Text[];
  answer: number[];
}

/** Вопрос контекстного задания (1 балл): 4 варианта к общему тексту/программе. */
export interface EntContextQuestion {
  id: string;
  prompt: L;
  options: Text[];
  correct: number;
  explanation: L;
  /** Подсказка без ответа (как у EntBase.hint). */
  hint?: L;
}

/** Контекстное задание: общий текст и/или программа на Python, к ним 5 вопросов. */
export interface EntContext {
  id: string;
  kind: "context";
  topic: EntTopicId;
  skill: SkillId;
  level: Level;
  /** Общий текст (markdown). */
  text: L;
  scene?: Scene;
  questions: EntContextQuestion[];
}

export type EntItem = EntSingle | EntMulti | EntMatch | EntContext;

// ---------- Результаты ----------

export interface AnswerRecord {
  stepId: string;
  skill?: SkillId;
  correct: boolean;
  /** Частичный балл (для проверки решения ИИ): 0..1. */
  score: number;
  given: string;
  expected: string;
  prompt: string;
  /** Повторная попытка в «работе над ошибками». */
  retry: boolean;
  /** Время на ответ, мс (активное — пока вкладка видна, #68). */
  timeMs: number;
  /** До ответа открыта подсказка или вопрос Биту — ответ «с подсказкой», не самостоятельный (#66, #67). */
  hinted?: boolean;
  /** Задание пропущено («Пропустить» у решения с фото): балл 0 в точности, без ошибки и без освоения (#66). */
  skipped?: boolean;
}

/** Как пройден урок: полностью, проверкой себя, игрой или экстерном (тест по разделу). */
export type LessonVia = "learn" | "check" | "game" | "extern";

export interface SessionResult {
  kind: "lesson" | "drill";
  lessonId?: string;
  /** Режим урока (по умолчанию learn). */
  via?: LessonVia;
  title: string;
  answers: AnswerRecord[];
  xp: number;
  maxCombo: number;
  durationSec: number;
  /** Точность (#66): сумма баллов первых попыток / предъявлено заданий (пропуск — 0); заданий не было — 1. */
  accuracy: number;
  /** Сколько заданий пропущено. */
  skipped?: number;
  /** Сколько заданий предъявлено (первые попытки, включая пропуски) — знаменатель точности (#66). */
  asked?: number;
  /** Из них с подсказкой (#66). */
  hinted?: number;
  /** Режим тренировки (DrillMode) — для истории тестов. */
  mode?: string;
  /** Сколько заданий в сессии по плану (шаги-вопросы, этап 14): награда за прохождение — по длине. Нет — обычная. */
  planned?: number;
  /** Урок — микроурок (этап 14): награда короткого урока (#83). */
  micro?: boolean;
}

/** Класс ученика. 5–7 — для школьной программы (решение #33). */
export type Grade = "5" | "6" | "7" | "8" | "9" | "10" | "11" | "other";

/** Что проходим: подготовка к ЕНТ или школьная программа по классам. */
export type Track = "ent" | "school";

/** Цвет аватара-инициала (токены темы, см. components/app/Avatar.tsx). */
export type AvatarColor = "primary" | "success" | "warning" | "danger" | "ai" | "gold" | "streak";

/**
 * Аватар ученика: буква имени на цветном круге, рисованный аватар из набора или своё фото
 * (квадрат до 160×160, JPEG dataURL ≤ ~40 КБ — хранится в localStorage).
 */
export type AvatarConfig =
  | { kind: "initial"; color: AvatarColor }
  | { kind: "preset"; id: string }
  | { kind: "photo"; data: string };
export type Goal = "ent" | "school" | "interest";
export type ExplainStyle = "short" | "examples" | "steps";
export type Theme = "system" | "light" | "dark";
