import type { EntItem, L, Scene, Step, Text } from "@/lib/types";
import { checkInput } from "@/lib/check";
import { clozeBlanks } from "@/lib/evaluate";
import { isKnownKey } from "@/components/scenes/keyboard";
import { VENN_NAME_MAX, isVennRegion } from "@/components/scenes/venn";
import { TASKS as PY_TASKS } from "@/lib/ide/python/tasks";

const filledL = (l: L) => !!l.ru?.trim() && !!l.kk?.trim();
const filledText = (t: Text) => (typeof t === "string" ? !!t.trim() : filledL(t));

/** Проблемы параметров сцены (пустой список — сцену можно нарисовать). */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`сцена ${scene.kind}: ${msg}`);
  switch (scene.kind) {
    case "binary":
      need(/^[01]+$/.test(scene.bits), "bits — только 0 и 1");
      need((scene.highlight ?? []).every((i) => Number.isInteger(i) && i >= 0 && i < scene.bits.length), "highlight вне диапазона");
      break;
    case "ladder":
      need(Number.isInteger(scene.number) && scene.number > 0, "number — целое > 0");
      need((scene.base ?? 2) >= 2, "base ≥ 2");
      break;
    case "lamps":
      need(/^[01]+$/.test(scene.states), "states — только 0 и 1");
      break;
    case "coins":
      need(scene.values.length > 0 && scene.values.every((v) => v > 0), "values — положительные числа");
      need((scene.picked ?? []).every((v) => scene.values.includes(v)), "picked должны быть среди values");
      break;
    case "decimal":
      need(/^\d+$/.test(scene.number), "number — только цифры");
      break;
    case "quest":
      need(!scene.caption || filledText(scene.caption), "пустая подпись");
      break;
    case "table": {
      const width = scene.columns?.length ?? scene.rows[0]?.length ?? 0;
      need(scene.rows.length > 0 && width > 0, "нет строк");
      need(scene.rows.every((r) => r.length === width), "строки разной длины (или не совпадают с columns)");
      need(scene.rows.flat().every((c) => typeof c === "string" || filledL(c)), "ячейка ru/kk");
      need(!scene.columns || scene.columns.every((c) => typeof c === "string" || filledL(c)), "заголовок ru/kk");
      need((scene.highlightRows ?? []).every((i) => i >= 0 && i < scene.rows.length), "highlightRows вне диапазона");
      need((scene.highlightCols ?? []).every((i) => i >= 0 && i < width), "highlightCols вне диапазона");
      need((scene.highlightCells ?? []).every(([r, c]) => r >= 0 && r < scene.rows.length && c >= 0 && c < width), "highlightCells вне диапазона");
      need(width <= 8 && scene.rows.length <= 16, "не больше 8 столбцов и 16 строк (экран телефона)");
      break;
    }
    case "code":
      need(scene.lines.length > 0 && scene.lines.length <= 24, "1–24 строки кода");
      need(scene.active === undefined || (scene.active >= 0 && scene.active < scene.lines.length), "active вне диапазона");
      need((scene.marks ?? []).every((i) => i >= 0 && i < scene.lines.length), "marks вне диапазона");
      need(scene.lines.every((l) => l.length <= 60), "строка длиннее 60 символов (экран телефона)");
      need(scene.lines.every((l) => !l.includes("\t")), "табуляция в коде — используй 4 пробела");
      need(!scene.run || scene.lang === "python", "кнопка «Запустить» (run) — только у кода на Python");
      break;
    case "circuit": {
      const ids = new Set<string>(scene.inputs);
      need(scene.inputs.length >= 1 && scene.inputs.length <= 4, "1–4 входа");
      need(scene.gates.length >= 1 && scene.gates.length <= 6, "1–6 вентилей");
      for (const g of scene.gates) {
        need(g.in.every((x) => ids.has(x)), `вентиль ${g.id}: вход до объявления (порядок gates — от входов к выходу)`);
        need(g.op === "not" ? g.in.length === 1 : g.in.length === 2, `вентиль ${g.id}: у not 1 вход, у остальных 2`);
        need(!ids.has(g.id), `вентиль ${g.id}: повтор id`);
        ids.add(g.id);
      }
      need(scene.gates.some((g) => g.id === scene.output), "output — id вентиля");
      need(Object.keys(scene.values ?? {}).every((k) => scene.inputs.includes(k)), "values — только для входов");
      break;
    }
    case "flow": {
      const ids = new Set(scene.nodes.map((n) => n.id));
      need(ids.size === scene.nodes.length, "повтор id блока");
      need(scene.nodes.every((n) => n.x >= 0 && n.x <= 4 && n.y >= 0 && n.y <= 9 && Number.isInteger(n.x) && Number.isInteger(n.y)), "x 0..4, y 0..9, целые");
      need(new Set(scene.nodes.map((n) => `${n.x}:${n.y}`)).size === scene.nodes.length, "два блока в одной клетке");
      need(scene.nodes.every((n) => filledText(n.label)), "подпись блока ru/kk");
      need(scene.edges.every((e) => ids.has(e.from) && ids.has(e.to)), "стрелка к несуществующему блоку");
      need(scene.edges.every((e) => !e.label || filledText(e.label)), "подпись стрелки ru/kk");
      need(!scene.active || ids.has(scene.active), "active — id блока");
      break;
    }
    case "cards":
      need(scene.items.length >= 1 && scene.items.length <= 9, "1–9 карточек");
      need(scene.items.every((i) => filledText(i.title) && (!i.text || filledText(i.text))), "текст карточки ru/kk");
      break;
    case "pixels": {
      const w = scene.rows[0]?.length ?? 0;
      need(scene.rows.length >= 1 && scene.rows.length <= 16 && w >= 1 && w <= 16, "от 1×1 до 16×16");
      need(scene.rows.every((r) => r.length === w), "строки разной длины");
      need(scene.rows.join("").split("").every((ch) => ch in scene.palette), "символ не из палитры");
      break;
    }
    case "web":
      need(scene.html.trim().length > 0, "пустой html");
      need(!/<script|on\w+\s*=|javascript:/i.test(scene.html + (scene.css ?? "")), "скрипты и обработчики запрещены");
      break;
    case "hardware":
      need(scene.items.length >= 1 && scene.items.length <= 9, "hardware: 1–9 рисунков");
      need(new Set(scene.items).size === scene.items.length, "hardware: повтор рисунка");
      need((scene.highlight ?? []).every((h) => scene.items.includes(h)), "hardware: подсветка не из items");
      break;
    case "pc-inside":
      break;
    case "cpu-cycle":
      need(scene.instr === undefined || scene.instr.length <= 14, "cpu-cycle: команда длиннее 14 символов");
      break;
    case "keyboard":
      need(scene.keys.length >= 1 && scene.keys.length <= 4, "keyboard: 1–4 клавиши");
      need(scene.keys.every(isKnownKey), `keyboard: неизвестная клавиша (${scene.keys.filter((k) => !isKnownKey(k)).join(", ")})`);
      break;
    case "sizes":
      need(scene.items.length >= 2 && scene.items.length <= 7, "sizes: 2–7 полос");
      need(scene.items.every((i) => Number.isFinite(i.bytes) && i.bytes > 0 && filledText(i.label)), "sizes: размер > 0 и подпись");
      break;
    case "files": {
      const count = (nodes: { name: string; children?: unknown[] }[]): number =>
        nodes.reduce((a, n) => a + 1 + (Array.isArray(n.children) ? count(n.children as { name: string; children?: unknown[] }[]) : 0), 0);
      need(scene.tree.length >= 1 && count(scene.tree) <= 14, "files: 1–14 узлов");
      break;
    }
    case "venn": {
      const n = scene.sets.length;
      const nameLen = (x: Text) => (typeof x === "string" ? [x.length] : [x.ru.length, x.kk.length]);
      need(n >= 2 && n <= 3, "venn: 2–3 множества");
      need(scene.sets.every(filledText), "venn: название множества не пустое (ru и kk)");
      need(scene.sets.every((s) => nameLen(s).every((len) => len <= VENN_NAME_MAX)), `venn: название множества длиннее ${VENN_NAME_MAX} символов (не влезет у круга)`);
      const keys = Object.keys(scene.values ?? {});
      need(keys.every((k) => isVennRegion(k, n)), `venn: values — недопустимая область для ${n} множеств (${keys.filter((k) => !isVennRegion(k, n)).join(", ")})`);
      need(Object.values(scene.values ?? {}).every((v) => typeof v === "string" && v.trim() !== "" && v.length <= 12), "venn: значение области — непустая строка до 12 символов");
      const hl = scene.highlight ?? [];
      need(hl.every((r) => isVennRegion(r, n)), `venn: highlight — недопустимая область для ${n} множеств`);
      need(new Set(hl).size === hl.length, "venn: highlight — повтор области");
      need(scene.universe === undefined || filledText(scene.universe), "venn: пустая подпись универсума");
      break;
    }
    case "layers":
      need(scene.items.length >= 2 && scene.items.length <= 6, "layers: 2–6 слоёв");
      need(scene.highlight === undefined || (scene.highlight >= 0 && scene.highlight < scene.items.length), "layers: highlight вне диапазона");
      need(scene.items.every((i) => filledText(i.title)), "layers: пустой заголовок");
      break;
  }
  if ("caption" in scene && scene.caption !== undefined) need(filledText(scene.caption), "пустая подпись");
  return errors;
}

/** Проблемы задания ЕНТ (пустой список — задание корректно). */
export function validateEnt(item: EntItem): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${item.id}: ${msg}`);
  const uniq = (arr: Text[]) => new Set(arr.map((o) => JSON.stringify(o))).size === arr.length;
  need(/^[a-z0-9-]+:[a-z0-9-]+$/.test(item.id), "id вида <урок>:<имя> (латиница, цифры, дефис)");
  need([1, 2, 3].includes(item.level), "level 1|2|3");
  if (item.scene) errors.push(...validateScene(item.scene).map((e) => `${item.id}: ${e}`));
  if (item.kind === "context") {
    need(filledL(item.text), "text ru/kk");
    need(item.questions.length === 5, "ровно 5 вопросов");
    for (const q of item.questions) {
      need(filledL(q.prompt) && filledL(q.explanation), `${q.id}: prompt/explanation ru/kk`);
      need(q.options.length === 4 && q.options.every(filledText) && uniq(q.options), `${q.id}: 4 разных варианта`);
      need(q.correct >= 0 && q.correct < 4, `${q.id}: correct 0..3`);
      need(!q.hint || filledL(q.hint), `${q.id}: hint ru/kk`);
    }
    need(new Set(item.questions.map((q) => q.id)).size === 5, "id вопросов уникальны");
    return errors;
  }
  need(filledL(item.prompt), "prompt ru/kk");
  need(filledL(item.explanation), "explanation ru/kk");
  need(!item.hint || filledL(item.hint), "hint ru/kk");
  switch (item.kind) {
    case "single":
      need(item.options.length === 4, "ровно 4 варианта");
      need(item.options.every(filledText) && uniq(item.options), "варианты непустые и разные");
      need(item.correct >= 0 && item.correct < 4, "correct 0..3");
      need(!item.whyWrong || (item.whyWrong.length === 4 && item.whyWrong[item.correct] === null), "whyWrong: 4 элемента, у верного null");
      need((item.whyWrong ?? []).every((w) => w === null || filledL(w)), "whyWrong ru/kk");
      break;
    case "multi":
      need(item.options.length === 6, "ровно 6 вариантов");
      need(item.options.every(filledText) && uniq(item.options), "варианты непустые и разные");
      need(item.correct.length >= 2 && item.correct.length <= 3, "2–3 верных");
      need(new Set(item.correct).size === item.correct.length && item.correct.every((i) => i >= 0 && i < 6), "correct 0..5 без повторов");
      break;
    case "match":
      need(item.items.length === 2, "ровно 2 пункта (A, B)");
      need(item.choices.length === 4, "ровно 4 описания");
      need(item.items.every(filledText) && item.choices.every(filledText) && uniq(item.choices), "тексты непустые, описания разные");
      need(item.answer.length === 2 && item.answer.every((a) => a >= 0 && a < 4) && item.answer[0] !== item.answer[1], "answer: 2 разных индекса 0..3");
      // Буквы A/B и номера описаний экран добавляет сам — в тексте их быть не должно.
      need(
        [...item.items, ...item.choices].every((t) => !/^\s*([A-DА-Г]|\d)[.)]\s/.test(typeof t === "string" ? t : `${t.ru}\n${t.kk}`)),
        "не пиши «A. »/«1) » в начале пунктов и описаний — буквы и номера ставит экран",
      );
      break;
  }
  return errors;
}

/** Возвращает список проблем шага (пустой — шаг валиден). */
export function validateStep(step: Step): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${step.id}: ${msg}`);
  // Схемы шага: сцена теории/ситуации/разбора/решаем-вместе и «раскрытие» после ответа.
  const scenes: (Scene | undefined)[] = [step.reveal, step.scene];
  if (step.type === "worked") scenes.push(...step.steps.map((x) => x.scene));
  for (const sc of scenes) if (sc) errors.push(...validateScene(sc).map((e) => `${step.id}: ${e}`));
  if (step.reveal) need(step.type !== "video" && step.type !== "theory" && step.type !== "story" && step.type !== "worked" && step.type !== "explore", "reveal только у заданий");
  if (step.type === "video") need(filledL(step.title), "title");
  if (step.type === "theory") {
    need(filledL(step.title), "title");
    need(filledL(step.body), "body");
  }
  if (step.type === "story") need(filledL(step.body), "body");
  if (step.type === "worked") {
    need(filledL(step.title), "title");
    need(step.steps.length >= 2 && step.steps.every((x) => filledL(x.text)), "минимум 2 шага ru/kk");
    need(!step.result || filledL(step.result), "result ru/kk");
  }
  if (step.type === "explore") {
    need(filledL(step.title), "title");
    need(step.size >= 1 && step.size <= 8, "size 1..8");
    if (step.goal) need(step.goal.target >= 0 && filledL(step.goal.text), "goal");
  }
  if (step.type === "video" || step.type === "theory" || step.type === "story" || step.type === "worked" || step.type === "explore") return errors;

  need(filledL(step.prompt), "prompt ru/kk");
  need(filledL(step.explanation), "explanation ru/kk");
  need(!step.hint || filledL(step.hint), "hint ru/kk");
  if ((step.type === "choice" || step.type === "multi") && step.whyWrong) {
    const ww = step.whyWrong;
    const right = step.type === "choice" ? [step.correct] : step.correct;
    need(ww.length === step.options.length, "whyWrong: столько же элементов, сколько вариантов");
    need(right.every((i) => ww[i] === null), "whyWrong: у верных вариантов null");
    need(ww.every((w) => w === null || filledL(w)), "whyWrong ru/kk");
  }
  switch (step.type) {
    case "choice":
      need(step.options.length >= 2, "минимум 2 варианта");
      need(step.options.every(filledText), "пустой вариант");
      need(step.correct >= 0 && step.correct < step.options.length, "correct вне диапазона");
      need(new Set(step.options.map((o) => JSON.stringify(o))).size === step.options.length, "повторяющиеся варианты");
      break;
    case "multi":
      need(step.options.length >= 3, "минимум 3 варианта");
      // На ЕНТ в заданиях с несколькими ответами ровно 6 вариантов (аудит C4); правило — для шагов уроков и банков.
      need(!step.ent || step.options.length === 6, "multi с пометкой ЕНТ: ровно 6 вариантов");
      need(step.correct.length >= 1, "нет верных");
      need(step.correct.every((i) => i >= 0 && i < step.options.length), "correct вне диапазона");
      break;
    case "input":
      need(step.answers.length > 0, "нет ответов");
      need(step.answers.every((a) => checkInput(a, step.answers, step.mode)), "ответ не проходит свою проверку");
      break;
    case "bits":
      need(step.target >= 0 && step.target < 2 ** step.bits, "target не помещается в bits");
      break;
    case "ladder":
      need(step.number > 0 && step.number < 1024, "number вне 1..1023");
      break;
    case "match":
      need(step.pairs.length >= 3 && step.pairs.length <= 6, "3–6 пар");
      need(new Set(step.pairs.map((p) => JSON.stringify(p.right))).size === step.pairs.length, "повторы справа");
      break;
    case "order":
      need(step.items.length >= 3 && step.items.every(filledL), "минимум 3 пункта ru/kk");
      break;
    case "solution":
      need(filledL(step.reference), "reference");
      need(checkInput(step.answer, [step.answer], step.answerMode), "answer");
      break;
    case "cloze": {
      const blanks = clozeBlanks(step);
      need(blanks.length >= 1, "нет пропусков");
      need(blanks.every((b) => b.blank.length > 0 && b.blank.every((v) => checkInput(v, b.blank, b.mode))), "ответ пропуска не проходит свою проверку");
      need(step.lines.flat().every((t) => (typeof t === "object" && !("blank" in t) ? filledL(t) : true)), "текст ru/kk");
      need(blanks.every((b) => b.width === undefined || b.width > 0), "width > 0");
      need(blanks.every((b) => b.mode !== "binary" || b.blank.every((v) => /^[01]+$/.test(v))), "двоичный пропуск: ответ из 0 и 1");
      break;
    }
    case "entmatch":
      // «Соответствие» как на ЕНТ (этап 14) — те же правила, что у EntMatch в validateEnt.
      need(step.items.length === 2, "ровно 2 пункта (A, B)");
      need(step.choices.length === 4, "ровно 4 описания");
      need(step.items.every(filledText) && step.choices.every(filledText), "тексты непустые");
      need(new Set(step.choices.map((o) => JSON.stringify(o))).size === 4, "описания разные");
      need(step.answer.length === 2 && step.answer.every((a) => Number.isInteger(a) && a >= 0 && a < 4) && step.answer[0] !== step.answer[1], "answer: 2 разных индекса 0..3");
      need(
        [...step.items, ...step.choices].every((t) => !/^\s*([A-DА-Г]|\d)[.)]\s/.test(typeof t === "string" ? t : `${t.ru}\n${t.kk}`)),
        "не пиши «A. »/«1) » в начале пунктов и описаний — буквы и номера ставит экран",
      );
      break;
    case "code": {
      // Задача практикума на Python с тем же навыком, что у шага (этап 14).
      const task = PY_TASKS.find((x) => x.id === step.task);
      need(!!task, `нет задачи практикума ${step.task}`);
      need(!task || task.lang === "python", "задача с кодом в уроке — только Python");
      need(!!step.skill, "у задачи с кодом нужен skill");
      break;
    }
  }
  return errors;
}
