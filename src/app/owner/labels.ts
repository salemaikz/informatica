// Подписи кодов для страницы владельца. Только по-русски — исключение из правила двух языков (решение #69).
// Незнакомый код (новое значение в данных) показывается как есть.

type Dict = Record<string, string>;

// Только собственные ключи словаря: код `constructor` или `__proto__` из данных не должен вернуть Object.prototype (C1).
const pick = (d: Dict, code: string): string => (Object.hasOwn(d, code) ? d[code] : code);

const FROM: Dict = {
  onboarding: "после онбординга",
  auto: "автопоказ",
  shop: "из магазина",
  profile: "из профиля",
  hearts: "сердечки закончились",
  ai: "лимит ИИ",
  other: "другое",
};
const HEARTS_WHERE: Dict = {
  lesson: "урок",
  check: "«Проверить себя»",
  extern: "экстерн по разделу",
  exam: "пробный ЕНТ",
  checkpoint: "контрольная точка",
  game: "игра",
};
const DRILL_MODE: Dict = {
  other: "другое (неизвестный режим)",
  smart: "умная тренировка",
  mistakes: "работа над ошибками",
  skill: "по навыку",
  review: "повторение",
  extern: "экстерн",
  topic: "по теме ЕНТ",
  history: "из истории",
};
const EXAM_KIND: Dict = { full: "полный пробник", mini: "мини-пробник", topic: "по теме", unit: "по разделу" };
const BREAK: Dict = {
  time: "не хватало времени",
  hard: "было сложно",
  boring: "стало скучно",
  forgot: "вылетело из головы",
  other_prep: "готовлюсь по-другому",
  other: "другое",
};
const FEEDBACK: Dict = { idea: "идея", bug: "ошибка в приложении", content: "ошибка в задании или теории", other: "другое" };
const TIER: Dict = { lite: "Лайт", unlimited: "Безлимит" };
const PERIOD: Dict = { month: "месяц", year: "год" };
const TRACK: Dict = { ent: "ЕНТ", school: "школа" };
const ISSUE_TYPE: Dict = { task: "жалоба на задание", ai: "жалоба на ответ ИИ", feedback: "отзыв" };
const ISSUE_WHERE: Dict = {
  lesson: "урок",
  drill: "тренировка",
  exam: "пробный ЕНТ",
  chat: "чат",
  panel: "панель ИИ",
  code: "практикум кода",
  page: "страница отзывов",
};
const ISSUE_REASON: Dict = {
  wrong_answer: "неверный ответ",
  unclear: "непонятно",
  typo: "опечатка или ошибка перевода",
  other: "другое",
  wrong: "неверно",
  gave_solution: "выдал решение задания",
  idea: "идея",
  bug: "ошибка в приложении",
  content: "ошибка в задании или теории",
};

const SHARE_WHAT: Dict = { exam: "результат пробника", course: "% курса", streak: "серия", challenge: "вызов другу", report: "отчёт родителю" };
const SHARE_HOW: Dict = { native: "меню телефона", copy: "скопировали ссылку", wa: "WhatsApp", tg: "Telegram", save: "сохранили картинку", manual: "скопировали вручную" };
const CHALLENGE_STEP: Dict = { accept: "приняли вызов на странице результата", start: "начали вариант по вызову", more: "итог: больше, чем у друга", same: "итог: столько же", less: "итог: меньше" };

export const label = {
  from: (c: string) => pick(FROM, c),
  heartsWhere: (c: string) => pick(HEARTS_WHERE, c),
  drillMode: (c: string) => pick(DRILL_MODE, c),
  examKind: (c: string) => pick(EXAM_KIND, c),
  breakReason: (c: string) => pick(BREAK, c),
  feedback: (c: string) => pick(FEEDBACK, c),
  /** `exam:wa` → «результат пробника — WhatsApp». */
  share: (c: string) => {
    const [what = "", how = ""] = c.split(":");
    return `${pick(SHARE_WHAT, what)} — ${pick(SHARE_HOW, how)}`;
  },
  shareWhat: (c: string) => pick(SHARE_WHAT, c),
  challengeStep: (c: string) => pick(CHALLENGE_STEP, c),
  track: (c: string) => pick(TRACK, c),
  issueType: (c: string) => pick(ISSUE_TYPE, c),
  issueWhere: (c: string) => pick(ISSUE_WHERE, c),
  issueReason: (c: string) => pick(ISSUE_REASON, c),
  /** `lite:month` → «Лайт, месяц». */
  planClick: (c: string) => {
    const [tier = "", period = ""] = c.split(":");
    return `${pick(TIER, tier)}, ${pick(PERIOD, period)}`;
  },
};
