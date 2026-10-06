// Время на шаг (этап 16В, P8; ТЗ — docs/specs/stage16c.md, §11): npm run step-times → docs/content/step-times.md.
// Считает по формуле lib/help-timer.ts, сколько времени типичному ученику нужно на шаг («сколько нужно времени на слайд»),
// и через сколько после показа шага Бит предложит помощь. Среднее / медиана / максимум по видам шагов и уровням
// для уроков, банка заданий и заданий ЕНТ; 10 самых «долгих» шагов. Отчёт воспроизводим: банк — на фиксированных зёрнах.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { LESSONS } from "../src/content/lessons/all";
import { ENT_POOL } from "../src/content/ent";
import { bankFor, bankSkills } from "../src/lib/bank";
import { entRef } from "../src/lib/ent-ref";
import { entStepFromRef } from "../src/lib/ent-steps";
import { isQuestion } from "../src/lib/evaluate";
import {
  ACTION_MS,
  HELP_FACTOR,
  HELP_MAX_MS,
  HELP_MIN_MS,
  HEAVY_WORD_WEIGHT,
  LEVEL_FACTOR,
  MAX_HELP_OFFERS,
  READ_WORDS_PER_SEC,
  expectedStepMs,
  helpKindFor,
  stepHelpAfterMs,
} from "../src/lib/help-timer";
import { plainText, tx } from "../src/lib/text";
import type { Level, Step } from "../src/lib/types";

export const REPORT_FILE = join(import.meta.dirname, "..", "docs", "content", "step-times.md");

/** Сколько вариантов каждого навыка и уровня берём из банка (зёрна фиксированы — отчёт не «плавает»). */
const BANK_VARIANTS = 6;
const bankSeed = (i: number): number => 1_000 + i * 7_919;

type Source = "lesson" | "bank" | "ent";

interface Row {
  source: Source;
  /** Где лежит шаг: урок, навык банка, задание ЕНТ. */
  where: string;
  step: Step;
  ru: number;
  kk: number;
  afterRu: number;
  afterKk: number;
}

function row(source: Source, where: string, step: Step): Row {
  return { source, where, step, ru: expectedStepMs(step, "ru"), kk: expectedStepMs(step, "kk"), afterRu: stepHelpAfterMs(step, "ru"), afterKk: stepHelpAfterMs(step, "kk") };
}

export function collectRows(): Row[] {
  const rows: Row[] = [];
  for (const lesson of Object.values(LESSONS)) for (const step of lesson.steps) rows.push(row("lesson", lesson.id, step));
  for (const skill of bankSkills().sort()) {
    const bank = bankFor(skill);
    if (!bank) continue;
    for (const level of [1, 2, 3] as Level[]) {
      for (let i = 0; i < BANK_VARIANTS; i++) {
        try {
          rows.push(row("bank", skill, bank.question(level, bankSeed(i))));
        } catch {
          // навык не умеет выдавать задание такого уровня — пропускаем
        }
      }
    }
  }
  for (const item of ENT_POOL) {
    const refs = item.kind === "context" ? item.questions.map((_, n) => entRef(item.id, n)) : [entRef(item.id)];
    for (const ref of refs) {
      const step = entStepFromRef(ref);
      if (step) rows.push(row("ent", item.id, step));
    }
  }
  return rows;
}

// ---------- Статистика ----------

interface Stat {
  n: number;
  mean: number;
  median: number;
  max: number;
}

function stat(values: number[]): Stat {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0, mean: 0, median: 0, max: 0 };
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  return { n, mean, median, max: v[n - 1] };
}

const sec = (ms: number): string => String(Math.round(ms / 1000));
/** Число по-русски: запятая вместо точки. */
const num = (x: number): string => String(x).replace(".", ",");
const pct = (part: number, whole: number): string => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

const LEVEL_NAME: Record<Level, string> = { 1: "A", 2: "B", 3: "C" };
const TYPE_NAME: Record<Step["type"], string> = {
  theory: "теория",
  story: "ситуация",
  worked: "разбор",
  explore: "песочница",
  video: "видео",
  choice: "выбор",
  multi: "несколько верных",
  input: "ввод",
  bits: "биты",
  ladder: "лесенка",
  match: "пары",
  order: "порядок",
  solution: "решение",
  cloze: "решаем вместе",
  entmatch: "соответствие ЕНТ",
  code: "код",
};
const TYPE_ORDER = Object.keys(TYPE_NAME) as Step["type"][];

/** Таблица статистики: по строке на группу. */
function statTable(title: string, groups: [string, Row[]][]): string[] {
  const out = [
    `| ${title} | Шагов | Среднее, с | Медиана, с | Макс., с | Порог плашки (среднее), с | kk: среднее, с | kk: порог, с |`,
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const [name, rows] of groups) {
    if (!rows.length) continue;
    const ru = stat(rows.map((r) => r.ru));
    const kk = stat(rows.map((r) => r.kk));
    // Видео Бит не предлагает — порога у него нет.
    const offered = rows.filter((r) => helpKindFor(r.step) !== null);
    const after = offered.length ? sec(stat(offered.map((r) => r.afterRu)).mean) : "—";
    const afterKk = offered.length ? sec(stat(offered.map((r) => r.afterKk)).mean) : "—";
    out.push(`| ${name} | ${ru.n} | ${sec(ru.mean)} | ${sec(ru.median)} | ${sec(ru.max)} | ${after} | ${sec(kk.mean)} | ${afterKk} |`);
  }
  return out;
}

const byType = (rows: Row[]): [string, Row[]][] => TYPE_ORDER.map((t) => [TYPE_NAME[t], rows.filter((r) => r.step.type === t)]);
const byLevel = (rows: Row[]): [string, Row[]][] => [
  ...([1, 2, 3] as Level[]).map((lv): [string, Row[]] => [`Уровень ${LEVEL_NAME[lv]}`, rows.filter((r) => isQuestion(r.step) && r.step.level === lv)]),
  ["Уровень не указан (как A)", rows.filter((r) => isQuestion(r.step) && r.step.level === undefined)],
];

/** Начало условия или заголовка шага — чтобы узнать его в списке. */
function snippet(step: Step): string {
  const text = "prompt" in step ? tx(step.prompt, "ru") : "title" in step && step.title ? tx(step.title, "ru") : "body" in step && step.body ? tx(step.body, "ru") : step.id;
  const flat = plainText(text).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  return flat.length > 70 ? `${flat.slice(0, 69)}…` : flat;
}

// ---------- Отчёт ----------

export function buildReport(rows: Row[] = collectRows()): string {
  const lessonRows = rows.filter((r) => r.source === "lesson");
  const bankRows = rows.filter((r) => r.source === "bank");
  const entRows = rows.filter((r) => r.source === "ent");
  const lessonCount = new Set(lessonRows.map((r) => r.where)).size;
  const story = lessonRows.filter((r) => !isQuestion(r.step) && r.step.type !== "video");
  const tasks = lessonRows.filter((r) => isQuestion(r.step));
  const storyStat = stat(story.map((r) => r.ru));
  const taskStat = stat(tasks.map((r) => r.ru));
  const afterStory = stat(story.map((r) => r.afterRu));
  const afterTask = stat(tasks.map((r) => r.afterRu));
  const offered = lessonRows.filter((r) => helpKindFor(r.step) !== null);
  const atMin = offered.filter((r) => r.afterRu <= HELP_MIN_MS).length;
  const atMax = offered.filter((r) => r.afterRu >= HELP_MAX_MS).length;

  // Разбор открывается по подшагам: «слайд» ученика — один подшаг.
  const worked = lessonRows.flatMap((r) => (r.step.type === "worked" ? [{ ru: r.ru, n: Math.max(1, r.step.steps.length) }] : []));
  const substeps = worked.reduce((n, w) => n + w.n, 0);
  // Каждый подшаг — одно наблюдение: время разбора поровну на его подшаги.
  const perSub = stat(worked.flatMap((w) => Array.from({ length: w.n }, () => w.ru / w.n)));

  const top = [...lessonRows].sort((a, b) => b.ru - a.ru).slice(0, 10);
  const lines: string[] = [];
  const push = (...xs: string[]) => lines.push(...xs);

  push(
    "# Время на шаг и порог плашки «Нужна помощь?»",
    "",
    "> Сгенерировано `npm run step-times` (`scripts/step-times.ts`) — не править руками. Формулы — `src/lib/help-timer.ts`, ТЗ — `docs/specs/stage16c.md`, §11.",
    "> Числа — оценка по объёму текста и виду действия, а не замер на живых учениках: когда появятся реальные тайминги (`timeMs` ответов), порог стоит сверить с ними.",
    "",
    "## Ответ на вопрос «сколько нужно времени на слайд»",
    "",
    `- **Шаг-рассказ** (теория, ситуация, разбор, песочница; всего ${story.length}): в среднем **${sec(storyStat.mean)} с** на чтение, медиана ${sec(storyStat.median)} с, самый длинный — ${sec(storyStat.max)} с.`,
    `- **Пошаговый разбор** (${worked.length} разборов, ${substeps} подшагов): в среднем **${sec(perSub.mean)} с на подшаг**, медиана ${sec(perSub.median)} с — подшаги открываются по нажатию, это и есть «слайд» ученика.`,
    `- **Задание** (всего ${tasks.length}): в среднем **${sec(taskStat.mean)} с**, медиана ${sec(taskStat.median)} с, самое долгое — ${sec(taskStat.max)} с.`,
    `- **Плашка помощи** выходит в среднем через **${sec(afterStory.mean)} с** на шаге-рассказе и **${sec(afterTask.mean)} с** на задании; нижняя граница ${sec(HELP_MIN_MS)} с (${pct(atMin, offered.length)} шагов уроков упираются в неё), верхняя ${sec(HELP_MAX_MS)} с (${pct(atMax, offered.length)}).`,
    "",
    "## Как считается",
    "",
    `1. **Чтение.** Всё, что ученик читает на шаге: условие, варианты, подписи сцены, текст схемы и код. Скорость — ${num(READ_WORDS_PER_SEC.ru)} слова/с на русском и ${num(READ_WORDS_PER_SEC.kk)} слова/с на казахском. Числа, формулы и код — «тяжёлые» слова, каждое весит как ${HEAVY_WORD_WEIGHT}. Рисунок без текста — взгляд 2,5 с.`,
    `2. **Действие** по виду шага: ${(["choice", "multi", "input", "bits", "ladder", "match", "order", "entmatch", "solution", "code", "explore"] as const).map((t) => `${TYPE_NAME[t]} ${ACTION_MS[t] / 1000} с`).join(", ")}; «решаем вместе» — 5 с на пропуск (10–40 с); шаг-рассказ — 0.`,
    `3. **Уровень:** A ×${num(LEVEL_FACTOR[1])}, B ×${num(LEVEL_FACTOR[2])}, C ×${num(LEVEL_FACTOR[3])} — на всю сумму чтения и действия.`,
    `4. **Порог плашки** = ожидаемое время × ${num(HELP_FACTOR)}, но не меньше ${sec(HELP_MIN_MS)} с и не больше ${sec(HELP_MAX_MS)} с. У пошагового разбора порог считается на один подшаг (время всего шага ÷ число подшагов), счёт идёт заново после каждого нажатия «Следующий шаг»; видео Бит не предлагает. Считается только время, пока вкладка видна; пауза, пока открыта шторка или играет сцена проводника. Один раз на шаг, не больше ${MAX_HELP_OFFERS} раз за урок или тренировку; не в пробном ЕНТ, мини-тесте, тестах по теме и разделу и не в играх.`,
    "",
    `## Уроки (шагов: ${lessonRows.length}, уроков: ${lessonCount})`,
    "",
    "### По видам шагов",
    "",
    ...statTable("Вид шага", [["Все шаги-рассказы", story], ["Все задания", tasks], ...byType(lessonRows)]),
    "",
    "«Среднее», «Медиана» и «Макс.» — время всего шага; «Порог плашки» у разбора — на один подшаг.",
    "",
    "### По уровням (задания)",
    "",
    ...statTable("Уровень", byLevel(lessonRows)),
    "",
    `## Банк заданий (всего ${bankRows.length}: навыков ${new Set(bankRows.map((r) => r.where)).size} × 3 уровня × ${BANK_VARIANTS} вариантов)`,
    "",
    "Тренировка собирается из банка, поэтому его задания считаются отдельно.",
    "",
    "### По видам заданий",
    "",
    ...statTable("Вид задания", [["Все задания банка", bankRows], ...byType(bankRows)]),
    "",
    "### По уровням",
    "",
    ...statTable("Уровень", byLevel(bankRows)),
    "",
    `## Задания в формате ЕНТ (всего ${entRows.length})`,
    "",
    "Контекстные задания считаются по вопросам: общий текст — часть условия каждого вопроса, как в плеере.",
    "",
    ...statTable("Вид задания", [["Все задания ЕНТ", entRows], ...byType(entRows)]),
    "",
    ...statTable("Уровень", byLevel(entRows)),
    "",
    "## 10 самых долгих шагов уроков",
    "",
    "«Ожидаемое» — время всего шага; у разбора «Порог плашки» считается на один подшаг (подшагов у таких разборов много, поэтому они лидируют по времени).",
    "",
    "| # | Урок | Шаг | Вид | Ур. | Ожидаемое, с | Порог плашки, с | Начало |",
    "|---:|---|---|---|---|---:|---:|---|",
    ...top.map((r, i) => `| ${i + 1} | ${r.where} | ${r.step.id} | ${TYPE_NAME[r.step.type]} | ${r.step.level ? LEVEL_NAME[r.step.level] : "—"} | ${sec(r.ru)} | ${sec(r.afterRu)} | ${snippet(r.step)} |`),
    "",
  );
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rows = collectRows();
  mkdirSync(dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, buildReport(rows));
  const by = (s: Source) => rows.filter((r) => r.source === s).length;
  console.log(`step-times: шагов уроков ${by("lesson")}, банк ${by("bank")}, ЕНТ ${by("ent")} → ${REPORT_FILE}`);
}
