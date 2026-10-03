// Самопроверка урока для авторов контента: npx tsx scripts/check-content.ts <lessonId>
// Проверяет три файла урока (docs/specs/content.md):
//   src/content/lessons/<id>.ts — урок (export const lesson: Lesson)
//   src/lib/bank/<id>.ts        — банк заданий (export const BANKS: SkillBank[])
//   src/content/ent/<id>.ts     — задания в формате ЕНТ (export const ITEMS: EntItem[])
// Ошибки (exit 1) — то, что сломает тесты; предупреждения — то, что стоит поправить.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { EntItem, Lesson, Level, QuestionStep, Step } from "../src/lib/types";
import type { SkillBank } from "../src/lib/bank/types";
import { UNITS } from "../src/content/course";
import { SKILLS } from "../src/content/skills";
import { checkInput } from "../src/lib/check";
import { isQuestion } from "../src/lib/evaluate";
import { validateEnt, validateScene, validateStep } from "../tests/validate";

const id = process.argv[2];
if (!id) {
  console.error("Использование: npx tsx scripts/check-content.ts <lessonId>");
  process.exit(2);
}

const root = join(__dirname, "..");
const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const KK_LETTERS = /[әғқңөұүһі]/i;

/** Обходит все L-строки объекта: ru не должен содержать казахских букв, kk не должен совпадать с длинным ru. */
function checkLanguages(where: string, value: unknown, depth = 0): void {
  if (depth > 12 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkLanguages(`${where}[${i}]`, v, depth + 1));
    return;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.ru === "string" && typeof obj.kk === "string" && Object.keys(obj).length === 2) {
    const ru = obj.ru;
    const kk = obj.kk;
    if (KK_LETTERS.test(ru)) warn(`${where}: в ru есть казахские буквы — «${ru.slice(0, 50)}»`);
    if (ru.length > 24 && ru === kk && /[а-яё]{4,}/i.test(ru)) warn(`${where}: kk совпадает с ru (не переведено?) — «${ru.slice(0, 50)}»`);
    if (/ЕНТ/.test(kk)) err(`${where}: в kk должно быть «ҰБТ», а не «ЕНТ»`);
    if (/бинарл/i.test(kk)) err(`${where}: в kk «екілік», а не «бинарлы»`);
    return;
  }
  for (const [k, v] of Object.entries(obj)) checkLanguages(`${where}.${k}`, v, depth + 1);
}

async function load<T>(rel: string, exportName: string): Promise<T | undefined> {
  const file = join(root, rel);
  if (!existsSync(file)) return undefined;
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  if (!(exportName in mod)) {
    err(`${rel}: нет экспорта ${exportName}`);
    return undefined;
  }
  return mod[exportName] as T;
}

async function main() {
  const knownSkills = new Set(SKILLS.map((s) => s.id));
  const unit = UNITS.find((u) => u.lessons.some((l) => l.id === id));
  if (!unit) err(`урока ${id} нет в UNITS (src/content/course.ts)`);
  const ref = unit?.lessons.find((l) => l.id === id);

  // ---------- Урок ----------
  const lesson = await load<Lesson>(`src/content/lessons/${id}.ts`, "lesson");
  if (!lesson) {
    err(`нет файла src/content/lessons/${id}.ts с export const lesson`);
  } else {
    if (lesson.id !== id) err(`lesson.id = ${lesson.id}, ожидается ${id}`);
    if (unit && lesson.unitId !== unit.id) err(`unitId = ${lesson.unitId}, ожидается ${unit.id}`);
    if (ref && (ref.title.ru !== lesson.title.ru || ref.title.kk !== lesson.title.kk)) {
      warn(`название отличается от карты курса: «${lesson.title.ru}» / «${ref.title.ru}» — главная модель синхронизирует`);
    }
    lesson.steps.forEach((s: Step) => validateStep(s).forEach(err));
    const ids = lesson.steps.map((s) => s.id);
    if (new Set(ids).size !== ids.length) err("повторяются id шагов");
    for (const s of lesson.skills) if (!knownSkills.has(s)) err(`навык ${s} не зарегистрирован в skills.ts`);
    for (const s of lesson.steps) if (s.skill && !lesson.skills.includes(s.skill)) err(`${s.id}: навык ${s.skill} не в lesson.skills`);
    if (lesson.conspect.ru.length < 300 || lesson.conspect.kk.length < 300) err("конспект короче 300 символов");
    if (!lesson.entTopics?.length) warn("не указаны entTopics");
    const questions = lesson.steps.filter(isQuestion) as QuestionStep[];
    if (questions.length < 4) err(`заданий ${questions.length} — нужно минимум 4`);
    if (questions.length > 9) warn(`заданий ${questions.length} — по методике не больше 8`);
    if (lesson.steps.length < 10 || lesson.steps.length > 18) warn(`шагов ${lesson.steps.length} — по методике 12–15`);
    for (const q of questions) {
      if (!q.hint) err(`${q.id}: нет hint (бесплатная подсказка обязательна)`);
      if ((q.type === "choice" || q.type === "multi") && !q.whyWrong) warn(`${q.id}: нет whyWrong`);
      if (!q.level) warn(`${q.id}: нет level`);
      if (!q.skill) err(`${q.id}: нет skill`);
    }
    if (!questions.some((q) => q.ent)) err("нет ни одного задания с ent: true");
    const infoTypes = new Set(lesson.steps.filter((s) => !isQuestion(s)).map((s) => s.type));
    if (!infoTypes.has("worked")) warn("нет пошагового разбора (worked)");
    if (!infoTypes.has("story")) warn("нет ситуации (story) в начале");
    const withScene = lesson.steps.filter((s) => s.scene || (s.type === "worked" && s.steps.some((x) => x.scene))).length;
    if (withScene < 3) warn(`схем в уроке ${withScene} — нужна иллюстрация к каждой новой идее`);
    // Повтор одного типа задания больше двух раз подряд — скучно.
    let run = 1;
    for (let i = 1; i < questions.length; i++) {
      run = questions[i].type === questions[i - 1].type ? run + 1 : 1;
      if (run === 3) warn(`три задания типа ${questions[i].type} подряд (до ${questions[i].id})`);
    }
    checkLanguages("lesson", lesson);
  }

  // ---------- Банк ----------
  const banks = await load<SkillBank[]>(`src/lib/bank/${id}.ts`, "BANKS");
  if (!banks) {
    err(`нет файла src/lib/bank/${id}.ts с export const BANKS`);
  } else {
    for (const b of banks) {
      if (lesson && !lesson.skills.includes(b.skill)) err(`банк ${b.skill}: навыка нет в lesson.skills`);
      if (!knownSkills.has(b.skill)) err(`банк ${b.skill}: навык не зарегистрирован`);
      for (const level of [1, 2, 3] as Level[]) {
        const keys = new Set<string>();
        for (let seed = 1; seed <= 60; seed++) {
          let q: QuestionStep;
          try {
            q = b.question(level, seed * 7919);
          } catch (e) {
            err(`банк ${b.skill}: question(${level}, ${seed}) бросил ошибку: ${(e as Error).message}`);
            break;
          }
          const problems = validateStep(q);
          if (problems.length) {
            err(`банк ${b.skill} L${level}: ${problems[0]}`);
            break;
          }
          if (q.skill !== b.skill) err(`банк ${b.skill}: задание с чужим skill ${q.skill}`);
          if (q.level !== undefined && q.level !== level && seed === 1) warn(`банк ${b.skill}: запрошен уровень ${level}, получен ${q.level} (нет заданий этого уровня)`);
          if (!q.hint) {
            warn(`банк ${b.skill}: у задания ${q.id} нет hint`);
          }
          keys.add(q.id.split("#")[0].split(":").slice(0, 4).join(":"));
          if (seed === 1) checkLanguages(`bank ${b.skill}`, q);
        }
        if (keys.size < 6) warn(`банк ${b.skill} L${level}: всего ${keys.size} разных заданий из 60 попыток — мало для тренировки`);
      }
      for (const shape of ["statement", "pair", "short"] as const) {
        const make = b[shape];
        if (!make) continue;
        for (let seed = 1; seed <= 30; seed++) {
          for (const level of [1, 2, 3] as Level[]) {
            const item = make(level, seed * 104729) as unknown as Record<string, unknown>;
            if (shape === "statement") {
              const st = item as { text: { ru: string; kk: string }; explanation: { ru: string; kk: string }; value: unknown };
              if (!st.text?.ru || !st.text?.kk || !st.explanation?.ru || !st.explanation?.kk) err(`банк ${b.skill}: statement без ru/kk`);
              if (typeof st.value !== "boolean") err(`банк ${b.skill}: statement.value не boolean`);
            }
            if (shape === "short") {
              const sq = item as { answer: string; mode: "number" | "binary" | "text"; prompt: { ru: string; kk: string } };
              if (!checkInput(sq.answer, [sq.answer], sq.mode)) err(`банк ${b.skill}: short-ответ не проходит свою проверку`);
              if (!sq.prompt?.ru || !sq.prompt?.kk) err(`банк ${b.skill}: short без ru/kk`);
            }
            if (shape === "pair") {
              const p = item as { left: unknown; right: unknown };
              if (!p.left || !p.right) err(`банк ${b.skill}: пустая пара`);
            }
          }
        }
      }
    }
    if (lesson) for (const s of lesson.skills) if (!banks.some((b) => b.skill === s)) err(`для навыка ${s} нет банка`);
  }

  // ---------- Задания ЕНТ ----------
  const items = await load<EntItem[]>(`src/content/ent/${id}.ts`, "ITEMS");
  if (!items) {
    err(`нет файла src/content/ent/${id}.ts с export const ITEMS`);
  } else {
    items.forEach((it) => validateEnt(it).forEach(err));
    const ids = items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) err("ЕНТ: повторяются id");
    for (const it of items) {
      if (!it.id.startsWith(`${id}:`)) err(`${it.id}: id должен начинаться с «${id}:»`);
      if (lesson && !lesson.skills.includes(it.skill)) err(`${it.id}: навык ${it.skill} не из урока`);
      if (lesson?.entTopics && !lesson.entTopics.includes(it.topic)) warn(`${it.id}: тема ${it.topic} не из entTopics урока`);
      if (it.scene) validateScene(it.scene).forEach((e) => err(`${it.id}: ${e}`));
      // Подсказка нужна каждому заданию: в работе над ошибками она бесплатная и одна на всех (без ИИ).
      if (it.kind === "context") it.questions.forEach((q) => !q.hint && warn(`${it.id}/${q.id}: нет hint`));
      else if (!it.hint) warn(`${it.id}: нет hint`);
    }
    const count = (k: EntItem["kind"]) => items.filter((i) => i.kind === k).length;
    // Урок о стратегии ЕНТ сам не даёт экзаменационных заданий.
    const strategy = lesson?.skills.includes("ent.strategy");
    if (!strategy) {
    if (count("single") < 10) err(`ЕНТ: single ${count("single")} — нужно минимум 10`);
    if (count("multi") < 3) err(`ЕНТ: multi ${count("multi")} — нужно минимум 3`);
    if (count("match") < 3) err(`ЕНТ: match ${count("match")} — нужно минимум 3`);
    const levels = [1, 2, 3].map((l) => items.filter((i) => i.level === l).length);
    if (levels.some((n) => n === 0)) err(`ЕНТ: нужны задания всех уровней A/B/C (сейчас ${levels.join("/")})`);
    }
    checkLanguages("ent", items);
  }

  for (const w of warnings) console.log(`  предупреждение: ${w}`);
  for (const e of errors) console.log(`  ОШИБКА: ${e}`);
  console.log(`\n${id}: ошибок ${errors.length}, предупреждений ${warnings.length}`);
  process.exit(errors.length ? 1 : 0);
}

void main();
