// Код результата для ссылки «Поделиться» (#72): https://<сайт>/r/<код>. В коде — только числа и метки из белых списков:
// ни имени, ни идентификаторов. Код в пути, а не во фрагменте «#», потому что превью ссылки (картинку с результатом)
// рисует сервер, а мессенджеры фрагмент не передают. Всё, что пришло из адреса, недоверенное: разбор строгий,
// подписи на страницах и картинке берутся из словаря по меткам, строки из адреса не выводятся никогда.
// Чистая логика без React: tests/share-code.test.ts.
//
// Форматы (разделитель «-», только [a-z0-9-]; точек нет — мессенджеры отрезают точку в конце ссылки):
//   пробник:  x1-<f|m|t>-<баллы>-<максимум>-<r|k>-<seed>-<тег банка>[-<темы>]   темы — номера через склейку: t04,t05 → 0405
//   курс:     c1-<пройдено>-<всего>-<r|k>[-g<класс>]                           класс — у школьного трека (% класса)
//   серия:    s1-<дней>-<рекорд>-<r|k>
//   урок:     l1-<точность %>-<XP>-<идеально 0|1>-<уроков пройдено>-<r|k>   только числа (этап 16В): ни названия урока, ни имени
// Версия в префиксе (x1, c1, s1, l1): поменялся смысл или дизайн картинки — новый префикс, старые ссылки остаются валидными.

import { ENT_TOPICS } from "@/content/ent-topics";
import type { SchoolGrade } from "@/content/school-program";
import type { EntTopicId, Lang } from "./types";

/** Виды пробника, которыми делятся (контрольной по разделу — нет: она привязана к карте курса ученика). */
export type ShareExamKind = "full" | "mini" | "topic";

export type ShareResult =
  | {
      t: "exam";
      kind: ShareExamKind;
      points: number;
      max: number;
      lang: Lang;
      /** Вариант: тот же seed + тот же банк = тот же вариант (вызов другу). */
      seed: number;
      /** Тег банка заданий и сборки варианта (`poolTag`, 4 знака): не совпал — вариант мог измениться. */
      pool: string;
      /** Темы «теста по теме» (1–3); у полного и мини — пусто. */
      topics: EntTopicId[];
    }
  | {
      t: "course";
      done: number;
      total: number;
      lang: Lang;
      /** Класс школьного трека (% класса); null — курс ЕНТ. */
      grade: SchoolGrade | null;
    }
  | { t: "streak"; days: number; best: number; lang: Lang }
  | {
      t: "lesson";
      /** Точность урока, целые проценты 0…100. */
      accuracy: number;
      /** XP, начисленные за урок. */
      xp: number;
      /** Урок без единой ошибки и подсказки. */
      perfect: boolean;
      /** Сколько уроков у ученика пройдено всего (число, не название и не номер на карте). */
      n: number;
      lang: Lang;
    };

/** Предел длины кода (запас над самым длинным допустимым). */
export const SHARE_CODE_MAX = 64;
/** Максимум баллов варианта, который принимаем (полный вариант — 50). */
export const SHARE_MAX_POINTS = 100;
export const SHARE_MAX_LESSONS = 999;
export const SHARE_MAX_DAYS = 9999;
/** XP за один урок: потолок для кода (за урок даётся десятки, запас — на множители). */
export const SHARE_MAX_XP = 999;

const KIND_TO: Record<ShareExamKind, string> = { full: "f", mini: "m", topic: "t" };
const KIND_FROM: Record<string, ShareExamKind> = { f: "full", m: "mini", t: "topic" };
const LANG_TO: Record<Lang, string> = { ru: "r", kk: "k" };
const LANG_FROM: Record<string, Lang> = { r: "ru", k: "kk" };
const GRADES: readonly SchoolGrade[] = ["5", "6", "7", "8", "9", "10", "11"];
const TOPIC_IDS = ENT_TOPICS.map((t) => t.id);
const POOL_RE = /^[a-z0-9]{4}$/;
const CODE_RE = /^[a-z0-9-]+$/;
/** Целое без ведущих нулей (одна запись на одно число: иначе одна и та же картинка кэшировалась бы под разными адресами). */
const INT_RE = /^(0|[1-9]\d{0,9})$/;

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Номер темы для кода: t04 → "04". */
const topicNum = (t: EntTopicId) => t.slice(1);

function validTopics(kind: ShareExamKind, topics: readonly EntTopicId[]): boolean {
  if (kind !== "topic") return topics.length === 0;
  if (topics.length < 1 || topics.length > 3) return false;
  return topics.every((t) => TOPIC_IDS.includes(t)) && new Set(topics).size === topics.length;
}

/** Проверка значений (общая для кодирования и разбора). */
function valid(r: ShareResult): boolean {
  if (!r || typeof r !== "object" || !(r.lang in LANG_TO)) return false;
  switch (r.t) {
    case "exam":
      return (
        r.kind in KIND_TO &&
        isInt(r.max, 1, SHARE_MAX_POINTS) &&
        isInt(r.points, 0, r.max) &&
        isInt(r.seed, 0, 2 ** 32 - 1) &&
        typeof r.pool === "string" &&
        POOL_RE.test(r.pool) &&
        Array.isArray(r.topics) &&
        validTopics(r.kind, r.topics)
      );
    case "course":
      return isInt(r.total, 1, SHARE_MAX_LESSONS) && isInt(r.done, 0, r.total) && (r.grade === null || GRADES.includes(r.grade));
    case "streak":
      return isInt(r.days, 1, SHARE_MAX_DAYS) && isInt(r.best, r.days, SHARE_MAX_DAYS);
    case "lesson":
      return isInt(r.accuracy, 0, 100) && isInt(r.xp, 0, SHARE_MAX_XP) && typeof r.perfect === "boolean" && isInt(r.n, 1, SHARE_MAX_LESSONS);
    default:
      return false;
  }
}

/** Код для ссылки; null — данные негодные (кнопку «Поделиться» тогда не показываем). */
export function encodeShare(r: ShareResult): string | null {
  if (!valid(r)) return null;
  const lang = LANG_TO[r.lang];
  switch (r.t) {
    case "exam": {
      const parts = ["x1", KIND_TO[r.kind], r.points, r.max, lang, r.seed, r.pool];
      if (r.kind === "topic") parts.push(r.topics.map(topicNum).join(""));
      return parts.join("-");
    }
    case "course":
      return ["c1", r.done, r.total, lang, ...(r.grade ? [`g${r.grade}`] : [])].join("-");
    case "streak":
      return ["s1", r.days, r.best, lang].join("-");
    case "lesson":
      return ["l1", r.accuracy, r.xp, r.perfect ? 1 : 0, r.n, lang].join("-");
  }
}

const num = (s: string | undefined): number | null => (s !== undefined && INT_RE.test(s) ? Number(s) : null);

function parseTopicsPart(s: string | undefined): EntTopicId[] | null {
  if (!s || !/^(\d\d){1,3}$/.test(s)) return null;
  const out: EntTopicId[] = [];
  for (let i = 0; i < s.length; i += 2) out.push(`t${s.slice(i, i + 2)}` as EntTopicId);
  return out;
}

function parseParts(p: string[]): ShareResult | null {
  const lang = (k: string | undefined) => (k !== undefined ? LANG_FROM[k] : undefined);
  switch (p[0]) {
    case "x1": {
      if (p.length !== 7 && p.length !== 8) return null;
      const kind = KIND_FROM[p[1]];
      const l = lang(p[4]);
      const points = num(p[2]);
      const max = num(p[3]);
      const seed = num(p[5]);
      if (!kind || !l || points === null || max === null || seed === null) return null;
      const topics = kind === "topic" ? parseTopicsPart(p[7]) : p.length === 7 ? [] : null;
      if (!topics) return null;
      return { t: "exam", kind, points, max, lang: l, seed, pool: p[6], topics };
    }
    case "c1": {
      if (p.length !== 4 && p.length !== 5) return null;
      const l = lang(p[3]);
      const done = num(p[1]);
      const total = num(p[2]);
      if (!l || done === null || total === null) return null;
      let grade: SchoolGrade | null = null;
      if (p.length === 5) {
        const g = /^g(\d{1,2})$/.exec(p[4]);
        if (!g) return null;
        grade = g[1] as SchoolGrade;
      }
      return { t: "course", done, total, lang: l, grade };
    }
    case "s1": {
      if (p.length !== 4) return null;
      const l = lang(p[3]);
      const days = num(p[1]);
      const best = num(p[2]);
      if (!l || days === null || best === null) return null;
      return { t: "streak", days, best, lang: l };
    }
    case "l1": {
      if (p.length !== 6) return null;
      const l = lang(p[5]);
      const accuracy = num(p[1]);
      const xp = num(p[2]);
      const flag = num(p[3]);
      const n = num(p[4]);
      if (!l || accuracy === null || xp === null || flag === null || flag > 1 || n === null) return null;
      return { t: "lesson", accuracy, xp, perfect: flag === 1, n, lang: l };
    }
    default:
      return null;
  }
}

/**
 * Разбор кода из адреса. null — мусор, неизвестная версия или неканоническая запись (принимаем только то,
 * что сами бы закодировали: одна запись на один результат).
 */
export function parseShare(code: unknown): ShareResult | null {
  if (typeof code !== "string" || code.length < 3 || code.length > SHARE_CODE_MAX || !CODE_RE.test(code)) return null;
  const r = parseParts(code.split("-"));
  if (!r || !valid(r)) return null;
  return encodeShare(r) === code ? r : null;
}

/** Путь страницы результата: `/r/<код>`; null — данные негодные. */
export function sharePath(r: ShareResult): string | null {
  const code = encodeShare(r);
  return code ? `/r/${code}` : null;
}

/** Процент курса для карточки и превью — как в шкале прогресса (`progress/format.percent`). */
export const sharePercent = (done: number, total: number): number => (total > 0 ? Math.round(Math.max(0, Math.min(1, done / total)) * 100) : 0);
