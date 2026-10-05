import type { QuestionStep, Lang } from "./types";
import { clampSecrets, type Secret } from "./answer-leak";
import { clozeBlanks } from "./evaluate";
import { toBinary } from "./check";
import { tx } from "./text";

// Ответы задания в виде «стоп-слов» для серверной проверки утечки (lib/answer-leak.ts).
// Клиент кладёт их в TaskContext.secrets, пока задание не решено: ИИ не вправе их назвать (#100).

/** Ответы нерешённого задания: каждый — список допустимых записей. Для заданий без «одного верного ответа» — пустой список. */
export function taskSecrets(step: QuestionStep, lang: Lang): string[][] {
  const out: Secret[] = [];
  switch (step.type) {
    case "choice":
      out.push([tx(step.options[step.correct], lang)]);
      break;
    case "multi":
      for (const i of step.correct) out.push([tx(step.options[i], lang)]);
      break;
    case "input":
      out.push(step.answers.map((a) => `${a}`));
      break;
    case "bits":
      out.push([toBinary(step.target, step.bits)]);
      break;
    case "ladder":
      out.push([toBinary(step.number)]);
      break;
    case "match":
      // Пары видны на экране по отдельности — ответ только их сочетание: «левое правое».
      for (const p of step.pairs) out.push([`${tx(p.left, lang)} ${tx(p.right, lang)}`]);
      break;
    case "order":
      out.push([step.items.map((i) => tx(i, lang)).join(" ")]);
      break;
    case "solution":
      out.push([step.answer]);
      break;
    case "cloze":
      for (const b of clozeBlanks(step)) {
        const forms = [...b.blank];
        if (b.label) forms.unshift(b.label[lang]);
        out.push(forms);
      }
      break;
    case "entmatch":
      step.items.forEach((item, i) => out.push([`${tx(item, lang)} ${tx(step.choices[step.answer[i]] ?? "", lang)}`]));
      break;
    case "code":
      break;
  }
  return clampSecrets(out);
}
