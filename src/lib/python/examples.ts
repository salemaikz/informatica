// Примеры для Python-песочницы — по темам курса. Тексты (название и код с комментариями) — в i18n/parts/python.ts.

export const PY_EXAMPLES = [
  { id: "vars", stdin: "" },
  { id: "if", stdin: "7\n" },
  { id: "for", stdin: "" },
  { id: "while", stdin: "" },
  { id: "str", stdin: "" },
  { id: "list", stdin: "" },
  { id: "func", stdin: "" },
  { id: "rec", stdin: "" },
] as const;

export type PyExampleId = (typeof PY_EXAMPLES)[number]["id"];

export const pyExampleTitleKey = (id: PyExampleId) => `python.ex.${id}` as const;
export const pyExampleCodeKey = (id: PyExampleId) => `python.ex.${id}.code` as const;

/** Есть ли в коде вызов input( — тогда показываем поле ввода. */
export function usesInput(code: string): boolean {
  return /\binput\s*\(/.test(code);
}
