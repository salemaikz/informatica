// Подписи результата «Поделиться» на нужном языке — без React и без стора: их читают и экраны (по языку ученика),
// и сервер (метаданные и картинка превью — по языку из кода ссылки). Все строки — из словаря по меткам кода (#72):
// строки из адреса не выводятся никогда. Тесты: tests/share-landing.test.ts.

import { dict, type DictKey } from "@/i18n/dict";
import { entTopicById } from "@/content/ent-topics";
import { CARD_MAX_TOPICS, hostOf, pickStrongTopics, type CardTopic, type ShareCardModel } from "@/lib/share-card";
import { sharePercent, type ShareExamKind, type ShareResult } from "@/lib/share-code";
import { APP_NAME, siteUrl } from "@/lib/site-meta";
import { fmt } from "@/lib/text";
import type { EntTopicId, Lang } from "@/lib/types";

type Params = Record<string, string | number>;

/** Строка словаря на языке `lang` с подстановкой. */
export const tr = (lang: Lang, key: DictKey, params?: Params): string => fmt(dict[key][lang], params);

/** «14 из 19» / «19 ішінен 14». */
export function scoreText(lang: Lang, points: number, max: number): string {
  return lang === "kk" ? `${max} ішінен ${points}` : `${points} из ${max}`;
}

/** «из 19» / «19 ішінен» — подпись рядом с крупным баллом (на карточке и странице). */
export const ofLabel = (lang: Lang, max: number): string => tr(lang, "share.card.of", { m: max });

/** Вид пробника: «Мини-ЕНТ», «Полный пробный ЕНТ», «Тест по теме». */
export const examKindLabel = (lang: Lang, kind: ShareExamKind): string => tr(lang, `exam.mode.${kind}` as DictKey);

/** «день подряд» / «дня подряд» / «дней подряд» по числу (kk — без изменения). */
export function daysWord(lang: Lang, n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const form = m10 === 1 && m100 !== 11 ? "one" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "few" : "many";
  return tr(lang, `share.days.${form}` as DictKey);
}

/** «курса подготовки к ЕНТ» / «программы 8 класса». */
const courseSubtitle = (lang: Lang, grade: string | null): string => (grade ? tr(lang, "share.card.class", { g: grade }) : tr(lang, "share.card.course"));

/** Подписи урока (этап 16В): верхняя строка («Урок пройден» / «Без единой ошибки!») и итоговая («+35 XP · Пройдено уроков: 12»). */
export function lessonTexts(lang: Lang, r: Extract<ShareResult, { t: "lesson" }>): { lead: string; stats: string; count: string } {
  const count = tr(lang, "progress16c.share.count", { n: r.n });
  return { lead: tr(lang, r.perfect ? "progress16c.share.leadPerfect" : "progress16c.share.lead"), stats: `+${r.xp} XP · ${count}`, count };
}

/** Язык результата — язык кода ссылки. */
export const langOf = (r: ShareResult): Lang => r.lang;

export interface PageTexts {
  title: string;
  description: string;
}

/** Заголовок и описание превью ссылки (на языке из кода). */
export function metaTexts(r: ShareResult): PageTexts {
  const lang = r.lang;
  switch (r.t) {
    case "exam":
      return {
        title: tr(lang, "share.og.exam.title", { kind: examKindLabel(lang, r.kind), score: scoreText(lang, r.points, r.max) }),
        // Максимум — «Сможешь так же?»: больше не бывает.
        description: tr(lang, r.points >= r.max ? "share.og.exam.descMax" : "share.og.exam.desc"),
      };
    case "course": {
      const p = sharePercent(r.done, r.total);
      return {
        title: r.grade ? tr(lang, "share.og.class.title", { p, g: r.grade }) : tr(lang, "share.og.course.title", { p }),
        description: tr(lang, "share.og.course.desc", { done: r.done, total: r.total }),
      };
    }
    case "streak":
      return {
        title: tr(lang, "share.og.streak.title", { n: r.days, days: daysWord(lang, r.days) }),
        description: tr(lang, "share.og.streak.desc", { best: r.best }),
      };
    case "lesson":
      return {
        title: r.perfect ? tr(lang, "progress16c.share.og.titlePerfect") : tr(lang, "progress16c.share.og.title", { p: r.accuracy }),
        description: tr(lang, "progress16c.share.og.desc", { xp: r.xp }),
      };
  }
}

/** Режим сообщения: результат (с карточкой) или вызов другу (только пробник). */
export type MessageMode = "result" | "challenge";

/** Текст сообщения без ссылки. Без «официально» и «прогноз ЕНТ», без глаголов с родом. */
export function messageText(r: ShareResult, mode: MessageMode = "result"): string {
  const lang = r.lang;
  switch (r.t) {
    case "exam": {
      const params = { kind: examKindLabel(lang, r.kind), score: scoreText(lang, r.points, r.max) };
      if (mode === "result") return tr(lang, "share.msg.exam", params);
      return tr(lang, r.points >= r.max ? "share.msg.challengeMax" : "share.msg.challenge", params);
    }
    case "course": {
      const p = sharePercent(r.done, r.total);
      return r.grade ? tr(lang, "share.msg.class", { p, g: r.grade }) : tr(lang, "share.msg.course", { p });
    }
    case "streak":
      return tr(lang, "share.msg.streak", { n: r.days, days: daysWord(lang, r.days) });
    case "lesson":
      return tr(lang, r.perfect ? "progress16c.share.msgPerfect" : "progress16c.share.msg", { p: r.accuracy, xp: r.xp });
  }
}

/** Строка темы пробника для карточки: баллы по теме и подпись на языке ученика. */
export function topicRowsToCard(lang: Lang, rows: readonly { topic: EntTopicId; points: number; max: number }[]): CardTopic[] {
  return rows.map((r) => {
    return { label: entTopicById(r.topic).short[lang], points: r.points, max: r.max };
  });
}

/** Модель карточки-картинки по результату: тексты на языке результата, до 3 сильных тем. */
export function cardModelOf(r: ShareResult, topics: readonly CardTopic[] = []): ShareCardModel {
  const lang = r.lang;
  const base = { siteName: APP_NAME, siteHost: hostOf(siteUrl()) };
  switch (r.t) {
    case "exam":
      return {
        ...base,
        kind: "exam",
        kicker: examKindLabel(lang, r.kind),
        footer: tr(lang, "share.card.footer.exam"),
        examKind: r.kind,
        points: r.points,
        max: r.max,
        ofLabel: ofLabel(lang, r.max),
        ofFirst: lang === "kk",
        topicsTitle: tr(lang, "share.card.topics"),
        topics: pickStrongTopics(topics, CARD_MAX_TOPICS),
      };
    case "course":
      return {
        ...base,
        kind: "course",
        kicker: tr(lang, "share.card.kicker.course"),
        footer: tr(lang, "share.card.footer.start"),
        percent: sharePercent(r.done, r.total),
        done: r.done,
        total: r.total,
        lead: tr(lang, "share.card.lead"),
        lessonsLabel: tr(lang, "progress.lessons", { done: r.done, total: r.total }),
        subtitle: courseSubtitle(lang, r.grade),
      };
    case "streak":
      return {
        ...base,
        kind: "streak",
        kicker: tr(lang, "share.card.kicker.streak"),
        footer: tr(lang, "share.card.footer.start"),
        days: r.days,
        daysLabel: daysWord(lang, r.days),
        recordLabel: tr(lang, "stats.best", { n: r.best }),
      };
    case "lesson": {
      const lt = lessonTexts(lang, r);
      return {
        ...base,
        kind: "lesson",
        kicker: tr(lang, "progress16c.share.kicker"),
        footer: tr(lang, "share.card.footer.start"),
        percent: r.accuracy,
        lead: lt.lead,
        xpLabel: `+${r.xp} XP`,
        countLabel: lt.count,
      };
    }
  }
}
