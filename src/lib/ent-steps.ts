import { ENT_POOL } from "@/content/ent";
import { contextQuestionOf, isAnswered, scoreQuestion, type ExamAnswers, type ExamPaper } from "./exam";
import type { WrongItem } from "./history";
import { plain, tx } from "./text";
import type { ChoiceStep, EntItem, Lang, L, MultiStep, QuestionStep, Text } from "./types";

// Задания ЕНТ как шаги плеера: по ссылке «ent:<id>» / «ent:<id>:<n>» собираем задание для LessonPlayer,
// чтобы ошибки пробного ЕНТ попадали в общую «работу над ошибками» и в историю тестов.
// Чистая логика без React (тесты — tests/ent-steps.test.ts).
//
// Ссылки:
//   ent:<id>      — «один верный» (single) → choice, «несколько верных» (multi) → multi
//   ent:<id>:<n>  — пункт соответствия (match, n = 0 для A, 1 для B) или вопрос контекстного задания
//                   (context, n — номер вопроса с нуля) → choice
// id шага в плеере = сама ссылка, поэтому верный ответ в плеере закрывает ошибку с тем же stepId.

export const ENT_REF_PREFIX = "ent:";

/** Ссылка на задание ЕНТ (n — пункт соответствия или номер вопроса контекста, с нуля). */
export const entRef = (id: string, n?: number): string => `${ENT_REF_PREFIX}${id}${n === undefined ? "" : `:${n}`}`;

export const isEntRef = (stepId: string): boolean => stepId.startsWith(ENT_REF_PREFIX);

/** Длинные условия и ответы обрезаем: в историю не нужно больше. */
const TEXT_LIMIT = 300;
const clip = (s: string, n = TEXT_LIMIT) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Строка на обоих языках из функции от языка. */
const both = (fn: (lang: Lang) => string): L => ({ ru: fn("ru"), kk: fn("kk") });

const indexOf = (pool: readonly EntItem[]): Map<string, EntItem> => new Map(pool.map((i) => [i.id, i]));
let defaultIndex: Map<string, EntItem> | null = null;
const poolIndex = (pool: readonly EntItem[]): Map<string, EntItem> => {
  if (pool !== ENT_POOL) return indexOf(pool);
  return (defaultIndex ??= indexOf(pool));
};

/**
 * Разбор ссылки. id задания сам содержит двоеточие («<урок>:<имя>»), поэтому сначала пробуем всю
 * строку как id, и только потом отрезаем числовой хвост.
 */
export function parseEntRef(ref: string, pool: readonly EntItem[] = ENT_POOL): { item: EntItem; n?: number } | undefined {
  if (!isEntRef(ref)) return undefined;
  const index = poolIndex(pool);
  const rest = ref.slice(ENT_REF_PREFIX.length);
  const whole = index.get(rest);
  if (whole) return { item: whole };
  const m = /^(.+):(\d+)$/.exec(rest);
  const item = m ? index.get(m[1]) : undefined;
  return item && m ? { item, n: Number(m[2]) } : undefined;
}

const choiceBase = (item: EntItem, ref: string) => ({ id: ref, skill: item.skill, level: item.level, ent: true as const });

/**
 * Задание ЕНТ по ссылке → шаг для LessonPlayer (id шага = ref). Нет такого задания или не хватает n — undefined.
 * single → choice, multi → multi, match с n → choice (условие + пункт n), context с n → choice (общий текст + вопрос n).
 */
export function entStepFromRef(ref: string, pool: readonly EntItem[] = ENT_POOL): QuestionStep | undefined {
  const parsed = parseEntRef(ref, pool);
  if (!parsed) return undefined;
  const { item, n } = parsed;
  switch (item.kind) {
    case "single": {
      if (n !== undefined) return undefined;
      const step: ChoiceStep = {
        ...choiceBase(item, ref),
        type: "choice",
        prompt: item.prompt,
        options: item.options,
        correct: item.correct,
        explanation: item.explanation,
        scene: item.scene,
        whyWrong: item.whyWrong,
      };
      return step;
    }
    case "multi": {
      if (n !== undefined) return undefined;
      const step: MultiStep = {
        ...choiceBase(item, ref),
        type: "multi",
        prompt: item.prompt,
        options: item.options,
        correct: item.correct,
        explanation: item.explanation,
        scene: item.scene,
      };
      return step;
    }
    case "match": {
      if (n === undefined || n >= item.items.length || n >= item.answer.length) return undefined;
      const step: ChoiceStep = {
        ...choiceBase(item, ref),
        type: "choice",
        prompt: both((lang) => `${tx(item.prompt, lang)}\n\n**${tx(item.items[n], lang)}**`),
        options: item.choices,
        correct: item.answer[n],
        explanation: item.explanation,
        scene: item.scene,
      };
      return step;
    }
    case "context": {
      const q = n === undefined ? undefined : item.questions[n];
      if (!q) return undefined;
      const step: ChoiceStep = {
        ...choiceBase(item, ref),
        type: "choice",
        prompt: both((lang) => `${tx(item.text, lang)}\n\n**${tx(q.prompt, lang)}**`),
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
        scene: item.scene,
      };
      return step;
    }
  }
}

// ---------- Ошибки попытки пробного ЕНТ ----------

const validIdx = (v: unknown, n: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;

/** Тексты выбранных вариантов через «; »; пусто — «—». */
function optionsText(options: readonly Text[], idx: readonly number[], lang: Lang): string {
  const parts = idx.filter((i) => validIdx(i, options.length)).map((i) => tx(options[i], lang));
  return parts.length ? clip(parts.join("; ")) : "—";
}

/**
 * Ошибки попытки пробного ЕНТ для истории и «работы над ошибками»: неверные и частично верные ответы
 * (пропущенные не включаем). stepId — ссылка ent:… (см. entRef); у соответствия — по неверным пунктам,
 * у контекстного задания — по вопросам. Тексты — на языке `lang` (пишутся в историю как есть).
 */
export function examWrongItems(paper: ExamPaper, answers: ExamAnswers, lang: Lang): WrongItem[] {
  const out: WrongItem[] = [];
  for (const q of paper.items) {
    const a = answers[q.key];
    if (!isAnswered(q, a)) continue;
    if (scoreQuestion(q, a).correct) continue;
    const item = q.item;
    const base = { skill: item.skill };
    switch (item.kind) {
      case "single":
        out.push({
          ...base,
          stepId: entRef(item.id),
          prompt: clip(plain(tx(item.prompt, lang))),
          given: optionsText(item.options, [a?.choice ?? -1], lang),
          expected: optionsText(item.options, [item.correct], lang),
        });
        break;
      case "multi": {
        const chosen = [...new Set(a?.multi ?? [])].sort((x, y) => x - y);
        out.push({
          ...base,
          stepId: entRef(item.id),
          prompt: clip(plain(tx(item.prompt, lang))),
          given: optionsText(item.options, chosen, lang),
          expected: optionsText(item.options, item.correct, lang),
        });
        break;
      }
      case "match": {
        const m = Array.isArray(a?.match) ? a!.match : [];
        item.answer.forEach((right, i) => {
          if (m[i] === right) return;
          const given = m[i];
          out.push({
            ...base,
            stepId: entRef(item.id, i),
            prompt: clip(plain(`${tx(item.prompt, lang)} ${tx(item.items[i], lang)}`)),
            given: validIdx(given, item.choices.length) ? optionsText(item.choices, [given], lang) : "—",
            expected: optionsText(item.choices, [right], lang),
          });
        });
        break;
      }
      case "context": {
        const cq = contextQuestionOf(q);
        if (!cq || q.sub === undefined) break;
        out.push({
          ...base,
          stepId: entRef(item.id, q.sub),
          prompt: clip(plain(tx(cq.prompt, lang))),
          given: optionsText(cq.options, [a?.choice ?? -1], lang),
          expected: optionsText(cq.options, [cq.correct], lang),
        });
        break;
      }
    }
  }
  return out;
}
