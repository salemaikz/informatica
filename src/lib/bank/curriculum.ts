import { CURRICULUM_LESSONS } from "@/content/lessons";
import { lookupContextQuestion } from "@/content/contexts";
import type { InputStep, L, Level, QuestionStep, SkillId } from "../types";
import { seeded } from "../text";
import type { Pair, SkillBank, Statement } from "./types";

const l = (ru: string, kk: string): L => ({ ru, kk });
export const CURRICULUM_QUESTIONS: QuestionStep[] = CURRICULUM_LESSONS.flatMap((lesson) =>
  lesson.steps.filter((step): step is QuestionStep => step.type !== "theory" && step.type !== "video"),
);

const PROCEDURAL = new Set(["ns.octhex", "ns.arithmetic", "info.units", "info.coding", "py.variables", "py.loops", "py.lists", "py.functions", "db.sql", "data.sheets", "it.3d"]);

function numeric(skill: string, level: Level, a: number, b: number): InputStep | undefined {
  const id = `g2:${skill}:${level}:${a}:${b}`;
  const base = { id, type: "input" as const, skill, level, mode: "number" as InputStep["mode"] };
  const q = (prompt: L, answer: number | string, explanation: L, mode: InputStep["mode"] = "number"): InputStep => ({ ...base, prompt, answers: [String(answer)], explanation, mode });
  switch (skill) {
    case "ns.octhex": { const radix = b % 2 ? 8 : 16; const suffix = radix === 8 ? "₈" : "₁₆"; const digits = a.toString(radix).toUpperCase(); return q(l(`Переведи ${digits}${suffix} в десятичную систему.`, `${digits}${suffix} санын ондық жүйеге аудар.`), a, l(`Учитываем веса разрядов основания ${radix}. ${digits}${suffix}=${a}₁₀.`, `${radix} негізінің разряд салмақтарын ескереміз. ${digits}${suffix}=${a}₁₀.`)); }
    case "ns.arithmetic": return q(l(`Вычисли ${a.toString(2)}₂ + ${b.toString(2)}₂. Ответ в двоичной системе.`, `${a.toString(2)}₂ + ${b.toString(2)}₂ мәнін есепте. Жауапты екілік жүйеде жаз.`), (a + b).toString(2), l(`В десятичной системе ${a}+${b}=${a + b}; двоичная запись ${(a + b).toString(2)}₂.`, `Ондық жүйеде ${a}+${b}=${a + b}; екілік жазбасы ${(a + b).toString(2)}₂.`), "binary");
    case "info.units": return q(l(`Файл ${a} Кбайт передаётся со скоростью ${b * 1024} байт/с. 1 Кбайт=1024 байта. Время в секундах?`, `${a} Кбайт файл ${b * 1024} байт/с жылдамдықпен беріледі. 1 Кбайт=1024 байт. Уақыт неше секунд?`), a / b, l(`${a}·1024/(${b}·1024)=${a / b} с.`, `${a}·1024/(${b}·1024)=${a / b} с.`));
    case "info.coding": return q(l(`Несжатый растр ${a}×${b} пикселей, 8 бит на пиксель. Объём в байтах без заголовка?`, `Сығылмаған растр ${a}×${b} пиксель, пиксельге 8 бит. Тақырыпсыз көлемі неше байт?`), a * b, l(`${a}·${b}·8/8=${a * b} байт.`, `${a}·${b}·8/8=${a * b} байт.`));
    case "py.variables": return q(l(`Что выведет print(${a} // ${b} + ${a} % ${b})?`, `print(${a} // ${b} + ${a} % ${b}) не шығарады?`), Math.floor(a / b) + a % b, l(`Частное ${Math.floor(a / b)}, остаток ${a % b}; сумма ${Math.floor(a / b) + a % b}.`, `Бөлінді ${Math.floor(a / b)}, қалдық ${a % b}; қосынды ${Math.floor(a / b) + a % b}.`));
    case "py.loops": { const values = Array.from({ length: a }, (_, i) => i + 1).filter((n) => n % b !== 0); const sum = values.reduce((s, n) => s + n, 0); return q(l(`Что выведет программа?\n\n\`\`\`python\ns = 0\nfor i in range(1, ${a + 1}):\n    if i % ${b} == 0:\n        continue\n    s += i\nprint(s)\n\`\`\``, `Программа не шығарады?\n\n\`\`\`python\ns = 0\nfor i in range(1, ${a + 1}):\n    if i % ${b} == 0:\n        continue\n    s += i\nprint(s)\n\`\`\``), sum, l(`Пропускаем кратные ${b}; складываем ${values.join("+")}=${sum}.`, `${b}-ге еселі сандарды өткізіп,${values.join("+")}=${sum} қосамыз.`)); }
    case "py.lists": { const arr = [a, b, a + b, a - b]; const sum = arr.filter((n) => n % 2 === 0).reduce((s, n) => s + n, 0); const program = `a = [${arr.join(", ")}]\ns = 0\nfor x in a:\n    if x % 2 == 0:\n        s += x\nprint(s)`; return q(l(`Что выведет программа?\n\n\`\`\`python\n${program}\n\`\`\``, `Программа не шығарады?\n\n\`\`\`python\n${program}\n\`\`\``), sum, l(`Чётные элементы: ${arr.filter((n) => n % 2 === 0).join(", ") || "нет"}; сумма ${sum}.`, `Жұп элементтер: ${arr.filter((n) => n % 2 === 0).join(", ") || "жоқ"}; қосынды ${sum}.`)); }
    case "py.functions": { const program = `def f(n):\n    if n == 0:\n        return 0\n    return f(n - 1) + ${b}\nprint(f(${a}))`; return q(l(`Что выведет программа?\n\n\`\`\`python\n${program}\n\`\`\``, `Программа не шығарады?\n\n\`\`\`python\n${program}\n\`\`\``), a * b, l(`База 0; прибавляем ${b} при ${a} возвратах: ${a}·${b}=${a * b}.`, `База 0;${a} қайтуда ${b} қосамыз: ${a}·${b}=${a * b}.`)); }
    case "db.sql": { const scores = [a, a + 5, b, b + 10]; const count = scores.filter((n) => n >= a + 5).length; return q(l(`В таблице scores значения score: ${scores.join(", ")}. Результат SELECT COUNT(*) FROM scores WHERE score>=${a + 5}?`, `scores кестесінде score мәндері: ${scores.join(", ")}. SELECT COUNT(*) FROM scores WHERE score>=${a + 5} нәтижесі?`), count, l(`Проверяем каждую строку; подходят ${scores.filter((n) => n >= a + 5).join(", ")}. COUNT=${count}.`, `Әр жолды тексереміз; ${scores.filter((n) => n >= a + 5).join(", ")} сәйкес. COUNT=${count}.`)); }
    case "data.sheets": return q(l(`В A1 значение ${a}, в A2 значение ${b}. Что даст =A1*2+A2?`, `A1 мәні ${a}, A2 мәні ${b}. =A1*2+A2 не береді?`), a * 2 + b, l(`Сначала умножение: ${a}·2+${b}=${a * 2 + b}.`, `Алдымен көбейту: ${a}·2+${b}=${a * 2 + b}.`));
    case "it.3d": return q(l(`Куб со стороной ${a} равномерно увеличили в ${b} раза. Объём нового куба?`, `Қабырғасы ${a} куб ${b} есе біркелкі үлкейтілді. Жаңа куб көлемі?`), (a * b) ** 3, l(`Сторона ${a * b}; объём(${a}·${b})³=${(a * b) ** 3}.`, `Қабырғасы ${a * b}; көлемі(${a}·${b})³=${(a * b) ** 3}.`));
  }
}

export function generateCurriculumQuestion(skill: SkillId, level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  if (PROCEDURAL.has(skill) && rand() < 0.7) {
    const hi = level === 1 ? 9 : level === 2 ? 25 : 80;
    let a = int(3, hi); let b = int(2, Math.min(a, level + 3));
    if (skill === "info.units") a *= b;
    if (skill === "info.coding") { a = 2 ** int(3, 5 + level); b = 2 ** int(2, 4 + level); }
    if (skill === "py.functions") a = int(2, 3 + level);
    if (skill === "it.3d") { a = int(1, 3 + level); b = int(2, 3); }
    const question = numeric(skill, level, a, b);
    if (question) return question;
  }
  const pool = CURRICULUM_QUESTIONS.filter((question) => question.skill === skill && question.level === level);
  if (!pool.length) throw new Error(`Нет заданий для ${skill} уровня ${level}`);
  const picked = pool[Math.floor(rand() * pool.length)];
  // Развёрнутое решение становится обычным вводом в тренировке: без запроса ИИ.
  if (picked.type === "solution") return { id: picked.id, type: "input", skill, level, prompt: picked.prompt, answers: [picked.answer], mode: picked.answerMode, explanation: picked.explanation };
  return { ...picked };
}

/** Сервер восстанавливает только наши задания; параметры ограничены. */
export function lookupPracticeQuestion(id: string): QuestionStep | undefined {
  const fixed = CURRICULUM_QUESTIONS.find((question) => question.id === id);
  if (fixed) return fixed;
  const ctx = lookupContextQuestion(id);
  if (ctx) return ctx;
  const m = id.match(/^g2:([a-z0-9.]+):([123]):(\d{1,4}):(\d{1,4})$/);
  if (!m || !PROCEDURAL.has(m[1])) return undefined;
  const a = Number(m[3]); const b = Number(m[4]);
  if (a < 1 || a > 4096 || b < 1 || b > 4096) return undefined;
  return numeric(m[1], Number(m[2]) as Level, a, b);
}

function textOf(value: string | L, lang: "ru" | "kk") { return typeof value === "string" ? value : value[lang]; }

export const CURRICULUM_BANKS: SkillBank[] = CURRICULUM_LESSONS.filter((lesson, index, all) => all.findIndex((item) => item.skills[0] === lesson.skills[0]) === index).map((lesson) => {
  const skill = lesson.skills[0];
  const choices = CURRICULUM_QUESTIONS.filter((q) => q.skill === skill && q.type === "choice");
  const inputs = CURRICULUM_QUESTIONS.filter((q): q is InputStep => q.skill === skill && q.type === "input");
  const pairs = CURRICULUM_QUESTIONS.filter((q) => q.skill === skill && q.type === "match").flatMap((q) => q.type === "match" ? q.pairs : []);
  return {
    skill, question: (level, seed) => generateCurriculumQuestion(skill, level, seed),
    ...(choices.length ? { statement: (level: Level, seed: number): Statement => {
      const rand = seeded(seed); const q = choices[Math.floor(rand() * choices.length)];
      if (q.type !== "choice") throw new Error("choice");
      const index = Math.floor(rand() * q.options.length);
      return { id: `s:${q.id}:${index}`, skill, level, text: l(`${q.prompt.ru}\n\n Ответ: ${textOf(q.options[index], "ru")}`, `${q.prompt.kk}\n\n Жауап: ${textOf(q.options[index], "kk")}`), value: index === q.correct, explanation: q.explanation };
    } } : {}),
    ...(pairs.length ? { pair: (level: Level, seed: number): Pair => { const index = Math.floor(seeded(seed)() * pairs.length); return { id: `pair:${skill}:${index}`, skill, level, ...pairs[index] }; } } : {}),
    ...(inputs.length || PROCEDURAL.has(skill) ? { short: (level: Level, seed: number) => {
      const generated = generateCurriculumQuestion(skill, level, seed);
      const q = generated.type === "input" ? generated : inputs[Math.floor(seeded(seed)() * inputs.length)];
      if (!q) throw new Error(`Нет короткого вопроса ${skill}`);
      return { id: q.id, skill, level, prompt: q.prompt, answer: q.answers[0], mode: q.mode, explanation: q.explanation };
    } } : {}),
  };
});
