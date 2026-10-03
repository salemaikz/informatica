# Архитектура Matematika

> Как устроено приложение в коде: стек, папки, типы данных, проверка ответов, банк заданий, стор, ИИ-маршруты, тесты, деплой. Образец — **Informatica** (то же по информатике, снимок кода 2026-10-03). Эталонные файлы образца лежат в `reference/` (читать по одному файлу по ссылке отсюда, не весь каталог).
>
> Продуктовый смысл фич — `docs/CONCEPT.md`. Дизайн — `docs/DESIGN.md`. Методика урока — `docs/LESSON_METHOD.md`. ИИ и промпты — `docs/AI.md`. Мини-игры — `docs/GAMES.md`. Экзамен — `docs/ENT_MATH.md`. Процесс, git, Vercel по шагам — `docs/WORKFLOW.md`.
>
> **Этот файл главный по коду.** Если другой документ описывает тип или файл иначе — прав этот файл; противоречие с `AGENTS.md` или `docs/DECISIONS.md` — спросить владельца. Поменялось «как работает» — обновить этот файл в той же задаче.

**Метки:**
- **[образец]** — в Informatica так сделано и работает; повторяем, меняя тематику.
- **[новое]** — только в Matematika, в образце нет; здесь — рекомендуемый проект решения.
- **[план]** — делаем позже, по этапу `docs/ROADMAP.md`.
- **[предложение]** — наш вариант решения; утверждает владелец, решение — в `docs/DECISIONS.md`.
- **проверить** — факт не подтверждён; не выдавать за правду.

**Как читать (Codex):** `rg -n "^#" docs/ARCHITECTURE.md` → открыть только нужный раздел.

**Словарик** (роли моделей подробно — `AGENTS.md`, раздел 2):
- **прораб** — сильная модель Codex (какая и с каким усилием — `AGENTS.md`, раздел 2): план, ТЗ, архитектура, общие файлы, промпты ИИ, ревью; **исполнитель** — более дешёвая модель, делает одну задачу по готовому ТЗ (**ТЗ** — техническое задание: цель, файлы, ограничения, «готово, когда»).
- **App Router** — роутинг Next.js по папкам `src/app/*`; **route handler** — серверный файл `route.ts` (у нас только `/api/ai/*`); **Turbopack** — сборщик Next.js.
- **persist** — режим Zustand: стор сам сохраняется в `localStorage` и читается при запуске.
- **AST** — дерево разбора выражения (`2+3*4` → «плюс(2, умножить(3, 4))»).
- **seed** — число, из которого генератор детерминированно получает задание; **mulberry32** — простой генератор псевдослучайных чисел по seed (`seeded` в `lib/text.ts`).
- **mastery** (освоение) — число 0..1 по навыку; **EMA** — скользящее среднее: новое = 0,3 · результат + 0,7 · старое.
- **tolerance** — допустимая погрешность ответа; **дистрактор** — неверный вариант ответа (типичная ошибка ученика).
- **LazyMotion** — режим библиотеки `motion`, грузящий анимации частями (`components/motion/MotionProvider.tsx`).

**Чего нет в `reference/`.** В `reference/` лежат только файлы из списка в `reference/README.md`. Эталонов **нет** у: `components/lesson/*` (`LessonPlayer`, `Results`, шаги), `components/games/GameShell.tsx`, `components/tools/*`, `components/app/Providers.tsx`, `components/scenes/*`, `src/videos/*`, `lib/keys.ts`, `lib/scratch.ts`, `lib/calc.ts` (калькулятор образца), `lib/generators.ts`. Их пишем по описанию: логика — этот файл (разделы 5, 9.2, 12.3, 15), `GameShell` — `docs/GAMES.md`, раздел 4, внешний вид и пропсы — `docs/DESIGN.md` (таблица «Есть ли эталон» в разделе 5). Если описания не хватает, деталь не придумываем, а спрашиваем владельца. Метка [образец] значит «так сделано в Informatica», а не «файл лежит в `reference/`».

---

## 0. Суть в 12 строках

1. **Контент — это данные.** Урок — типизированный TS-объект (`Lesson` со списком `Step`), сразу на двух языках (`L = { ru, kk }`). Базы данных нет: контент собирается в бандл.
2. **Всё, что можно посчитать, считает код** (`src/lib/*`, чистые функции под тестами): правильность ответа, баллы ЕНТ, генерация заданий, числа на схемах, калькулятор, графики. ИИ только объясняет, подсказывает, ведёт чат, проверяет рукописное решение по фото и пишет отзыв.
3. **Проверка ответа — по значению, а не по строке:** `3,5` = `3.5` = `7/2` = `3½`; дроби — точно (рациональные числа на `BigInt`); свой парсер выражений, без `eval` (`src/lib/math/`).
4. **Один плеер** (`LessonPlayer`) проигрывает очередь шагов и для урока, и для тренировки.
5. **Прогресс** — один Zustand-стор с persist в localStorage (ключ `matematika-v1`). Действия стора — единственный способ менять прогресс.
6. **Банк заданий** (`SkillBank`) по каждому навыку выдаёт задание в нескольких формах по `(level, seed)` — детерминированно. Из банка питаются тренировка, игры, мини-ЕНТ и пробный ЕНТ.
7. **Формулы:** простое — Unicode (`2³`, `√2`, `½`, `3,5`), сложное — LaTeX в `$…$`, рендер KaTeX. Каждая LaTeX-строка контента проверяется тестом.
8. **Ввод ответа** — своя экранная математическая клавиатура на телефоне, обычная клавиатура на ПК.
9. **Сервер Next.js — только посредник к OpenAI** (`/api/ai/*`): ключ, лимиты, обрезка входа, лог токенов. Он ничего не хранит.
10. **Мини-игры** — по контракту `src/games/types.ts`, общая оболочка `GameShell`.
11. **Тесты** гарантируют: двуязычность, корректность ответов (пересчёт вторым способом), рендер формул, детерминизм генераторов, правила ЕНТ 2/1/0.
12. **Деплой** — Vercel, автосборка из ветки; `OPENAI_API_KEY` только в переменных окружения сервера.

---

## 1. Общая схема [образец]

```
Браузер (телефон / ПК)                                Сервер Next.js (route handlers)
┌──────────────────────────────────────────┐        ┌──────────────────────────────────┐
│ Страницы App Router (клиентские)         │        │ POST /api/ai/tutor        stream │
│ LessonPlayer + шаги + MathKeypad         │ fetch  │ POST /api/ai/check-solution JSON │──► OpenAI API
│ KaTeX (формулы), SVG-сцены, Remotion     │──────► │ POST /api/ai/lesson-feedback JSON│   (ключ только здесь)
│ Zustand ─► localStorage  (прогресс)      │        │ лимит по IP · обрезка · лог      │
│ idb-keyval ─► IndexedDB  (черновик)      │        └──────────────────────────────────┘
└──────────────────────────────────────────┘
        ▲ контент уроков, банк, словарь — в JS-бандле (статические TS-файлы)
```

| Что | Где живёт | Почему |
|---|---|---|
| Уроки, навыки, курс, формулы справочника, словарь интерфейса | `src/content/*`, `src/i18n/dict.ts` — в бандле | бесплатно, быстро, проверяется тестами и TypeScript |
| Задания тренировки, игр, пробного ЕНТ | генерируются кодом на устройстве (`src/lib/bank/*`) | бесконечный запас без ИИ и без сервера |
| Прогресс, профиль, XP, ошибки, заметки, чат, память ИИ | localStorage, ключ `matematika-v1` | MVP без бэкенда (как DECISIONS #3 образца) |
| Листы черновика (рисунки) | IndexedDB, ключ `matematika:scratch:v1` | dataURL тяжёлые для localStorage |
| Ключ OpenAI, промпты | только сервер (`src/server/*`) | ключ нельзя в браузер |
| Портрет ученика для ИИ | собирает клиент (`buildStudentContext`), шлёт с каждым запросом; сервер обрезает | сервер ничего не хранит |

**Принципы, которые нельзя нарушать:**
- Приложение полностью работает **без ключа OpenAI**: уроки, проверка, тренировка, игры, инструменты. Без ключа маршруты ИИ отвечают `503 ai_not_configured`, интерфейс показывает статический текст.
- Всё, что пришло с клиента или прочитано из хранилища, — **недоверенные данные** (санитизация на сервере, `sanitizePages` для черновика, `try/catch` вокруг storage).
- [план] Бэкенд и синхронизация: заменить хранилище стора, **не меняя интерфейс действий** (`recordAnswer`, `finishSession`, …).

---

## 2. Стек

### 2.1 Библиотеки

Версии — как в `reference/package.json` (снимок 2026-10-03). Ставить те же мажорные версии; новая зависимость — только с записью в `docs/DECISIONS.md`.

| Пакет | Версия в образце | Зачем | Где |
|---|---|---|---|
| `next` | 16.3.8 | App Router, серверные маршруты ИИ, Turbopack. **Новее обучающих данных моделей** — перед работой с API Next читать `node_modules/next/dist/docs/` | `src/app/*` |
| `react`, `react-dom` | 19.2.8 | UI. Правило линтера React 19: синхронный `setState` в эффекте запрещён | везде |
| `typescript` | ^5, `strict: true` | типы делают двуязычность обязательной (`L = { ru, kk }`) | везде |
| `tailwindcss` + `@tailwindcss/postcss` | ^4 | стили; токены цветов в `globals.css` через `@theme inline`, без `tailwind.config` | `src/app/globals.css` |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.7.0 | `cn()` — склейка классов с переопределением | `src/lib/cn.ts` |
| `zustand` | ^5.0.15 | стор прогресса (`persist`) и стор панели инструментов | `src/lib/store.ts`, `components/tools/useToolbox.ts` |
| `motion` | ^14.0.0 | анимации (`LazyMotion` + `m.*`) | `components/motion/*` |
| `lucide-react` | ^1.50.0 | иконки (эмодзи запрещены) | везде |
| `react-markdown` + `remark-gfm` | ^10.1.0 / ^4.0.1 | Markdown теории, конспектов, ответов ИИ **без сырого HTML** | `components/Markdown.tsx` |
| **`katex`** | **[новое]** последняя стабильная на момент установки | рендер LaTeX-формул | `components/math/Tex.tsx`, CSS в `layout.tsx` |
| **`remark-math` + `rehype-katex`** | **[новое]** последние стабильные | формулы `$…$` / `$$…$$` внутри Markdown (ответы ИИ, теория) | `components/Markdown.tsx` |
| `remotion` + `@remotion/player` | ^4.0.532 | видеоуроки как React-компоненты, проигрываются в браузере (нет mp4 и CDN) | `src/videos/*` |
| `canvas-confetti` (+ `@types/canvas-confetti`) | ^1.9.4 | конфетти на итогах и рекордах, грузится динамическим импортом | `Results`, `GameShell` |
| `idb-keyval` | ^6.3.0 | IndexedDB для черновика | `src/lib/scratch.ts` |
| `openai` | ^7.27.0 | SDK OpenAI — **только на сервере** и в офлайн-скриптах | `src/server/openai.ts`, `scripts/*` |
| `server-only` | ^0.0.1 | сборка падает, если серверный модуль попал в клиент | первая строка `src/server/*` |
| `@fontsource-variable/nunito`, `@fontsource-variable/jetbrains-mono` | ^5.3.0 | шрифты самохостингом (казахские буквы, работает офлайн) | `src/app/layout.tsx` |
| `vitest` | ^5.0.3 | юнит-тесты чистой логики и контента | `tests/` |
| `@playwright/test` | ^1.63.0 | e2e (эмуляция Pixel 7) | `e2e/` |
| `eslint` ^9 + `eslint-config-next` 16.3.8 | | линт (core-web-vitals + typescript) | `eslint.config.mjs` |
| `tsx` | ^4.23.15 | запуск офлайн-скриптов `.mts` | `scripts/review-kk.mts` |

- Установка KaTeX: `npm i katex remark-math rehype-katex`. Версии записать в `docs/DECISIONS.md`. Если TypeScript не видит типы `katex` — поставить `@types/katex` (**проверить** на момент установки).
- Python, CodeMirror, Pyodide из планов образца **не нужны**.

### 2.2 Скрипты `package.json` [образец]

```json
{
  "name": "matematika",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "typecheck": "next typegen && tsc --noEmit",
    "voiceover": "node --experimental-strip-types --no-warnings scripts/generate-voiceover.mts",
    "e2e": "playwright test",
    "review:kk": "tsx scripts/review-kk.mts"
  }
}
```

Перед коммитом: `npm run typecheck && npm run lint && npm test && npm run build`; перед выкладкой ещё `npm run e2e`.
Позже добавятся [новое]: `check:prompts` — живая проверка промптов (этап 2, `docs/AI.md`, 12.4) и `voiceover:verify` — обратная расшифровка озвучки (`docs/AI.md`, 12.3).
`next typegen` генерирует типы маршрутов — без него не работает `PageProps<"/lesson/[id]">`.

### 2.3 Конфиги (образцы в `reference/`, отличия для Matematika)

| Файл | Как в образце | Изменить |
|---|---|---|
| `tsconfig.json` (`reference/tsconfig.json`) | `strict`, `moduleResolution: bundler`, алиас `"@/*": ["./src/*"]`, `target: ES2017` | `"target": "ES2020"` — иначе TypeScript запрещает литералы `BigInt` (`10n`, ошибка TS2737); в `exclude` добавить `"reference"` (строки ниже) |
| `eslint.config.mjs` (`reference/eslint.config.mjs`) | `globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])` | добавить `"reference/**"` (строки ниже) |
| `vitest.config.mts` (`reference/vitest.config.mts`) | `include: ["tests/**/*.test.ts"]`, `environment: "node"`, алиас `@` | без изменений (`reference/` и так не попадает) |
| `playwright.config.ts` (`reference/playwright.config.ts`) | `testDir: "e2e"`, `baseURL http://localhost:3100`, `devices["Pixel 7"]`, `webServer: npm run build && npx next start -p 3100` | без изменений |
| `next.config.ts` | `{ devIndicators: false }` | без изменений |
| `postcss.config.mjs` | `@tailwindcss/postcss` | без изменений |
| `.env.example` (`reference/.env.example`) | ключ + модели + TTS | добавить `OPENAI_MODEL_REVIEW` и `OPENAI_TRANSCRIBE_MODEL`; готовый текст — раздел 21 |

`reference/` **не импортировать и не править** — это образцы, а не код проекта. Конфиги копируются в корень **с правками**, иначе `tsc` и `eslint` начнут проверять образцы и упадут на их импортах `@/…`:

```jsonc
// tsconfig.json — отличия от reference/tsconfig.json
"target": "ES2020",
"exclude": ["node_modules", "reference"]
```

```js
// eslint.config.mjs — отличие от reference/eslint.config.mjs
globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "reference/**"]),
```

Vitest (`include: ["tests/**/*.test.ts"]`) и `next build` (маршруты берутся только из `src/app`) папку `reference/` не трогают. **Проверка на этапе 1:** при лежащей в репозитории `reference/` проходят `npm run typecheck` и `npm run lint`.

---

## 3. Дерево папок целевого проекта

```
AGENTS.md                      правила для Codex
.env.example                   образец переменных (без значений)
.github/workflows/ci.yml       [новое, П-1.1] typecheck, lint, test на каждый PR и push в main
docs/                          CONCEPT, DESIGN, ARCHITECTURE, LESSON_METHOD, AI, GAMES, ENT_MATH,
                               ROADMAP, PROMPTS, WORKFLOW, CHANGELOG, DECISIONS, HANDOFF, tasks/
reference/                     эталоны Informatica (только читать)
scripts/
  review-kk.mts                вычитка казахского сильной моделью (офлайн)
  generate-voiceover.mts       озвучка видео OpenAI TTS → mp3 + durations.json (офлайн)
  verify-voiceover.mts         [новое] обратная расшифровка озвучки (docs/AI.md, 12.3)
  check-prompts.mts, prompt-cases.ts   [новое] живая проверка промптов (docs/AI.md, 12.4)
  screenshots.mts              [новое, П-1.2] скриншоты страниц: размеры, темы, языки → out/shots/
  icons.mts                    [новое, П-1.3] PNG-иконки PWA из icon.svg (Playwright)
  ai-cost.mts                  [предложение] расход ИИ по строкам логов (docs/AI.md, 11)
  fixtures/photos/             фото решений владельца для --photos (в .gitignore; docs/AI.md, 2.3)
  out/                         временные отчёты, скриншоты (в .gitignore)
public/icons/                  icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (PWA)
public/media/videos/<id>/<lang>/<scene>.mp3
e2e/                           Playwright: smoke.spec.ts, games.spec.ts, tools.spec.ts, games-full.spec.ts [план, этап 6]
tests/                         vitest: *.test.ts, validate.ts, math/*.test.ts, lessons/<id>.test.ts, games/*.test.ts
  stubs/server-only.ts         заглушка `export {};` для импорта "server-only" в тестах (docs/AI.md, 13)
src/
  app/
    layout.tsx                 шрифты, katex.min.css, метаданные, <Providers>
    globals.css                токены цветов (свет/тьма), @theme, анимации, .prose-app
    manifest.ts, icon.svg      PWA
    page.tsx                   редирект: onboarded ? /learn : /onboarding
    (main)/                    экраны с навигацией (AppShell)
      layout.tsx
      learn/                   карта курса (два трека), «следующий урок», цель дня
      practice/                тренировка, мини-игры, [план] мини-ЕНТ и пробный ЕНТ
      tutor/                   чат с наставником «Пи»
      notes/, notes/[id]/      конспекты
      stats/                   «Прогресс»
      profile/                 профиль и настройки
    lesson/[id]/               page.tsx (server: notFound) + LessonScreen.tsx (client)
    drill/                     page.tsx + DrillScreen.tsx (?mode=smart|mistakes|skill)
    game/[id]/page.tsx         → <GameShell id>
    onboarding/page.tsx        язык, имя, класс, цель, стиль, дневная цель
    dev/                       [новое, П-1.2] служебное: /dev (витрина компонентов), /dev/sketches/<имя> (эскизы); noindex, нет в меню
    api/ai/
      tutor/route.ts           чат / подсказка / разбор / вопрос по уроку (стрим)
      check-solution/route.ts  проверка решения по фото (JSON)
      lesson-feedback/route.ts отзыв после урока + память (JSON, дешёвая модель)
  components/
    ui/                        Button(+ButtonLink), Card(+SectionTitle), Modal, Pill, ProgressBar(+Ring)
    app/                       AppShell, Providers, Widgets, WeekChart, AchievementBadge
    lesson/                    LessonPlayer (ядро), Results, DrawingCanvas, ContextCard [новое]
    lesson/steps/              <Тип>View.tsx на каждый тип шага, Option.tsx, types.ts
    ai/                        AiPanel, useTutor
    mascot/Mascot.tsx          маскот «Пи» (SVG, 5 настроений)
    motion/                    presets, MotionProvider, Reveal, Shake, XpBurst, CountUp, ComboFlame, AnimatedChips, useReduceMotion
    scenes/                    SceneView (диспетчер) + <Kind>Scene.tsx + logic.ts + primitives.tsx + explore/ + quest/
    tools/                     Toolbox, useToolbox, Calculator, Formulas, GraphTool, Scratchpad
    games/GameShell.tsx        вступление → игра → итоги
    math/                      Tex.tsx (Tex, MathText), MathKeypad.tsx, AnswerPreview.tsx   [новое]
    Markdown.tsx               react-markdown + remark-gfm + remark-math + rehype-katex
  content/
    course.ts                  TRACKS, UNITS, LESSONS, getLesson, lessonNumber, unlockedSkills, findStep
    skills.ts                  SKILLS, skillById
    formulas.ts                справочник формул (разделы, LaTeX)   [новое]
    lessons/*.ts               по файлу на урок
  games/
    types.ts                   контракт (из reference без изменений)
    registry.ts                GAMES: GameMeta[], gameById
    components.ts              ленивые компоненты игр
    <id>/Game.tsx, logic.ts, strings.ts
  i18n/
    dict.ts                    все строки интерфейса { ru, kk }
    useT.ts                    t(key, params), l(text)
  lib/                         ЧИСТАЯ логика без React (кроме store/hooks/sound/feedback)
    types.ts                   все базовые типы (раздел 4)
    evaluate.ts                Answer, StepResult, isReady, evaluate, expectedText, promptText
    check.ts                   checkInput / checkFormat — тонкая обёртка над lib/math
    math/                      [новое] числа, дроби, выражения (раздел 6)
      rational.ts  normalize.ts  parse.ts  value.ts  compare.ts  interval.ts
      format.ts    tex.ts        keypad.ts calc.ts   graph.ts    algebra.ts
    generators.ts              каркас: canGenerate, generateLeveled, generateStep, buildDrill
    bank/                      types.ts, index.ts (реестр, draw, rampLevel), helpers.ts (int, pick, options), <тема>.ts
    ent.ts                     баллы ЕНТ 2/1/0, уровни A/B/C, состав пробного ЕНТ
    mastery.ts                 освоение навыка (EMA)
    gamification.ts            XP, уровни, серия, достижения
    games.ts                   награды за игры
    game-pool.ts               [план, этап 6] пул навыков игры (docs/GAMES.md, 3.5)
    store.ts                   useApp (Zustand + persist)
    hooks.ts                   useDaily, useStreak, useLevel
    text.ts                    tx, fmt, plain, todayKey, dayDiff, shuffle, seeded, hashString
    keys.ts                    ignoreKey (горячие клавиши не срабатывают в полях/инструментах/клавиатуре)
    scratch.ts                 черновик в IndexedDB
    sound.ts, feedback.ts      звук (Web Audio) и единая точка отклика звук+вибрация
    ai.ts, ai-types.ts         клиент к /api/ai/* и типы запросов/ответов
    ai-text.ts                 [новое] normalizeAiMath — чинит запись формул в ответе ИИ (docs/AI.md, 8)
    student-context.ts         сжатый портрет ученика для ИИ
    image.ts                   сжатие фото перед отправкой
    cn.ts                      clsx + tailwind-merge
  server/                      ТОЛЬКО сервер, каждый файл начинается с import "server-only";
    openai.ts                  клиент, MODELS из env, logUsage, jsonError
    prompts.ts                 все системные промпты
    context.ts                 санитизация и обрезка входа, renderContext
    rate-limit.ts              лимит по IP
  videos/
    registry.ts, LessonVideo.tsx, PlayerInner.tsx
    <id>/<Composition>.tsx, script.ts, durations.json
```

### 3.1 Куда класть новое

| Что добавляем | Файлы | Обязательно |
|---|---|---|
| Урок | `src/content/lessons/<id>.ts` + строка в `LESSONS` и в `UNITS` (`course.ts`) + навыки в `skills.ts` | `npm test` зелёный, `review:kk` |
| Тип шага | `lib/types.ts` (union `Step`) → `lib/evaluate.ts` (`Answer`, `isReady`, `evaluate`, `expectedText`) → `components/lesson/steps/<Тип>View.tsx` → ветка в `LessonPlayer` → `tests/validate.ts` + тест | запись в DECISIONS; делает «прораб» |
| Вид сцены | `Scene` в `types.ts` → `components/scenes/<Kind>Scene.tsx` → расчёты в `scenes/logic.ts` → `case` в `SceneView` → `validateScene` → `tests/scenes.test.ts` | числа на схеме считает `logic.ts` |
| Навык с генератором | `lib/bank/<тема>.ts` (массив `SkillBank`) + одна строка в `lib/bank/index.ts` + навык в `content/skills.ts` | сначала таблица A/B/C (9.4), тест вторым способом (9.6) |
| Мини-игра | `src/games/<id>/{Game.tsx,logic.ts,strings.ts}` + `registry.ts` + `components.ts` + `tests/games/<id>.test.ts` + id в `e2e/games.spec.ts` | `docs/GAMES.md` |
| Строка интерфейса | `src/i18n/dict.ts` | ru и kk |
| Формула справочника | `src/content/formulas.ts` | тест KaTeX |
| Видео | `src/videos/<id>/` + `videos/registry.ts` + `npm run voiceover -- <id>` | обратная расшифровка |
| Маршрут ИИ | только по решению в DECISIONS; шаблон — `reference/src/app/api/ai/*/route.ts` | лимит, обрезка, лог (раздел 18) |

Общие файлы (`lib/types.ts`, `lib/store.ts`, `i18n/dict.ts`, реестры) правит только «прораб» (`AGENTS.md`).

---

## 4. Модель данных (`src/lib/types.ts`)

Образец — `reference/src/lib/types.ts`. Каркас (`L`, `Text`, `Level`, `StepBase`, информационные шаги, `choice`, `multi`, `match`, `order`, `solution`, `cloze`, `Lesson`, `Unit`, `AnswerRecord`, `SessionResult`) переносится как есть. **Убираем** информатику: шаги `bits`, `ladder`, сцены `binary`/`ladder`/`lamps`/`coins`/`decimal`, `VisualId`, инструменты песочниц `lamps`/`weights`/`coins`, режим ввода `binary`. **Добавляем** математику: режимы ответа, числовую прямую, координатную плоскость, «соответствие» ЕНТ 2 × 4, контекстные группы, математические сцены.

### 4.1 Базовые типы [образец]

```ts
export type Lang = "ru" | "kk";
/** Локализованная строка: обязательно оба языка. */
export type L = { ru: string; kk: string };
/** Текст без перевода (число, формула) либо локализованная строка. Формулы внутри — в $…$. */
export type Text = string | L;
export type SkillId = string;
/** Уровень сложности, как в ЕНТ: 1 = A (базовый), 2 = B (средний), 3 = C (высокий). */
export type Level = 1 | 2 | 3;
/** Трек курса: профильная математика или математическая грамотность. */
export type TrackId = "math" | "literacy";                      // [новое]

export interface Skill {
  id: SkillId;
  title: L;
  topic: L;
  track: TrackId;                                                // [новое]
  /** Код темы спецификации НЦТ («05», «13») — для весов тем и прогноза балла. */
  spec?: string;                                                 // [новое]
}
export type Grade = "8" | "9" | "10" | "11" | "other";
export type Goal = "ent" | "school" | "interest";
export type ExplainStyle = "short" | "examples" | "steps";
export type Theme = "system" | "light" | "dark";
```

Правило формул в любых `L` и `Text`: обычный текст + формулы в `$…$` (строчные) или `$$…$$` (отдельной строкой). Подробно — раздел 8.

### 4.2 Сцены [новое, принцип — образец]

Сцена — это **данные**, а не картинка. Её рисует `SceneView`, а все числа на ней (координаты, длины, доли, суммы) считает `components/scenes/logic.ts`, а не автор урока. Сцены одного вида подряд не пересоздаются — элементы плавно анимируют изменения (так «оживает» разбор `worked`).

```ts
/** Тон элемента схемы — только смысловые токены (docs/DESIGN.md). */
export type Tone = "primary" | "success" | "danger" | "warning" | "gold" | "muted";

/** Отметка на числовой прямой: точка или промежуток. null — бесконечность. */
export type LineMark =
  | { kind: "point"; x: number; open?: boolean }
  | { kind: "interval"; from: number | null; to: number | null; fromIncl: boolean; toIncl: boolean };

export type Scene =
  /** Числовая прямая с точками и промежутками. */
  | { kind: "numberline"; min: number; max: number; step?: number;
      marks?: (LineMark & { tone?: Tone; label?: Text })[] }
  /** Координатная плоскость: графики (выражения от x), точки, заливка площади. */
  | { kind: "plane"; x: [number, number]; y: [number, number]; grid?: number;
      graphs?: { expr: string; tone?: Tone; label?: Text }[];
      points?: { x: number; y: number; label?: Text; tone?: Tone }[];
      area?: { expr: string; expr2?: string; from: number; to: number } }
  /** Дробь: круг или полоса, закрашено num частей из den. */
  | { kind: "fraction"; num: number; den: number; shape: "pie" | "bar" }
  /** Единичная окружность: угол в градусах и линии sin / cos / tg. */
  | { kind: "circle"; angle: number; show?: ("sin" | "cos" | "tg")[] }
  /** Плоская фигура с подписями. Что значат числа size — таблица ниже. */
  | { kind: "figure";
      shape: "triangle" | "right-triangle" | "rectangle" | "square" | "parallelogram" | "rhombus" | "trapezoid" | "circle";
      size: number[]; labels?: Partial<Record<string, Text>>; marks?: ("height" | "diagonal" | "radius" | "angle")[] }
  /** Тело: куб, призма, пирамида, цилиндр, конус, шар, фигура из кубиков. */
  | { kind: "solid"; shape: "cube" | "prism" | "pyramid" | "cylinder" | "cone" | "sphere" | "cubes";
      size: number[]; cubes?: [number, number, number][]; labels?: Partial<Record<string, Text>> }
  /** Диаграмма: круговая, столбчатая, гистограмма, полигон частот (трек «грамотность»). */
  | { kind: "chart"; chart: "pie" | "bar" | "histogram" | "polygon";
      data: { label: Text; value: number }[]; unit?: Text }
  /** Таблица значений или частот. */
  | { kind: "table"; head: Text[]; rows: Text[][] }
  /** Иллюстрация сюжета. Набор QuestArt — после выбора сюжета (этап 3.1, docs/LESSON_METHOD.md, 3). */
  | { kind: "quest"; art: QuestArt; caption?: Text };

export type QuestArt = string;   // сузить до union, когда сюжет утверждён
```

- Это стартовый набор. Новый вид сцены добавляется по таблице 3.1. Параметры, которые валидатор проверяет: `min < max`, точки внутри диапазона, `0 < num ≤ den`, у `graphs.expr` выражение разбирается парсером `lib/math/parse.ts`, `size` нужной длины для `shape` (таблица ниже), все числа `size` > 0.
- **Что значат числа `size`** [предложение; закрепить в `scenes/logic.ts` и `validateScene`, новую фигуру — сюда же]:

  | `shape` | `size` | | `shape` | `size` |
  |---|---|---|---|---|
  | `triangle` | `[a, b, c]` — три стороны (неравенство треугольника) | | `cube` | `[a]` |
  | `right-triangle` | `[a, b]` — катеты | | `prism` | `[n, a, h]` — правильная n-угольная: сторона основания, высота |
  | `rectangle` | `[a, b]` — ширина, высота | | `pyramid` | `[n, a, h]` — правильная n-угольная |
  | `square` | `[a]` | | `cylinder` | `[r, h]` |
  | `parallelogram` | `[a, b, α]` — стороны и острый угол в градусах | | `cone` | `[r, h]` (так в уроке-образце: `[3, 4]`) |
  | `rhombus` | `[d₁, d₂]` — диагонали | | `sphere` | `[r]` |
  | `trapezoid` | `[a, b, h]` — основания и высота, равнобедренная | | `cubes` | `[]`, кубики — в `cubes` |
  | `circle` | `[r]` | | | |

- **`quest`:** набор картинок (`QuestArt`) появляется после выбора сюжета на этапе 3.1 (`docs/ROADMAP.md`). До этого `QuestScene` для любого `art` рисует нейтральную заглушку: Пи + `caption`. В демо-уроке этапа 1 шаг `story` может взять любую сцену.
- **`fractions`** (несколько дробей и действие, для серии «Дроби») добавляется на этапе 3.2 по `docs/LESSON_METHOD.md`, 8.3, через таблицу 3.1. Не путать с `fraction` (одна дробь).
- Графики в сцене — строки выражений (`"x^2 - 4x + 3"`): один парсер для проверки ответов, калькулятора, построителя графиков и сцен.

### 4.3 Шаги урока

```ts
interface StepBase {
  id: string;
  /** Навык, который тренирует шаг. У теории/видео может отсутствовать. */
  skill?: SkillId;
  /** Формат ЕНТ — золотой бейдж «ЕНТ». */
  ent?: boolean;
  /** Сложность A/B/C. В уроке и тренировке задания идут от лёгкого к сложному. */
  level?: Level;
  /** «Предскажи → проверь»: схема после ответа. Только у заданий. */
  reveal?: Scene;
  /** [новое] Контекстная группа ЕНТ: общий текст/рисунок из lesson.contexts (или банка). */
  contextId?: string;
}

// ── Информационные шаги (без проверки) [образец] ──
export interface VideoStep  extends StepBase { type: "video"; videoId: string; title: L; }
export interface TheoryStep extends StepBase { type: "theory"; title: L; /** Markdown с $…$ */ body: L; scene?: Scene; }
export interface StoryStep  extends StepBase { type: "story"; title?: L; body: L; scene: Scene; speaker?: "pi" | "narrator"; }
export interface WorkedStep extends StepBase {
  type: "worked"; title: L;
  steps: { text: L; scene?: Scene }[];   // открываются по одному, схема меняется вместе с шагом
  result?: L;                            // итог, подсвечен зелёным
}

/** [новое] Песочница: ползунки параметров + живая схема. С goal «Продолжить» откроется при достижении цели. */
export type ExploreTool = "parabola" | "line" | "circle" | "numberline" | "fraction" | "area";
export interface ExploreStep extends StepBase {
  type: "explore"; title: L; body?: L;
  tool: ExploreTool;
  /** Начальные значения ползунков, например { a: 1, b: 0, c: 0 }. */
  init: Record<string, number>;
  /** Цель — значения ползунков или вычисленных величин (logic.ts), например { vertexX: 2 }. */
  goal?: { values: Record<string, number>; text: L };
}

// ── Режимы ответа [новое] ──
export type AnswerMode =
  | "number"      // число: целое, десятичное, обыкновенная или смешанная дробь
  | "expression"  // числовое выражение: 2√3, 3π/4, 2^10
  | "algebra"     // выражение с переменной: a² + b²  [план]
  | "interval"    // промежуток или объединение: (−∞; 2] ∪ (5; +∞)
  | "set"         // множество корней без учёта порядка: 1; 3   или ∅
  | "point"       // точка или несколько точек: (2; −1)
  | "text";       // слово (редко)

export interface AnswerOptions {
  /** Допуск по модулю. По умолчанию 0 — точное равенство. */
  tolerance?: number;
  /** «Округлите до N знаков»: ответ должен совпасть с эталоном, округлённым кодом до N знаков. */
  round?: number;
  /** Что важно кроме значения. По умолчанию "value". */
  form?: "value" | "written" | "integer" | "decimal" | "fraction";
  /** π по условию: 3 — «π ≈ 3» (как в ЕНТ). По умолчанию π точное. */
  pi?: number;
  /** Переменная для режима algebra (по умолчанию "x"). */
  variable?: string;
}

// ── Задания ──
export interface ChoiceStep extends StepBase { type: "choice"; prompt: L; options: Text[]; correct: number; explanation: L; }
export interface MultiStep  extends StepBase { type: "multi";  prompt: L; options: Text[]; correct: number[]; explanation: L; }

export interface InputStep extends StepBase {
  type: "input"; prompt: L;
  /** Допустимые ответы в канонической записи; сравнение — ПО ЗНАЧЕНИЮ (раздел 6). */
  answers: string[];
  mode: AnswerMode;
  opts?: AnswerOptions;
  /** Подписи вокруг поля: «x =», «см²», «%». Совпадающий суффикс в ответе ученика отрезается. */
  prefix?: Text; suffix?: Text;
  explanation: L;
}

/** Пары «левое ↔ правое» (учебное соответствие, 3–6 пар) [образец]. */
export interface MatchStep extends StepBase { type: "match"; prompt: L; pairs: { left: Text; right: Text }[]; explanation: L; }

/** [новое] «Соответствие» в формате ЕНТ: каждому пункту (A, B) выбрать одно значение из списка (обычно 4). */
export interface AssignStep extends StepBase {
  type: "assign"; prompt: L;
  items: Text[];        // пункты A, B
  values: Text[];       // значения 1–4 (часто промежутки)
  correct: number[];    // индекс значения для каждого пункта
  explanation: L;
}

/** Расставить по порядку. Элементы — в ПРАВИЛЬНОМ порядке, на экране перемешиваются. */
export interface OrderStep extends StepBase { type: "order"; prompt: L; items: Text[]; explanation: L; }

/** [новое] Отметь точку или промежуток на числовой прямой. */
export interface NumberLineStep extends StepBase {
  type: "numberline"; prompt: L;
  min: number; max: number;
  /** Шаг сетки: отметки «прилипают» к нему. */
  step: number;
  /** Что должно получиться: точки и/или промежутки (объединение). */
  target: LineMark[];
  explanation: L;
}

/** [новое] Поставь точку(и) на координатной плоскости. */
export interface PlaneStep extends StepBase {
  type: "plane"; prompt: L;
  x: [number, number]; y: [number, number];
  step: number;                     // шаг сетки
  targets: [number, number][];      // порядок не важен
  graphs?: string[];                // опорные графики (необязательно)
  explanation: L;
}

/** Развёрнутое решение: рисунок на экране или фото тетради; проверяет ИИ [образец]. */
export interface SolutionStep extends StepBase {
  type: "solution"; prompt: L;
  /** Эталонное решение — уходит в промпт проверки. */
  reference: L;
  /** Итоговый ответ для проверки кодом без ИИ. */
  answer: string;
  answerMode: AnswerMode;
  answerOpts?: AnswerOptions;
  explanation: L;
}

/** «Решаем вместе»: строки решения с пропусками [образец]. */
export interface ClozeBlank { blank: string[]; mode: AnswerMode; opts?: AnswerOptions; width?: number; }
export type ClozeToken = string | L | ClozeBlank;
export interface ClozeStep extends StepBase { type: "cloze"; prompt: L; scene?: Scene; lines: ClozeToken[][]; explanation: L; }

export type QuestionStep =
  | ChoiceStep | MultiStep | InputStep | MatchStep | AssignStep | OrderStep
  | NumberLineStep | PlaneStep | SolutionStep | ClozeStep;
export type InfoStep = VideoStep | TheoryStep | StoryStep | WorkedStep | ExploreStep;
export type Step = InfoStep | QuestionStep;
export type StepType = Step["type"];
```

«Выбери следующий шаг решения» — это обычный `choice`, у которого варианты — формулы в `$…$`. Отдельный тип не нужен.

**Когда что делать** (по `docs/ROADMAP.md`; типы можно объявить сразу, а **экран и проверку** делаем на своём этапе, не раньше):

| Этап | Виды шагов и режимы |
|---|---|
| 1 (1.5, 1.6) | `choice`, `multi`, `input`, `match`, `order`, `cloze`, `assign`, `theory`, `story`, `worked`; `solution` — холст/фото и ввод итогового ответа, проверка **только кодом** (без ИИ). Режимы `AnswerMode`: `number`, `expression`, `interval`, `set`, `point`, `text` |
| 2 | `solution` — проверка фото ИИ (`/api/ai/check-solution`) |
| 3 | `explore` (песочница для дробей, 3.2); `video` — только после выбора стиля (3.4, по желанию) |
| 4 (Т-3, до первого урока раздела) | `numberline` (неравенства), `plane` (функции), новые сцены и песочницы раздела |
| 11 (пробный ЕНТ) | контекстные группы `ContextBlock` / `contextId` (в уроке можно раньше, если раздел требует) |
| нет в плане | режим `algebra`: в типе есть, реализации нет. Пока `algebra.ts` не сделан (решение владельца + DECISIONS), `validateStep` считает `mode: "algebra"` ошибкой контента, а `checkFormat` возвращает `input.format.unsupported` |

### 4.4 Урок, раздел, курс

```ts
/** [новое] Общий текст и рисунок для 5 вопросов «на основе контекста» (формат ЕНТ). */
export interface ContextBlock { id: string; title: L; body: L; scene?: Scene; }

export interface Lesson {
  id: string; unitId: string; title: L; description: L;
  skills: SkillId[]; durationMin: number; steps: Step[];
  /** Конспект (Markdown с $…$) — сохраняется ученику после прохождения. */
  conspect: L;
  contexts?: ContextBlock[];                                     // [новое]
}
export interface LessonRef { id: string; title: L; status: "available" | "soon"; }
export interface Unit {
  id: string; track: TrackId;                                    // track — [новое]
  title: L; description: L;
  /** CSS-цвет акцента раздела (данные, не токен). */
  color: string;
  lessons: LessonRef[];
}
```

- `src/content/course.ts`: `TRACKS` (порядок и названия двух треков), `UNITS`, реестр `LESSONS`, `getLesson(id)`, `lessonNumber(id)`, `unlockedSkills(completed)`, `findStep(lessonId, stepId)` [образец].
- **Нельзя удалять id уроков, шагов, навыков**, на которые мог сослаться сохранённый прогресс («работа над ошибками» ищет шаг по `stepId`). Старый урок убирают с карты (`UNITS`), но оставляют в `LESSONS`.
- Рекомендуемые id [новое]: навыки `<раздел>.<навык>` — `num.fractions`, `eq.quadratic`, `seq.arith`, `lit.percent`; уроки `<раздел>-<n>-<слово>` — `num-1-fractions`; id шагов с префиксом урока — `frac-q-add-1`. Префиксы разделов согласовать с `docs/ENT_MATH.md` и записать в DECISIONS.

### 4.5 Результаты [образец]

```ts
export interface AnswerRecord {
  stepId: string; skill?: SkillId; correct: boolean;
  /** Частичный балл 0..1 (multi/assign 2/1/0 → 1/0.5/0, cloze — доля пропусков, фото — от ИИ). */
  score: number;
  given: string; expected: string; prompt: string;   // могут содержать $…$ — показывать через MathText
  /** Повторная попытка в «работе над ошибками». */
  retry: boolean; timeMs: number;
}
export interface SessionResult {
  kind: "lesson" | "drill";            // [план] + "exam" для мини-ЕНТ и пробного ЕНТ
  lessonId?: string; title: string; answers: AnswerRecord[];
  xp: number; maxCombo: number; durationSec: number; accuracy: number; skipped?: number;
}
```

### 4.6 Что поменялось относительно образца

| В Informatica | В Matematika |
|---|---|
| `BitsStep`, `LadderStep` | удалены → `NumberLineStep`, `PlaneStep`, `AssignStep` |
| `InputStep.mode: "number" \| "binary" \| "text"` | `AnswerMode` из 7 режимов + `AnswerOptions` |
| `SolutionStep.answerMode` из 3 режимов | `AnswerMode` + `answerOpts` |
| `OrderStep.items: L[]` | `Text[]` (элементы бывают формулами) |
| `ExploreStep.tool: "lamps" \| "weights" \| "coins"`, `size`, `goal.target` | `ExploreTool`, `init`, `goal.values` |
| `Scene`: binary, ladder, lamps, coins, decimal, quest | numberline, plane, fraction, circle, figure, solid, chart, table, quest |
| `TheoryStep.visual?: VisualId` | удалено — только `scene` |
| `StoryStep.speaker: "bit"` | `"pi"` |
| — | `TrackId`, `Skill.track`, `Skill.spec`, `Unit.track`, `StepBase.contextId`, `ContextBlock` |

---

## 5. Плеер урока (`components/lesson/LessonPlayer.tsx`) [образец, файла в `reference/` нет]

Один плеер для урока и тренировки. Эталона в `reference/` нет: всё, что нужно для повторения, описано здесь. Вид экрана и панели — `docs/DESIGN.md`, 7.3–7.5; смысл для ученика — `docs/CONCEPT.md`, 6.4. Не хватает детали — спросить владельца, не придумывать.

Пропсы: `LessonPlayer({ kind: "lesson" | "drill", lessonId?, title, steps, mistakeMap? })`.

**Состояние плеера:**

| Имя | Что это |
|---|---|
| `queue: QueueItem[]` | очередь, `QueueItem = { step: Step; retry: boolean; key: string }`. Старт — шаги урока по порядку (`key = step.id`); повтор ошибки — копия в конце (`retry: true`, `key = "<id>:retry"`) |
| `pos` | индекс текущего элемента очереди |
| `answer: Answer \| null` | текущий ответ (раздел 6.8). Хранит плеер, шаг только сообщает `onAnswer` |
| `phase` | `"answering"` → (`"checking"` — только для фото) → `"feedback"` |
| `result: StepResult \| null` | итог проверки (раздел 6.8) |
| `records: AnswerRecord[]` | все ответы сессии (раздел 4.5) |
| `combo`, `maxCombo` | верных подряд (ошибка обнуляет) и максимум за сессию |
| `xp` | XP за сессию, без бонуса за завершение |
| `done` | для полосы прогресса: `progress = done / steps.length` |
| `revealed` | сколько подшагов `worked` открыто (с 1) |
| `goalReached` | цель песочницы `explore` достигнута (обратно не сбрасывается) |
| `mistakeMap?: Record<string, string>` | только в «Работе над ошибками»: id показанного шага → `stepId` записи ошибки в сторе, которую закрывает верный ответ (`dismissMistake`, раздел 12.2) |

**Переходы:**

| Где | Действие ученика | Что делает плеер |
|---|---|---|
| инфо-шаг (`theory`, `story`, `video`, `worked`, `explore`) | «Продолжить» (`common.continue`) / Enter | `worked`: пока `revealed < steps.length`, кнопка «Следующий шаг» (`lesson.nextStep`) открывает подшаг. `explore` с `goal`: кнопка неактивна до `goalReached`. Иначе `done + 1` и `next()` |
| `answering` | выбирает или вводит | `onAnswer(a)` → `answer = a`; `onAnswer(a, { submit: true })` (пары `match`) — сразу `check()` |
| `answering` | «Проверить» (`common.check`) / Enter; кнопка активна при `isReady(step, answer)` | `check()`: `evaluate()` синхронно → `apply(result)` |
| `answering`, `solution` с фото | «Проверить с ИИ» (`sol.checkAi`) | `phase = "checking"` → `spendAi()` (лимит исчерпан: есть введённый ответ — проверить его кодом, нет — ошибка `tutor.limit`) → `/api/ai/check-solution`. Вердикт `unreadable` → снова `answering` с янтарной заметкой, попытка не тратится. Сбой → `refundAi()` и проверка введённого ответа кодом (`offline: true`), без ответа — `tutor.error` |
| `answering`, только `solution` | «Пропустить» (`common.skip`) | `skipped + 1`, `done + 1`, `next()`; пропуск лишает бонуса «без ошибок» |
| `feedback` | «Продолжить» / Enter | `next()`: следующий элемент очереди; сброс `answer`, `result`, `revealed = 1`, `goalReached = false`; прокрутка вверх. Очередь кончилась → `finish()` |

**`apply(result)` по порядку:**
1. `newCombo = correct ? combo + 1 : 0`.
2. XP = `xpForAnswer(correct, retry, newCombo)` из `lib/gamification.ts` (раздел 11): неверно — 0; верно в повторе — 5; верно — 10 и ещё +5, если `newCombo ≥ 3`.
3. `AnswerRecord` (`prompt` = `promptText(step, lang)`, `timeMs` — от показа шага) → `recordAnswer(rec, xp, lessonId)`. Стор сам обновляет освоение, ошибки, серию и день.
4. Верно и шаг есть в `mistakeMap` → `dismissMistake(mistakeMap[id])`. `noteCombo(newCombo)` — для достижения за комбо.
5. `phase = "feedback"`. Отклик `feedback()`: новый уровень — `levelUp`; верно — `combo` при `newCombo ≥ 3`, иначе `correct`; неверно — `wrong`; через 180 мс — `xp`, если XP > 0.
6. `done + 1`, если верно или это повтор. **Ошибка с первой попытки** → копия шага в конец очереди (`retry: true`), ровно один повтор. `solution` не повторяется (дорого) — для него `done + 1` сразу.

**Панель обратной связи** (вид — `docs/DESIGN.md`, 7.5): тон `success` при `correct`, `warning` при `score > 0` (частично), иначе `danger`. Заголовок — случайная похвала `fb.correct.1…4`, либо `fb.partial`, либо `fb.wrong`; рядом «+N XP». Если ответ не `correct`: «Правильный ответ: …» (`fb.correctAnswer` + `expectedText`; кроме `match` и `cloze`). Если верных ответов много — у `input` задан `tolerance`, в `answers` несколько **разных по значению** эталонов или ответ задан условием («приведи пример», «любое число из промежутка») — вместо этого «Например: …» (`fb.example` + первый эталон): так в образце исправили «Тумблер» после ревью. Дальше — **всё** `explanation` шага и кнопка «Почему?» (`fb.why`, на телефоне `fb.ai.short`) — разбор ИИ. Схема `reveal` показывается после ответа. У повтора — плашка «Работа над ошибками» (`lesson.review`).

**`finish()`:** `accuracy` = средний `score` первых попыток (повторы не в счёт; вопросов нет → 1) → `SessionResult` (раздел 4.5) → `finishSession(result)` → `{ bonusXp }` (раздел 12.2) → `consumeNewAchievements()` → экран `Results`. Отзыв ИИ запрашивается тут же, **из обработчика**, не из эффекта.

**Клавиши.** `lib/keys.ts` (эталона нет, вот код целиком):

```ts
/** true — глобальная горячая клавиша (урок, игры) должна пропустить это событие. */
export function ignoreKey(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.closest("[data-toolbox], [data-keypad]")) return true;   // «Помощники» и матклавиатура
  const tag = el.tagName;
  return el.isContentEditable || tag === "TEXTAREA" || (tag === "INPUT" && (el as HTMLInputElement).type !== "checkbox");
}
```

- **Enter** = «Проверить» / «Продолжить» / «Следующий шаг». Обработчик плеера пропускает событие, если `ignoreKey(e)` (исключение — поле ответа самого задания внутри `<main>`: там Enter проверяет), если открыты окно выхода, панель ИИ или итоги, если фокус в поле внутри `[role=dialog]` или на кнопке/ссылке вне `<main>` (она нажмётся сама), при `e.repeat`.
- **Цифры 1…N** выбирают вариант `choice`/`multi` (обработчик в `ChoiceView`), только если `!ignoreKey(e)` и шаг не заблокирован. В образце был баг: цифры калькулятора выбирали вариант — e2e в разделе 19.3.
- **Двойной тап** не проскакивает панель: `check()` ничего не делает, если `phase !== "answering"`.

Тренировка (`app/drill/DrillScreen.tsx`) — тот же плеер с `kind: "drill"`: `smart` → `buildDrill(unlockedSkills(…), stats, { seed: Date.now(), count: 8 })`; `skill` — то же с `focus: [skill]`; `mistakes` — до 8 последних ошибок: исходный шаг урока (`findStep`, кроме `solution`) или свежая генерация по навыку; заодно строится `mistakeMap` (id показанного шага → `stepId` ошибки). `buildDrill` — раздел 9.2.

Пропсы шагов (`components/lesson/steps/types.ts`; так в образце, файла в `reference/` нет):

```ts
export interface StepProps<S extends QuestionStep> {
  step: S;
  answer: Answer | null;
  /** submit: сразу проверить (для самопроверяющихся заданий, например «пары»). */
  onAnswer: (a: Answer | null, opts?: { submit?: boolean }) => void;
  /** Ответ проверен — интерфейс заблокирован и подсвечен. */
  locked: boolean;
  result: StepResult | null;
}
```

**Что добавляется для математики [новое]:**
- `InputView` = поле + `AnswerPreview` («Понято как: ¾» — код показывает, как разобрал ввод) + `MathKeypad` на телефоне (раздел 7).
- **Ошибка формата — не ошибка ответа.** Если ввод не разбирается (`checkFormat` вернул ключ подсказки), «Проверить» неактивна, под полем — янтарная подсказка («Раздели числа точкой с запятой: (2; 5)»). Попытка не тратится.
- `ContextCard`: если у шага есть `contextId`, над вопросом — сворачиваемая карточка с общим текстом и рисунком.
- Встряска всей области ответа (`Shake`) при ошибке — для `order`, `numberline`, `plane` (у них нет подсветки отдельного варианта).
- [план] Проп `exam: true` (мини-ЕНТ, пробный ЕНТ, режим «как на ЕНТ»): нет кнопок ИИ, нет панели обратной связи после каждого ответа, нет повторов, «Помощники» на уровне `ent`, итог — баллы ЕНТ.

---

## 6. Проверка ответов

### 6.1 Принципы

1. **Правильный ответ вычисляет код** (генератор или автор, перепроверенный тестом), никогда не ИИ.
2. **Сравнение по значению**, а не по строке: `0,75` = `3/4` = `.75`; `−2,5` = `−5/2` = `−2½`; `√169` = `13`.
3. **Точно, без float**, где это возможно: рациональные числа на `BigInt`. Никакого `0.1 + 0.2 = 0.30000000000000004`.
4. **Свой парсер**, без `eval` и `new Function`.
5. **Обе стороны нормализуются одинаково** — и ввод ученика, и эталон из `answers`. Тест: каждый эталон проходит собственную проверку.
6. **Неразборчивый ввод — подсказка формата, а не «неверно».**
7. Всё в `src/lib/math/*` и `src/lib/check.ts` — чистые функции без React, покрыты тестами `tests/math/*.test.ts`. Тот же код используют калькулятор, построитель графиков и сцены.

### 6.2 Модули `src/lib/math/` [новое]

| Файл | Что делает | Главные функции |
|---|---|---|
| `rational.ts` | точные дроби `{ n: bigint; d: bigint }`, `d > 0`, всегда сокращены | `rat`, `parseDecimal("3,25") → 13/4`, `add`, `sub`, `mul`, `div` (на 0 → `null`), `neg`, `powInt`, `cmp`, `eq`, `isInteger`, `isFiniteDecimal` (в знаменателе только 2 и 5), `toNumber` |
| `normalize.ts` | приводит ввод к единому виду (алгоритм 6.3) | `normalizeInput(raw, mode) → string \| { error: DictKey }` |
| `parse.ts` | токенизатор + рекурсивный спуск → дерево (AST) | `parseExpr(s) → Ast \| null`, `parseList(s, mode)` |
| `value.ts` | вычисляет AST: точно (`Rational`) или приближённо (`number`) | `evalExact(ast, env) → Value \| null` |
| `interval.ts` | промежутки, объединения, множества, точки | `parseIntervals`, `normalizeUnion`, `sameUnion`, `sameSet`, `samePoints` |
| `compare.ts` | итоговое сравнение по режиму и опциям | `checkAnswer(value, answers, mode, opts) → boolean`, `checkFormat(value, mode) → DictKey \| null` |
| `format.ts` | вывод чисел для экрана: запятая, «−» (U+2212), дроби | `formatValue(v, style)`, `formatRational(r, "auto" \| "fraction" \| "decimal")` |
| `tex.ts` | AST → LaTeX для предпросмотра ввода | `toTex(ast) → string` |
| `keypad.ts` | машина состояний экранной клавиатуры | `keypadPress(state, key) → state`, `KEYS_FOR[mode]` |
| `calc.ts` | машина состояний калькулятора; правила `calcPress` — раздел 15 (файла образца в `reference/` нет) | `CalcState`, `CALC_INIT`, `calcPress`, `previewCalc` |
| `graph.ts` | выборка точек графика с разрывами | `compileFn(expr) → ((x) => number) \| null`, `sample(fn, xMin, xMax, n)`, `niceTicks` |
| `algebra.ts` [план] | эквивалентность выражений с переменной | `sameExpression(a, b, variable)` |

`src/lib/check.ts` — тонкая обёртка с именами образца: `checkInput(value, answers, mode, opts)` и `checkFormat(value, mode)` → вызывают `lib/math/compare.ts`. Так `evaluate.ts` из `reference/` переносится почти без правок.

### 6.3 Нормализация ввода (`normalize.ts`)

`normalizeInput(raw, mode) → string | { error: DictKey }`. Шаги идут **строго по порядку**; на каждый шаг — тест «вход → выход» в `tests/math/normalize.test.ts`. Эталоны из `answers` проходят тот же путь.

0. *(В `evaluate.ts`, до нормализации.)* Если у шага есть `suffix` (`%`, `см²`, `°`), отрезать его с конца ввода — на любом из двух языков, без учёта регистра и пробелов: `72 %` → `72`.
1. Длина > 200 символов → `{ error: "input.format.tooLong" }`; дальше ничего не запускать (защита от зависания).
2. Режим `text` — своя короткая ветка, и **конец**: пробелы по краям убрать, нижний регистр, `ё` → `е`, точку или `!` в конце убрать, несколько пробелов → один. Математических замен (`пи`, `x=` …) в `text` нет.
3. Пробелы по краям убрать.
4. Минусы `−` (U+2212), `–`, `—`, `‐` → `-`. Умножение `×`, `·`, `⋅` → `*`. Деление `÷` и школьное `:` → `/` (`45:2` → `45/2`).
5. Латинская `U`/`u` между скобками промежутков → `∪`: `/([)\]])\s*[Uu]\s*([(\[])/g` → `$1∪$2`. **До** нижнего регистра.
6. Нижний регистр (`X=5` → `x=5`, `PI` → `pi`). Сразу после него — **кириллические двойники латиницы** (на ПК в русской или казахской раскладке ученик набирает «х=5», «2х+1», «у=…»): `х` → `x`, `у` → `y` во всех режимах этой ветки (режим `text` закончился на шаге 2); `а`, `с`, `е`, `р` → `a`, `c`, `e`, `p` — только в режимах `expression` и `algebra`. Сочетание `пи` не трогать (шаг 8).
7. Имя переменной перед ответом убрать — в начале строки и после `;`: одна латинская буква, необязательный индекс, затем `=` или `∈`: `/(^|;)\s*[a-z][₀-₉0-9]*\s*[=∈]\s*/g` → `$1`. `x=5` → `5`; `y = -2` → `-2`; `x₁=1; x₂=3` → `1; 3`; `x1=1` → `1`.
8. Слова → символы: `sqrt` → `√` (`sqrt(2)` → `√(2)`); `pi` и `пи` → `π`; `infinity`, затем `inf` → `∞`; `ø` и `{}` → `∅`.
9. Режимы `interval`, `set`, `point`: запятая с пробелом после неё (`(2, 5)`, `1, 3`) → `{ error: "input.format.semicolon" }`. Десятичная запятая пишется без пробела: `(4,5; +∞)`.
10. Смешанные числа (пробелы ещё на месте): `/(\d+)\s+(\d+)\/(\d+)/g` → `($1+$2/$3)`. Скобки обязательны: `-2 1/2` → `-(2+1/2)` = −2,5 (без скобок вышло бы −1,5).
11. Unicode-дроби `½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞` → `(n/d)`, с целой частью — `(целое+n/d)`: `½` → `(1/2)`, `2½` → `(2+1/2)`, `-2½` → `-(2+1/2)`.
12. Разряды: группы по 3 цифры через пробел (обычный, U+00A0, U+202F) → слитно: `/\b\d{1,3}(?:[   ]\d{3})+\b/g`. `1 000 000` → `1000000`.
13. Все оставшиеся пробелы убрать.
14. `,` → `.` (внутренняя десятичная точка; `.` с клавиатуры ПК остаётся).
15. Верхние индексы → степень в скобках: `/(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g` → `^(…)`. `x²` → `x^(2)`, `2¹⁰` → `2^(10)`, `2⁻¹` → `2^(-1)`.
16. Режим `set`: фигурные скобки убрать (`{3;1}` → `3;1`).

После нормализации — парсер (6.6). Разделитель `;` значим только в режимах `interval`, `set`, `point`; в них `,` — **всегда** десятичная запятая. Скобка без `;` внутри в режимах `point` и `interval` (`(2,5)` → `(2.5)`) — подсказка `input.format.semicolon`, а не «неверно». `∞` без знака = `+∞`.

### 6.4 Режимы: что принимается

| Режим | Эталон в `answers` | Засчитывается | Не засчитывается |
|---|---|---|---|
| `number` | `"-5/2"` | `−2,5`, `-2.5`, `−5/2`, `−2½`, `-10/4` | `2,5`, `−2,6` |
| `number` + `form: "fraction"` | `"3/4"` | `3/4` | `6/8` (сократимая), `0,75` (не дробь) |
| `number` + `round: 2` | `"3.14159"` (код округлит до `3,14`) | `3,14`, `3,140` | `3,1416`, `3,1` |
| `number` + `tolerance: 0.1` | `"2.5"` | `2,4`…`2,6` | `2,7` |
| `expression` | `"2√3"` | `√12`, `2*√3`, `2√3` | `3√2` |
| `expression` + `pi: 3` | `"75"` | `75`, `25π` (π подставится как 3) | `78,54` |
| `interval` | `"(-∞; 2] ∪ (5; +∞)"` | `(−∞;2]U(5;+∞)`, `(5;+∞)∪(−∞;2]` | `(−∞; 2) ∪ (5; +∞)` (скобка) |
| `set` | `"1; 3"` | `{3; 1}`, `3;1`, `x₁=1; x₂=3` | `1`, `1; 3; 5` |
| `set` | `"∅"` | `∅`, `{}` | `0` |
| `point` | `"(2; -1)"` | `(2;−1)`, `( 2 ; -1 )` | `(−1; 2)` |
| `point` (несколько) | `"(1; 2); (3; 4)"` | те же точки в любом порядке | лишняя или потерянная точка |
| `text` | `["нет", "жоқ"]` | `Нет`, `жоқ.` | |

Значения `form`: `"value"` (по умолчанию) — важно только значение; `"integer"` — записано целое число; `"decimal"` — записана десятичная дробь; `"fraction"` — записана **несократимая** обыкновенная дробь (или целое); `"written"` — запись после нормализации совпадает с одной из `answers` (как в образце).

### 6.5 Значение: точно или приближённо (`value.ts`)

```ts
export interface Rational { n: bigint; d: bigint }        // d > 0, НОД(n, d) = 1
export type Value =
  | { kind: "exact"; q: Rational }                        // 0,75; −5/2; 2¹⁰; √169; π при opts.pi = 3
  | { kind: "approx"; x: number };                        // √2, π, sin 1 — нужен допуск
```

- Сложение, вычитание, умножение, деление, целая степень — **точно**.
- `√q` точно, если `q` — квадрат рационального (`√169 = 13`, `√(9/4) = 3/2`); иначе приближённо.
- π: точно, если задано `opts.pi` (подставляется как `rat(3)`); иначе `Math.PI`, приближённо.
- Деление на 0, корень из отрицательного, переполнение → `null` (ответ не засчитан, без падения).
- **Пороги защиты** (константы в `lib/math/*`, менять — с записью в DECISIONS): длина ввода ≤ 200 символов (6.3, шаг 1); целый показатель степени по модулю ≤ 1000; числитель и знаменатель после **каждой** операции по модулю ≤ 10²⁰⁰, иначе `null`. Нецелый показатель (`8^(1/3)`) → `approx` через `Math.pow`.

### 6.6 Грамматика парсера (`parse.ts`)

```
list     := item (";" item)*                      — только для interval / set / point
expr     := term (("+" | "-") term)*
term     := unary (("*" | "/") unary | implicit)*  — неявное умножение: 2√3, 3π, 2x, 2(x+1)
unary    := "-" unary | power
power    := atom ("^" unary)?                      — правоассоциативно: 2^3^2 = 2^9
atom     := number | "π" | "∞" | var | "√" atom | func "(" expr ")" | "(" expr ")" | "|" expr "|"
number   := digits ("." digits)?
func     := sin | cos | tg | ctg | tan | cot | ln | lg | log | sqrt   — для калькулятора и графиков
var      := латинская буква (только в режиме algebra и в графиках: x)
```

- Обозначения как в ЕНТ: `tg`, `ctg`, `ln` (принимать и `tan`, `cot`).
- AST общий для проверки, калькулятора, графиков и предпросмотра (`toTex`).

### 6.7 Алгоритм `checkAnswer` (`compare.ts`)

```ts
export function checkAnswer(value: string, answers: string[], mode: AnswerMode, opts: AnswerOptions = {}): boolean {
  const given = readByMode(value, mode, opts);      // normalizeInput → парсер → значение; ошибка формата → null
  if (given === null) return false;
  return answers.some((a) => {
    const expected = readByMode(a, mode, opts);
    return expected !== null && sameByMode(given, expected, mode, opts);
  });
}
/** Ключ подсказки формата (первый сбой нормализации или парсера) либо null — ввод разобран. */
export function checkFormat(value: string, mode: AnswerMode): DictKey | null;
```

`sameByMode` для `number` / `expression` (G — ответ ученика, E — эталон):
1. **Задан `round: N`.** Эталон округляется кодом до N знаков после запятой **«половина — от нуля»** (школьное правило: `2,345` → `2,35`, `−2,345` → `−2,35`, `2,5` при N = 0 → `3`). E точное — округление точно на `Rational`: `R = sign(E) · ⌊|E| · 10ᴺ + ½⌋ / 10ᴺ`. E приближённое (`√2`, `π`) — `Math.round(Math.abs(E) · 10ᴺ)` со знаком E, затем перевод в `Rational`. G должно быть **точным** и **равным** R: `3,14` и `3,140` — да; `3,1416`, `3,1` — нет; `√2` при эталоне `1,41` — нет (ответ не округлён). `tolerance` при `round` не применяется.
2. Оба `exact` → `cmp(G, E) === 0`, при `tolerance` — `|G − E| ≤ tolerance` в `Rational` (`tolerance` переводится через `parseDecimal(String(tolerance))`).
3. Иначе (хоть одно `approx`) → `|G − E| ≤ max(tolerance ?? 0, 1e-9 · max(1, |E|))`.
4. Значение совпало → проверка `form`, если задана (`integer`, `decimal`, `fraction` — по записи G после нормализации; `written` — нормализованная строка G совпадает с одной из `answers`, как в образце).

`interval`: оба ответа → объединение промежутков → слить пересекающиеся и смежные → сравнить концы по значению и типы скобок; у бесконечности скобка всегда круглая (`[−∞` — ошибка формата). Точка `{a}` = отрезок `[a; a]`. `ℝ` = `(−∞; +∞)`.
`set`: мультимножества значений без учёта порядка. `point`: кортежи с порядком координат, набор точек — без порядка.
`algebra` [план]: подставить 6 детерминированных рациональных точек (`seeded(…)`), пропуская точки, где одна из сторон не определена; равны во всех — эквивалентны. Внимание: «упростите» по значению засчитает и неупрощённую запись. Такие задания давать как `choice` или с `form: "written"` и списком допустимых записей.

### 6.8 Оценка по типам шагов (`lib/evaluate.ts`)

```ts
export type Answer =
  | { type: "choice"; index: number }
  | { type: "multi"; indices: number[] }
  | { type: "input"; value: string }
  | { type: "match"; done: boolean; wrong: number }
  | { type: "assign"; picks: (number | null)[] }                 // [новое]
  | { type: "order"; order: number[] }
  | { type: "numberline"; marks: LineMark[] }                    // [новое]
  | { type: "plane"; points: [number, number][] }                // [новое]
  | { type: "solution"; image?: string; typed: string }
  | { type: "cloze"; values: string[] };

export interface StepResult {
  correct: boolean;
  score: number;            // 0..1 — для модели освоения
  given: string; expected: string;
  details?: CheckSolutionResponse;
  partial?: boolean;        // засчитано частично — янтарная панель
  offline?: boolean;        // проверено кодом, ИИ недоступен
}
```

| Тип | `isReady` | `evaluate` |
|---|---|---|
| `choice` | выбран вариант | `index === correct` |
| `multi` | выбран хотя бы один | `multiPoints(correct, indices)`: 2 → верно (1); 1 → `partial`, 0,5; 0 → 0 |
| `input` | не пусто **и** `checkFormat` без ошибки | `checkInput(value, answers, mode, opts)` |
| `match` | все пары собраны | `score = max(0, 1 − 0,25 · wrong)`, верно при `wrong = 0` |
| `assign` | у каждого пункта выбрано значение | `assignPoints(верных пунктов, всего)`: 2 → 1; 1 → `partial`, 0,5; 0 → 0 |
| `order` | полная перестановка | `order.every((v, i) => v === i)` |
| `numberline` | есть хотя бы одна отметка | `sameUnion(marks, target)` (точки — вырожденные отрезки) |
| `plane` | поставлено столько точек, сколько в `targets` | наборы совпадают без порядка (координаты на сетке) |
| `solution` | есть фото или введён ответ | с фото — ИИ; без ИИ — `checkInput(typed, [answer], answerMode, answerOpts)`, `offline: true` |
| `cloze` | все пропуски заполнены и разбираются | `score` = доля верных пропусков; `partial`, если часть |

`expectedText(step, lang)` — верный ответ строкой для панели «Правильный ответ: …», статистики и ИИ: каноническая запись с запятой и «−» (`formatValue`); формулы — в `$…$`, на экране через `MathText`.

### 6.9 Обязательные тесты проверки (`tests/math/*.test.ts`)

- [ ] `3,5` = `3.5`; `−` (U+2212) = `-`; `0,1 + 0,2` = `0,3` точно.
- [ ] `3/4` = `0,75`; `−2½` = `−5/2` = `−2,5`; `2 1/2` = `2,5`; `1 000` = `1000`.
- [ ] `√169` = `13`; `2√3` = `√12`; `25π` при `pi: 3` = `75`.
- [ ] `round: 2`: `3,14` да, `3,1416` нет; `tolerance` работает в обе стороны.
- [ ] Округление «половина — от нуля»: эталон `2,345` → `2,35`, `−2,345` → `−2,35`; при `round` ответ `√2` не засчитан.
- [ ] Нормализация: по тесту на каждый шаг 6.3; `-2 1/2` = `−2½` = `−2,5` (знак у смешанного числа).
- [ ] Кириллица вместо латиницы: `х=5` (кириллическая «х») → `5`; `2х` = `2x`; `у = -2` → `-2`; в режиме `number` кириллическая `а` не превращается в `a`.
- [ ] Пороги: `2^1001` → `null`; `10^201` → `null`; ввод из 201 символа → `input.format.tooLong`.
- [ ] Промежутки: тип скобок важен, `∞` только с круглой, объединение без порядка, слияние смежных.
- [ ] Множества: `{1; 3}` = `{3; 1}`, `∅`; лишний или потерянный корень — нет.
- [ ] Точки: порядок координат важен, порядок точек — нет.
- [ ] Мусор, деление на 0, `√(−4)`, 10 000 символов → `false` или ошибка формата, **без исключений**.
- [ ] `(2, 5)` в режиме `point` → `checkFormat` возвращает подсказку, а не `false`.
- [ ] Каждый эталон проходит собственную проверку (`answers.every(a => checkInput(a, answers, mode, opts))`).

---

## 7. Математическая клавиатура и ввод [новое]

Компонент `src/components/math/MathKeypad.tsx`, логика — чистая машина состояний `src/lib/math/keypad.ts`, тесты `tests/math/keypad.test.ts`. Вид клавиш и высоты — `docs/DESIGN.md`, 7.4.3 (сетка `grid-cols-5 gap-2`, клавиша `h-14 rounded-2xl`, не больше 4 рядов по 5).

```ts
/** Текст поля и выделение; start === end — просто каретка. */
export interface KeypadState { text: string; start: number; end: number; }
export type KeypadKey = string;                                              // символ клавиши, "⌫" или "done"
export function keypadPress(s: KeypadState, key: KeypadKey): KeypadState;   // вставка в каретку, ⌫
export const KEYS_FOR: Record<Exclude<AnswerMode, "text" | "algebra">, KeypadKey[][]>;  // раскладка по режиму, 4 ряда × 5
```

**Раскладки** (`Готово` = `done`):

```
number — базовая                 expression                       interval
(DESIGN 7.4.3)                   (x → ^)                          (DESIGN 7.4.3)
7  8  9  /  ⌫                    7  8  9  /  ⌫                    7  8  9  [  ⌫
4  5  6  −  √                    4  5  6  −  √                    4  5  6  −  ]
1  2  3  x  π                    1  2  3  ^  π                    1  2  3  ;  ∞
,  0  (  )  Готово               ,  0  (  )  Готово               ,  0  (  )  Готово

set [предложение]                point [предложение]
(x → ;, π → ∅)                   (x → ;)
7  8  9  /  ⌫                    7  8  9  /  ⌫
4  5  6  −  √                    4  5  6  −  √
1  2  3  ;  ∅                    1  2  3  ;  π
,  0  (  )  Готово               ,  0  (  )  Готово
```

- В `expression` нет клавиши `+` (не помещается): ответ вида `2 + √3` давать через `choice`. Раскладка `algebra` решается вместе с самим режимом (4.3).
- Для `set` и `point` `docs/DESIGN.md` предлагает раскладку промежутков, но корни вида `1/2` и `−√2` на ней не набрать. Поэтому здесь своя раскладка; при утверждении — записать в DECISIONS и поправить DESIGN 7.4.3.
- **Объединение `∪`** [предложение]: в раскладке `interval` нет места под отдельную клавишу. Поэтому клавиша `;` вставляет `∪` и показывает подпись `∪`, когда перед кареткой стоит `)` или `]`. С ПК `∪` набирается буквой `U` (6.3, шаг 5).
- Режим `text` — без `MathKeypad`: обычное поле и системная клавиатура.

**Каретка и выделение:**
- Тап по полю ставит каретку туда, куда ткнули: с `inputMode="none"` нативная каретка работает, `start`/`end` читаются из `selectionStart`/`selectionEnd` в `onSelect`. После каждого `keypadPress` компонент вызывает `input.setSelectionRange(start, end)`.
- Клавиша вставляет символ на место выделения, каретка встаёт после вставки. Скобки не закрываются сами: одна клавиша — один символ.
- `⌫` удаляет выделение, а без выделения — символ перед кареткой. Удержание `⌫` [предложение]: через 400 мс повтор каждые 80 мс.
- Стрелок `←`/`→` на клавиатуре нет (DESIGN): каретку двигает тап по полю.
- Длиннее 200 символов не набирается: `keypadPress` возвращает прежнее состояние.

**Когда видна:**
- Экранная клавиатура показывается, если `matchMedia("(pointer: coarse)").matches` — основной указатель палец, как в DESIGN 7.4.3. При событии `change` (подключили мышь) — пересчитать. На ПК и ноутбуке с тачскрином, где основной указатель мышь, её нет.
- **Физическая клавиатура работает всегда**, даже когда видна экранная (планшет с клавиатурой): `inputMode="none"` прячет только системную экранную клавиатуру. С ПК замены: `.` → `,`, `-` → `−`, `*` → `·`, `sqrt` → `√`, `pi` → `π` (разбор — `normalize.ts`, показ — `format.ts`).
- **Каретка не прыгает** (урок ревью образца: в переводе систем счисления курсор прыгал в конец, потому что `onChange` переписывал значение в верхний регистр). `value` поля **не переписывать** в `onChange`. Замену символа с физической клавиатуры делать в `onKeyDown`/`beforeinput`: `preventDefault`, затем тот же `keypadPress` с нужным символом и `setSelectionRange(start, end)`. Либо вовсе не заменять в поле, а только при разборе (`normalize.ts`) и в превью. Тест e2e: поставить каретку в середину `12,5`, набрать `.` или `3` — каретка остаётся после вставки.
- **Казахская раскладка Windows:** в цифровом ряду у неё буквы `ә і ң ғ ү ұ қ ө һ`, и ученик вместо цифр набирает буквы. Если на «Проверить» в поле режима, отличного от `text`, есть хотя бы одна из этих букв — янтарная подсказка `input.format.layout` («Переключи раскладку на английскую или набери цифры на цифровом блоке»; ru и kk). Это ошибка формата, а не «неверно»: попытка не тратится. Кириллические `х`/`у` подсказку не вызывают — их понимает нормализация (6.3, шаг 6).
- «Готово» сворачивает клавиатуру, тап по полю открывает снова. Проверяет ответ только главная кнопка «Проверить».

**Прочее:**
- Клавиши не забирают фокус: `onPointerDown` / `onMouseDown` → `preventDefault`, как в калькуляторе образца. Тап — `feedback("tap")`.
- Корень клавиатуры помечен `data-keypad`; `ignoreKey` (раздел 5) пропускает события оттуда — Enter и цифры не уходят в плеер.
- **Предпросмотр** (`AnswerPreview`): под полем код показывает, как понял ввод — `toTex(parseExpr(...))` → `<Tex>`. Ученик видит `¾` до проверки.
- Все подписи клавиш и подсказки формата — ключи `src/i18n/dict.ts` (`keypad.*`, `input.format.*`).

---

## 8. Формулы: KaTeX [новое]

### 8.1 Где и чем

| Где формула | Как пишется | Чем рендерится |
|---|---|---|
| Простая: степень, корень из числа, дробь ½, десятичное | Unicode в обычном тексте: `2³`, `√2`, `½`, `x²`, `3,5`, `π` | ничего не нужно |
| Сложная: дробь с выражением, система, корень из выражения, предел, интеграл | LaTeX в `$…$` или `$$…$$` | — |
| …в Markdown (теория, конспект, ответ ИИ) | `$\frac{x+1}{2}$` | `Markdown` (remark-math + rehype-katex) |
| …в `Text` вне Markdown (варианты, подписи, ответы) | `$\sqrt{x+3}$` | `MathText` из `components/math/Tex.tsx` |
| Одна формула из кода | строка LaTeX | `<Tex tex="…" />` |

### 8.2 Код

`src/app/layout.tsx`: `import "katex/dist/katex.min.css";` (шрифты KaTeX идут из пакета — самохостинг, работает офлайн).

`src/components/Markdown.tsx` (образец — `reference/src/components/Markdown.tsx`, добавлены два плагина):

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/cn";

/** Markdown для теории, конспектов и ответов ИИ. Сырые HTML-теги не рендерятся (безопасно). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-app", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

`src/components/math/Tex.tsx` (набросок):

```tsx
import katex from "katex";
import { useMemo } from "react";
import { cn } from "@/lib/cn";

/** Одна формула. Только для НАШЕГО контента и LaTeX из toTex(); ответ ИИ — только через Markdown. */
export function Tex({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: "ignore" }),
    [tex, block],
  );
  return <span className={cn(block && "block overflow-x-auto", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Текст с формулами в $…$: обычные куски — текстом (React экранирует), формулы — через Tex. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = splitMath(text) ?? [{ kind: "text" as const, value: text }];   // битую строку — как есть
  return (
    <span className={cn("whitespace-pre-line", className)}>
      {parts.map((p, i) => (p.kind === "text" ? p.value : <Tex key={i} tex={p.value} block={p.kind === "block"} />))}
    </span>
  );
}
```

`splitMath` — чистая функция в `src/lib/math/tex.ts`, тест `tests/math/tex.test.ts`:

```ts
export type MathPart = { kind: "text" | "inline" | "block"; value: string };

/** Делит строку на текст и формулы. `\$` — литерал «$». Непарный или пустой `$` → null (валидатор контента это ловит). */
export function splitMath(s: string): MathPart[] | null {
  const parts: MathPart[] = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) parts.push({ kind: "text", value: buf }); buf = ""; };
  while (i < s.length) {
    if (s[i] === "\\" && s[i + 1] === "$") { buf += "$"; i += 2; continue; }
    if (s[i] !== "$") { buf += s[i++]; continue; }
    const fence = s[i + 1] === "$" ? "$$" : "$";
    const end = s.indexOf(fence, i + fence.length);
    if (end <= i + fence.length) return null;                       // нет пары или «$$» без формулы
    flush();
    parts.push({ kind: fence === "$$" ? "block" : "inline", value: s.slice(i + fence.length, end) });
    i = end + fence.length;
  }
  flush();
  return parts;
}
```

Тест: `"a $x^2$ b"` → текст, `inline`, текст; `"$$\\frac{1}{2}$$"` → `block`; `"\\$5"` → текст `$5`; `"$x"` и `"$$"` → `null`; `""` → `[]`.

### 8.3 Правила записи (проверяются тестом контента)

- [ ] Десятичная запятая в LaTeX — `3{,}5` (без скобок KaTeX ставит после запятой пробел). В обычном тексте — `3,5`.
- [ ] В обычном тексте контента нет десятичной точки (`/\d\.\d/` вне `$…$` → ошибка теста).
- [ ] Русские и казахские слова внутри формулы — только в `\text{…}`.
- [ ] Знаки `$` парные (`splitMath(s) !== null`); знак доллара как валюту в тексте не используем (тенге — `₸`).
- [ ] Обозначения как в ЕНТ: `\tg`, `\ctg` (есть ли они в KaTeX выбранной версии — **проверить**; запасной вариант — `\operatorname{tg}`), промежутки и точки через `;`.
- [ ] Каждая LaTeX-строка: `katex.renderToString(s, { throwOnError: true })` без ошибки.
- [ ] `plain()` (текст для ИИ, статистики и `AnswerRecord.prompt`) **не ломает формулы и знаки**. В образце (`reference/src/lib/text.ts`) `plain` удаляет `*`, `_`, `` ` ``, `#`, `>` по всему тексту — это ломает `x_1`, `2*3` и неравенство `x > 3` (выходит `x 3`). В Matematika markdown вырезается только вне `$…$`, и только сама разметка:

  ```ts
  /** Markdown → простой текст для ИИ и статистики. Формулы $…$ и знаки сравнения не трогаем. */
  export function plain(md: string): string {
    return md
      .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/)               // нечётные куски — формулы
      .map((part, i) => (i % 2 ? part : part
        .replace(/^\s{0,3}(#{1,6}|>)\s?/gm, "")        // заголовок и цитата — только в начале строки
        .replace(/\*\*|__|`/g, "")))                    // жирный и код
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  ```

  Тест (`tests/text.test.ts`): `plain("**Ответ:** $x_1 > 3$")` → `Ответ: $x_1 > 3$`; `plain("x > 3 и 2*3")` не меняется; `plain("# Тема")` → `Тема`.

Безопасность: KaTeX по умолчанию `trust: false` (запрещены `\href`, `\url`, `\html*`); не включать. **`Tex` и `MathText` не получают текст ИИ** — ответ ИИ рендерится только через `Markdown` (тот же KaTeX, но без сырого HTML). Правило проверяет тест `tests/safety.test.ts` (раздел 19.1): в `src/components/ai/*` и `src/app/(main)/tutor/*` нет импорта `components/math/Tex`.

---

## 9. Генераторы и банк заданий

### 9.1 Принципы [образец]

- **Детерминизм по seed.** Генератор получает `rand = seeded(seed)` (mulberry32, `lib/text.ts`) и `level`. Одинаковые `(skill, level, seed)` всегда дают одно и то же задание. Внутри генератора нельзя `Math.random()` и `Date.now()` — seed создаётся снаружи.
- **Правильный ответ вычисляет код.** Объяснение (`explanation`, ru и kk) тоже строит код — у каждого задания есть бесплатное статическое объяснение.
- **id кодирует суть:** `g:<skill>:<форма>:<параметры>:<seed>`, например `g:eq.quadratic:input:1,-5,6:123456`. Повторы в сессии отсеиваются по первым 4 сегментам (без seed).
- **Уровень A/B/C** задаёт сложность, а не только размер чисел (таблица 9.4).
- **Неверные варианты — типичные ошибки учеников** (таблица 9.5), уникальные по значению, перемешанные.
- Казахские шаблоны: после чисел и переменных — без падежных окончаний («формулы и двоеточия»: `{eq} теңдеуін шеш`, а не склонение числа).

### 9.2 Каркас (`lib/generators.ts`)

В образце генераторы лежали в `generators.ts`, а банк делегировал в них. В Matematika тем много, поэтому **генератор `question` живёт в файле темы банка**, а `generators.ts` — только каркас. Файла образца в `reference/` нет; код ниже полный:

```ts
import { bankFor } from "./bank";
import { levelFromMastery } from "./ent";
import type { SkillStat } from "./mastery";
import { seeded } from "./text";
import type { Level, QuestionStep, SkillId } from "./types";

export function canGenerate(skill: SkillId): boolean { return !!bankFor(skill); }

/** Задание нужного уровня. */
export function generateLeveled(skill: SkillId, level: Level, seed: number): QuestionStep {
  const bank = bankFor(skill);
  if (!bank) throw new Error(`Нет банка для навыка ${skill}`);
  return { ...bank.question(level, seed), level };
}
/** Задание по освоению навыка (уровень подбирается сам). */
export function generateStep(skill: SkillId, mastery: number, seed: number): QuestionStep {
  return generateLeveled(skill, levelFromMastery(mastery), seed);
}
/** Умная тренировка [образец]: слабые навыки чаще, последняя треть на уровень выше, итог A → B → C. */
export function buildDrill(
  available: SkillId[],
  stats: Record<string, SkillStat>,
  opts: { count?: number; seed?: number; focus?: SkillId[] } = {},
): QuestionStep[] {
  const count = opts.count ?? 8;
  const rand = seeded(opts.seed ?? Date.now());
  const pool = (opts.focus?.length ? opts.focus : available).filter(canGenerate);
  if (!pool.length) return [];
  // Вес ~ (1,1 − освоение)²: слабые навыки выпадают в разы чаще освоенных. Нет статистики — освоение 0,5.
  const weights = pool.map((s) => (1.1 - (stats[s]?.mastery ?? 0.5)) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const steps: QuestionStep[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (steps.length < count && guard++ < count * 10) {
    let r = rand() * total;
    let idx = 0;
    while (r > weights[idx] && idx < weights.length - 1) r -= weights[idx++];
    const skill = pool[idx];
    const base = levelFromMastery(stats[skill]?.mastery ?? 0);
    const level = Math.min(3, base + (steps.length >= Math.ceil((count * 2) / 3) ? 1 : 0)) as Level;
    const step = generateLeveled(skill, level, Math.floor(rand() * 1e9));
    const key = step.id.split(":").slice(0, 4).join(":");        // повтор = те же параметры без seed
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(step);
  }
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.level ?? 1) - (b.s.level ?? 1) || a.i - b.i)   // стабильно: A, потом B, потом C
    .map((x) => x.s);
}
```

`seed` по умолчанию `Date.now()` — допустимо только здесь, снаружи генераторов: сами генераторы получают готовый seed.

Помощники генераторов — в `lib/bank/helpers.ts` (файлы тем импортируют их оттуда; если положить их в `generators.ts`, получится циклический импорт `generators` ↔ `bank`). В образце дубли вариантов отсеивались по строке, для математики — **по значению**:

```ts
// src/lib/bank/helpers.ts
import { checkAnswer } from "../math/compare";
import { shuffle } from "../text";
import type { AnswerMode } from "../types";

export type Rand = () => number;
export const int  = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
export const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

/** Верный + неверные варианты без дублей по значению, перемешаны. Значения — сырые ("7/12", "-2.5"); в $…$ или Unicode переводить ПОСЛЕ. */
export function options(rand: Rand, correct: string, distractors: string[], total = 4, mode: AnswerMode = "expression") {
  const list = [correct];
  for (const d of distractors) {
    if (list.length >= total) break;
    if (d && !list.some((x) => checkAnswer(d, [x], mode))) list.push(d);   // 0,5 и 1/2 — дубль
  }
  const shuffled = shuffle(list, rand);
  return { options: shuffled, correct: shuffled.indexOf(correct) };
}
```

Для ЕНТ-формата `multi` — `total = 6`, верных 1–3 (несколько верных одного значения в разной записи добавляются отдельно, мимо `options`, — раздел 9.5).

### 9.3 Банк (`lib/bank/types.ts`, `lib/bank/index.ts`) [образец]

Эталон — `reference/src/lib/bank/types.ts` и `reference/src/lib/bank/index.ts`.

```ts
export interface Statement { id: string; skill: SkillId; level: Level; text: L; value: boolean; explanation: L; }
export interface Pair      { id: string; skill: SkillId; level: Level; left: Text; right: Text; }
export interface ShortQuestion {
  id: string; skill: SkillId; level: Level; prompt: L;
  answer: string;            // каноническая запись
  mode: AnswerMode;          // было "number" | "binary" | "text"
  opts?: AnswerOptions;
  explanation: L;
}
/** [новое] Контекстная группа ЕНТ: общий текст + 5 вопросов по 4 варианта. */
export interface ContextSet { context: ContextBlock; questions: ChoiceStep[]; }

export interface SkillBank {
  skill: SkillId;
  question: (level: Level, seed: number) => QuestionStep;      // обязательно
  statement?: (level: Level, seed: number) => Statement;       // «Верю — не верю»
  pair?: (level: Level, seed: number) => Pair;                 // «Мемо-пары», соответствие
  short?: (level: Level, seed: number) => ShortQuestion;       // спринт с вводом
  context?: (level: Level, seed: number) => ContextSet;        // [новое] пробный ЕНТ
}
export type Shape = "question" | "statement" | "pair" | "short" | "context";
```

- Реестр: `BANKS` в `bank/index.ts`; функции `bankFor`, `hasShape`, `skillsWithShape`, `draw(shape, opts)`, `rampLevel`.
- **Новая тема = новый файл `lib/bank/<тема>.ts` + одна строка в `bank/index.ts`.** Тема сама появляется во всех играх, которым подходят её формы.
- `draw(shape, { skills, count, seed, minLevel?, maxLevel?, ramp? })`: навыки чередуются, повторы отсеиваются (`question` — по id; `statement` — по `text.ru`; `pair` — по `left|right`; `short` — по `prompt.ru`), при `ramp` уровень растёт от первого задания к последнему: `rampLevel(i, 6, 1, 3)` → `[1, 1, 2, 2, 3, 3]`. Не хватает уникальных — вернёт сколько есть; неизвестный навык → `[]`.
- **Истинность утверждения (`statement.value`) вычисляет код**; тест разбирает формулу из `text.ru` независимо и сверяет. Баланс: на каждом уровне из 200 утверждений > 20 верных и > 20 неверных.

### 9.4 Уровни A/B/C в генераторах

**Правило:** до кода генератора прораб пишет для навыка таблицу «уровень → что генерировать → диапазоны → формы» по образцу `docs/LESSON_METHOD.md`, 10.8, и кладёт её комментарием в шапку файла темы (`lib/bank/<тема>.ts`). Смысл уровней — `docs/LESSON_METHOD.md`, 1.3; уровень C похож на задания C из демоверсий НЦТ (`docs/ENT_MATH.md`). Без таблицы генератор не пишется — иначе навыки окажутся несопоставимыми по сложности.

**Навык готов**, когда в банке есть `question` (без него навыка нет в «Тренировке») и `short` (кормит игры «Бинго», «Шифровка», запас для «Пи-спринта» — `docs/GAMES.md`); `statement` и `pair` — там, где они естественны для темы. [предложение]

Пример таблиц (договорённость, не готовые диапазоны):

| Навык | A (базовый) | B (средний) | C (высокий) |
|---|---|---|---|
| `num.fractions` (действия с дробями) | одно действие, знаменатели до 10 | два действия, разные знаменатели, отрицательные | смешанные дроби, скобки, сократить ответ |
| `eq.quadratic` | `x² + bx + c = 0`, целые корни в [−5; 5] | корни в [−9; 9], `a = 1` | `a ∈ {2, 3}`, дробный корень или ловушка D < 0 |
| `seq.arith` | найти `aₙ` по `a₁`, `d` | найти `d` или `n` | сумма `Sₙ` по двум членам |
| `lit.percent` | процент от числа | число по проценту | цепочка процентов (как KK-демо: «0,6 и 1,2 → 72 %») |


### 9.5 Неверные варианты: типичные ошибки

| Ошибка | Пример дистрактора |
|---|---|
| знак | корни `2; 3` вместо `−2; −3` (ошибка в теореме Виета) |
| потерян корень | только `3` вместо `−3; 3` у `x² = 9` |
| нет проверки ОДЗ | посторонний корень `−3` у `log₂(x + 1) + log₂(x + 2) = 1` (демо НЦТ) |
| перепутана формула | `2πR` вместо `πR²`; периметр вместо площади; `Sₙ` арифм. вместо геом. |
| степени | `2³ · 2² = 2⁶`; `(a + b)² = a² + b²` |
| порядок действий | `2 + 3 · 4 = 20` |
| проценты | «процент от числа» вместо «числа по проценту» |
| одно число в разной записи | для `multi` ЕНТ: `−2,5`, `−2½`, `−5/2` — **все верные** (демо НЦТ №37) |

### 9.6 Пример генератора (набросок)

```ts
// src/lib/bank/eq.ts — навык eq.quadratic. Сначала корни (их знает код), потом уравнение.
import { int, pick } from "./helpers";
import { seeded } from "../text";
import type { Level, QuestionStep } from "../types";

function quadraticQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  const r = level === 1 ? 5 : 9;
  const x1 = int(rand, -r, r);
  let x2 = int(rand, -r, r);
  if (x2 === x1) x2 = x1 + 1;
  const a = level === 3 ? pick(rand, [2, 3]) : 1;
  const b = -a * (x1 + x2), c = a * x1 * x2;          // a(x − x1)(x − x2) = 0
  const eq = `$${polyTex([a, b, c])} = 0$`;           // «$x^2 - 5x + 6 = 0$»
  const roots = [Math.min(x1, x2), Math.max(x1, x2)];
  return {
    id: `g:eq.quadratic:input:${a},${b},${c}:${seed}`,
    type: "input", skill: "eq.quadratic", level,
    mode: "set", answers: [`${roots[0]}; ${roots[1]}`],
    prompt: { ru: `Реши уравнение ${eq}. Корни запиши через «;».`,
              kk: `${eq} теңдеуін шеш. Түбірлерін «;» арқылы жаз.` },   // kk — прогнать через review:kk
    explanation: buildQuadraticExplanation(a, b, c, roots),           // D, формула корней — код
  };
}
```

`polyTex` и `buildQuadraticExplanation` — **написать самому** (их нет ни в образце, ни выше):
- `polyTex(coeffs: number[]): string` — многочлен по коэффициентам от старшей степени в LaTeX: `[1, -5, 6]` → `x^2 - 5x + 6` (единичный коэффициент не пишется, нулевой член пропускается, минус — один). Общий помощник для всех тем — в `lib/bank/helpers.ts`, с тестом.
- `buildQuadraticExplanation(a: number, b: number, c: number, roots: number[]): L` — объяснение ru/kk: дискриминант, формула корней, ответ; все числа считает код.

**Тест вторым способом** (`tests/generators.test.ts`): для всех навыков × уровни 1–3 × seed 1..299 — шаг проходит `validateStep`; эталон проходит свою проверку; **ответ пересчитан независимо** (для квадратного уравнения — подстановка каждого корня в `ax² + bx + c` даёт 0 в `Rational`, корни различны); у `choice` ровно один вариант равен ответу по значению; детерминизм — `generateLeveled(s, l, 42)` равно самому себе.

---

## 10. Уровни A/B/C и оценка ЕНТ (`lib/ent.ts`)

Эталон — `reference/src/lib/ent.ts`. Правила оценивания общие для всех предметов ЕНТ (Правила ЕНТ, п. 18; таблица и источники — `docs/ENT_MATH.md`, раздел 0).

```ts
/** «Один или несколько верных» (верных ≤ 3): максимум 2 балла. [образец, без изменений] */
export function entPoints(totalCorrect: number, chosenCorrect: number, chosenWrong: number): 0 | 1 | 2 {
  if (chosenWrong >= 2 || chosenCorrect === 0) return 0;
  if (chosenCorrect === totalCorrect && chosenWrong === 0) return 2;
  return chosenCorrect >= Math.max(1, totalCorrect - 1) ? 1 : 0;
}
export function multiPoints(correct: number[], chosen: number[]): 0 | 1 | 2;   // считает c и w → entPoints

/** [новое] «Соответствие» 2 пункта × 4 значения. ВРЕМЕННАЯ трактовка (раздел 23, docs/ENT_MATH.md, 0.5): оба верно — 2, один — 1, ни одного — 0. */
export function assignPoints(correctItems: number, totalItems: number): 0 | 1 | 2 {
  if (correctItems >= totalItems) return 2;
  return correctItems > 0 ? 1 : 0;
}

/** Уровень по освоению: < 0,5 → A, < 0,8 → B, иначе C. [образец] */
export function levelFromMastery(mastery: number): Level;
export const LEVEL_LETTER: Record<Level, "A" | "B" | "C"> = { 1: "A", 2: "B", 3: "C" };
```

**Состав экзамена** [новое; факты — спецификации НЦТ 2026 из `docs/ENT_MATH.md`, сверять каждую осень]:

```ts
// Источник: спецификации НЦТ 2026 и testcenter.kz «Формат тестирования» — docs/ENT_MATH.md, А1, А2, Б1 (снимок 2026-10-03).
// Сверять каждую осень; менять только вместе с ENT_MATH.md и записью в docs/DECISIONS.md.
export const ENT_FORMAT = {
  math: {
    tasks: 40, maxPoints: 50, minutes: 80, threshold: 5,
    parts: { single: 25, context: 5, multi: 5, assign: 5 },   // 25·1 + 5·1 + 5·2 + 5·2 = 50
    options: { single: 4, context: 4, multi: 6, assignValues: 4 },
    levels: { 1: 20, 2: 12, 3: 8 },                          // A/B/C = 50/30/20 %
  },
  literacy: {
    tasks: 10, maxPoints: 10, minutes: 20, threshold: 3,
    parts: { single: 10 },
    options: { single: 4 },                                  // на сайте НЦТ «из пяти» — проверить
    levels: { 1: 5, 2: 3, 3: 2 },
  },
} as const;
```

- `minutes` — ориентир «в среднем 2 минуты на задание» из спецификации, а не отдельный лимит предмета.
- [план] `buildMockEnt(track, seed) → QuestionStep[]` — собирает вариант из банка (`draw` по формам: `question` в формате choice/multi/assign, `context`) с нужным числом заданий каждого типа и уровня; `scoreEnt(track, answers) → { points, max }`. Тест: состав и сумма максимальных баллов (50 и 10).
- В уроке частичный балл (`multi`, `assign`) → `score 0.5`, `partial: true`, янтарная панель. Бейдж `ent: true` помечает формат ЕНТ.
- `assignPoints` в тесте — с комментарием «временная трактовка, раздел 23»: тест фиксирует наше решение, а не факт о ЕНТ. Подтвердится иначе — меняются функция, тест и DECISIONS.
- Тест `tests/ent.test.ts`: `entPoints` сверяется с таблицей п. 18: `[верных, выбрано верных, выбрано неверных, баллы]` — `[1,1,0,2]`, `[1,1,1,1]`, `[1,1,2,0]`, `[2,1,0,1]`, `[2,2,1,1]`, `[3,3,0,2]`, `[3,2,0,1]`, `[3,1,0,0]`, `[3,3,2,0]`.

---

## 11. Освоение и геймификация [образец]

Числа и названия — `docs/CONCEPT.md`, разделы 7–8. Код берётся из `reference/` почти без изменений.

| Файл | Что | Менять для математики |
|---|---|---|
| `lib/mastery.ts` (`reference/src/lib/mastery.ts`) | `SkillStat { attempts, correct, mastery, lastSeen }`, `ALPHA = 0.3`, `WEAK_BELOW = 0.6`, `MASTERED_FROM = 0.8`; первый ответ `0,2 + 0,5·score`, дальше EMA | ничего |
| `lib/gamification.ts` (`reference/src/lib/gamification.ts`) | `XP = { correct: 10, retryCorrect: 5, comboBonus: 5, lessonComplete: 20, perfectLesson: 20, drillComplete: 10 }`, уровень n с `50·n·(n−1)` XP, серия, достижения (иконка — строка-имя) | `LEVEL_TITLES` (разряды числа), `binary_master` → `number_master`; список навыков для него — константа здесь же, тест проверяет, что все id есть в `SKILLS` |
| `lib/games.ts` (`reference/src/lib/games.ts`) | `GAME_XP = { perCorrect: 2, cap: 30, newBest: 5, calmPerCorrect: 1, calmCap: 15 }`, `gameStatKey`, `gameReward` | ничего |
| `lib/hooks.ts` | `useDaily`, `useStreak`, `useLevel` | ничего |

---

## 12. Стор (`lib/store.ts`) [образец]

Эталон — `reference/src/lib/store.ts`. **Как переносить:** файл копируется целиком вместе с типами (`Profile`, `MistakeRecord`, `ChatMessage`, `NoteData`, `GameStat`, `AppState`, `AppActions`). Меняется **только** это:
1. ключ `name` в `persist` → `matematika-v1`;
2. в `evaluate()` достижение `binary_master` → `number_master`, список его навыков — константа в `lib/gamification.ts` (раздел 11);
3. [предложение] поле `track: TrackId` в `Profile` и `defaultProfile` (`"math"`), 12.1;
4. [план, этап 5 — мини-ЕНТ] поле `exams` и его действие (12.1).

Остальные поля, действия и лимиты (`AI_DAILY_LIMIT`, `MAX_MISTAKES`, `MAX_CHAT`) — **без изменений**. Сохранений Matematika у учеников ещё нет, поэтому миграции не нужны: `version: 1`. Zustand + `persist`:

```ts
{
  name: "matematika-v1",        // было "informatica-v1"
  version: 1,
  storage: createJSONStorage(() => localStorage),
  // Новые поля профиля получают значения по умолчанию у старых сохранений.
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<AppState>;
    return { ...current, ...p, profile: { ...current.profile, ...p.profile } };
  },
}
```

### 12.1 Поля `AppState`

| Поле | Тип | Ограничение |
|---|---|---|
| `onboarded` | `boolean` | |
| `profile` | `Profile`: `name, lang, grade, goal, style, dailyGoalXp, theme, sound, vibration, reduceMotion, gameMode, createdAt` | имя ≤ 30 символов (онбординг) |
| `xp`, `maxCombo` | `number` | |
| `streak` | `{ current, best, lastDay }` | |
| `days` | `Record<"YYYY-MM-DD", { xp, answers, correct, seconds }>` | `seconds` за сессию ≤ 7200 |
| `skills` | `Record<SkillId, SkillStat>` | |
| `lessons` | `Record<lessonId, { completions, bestAccuracy, lastAt, totalXp }>` | |
| `mistakes` | `MistakeRecord[]` — `{ id, stepId, lessonId?, skill?, prompt, given, expected, at }` | ≤ 60, одна запись на задание |
| `achievements` / `newAchievements` | `Record<id, время>` / очередь показа | |
| `notes` | `Record<lessonId \| "general", { own, saved[] }>` | `saved` ≤ 50 |
| `memory` | память наставника | ≤ 1500 символов |
| `chat` | `ChatMessage[]` (фото не храним, только `hadImage`) | ≤ 60 |
| `aiUsage` | `{ day, count }` | `AI_DAILY_LIMIT = 60` |
| `games` | `Record<gameStatKey, { best, plays, lastAt }>` | |

[предложение] `profile.track: TrackId` — последний выбранный трек на `/learn` (добавить в `defaultProfile`, старые сохранения получат его через `merge`). [план] `exams: ExamRecord[]` — результаты мини-ЕНТ и пробного ЕНТ (≤ 30) — поле и действие добавить на этапе 5 (мини-ЕНТ), пробный ЕНТ (этап 11) пишет туда же.

### 12.2 Действия

`completeOnboarding(p)`, `updateProfile(p)`, `recordAnswer(rec, xp, lessonId?)`, `finishSession(result) → { bonusXp }`, `noteCombo(combo)`, `unlock(id)`, `consumeNewAchievements()`, `setMemory(text)`, `addChat(msg)`, `clearChat()`, `setOwnNote(key, text)`, `saveToNotes(key, text)`, `removeSavedNote(key, id)`, `spendAi() → boolean`, `refundAi()`, `dismissMistake(stepId)`, `recordGame(gameId, result, mode) → GameReward`, `resetProgress()`.

- `recordAnswer`: обновляет навык (`updateSkill`), ошибки (повторная ошибка обновляет запись и сохраняет `lessonId`; верный ответ закрывает; `retry` новую ошибку не создаёт), XP, серию, день; затем проверяет достижения.
- `finishSession`: бонус 20 (урок) / 10 (тренировка), +20 за урок без ошибок и пропусков, статистика урока, достижения.
- `spendAi()` списывает обращение **до** запроса; `refundAi()` возвращает при сбое.

### 12.3 Правила

- **Действия стора — единственный способ менять прогресс.** Компоненты не пишут в localStorage напрямую.
- Новое поле профиля → добавить в `defaultProfile`. Несовместимая смена структуры → поднять `version` и написать `migrate` (в образце не понадобилось). Смена ключа или удаление данных — только с «ок» владельца.
- Экспорт: кнопка «Скачать мои данные» → JSON состояния (`matematika-progress.json`); имя файла задаётся не в сторе, а в `app/(main)/profile/page.tsx`.
- Отдельные сторы без persist: `components/tools/useToolbox.ts` (панель инструментов).
- Черновик: `lib/scratch.ts` (эталона в `reference/` нет) → IndexedDB через `idb-keyval`, ключ `matematika:scratch:v1`, `MAX_SCRATCH_PAGES = 3` (как три листа А4 на ЕНТ). Лист — `ScratchPage { id: string; text: string; image?: string; updatedAt: number }`. Функции:
  - `sanitizePages(raw: unknown): ScratchPage[]` — данные из хранилища недоверенные: не массив → `[]`; берутся не больше 3 листов; `id` — непустая строка и `text` — строка, иначе лист пропускается; `updatedAt` — конечное число, иначе 0; `image` остаётся, только если начинается с `data:image/(png|jpeg);base64,`;
  - `loadScratch(): Promise<ScratchPage[]>` — читает `get(KEY)` → `sanitizePages`; IndexedDB недоступна (приватный режим) — отдаёт копию запасного массива в памяти;
  - `saveScratch(pages): Promise<void>` — сначала в память (первые 3 листа), потом `set(KEY, …)`; ошибка записи глотается — данные остаются в памяти.
  Всё в `try/catch`, приложение не падает.
- Холст `components/lesson/DrawingCanvas.tsx` (черновик и шаг `solution`): `image` листа хранится независимо от темы — PNG, чернила `#111` на прозрачном, `EXPORT_SCALE = 2`; на экране перекрашивается в `--text` и перерисовывается при смене `data-theme` и `prefers-color-scheme`; для ИИ `exportCanvas()` отдаёт `#111` на белом. Подробно — `docs/DESIGN.md`, 7.4.4.

---

## 13. i18n [образец]

Эталон — `reference/src/i18n/useT.ts`, `reference/src/i18n/dict.ts`.

```ts
export function translate(lang: Lang, key: DictKey, params?: Record<string, string | number>): string {
  return fmt(dict[key][lang], params);
}
/** t("ключ") для интерфейса, l(текст) для контента. */
export function useT() {
  const lang = useApp((s) => s.profile.lang);
  const t = useCallback((key: DictKey, params?) => translate(lang, key, params), [lang]);
  const l = useCallback((text: Text) => tx(text, lang), [lang]);
  return { t, l, lang };
}
```

- `dict.ts`: `export const dict = { "ключ": { ru: "…", kk: "…" }, … }`; `DictKey = keyof typeof dict`; TypeScript не даст пропустить язык. Плейсхолдеры `{n}`, `{name}`.
- Группы ключей образца: `app.*`, `nav.*`, `common.*`, `onb.*`, `lesson.*`, `fb.correct.1…4`, `prac.*`, `tutor.*`, `sol.*`, `game.*`, `tools.*`, `video.*`. Новые для Matematika: `keypad.*`, `input.format.*`, `formulas.*`, `graph.*`, `exam.*`, `track.*`.
- В компонентах — только `t()` / `l()`. Исключение — игры: `src/games/<id>/strings.ts` (`export const S = {…} satisfies Record<string, L>`).
- Числа в интерфейсе — через `formatValue` (запятая, «−»), одинаково для ru и kk. Подписи — нейтральные («{n} мин», «{n}-сабақ»), чтобы не склонять числительные.
- Язык профиля ставит `lang` на `<html>` (`Providers.tsx`).
- `npm run review:kk` собирает все пары `{ ru, kk }` из словаря, курса, уроков, навыков, достижений, формул справочника, сценариев видео и строк игр (раздел 17 и `docs/AI.md`).

---

## 14. Мини-игры [образец]

Контракт — `reference/src/games/types.ts` **без изменений**; ТЗ игр — `docs/GAMES.md`.

```ts
export interface GameAttempt { skill: SkillId; correct: boolean; }
export interface GameResult { score: number; correct: number; total: number; attempts: GameAttempt[]; }
export type GameMode = "calm" | "normal" | "blitz";
export interface GameProps { lang: Lang; sound: boolean; mode: GameMode; onFinish: (result: GameResult) => void; }
export interface GameMeta {
  id: string; title: L; description: L; rules: L;
  icon: LucideIcon; color: string; ink: string;
  skills: SkillId[]; durationSec: number;
}
export type GameComponent = ComponentType<GameProps>;
```

- Игра — один компонент: рисует только поле, сама ведёт таймер и **ровно один раз** вызывает `onFinish`. Вступление (правила, выбор темпа, рекорд) и итоги рисует `components/games/GameShell.tsx` (файла в `reference/` нет: код почти дословно — `docs/GAMES.md`, раздел 4; вид — `docs/DESIGN.md`, 7.9); в стор пишет только он (`recordGame`).
- Файлы: `Game.tsx` (UI, default export), `logic.ts` (чистая логика: поток заданий, очки, таймеры как функции от времени, `MODE_CONFIG: Record<GameMode, ModeConfig>`), `strings.ts`. Задания — из банка (`draw`, `generateStep`), ответы вычисляет код.
- Реестры: `games/registry.ts` (`GAMES`, `gameById`), `games/components.ts` (`lazy(() => import("./<id>/Game"))` — код игры грузится при открытии).
- Темп → уровень инструментов: `calm` → `full`, `normal` → `ent`, `blitz` → `off`.
- Награды: `gameReward` (2 XP за верное, максимум 30, +5 за новый рекорд; calm — 1 и 15, без рекорда), освоение — один раз за игру, если по навыку ≥ 3 действий.

---

## 15. Инструменты «Помощники» (`components/tools/`) [каркас — образец, вкладки — новые]

Файлов `components/tools/*` и калькулятора образца в `reference/` нет — ниже всё, что нужно. Вид панели и вкладок — `docs/DESIGN.md`, 7.14.

`components/tools/useToolbox.ts` — отдельный стор Zustand **без** persist (уровень задаёт экран):

```ts
export type ToolTab = "calc" | "formulas" | "graph" | "scratch";
/** full — все; ent — как на ЕНТ (калькулятор + черновик); off — инструментов нет. */
export type ToolLevel = "full" | "ent" | "off";
export const TOOL_TABS: ToolTab[] = ["calc", "formulas", "graph", "scratch"];
export const ENT_TABS: ToolTab[] = ["calc", "scratch"];
export function tabsFor(level: ToolLevel): ToolTab[] { return level === "ent" ? ENT_TABS : level === "off" ? [] : TOOL_TABS; }

interface ToolboxState {
  open: boolean; level: ToolLevel; tab: ToolTab;
  setOpen: (open: boolean) => void; toggle: () => void;
  setLevel: (level: ToolLevel) => void; setTab: (tab: ToolTab) => void;
}
export const useToolbox = create<ToolboxState>()((set) => ({
  open: false, level: "full", tab: "calc",
  setOpen: (open) => set((s) => ({ open: s.level === "off" ? false : open })),
  toggle: () => set((s) => ({ open: s.level === "off" ? false : !s.open })),
  setLevel: (level) => set((s) => ({
    level,
    open: level === "off" ? false : s.open,
    tab: tabsFor(level).length && !tabsFor(level).includes(s.tab) ? tabsFor(level)[0] : s.tab,
  })),
  setTab: (tab) => set((s) => (tabsFor(s.level).includes(tab) ? { tab } : {})),
}));

/** Экран задаёт уровень, пока открыт; при уходе — снова full. */
export function useToolboxLevel(level: ToolLevel) {
  useEffect(() => {
    useToolbox.getState().setLevel(level);
    return () => useToolbox.getState().setLevel("full");
  }, [level]);
}
```

| Вкладка | Компонент | Логика | `full` | `ent` |
|---|---|---|---|---|
| Калькулятор | `Calculator.tsx` | `lib/math/calc.ts`: `calcPress`, точный счёт на общем парсере, запятая | обычный + ряд `√`, `xⁿ`, `π`, `%` | **только обычный** |
| Справочник формул | `Formulas.tsx` | данные `content/formulas.ts`: разделы → `{ id, title: L, tex, note?: L }`, поиск | есть | нет (на ЕНТ справочника нет) |
| Графики | `GraphTool.tsx` | `lib/math/graph.ts`: до 3 функций, масштаб, координаты по тапу; рисунок — общий с `PlaneScene` | есть | нет |
| Черновик | `Scratchpad.tsx` | `lib/scratch.ts`: 3 листа «в клетку», рисунок + текст | есть | **есть** |
| [предложение, #17] Решение по шагам | `StepSolver.tsx` | `lib/math/steps.ts`: чистые функции «ввод → шаги `{ text: L, tex }[]`» на `Rational`; тест — шаги и ответ сверены независимо. Скрывается тема, совпадающая с `skill` текущего шага (уровень берётся из `useToolbox`) | есть | нет |
| [предложение, #17] Единицы | `Units.tsx` | `lib/math/units.ts`: таблица множителей, точный перевод на `Rational` | есть | нет |

| Экран | Уровень |
|---|---|
| уроки, тренировка, меню | `full` |
| игра «Спокойно» / «Обычный» / «Блиц» | `full` / `ent` / `off` |
| [план] мини-ЕНТ, пробный ЕНТ, режим «как на ЕНТ» | `ent` |

- **`Toolbox`** монтируется **один раз** в `Providers`. Телефон: шторка снизу с затемнением, свайп вниз ≥ 90 px закрывает; шторка модальная — Tab ходит только по её видимым элементам. ≥ 1024 px (`matchMedia("(min-width: 1024px)")`): панель справа шириной 400 px без затемнения. Esc закрывает только панель, и событие дальше не передаётся (в уроке и игре не срабатывают пауза или окно выхода). Закрытая панель — `inert`. Вкладки грузятся `dynamic()` при первом открытии и потом не размонтируются: набранное переживает закрытие. Корень помечен `data-toolbox`. Кнопка открытия — `ToolboxButton` (`aria-haspopup="dialog"`, `aria-expanded`).

**Калькулятор: `lib/math/calc.ts`** (правила как у `calcPress` образца, но счёт — точный, на общем парсере `lib/math`):

```ts
export interface CalcState {
  expr: string;    // внутренний вид: цифры, ".", + - × ÷ ( ), в full ещё √ ^ π %
  fresh: boolean;  // expr — результат «=»: цифра начнёт новое выражение, оператор продолжит это
  prev: string;    // выражение, давшее результат (строка «… =»)
}
export const CALC_INIT: CalcState = { expr: "", fresh: false, prev: "" };
export function calcPress(state: CalcState, key: string): CalcState;
export function previewCalc(expr: string): string | null;   // результат «на лету» под строкой ввода
```

- **Клавиши:** `0–9 . , + - * / × ÷ : ( ) = C ⌫`, с ПК ещё `Enter`, `Backspace`. Приведение: `*`, `x`, кириллическая `х` → `×`; `/`, `:` → `÷`; `−`, `–` → `-`; `,` → `.`; `Enter` → `=`; `Backspace` → `⌫`.
- **Мусор не набирается:** выражение ≤ 80 символов, в числе ≤ 15 цифр; ведущий `0` заменяется цифрой; вторая точка в числе игнорируется, точка в начале числа → `0.`; перед цифрой, точкой или `(` после `)` (и перед `(` после цифры) ставится `×`; второй оператор подряд заменяет первый, кроме минуса после `×` или `÷` — он становится унарным (`2×-3`); в пустом выражении и после `(` разрешён только минус; `)` — только если есть незакрытая `(` и перед ней цифра или `)`.
- **`=`:** при `fresh` ничего не делает. Иначе выражение достраивается, как в предпросмотре: висящий оператор, точка или `(` в конце отбрасываются, незакрытые скобки закрываются (`5+=` → 5, `2+(3=` → 5). Ошибка (деление на 0, мусор) — состояние не меняется. Успех → `expr` = результат, `fresh: true`, `prev` = посчитанное выражение.
- **`⌫`:** при `fresh` — сброс целиком (`CALC_INIT`), иначе стирает последний символ. **`C`** — сброс.
- **Счёт и показ:** + − × ÷ и целые степени — точно (`Rational`), поэтому `0,1 + 0,2 = 0,3`. На экране — запятая и «−» (`formatValue`); бесконечная дробь (1/3), `√2`, `π` — десятичная запись до 10 значащих цифр. В состоянии держим полную точность, округляет только дисплей.
- **Ряд `full`** [новое]: `√` вставляет `√(` (после числа или `)` — `×√(`); `xⁿ` вставляет `^(`; `π` — как число; `%` — после числа, значит «/100» (`200×15%` = 30). На уровне `ent` этого ряда нет.
- Тест `tests/math/calc.test.ts`: каждое правило выше — по примеру.

**Прочее:**
- Факт (`docs/ENT_MATH.md`): на ЕНТ калькулятор встроен в интерфейс, черновик — 3 листа А4, справочных материалов по математике нет. Возможности встроенного калькулятора официально не описаны — **считаем его простым (проверить)**.
- Поле функции в графиках проходит ту же нормализацию, что ответ (6.3): кириллические `х`/`у` → `x`/`y`, префикс `y =` / `у =` убирается. `у = 2х + 1` рисуется так же, как `y = 2x + 1`. Буквы казахской раскладки — та же подсказка `input.format.layout` (раздел 7).
- `graph.ts`: `sample` разбивает кривую на отрезки там, где значение `NaN`/`±∞` или скачок больше высоты окна (`1/x`, `tg x`). Тесты: разрыв `1/x` в 0, симметрия `x²`, `niceTicks`.

---

## 16. Сцены и песочницы (`components/scenes/`) [принцип — образец, виды — новые]

- `SceneView({ scene, className })` — `switch (scene.kind)` → `<Kind>Scene`; корень с `data-scene={kind}` (для e2e); подложка `rounded-3xl bg-surface-2/60`.
- `scenes/logic.ts` — **чистые** расчёты без React: координаты на прямой и плоскости (масштаб → пиксели), доли дроби, точки на единичной окружности, размеры фигур, сектора диаграмм (сумма 100 %), подбор кегля (`monoFit`), достижение цели песочницы `goalReached(tool, state, goal)`. Тест — `tests/scenes.test.ts`.
- `primitives.tsx` — общие атомы (оси, деления, подписи-чипы, точки-ручки).
- `explore/` — песочницы (`ParabolaTool`, `CircleTool`, `NumberLineTool` …): ползунки → состояние → `logic.ts` → живая схема.
- Все цвета — токены (`Tone`), анимации — пружины ≤ 400 мс, уважать «Меньше анимаций» (`docs/DESIGN.md`).

---

## 17. Видео и озвучка [образец]

- Видео — React-компонент **Remotion**, проигрывается в браузере через `@remotion/player`: нет рендера mp4, хранения и CDN-трафика; язык и субтитры — пропсы.
- `src/videos/registry.ts`:
  ```ts
  export interface VideoMeta {
    component: ComponentType<{ lang: Lang; subtitles: boolean }>;
    fps: number; width: number; height: number;
    durationInFrames: (lang: Lang) => number;
  }
  ```
- Шаг `{ type: "video", videoId, title }` → `LessonVideo.tsx` лениво грузит `PlayerInner.tsx` (`<Player controls … acknowledgeRemotionLicense>`). Условия лицензии Remotion — **проверить** для своего случая.
- Сценарий `src/videos/<id>/script.ts`: `SCENES: { id, narration: L, heading: L, fallbackSec }[]`. **Текст озвучки ≠ экранный текст:** в `narration` формулы и числа — словами, как читать вслух («икс квадрат», «екі бөлінген үш»). Формулы на экране — `Tex` (KaTeX работает и внутри композиции).
- Озвучка: `npm run voiceover -- <id> [--force] [--only=kk:example]` (`reference/scripts/generate-voiceover.mts`): OpenAI TTS → `public/media/videos/<id>/<lang>/<scene>.mp3`; `ffmpeg` режет тишину, mono 48 кбит/с; `ffprobe` пишет `src/videos/<id>/durations.json`. Генерируется один раз, результат коммитится. В инструкции голоса «учитель информатики» → «учитель математики».
- **Каждый mp3 проверять обратной расшифровкой** (в образце TTS пропустил фразу в kk-сцене). [новое] Сделать `scripts/verify-voiceover.mts`: транскрибация + сравнение слов, предупреждение при потере > 5 % слов (в образце такой проверки в скрипте нет).
- TTS-модель по умолчанию в образце — `gpt-4o-mini-tts`. По странице deprecations OpenAI (на 2026-10-03) снапшоты `gpt-4o-mini-tts-*` устарели, отключение 06.01.2027, замена — `gpt-realtime-2.1-mini` — **проверить** перед генерацией и задать модель через `OPENAI_TTS_MODEL`.

---

## 18. ИИ: маршруты (кратко) [образец]

Подробно (промпты, режимы, лимиты длин, память, правки под математику) — `docs/AI.md`. Эталоны — `reference/src/server/*`, `reference/src/app/api/ai/*/route.ts`, `reference/src/lib/ai.ts`, `reference/src/components/ai/*`.

| Маршрут | Модель (env) | `reasoning_effort` | Выход | Лимит по IP | `max_completion_tokens` | `maxDuration` |
|---|---|---|---|---|---|---|
| `POST /api/ai/tutor` (`chat`, `hint`, `explain`, `ask`) | `OPENAI_MODEL_TUTOR`; с фото — `OPENAI_MODEL_VISION` | `none`; с фото `low` | стрим `text/plain` | 40 / 10 мин | hint 300, иначе 1200 | 60 |
| `POST /api/ai/check-solution` | `OPENAI_MODEL_VISION` | `low` | JSON-схема `{ verdict, score, feedback, steps, tip }` | 15 / 10 мин | 2500 | 60 |
| `POST /api/ai/lesson-feedback` | `OPENAI_MODEL_FAST` | `none` | JSON-схема `{ feedback, memory, focus }` | 20 / 10 мин | 700 | 30 |

**Порядок проверок в каждом маршруте:** лимит по IP → 429 `rate_limited`; нет ключа → 503 `ai_not_configured`; тело больше 4 500 000 байт → 413 `too_large` (`readJsonBody`, `docs/AI.md`, 4.0); разбор JSON → 400 `bad_json`; санитизация (`server/context.ts`); вызов OpenAI в `try/catch` → 502 `ai_failed`; `{ signal: req.signal }` — уход ученика отменяет запрос; лог `[ai] route=… model=… in=… out=…`.

**Клиент:** только через `src/lib/ai.ts` (`streamTutor`, `checkSolution`, `lessonFeedback`, `AiError`) и хук `useTutor`; дневной лимит устройства — `spendAi()`/`refundAi()`; фото сжимается `lib/image.ts` (до 1280 px, JPEG 0,82); ответ ИИ — только через `Markdown` (теперь с KaTeX). Отзыв после урока запрашивается **из обработчика** завершения, не из эффекта.

**Для математики** (детали — `docs/AI.md`): персона «Пи»; правило формул «Unicode + LaTeX в `$…$`, десятичная запятая»; верный ответ (посчитан кодом) модель получает «для себя» и **не пересчитывает**; в `hint` и `ask` к нерешённому заданию ответ не называет; в режиме «как на ЕНТ» и пробном ЕНТ ИИ выключен.

**Известные слабые места образца** (улучшить по ROADMAP): лимит по IP в памяти процесса — на Vercel у каждого экземпляра своя память, для продакшена нужен общий счётчик (Upstash Redis / Vercel KV) [план]; дневной лимит 60 только на клиенте (обходится очисткой хранилища — настоящая защита: лимит по IP + жёсткий лимит расходов в кабинете OpenAI); размер тела запроса явно не ограничен (в Matematika — 413 `too_large`, см. выше); нет автотестов промптов (добавить `tests/prompts.test.ts`, раздел 19).

---

## 19. Тесты

### 19.1 Юнит-тесты (`vitest`, `tests/**/*.test.ts`, среда node)

| Файл | Что гарантирует |
|---|---|
| `validate.ts` (хелпер) | `validateStep(step): string[]`, `validateScene(scene)`, `collectTex(obj)` — правила 19.2 |
| `content.test.ts` | каждый `available` урок из `UNITS` есть в `LESSONS`; заголовки ru и kk; `steps.flatMap(validateStep)` пусто; id шагов уникальны (в уроке и во всём курсе); все `skill` есть в `SKILLS`; конспект ru и kk > 200 символов; **все LaTeX-строки рендерятся**; нет десятичной точки в тексте; формулы справочника рендерятся |
| `lessons/<id>.test.ts` | по файлу на урок (образец — `docs/LESSON_METHOD.md`, 12.5): каждое числовое утверждение урока **пересчитано независимо** (суммы в `worked`/`cloze`, корни, значения в вариантах) |
| `math/rational.test.ts`, `math/normalize.test.ts`, `math/parse.test.ts`, `math/compare.test.ts`, `math/interval.test.ts`, `math/format.test.ts`, `math/tex.test.ts` | раздел 6.9; шаги нормализации 6.3; `splitMath` (8.2) |
| `math/keypad.test.ts`, `math/calc.test.ts`, `math/graph.test.ts` | машины состояний клавиатуры и калькулятора (`0,1 + 0,2 = 0,3`), разрывы графиков |
| `evaluate.test.ts` | `isReady` и `evaluate` для каждого типа, частичные баллы `multi`/`assign`/`cloze`, ошибка формата не засчитывается |
| `generators.test.ts` | все навыки × уровни 1–3 × seed 1..299: валидный шаг, эталон проходит свою проверку, ответ пересчитан вторым способом, детерминизм; `buildDrill` чаще берёт слабые навыки, `focus` работает |
| `bank.test.ts` | у навыков есть заявленные формы; утверждения: оба языка, истинность сверена независимо, баланс верных/неверных; пары и short вычислены верно; `draw`: число, без повторов, рост уровней, неизвестный навык → `[]` |
| `ent.test.ts` | таблица п. 18 для `entPoints`; `multiPoints`; `assignPoints` (временная трактовка, раздел 23); `levelFromMastery`; `rampLevel`; [план] состав пробного ЕНТ = 50 и 10 баллов |
| `scenes.test.ts` | логика сцен и цели песочниц |
| `gamification.test.ts`, `mastery.test.ts`, `games.test.ts` | XP, уровни, серия; EMA; награды игр (cap 30, рекорд, ≥ 3 действия) |
| `store.test.ts` | `beforeEach(resetProgress)`; повторная ошибка не дублируется и хранит урок; верный ответ закрывает ошибку; пропуск лишает бонуса; `refundAi` возвращает обращение |
| `games/<id>.test.ts` | чистая логика каждой игры: режимы, очки, часы, рост уровня, повторы |
| `prompts.test.ts` [новое] | в `hint` и в `ask` к нерешённому заданию нет ответа ученика и объяснения, есть «НЕ сообщай»; при `answered: true` ответ открыт |
| `context.test.ts` [новое] | `sanitizeContext`/`sanitizeTask` обрезают длины, отбрасывают мусорные типы, картинка только `data:image/(jpeg\|png\|webp)` |
| `text.test.ts` [новое] | `plain()` не трогает формулы и знаки `>`, `<`, `*` (8.3) |
| `text-rules.test.ts` [новое] | все пары `{ ru, kk }` (уроки, `dict.ts`, `games/*/strings.ts`, `formulas.ts`, `skills.ts`, `course.ts`, шаги банка), вне `$…$`: нет эмодзи; нет слов из смеси латиницы и кириллицы; нет переменной, набранной кириллицей (`2х`, `х=5`); в ru нет глаголов с родом; kk не копия ru и (если длиннее 60 символов) содержит `әғқңөұүһі`. Регулярки — `docs/LESSON_METHOD.md`, 14 |
| `safety.test.ts` [новое] | читает исходники через `fs`: в `src/components/ai/*` и `src/app/(main)/tutor/*` нет импорта `components/math/Tex` (ответ ИИ — только через `Markdown`); в `src/` нет `eval(` и `new Function(` |

Правила: тестируется чистая логика из `src/lib/*` (без React); генераторы — много seed; утверждения проверяются **независимым способом**, а не той же формулой, что в коде. В работе — один файл (`npx vitest run tests/<файл>`), полный прогон — в конце.

### 19.2 Что обязан проверять валидатор шага (`validate.ts`)

- [ ] Все `L` заполнены на ru и kk (`prompt`, `explanation`, варианты-`L`, тексты сцен).
- [ ] Все `$…$` / `$$…$$` в шаге рендерятся KaTeX с `throwOnError: true`; `$` парные; кириллица в формуле — только в `\text{}`; в LaTeX запятая — `{,}`.
- [ ] `choice`: 2+ варианта (`ent: true` → ровно `ENT_FORMAT[трек].options.single`, сейчас 4), `correct` в диапазоне, **ровно один вариант равен ответу по значению**, варианты не повторяются.
- [ ] `multi`: 3+ варианта (`ent: true` → ровно 6, верных 1–3); множество вариантов, равных верным по значению, совпадает с `correct`.
- [ ] `input`: `answers` непусты и проходят собственную проверку; `mode` допустим (`algebra` — пока ошибка, 4.3); `round`/`tolerance` ≥ 0.
- [ ] `assign`: 2 пункта (для ЕНТ), 4 значения, `correct` — разные индексы в диапазоне.
- [ ] `match`: 3–6 пар, правые части уникальны. `order`: 3+ пунктов.
- [ ] `numberline`: `min < max`, цели внутри и на сетке `step`. `plane`: цели внутри окна и на сетке.
- [ ] `solution`: есть `reference`, `answer` проходит свою проверку.
- [ ] `cloze`: 1+ пропуск, ответы пропусков проходят проверку.
- [ ] `worked`: 2+ подшага. `explore`: цель достижима (`goalReached` на `goal.values`).
- [ ] `reveal` — только у заданий; `contextId` ссылается на существующий `ContextBlock`.
- [ ] Сцены корректны (`validateScene`), выражения графиков разбираются.

### 19.3 e2e (`Playwright`, `npm run e2e`)

Эталон — `reference/playwright.config.ts`: устройство Pixel 7, `baseURL http://localhost:3100`, сервер собирается и поднимается сам (`npm run build && npx next start -p 3100`). Путь к Chromium можно задать `PW_CHROMIUM_PATH`; если браузера нет — `npx playwright install chromium` (в облаке Codex — **проверить**). Без обращений к ИИ.

| Файл | Сценарий |
|---|---|
| `e2e/smoke.spec.ts` | `/` → `/onboarding` (язык, имя, 5× «Продолжить») → `/learn` («Привет, Тест!») → первый урок → инфо-шаги → ввод **с экранной клавиатуры** (тап `3`, `,`, `5`) → «Проверить» → красная панель и «Правильный ответ» при неверном / зелёная при верном; нет `pageerror` |
| `e2e/smoke.spec.ts` (2-й тест) | кладёт в `localStorage["matematika-v1"]` `{ state: { onboarded: true, profile: { …, lang: "kk" }, lessons: {…} }, version: 1 }` → `/practice` → `/drill?mode=skill&skill=<id>` на казахском |
| `e2e/games.spec.ts` | для каждого id из `GAMES`: `/practice` → `a[href="/game/<id>"]` → «Играть» → правила скрыты, есть интерактив, 1,5 с без `pageerror` |
| `e2e/games-full.spec.ts` [новое, этап 6] | каждая игра × 3 темпа, `page.clock`, случайные тапы до итогов: XP начислен один раз и не выше лимита, рекорд — только в «Обычном» и «Блице», нет `pageerror` (`docs/GAMES.md`, 15) |
| `e2e/tools.spec.ts` [новое] | калькулятор: `0,1 + 0,2 = 0,3`; цифры, набранные в калькуляторе, **не выбирают** вариант ответа в уроке; в игре «Блиц» кнопки инструментов нет |

---

## 20. Сборка и деплой на Vercel [образец]

Пошаговая инструкция для владельца — `docs/WORKFLOW.md`. Здесь — что важно для кода.

1. **Сборка:** Vercel сам распознаёт Next.js и выполняет `next build`. Локально перед пушем — полный набор проверок (раздел 2.2); сломанная сборка = сломанный сайт.
2. **Автодеплой:** каждый push в ветку даёт превью; продакшен — только `main` (слияние PR, решение #29).
3. **CI на GitHub** — `.github/workflows/ci.yml` (создаётся в П-1.1): на каждый PR и push в `main` — `npm ci`, typecheck, lint, test, без ключей и секретов. Build и e2e в CI нет: сборку проверяет Vercel, e2e — локально перед выкладкой.
4. **Адрес для людей** — публичный домен проекта `<проект>.vercel.app`. Служебные адреса сборок (`<проект>-<хэш>-….vercel.app`) требуют входа в Vercel — в образце из-за этого «сайт не открывался с других устройств». Проверять ссылку с чужого телефона.
5. **Переменные окружения** — Vercel → Project → Settings → Environment Variables (раздел 21). Без `OPENAI_API_KEY` сайт работает, ИИ отвечает «не настроен».
6. **Логи расходов:** Vercel → Logs, фильтр `[ai]` — строки `route=… model=… in=… out=…`.
7. **Длительность функций:** `export const maxDuration = 60` (tutor, check-solution) и `30` (lesson-feedback) в файлах маршрутов. Допустимый максимум на тарифе Vercel — **проверить**.
8. **Бюджет OpenAI:** отдельный Project в platform.openai.com со своим ключом и **жёстким месячным лимитом** расходов (Settings → Limits → Spend; при превышении API отвечает 429) — рекомендация досье Codex (2026-10-03).
9. **Оплата Codex (подписка ChatGPT) и оплата OpenAI API — разные счета.** Ключ API нужен только приложению; в облако Codex его не класть — тесты идут без него.
10. PWA: `src/app/manifest.ts` (название «Matematika», цвета из токенов), иконка `src/app/icon.svg`.

---

## 21. Переменные окружения

Только серверные. **Никаких `NEXT_PUBLIC_*`** для ключей и моделей. `.env.local` в `.gitignore`; образец без значений — `.env.example`.

| Переменная | Обязательна | По умолчанию (как в образце) | Где задать | Зачем |
|---|---|---|---|---|
| `OPENAI_API_KEY` | для ИИ | — | `.env.local`; Vercel (Production, по желанию Preview) | ключ OpenAI API, только сервер |
| `OPENAI_MODEL_TUTOR` | нет | `gpt-5.4-mini` | там же | чат, подсказки, разбор, вопрос по уроку |
| `OPENAI_MODEL_VISION` | нет | `gpt-5.4-mini` | там же | проверка фото, чат с фото |
| `OPENAI_MODEL_FAST` | нет | `gpt-5.4-nano` | там же | отзыв после урока + память |
| `OPENAI_MODEL_REVIEW` | нет | `gpt-5.5` | только `.env.local` | офлайн `review:kk` (скрипт образца её читает, а в `reference/.env.example` строки нет — в нашем `.env.example` она есть) |
| `OPENAI_TTS_MODEL` | нет | `gpt-4o-mini-tts` | только `.env.local` | офлайн озвучка (см. раздел 17 про устаревание) |
| `OPENAI_TTS_VOICE` | нет | `coral` | только `.env.local` | голос озвучки |
| `OPENAI_TRANSCRIBE_MODEL` [новое] | нет | `gpt-4o-transcribe` (**проверить** актуальность) | только `.env.local` | обратная расшифровка озвучки (`docs/AI.md`, 12.3) |
| `PW_CHROMIUM_PATH` | нет | — | локально / в облаке | путь к Chromium для e2e |
| `NODE_USE_ENV_PROXY` | нет | — | только среда за прокси | `=1`, если серверный `fetch` к OpenAI не проходит (в облаке Claude Code помогало; для Codex — **проверить**) |

**Что ставить сейчас (решение):** на старте — значения из колонки «По умолчанию» (как в образце, проверены на ru/kk). Они же — умолчания в `MODELS` в `src/server/openai.ts`. Переход на GPT-6 — отдельными задачами по шагам `docs/AI.md`, 2.3: живая проверка ru/kk → запись в DECISIONS → смена только значения переменной, код не трогаем.

Файл `.env.example` целиком (тот же, что в `docs/AI.md`, 2.4):

```bash
# Скопируйте в .env.local и заполните. .env.local не коммитится.

# Ключ OpenAI — только на сервере. Отдельный проект «matematika» с жёстким месячным лимитом расходов.
OPENAI_API_KEY=

# Модели приложения (необязательно; умолчания — в src/server/openai.ts)
# OPENAI_MODEL_TUTOR=gpt-5.4-mini
# OPENAI_MODEL_VISION=gpt-5.4-mini
# OPENAI_MODEL_FAST=gpt-5.4-nano

# Только для скриптов разработчика (на Vercel не нужны)
# OPENAI_MODEL_REVIEW=gpt-5.5
# OPENAI_TTS_MODEL=gpt-4o-mini-tts
# OPENAI_TTS_VOICE=coral
# OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
```

**Актуальность моделей** (досье Codex, developers.openai.com/api/docs/pricing и …/deprecations, проверено 2026-10-03):
- `gpt-5.4-nano` — работает, но **объявлен устаревшим**: отключение 01.04.2027, замена — `gpt-6-luna`.
- `gpt-5.4-mini`, `gpt-5.5` — есть в API.
- Кандидаты: `gpt-6-luna` вместо nano и mini; `gpt-6.1-sol` вместо gpt-5.5 для офлайн-задач. У `gpt-6-luna` по умолчанию `reasoning_effort: "medium"` — **всегда задавать effort явно**; `gpt-6.1-sol` не поддерживает `none` (минимум `low`). Перед сменой — живая проверка ru/kk на математике и запись в DECISIONS. Модели меняются только переменными, код не трогать.

---

## 22. Что взять из `reference/`

| Взять почти как есть (поменять имя, ключ, тексты) | Переписать по образцу | Новое (в образце нет) |
|---|---|---|
| `app/globals.css`, `app/layout.tsx` (+ `katex.min.css`), `app/manifest.ts` | `lib/types.ts` (раздел 4) | `lib/math/*` |
| `components/ui/*`, `components/motion/*` | `lib/check.ts`, `lib/evaluate.ts` (раздел 6) | `components/math/Tex.tsx`, `MathKeypad.tsx`, `AnswerPreview.tsx` |
| `lib/cn.ts`, `lib/text.ts` (`plain` — новая версия, 8.3), `lib/mastery.ts`, `lib/games.ts`, `lib/hooks.ts` | `lib/store.ts` (ключ, достижения) | шаги `numberline`, `plane`, `assign`; контекстные группы |
| `lib/sound.ts`, `lib/feedback.ts`, `lib/image.ts` | `lib/gamification.ts` (уровни, `number_master`) | сцены математики, песочницы |
| `lib/ent.ts` (+ `assignPoints`, `ENT_FORMAT`) | `lib/student-context.ts` (тексты) | вкладки «Формулы», «Графики» |
| `lib/bank/types.ts`, `lib/bank/index.ts` (+ форма `context`) | `server/prompts.ts`, `server/context.ts` (`GOALS`) — `docs/AI.md` | `content/formulas.ts` |
| `lib/ai.ts`, `lib/ai-types.ts`, `components/ai/*` | `i18n/dict.ts` | `tests/prompts.test.ts`, `tests/context.test.ts`, `e2e/tools.spec.ts` |
| `server/openai.ts`, `server/rate-limit.ts`, `app/api/ai/*` | `components/mascot/Mascot.tsx` («Пи») | `scripts/verify-voiceover.mts` |
| `games/types.ts`, `components/app/AppShell.tsx`, `AchievementBadge.tsx` | `components/Markdown.tsx` (+ KaTeX) | |
| `i18n/useT.ts`, конфиги (`tsconfig.json`, `eslint.config.mjs` — с правками 2.3), `scripts/*` (тексты инструкций) | | |

**Писать по описанию — в Informatica есть, в `reference/` нет:**

| Файл | Где описано |
|---|---|
| `components/lesson/LessonPlayer.tsx`, `Results.tsx`, `steps/*` | логика — раздел 5; вид — `docs/DESIGN.md`, 7.3–7.7 |
| `lib/keys.ts` | раздел 5 (код целиком) |
| `lib/generators.ts`, `lib/bank/helpers.ts` | раздел 9.2 (код целиком) |
| `lib/scratch.ts` | раздел 12.3 |
| `lib/math/calc.ts` (был `lib/calc.ts`), `components/tools/*` | раздел 15; вид — `docs/DESIGN.md`, 7.14 |
| `components/games/GameShell.tsx` | `docs/GAMES.md`, раздел 4 (код) |
| `components/app/Providers.tsx`, `Widgets.tsx`, `WeekChart.tsx` | `docs/DESIGN.md`, раздел 5 (таблица «Есть ли эталон») |
| `components/scenes/*`, `src/videos/*` | разделы 16–17; `docs/DESIGN.md`, 11 |

---

## 23. Не подтверждено — проверить

| Что | Влияет на |
|---|---|
| Подсчёт баллов «соответствия» 2 × 4 (наша трактовка 2/1/0) | `assignPoints`, пробный ЕНТ |
| 4 или 5 вариантов в «Математической грамотности» | `ENT_FORMAT.literacy.options` |
| Какой калькулятор встроен в ЕНТ (простой или инженерный) | вкладка «Калькулятор» на уровне `ent` |
| Нужен ли `@types/katex` для выбранной версии KaTeX | установка |
| Максимальный `maxDuration` на тарифе Vercel | маршруты ИИ |
| Нужен ли `NODE_USE_ENV_PROXY=1` в облаке Codex; есть ли там браузер для e2e | среда разработки |
| Актуальная TTS-модель после устаревания `gpt-4o-mini-tts` | озвучка |
| Качество `gpt-6-luna` на математике ru/kk | выбор моделей по умолчанию |
| Условия лицензии Remotion для проекта | видео |
| Пороги защиты парсера (длина 200, показатель 1000, числа до 10²⁰⁰) — хватает ли их на практике | `lib/math/*`; менять с записью в DECISIONS |
