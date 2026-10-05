// Модель страницы результата /r/<код> (#72): метки по коду на выбранном языке и ссылка «Пройти этот же вариант».
// Чистая функция без React — тесты: tests/share-landing.test.ts. Все строки — из словаря по меткам кода.

import { examLink } from "@/components/exam/logic";
import { withChallenge } from "@/lib/challenge";
import { sharePercent, type ShareResult } from "@/lib/share-code";
import type { Lang } from "@/lib/types";
import { daysWord, examKindLabel, ofLabel, tr } from "./labels";

export type LandingKind = "exam" | "course" | "streak" | "invalid";

export interface LandingModel {
  kind: LandingKind;
  /** Малая подпись над числом. */
  eyebrow: string;
  /** Метка рядом с подписью (вид пробника); null — нет. */
  chip: string | null;
  /** Крупное число («14», «42%», «12»). */
  big: string;
  /** Подпись рядом с числом («из 19», «дней подряд»); null — нет. */
  suffix: string | null;
  /** true — подпись перед числом (казахское «19 ішінен 14»). */
  suffixFirst: boolean;
  /** Строки под числом. */
  lines: string[];
  /** Доля для кольца (0…1); null — без кольца. */
  ratio: number | null;
  /** Поясняющий абзац. */
  text: string;
  /** Адрес «Пройти этот же вариант» (только у пробника). */
  acceptHref: string | null;
}

/** Ссылка на тот же вариант с вызовом: `/exam/run?kind&seed[&topics]&ch=<баллы>-<макс>-<тег>` (#73). */
export function challengeHref(r: Extract<ShareResult, { t: "exam" }>): string {
  return withChallenge(examLink(r.kind, r.seed, r.topics), { s: r.points, m: r.max, pool: r.pool });
}

/** Модель страницы на языке `lang` (язык ученика или язык из кода). null — код негодный. */
export function landingModel(r: ShareResult | null, lang: Lang): LandingModel {
  if (!r) {
    return {
      kind: "invalid",
      eyebrow: tr(lang, "share.land.invalid.title"),
      chip: null,
      big: "",
      suffix: null,
      suffixFirst: false,
      lines: [],
      ratio: null,
      text: tr(lang, "share.land.invalid.text"),
      acceptHref: null,
    };
  }
  switch (r.t) {
    case "exam":
      return {
        kind: "exam",
        eyebrow: tr(lang, "share.land.exam.eyebrow"),
        chip: examKindLabel(lang, r.kind),
        big: String(r.points),
        suffix: ofLabel(lang, r.max),
        suffixFirst: lang === "kk",
        lines: [],
        ratio: r.max > 0 ? r.points / r.max : 0,
        text: tr(lang, r.points >= r.max ? "share.land.exam.textMax" : "share.land.exam.text"),
        acceptHref: challengeHref(r),
      };
    case "course": {
      const p = sharePercent(r.done, r.total);
      return {
        kind: "course",
        eyebrow: tr(lang, "share.land.course.eyebrow"),
        chip: null,
        big: `${p}%`,
        suffix: null,
        suffixFirst: false,
        lines: [tr(lang, "progress.lessons", { done: r.done, total: r.total }), r.grade ? tr(lang, "share.card.class", { g: r.grade }) : tr(lang, "share.card.course")],
        ratio: p / 100,
        text: tr(lang, "meta.description"),
        acceptHref: null,
      };
    }
    case "streak":
      return {
        kind: "streak",
        eyebrow: tr(lang, "share.land.streak.eyebrow"),
        chip: null,
        big: String(r.days),
        suffix: daysWord(lang, r.days),
        suffixFirst: false,
        lines: [tr(lang, "stats.best", { n: r.best })],
        ratio: null,
        text: tr(lang, "meta.description"),
        acceptHref: null,
      };
  }
}
