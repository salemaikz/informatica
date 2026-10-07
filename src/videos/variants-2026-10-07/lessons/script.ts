export type LessonVideoLanguage = "ru" | "kk";
export type LessonVideoProps = { lang: LessonVideoLanguage };
export type BilingualLine = Record<LessonVideoLanguage, string>;

export interface LessonSceneScript {
  id: string;
  componentName: string;
  durationInFrames: 225;
  title: BilingualLine;
  caption: BilingualLine;
  narration: BilingualLine;
}

export interface LessonVariantScript {
  id: string;
  componentName: string;
  title: BilingualLine;
  description: BilingualLine;
  width: 1080;
  height: 1080;
  fps: 30;
  durationInFrames: 900;
  scenes: readonly LessonSceneScript[];
}

export const SHELF_SCRIPT: LessonVariantScript = {
  id: "python-shelf", componentName: "ShelfLesson", width: 1080, height: 1080, fps: 30, durationInFrames: 900,
  title: { ru: "Python на полке", kk: "Сөредегі Python" },
  description: { ru: "Индексы как адреса ящиков. Извлечение и срез показаны действием.", kk: "Индекстер — ұяшық мекенжайлары. Элемент алу мен тілім әрекетпен көрсетіледі." },
  scenes: [
    { id: "indices", componentName: "ShelfIndicesScene", durationInFrames: 225,
      title: { ru: "Адрес начинается\nс нуля", kk: "Индекс нөлден\nбасталады" },
      caption: { ru: "Внутри — значение. Под ящиком — его индекс.", kk: "Ішінде — мән. Ұяшық астында — оның индексі." },
      narration: { ru: "На полке три ящика: четыре, семь, девять. Их индексы — ноль, один, два. Индекс обозначает место, а число внутри — значение.", kk: "Сөреде үш ұяшық бар: төрт, жеті, тоғыз. Олардың индекстері — нөл, бір, екі. Индекс орынды, ал ішіндегі сан мәнді білдіреді." } },
    { id: "last", componentName: "ShelfLastScene", durationInFrames: 225,
      title: { ru: "Минус один —\nс правого края", kk: "Минус бір —\nоң жақ шеттен" },
      caption: { ru: "a[-1] открывает последний ящик: 9.", kk: "a[-1] соңғы ұяшықты ашады: 9." },
      narration: { ru: "Попросим a минус один. Отрицательный индекс считает с конца. Минус один указывает на последний ящик, поэтому получаем девять.", kk: "a минус бірді алайық. Теріс индекс соңынан санайды. Минус бір соңғы ұяшықты көрсетеді, сондықтан тоғыз аламыз." } },
    { id: "slice", componentName: "ShelfSliceScene", durationInFrames: 225,
      title: { ru: "Срез копирует\nчасть списка", kk: "Тілім тізімнің\nбөлігін көшіреді" },
      caption: { ru: "Новый список: [7, 9]. Исходный не меняется.", kk: "Жаңа тізім: [7, 9]. Бастапқысы өзгермейді." },
      narration: { ru: "Срез a от одного до трёх начинает с индекса один. Правая граница три не включается. Забираем семь и девять в новый список.", kk: "a тізімінің бірден үшке дейінгі тілімі бір индексінен басталады. Оң жақтағы үш шегі кірмейді. Жеті мен тоғызды жаңа тізімге аламыз." } },
    { id: "error", componentName: "ShelfErrorScene", durationInFrames: 225,
      title: { ru: "Ящика с индексом\n3 здесь нет", kk: "3 индексті ұяшық\nмұнда жоқ" },
      caption: { ru: "a[3] → IndexError. Доступны только 0, 1, 2.", kk: "a[3] → IndexError. Тек 0, 1, 2 индекстері бар." },
      narration: { ru: "Индекс три ищет четвёртый элемент. У нас только три ящика с индексами ноль, один, два. Python выдаёт IndexError: такого элемента нет.", kk: "Үш индексі төртінші элементті іздейді. Бізде нөл, бір, екі индексті үш ұяшық қана бар. Python IndexError береді: мұндай элемент жоқ." } },
  ],
};

export const NOTEBOOK_SCRIPT: LessonVariantScript = {
  id: "python-notebook", componentName: "NotebookLesson", width: 1080, height: 1080, fps: 30, durationInFrames: 900,
  title: { ru: "Python в конспекте", kk: "Конспектегі Python" },
  description: { ru: "Светлый конспект: подписи, границы и вывод по шагам.", kk: "Ашық түсті конспект: белгілер, шектер және қадамдық нәтиже." },
  scenes: [
    { id: "indices", componentName: "NotebookIndicesScene", durationInFrames: 225,
      title: { ru: "Подпишем\nкаждую позицию", kk: "Әр орынның\nиндексін жазайық" },
      caption: { ru: "a = [4, 7, 9] · a[1] = 7, а не 1.", kk: "a = [4, 7, 9] · a[1] = 7, 1 емес." },
      narration: { ru: "Запишем список четыре, семь, девять. Под ним индексы ноль, один, два. Выражение a один возвращает значение семь. Индекс и значение не путай.", kk: "Төрт, жеті, тоғыз тізімін жазайық. Астында нөл, бір, екі индекстері бар. a бір өрнегі жеті мәнін қайтарады. Индекс пен мәнді шатастырма." } },
    { id: "last", componentName: "NotebookLastScene", durationInFrames: 225,
      title: { ru: "Другой способ\nвзять последнее", kk: "Соңғысын алудың\nбасқа тәсілі" },
      caption: { ru: "a[2] = a[-1] = 9: два индекса, одно значение.", kk: "a[2] = a[-1] = 9: екі индекс, бір мән." },
      narration: { ru: "Последний положительный индекс здесь два. Но можно считать с конца: минус один. Обе записи выбирают одну и ту же девятку.", kk: "Мұнда соңғы оң индекс екі. Бірақ соңынан санауға болады: минус бір. Екі жазба да бір тоғызды таңдайды." } },
    { id: "slice", componentName: "NotebookSliceScene", durationInFrames: 225,
      title: { ru: "Левая граница\nвходит в срез", kk: "Сол жақ шек\nтілімге кіреді" },
      caption: { ru: "Срез [1:3] → [7, 9]. Индекс 3 исключён.", kk: "Тілім [1:3] → [7, 9]. 3 индексі кірмейді." },
      narration: { ru: "Отметим границы среза один и три. Начало входит в срез, конец не входит. Между ними элементы с индексами один и два: семь и девять.", kk: "Тілімнің бір және үш шектерін белгілейік. Басталуы кіреді, соңы кірмейді. Арасында бір және екі индексті элементтер бар: жеті мен тоғыз." } },
    { id: "error", componentName: "NotebookErrorScene", durationInFrames: 225,
      title: { ru: "Три элемента —\nиндексы до двух", kk: "Үш элемент —\nсоңғы индекс екі" },
      caption: { ru: "len(a) − 1 = 2. Поэтому a[3] → IndexError.", kk: "len(a) − 1 = 2. a[3] → IndexError." },
      narration: { ru: "Длина списка три, но последний индекс два: длина минус один. a три выходит за границу и даёт IndexError. Для девятки используй a два.", kk: "Тізім ұзындығы үш, бірақ соңғы индекс екі: ұзындық минус бір. a үш шектен шығып, IndexError береді. Тоғыз үшін a екіні қолдан." } },
  ],
};

export const DETECTIVE_SCRIPT: LessonVariantScript = {
  id: "python-detective", componentName: "DetectiveLesson", width: 1080, height: 1080, fps: 30, durationInFrames: 900,
  title: { ru: "Детектив IndexError", kk: "IndexError детективі" },
  description: { ru: "Расследуем пропавший элемент и отличаем индекс от границы среза.", kk: "Жоқ элементті іздеп, индексті тілім шегінен ажыратамыз." },
  scenes: [
    { id: "indices", componentName: "DetectiveIndicesScene", durationInFrames: 225,
      title: { ru: "Три улики.\nТри адреса.", kk: "Үш айғақ.\nҮш индекс." },
      caption: { ru: "Номера позиций: 0 → 4, 1 → 7, 2 → 9.", kk: "Орын индекстері: 0 → 4, 1 → 7, 2 → 9." },
      narration: { ru: "В деле список четыре, семь, девять. Проверим адреса: индекс ноль ведёт к четвёрке, один к семёрке, два к девятке. Адреса начинаются с нуля.", kk: "Істе төрт, жеті, тоғыз тізімі бар. Индекстерді тексерейік: нөл төртке, бір жетіге, екі тоғызға апарады. Индекстер нөлден басталады." } },
    { id: "last", componentName: "DetectiveLastScene", durationInFrames: 225,
      title: { ru: "Ищем с конца:\nулика −1", kk: "Соңынан іздейміз:\n−1 айғағы" },
      caption: { ru: "a[-1] = 9: первый элемент с конца.", kk: "a[-1] = 9: соңынан бірінші элемент." },
      narration: { ru: "Новая улика: минус один. Это не отрицательное значение элемента, а адрес с правого края. Первая позиция с конца хранит девять.", kk: "Жаңа айғақ: минус бір. Бұл элементтің теріс мәні емес, оң жақ шеттен саналатын индекс. Соңынан бірінші орында тоғыз бар." } },
    { id: "slice", componentName: "DetectiveSliceScene", durationInFrames: 225,
      title: { ru: "Восстановим\nграницы среза", kk: "Тілім шектерін\nанықтайық" },
      caption: { ru: "a[1:3] берёт индексы 1 и 2: [7, 9].", kk: "a[1:3] 1 және 2 индекстерін алады: [7, 9]." },
      narration: { ru: "Срез один до трёх выбирает позиции один и два. Тройка здесь граница, она исключена. Улики семь и девять попадают в новый список.", kk: "Бірден үшке дейінгі тілім бір және екі орындарын таңдайды. Үш мұнда шек, ол кірмейді. Жеті мен тоғыз жаңа тізімге түседі." } },
    { id: "error", componentName: "DetectiveErrorScene", durationInFrames: 225,
      title: { ru: "Четвёртый элемент\nне существует", kk: "Төртінші элемент\nмұнда жоқ" },
      caption: { ru: "3 — граница среза. Но a[3] → IndexError.", kk: "3 — тілім шегі. Бірақ a[3] → IndexError." },
      narration: { ru: "Причина ошибки найдена. Три допустимо как граница среза, но элемента с индексом три нет. Доступны ноль, один, два. Поэтому a три выдаёт IndexError.", kk: "Қате себебі табылды. Үш тілім шегі бола алады, бірақ үш индексті элемент жоқ. Нөл, бір, екі бар. Сондықтан a үш IndexError береді." } },
  ],
};

export const LESSON_VIDEO_SCRIPTS = [SHELF_SCRIPT, NOTEBOOK_SCRIPT, DETECTIVE_SCRIPT] as const;
