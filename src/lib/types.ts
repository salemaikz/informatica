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
      // ---- волна 3 (этап 16Б) ----
      /**
       * Группы по 3 / 4 / 8 разряда справа налево: скобка под группой и её цифра (8-я, 16-я система) или «байт».
       * Недостающие слева разряды дописываются бледными нулями. До 32 разрядов: на телефоне группы переносятся по строкам.
       */
      groups?: 3 | 4 | 8;
      /** Стрелка сдвига: "left" — ×2 (справа приписан 0), "right" — :2 (правый разряд отброшен). */
      shift?: "left" | "right";
      /** Пропуск середины: показаны разряды до gap[0] и с gap[1] (индексы слева направо), между ними «…» (числа вида 2ⁿ − 1). */
      gap?: [number, number];
      /** Режим «адрес / маска / И»: второе число той же длины — вторая строка, третья — поразрядное И (считает код). */
      and?: string;
      /** Подписи трёх строк режима and (по умолчанию «IP», «Маска», «Сеть»). */
      andLabels?: [Text, Text, Text];
    }
  /** Деление на основание с остатками («лесенка»). rows — сколько строк уже показано. */
  | { kind: "ladder"; number: number; base?: number; rows?: number; readUp?: boolean }
  /** Лампочки: состояния «1011», опционально веса и сумма. */
  | { kind: "lamps"; states: string; weights?: boolean; sum?: boolean }
  /** Монеты-веса (1, 2, 4, 8…): какие взяты, сколько набрано. */
  | { kind: "coins"; values: number[]; picked?: number[]; target?: number }
  /** Обычное десятичное число с весами разрядов ×100 ×10 ×1. */
  | {
      kind: "decimal";
      number: string;
      // ---- волна 3 (этап 16Б) ----
      /** Основание 2–16 (цифры 0–9, A–F): веса — степени основания (q³ q² q¹ q⁰) и строка суммы в десятичной. По умолчанию 10. */
      base?: number;
      /**
       * Режим «отрываем цифру» (n % q → последняя цифра, n // q → число без неё): true — все шаги до нуля,
       * число — сколько шагов показать (разбор по кадрам).
       */
      peel?: boolean | number;
    }
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
      // ---- волна 3 (этап 16Б); индексы строк и столбцов — с 0 без заголовков ----
      /** Вид строк: "struck" — зачёркнута (DELETE), "dim" — приглушена (не прошла WHERE, вне LIMIT), "rejected" — отклонена (нарушает ключ), "new" — добавлена (INSERT). */
      rowStates?: { row: number; state: "struck" | "dim" | "rejected" | "new" }[];
      /** «Было → стало»: в ячейке новое значение, рядом зачёркнутое старое (UPDATE, пересчёт формулы). */
      changes?: { cell: [number, number]; from: Text }[];
      /** Подсветка ячеек разными тонами — поверх highlight* (две-три группы: «условие», «результат»). */
      tones?: { tone: SceneTone; cells: [number, number][] }[];
      /** Рамка диапазона (B2:C4 в режиме sheet). */
      range?: { from: [number, number]; to: [number, number] };
      /** Стрелки между ячейками: ссылка формулы, вектор сдвига при копировании. */
      arrows?: { from: [number, number]; to: [number, number]; tone?: SceneTone }[];
      /** Строка формул над таблицей (sheet): поле имени «C2» и текст «=A2*B2». */
      formula?: { cell: string; text: string };
      /** Свои номера строк в режиме sheet (после фильтра видны 2, 5, 7). Длина — rows.length. */
      rowNumbers?: number[];
      /** Вторая таблица справа (JOIN): линии между строками левой и правой с совпавшим ключом — пары [строка слева, строка справа]. */
      join?: { columns?: Text[]; rows: Text[][]; links: [number, number][] };
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
      gates: { id: string; op: GateOp; in: string[] }[];
      /** id вентиля, чей выход — результат схемы. */
      output: string;
      /** Волна 3: ещё выходы со своими подписями (полусумматор: S — xor, C — and). output — первый выход. */
      outputs?: { gate: string; name: string }[];
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
  | {
      kind: "web";
      html: string;
      css?: string;
      caption?: Text;
      /** Волна 3: разметка для казахского языка (тексты на странице); без неё — html на обоих языках. */
      htmlKk?: string;
      /** Волна 3: только вид в браузере, без панели кода (афиша, страница сайта, вкладка). */
      page?: boolean;
    }
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
  | { kind: "venn"; sets: Text[]; values?: Partial<Record<VennRegion, string>>; highlight?: VennRegion[]; universe?: Text; caption?: Text }
  // ---- волна 3 (этап 16Б): новые виды сцен, ТЗ — docs/specs/stage16b-wave3.md §1 ----
  /**
   * Числовая ось: 1–3 строки над общей шкалой min..max (целые). В строке — промежутки (отрезки и лучи), точки
   * (закрашенная — входит, выколотая — нет) и «прыжки» шага как у range. Пересечение двух условий — третьей строкой своим тоном.
   */
  | {
      kind: "numberline";
      min: number;
      max: number;
      /** Подписанные деления: "all" — каждое целое (если их ≤ 21), список — только эти; по умолчанию — min, max, концы промежутков и точки. */
      ticks?: "all" | number[];
      rows: NumberlineRow[];
      caption?: Text;
    }
  /**
   * Лента ячеек: строка или список Python, диапазон Excel, байты символа. Индексы: "py" — сверху 0..n−1, "both" — ещё снизу −n..−1,
   * "one" — 1..n («бусины» для ПСТР/ЛЕВСИМВ), "none" — без индексов (по умолчанию "py").
   */
  | {
      kind: "tape";
      cells: string[];
      index?: "py" | "both" | "one" | "none";
      /** Имя слева от ленты (s, a); alias — второе имя на ту же ленту (b = a: один список, два имени). */
      name?: string;
      alias?: string;
      /**
       * Срез с шагом — как range(start, stop, step) по индексам ленты: взятые ячейки подсвечены, прыжки — дугами, stop — граница «не включая».
       * Индексы уже неотрицательные; при отрицательном шаге stop может быть −1 («до начала ленты»).
       */
      slice?: { start: number; stop: number; step?: number };
      /** Указатели под ячейками: i, l, m, r, min. */
      pointers?: { at: number; label: string; tone?: SceneTone }[];
      /** Дуги обмена над ячейками (пары индексов). */
      swaps?: [number, number][];
      highlight?: number[];
      /** Приглушённые ячейки (отброшенная половина в двоичном поиске, отсортированный хвост). */
      dim?: number[];
      /** Скобки над ячейками с подписью (байты одного символа UTF-8: «Қ» над двумя ячейками). */
      groups?: { from: number; to: number; label: Text }[];
      /** Кадр «после» — вторая лента под первой со стрелкой (insert, pop, сдвиг). */
      after?: string[];
      /** Моноширинный шрифт (байты, двоичные коды). */
      mono?: boolean;
      caption?: Text;
    }
  /**
   * Диаграмма: столбчатая, линейная или круговая. Значения ≥ 0; у круговой — одна серия. funnel — воронка (bar с подписями «% от предыдущего»).
   */
  | {
      kind: "chart";
      type: "bar" | "line" | "pie";
      /** Категории: ось X у bar и line, секторы у pie. */
      labels: Text[];
      series: { name?: Text; values: number[]; tone?: SceneTone }[];
      /** Подписи значений над столбцами, у точек, в секторах. */
      values?: boolean;
      /** Единица в подписях значений: «%», «₸», «млн». */
      unit?: string;
      /** Горизонтальная пороговая линия (bar, line): цель, точка безубыточности. */
      threshold?: { value: number; label?: Text };
      /** Подсвеченные категории (индексы labels). */
      highlight?: number[];
      funnel?: boolean;
      /** Подписи осей (bar, line). */
      axes?: { x?: Text; y?: Text };
      caption?: Text;
    }
  /**
   * Граф: дороги между городами, дерево вызовов рекурсии, DNS, топология сети, цепочка блоков.
   * layout "free" — координаты x, y вершин 0..100 (обязательны); "tree" — дерево от root; "circle" — по кругу; "chain" — в линию слева направо.
   */
  | {
      kind: "graph";
      /** label — до 2 строк через \n; без label подписью служит id. */
      nodes: { id: string; label?: Text; x?: number; y?: number; tone?: SceneTone }[];
      edges: { from: string; to: string; weight?: string; tone?: SceneTone }[];
      layout?: "free" | "tree" | "circle" | "chain";
      root?: string;
      /** Рёбра — стрелки from → to. */
      directed?: boolean;
      /** Подсвеченный путь — id вершин по порядку (рёбра между соседними подсвечиваются). */
      path?: string[];
      highlight?: string[];
      /** Подписать степень каждой вершины. */
      degrees?: boolean;
      caption?: Text;
    }
  /**
   * Сетка (матрица a[i][j], зал, лесенка звёздочек, HTML-таблица с объединениями): оси индексов, подсветка строк, столбцов,
   * диагоналей и областей, порядок обхода, объединённые ячейки.
   */
  | {
      kind: "grid";
      rows: number;
      cols: number;
      /** Содержимое клеток [строка][столбец] (пустая строка — пустая клетка). */
      values?: string[][];
      /** Подписи осей с номерами: row — у строк («i»), col — у столбцов («j»); from — нумерация с 0 (Python) или с 1. */
      axes?: { row?: string; col?: string; from?: 0 | 1 };
      /** Подсветка слоями (следующий — поверх): клетки, строки, столбцы, область (диагональ, побочная, над и под диагональю). */
      marks?: { tone: SceneTone; cells?: [number, number][]; rows?: number[]; cols?: number[]; region?: "diag" | "anti" | "upper" | "lower" }[];
      /** Порядок обхода: стрелка по клеткам; numbered — номера 1, 2, 3… в клетках. */
      path?: [number, number][];
      numbered?: boolean;
      /** Объединённые ячейки (colspan / rowspan): левая верхняя клетка и размеры; hatch — штриховка «съеденных» мест. */
      merges?: { r: number; c: number; rs?: number; cs?: number }[];
      hatch?: boolean;
      caption?: Text;
    }
  /**
   * Схема БД: таблицы-блоки со списком полей и типами, значки PK / FK, стрелки FK → PK с подписями 1 и N у концов.
   * Связь N:M — через таблицу-связку с двумя FK.
   */
  | {
      kind: "db-schema";
      tables: { name: string; fields: { name: string; type?: string; pk?: boolean; fk?: string }[] }[];
      /** Подписи концов связи для поля с fk («Таблица.поле»): по умолчанию "1:N" (один у PK, много у FK). */
      cards?: { field: string; card: "1:1" | "1:N" }[];
      /** Подсвеченные таблицы («Ученики») и поля («Оценки.StudentID»). */
      highlight?: string[];
      caption?: Text;
    }
  /**
   * Блочная модель CSS: margin (пунктир) → border → padding → content, числа px на каждой стороне, линейка итоговой ширины снизу.
   * Стороны — одно число или [верх, право, низ, лево], как в CSS.
   */
  | {
      kind: "box";
      width: number;
      height?: number;
      padding?: BoxSides;
      border?: BoxSides;
      margin?: BoxSides;
      /** box-sizing: border-box — width включает padding и border (линейка это показывает). */
      borderBox?: boolean;
      highlight?: "content" | "padding" | "border" | "margin";
      /** Линейка снизу: «margin + border + padding + width + … = N px». */
      total?: boolean;
      /** Второй блок ниже с margin-top: между блоками виден больший из двух отступов, а не сумма (схлопывание). */
      collapse?: { top: number };
      caption?: Text;
    }
  /**
   * Звук: аналоговая волна, отсчёты с шагом 1/f, сетка уровней 2ⁱ и ступенчатая «цифровая» кривая.
   * compare — второй вариант качества рядом (меньше отсчётов или уровней).
   */
  | {
      kind: "wave";
      /** Отсчётов на показанном отрезке (0 — без отсчётов, только волна). */
      samples: number;
      /** Глубина: сетка из 2^bits уровней (1–4 бита — видимая сетка; больше — без сетки). */
      bits?: number;
      /** Ступенчатая кривая по отсчётам. */
      digital?: boolean;
      label?: Text;
      compare?: { samples: number; bits?: number; label?: Text };
      caption?: Text;
    }
  /**
   * Адресная строка браузера: URL по частям; highlight — подсвеченные части с подписью роли под ними
   * (протокол, поддомен, домен, зона, порт, путь, параметры). Склейка частей — сам URL.
   */
  | { kind: "url"; parts: { text: string; role: UrlRole }[]; highlight?: UrlRole[]; caption?: Text }
  /**
   * Сообщение: SMS, письмо или чат. marks — фрагменты текста (точные подстроки на обоих языках), подсвеченные как признаки
   * (фишинг, нарушенное свойство информации); подписи признаков — номера 1, 2, 3 со списком под сообщением.
   */
  | {
      kind: "message";
      channel: "sms" | "email" | "chat";
      from: Text;
      subject?: Text;
      text: Text;
      marks?: { text: Text; note?: Text }[];
      caption?: Text;
    }
  /** Значки логических вентилей с подписями — галерея для узнавания (тот же рисунок вентиля, что в сцене circuit). */
  | { kind: "gates"; ops: GateOp[]; highlight?: GateOp[]; caption?: Text }
  /**
   * Ключи и лампа: "and" — ключи последовательно, "or" — параллельно, "not" — кнопка-размыкатель, "xor" — коридорная лампа
   * (два переключателя). values — положения ключей (1 — замкнут / нажат; "not" — один ключ, остальные — 2 или 3); горит ли лампа — считает код.
   */
  | { kind: "switches"; mode: "and" | "or" | "not" | "xor"; values?: (0 | 1)[]; names?: string[]; caption?: Text };

/** Часть URL в сцене url. */
export type UrlRole = "protocol" | "subdomain" | "domain" | "zone" | "port" | "path" | "query" | "fragment";

/** Тон подсветки в сценах волны 3 — по смыслу цветов (CLAUDE.md, «Семантика цветов»). */
export type SceneTone = "primary" | "success" | "danger" | "warning" | "ai" | "gold" | "muted";

/** Вентиль логической схемы. */
export type GateOp = "and" | "or" | "not" | "xor" | "nand" | "nor";

/** Стороны блочной модели CSS: одно число или [верх, право, низ, лево]. */
export type BoxSides = number | [number, number, number, number];

/** Строка числовой оси (сцена numberline). */
export interface NumberlineRow {
  /** Подпись строки слева: «x > 3», «A», «range(2, 9, 3)». */
  label?: Text;
  tone?: SceneTone;
  /** Промежутки: from / to — концы (null — луч в бесконечность), fromIn / toIn — конец входит (закрашенная точка). */
  ranges?: { from: number | null; to: number | null; fromIn?: boolean; toIn?: boolean }[];
  /** Отдельные точки: open — выколотая; label — подпись над точкой. */
  points?: { at: number; open?: boolean; label?: Text }[];
  /** Прыжки шага как range(start, stop, step): дуги от числа к числу, взятые числа закрашены, stop — выколотая граница. */
  jumps?: { start: number; stop: number; step: number };
}

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
  | "desktop" | "laptop" | "phone" | "tablet" | "smartwatch" | "atm" | "pos" | "car" | "server" | "router"
  // волна 3 (этап 16Б): сеть, печать, ввод, роботы
  | "switch" | "hub" | "modem" | "access-point" | "nic" | "cable-utp" | "cable-fiber"
  | "printer-dot" | "printer-inkjet" | "printer-laser" | "plotter" | "pen-tablet"
  | "sensor" | "vr-headset" | "robot-vacuum" | "drone" | "manipulator";

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
  /**
   * Этап 16Б: верный ответ, как он показан на плашке выбора (ru и kk). Есть у всех текстовых пропусков шага — пропуски
   * заполняются выбором плашек, а не вводом с клавиатуры. Нормализованный label.ru и label.kk входят в blank.
   */
  label?: L;
}
export type ClozeToken = string | L | ClozeBlank;

/** Решаем вместе: пример с пропусками — строки из текста и полей для ввода. */
export interface ClozeStep extends StepBase {
  type: "cloze";
  prompt: L;
  scene?: Scene;
  lines: ClozeToken[][];
  /** Этап 16Б: лишние плашки-отвлекатели для выбора слов (к label пропусков). Не совпадают ни с одним верным ответом. */
  bank?: L[];
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
  /**
   * Микроурок (этап 14, #46): одна маленькая часть сложного навыка (if → if-else → elif). 9–12 шагов, 4–6 заданий,
   * 3–5 минут. Навык — общий с «родительским» уроком цепочки: свой банк и задания ЕНТ не нужны.
   */
  micro?: true;
  /**
   * Школьный урок (этап 15): только в школьной программе (content/school-program.ts), не на карте ЕНТ (нет в UNITS).
   * Без заданий ЕНТ, «босса» и пометок ЕНТ; навыки — без темы ЕНТ (`ent`), банк практики — свой. unitId — "school".
   */
  school?: true;
}

/** Урок без шагов и конспекта: под этот тип подходят и полный урок (Lesson), и запись каталога (LessonMeta). */
export type LessonInfo = Omit<Lesson, "steps" | "conspect">;

/**
 * Лёгкое описание урока без шагов и конспекта (этап 16): карта, профиль, статистика и меню не грузят содержимое всех уроков.
 * Генерируется в content/catalog.generated.ts (npm run catalog), сверку с уроками держит tests/catalog.test.ts.
 */
export type LessonMeta = LessonInfo & {
  /** Сколько шагов увидит ученик (lib/lesson-size.ts: шаги урока + «босс»). */
  stepCount: number;
  /** Чтение теории урока на каждом языке (lib/theory.ts → readingStats): карточек и минут. */
  reading: Record<Lang, { cards: number; minutes: number }>;
};

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

/**
 * Задание «на чтение» (решение #87): практика на ЕНТ — не написать программу, а прочитать готовый код, запрос, формулу,
 * разметку или схему таблиц. output — что выведет / вернёт / покажет; bug — где ошибка, какая ошибка возникнет;
 * fix — что поменять, чтобы стало правильно; fill — что вставить вместо пропуска; purpose — зачем эта строка, что делает
 * фрагмент; schema — чтение структуры БД: первичный и внешний ключ, связь, поля и записи. Логика — lib/code-read.ts.
 */
export type ReadKind = "output" | "bug" | "fix" | "fill" | "purpose" | "schema";

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
  /** Вид задания «на чтение» (#87). Не указан — определяется по условию и сцене (lib/code-read.ts). */
  read?: ReadKind;
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
  /** Вид вопроса «на чтение» (#87), как у EntBase.read. */
  read?: ReadKind;
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
  /** Ключ оплаченного входа (lib/entry-paid.ts): тренировка /drill (drillPaidKey), квиз в чате (quizEntryKey) — finishSession снимает отметку оплаты только за него. */
  drillKey?: string;
  /** Сколько заданий в сессии по плану (шаги-вопросы, этап 14): награда за прохождение — по длине. Нет — обычная. */
  planned?: number;
  /** Урок — микроурок (этап 14): награда короткого урока (#83). */
  micro?: boolean;
}

/** Класс ученика. 5–7 — для школьной программы (решение #33). */
export type Grade = "5" | "6" | "7" | "8" | "9" | "10" | "11" | "other";

/** Что проходим: подготовка к ЕНТ или школьная программа по классам. */
export type Track = "ent" | "school";

/** Направление 10–11 классов (приказ № 399): ЕМН — естественно-математическое (прил. 108), ОГН — общественно-гуманитарное (прил. 109). */
export type SchoolDirection = "emn" | "ogn";

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
