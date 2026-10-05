import type { ClozeToken, L, QuestionStep, Lang } from "./types";
import { clampSecrets, contextWords, formKnown, leakTokens, PAIR_SEP, type Secret } from "./answer-leak";
import { toBinary } from "./check";
import { tx } from "./text";

// Ответы задания в виде «стоп-слов» для серверной проверки утечки (lib/answer-leak.ts).
// Клиент кладёт их в TaskContext.secrets, пока задание не решено: ИИ не вправе их назвать (#100).

/** Буквы только казахского алфавита: по ним отделяем казахские записи ответа от русских. */
const KK_ONLY = /[әіңғүұқөһ]/i;

/** Записи ответа только на языке урока (в blank лежат и ru-, и kk-записи): чужая запись никогда не «найдётся» в тексте. */
function formsFor(forms: string[], label: L | undefined, lang: Lang): string[] {
  const own = forms.filter((f) => (lang === "kk" ? KK_ONLY.test(f) : !KK_ONLY.test(f)));
  const res = new Set<string>();
  if (label) res.add(label[lang]);
  for (const f of own.length ? own : label ? [] : forms) res.add(f);
  return [...res].filter(Boolean);
}

/** Текст перед полем в той же строке → «предмет» пропуска: «Клавиатура — устройство ___» → «Клавиатура». */
function subjectOf(line: ClozeToken[], blankAt: number, lang: Lang): string {
  let prefix = "";
  for (const tok of line.slice(0, blankAt)) {
    if (typeof tok === "string") prefix += tok;
    else if ("blank" in tok) prefix += " ";
    else prefix += tx(tok, lang);
  }
  prefix = prefix.trim();
  const dash = prefix.search(/\s[—–-]\s|[:=]/);
  const subject = (dash >= 0 ? prefix.slice(0, dash) : prefix).trim();
  const words = leakTokens(subject);
  return words.length >= 1 && words.length <= 4 && words.join("").length >= 3 ? words.join(" ") : "";
}

/** Верные варианты выбора: если слово варианта есть и в условии, добавляем связку «слова условия ~ вариант». */
function optionForms(texts: string[], prompt: string): string[] {
  const res: string[] = [];
  for (const t of texts) {
    res.push(t);
    if (formKnown(t, prompt)) {
      const ctx = contextWords(prompt, t).join("|");
      if (ctx) res.push(`${ctx}${PAIR_SEP}${t}`);
    }
  }
  return res;
}

/** Ответы нерешённого задания: каждый — список допустимых записей. Для заданий без «одного верного ответа» — пустой список. */
export function taskSecrets(step: QuestionStep, lang: Lang): string[][] {
  const out: Secret[] = [];
  const prompt = tx(step.prompt, lang);
  switch (step.type) {
    case "choice":
      out.push(optionForms([tx(step.options[step.correct], lang)], prompt));
      break;
    case "multi":
      // Названа любая верная запись — уже утечка (в промпте «не выбирай варианты»), поэтому все верные — один секрет.
      out.push(optionForms(step.correct.map((i) => tx(step.options[i], lang)), prompt));
      break;
    case "input":
      out.push(step.answers.map((a) => `${a}`));
      break;
    case "bits": {
      // С ведущими нулями и без них: ИИ пишет «1011₂», а не «00001011».
      const full = toBinary(step.target, step.bits);
      const short = toBinary(step.target);
      out.push(short.length >= 3 && short !== full ? [full, short] : [full]);
      break;
    }
    case "ladder":
      out.push([toBinary(step.number)]);
      break;
    case "match":
      // Пары видны на экране по отдельности — ответ только их сочетание: «левое правое».
      for (const p of step.pairs) out.push([`${tx(p.left, lang)} ${tx(p.right, lang)}`]);
      break;
    case "order": {
      // Порядок: каждая пара соседних пунктов — связка (рядом в одном предложении, хоть с номерами «1) … 2) …»).
      const keys = step.items.map((i) => leakTokens(tx(i, lang)).slice(0, 3).join(" "));
      for (let i = 0; i + 1 < keys.length; i++) {
        if (keys[i].length >= 3 && keys[i + 1].length >= 3) out.push([`${keys[i]}${PAIR_SEP}${keys[i + 1]}`]);
      }
      break;
    }
    case "solution":
      out.push([step.answer]);
      break;
    case "cloze":
      for (const line of step.lines) {
        line.forEach((tok, at) => {
          if (typeof tok === "string" || !("blank" in tok)) return;
          const forms = formsFor(tok.blank, tok.label, lang);
          // «Клавиатура — ввод»: слово ответа часто стоит и в условии, поэтому добавляем связку «предмет ~ ответ».
          const subject = subjectOf(line, at, lang);
          const pairs = subject ? forms.slice(0, 2).map((f) => `${subject}${PAIR_SEP}${f}`) : [];
          out.push([...forms, ...pairs]);
        });
      }
      break;
    case "entmatch":
      step.items.forEach((item, i) => out.push([`${tx(item, lang)} ${tx(step.choices[step.answer[i]] ?? "", lang)}`]));
      break;
    case "code":
      break;
  }
  // Одинаковые секреты (два пропуска «ввод») не должны считаться дважды.
  const seen = new Set<string>();
  const uniq = clampSecrets(out).filter((s) => {
    const k = JSON.stringify(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq;
}
