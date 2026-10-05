import { ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import { lessonsForTopic } from "./goals";
import {
  SEC_PER_QUESTION,
  expandEntItem,
  neighborTopics,
  scoreExam,
  scoreQuestion,
  shuffleEntItem,
  type ExamAnswers,
  type ExamNote,
  type ExamPaper,
} from "./exam";
import type { DiagnosticSummary } from "./store";
import { seeded, shuffle } from "./text";
import type { EntItem, EntSingle, EntTopicId, Level } from "./types";

// Входная диагностика (#70): 10 заданий «один верный» уровня A/B по разным темам ЕНТ.
// Чистая логика без React; тот же тип варианта (`ExamPaper`), что у пробника, — работают `QuestionView` и `scoreExam`.
// Диагностика не история тестов: итог (`DiagnosticSummary`) уходит в профиль через `recordDiagnostic` (lib/store.ts).

/** Заданий в диагностике. */
export const DIAGNOSTIC_SIZE = 10;
/** Основы — темы раздела «Старт» и информации (по ним решаем, скрывать ли «Старт»). */
export const BASICS_TOPICS: readonly EntTopicId[] = ["t01", "t03", "t08"];
/** Сколько заданий по основам нужно, чтобы судить о них. */
export const BASICS_MIN_ITEMS = 3;
/** Доля верных по основам, с которой «Старт» скрывается. */
export const BASICS_MIN_RATIO = 0.75;
/** Сколько слабых тем показываем. */
export const WEAK_TOPICS_COUNT = 3;

interface Slot {
  /** Тема слота; у группы (несколько тем) выбирает seed. */
  topics: readonly EntTopicId[];
  level: Level;
}

/** Одна тема из трёх «компьютерных» (устройства, сети, ПО). */
const BASIC_GROUP: readonly EntTopicId[] = ["t01", "t02", "t08"];
/** Одна тема из «прикладных» (SQL, БД, современные IT, таблицы, веб). */
const APPLIED_GROUP: readonly EntTopicId[] = ["t10", "t11", "t12", "t09", "t13"];

/** Раскладка: A × 6 и B × 4. Информация, системы счисления и логика — по паре A + B, Python — A, алгоритмы — B. */
const SLOTS: readonly Slot[] = [
  { topics: ["t03"], level: 1 },
  { topics: ["t03"], level: 2 },
  { topics: ["t04"], level: 1 },
  { topics: ["t04"], level: 2 },
  { topics: ["t05"], level: 1 },
  { topics: ["t05"], level: 2 },
  { topics: ["t06"], level: 1 },
  { topics: ["t07"], level: 2 },
  { topics: BASIC_GROUP, level: 1 },
  { topics: APPLIED_GROUP, level: 1 },
];

const ALL_TOPICS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Вариант диагностики: 10 заданий «один верный», детерминированно по `seed` (порядок заданий в банке не влияет).
 * Нет заданий нужной темы и уровня — добор из ближайшего уровня той же темы (при равенстве — из более лёгкого),
 * потом из соседних тем; повторов нет. Задания идут от лёгких (A) к средним (B). Недобор — в `notes`, как у пробника.
 */
export function buildDiagnostic(pool: readonly EntItem[], seed: number): ExamPaper {
  const rand = seeded(seed);
  const singles = pool.filter((i): i is EntSingle => i.kind === "single").sort(byId);
  const used = new Set<string>();
  const skillUse = new Map<string, number>();

  // Темы слотов: у группы выбирает seed.
  const planned = SLOTS.map((s) => ({
    topic: s.topics.length === 1 ? s.topics[0] : s.topics[Math.floor(rand() * s.topics.length)],
    level: s.level,
  }));

  /** Задание темы, ближайшее по уровню к нужному; навыки темы стараемся не повторять. */
  const pickIn = (topic: EntTopicId, level: Level): EntSingle | null => {
    const cands = singles.filter((i) => i.topic === topic && !used.has(i.id));
    if (!cands.length) return null;
    const dist = (c: EntSingle) => Math.abs(c.level - level);
    const best = Math.min(...cands.map(dist));
    const nearest = cands.filter((c) => dist(c) === best);
    // Ближайших уровней два (A и C для B) — берём более лёгкий: диагностика не должна пугать.
    const easiest = Math.min(...nearest.map((c) => c.level));
    const sameLevel = nearest.filter((c) => c.level === easiest);
    const minUse = Math.min(...sameLevel.map((c) => skillUse.get(c.skill) ?? 0));
    const fresh = sameLevel.filter((c) => (skillUse.get(c.skill) ?? 0) === minUse);
    const picked = fresh[Math.floor(rand() * fresh.length)];
    used.add(picked.id);
    skillUse.set(picked.skill, (skillUse.get(picked.skill) ?? 0) + 1);
    return picked;
  };

  const chosen: EntSingle[] = [];
  // Сначала все слоты — из своих тем, и только потом добор у соседей: иначе добор «съедает» задания соседней темы.
  const pending: typeof planned = [];
  for (const s of planned) {
    const p = pickIn(s.topic, s.level);
    if (p) chosen.push(p);
    else pending.push(s);
  }
  const noteMap = new Map<EntTopicId, ExamNote>();
  for (const s of pending) {
    let note = noteMap.get(s.topic);
    if (!note) {
      note = { topic: s.topic, kind: "single", missing: 0, filledFrom: [], unfilled: 0 };
      noteMap.set(s.topic, note);
    }
    note.missing++;
    let from: EntTopicId | null = null;
    for (const n of neighborTopics(s.topic, ALL_TOPICS)) {
      const p = pickIn(n, s.level);
      if (p) {
        chosen.push(p);
        from = n;
        break;
      }
    }
    if (from) {
      if (!note.filledFrom.includes(from)) note.filledFrom.push(from);
    } else note.unfilled++;
  }

  // От лёгких к средним; внутри уровня порядок по seed (sort устойчивый).
  const ordered = shuffle(chosen, rand).sort((a, b) => a.level - b.level);
  const items = ordered.flatMap((it) => expandEntItem(shuffleEntItem(it, seed)));
  return {
    // Вид «mini» — формальность типа ExamPaper: диагностика не пробник и в историю не пишется. Таймера нет, лимит — справочный.
    kind: "mini",
    seed,
    items,
    maxPoints: items.reduce((s, q) => s + q.maxPoints, 0),
    timeLimitSec: DIAGNOSTIC_SIZE * SEC_PER_QUESTION,
    notes: [...noteMap.values()],
  };
}

/** Знакомы ли основы: по темам основ не меньше 3 заданий и верно не меньше 75%. */
export function basicsKnown(byTopic: DiagnosticSummary["byTopic"]): { known: boolean; items: number } {
  let items = 0;
  let points = 0;
  for (const t of BASICS_TOPICS) {
    const x = byTopic[t];
    if (!x || !(x.max > 0)) continue;
    items += x.max;
    points += x.points;
  }
  return { known: items >= BASICS_MIN_ITEMS && points / items >= BASICS_MIN_RATIO, items };
}

export interface DiagnosticResult {
  /** Итог для профиля: баллы всего и по темам. */
  summary: DiagnosticSummary;
  /** Ответы по навыкам (верно/нет) — стор мягко засевает по ним оценку навыков. «Не знаю» — неверно. */
  skillAnswers: Record<string, boolean[]>;
  /** Основы знакомы — раздел «Старт» можно скрыть. */
  skipBasics: boolean;
  /** Сколько заданий по основам было в варианте; меньше BASICS_MIN_ITEMS — вывод о «Старте» не делаем. */
  basicsItems: number;
  /** До трёх самых слабых тем (от самой слабой): были ошибки или «Не знаю». */
  weakTopics: EntTopicId[];
  /** Сколько заданий отвечено (не «Не знаю»). */
  answered: number;
}

/**
 * Итог диагностики. `now` — момент прохождения (чистая функция, время не берёт сама, кроме значения по умолчанию).
 * Слабые темы — по доле верных, при равенстве — вес темы в ЕНТ (`topicWeight`) важнее.
 */
export function scoreDiagnostic(paper: ExamPaper, answers: ExamAnswers, now: number = Date.now()): DiagnosticResult {
  const res = scoreExam(paper, answers);
  const byTopic: DiagnosticSummary["byTopic"] = {};
  for (const t of ALL_TOPICS) {
    const x = res.byTopic[t];
    if (x.max > 0) byTopic[t] = { points: x.points, max: x.max };
  }
  const skillAnswers: Record<string, boolean[]> = {};
  for (const q of paper.items) {
    (skillAnswers[q.item.skill] ??= []).push(scoreQuestion(q, answers[q.key]).correct);
  }
  const basics = basicsKnown(byTopic);
  const weakTopics = ALL_TOPICS.filter((t) => byTopic[t] && byTopic[t]!.points < byTopic[t]!.max)
    .sort((a, b) => {
      const ra = byTopic[a]!.points / byTopic[a]!.max;
      const rb = byTopic[b]!.points / byTopic[b]!.max;
      return ra - rb || topicWeight(b) - topicWeight(a) || a.localeCompare(b);
    })
    .slice(0, WEAK_TOPICS_COUNT);
  return {
    summary: { at: now, points: res.points, max: res.maxPoints, byTopic },
    skillAnswers,
    skipBasics: basics.known,
    basicsItems: basics.items,
    weakTopics,
    answered: paper.items.length - res.unanswered,
  };
}

/** Готовый урок карты (нужно для ссылки «Начать с неё»). */
export interface ReadyLesson {
  id: string;
  skills: string[];
  entTopics?: EntTopicId[];
  /** Раздел карты (`u0` — «Старт»: при скрытом «Старте» его уроки не предлагаем). */
  unit?: string;
}

/**
 * Куда вести «Начать с неё»: первый ещё не пройденный готовый урок темы (в порядке курса), иначе — тренировка по теме.
 * `done` — пройденные уроки (ключ — id урока).
 */
export function topicStartHref(topic: EntTopicId, ready: readonly ReadyLesson[], done: Record<string, unknown>): string {
  const next = lessonsForTopic(topic, [...ready]).find((id) => !done[id]);
  return next ? `/lesson/${next}` : `/drill?mode=topic&topic=${topic}`;
}
