# ТЗ: «Практикум» — IDE для ЕНТ: Python, SQL, HTML/CSS, JavaScript, Excel (v0.7)

> Запрос пользователя (2026-10-03): «нужно сделать IDE с Python, SQL, CSS, HTML, JavaScript, Excel — хотя бы для базовых вещей, чисто для ЕНТ». Этап 8 плана, расширенный. Решение #35.

## 0. Принципы
- **Всё работает в браузере ученика, бесплатно и без сервера**: Python — Pyodide (WebAssembly), SQL — sql.js (SQLite в WebAssembly), HTML/CSS — предпросмотр в изолированном `iframe`, JavaScript — Web Worker, Excel — свой движок формул (`src/lib/sheet`).
- **Правильность решает код** (проверка задачи), не ИИ. ИИ — только по кнопке «Объясни ошибку» (`spendAi("explain")`, цена на кнопке — `AiCost`).
- Уровень — **ЕНТ и школа**: короткие программы, базовые запросы, простая страница, формулы с относительными и абсолютными ссылками. Не профессиональная среда.
- Мобильная вёрстка (360–430 px) в первую очередь: редактор сверху, вывод снизу; на десктопе — рядом. Крупные кнопки «Запустить» / «Проверить».
- Строки интерфейса — у каждого исполнителя свой файл словаря (уже подключены в `dict.ts`): I0 — `src/i18n/parts/ide.ts` (префикс `ide.`), I1 — `ide-python.ts` (`idepy.`), I2 — `ide-sql.ts` (`idesql.`), I3 — `ide-web.ts` (`ideweb.`), I4 — `ide-excel.ts` (`idexl.`). Тексты задач — `{ ru, kk }` в файлах задач. Код задач и сообщения интерпретатора не переводим.

## 1. Общий контракт (уже в коде — `src/lib/ide/types.ts`)
`IdeLang`, `IdeTask` (id, lang, level A/B/C, skill, title, prompt, starter, hint, solution, check), `IdeCheck` (по языку), `WebRule`, `CheckResult`, `RunOutput`, `WorkspaceProps`, `CODE_XP`. Реестр языков — `src/components/ide/registry.ts` (главная модель): для каждого языка — заголовок, иконка, задачи (`src/lib/ide/<lang>/tasks.ts` → `export const TASKS: IdeTask[]`) и рабочая область (`src/components/ide/<lang>/Workspace.tsx` → `export function Workspace(props: WorkspaceProps)`). Редактор кода — `src/components/ide/CodeEditor.tsx` (пропсы: `value`, `onChange`, `language: EditorLanguage`, `minHeight?`, `readOnly?`, `ariaLabel`, `highlightLine?`). Черновики — `src/lib/ide/drafts.ts`. Прогресс — стор: `codeTasks`, `recordCodeTask(task, ok)`.

## 2. Исполнители и их файлы

### I0 — оболочка «Практикума» и редактор
**Файлы:** `src/app/(main)/code/page.tsx`, `src/app/(main)/code/[lang]/page.tsx`, `src/app/(main)/code/[lang]/[task]/page.tsx`, `src/components/ide/{IdeShell,TaskList,TaskPanel,ResultBanner,IdeAiHelp,CodeEditor,LangTabs}.tsx` (+ свои), `src/i18n/parts/ide.ts`, `tests/ide-shell.test.ts` (чистые помощники).
- **`CodeEditor`** — CodeMirror 6 (пакеты уже установлены: `codemirror`, `@codemirror/lang-python`, `-sql`, `-html`, `-css`, `-javascript`, `@codemirror/view`, `@codemirror/state`): нумерация строк, подсветка, отступ Tab = 4 пробела (Python), автозакрытие скобок, тема из CSS-переменных (светлая/тёмная), шрифт `font-mono`, крупный шрифт на телефоне (15–16 px), `highlightLine` — подсветка строки (для пошагового режима Python). Без SSR (динамический импорт). Сохранить текущие пропсы — ими уже пользуются другие исполнители.
- **`/code`** — «Практикум»: 5 карточек языков (иконка, «Python — 3/10 решено», прогресс), «Продолжить последнюю задачу».
- **`/code/[lang]`** — вкладки языков (`LangTabs`, горизонтальная прокрутка на телефоне), переключатель «Задачи / Песочница». Задачи — список от A к C, решённые с галочкой. Песочница — рабочая область без задачи (`task: null`) с примером кода по умолчанию.
- **`/code/[lang]/[task]`** — карточка условия (заголовок, уровень, markdown условия, «Подсказка», «Показать решение» — после 2 неудачных проверок или после решения), рабочая область, итог (`ResultBanner`: верно — зелёный, «+15 XP» с анимацией и звуком `feedback("complete")`; неверно — что не так и пример вход/ожидалось/получено), «Следующая задача».
- **Черновики**: код задачи и песочницы хранится в `localStorage` (`src/lib/ide/drafts.ts`, ключ `informatica:code:v1:<taskId|sandbox-<lang>>`), «Сбросить к началу».
- **`IdeAiHelp`** — кнопка «Объясни ошибку» (фиолетовая, `AiCost kind="explain"`), когда последний запуск дал ошибку: открывает `AiPanel` (mode `explain`, task = условие + код + текст ошибки). Без ошибки — «Спросить Бита» (mode `ask`).
- XP: `useApp.getState().recordCodeTask(task, ok)` → `{ xp, first }`.

### I1 — Python
**Файлы:** `src/lib/ide/python/{tasks,check}.ts`, `src/components/ide/python/{Workspace,Tracer}.tsx`, `public/ide/python-worker.js`, `tests/ide-python.test.ts`.
- Pyodide в Web Worker (`public/ide/python-worker.js`, `importScripts` с CDN `cdn.jsdelivr.net/pyodide/v<версия>/full/pyodide.js`; версию проверить `npm view pyodide version`). Загрузка по требованию с индикатором «Загружаем Python…» (≈ 10 МБ один раз, дальше из кэша браузера).
- Поле «Входные данные» — строки для `input()`. Вывод `print` и ошибки (последняя строка трассировки, с номером строки). **Таймаут 5 с** → `worker.terminate()` и сообщение «Программа работает слишком долго — возможно, бесконечный цикл».
- **«Пошагово»** (трассировка, как в задачах ЕНТ «что выведет программа»): `sys.settrace` собирает до 300 шагов (номер строки, значения простых переменных int/float/str/bool/list до 10 элементов, вывод к этому моменту); `Tracer` — подсветка строки в редакторе, таблица переменных, «назад/вперёд», ползунок.
- Проверка: `check: { kind: "python", tests: [{ stdin, stdout }] }` — запуск на каждом тесте, сравнение вывода без хвостовых пробелов и пустых строк в конце (`normalizeOutput` в `check.ts`, с тестами).
- **10 задач** (A→C, навыки `py.*`): вывод и арифметика; ввод двух чисел и сумма; чётное/нечётное (if); максимум из трёх; цикл for — сумма 1..n; while — сумма цифр; строки — подсчёт гласных / разворот; списки — среднее и максимум; функция; перевод в двоичную вручную (без `bin`). Тест эталонных решений: `tests/ide-python.test.ts` запускает `solution` каждой задачи системным `python3` (если есть, иначе `skip`) и сверяет с тестами задачи.

### I2 — SQL
**Файлы:** `src/lib/ide/sql/{db,tasks,check}.ts`, `src/components/ide/sql/{Workspace,ResultTable,SchemaView}.tsx`, `tests/ide-sql.test.ts`.
- `sql.js` (пакет установлен): `initSqlJs({ locateFile: (f) => "https://cdn.jsdelivr.net/npm/sql.js@<версия из package.json>/dist/" + f })`. База пересоздаётся перед каждым запуском из `db.ts` (`SCHEMA_SQL` — учебные таблицы как в ЕНТ: `students` (id, name, class, city, score), `classes`, `books`, `orders` и т.п., ≈ 10–15 строк в каждой, имена латиницей и кириллицей в данных).
- `SchemaView` — таблицы и столбцы (раскрывающиеся, с первыми строками). `ResultTable` — результат (до 100 строк), «Строк: N», ошибки SQL понятным текстом.
- Проверка: результат запроса ученика сравнивается с результатом `reference` (имена столбцов не важны, порядок строк — если `ordered`); задачи на изменение — сравнение `checkQuery` после обоих.
- **8 задач**: SELECT *; выбор столбцов; WHERE с AND/OR; ORDER BY DESC; COUNT; AVG с GROUP BY; LIKE; UPDATE (или INSERT) с проверкой. Навыки `db.select`, `db.modify`. Тесты в node (`sql.js` из `node_modules`): эталон проходит, явная ошибка — нет.

### I3 — HTML/CSS и JavaScript
**Файлы:** `src/lib/ide/web/{tasks,checks,css}.ts`, `src/lib/ide/js/{tasks,check}.ts`, `src/components/ide/web/Workspace.tsx`, `src/components/ide/js/Workspace.tsx`, `public/ide/js-worker.js`, `tests/ide-web.test.ts`, `tests/ide-js.test.ts`.
- **HTML/CSS**: один документ (HTML с `<style>`), живой предпросмотр в `<iframe sandbox="allow-scripts" srcdoc>` (без `allow-same-origin`), переключатель «Код / Страница» на телефоне, рядом — на десктопе. Проверка `WebRule`: структура страницы проверяется скриптом-«проверщиком» внутри iframe (результат через `postMessage`, ждать ≤ 2 с), CSS-правила — разбором текста `<style>` (`css.ts`: селектор → свойства, без учёта регистра и пробелов, с тестами). **8 задач** (навыки `web.html`, `web.css`): заголовок `h1`; абзац и жирный текст; список `ul` из 3 пунктов; ссылка `a href`; картинка с `alt`; таблица 2×2; цвет текста в CSS; класс `.note` с фоном.
- **JavaScript**: Web Worker с перехватом `console.log` (и ошибок), таймаут 3 с. Проверка — вывод. **6 задач** (без навыка курса — JavaScript в ЕНТ почти нет, это база для веба): вывод строки; переменные и арифметика; if; цикл for 1..5; функция; массив и сумма. Тесты эталонов — `node:vm` с перехватом консоли.

### I4 — Excel
**Файлы:** `src/lib/sheet/{parse,eval,refs,format}.ts` (+ `index.ts`), `src/lib/ide/excel/{tasks,check}.ts`, `src/components/ide/excel/{Workspace,Grid,FormulaBar}.tsx`, `tests/sheet.test.ts`, `tests/ide-excel.test.ts`.
- **Движок формул** (чистый, с тестами): числа, текст, `+ - * / ^ &`, сравнения, скобки; ссылки `A1`, `$A$1`, `A$1`, `$A1`, диапазоны `A1:B5`; функции (русские и английские имена): `СУММ/SUM`, `СРЗНАЧ/AVERAGE`, `МИН/MIN`, `МАКС/MAX`, `СЧЁТ/COUNT`, `СЧЁТЕСЛИ/COUNTIF`, `СУММЕСЛИ/SUMIF`, `ЕСЛИ/IF`, `ОКРУГЛ/ROUND`, `ABS`, `И/AND`, `ИЛИ/OR`; десятичная запятая и `;` как разделитель (как в русском Excel), точка и `,` — тоже; ошибки `#ДЕЛ/0!`, `#ЗНАЧ!`, `#ССЫЛКА!`, `#ИМЯ?`, циклическая ссылка; **копирование формулы** со сдвигом относительных ссылок (`shiftFormula(formula, dRow, dCol)`) — главное задание ЕНТ про таблицы.
- **Интерфейс**: сетка A–H × 1–15 (прокрутка внутри сетки, не страницы), строка формул, выбор ячейки, ввод, Enter — ниже; «Показать формулы»; «Протянуть вниз/вправо» (копирует формулу выделенной ячейки на N ячеек — видно, как меняются ссылки). Код задачи = JSON ячеек (`{"A1":"5","B1":"=A1*2"}`).
- Проверка `{ kind: "excel", cells, formulas }`: значения ячеек после пересчёта и что в `formulas` — именно формулы. **8 задач** (навыки `sheets.formulas`, `sheets.refs`): сумма строки; СРЗНАЧ; МАКС/МИН; ЕСЛИ (оценка «сдал/не сдал»); абсолютная ссылка (процент от итога, протянуть вниз); СЧЁТЕСЛИ; что получится при копировании формулы; СУММЕСЛИ.

## 3. Проверки каждого исполнителя
`npx tsc --noEmit` (свои файлы), `npx eslint <свои файлы>`, `npx vitest run <свои тесты>`. Не запускать `build`, dev-сервер, git — работают параллельно другие исполнители. Итоговый отчёт: файлы, что сделано, ключи словаря, что не получилось.
