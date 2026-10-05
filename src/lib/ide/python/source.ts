// Разбор исходника Python без запуска — чистая логика (тесты — tests/context-drill.test.ts).

/** Программа читает ввод: есть вызов input(...) вне комментария. Нужно, чтобы показать поле «Ввод» у запуска программы в сцене. */
export function readsInput(code: string): boolean {
  return code.split("\n").some((line) => /\binput\s*\(/.test(line.replace(/#.*$/, "")));
}
