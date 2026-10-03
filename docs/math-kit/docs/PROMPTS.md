# Промпты для Codex

> Готовые задания для Codex:
> - по одному на каждую часть этапа из `docs/ROADMAP.md` — номера П-…;
> - на типовые ситуации — номера Т-…: новый урок, игра, баг, ревью, вычитка казахского, промпт ИИ.
>
> Каждый промпт — блок для копирования в **новый** чат Codex. Устройство блока — раздел 2.
> Снимок: 2026-10-03. Модели и команды Codex — по официальной документации OpenAI на эту дату (learn.chatgpt.com/docs). Перед работой сверяй список моделей в `/model`.

---

## 0. Как пользоваться (для владельца)

Незнакомое слово (PR, ветка, превью, worktree, Plan mode, e2e…) — `docs/WORKFLOW.md`, раздел 16 (словарик) и 9.1 (git простыми словами).

1. Открой приложение ChatGPT для ПК, включи режим **Codex**:
   - выбери папку проекта;
   - работа — «на этом компьютере» (Local);
   - права — «Ask for approval».
2. **Одна задача — один чат.** «Один чат на весь проект» OpenAI называет частой ошибкой: контекст раздувается, результат хуже, лимит уходит быстрее.
3. Над каждым промптом есть строка с данными:
   - **роль** и **модель · усилие** — выбери их под полем ввода или командой `/model`. усилия называются как в приложении (Light, Medium, High, Extra High; раздел 1);
   - нужен ли **план**;
   - **ветка**;
   - что сделать **заранее**.
4. Скопируй блок целиком и замени всё в `<угловых скобках>`.
5. Если написано «сначала план»:
   - до отправки включи Plan mode (`/plan` или Shift+Tab);
   - Codex покажет план, ответь «ок» или поправь.
6. В конце Codex коммитит в ветку, пушит и открывает PR. У П-1.1 превью нет: проект подключается к Vercel после слияния П-1.1. Начиная с П-1.2 Vercel собирает превью ветки:
   - открой превью на телефоне (нужно войти в Vercel);
   - пройди пункты «Готово, когда» этапа в `docs/ROADMAP.md`.
7. Что дальше:
   - есть замечания → Т-5 (один баг) или Т-11 (список);
   - всё хорошо → Т-6 (ревью и выкладка).
8. Пора начать новый чат, если:
   - `/status` показывает, что контекст занят больше чем наполовину;
   - или сменилась тема.

   Тогда: Т-8б (закрыть сессию) → новый чат → Т-8а (продолжить).

**Важно:**
- **Ключ OpenAI никогда не вставляй в чат.** Только руками в файл `.env.local` и в настройки Vercel.
- Codex не читает этот файл целиком — ему достаётся только вставленный промпт. Правила проекта он берёт из `AGENTS.md` сам.
- Если Codex не может сделать что-то сам (push, кнопка в Vercel, вход в сервис), он пишет, что нажать.

---

## 1. Какую модель выбирать

| Роль над промптом | Модель · усилие | Для чего |
|---|---|---|
| **Прораб** | GPT-6.1 Sol · Medium; трудное — High или Extra High | план, ТЗ, типы, стор и другие общие файлы, промпты ИИ, сложные баги, ревью |
| **Исполнитель** | GPT-6 Luna · High или GPT-6.1 Sol · Light | код по готовому ТЗ, перенос образца, тесты, переводы |
| **Механика** | GPT-6 Luna · Light или Medium | прогон проверок, вычитка по правилам, однотипные правки, итог сессии |

**Названия уровней усилия.** В приложении и в этом наборе они называются Light, Medium, High, Extra High (в конфиге — `low`, `medium`, `high`, `xhigh`). Max и Ultra не нужны (`docs/WORKFLOW.md`, 5.1).

Факты (документация OpenAI, проверено 2026-10-03):
- **GPT-6.1 Sol** — рекомендуемая модель по умолчанию, запущена 29.09.2026.
- **GPT-6 Luna** — самая экономичная.
- **GPT-6 Astra** — самая сильная, на Plus с малым лимитом. GPT-6 Astra · Light/Medium — только если Sol не справился дважды.
- Оценка лимита на Plus за 5 часов: GPT-6.1 Sol — 15–160 локальных сообщений, GPT-6 Luna — 350–3000. По кредитам Luna примерно в 20 раз дешевле Sol.
- Не включать без нужды:
  - Fast — лимит расходуется в 2,5 раза быстрее;
  - Max и Ultra — OpenAI пишет, что большинству задач они не нужны;
  - Astra · Extra High.
- `gpt-5.4` и `gpt-5.4-mini` уже выведены из Codex (31.08.2026), `gpt-5.5` выводится 14.10.2026 — в Codex их не выбирать. Модели **самого приложения** — другое дело: они задаются в `.env` (`docs/AI.md`, раздел 2).
- Если в `/model` названия другие:
  - прораб — рекомендуемая по умолчанию модель на среднем усилии;
  - исполнитель и механика — самая экономичная модель.
- Модель переключает **владелец**. Codex в отчёте пишет, на какой модели делать следующий шаг.
- **Прораб — это ещё и право править общие файлы:** `lib/types.ts`, `lib/store.ts`, `i18n/dict.ts`, реестры (`AGENTS.md`, раздел 2). Поэтому несложные задачи, которые трогают общие файлы, помечены «Прораб · GPT-6.1 Sol · Light»: права прораба, усилие поменьше. Исполнитель правит только свои файлы.

### Шпаргалка команд Codex

| Команда | Что делает |
|---|---|
| `/plan` или Shift+Tab | Plan mode: Codex собирает контекст, задаёт вопросы, строит план до кода |
| `/review` | ревью незакоммиченных изменений или ветки против `main`; можно с фокусом: `/review Focus on <…>` |
| `/status` | модель, остаток контекста, лимиты |
| `/compact` | сжать историю чата |
| `/model` | сменить модель и усилие |
| `/fork`, `/side` | ответвить чат; побочный вопрос без засорения основного |
| worktree | отдельная копия проекта для параллельного чата — когда несколько исполнителей работают одновременно |
| `@codex review` в PR на GitHub | ревью PR. Считается отдельно, как «Code Review usage» |

Источник: learn.chatgpt.com/docs (reference/slash-commands, prompting, environments/git-worktrees, third-party/github), 2026-10-03.

---

## 2. Как устроен промпт

Над каждым промптом — одна строка:

**Роль · модель · план · ветка · заранее**

Внутри блока — разделы:

| Раздел | Что в нём |
|---|---|
| **Задача** | одно-два предложения: что и зачем, номер этапа |
| **Перед началом** | ветка и что прочитать. Только нужные разделы, а не документы целиком: `rg -n "^#" docs/<файл>.md`, потом нужные строки |
| **Сделать** | нумерованный список с путями файлов |
| **Можно менять / Нельзя** | границы задачи |
| **Готово, когда** | что должно быть правдой в конце |
| **Проверка** | команды; скриншоты — постоянным скриптом `scripts/screenshots.mts` (лежит в git, появляется в П-1.2), картинки — в `scripts/out/shots/` (эта папка в git не попадает): 390×844, светлая и тёмная тема, ru и kk. В отчёте Codex прикладывает картинки в чат или называет, какие файлы открыть. Если Codex не умеет смотреть картинки — он перечисляет, что проверить владельцу |
| **Документы** | что обновить по `AGENTS.md`, раздел 3 |
| **Сдать** | коммиты по-русски, push, PR в `main` без слияния, отчёт владельцу 5–10 строк |

**Ветки:**
- этапы — `etap-<номер>` (например `etap-1-5a`);
- уроки — `lesson-<id>`;
- навыки — `bank-<навык>`;
- сцены — `scene-<вид>`;
- игры — `game-<id>`;
- баги — `fix-<коротко>`;
- документы — `docs-<дата>`;
- вычитка — `kk-<дата>`;
- промпты ИИ — `ai-prompt-<коротко>`;
- план раздела — `section-<id>-plan`;
- сборка серии уроков — `series-<имя>`;
- эксперимент по стилю видео — `video-lab`, в `main` не вливать;
- документы по замечаниям, ретроспективе, сверке ЕНТ и сверке с образцом — `docs-feedback-<дата>`, `docs-retro-<дата>`, `docs-ent-<год>`, `docs-sample-<дата>`.

**Казахский на этапе 1.** Новые kk-строки пишутся сразу. Скрипт `scripts/review-kk.mts` появляется в П-1.1, но запускать его можно только с ключом OpenAI в `.env.local`, а ключ появляется на этапе 2. До этого в CHANGELOG пишем «kk не вычитан», а вычитку делаем через Т-9 после П-2.4.

**npm-скрипты появляются вместе со своими файлами:** `review:kk` — П-1.1, `check:prompts` — П-2.4, `voiceover` и `voiceover:verify` — П-3.4. Скрипта нет в `package.json` — значит, его этап ещё не пройден.

---

## 3. Промпты по этапам

### П-0 · Знакомство с набором (этап 0)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-0` · заранее:** репозиторий с набором на GitHub, первый коммит сделан.

```text
Задача: познакомиться с проектом Matematika до начала кода и найти в наборе документов противоречия и неясности. Код не писать. Это этап 0 из docs/ROADMAP.md.

Контекст: в репозитории пока только набор: AGENTS.md (правила), docs/ (концепция, дизайн, архитектура, методика урока, ИИ, игры, ЕНТ, план, процесс), reference/ (эталонные файлы проекта-образца Informatica — только читать).

Перед началом
- git status чистый; создай ветку etap-0 от main.
- Прочитай: AGENTS.md; docs/HANDOFF.md; docs/ROADMAP.md (разделы 1–3 и этап 1); docs/DECISIONS.md; reference/README.md.
- Из остальных docs/ читай только оглавления (rg -n "^#" docs/<файл>.md) и те разделы, где видишь расхождение.

Сделать
1. Проверь согласованность между AGENTS.md и docs/*: пути src/, ключ localStorage matematika-v1, имена тестов и npm-скриптов, id игр, id урока-образца num-2-frac-add, названия этапов.
2. Найди противоречия: одно и то же названо по-разному, разные числа, разные правила. По каждому: файл и раздел, в чём расхождение, что предлагаешь, какой документ главнее по AGENTS.md.
3. Составь до 10 вопросов владельцу, без ответов на которые этап 1 не начать. Простым языком, с вариантами ответа.
4. Проверь размер: wc -c AGENTS.md (должно быть ≤ 20480 байт, DECISIONS #28).
5. docs/HANDOFF.md: «Этап 0: набор прочитан, ждём ответов владельца».

Нельзя
- Писать код, ставить зависимости, менять reference/.
- Исправлять противоречия до ответов владельца.

Готово, когда
- Владелец получил таблицу противоречий и вопросы.
- После его ответов (в этом же чате) решения записаны в docs/DECISIONS.md (Решение / Почему / Альтернативы / Пересмотреть), а документы, где противоречие решено, поправлены.

Проверка: кода нет — покажи git diff --stat по docs/.
Документы: docs/DECISIONS.md, docs/HANDOFF.md, docs/CHANGELOG.md (строка «Этап 0: набор принят, решения №…»).
Сдать: коммит по-русски в etap-0, push, PR в main (не мержить). Отчёт: таблица противоречий, вопросы, следующий шаг — П-1.1 (GPT-6.1 Sol · Medium).
```

---

### П-1.1 · Каркас проекта (этап 1.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-1-1` · заранее:** этап 0 закрыт. Vercel пока **не** подключать: это делается после слияния П-1.1 в `main` (`docs/WORKFLOW.md`, 1.6).

```text
Задача: создать каркас проекта Matematika — пустое Next.js-приложение, которое собирается, тестируется и выкладывается на Vercel. Этап 1.1 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-1 от main.
- Прочитай: docs/ARCHITECTURE.md — разделы 2 (стек, скрипты, конфиги), 3 (дерево папок), 21 (переменные окружения); docs/AI.md — 2.4 (.env.example) и 12.1 (скрипт вычитки kk); образцы reference/package.json, reference/tsconfig.json, reference/eslint.config.mjs, reference/vitest.config.mts, reference/playwright.config.ts, reference/.env.example, reference/scripts/review-kk.mts.
- Next.js 16 новее твоих знаний: после установки прочитай нужные гайды в node_modules/next/dist/docs/.

Сделать
1. Next.js 16 (App Router, Turbopack, TypeScript strict, Tailwind v4, папка src/, алиас @/*) в корне репозитория.
   - create-next-app не работает в непустой папке. Создай проект во временной папке вне репозитория и перенеси файлы в корень. AGENTS.md, docs/, reference/ не затирать.
   - Next.js может сам дописать в AGENTS.md блок nextjs-agent-rules. Сверь AGENTS.md с версией из набора (git diff AGENTS.md): блок nextjs-agent-rules — ровно один, остальное без изменений.
2. package.json: name "matematika". Скрипты — как в ARCHITECTURE 2.2, кроме voiceover: его файла ещё нет, скрипт добавит П-3.4. Зависимости — стек из AGENTS.md (раздел 7) и ARCHITECTURE 2.1, включая katex, remark-math, rehype-katex и tsx. Версии — как в reference/package.json, где они там есть.
3. Конфиги по образцам. Отличия:
   - tsconfig target ES2020 (нужны BigInt-литералы);
   - reference/ исключён из tsconfig, ESLint и vitest.
4. .env.example по docs/AI.md 2.4 (без значений, вместе с OPENAI_MODEL_REVIEW). .gitignore — полностью по docs/WORKFLOW.md, 1.4 (включая scripts/out/ и scripts/fixtures/photos/); если он уже есть с первого коммита — сверь и дополни. Проверка: git check-ignore .env.local печатает .env.local.
5. src/app/page.tsx — временная заглушка со словом «Matematika» по центру, без эмодзи.
6. tests/smoke.test.ts (одна простая проверка) и e2e/smoke.spec.ts: главная открывается без pageerror.
7. Нет браузера для e2e — npx playwright install chromium. Не получилось — напиши об этом.
8. CI — делать: .github/workflows/ci.yml, на каждый PR и push в main — npm ci, typecheck, lint, test. Без build и e2e (сборку проверяет Vercel). Без ключей и секретов.
9. scripts/review-kk.mts — из reference, сразу под математику по docs/AI.md 12.1:
   - промпт редактора — «учитель математики», текст из AI.md 12.1;
   - термины — из таблиц docs/ENT_MATH.md, раздел 4, кроме строк «проверить»;
   - источники: все из AI.md 12.1, включая src/content/formulas.ts, src/components/scenes/logic.ts, scripts/prompt-cases.ts. Каждый файл и папку (src/videos, src/games, src/games/registry.ts, src/content/lessons) — только через existsSync: сейчас их нет, и скрипт образца на этом падает;
   - печатает, сколько строк собрано из каждого файла;
   - больше 400 строк — пачки по ~300;
   - без OPENAI_API_KEY выходит с понятным сообщением, не падает.
   Проверка без ключа: npm run review:kk печатает число строк по файлам (сейчас почти везде 0) и сообщение «нет ключа».

Нельзя
- Добавлять зависимости вне стека без записи в DECISIONS.
- Класть ключи и секреты куда-либо.
- Подключать Vercel и вливать PR в main.

Готово, когда
- typecheck, lint, test, build, e2e зелёные; CI на GitHub в этом PR зелёный.
- Ты запустил npm run dev, и у владельца на компьютере по ссылке http://localhost:3000 видна заглушка.
- Публичный адрес проверяется после приёмки: владелец говорит «выкладываем» → Т-6 вливает PR → владелец подключает Vercel → адрес <проект>.vercel.app открывается на телефоне и у друга без входа в Vercel.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e. Скриншоты не нужны.
Документы: CHANGELOG (v0.0.1), ROADMAP (1.1 → ✅ ждёт приёмки), HANDOFF; DECISIONS — версии стека, target ES2020, reference/ исключён из сборки, CI включён.
Сдать: коммиты по-русски в etap-1-1, push, PR в main (не мержить). Отчёт 5–10 строк: что сделано; как открыть заглушку на компьютере; что нажать владельцу в Vercel после слияния (по docs/WORKFLOW.md 1.6); следующий шаг — Т-6, затем П-1.2 (GPT-6 Luna · High).
```

---

### П-1.2 · Дизайн-система и витрина `/dev` (этап 1.2)

**Исполнитель · GPT-6 Luna · High · без плана · ветка `etap-1-2` · заранее:** П-1.1 влит в `main`.

```text
Задача: перенести дизайн-систему образца — токены цветов, шрифты, UI-компоненты, анимации — и сделать служебную витрину /dev. Этап 1.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-2 от main.
- Прочитай: docs/DESIGN.md — разделы 0, 2.1–2.5, 3, 4, 5.1–5.9, 8, 13, 15; образцы reference/src/app/globals.css, reference/src/app/layout.tsx, reference/src/lib/cn.ts, reference/src/components/ui/*.tsx, reference/src/components/motion/*.

Сделать
1. src/app/globals.css — из reference, цвета и их смысл не менять. Добавки для математики — по DESIGN 2.3. Новый цвет добавлять в три блока (светлая тема, [data-theme="dark"], @media prefers-color-scheme) и в @theme.
2. layout.tsx: шрифты @fontsource-variable/nunito и jetbrains-mono, как в reference; метаданные «Matematika».
3. src/lib/cn.ts.
4. src/components/ui/: Button и ButtonLink, Card и SectionTitle, Pill, ProgressBar и Ring, Modal.
5. src/components/ui/Segmented.tsx и Choice.tsx — по DESIGN 5.6 и 5.8, интерфейс — из таблицы DESIGN 5. В образце они жили внутри страниц профиля и онбординга; у нас Choice нужен ещё и в выборе темпа игр, поэтому оба — в ui/.
6. src/components/lesson/steps/Option.tsx — по DESIGN 5.7.
7. src/components/motion/* из reference: MotionProvider (LazyMotion), presets, Reveal, Shake, XpBurst, CountUp, ComboFlame, AnimatedChips, useReduceMotion.
8. src/app/dev/page.tsx — служебная витрина, не для учеников:
   - все варианты и размеры Button, Card, Pill всех тонов, ProgressBar, Ring, Modal (кнопка «открыть»), Option во всех состояниях, Segmented, Choice (выбрана и не выбрана);
   - таблица 7 смысловых токенов: success, danger, warning, gold, streak, primary, ai;
   - строка с буквами ә ғ қ ң ө ұ ү һ і;
   - подписи — имена компонентов и токенов, как в коде, без русских фраз;
   - metadata robots: { index: false }, в навигацию не добавлять.
9. scripts/screenshots.mts — постоянный скрипт скриншотов (в git), им пользуются все следующие промпты:
   - запуск: npx tsx scripts/screenshots.mts --pages /dev,/learn --sizes 390x844,360x640 --themes light,dark --langs ru,kk;
   - сайт уже запущен (npm run dev или npm run build && npx next start), адрес — --base, по умолчанию http://localhost:3000;
   - тема — через colorScheme Playwright; язык пока игнорируется (стора ещё нет — его научит П-1.4);
   - картинки — scripts/out/shots/<страница>-<ширина>-<тема>-<язык>.png; в конце печатает список файлов.

Можно менять: src/app/globals.css, src/app/layout.tsx, src/app/dev/*, src/lib/cn.ts, src/components/ui/*, src/components/motion/*, src/components/lesson/steps/Option.tsx, scripts/screenshots.mts.
Нельзя:
- hex и dark: в компонентах (кроме исключений DESIGN 2.5);
- эмодзи;
- менять смысл цветов.

Готово, когда (на /dev, ширина 390 px):
- кнопки «объёмные» и проседают при нажатии;
- в тёмной теме всё читается, нет белых пятен;
- казахские буквы — тем же шрифтом;
- эмодзи нет.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная тема, scripts/screenshots.mts): /dev целиком.
Документы: CHANGELOG (v0.0.2), ROADMAP (1.2 → ✅ ждёт приёмки), HANDOFF; DECISIONS — витрина /dev служебная, не в меню; Segmented и Choice — в ui/.
Сдать: коммиты по-русски в etap-1-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.3 (GPT-6.1 Sol · Medium).
```

---

### П-1.3 · Маскот «Пи» и иконка (этап 1.3)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-1-3` · заранее:** П-1.2 влит.

```text
Задача: нарисовать маскота «Пи» (π) по образцу «Бита» и сделать иконку приложения. Этап 1.3 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-3 от main.
- Прочитай: docs/DESIGN.md, раздел 10 (10.1–10.5); reference/src/components/mascot/Mascot.tsx; reference/src/app/manifest.ts.

Сделать
1. src/components/mascot/Mascot.tsx:
   - один SVG, геометрия по DESIGN 10.2;
   - настроения happy, neutral, thinking, sad, celebrate (10.3);
   - пропсы mood и size;
   - role="img", aria-label «Пи».
2. «Жизнь» маскота, как у образца:
   - CSS-анимации «дыхания», покачивания и моргания в globals.css;
   - у каждого маскота своя фаза моргания;
   - реакции на смену настроения через motion.
3. MascotSays: маскот слева + речевой пузырь.
4. Иконки и манифест по DESIGN 10.5:
   - src/app/icon.svg (значок вкладки) и public/icons/icon.svg;
   - PNG-иконки PWA — icon-192.png, icon-512.png, icon-maskable-512.png (поля ~10 %), apple-touch-icon.png (180) в public/icons/ — генерирует скрипт scripts/icons.mts из icon.svg скриншотом Playwright (Chromium уже стоит для e2e). PNG коммитятся, руками не рисуются;
   - src/app/manifest.ts: название «Matematika», start_url /learn, display standalone, иконки из public/icons/; apple-touch-icon — в metadata layout.tsx.
5. На /dev добавь раздел «Mascot»:
   - 5 настроений в размере 96 px;
   - happy в 52 и 34 px;
   - пример MascotSays;
   - кнопки смены настроения для проверки реакций.

Нельзя: картинки PNG/JPG (исключение — PNG-иконки PWA, сгенерированные scripts/icons.mts из icon.svg), эмодзи, внешние файлы.

Готово, когда:
- на превью Vercel приложение ставится на телефон: Android, Chrome — «Установить приложение»; iPhone, Safari — «Поделиться → На экран «Домой»»; открывается без адресной строки на /learn, на значке — Пи;
- 5 настроений различимы;
- Пи моргает (не хором) и «дышит»;
- символ π читается в 34 px;
- с «Меньше анимаций» (prefers-reduced-motion) Пи стоит спокойно.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная тема): раздел Mascot на /dev.
Документы: CHANGELOG (v0.0.3), ROADMAP (1.3 → ✅ ждёт приёмки), HANDOFF; DECISIONS — стиль Пи (запиши после «ок» владельца).
Сдать: коммиты по-русски в etap-1-3, push, PR в main (не мержить). Отчёт: спроси владельца, нравится ли Пи (что поменять); следующий шаг — П-1.4 (GPT-6.1 Sol · Medium).
```

---

### П-1.4 · Стор, двуязычие, онбординг, оболочка, профиль (этап 1.4)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-1-4` · заранее:** П-1.3 влит.

```text
Задача: заложить прогресс ученика (стор), двуязычие, онбординг, навигацию и профиль. Этап 1.4 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-4 от main.
- Прочитай:
  - docs/ARCHITECTURE.md — 4.1 (базовые типы), 12 (стор), 13 (i18n);
  - docs/DESIGN.md — 6 (навигация), 7.1 (онбординг), 7.13 (профиль), 7.16 (пустые состояния), 12 (тексты);
  - docs/CONCEPT.md — 6.1, 6.2, 6.11;
  - образцы reference/src/lib/store.ts, reference/src/lib/text.ts, reference/src/lib/hooks.ts, reference/src/i18n/useT.ts, reference/src/i18n/dict.ts, reference/src/components/app/AppShell.tsx.

Сделать
1. src/lib/types.ts — пока только базовые типы из ARCHITECTURE 4.1: Lang, L, Text, Level, Grade, Goal, ExplainStyle, Theme. Шаги и уроки — в П-1.6а.
2. src/lib/text.ts из reference. Функция plain() убирает и $…$ — по ARCHITECTURE.
3. src/i18n/dict.ts (группы app.*, nav.*, common.*, onb.*, prof.* …, каждая строка { ru, kk }) и src/i18n/useT.ts из reference.
4. src/lib/store.ts — useApp:
   - Zustand persist, ключ matematika-v1, version 1, merge для новых полей профиля;
   - поля профиля — по ARCHITECTURE 12.1;
   - действия этого этапа: completeOnboarding, updateProfile, resetProgress. Остальные добавляются в своих этапах (список — ARCHITECTURE 12.2).
5. Providers:
   - тема (data-theme на <html>, "system" — без атрибута);
   - lang на <html>;
   - data-reduce-motion;
   - MotionProvider.
6. Экраны:
   - / — редирект: onboarded ? /learn : /onboarding;
   - /onboarding — 6 шагов по DESIGN 7.1;
   - группа (main) с AppShell: 5 разделов по DESIGN 6.1, нижнее меню на телефоне, боковое на ≥ 1024 px;
   - пустые /learn, /practice, /tutor, /notes, /stats с пустыми состояниями и Пи;
   - /profile: настройки по DESIGN 7.13, «Скачать мои данные» (matematika-progress.json), «Сбросить прогресс» с подтверждением.
   - Переключатели профиля — Segmented, карточки онбординга — Choice: оба уже есть в src/components/ui/ (П-1.2), свои не делать.
   - Кнопку «Помощники» пока не рисуй (этап 1.9).
7. Тесты:
   - tests/store.test.ts: merge добавляет новые поля старому сохранению; resetProgress;
   - e2e/smoke.spec.ts: онбординг на ru → /learn с «Привет, Тест!»; тот же путь на kk.
8. scripts/screenshots.mts: параметр --langs теперь работает — состояние в localStorage["matematika-v1"] (формат — ARCHITECTURE 19.3: onboarded, имя «Тест», lang).

Нельзя:
- русские строки прямо в компонентах — только t()/l();
- глаголы с родом в текстах;
- эмодзи.

Готово, когда:
- онбординг проходится на ru и kk;
- после перезагрузки имя и настройки сохранились;
- язык и тема меняются сразу;
- на ПК — боковое меню;
- «Сбросить прогресс» ведёт на онбординг.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): шаги онбординга 1, 2, 6; /learn; /profile; одна страница на 1280 px.
Документы: CHANGELOG (v0.0.4, «kk не вычитан»), ROADMAP (1.4 → ✅ ждёт приёмки), HANDOFF; DECISIONS — поля профиля, если отличаются от образца.
Сдать: коммиты по-русски в etap-1-4, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.5а (GPT-6.1 Sol · High).
```

---

### П-1.5а · Математическое ядро: числа, дроби, разбор, сравнение (этап 1.5)

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `etap-1-5a` · заранее:** П-1.4 влит.

```text
Задача: написать математическое ядро src/lib/math — точные дроби, разбор выражений, сравнение ответов по значению. На нём стоят проверка ответов, калькулятор и графики. Этап 1.5 (часть а) из docs/ROADMAP.md. Экранов нет.

Перед началом
- git status чистый; ветка etap-1-5a от main.
- Прочитай:
  - docs/ARCHITECTURE.md — раздел 6 целиком и раздел 23 (пороги парсера);
  - docs/CONCEPT.md — 11.1;
  - в docs/ENT_MATH.md — как записываются ответы: десятичная запятая, «;» в точках и промежутках, tg/ctg.

Сделать
1. src/lib/math/: rational.ts, normalize.ts, parse.ts, value.ts, compare.ts, interval.ts, format.ts.
   - Остальные файлы из ARCHITECTURE 6.2 — не сейчас: tex.ts и keypad.ts делает П-1.5б, calc.ts — П-1.9а, graph.ts — П-1.9б. algebra.ts не делать (помечен [план]).
   - Чистые функции, без React.
   - Без eval.
   - Дроби — точно: пары BigInt.
   - Деление на 0, корень из отрицательного, слишком длинный ввод → null, а не исключение.
2. src/lib/check.ts — тонкая обёртка: checkInput / checkFormat по ARCHITECTURE 6.7.
3. tests/math/*.test.ts по ARCHITECTURE 6.9. Ожидаемые значения в тестах считай вторым, независимым способом или пиши руками — не той же функцией.

Нельзя
- Math.random, Date.now, float там, где нужна точность.
- Засчитывать ошибку формата («3, 5», незакрытая скобка) как «неверно»: это «формат», ученик исправит.

Готово, когда
- Тесты зелёные.
- В отчёте — таблица из 15+ примеров «ввод → эталон → вердикт». Обязательно:
  - 3,5 / 3.5 / 7/2 / 3½ при эталоне 7/2;
  - 3,6 при эталоне 7/2;
  - −2,5 = −5/2 = −2½;
  - √169 = 13;
  - (2; −1) = (2;-1);
  - {1; 3} = {3; 1};
  - [6; 10) ≠ [6; 10];
  - выражение 0,1 + 0,2 = 0,3;
  - «3, 5» → формат.

Проверка: npm run typecheck && npm run lint && npm test && npm run build. Скриншоты не нужны.
Документы: CHANGELOG (v0.0.5), ROADMAP (1.5а → ✅ ждёт приёмки), HANDOFF; DECISIONS — пороги парсера, правило «ошибка формата ≠ неверно»; ARCHITECTURE — если API модулей отличается от раздела 6.
Сдать: коммиты по-русски в etap-1-5a, push, PR в main (не мержить). Отчёт: таблица примеров простым языком; следующий шаг — П-1.5б (GPT-6.1 Sol · Light).
```

---

### П-1.5б · Формулы KaTeX и математическая клавиатура (этап 1.5)

**Прораб · GPT-6.1 Sol · Light (нужны строки в словаре) · без плана · ветка `etap-1-5b` · заранее:** П-1.5а влит.

```text
Задача: подключить формулы KaTeX и сделать экранную математическую клавиатуру с предпросмотром ответа. Этап 1.5 (часть б) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-5b от main.
- Прочитай: docs/ARCHITECTURE.md — 7 (клавиатура) и 8 (KaTeX); docs/DESIGN.md — 3.4, 5.10, 7.4.3; reference/src/components/Markdown.tsx.

Сделать
1. src/components/Markdown.tsx: react-markdown + remark-gfm + remark-math + rehype-katex, без сырого HTML. katex.min.css подключить в layout.tsx.
2. src/components/math/Tex.tsx (Tex, MathText) и src/lib/math/tex.ts по ARCHITECTURE 8:
   - цвета формул — через токены, видны в тёмной теме;
   - длинная формула прокручивается внутри себя.
3. src/lib/math/keypad.ts — чистая машина состояний клавиатуры; tests/math/keypad.test.ts.
4. src/components/math/MathKeypad.tsx по ARCHITECTURE 7 и DESIGN 7.4.3:
   - клавиши 0–9 , − / √ π x ( ) Стереть Готово, для промежутков [ ] ; ∞;
   - клавиши ≥ 48 px;
   - корень помечен data-keypad;
   - на ПК — обычная клавиатура: «.» → «,», «-» → «−», sqrt → √, pi → π; замены не сбивают каретку (value в onChange не переписывать, ARCHITECTURE 7);
   - буквы казахской раскладки (ә і ң ғ ү ұ қ ө һ) в поле → янтарная подсказка input.format.layout, не «неверно».
5. src/components/math/AnswerPreview.tsx — как ученик увидит свой ответ.
6. На /dev раздел «Ввод ответа»:
   - поле с клавиатурой и предпросмотром;
   - поле «эталон»;
   - вердикт через lib/math: Верно / Неверно / Формат;
   - образцы формул: дробь, система, корень из выражения, интеграл, очень длинная формула.

Можно менять: src/components/Markdown.tsx, src/components/math/*, src/lib/math/tex.ts, src/lib/math/keypad.ts, tests/math/keypad.test.ts, src/app/dev/*, src/app/layout.tsx (только подключение CSS), dict.ts (ключи keypad.*: «Стереть», «Готово» и подписи клавиш на ru и kk; input.format.layout — подсказка «переключи раскладку», ARCHITECTURE 7).
Нельзя: менять остальные модули lib/math (их API — из П-1.5а) и стор.

Готово, когда (на /dev, 390 px):
- с экранной клавиатуры набираются 3,5 / −5/2 / √2 / (2; −1);
- при эталоне 7/2 засчитываются 3,5, 3.5, 7/2, 3½; 3,6 не засчитывается;
- формулы видны в тёмной теме, длинная не вылезает за экран;
- на ПК работает обычная клавиатура.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844 и 360×640, светлая и тёмная): раздел «Ввод ответа» с открытой клавиатурой.
Документы: CHANGELOG (v0.0.6), ROADMAP (1.5 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-1-5b, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.6а (GPT-6.1 Sol · Medium).
```

---

### П-1.6а · Типы, проверка ответов, курс и ТЗ плеера (этап 1.6)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-1-6a` · заранее:** П-1.5б влит.

```text
Задача: описать модель данных урока, проверку ответов, реестр курса и написать ТЗ на плеер урока для исполнителя. Этап 1.6 (часть а) из docs/ROADMAP.md. Это «невидимая», но главная часть — от неё зависит всё.

Перед началом
- git status чистый; ветка etap-1-6a от main.
- Прочитай:
  - docs/ARCHITECTURE.md — 4 (целиком), 5 (плеер), 6.8 (оценка по типам), 10 (ЕНТ), 12.2 (действия стора), 19.1–19.2;
  - docs/LESSON_METHOD.md — 7 и 14;
  - docs/DESIGN.md — 7.3–7.7;
  - образцы reference/src/lib/types.ts, evaluate.ts, ent.ts, mastery.ts.

Сделать
1. src/lib/types.ts — все типы из ARCHITECTURE 4: шаги, включая assign, numberline, plane; ContextBlock; Lesson; Unit; TrackId; Scene (виды — как объявлены; рисовать их будем позже).
2. src/lib/evaluate.ts по ARCHITECTURE 6.8.
3. src/lib/ent.ts — из reference + assignPoints и ENT_FORMAT по ARCHITECTURE 10.
4. src/lib/mastery.ts — из reference.
5. src/content/skills.ts и src/content/course.ts:
   - TRACKS, UNITS обоих треков: все уроки пока "soon";
   - LESSONS, getLesson, findStep, unlockedSkills;
   - в LESSONS (не в UNITS) — служебный урок dev-demo: создай заготовку src/content/lessons/dev-demo.ts с одним шагом theory, наполнит исполнитель.
   - id треков и разделов — таблица docs/ENT_MATH.md 3.6 без изменений (math, literacy; num, eq, fn, seq, trig, explog, calc, geo, solid, model, ent, lit), формат id — ARCHITECTURE 4.4. Хочешь поменять — сначала вопрос владельцу, до коммита. Итог запиши в DECISIONS: после первого урока id менять нельзя.
6. Стор: recordAnswer, finishSession, noteCombo, dismissMistake, unlock, consumeNewAchievements — по ARCHITECTURE 12.2. Тесты стора — как в образце: повторная ошибка не дублируется и хранит урок; верный ответ закрывает ошибку; пропуск лишает бонуса.
7. dict.ts — все ключи плеера и итогов (lesson.*, fb.*, res.*) на ru и kk, чтобы исполнитель не трогал словарь.
8. Тесты: tests/validate.ts (правила 19.2), tests/content.test.ts, tests/text-rules.test.ts (LESSON_METHOD 14: эмодзи, смесь латиницы и кириллицы, переменная кириллицей, род, kk = копия ru — по dict.ts и всем L), tests/evaluate.test.ts, tests/ent.test.ts (таблица п. 18 Правил ЕНТ).
9. ТЗ для исполнителя — docs/tasks/player.md:
   - Цель.
   - Что прочитать.
   - Можно менять — точный список файлов: components/lesson/*, components/lesson/steps/*, app/lesson/[id]/*, content/lessons/dev-demo.ts, e2e/smoke.spec.ts.
   - Нельзя: lib/types.ts, lib/evaluate.ts, lib/store.ts, i18n/dict.ts. Если что-то нужно — список в отчёт.
   - Экраны шагов: choice, multi, input с MathKeypad, match, order, cloze, assign, theory, story, worked; solution без ИИ — только проверка итогового ответа; video и explore — заглушка-рамка; numberline и plane — позже, через Т-3.
   - Поведение LessonPlayer по ARCHITECTURE 5.
   - Итоги без ИИ: статический отзыв по точности.
   - Служебный урок dev-demo: в LESSONS, не в UNITS, ссылка с /dev; по одному шагу каждого вида; навыки — из банка (после этапа 1.7 тренировка откроется); тексты ru и kk.
   - Список рисков: двойной тап, автоповтор Enter, кнопка «Продолжить» на итогах активна через 0,7 с, цифры с клавиатуры и из «Помощников» не выбирают вариант.
   - Готово, когда — из ROADMAP 1.6.

Нельзя: делать экраны плеера — это работа исполнителя по ТЗ.

Готово, когда
- Тесты зелёные.
- docs/tasks/player.md готов: исполнитель может работать, не задавая вопросов.

Проверка: npm run typecheck && npm run lint && npm test && npm run build. Скриншоты не нужны.
Документы: CHANGELOG (v0.0.7), ROADMAP (1.6а → ✅), HANDOFF; DECISIONS — id разделов и навыков, тип assign; ARCHITECTURE — если типы отличаются от раздела 4.
Сдать: коммиты по-русски в etap-1-6a, push, PR в main (не мержить). Отчёт простыми словами: что заложено и почему это важно; следующий шаг — П-1.6б (GPT-6.1 Sol · Medium, новый чат).
```

---

### П-1.6б · Плеер урока, экраны шагов, итоги, демо-урок (этап 1.6)

**Исполнитель · GPT-6.1 Sol · Medium (ядро продукта, не экономим) · без плана · ветка `etap-1-6b` · заранее:** П-1.6а влит.

```text
Задача: сделать плеер урока по ТЗ docs/tasks/player.md: экраны шагов, панель ответа, «работа над ошибками», итоги, служебный демо-урок. Этап 1.6 (часть б) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-6b от main.
- Прочитай: docs/tasks/player.md целиком; docs/ARCHITECTURE.md — 5; docs/DESIGN.md — 7.3–7.7 и 14; reference/src/components/ui/*, reference/src/components/motion/*.

Сделать: всё из раздела «Сделать» в docs/tasks/player.md.

Можно менять — только файлы из списка ТЗ.
Нельзя:
- lib/types.ts, lib/evaluate.ts, lib/store.ts, i18n/dict.ts — если нужно, список изменений в отчёт;
- проверять ответ где-либо, кроме evaluate();
- русские строки в компонентах.

Готово, когда (демо-урок на 390 px):
- каждый вид шага проходится;
- неверный ответ → красная панель, «Правильный ответ: …» и объяснение целиком;
- частично верный multi → янтарная «Почти!»;
- ошибочные задания возвращаются в конце с плашкой «Работа над ошибками»;
- двойной тап и зажатый Enter не проскакивают панель и итоги;
- на ПК Enter проверяет и продолжает.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e. В e2e/smoke.spec.ts — ввод с экранной клавиатуры (3 , 5) и неверный ответ с красной панелью.
Скриншоты (390×844, светлая и тёмная, ru и kk): choice до ответа; input с клавиатурой; панели «верно», «частично», «неверно»; итоги.
Документы: CHANGELOG (v0.0.8), ROADMAP (1.6 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-1-6b, push, PR в main (не мержить). Отчёт: что проверить в демо-уроке (ссылка с /dev); следующий шаг — П-1.7а (GPT-6.1 Sol · Medium).
```

---

### П-1.7а · Банк заданий и тренировка (этап 1.7)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-1-7a` · заранее:** П-1.6б влит.

```text
Задача: сделать банк заданий (генераторы по навыкам) и тренировку: умную, «работу над ошибками», по навыку. Этап 1.7 (часть а) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-7a от main.
- Прочитай:
  - docs/ARCHITECTURE.md — 9 (целиком), 19.1 (тесты генераторов и банка);
  - docs/LESSON_METHOD.md — 10.8 (таблица генератора);
  - docs/DESIGN.md — 7.8;
  - docs/CONCEPT.md — 6.5, 8.2;
  - образцы reference/src/lib/bank/types.ts, reference/src/lib/bank/index.ts.

Сделать
1. src/lib/generators.ts: canGenerate, generateLeveled, generateStep, buildDrill. Вес навыка (1,1 − освоение)²; последняя треть — на уровень выше; сортировка A → B → C.
2. src/lib/bank/types.ts и src/lib/bank/index.ts (draw, rampLevel) — формы по ARCHITECTURE 9.3.
3. src/lib/bank/num.ts — навыки серии «Дроби» (LESSON_METHOD 12), чтобы банк потом не переписывать:
   - num.frac-add — урок 1.2, уровни A/B/C по LESSON_METHOD 10.8;
   - num.frac-compare — урок 1.1 «доли и равные дроби» (этот id уже есть в LESSON_METHOD 13);
   - по желанию num.frac-mul — урок 1.3 «умножение и деление дробей».
   Уровни A/B/C для num.frac-compare и num.frac-mul предложи сам и запиши в DECISIONS; паспорт серии (П-3.1) берёт эти id.
   - Ответ считает код.
   - Неверные варианты — типичные ошибки учеников.
   - У каждого задания explanation на ru и kk.
4. Тесты:
   - tests/generators.test.ts: все навыки × уровни 1–3 × seed 1..299 → validateStep пусто, эталон проходит свою проверку, ответ пересчитан вторым способом, детерминизм;
   - tests/bank.test.ts.
5. /drill?mode=smart|mistakes|skill — LessonPlayer с kind "drill", 8 заданий.
6. /practice по DESIGN 7.8:
   - «Умная тренировка», «Работа над ошибками», список навыков с % и «Тренировать»;
   - плитки «Мини-игры» и «Пробный ЕНТ» с плашкой «Скоро».
7. Урок dev-demo использует навыки банка, чтобы после него открылась тренировка.

Нельзя: Math.random и Date.now внутри генераторов (seed создаётся снаружи).

Готово, когда:
- после демо-урока в «Тренировке» открыт навык;
- «Умная тренировка» — 8 заданий от лёгких к трудным, каждый раз новые числа;
- ошибка попадает в «Работу над ошибками», верный ответ её закрывает.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e. В e2e — второй сценарий smoke: состояние в localStorage["matematika-v1"] на kk → /drill?mode=skill&skill=num.frac-add.
Скриншоты (390×844, светлая и тёмная, ru и kk): /practice, задание тренировки.
Документы: CHANGELOG (v0.0.9), ROADMAP (1.7а → ✅ ждёт приёмки), HANDOFF; DECISIONS — первые навыки, уровни A/B/C для них.
Сдать: коммиты по-русски в etap-1-7a, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.7б (GPT-6.1 Sol · Light).
```

---

### П-1.7б · Геймификация и «Прогресс» (этап 1.7)

**Прораб · GPT-6.1 Sol · Light (в основном перенос образца, но меняется стор) · без плана · ветка `etap-1-7b` · заранее:** П-1.7а влит.

```text
Задача: перенести геймификацию (XP, уровни, серия, цель дня, достижения) и сделать экран «Прогресс». Этап 1.7 (часть б) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-7b от main.
- Прочитай:
  - docs/CONCEPT.md — 7 (целиком: XP, уровни, серия, цель, комбо, достижения);
  - docs/ARCHITECTURE.md — 11;
  - docs/DESIGN.md — 5.9 (плитки, LevelCard), 7.10, 7.13 (достижения);
  - образцы reference/src/lib/gamification.ts, reference/src/lib/hooks.ts, reference/src/components/app/AchievementBadge.tsx.

Сделать
1. src/lib/gamification.ts:
   - числа XP и формула уровней — как в образце;
   - названия уровней и достижения — математические, по CONCEPT 7.2 и 7.6 (включая number_master);
   - иконки достижений — строками-именами lucide.
2. src/lib/hooks.ts: useDaily, useStreak, useLevel. Выдача достижений в сторе (evaluate).
3. src/components/app/AchievementBadge.tsx.
4. Шапка: чипы серии и XP.
5. /learn: приветствие Пи, «Цель на день» (кольцо), «Подтянем слабые темы?».
   - Временно — простой список доступных уроков. Карта будет на этапе 5.
6. /stats по DESIGN 7.10:
   - плитки, неделя (WeekChart), освоение тем, последние ошибки;
   - карточка «Память наставника» с текстом «появится после уроков».
7. /profile: LevelCard и сетка достижений.
8. Тесты: tests/gamification.test.ts, tests/mastery.test.ts, выдача достижений в tests/store.test.ts.

Нельзя: эмодзи (только lucide), глаголы с родом в описаниях достижений.

Готово, когда:
- растут XP, серия и кольцо цели дня;
- в «Прогрессе» видны неделя и проценты освоения тем;
- достижение «Первый шаг» выдаётся после урока.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844 и 1280 px, светлая и тёмная, ru и kk): /learn, /stats, /profile.
Документы: CHANGELOG (v0.0.10, «kk не вычитан»), ROADMAP (1.7 → ✅ ждёт приёмки), HANDOFF; DECISIONS — названия уровней и достижения.
Сдать: коммиты по-русски в etap-1-7b, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.8 (GPT-6 Luna · High).
```

---

### П-1.8 · «Живость»: звук, вибрация, анимации (этап 1.8)

**Исполнитель · GPT-6 Luna · High · без плана · ветка `etap-1-8` · заранее:** П-1.7б влит.

```text
Задача: оживить приложение — звуки, вибрация, огонёк комбо, всплеск XP, конфетти, реакции Пи, настройка «Меньше анимаций». Этап 1.8 из docs/ROADMAP.md. В образце этого не хватало («мало эффектов, звуков») — здесь закладываем сразу.

Перед началом
- git status чистый; ветка etap-1-8 от main.
- Прочитай: docs/DESIGN.md — 7.5, 7.7, 8, 9, 10.3; образцы reference/src/lib/sound.ts, reference/src/lib/feedback.ts, reference/src/components/motion/*.

Сделать
1. src/lib/sound.ts и src/lib/feedback.ts — из reference без изменений звучания. Все звуки и вибрация — только через feedback().
2. Подключить события по DESIGN 9: tap, correct, wrong, combo (тон растёт), xp, levelUp, complete, pop.
3. В шапке урока — ComboFlame (ступени 3/5/7). В панели ответа — XpBurst. На итогах — CountUp и конфетти (динамический импорт, цвета из DESIGN 8.7). В шапке приложения — AnimatedChips.
4. Пи реагирует на результат: happy / thinking / sad, celebrate на итогах.
5. «Меньше анимаций» (профиль + prefers-reduced-motion): CSS-блок из reference и MotionConfig. Конфетти при этом нет.

Можно менять: src/lib/sound.ts, src/lib/feedback.ts, components/lesson/*, components/app/* (шапка), globals.css (только анимации).
Нельзя: lib/types.ts, lib/store.ts, dict.ts; аудиофайлы (только Web Audio).

Готово, когда:
- на Android при верном и неверном ответе — разные звук и вибрация (на iPhone вибрации у сайтов нет — это нормально);
- огонёк растёт на 3, 5 и 7 подряд;
- на итогах — конфетти;
- «Меньше анимаций» убирает конфетти и движение;
- звук и вибрация выключаются в профиле.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная): панель ответа с XpBurst, итоги с конфетти.
Документы: CHANGELOG (v0.0.11, «звук и вибрация на реальном телефоне — проверить человеком»), ROADMAP (1.8 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-1-8, push, PR в main (не мержить). Отчёт: что послушать и потрогать на телефоне; следующий шаг — П-1.9а (GPT-6.1 Sol · Light).
```

---

### П-1.9а · «Помощники»: шторка, калькулятор, черновик (этап 1.9)

**Прораб · GPT-6.1 Sol · Light (нужны строки в словаре) · без плана · ветка `etap-1-9a` · заранее:** П-1.8 влит.

```text
Задача: сделать панель «Помощники», доступную с любого экрана, с калькулятором как на ЕНТ и черновиком. Этап 1.9 (часть а) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-9a от main.
- Прочитай: docs/ARCHITECTURE.md — 15 и 6 (калькулятор считает через lib/math); docs/DESIGN.md — 7.14, 7.4.4 (холст) и строка DrawingCanvas в таблице раздела 5; docs/CONCEPT.md — 6.8.

Сделать
1. src/components/tools/useToolbox.ts:
   - уровни full / ent / off; на уровне ent — калькулятор и черновик;
   - useToolboxLevel(level): экран задаёт уровень, при уходе — снова full.
2. src/components/tools/Toolbox.tsx — по DESIGN 7.14:
   - на телефоне — шторка снизу (свайп вниз закрывает), на ≥ 1024 px — панель справа;
   - Esc закрывает только панель;
   - на телефоне фокус не выходит из панели, при закрытии возвращается на кнопку;
   - вкладки не размонтируются;
   - корень помечен data-toolbox.
3. ToolboxButton: иконка в шапках урока и тренировки, FAB на страницах меню; при уровне off ничего не рисует.
4. src/lib/math/calc.ts — чистая машина клавиш на lib/math:
   - точно, с запятой;
   - в full — ряд √, xⁿ, π, %; в ent — только обычные клавиши.
   - Calculator.tsx — по DESIGN 7.14.
5. src/lib/scratch.ts:
   - IndexedDB через idb-keyval, ключ matematika:scratch:v1, 3 листа;
   - sanitize прочитанного; запас в памяти, если IndexedDB недоступен;
   - координаты рисунка не зависят от размера экрана (в образце рисунок терялся при другом масштабе).
   - src/components/lesson/DrawingCanvas.tsx — общий холст, его же возьмёт шаг solution в П-2.2. Интерфейс — таблица DESIGN 5, вид — DESIGN 7.4.4 (клетка 22 px, «Ручка», «Ластик», «Отменить», «Очистить»). Как в образце: ref с isEmpty(), exportCanvas() (на белом фоне — для ИИ), exportImage() (PNG — для сохранения); пропсы onChange(empty), disabled, initialImage, height. Масштаб PNG фиксирован (2 пикселя на CSS-пиксель) и не зависит от экрана.
   - Scratchpad.tsx — на DrawingCanvas: «в клетку», палец или стилус, «Очистить» с подтверждением вторым нажатием. Рисунок сохраняется после каждого штриха.
6. src/lib/keys.ts — ignoreKey: горячие клавиши урока не срабатывают в data-toolbox, data-keypad, textarea, модалках.
7. Тесты: tests/math/calc.test.ts (0,1 + 0,2 = 0,3; большие числа точно); e2e/tools.spec.ts (0,1 + 0,2 = 0,3; цифры из калькулятора не выбирают вариант ответа в уроке).
8. Вкладки «Формулы» и «Графики» — в П-1.9б, сейчас их не показывать.
9. dict.ts — ключи tools.* на ru и kk (названия вкладок, «Очистить», «как на экзамене»).

Нельзя: eval; float там, где нужна точность.

Готово, когда:
- калькулятор открывается из урока, тренировки и меню;
- 0,1 + 0,2 = 0,3;
- цифры калькулятора не выбирают вариант в уроке;
- рисунок черновика сохранился после перезагрузки и поворота экрана;
- нарисовать в тёмной теме и переключить тему на светлую и обратно — рисунок виден в обеих (чернила по DESIGN 7.4.4: на экране --text, в файле #111 на прозрачном).

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844 и 360×640, светлая и тёмная, ru и kk): шторка с калькулятором поверх урока; черновик с рисунком; 1280 px — панель справа.
Документы: CHANGELOG (v0.0.12), ROADMAP (1.9а → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-1-9a, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-1.9б (GPT-6.1 Sol · Medium).
```

---

### П-1.9б · «Помощники»: справочник формул и графики (этап 1.9)

**Прораб · GPT-6.1 Sol · Medium (графики — коварная задача, нужны строки в словаре) · без плана · ветка `etap-1-9b` · заранее:** П-1.9а влит.

```text
Задача: добавить в «Помощники» справочник формул с поиском и построитель графиков. Этап 1.9 (часть б) из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-1-9b от main.
- Прочитай:
  - docs/CONCEPT.md — 6.8 (таблица вкладок);
  - docs/ARCHITECTURE.md — 15, 6.6 (парсер), 8 (KaTeX);
  - docs/DESIGN.md — 7.14, 11.3 (CoordPlane, FunctionGraph);
  - docs/ENT_MATH.md — обозначения (tg, ctg, ln) и раздел 4 (термины kk).

Сделать
1. src/content/formulas.ts — разделы по CONCEPT 6.8: степени и корни, сокращённое умножение, квадратное уравнение, прогрессии, тригонометрия (таблица значений, приведение), логарифмы, производные и первообразные, площади и объёмы.
   - Формулы — LaTeX.
   - Названия — ru и kk; kk-термины только из ENT_MATH раздел 4. Термина нет или он с пометкой «проверить» — в отчёт.
2. src/components/tools/Formulas.tsx: поиск по ru и kk, рендер KaTeX.
3. src/lib/math/graph.ts — чистые функции:
   - точки графика y = f(x) через парсер lib/math;
   - разрывы (1/x, tg x) не соединяются линией;
   - область определения.
   - Тест tests/math/graph.test.ts.
4. src/components/tools/GraphTool.tsx:
   - до 3 функций разными цветами из токенов (не фиолетовым — он за ИИ);
   - масштаб и сдвиг пальцами;
   - по тапу — координаты точки с запятой.
5. На уровне ent обе вкладки скрыты: справочника и графиков на ЕНТ нет.
6. В tests/content.test.ts — каждая формула справочника рендерится KaTeX с throwOnError: true.

Нельзя: внешние библиотеки графиков без записи в DECISIONS; eval.

Готово, когда:
- поиск «дискриминант» находит формулу;
- у графика y = x² − 4 видны пересечения с осью x в −2 и 2, по тапу — координаты;
- график 1/x не соединяет ветви.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): справочник с поиском; график y = x² − 4 и y = 1/x.
Документы: CHANGELOG (v0.1.0 — этап 1 готов, «kk не вычитан»), ROADMAP (этап 1 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-1-9b, push, PR в main (не мержить). Отчёт: чек-лист приёмки всего этапа 1 из ROADMAP; следующий шаг — П-2.1 (GPT-6.1 Sol · Medium).
```

---

### П-2.1 · Сервер ИИ: маршруты, промпты, защита, тесты без ключа (этап 2.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-2-1` · заранее:** этап 1 принят. Ключ OpenAI не нужен.

```text
Задача: сделать серверную часть ИИ-наставника «Пи»: клиент OpenAI, системные промпты, обрезку входа, лимиты, три маршрута — и тесты, которые работают без ключа. Этап 2.1 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-2-1 от main.
- Прочитай:
  - docs/AI.md — разделы 0–4, 6, 7.1–7.4, 9, 10, 13;
  - образцы reference/src/server/*, reference/src/app/api/ai/*/route.ts, reference/.env.example.

Сделать
1. src/server/openai.ts:
   - MODELS из env, умолчания по docs/AI.md 2.3–2.5;
   - reasoning_effort всегда задан явно;
   - logUsage, jsonError.
2. src/server/prompts.ts — черновик из docs/AI.md 7.1. LaTeX внутри String.raw.
3. src/server/context.ts по 7.2 и src/server/rate-limit.ts. Все файлы src/server/* начинаются с import "server-only".
4. Маршруты src/app/api/ai/{tutor,check-solution,lesson-feedback}/route.ts по разделу 4, включая 413 too_large на слишком большое тело.
5. Общие файлы этапа 2, чтобы исполнители их не трогали:
   - стор: memory, aiUsage, setMemory, spendAi / refundAi (60 в день);
   - unlock для достижений ai_friend и solver;
   - dict.ts: ключи tutor.*, sol.*, ИИ-части итогов на ru и kk.
6. Тесты по docs/AI.md 13: промпты, обрезка контекста, маршруты с vi.mock — без сети и без ключа.

Нельзя:
- настоящие запросы к OpenAI в тестах;
- ключ в коде, в .env.example, в доках;
- NEXT_PUBLIC_ для ключа и моделей;
- тексты промптов вне prompts.ts.

Готово, когда:
- тесты зелёные;
- без ключа POST /api/ai/tutor отвечает 503 ai_not_configured (покажи в отчёте вывод curl);
- в hint и в ask до ответа промпт не содержит «Ответ ученика:» и содержит «НЕ сообщай».

Проверка: npm run typecheck && npm run lint && npm test && npm run build. Скриншоты не нужны.
Документы:
- CHANGELOG (v0.1.1) отдельной строкой: «Промпты: первая версия src/server/prompts.ts по docs/AI.md 7.1; живая проверка — в П-2.4»;
- DECISIONS — модели по умолчанию (пока как в образце), лимиты маршрутов;
- ROADMAP (2.1 → ✅), HANDOFF.
Сдать: коммиты по-русски в etap-2-1, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-2.2 (GPT-6.1 Sol · Medium).
```

---

### П-2.2 · ИИ в уроке: подсказка, «Спроси Пи», разбор, фото, отзыв (этап 2.2)

**Исполнитель · GPT-6.1 Sol · Medium · без плана · ветка `etap-2-2` · заранее:** П-2.1 влит.

```text
Задача: подключить ИИ-наставника к уроку: подсказка, «Спроси Пи» на любом шаге, разбор ошибки, проверка решения по фото и рисунку, отзыв после урока и память наставника. Этап 2.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-2-2 от main.
- Прочитай:
  - docs/AI.md — 3, 5, 6.4, 8;
  - docs/DESIGN.md — 7.4.4, 7.5, 7.6, 7.7 (блок отзыва), 7.10 (карточка памяти);
  - образцы reference/src/lib/ai.ts, ai-types.ts, image.ts, student-context.ts, reference/src/components/ai/useTutor.ts, AiPanel.tsx.

Сделать
1. src/lib/ai.ts, ai-types.ts, image.ts, student-context.ts — из reference. Названия навыков и уроков в контексте — на языке ученика.
2. src/components/ai/useTutor.ts и AiPanel.tsx — из reference, тексты из dict.
3. LessonPlayer:
   - «Подсказка» — только пока ученик отвечает;
   - «Объясни, ИИ» — после неверного ответа;
   - «Спроси Пи» — в шапке, и «Непонятно? Спроси Пи» в теории и разборах;
   - быстрые вопросы — по docs/AI.md 5.2;
   - TaskContext — по 5.3.
4. Шаг solution:
   - рисунок на холсте — готовый src/components/lesson/DrawingCanvas.tsx из П-1.9а, свой не делать (холст не размонтируется, для ИИ — exportCanvas()) — или фото тетради + итоговый ответ;
   - unreadable — не ошибка, просьба переснять;
   - без ИИ или при лимите — проверка введённого ответа кодом.
5. Итоги: отзыв наставника запрашивается из обработчика завершения, не из эффекта; memory → setMemory; при сбое — статический текст. /stats — память наставника с кнопкой «Удалить».
6. Ошибки: лимит → «лимит исчерпан», а не «ошибка связи»; неудачный запрос возвращает обращение.
7. src/lib/ai-text.ts: normalizeAiMath по docs/AI.md 8 и тест tests/ai-text.test.ts. Применять к каждому ответу ИИ перед <Markdown> (и во время стрима): AiPanel, отзыв на итогах, память наставника на /stats. Чат /tutor и «В конспект» — в П-2.3.

Можно менять: src/lib/ai.ts, ai-types.ts, image.ts, student-context.ts, src/lib/ai-text.ts, tests/ai-text.test.ts, src/components/ai/*, components/lesson/*, app/(main)/stats/*.
Нельзя: src/server/*, lib/store.ts, dict.ts (недостающее — список в отчёт).

Готово, когда (без ключа):
- кнопки ИИ показывают «ИИ не настроен»;
- урок, итоги и фото-шаг работают, ничего не падает;
- рисунок в шаге solution, сделанный в тёмной теме, уходит в запрос check-solution тёмными штрихами на белом фоне (проверить по картинке из exportCanvas(), например в тесте или в devtools); после смены темы рисунок на холсте виден.
Живая проверка с ключом — в П-2.4.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e (без ключа).
Скриншоты (390×844, светлая и тёмная, ru и kk): шторка «Подсказка» с ответом-заглушкой; шаг solution; итоги с карточкой отзыва.
Документы: CHANGELOG (v0.1.2), ROADMAP (2.2 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-2-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-2.3 (GPT-6.1 Sol · Light).
```

---

### П-2.3 · Чат `/tutor` и конспекты, база (этап 2.3)

**Прораб · GPT-6.1 Sol · Light (меняется стор) · без плана · ветка `etap-2-3` · заранее:** П-2.2 влит.

```text
Задача: сделать чат с наставником на /tutor и базовые конспекты с кнопкой «В конспект» у каждого ответа ИИ. Стор чата — сразу под несколько чатов. Этап 2.3 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-2-3 от main.
- Прочитай: docs/AI.md — 5.1; docs/DESIGN.md — 7.11, 7.12; docs/CONCEPT.md — 6.7, 6.9, 10 (замечания №19–20); docs/ARCHITECTURE.md — 12.

Сделать
1. Стор:
   - chats: массив { id, title, pinned, messages (≤ 60), createdAt } и activeChatId. Интерфейс показывает один чат, список — на этапе 10;
   - notes: ключ (id урока или "general") → { own, saved[] };
   - действия по ARCHITECTURE 12.2;
   - тесты в tests/store.test.ts.
2. /tutor по DESIGN 7.12:
   - стриминг, «Стоп», «Очистить»;
   - фото задачи (сжатие до 1280 px);
   - стартовые чипы по-математически на ru и kk, например «Объясни дроби проще», «Дай задачу на мою слабую тему», «Проверь моё решение по фото».
3. «В конспект» у каждого ответа ИИ — в чате и в шторке урока. Ответы ИИ в чате показываются и сохраняются после normalizeAiMath (src/lib/ai-text.ts из П-2.2, docs/AI.md 8).
4. /notes и /notes/[id] по DESIGN 7.11:
   - конспект урока открывается только после прохождения;
   - «Мои заметки»: автосохранение через 0,5 с и при потере фокуса, ≤ 4000 символов;
   - сохранённые ответы ИИ (≤ 50 на ключ), «Общие заметки».

Нельзя: src/server/*; хранить фото в localStorage (только флаг «было фото»).

Готово, когда:
- без ключа чат показывает «ИИ не настроен» и не падает;
- заметка сохраняется после перезагрузки, последние символы не теряются при быстром уходе;
- ответ ИИ из шторки урока появляется в конспекте урока.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): /tutor пустой и с перепиской-заглушкой; /notes; /notes/<id>.
Документы: CHANGELOG (v0.1.3), ROADMAP (2.3 → ✅ ждёт приёмки), HANDOFF; DECISIONS — структура chats под несколько чатов.
Сдать: коммиты по-русски в etap-2-3, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-2.4 (GPT-6.1 Sol · Medium). Перед ним владелец кладёт ключ в .env.local.
```

---

### П-2.4 · Автопроверка промптов и живая проверка (этап 2.4)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-2-4` · заранее:** владелец создал ключ в проекте OpenAI «matematika» с жёстким лимитом и **сам** вписал его в `.env.local` и в Environment Variables Vercel (Production).

```text
Задача: проверить ИИ-наставника живыми запросами на ru и kk и сделать скрипт автопроверки промптов. Этап 2.4 из docs/ROADMAP.md. Ключ уже лежит в .env.local — не выводи его и не копируй никуда.

Перед началом
- git status чистый; ветка etap-2-4 от main.
- Прочитай: docs/AI.md — 7.5, 11, 12.4, 14.

Сделать
1. scripts/prompt-cases.ts и scripts/check-prompts.mts по docs/AI.md 12.4, npm-скрипт check:prompts.
2. Прогони npm run check:prompts на ru и kk.
   - Провалы чини правкой src/server/prompts.ts строго по чек-листу docs/AI.md 14.
   - Обнови tests/prompts.test.ts.
   - Перепроверь.
3. Замерь токены по логам [ai], включая режим ask (10 запросов). Впиши в docs/AI.md — таблицу замеров.
4. Подготовь для владельца список ручных проверок в приложении: сценарии 1–3, 5, 6, 11–15 из docs/AI.md 7.5 — по шагам, что нажать и что должно получиться.
5. Если в env заданы модели GPT-6 — сравни со старыми прогоном check:prompts и запиши вывод. Модели по умолчанию не меняй без «ок» владельца.

Нельзя: печатать ключ; менять поведение ИИ сверх найденных провалов.

Готово, когда:
- check:prompts — все случаи ok на ru и kk;
- «Подсказка» к log₂(x + 1) + log₂(x + 2) = 1 не называет ни «0», ни «D»;
- на «просто скажи ответ» (дважды) — мягкий отказ;
- kk без русских слов, эмодзи и рода;
- формулы рендерятся;
- в логах Vercel видны строки [ai].

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная, ru и kk): ответ «Подсказки»; ответ чата с системой уравнений.
Документы:
- CHANGELOG (v0.2.0) — каждая правка промпта отдельной строкой: «проверено живыми запросами ru/kk: сценарии …»;
- DECISIONS — модели по умолчанию после проверки;
- docs/AI.md — замеры;
- ROADMAP (этап 2 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-2-4, push, PR в main (не мержить). Отчёт: результаты автопроверки таблицей, список ручных проверок; следующий шаг — Т-9 (вычитка всего kk, GPT-6.1 Sol · Light), затем П-3.1.
```

---

### П-3.1 · Сюжет: три эскиза и паспорт серии «Дроби» (этап 3.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-3-1` · заранее:** этап 2 принят.

```text
Задача: показать владельцу три варианта сквозного сюжета на живых эскизах и написать паспорт серии уроков «Дроби». Этап 3.1 из docs/ROADMAP.md. Уроки пока не пишем.

Перед началом
- git status чистый; ветка etap-3-1 от main.
- Прочитай:
  - docs/LESSON_METHOD.md — 0, 2, 3, 4.2, 12.1 (пример паспорта), 15.1;
  - docs/DESIGN.md — 10, 11.1, 11.4;
  - docs/CONCEPT.md — 10.1;
  - docs/ENT_MATH.md — тема 01 спецификации.

Сделать
1. Страница /dev/sketches/story (robots: noindex, не в меню). Для каждого варианта сюжета из LESSON_METHOD 3.2 — A «Экспедиция Пи по Казахстану», B «Город Пи», C «Лаборатория Пи»:
   - первый шаг story урока 1.2;
   - последний шаг story урока 1.2 с мостиком к следующему;
   - как выглядит продвижение по разделу (одна строка: остановки / объекты / двери);
   - настоящие компоненты: Пи, Card, простые SVG.
   Тексты эскизов — ru и kk, как в настоящем уроке.
2. docs/tasks/series-fractions.md — паспорт серии «Дроби» 1.1–1.5 (список — LESSON_METHOD, раздел 12). На каждый урок:
   - id, навык, название ru/kk;
   - главная мысль, мост «известное → новое», ловушки;
   - задания ЕНТ;
   - нужные сцены и песочницы;
   - урок 1.2 — готовый образец num-2-frac-add.
3. До 5 вопросов владельцу (выбор сюжета, правки паспорта).

Нельзя: писать файлы уроков; менять lib/types.ts.

Готово, когда:
- владелец выбрал сюжет — запиши в DECISIONS;
- владелец утвердил паспорт или правки внесены.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная, ru и kk): /dev/sketches/story, каждый вариант.
Документы: CHANGELOG (v0.2.1), ROADMAP (3.1 → ✅ ждёт приёмки), HANDOFF; DECISIONS — выбранный сюжет и почему.
Сдать: коммиты по-русски в etap-3-1, push, PR в main (не мержить). Отчёт: три варианта в двух строках каждый, вопросы; следующий шаг — П-3.2 (GPT-6.1 Sol · Medium).
```

---

### П-3.2 · Сцены и песочница для дробей (этап 3.2)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-3-2` · заранее:** П-3.1 принят, сюжет выбран.

```text
Задача: сделать сцены и песочницу, на которых держится серия «Дроби»: полоски и «пицца» дробей, «режем на равные доли», таблица, иллюстрации выбранного сюжета. Этап 3.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-3-2 от main.
- Прочитай:
  - docs/LESSON_METHOD.md — 8 (особенно 8.3), 12.2;
  - docs/ARCHITECTURE.md — 3.1 (строка «Вид сцены»), 4.2, 16;
  - docs/DESIGN.md — 2.7, 11.1, 11.4;
  - docs/DECISIONS.md — выбранный сюжет;
  - docs/tasks/series-fractions.md.

Сделать
1. Типы сцен fractions, table, quest (арты выбранного сюжета) и песочницы tool "fraction" (init, aligned) — в lib/types.ts, по LESSON_METHOD 8.3.
2. components/scenes:
   - SceneView (диспетчер);
   - FractionBar, FractionPie, TableScene, QuestScene;
   - explore/FractionTool;
   - logic.ts — чистые расчёты: доли, общий знаменатель, цель песочницы.
   Все числа на схеме считает logic.ts, цвета — токены (DESIGN 2.7), анимации ≤ 400 мс.
3. validateScene в tests/validate.ts, tests/scenes.test.ts. describeScene — текст сцены для ИИ на ru и kk (docs/AI.md 13).
4. Песочница explore в плеере: «Продолжить» закрыто, пока цель не достигнута.
5. На /dev — раздел «Сцены».

Нельзя: картинки вместо SVG; числа на схеме, введённые руками автором.

Готово, когда (на /dev, 390 px):
- полоски ½ и ⅓ режутся на равные доли до цели (шестые), «Продолжить» открывается;
- схемы читаются в тёмной теме и на 360 px.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844 и 360×640, светлая и тёмная): раздел «Сцены» на /dev, песочница до и после цели.
Документы: CHANGELOG (v0.2.2), ROADMAP (3.2 → ✅ ждёт приёмки), HANDOFF; DECISIONS — сцена fractions и песочница fraction; ARCHITECTURE 4.2 — новые виды сцен.
Сдать: коммиты по-русски в etap-3-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-3.3 (GPT-6.1 Sol · Light).
```

---

### П-3.3 · Урок-образец `num-2-frac-add` (этап 3.3)

**Прораб · GPT-6.1 Sol · Light (перенос готового образца, но правит реестры) · без плана · ветка `etap-3-3` · заранее:** П-3.2 влит, ключ в `.env.local` (для `review:kk`).

```text
Задача: перенести в проект урок-образец «Сложение и вычитание дробей с разными знаменателями» (num-2-frac-add) с тестом, регистрацией и генератором навыка и довести его до приёмки. Этап 3.3 из docs/ROADMAP.md. Это урок, по которому владелец принимает методику.

Перед началом
- git status чистый; ветка etap-3-3 от main.
- Прочитай: docs/LESSON_METHOD.md — 12 (целиком), 14, 16; docs/ARCHITECTURE.md — 3.1; docs/DECISIONS.md — сюжет и сцены.

Сделать
1. src/content/lessons/num-2-frac-add.ts — из LESSON_METHOD 12.3.
   - Имена типов и полей сверь с ARCHITECTURE: при расхождении главнее ARCHITECTURE, смысл не менять.
   - Арты сюжета — под выбранный вариант.
2. tests/lessons/num-2-frac-add.test.ts — из 12.5: своя мини-арифметика на BigInt, а не lib/math.
3. Общие проверки из LESSON_METHOD 14 («предлагаю добавить») — в tests/validate.ts:
   - каждое «=» в формулах — правда;
   - формулы ru и kk совпадают;
   - ≤ 8 вопросов, уровни не убывают.
4. Регистрация по 12.4: skills.ts, course.ts (status "available"), генератор num.frac-add в src/lib/bank/num.ts, если его ещё нет.
5. npm run review:kk → правки сверь с docs/ENT_MATH.md (раздел 4) и LESSON_METHOD 11. Примени обоснованные, остальные отклони с причиной.
6. Пройди урок Playwright-скриптом: каждое задание — нарочно неверный ответ. Объяснение видно целиком, не обрезано клавиатурой.

Нельзя: менять методику урока (число шагов, порядок, ловушки) без «ок» владельца; удалять id шагов.

Готово, когда:
- тест урока и npm test зелёные;
- урок открывается с /learn и проходится на ru и kk, в светлой и тёмной теме;
- формулы не вылезают за 360 px;
- «Спроси Пи» на нерешённом задании не называет ответ;
- шаг 13 (развёрнутое решение) проверяется по фото.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): шаги 1, 3, 5, 7, 12, 14, 15 и панель ошибки на шаге 9.
Документы: CHANGELOG (v0.2.3: «вычитано моделью, носителем — нет: принято N, отклонено M»), ROADMAP (3.3 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-3-3, push, PR в main (не мержить). Отчёт: как пройти урок на телефоне и на что смотреть (понятно ли, интересно ли, не мелко ли); следующий шаг — приёмка владельцем, замечания через Т-11. Когда владелец сказал «понятно и интересно» — Т-6 вливает PR и пишет в CHANGELOG v0.3.0 «этап 3 принят», ROADMAP (этап 3 → ✅).
```

---

### П-3.4 · Видео-лаборатория: один ролик в 4 стилях (этап 3.4, по желанию)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `video-lab` (никогда не вливать в `main`) · заранее:** ключ в `.env.local`; `ffmpeg` установлен (иначе ролики без звука).

```text
Задача: сделать один и тот же обучающий ролик в 4 визуальных стилях, чтобы владелец посмотрел их на телефоне и выбрал стиль для всех будущих видео. Озвучка и сценарий у всех вариантов одинаковые — отличается только визуал. Этап 3.4 из docs/ROADMAP.md. Так в Informatica выбирали стиль: прошлый ролик был «непростой и нежизненный».

Перед началом
- git status чистый; ветка video-lab от main. В main не вливать, PR не создавать.
- Прочитай:
  - docs/ARCHITECTURE.md — 17;
  - docs/LESSON_METHOD.md — 9.4, 15.3;
  - docs/AI.md — 12.2, 12.3;
  - docs/DESIGN.md — 11.10;
  - reference/scripts/generate-voiceover.mts.

Шаг 1 — сценарий (до кода, жди «ок» владельца)
docs/tasks/video-lab.md:
- тема «Сложение дробей с разными знаменателями», 60–90 с, ru;
- таблица «такт | озвучка | что обязательно в кадре». Каждый такт — отдельный mp3. Числа и формулы в озвучке — словами;
- главное — решение вживую по шагам: шаг появляется, когда о нём говорит голос, предыдущие остаются на экране;
- жизненный крючок из выбранного сюжета; ловушка «½ + ⅓ = 2/5»; задание «теперь сам» с паузой.

Шаг 2 — после «ок»
1. 4 стиля, каждый — отдельная Remotion-композиция 1080×1080, 30 fps:
   - cartoon — мультфильм-квест с Пи;
   - board — доска и рука: рукописный шрифт с ә ғ қ ң ө ұ ү һ і;
   - notebook — тетрадь в клетку, как черновик на ЕНТ;
   - motion — чистая моушн-графика без персонажей.
2. Цифры в кадре ≥ 56 px, подписи ≥ 40 px. Цвета по смыслу: зелёный — ответ, красный — ловушка, голубой — выделение, золотой — награда. Фиолетовый не использовать — он за ИИ.
3. Файлы: src/videos/lab/* (script.ts, <стиль>/Video.tsx, shared/, registry.ts). Страница src/app/video-lab/page.tsx (robots: noindex, не в меню): плеер @remotion/player на каждый стиль, переключатель субтитров.
4. Озвучка: перенеси reference/scripts/generate-voiceover.mts в scripts/ по docs/AI.md 12.2 (инструкция голоса — «учитель математики», нужен ffprobe) и добавь npm-скрипт voiceover из ARCHITECTURE 2.2. npm run voiceover → public/media/videos/lab/. Перед генерацией проверь, какая TTS-модель актуальна: снапшоты gpt-4o-mini-tts объявлены устаревшими, отключение 06.01.2027.
   - Каждый mp3 проверь обратной расшифровкой: сделай scripts/verify-voiceover.mts и npm-скрипт voiceover:verify по docs/AI.md 12.3.
   - Ключа нет — ролики без звука с длительностями по умолчанию, и прямо напиши об этом.
5. MP4 не рендерим: ролик играет в браузере (так дёшево, и так должно остаться).

Нельзя: менять существующие страницы, уроки и стили приложения; новые зависимости, кроме @remotion/* той же версии, что remotion.

Готово, когда: на /video-lab все 4 ролика проигрываются до конца на 390 px, визуал совпадает с голосом по тактам, в консоли нет ошибок.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты: по кадру из середины каждого стиля (1080×1080).
Документы:
- docs/tasks/video-lab.md — по каждому стилю: как сделан, плюсы и минусы, сколько стоит следующий ролик в этом стиле, как он будет выглядеть на kk;
- HANDOFF.
Сдать: коммиты по-русски в video-lab, push (без PR). Отчёт: путь /video-lab в превью; что получилось и что нет (голос, расшифровка). Выбранный стиль владелец записывает в DECISIONS (через Т-7).
```

---

### П-4.1 · План раздела (этап 4, на каждый раздел)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `section-<id>-plan` · заранее:** этап 3 принят; для нового раздела — предыдущий наполнен или владелец решил идти параллельно.

```text
Задача: спланировать раздел курса «<название раздела>» (id <id раздела>): серии, уроки, навыки, генераторы, нужные сцены и песочницы. Этап 4 из docs/ROADMAP.md. Уроки пока не пишем.

Перед началом
- git status чистый; ветка section-<id>-plan от main.
- Прочитай:
  - docs/ENT_MATH.md — темы спецификации этого раздела и примеры из демо;
  - docs/CONCEPT.md — 6.3 (таблица разделов);
  - docs/LESSON_METHOD.md — 1.2, 1.4, 4.2, 6.3, 7.5, 8.2, 15;
  - docs/ARCHITECTURE.md — 4.4 (id);
  - docs/DECISIONS.md — сюжет, принятые виды шагов и сцен.

Сделать
1. docs/tasks/section-<id>.md:
   - серии → уроки: id, название ru/kk, навык, тип темы (расчётная или на знание), 5–7 мин;
   - на каждый навык — параметры уровней A/B/C генератора и типичные ошибки (источник неверных вариантов);
   - какие новые сцены, песочницы, виды шагов нужны — каждый пойдёт в Т-3 до первого урока;
   - таблица покрытия «тема спецификации → уроки», чтобы ничего из ЕНТ не выпало;
   - порядок уроков и что можно писать параллельно.
2. course.ts: уроки раздела в UNITS со статусом "soon" (видны на карте с замком).
3. До 5 вопросов владельцу.

Нельзя: писать уроки и генераторы в этой задаче.

Готово, когда: владелец утвердил план (или внесены его правки).

Проверка: npm run typecheck && npm run lint && npm test && npm run build. Скриншоты не нужны.
Документы: ROADMAP (этап 4 — список уроков раздела со статусами ⏳), CHANGELOG, HANDOFF; DECISIONS — если появились новые решения.
Сдать: коммиты по-русски, push, PR в main (не мержить). Отчёт: план одной таблицей, вопросы; дальше — Т-3 (если нужны сцены), затем Т-1 на каждый урок.
```

---

### П-5.1 · Эскизы: карта курса и экран «как на ЕНТ» (этап 5.1)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-5-1` · заранее:** этап 3 принят.

```text
Задача: показать владельцу эскизы трёх вариантов карты курса и экрана «как на ЕНТ», чтобы он выбрал до вёрстки. Этап 5.1 из docs/ROADMAP.md. В образце карта «кружочками вниз» оказалась слишком простой — поэтому сначала эскизы.

Перед началом
- git status чистый; ветка etap-5-1 от main.
- Прочитай:
  - docs/CONCEPT.md — 6.3, 6.12;
  - docs/DESIGN.md — 2.6, 7.2, 7.15;
  - docs/ENT_MATH.md — формат «Математики» и официальные инструкции НЦТ к типам заданий (ru и kk);
  - docs/DECISIONS.md — сюжет.

Сделать
1. /dev/sketches/map (noindex) — три карты на настоящих UNITS обоих треков, цветах разделов и состояниях узлов (пройден / доступен / скоро / текущий), 390 px:
   - «Путешествие» — местности разделов под выбранный сюжет;
   - «Метро» — линии-разделы, станции-уроки;
   - «Карта ЕНТ» — плитки тем, размер — по весу темы, цвет — по освоению. Веса — ориентир по одной демоверсии, официальных весов НЦТ нет — подпиши это.
2. /dev/sketches/ent — экран задания по DESIGN 7.15:
   - «Вопрос 12 / 40», таймер, инструкция НЦТ, 6 вариантов;
   - навигатор номеров;
   - экран итогов с баллом и разбором.
3. Вопросы владельцу: какая карта; показывать ли таймер в мини-ЕНТ; сколько XP за мини-ЕНТ; где вход в «Теорию».

Нельзя: менять настоящие /learn и плеер.

Готово, когда: владелец выбрал карту и одобрил экран ЕНТ — решения в DECISIONS.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная, ru и kk): каждая карта, экран ЕНТ, итоги.
Документы: CHANGELOG, ROADMAP (5.1 → ✅ ждёт приёмки), HANDOFF; DECISIONS — после ответов.
Сдать: коммиты по-русски в etap-5-1, push, PR в main (не мержить). Отчёт: плюсы и минусы каждой карты в 2 строках, вопросы; следующий шаг — П-5.2 (GPT-6.1 Sol · Medium).
```

---

### П-5.2 · Карта и главная (этап 5.2)

**Прораб · GPT-6.1 Sol · Medium (нужны строки в словаре) · без плана · ветка `etap-5-2` · заранее:** П-5.1 принят.

```text
Задача: сверстать выбранную карту курса и главную «Учиться» с двумя треками. Этап 5.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-5-2 от main.
- Прочитай: docs/DECISIONS.md — выбранная карта; /dev/sketches/map (код эскиза); docs/DESIGN.md — 7.2, 2.6; docs/CONCEPT.md — 6.3.

Сделать
1. Компонент карты выбранного вида: данные — UNITS и прогресс из стора, состояния узлов по DESIGN 7.2.
2. Переключатель треков «Математика» / «Математическая грамотность» (TRACKS). У каждого трека свой прогресс.
3. По тапу на узел — Modal: описание, «Начать» / «Повторить», для «скоро» — иконка Hammer.
4. /learn:
   - приветствие Пи;
   - карточка следующего урока («герой»);
   - цель дня;
   - «Что подтянуть в первую очередь» (слабые навыки → /drill?mode=smart);
   - карта.
   Временный список уроков из П-1.7б убрать.
5. Прогноз балла ЕНТ — только если формула уже есть в DECISIONS; иначе не рисовать (этап 11).
6. e2e: smoke-путь идёт через карту.

Нельзя: менять структуру стора и типов без записи в DECISIONS; русские строки в компонентах (новые — в dict.ts на ru и kk).

Готово, когда:
- карта работает на 360 px без горизонтальной прокрутки, узлы ≥ 56 px;
- видны оба трека, у разделов свои цвета;
- текущий урок помечен «Начать».

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (360×640, 390×844, 1280 px; светлая и тёмная; ru и kk): /learn.
Документы: CHANGELOG, ROADMAP (5.2 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-5-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-5.3 (GPT-6.1 Sol · Medium).
```

---

### П-5.3 · Режимы урока, свободный режим, «Сдать экстерном» (этап 5.3)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-5-3` · заранее:** П-5.2 влит.

```text
Задача: дать ученику выбор, как проходить урок, и свободный переход между темами. Этап 5.3 из docs/ROADMAP.md (замечания образца №14–15).

Перед началом
- git status чистый; ветка etap-5-3 от main.
- Прочитай: docs/CONCEPT.md — 6.13; docs/ARCHITECTURE.md — 4.3, 5, 12; docs/DECISIONS.md.

Сделать
1. Перед уроком — выбор режима:
   - «Учиться» — весь урок;
   - «Проверить себя» — только задания;
   - «Только теория» — только информационные шаги;
   - «Игрой» — скрыт, пока нет игр (этап 6).
   Плеер фильтрует шаги по виду. Выбор запоминается в профиле.
2. Свободный режим: замок на карте значит только «в разработке», порядок не обязателен.
3. «Сдать экстерном» — короткий тест из банка по навыкам урока. Сдал — урок засчитан.
   - Число заданий, порог и XP предложи и после «ок» запиши в DECISIONS.
   - Условия засчитывания — в чистой функции с тестом.
4. Стор и статистика различают «пройден» и «сдан экстерном», если это нужно для XP и достижений.

Нельзя: ломать сохранённый прогресс (merge новых полей; при несовместимости — version + migrate с тестом).

Готово, когда:
- режим выбирается, «Только теория» проходится без заданий;
- «Сдать экстерном» засчитывает урок при сданном тесте и не засчитывает при несданном.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): выбор режима; итог экстерна.
Документы: CHANGELOG, ROADMAP (5.3 → ✅ ждёт приёмки), HANDOFF; DECISIONS — режимы и экстерн; ARCHITECTURE — изменения модели.
Сдать: коммиты по-русски в etap-5-3, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-5.4 (GPT-6.1 Sol · Light).
```

---

### П-5.4 · «Теория» и повторение (этап 5.4)

**Прораб · GPT-6.1 Sol · Light (нужны строки в словаре) · без плана · ветка `etap-5-4` · заранее:** П-5.3 влит.

```text
Задача: сделать раздел «Теория» (справочник с поиском) и повторение «остывающих» тем. Этап 5.4 из docs/ROADMAP.md (замечание образца №16).

Перед началом
- git status чистый; ветка etap-5-4 от main.
- Прочитай: docs/CONCEPT.md — 6.13, 8.4; docs/DECISIONS.md — где вход в «Теорию»; docs/ARCHITECTURE.md — 9.2 (buildDrill).

Сделать
1. «Теория» — вход по решению из DECISIONS:
   - по разделам: теория, разборы (worked) и конспекты пройденных и доступных уроков, справочник формул;
   - поиск по ru и kk по тексту без Markdown и LaTeX (plain).
2. src/lib/review.ts — чистая функция: какие навыки «остыли» по lastSeen (1, 3, 7… дней), тест.
3. Карточка «Повторить · 3 мин» на /learn → тренировка «повторение» из 4–6 заданий по остывшим навыкам. Режим drill: review.

Можно менять: новые файлы раздела «Теория», src/lib/review.ts, tests/review.test.ts, app/drill/*, app/(main)/learn/*, dict.ts (новые ключи ru и kk).
Нельзя: менять структуру стора без записи в DECISIONS.

Готово, когда:
- поиск находит «дробь» на ru и «бөлшек» на kk;
- навык, не повторявшийся N дней (подставь дату в тесте), попадает в повторение.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): «Теория» с поиском, карточка повторения.
Документы: CHANGELOG, ROADMAP (5.4 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-5-4, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-5.5 (GPT-6.1 Sol · Medium).
```

---

### П-5.5 · Режим «как на ЕНТ» и мини-ЕНТ (этап 5.5)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-5-5` · заранее:** П-5.4 влит; экран ЕНТ утверждён в П-5.1.

```text
Задача: сделать мини-ЕНТ — 10 заданий в настоящих форматах ЕНТ в условиях экзамена: без ИИ, только калькулятор и черновик, правильность видна только в конце. Этап 5.5 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-5-5 от main.
- Прочитай:
  - docs/ENT_MATH.md — формат «Математики», таблица баллов п. 18, официальные инструкции НЦТ ru/kk;
  - docs/CONCEPT.md — 6.12;
  - docs/DESIGN.md — 7.15;
  - docs/ARCHITECTURE.md — 10;
  - docs/AI.md — 5.4;
  - docs/DECISIONS.md — решения П-5.1.

Сделать
1. lib/ent.ts:
   - состав мини-ЕНТ (10 заданий из банка: «один ответ» с 4 вариантами, «несколько ответов» с 6 вариантами и 1–3 верными, «соответствие» 2 × 4). Пропорцию предложи — DECISIONS;
   - баллы entPoints / multiPoints / assignPoints;
   - тесты: детерминизм по seed, форматы, максимум баллов.
2. Экран по эскизу:
   - «Вопрос N / 10»;
   - мягкий таймер (ориентир 2 мин на задание, последние 5 минут — text-warning-strong);
   - инструкция НЦТ к типу задания на ru/kk;
   - навигатор номеров;
   - «Далее» / «Назад».
3. Условия экзамена:
   - useToolboxLevel("ent");
   - ни одной кнопки ИИ, AiPanel не монтируется;
   - после ответа нет зелёного и красного.
4. Итоги: балл крупно, разбор по номерам (success / warning / danger), ИИ-объяснение — только после разбора, по кнопке. XP — по DECISIONS.
5. e2e: нет кнопок ИИ, в «Помощниках» только калькулятор и черновик.

Нельзя: показывать правильность до конца; давать справочник формул.

Готово, когда:
- 10 заданий проходятся на телефоне;
- «несколько ответов» оценивается 2/1/0 по таблице п. 18 (в отчёте — 3 ручных примера и баллы приложения);
- нет ИИ, только калькулятор и черновик;
- в конце — балл и разбор.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): задание multi, навигатор, итоги с разбором.
Документы: CHANGELOG (v0.5.0), ROADMAP (этап 5 → ✅ ждёт приёмки), HANDOFF; DECISIONS — состав мини-ЕНТ, XP.
Сдать: коммиты по-русски в etap-5-5, push, PR в main (не мержить). Отчёт: чек-лист приёмки этапа 5; следующий шаг — по ROADMAP (этап 6, если в курсе 2–3 темы с банками, иначе контент-поток).
```

---

### П-6.1 · Фундамент мини-игр (этап 6.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-6-1` · заранее:** выполнено условие старта из `docs/GAMES.md`, 14.1. Форма `trace` заранее не нужна: тип делает этот промпт, шаблоны `trace` у 3+ навыков — исполнитель `bug-hunt` (Т-4б) или Т-2, до П-6.3.

```text
Задача: подготовить всё общее для мини-игр, чтобы 4 исполнителя могли параллельно делать игры, не трогая общие файлы. Этап 6.1 из docs/ROADMAP.md, шаг 1 таблицы docs/GAMES.md 14.2.

Перед началом
- git status чистый; ветка etap-6-1 от main.
- Прочитай:
  - docs/GAMES.md — 0–7, 14.1–14.2, 15;
  - reference/src/games/types.ts, reference/src/lib/games.ts.

Сделать — строка «Фундамент» в GAMES 14.2:
1. src/games/types.ts (из reference без изменений) и src/lib/games.ts.
2. src/lib/game-pool.ts + тест.
3. Форма trace в lib/bank/types.ts + tests/helpers/trace.ts.
4. GameShell.
5. src/games/registry.ts и src/games/components.ts (пустые), src/app/game/[id]/page.tsx.
6. Плитки игр на /practice.
7. Ключи game.* / games.* в dict.ts.
8. ignoreKey с data-keypad.
9. Каркас e2e/games.spec.ts.
10. Три темпа по GAMES 5:
   - Спокойно → «Помощники» full;
   - Обычный → ent;
   - Блиц → off.
11. Игра в стор не пишет — только GameShell.

Нельзя: делать сами игры (это исполнители).

Готово, когда: npm test зелёный; пустой реестр не ломает /practice.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e. Скриншоты не нужны.
Документы: CHANGELOG, ROADMAP (6.1 → ✅), HANDOFF; DECISIONS — game-pool, форма trace.
Сдать: коммиты по-русски в etap-6-1, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-6.2 (GPT-6.1 Sol · Medium).
```

---

### П-6.2 · ТЗ на 4 игры волны 1 (этап 6.2)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-6-2` · заранее:** П-6.1 влит.

```text
Задача: написать для исполнителей ТЗ на 4 игры волны 1 — pi-rush, sign-flip, math-sort, bug-hunt. Этап 6.2 из docs/ROADMAP.md, шаг 2 таблицы docs/GAMES.md 14.2.

Перед началом
- git status чистый; ветка etap-6-2 от main.
- Прочитай: docs/GAMES.md — 1, 2, 5–8, 9–12 (ТЗ игр), 14.3, 14.4, 15; текущие src/games/types.ts, src/lib/game-pool.ts, src/lib/bank/types.ts.

Сделать: docs/tasks/game-<id>.md для каждой из 4 игр. В каждом:
- раздел игры из GAMES.md, уточнённый под текущий код (точные импорты и функции банка);
- «Можно менять»: src/games/<id>/*, tests/games/<id>.test.ts. Для bug-hunt — ещё шаблоны trace в файлах банка тем;
- «Нельзя»: types.ts, registry.ts, components.ts, GameShell, lib/*, dict.ts, store;
- строки ru/kk целиком (из GAMES.md) — исполнитель не выдумывает свои;
- «Готово, когда»;
- список рисков 14.3;
- готовый промпт исполнителя (Т-4б) с подставленным id.

Нельзя: писать код игр.

Готово, когда: 4 файла ТЗ; исполнитель может работать, не задавая вопросов.

Проверка: кода нет — git diff --stat.
Документы: ROADMAP (6.2 → ✅), HANDOFF (какие 4 чата открыть и на каких моделях).
Сдать: коммит по-русски в etap-6-2, push, PR в main; после слияния — 4 чата Т-4б, каждый в своём worktree и своей ветке game-<id>.
```

---

### П-6.3 · Интеграция и ревью игр волны 1 (этап 6.3)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `etap-6-3` · заранее:** 4 ветки `game-<id>` готовы, тесты в них зелёные.

```text
Задача: собрать 4 игры волны 1 в приложение, провести ревью по списку рисков и подготовить приёмку. Этап 6.3 из docs/ROADMAP.md, шаги 4–6 таблицы docs/GAMES.md 14.2.

Перед началом
- git status чистый; ветка etap-6-3 от main; влей в неё ветки game-pi-rush, game-sign-flip, game-math-sort, game-bug-hunt.
- Прочитай: docs/GAMES.md — 14.3, 15.

Сделать
1. Строки в registry.ts и components.ts; id в e2e/games.spec.ts. На 360 px нет горизонтальной прокрутки.
2. /review против main, фокус — риски из GAMES 14.3:
   - двойные тапы, Enter;
   - таймеры и размонтирование;
   - повторный onFinish;
   - игра пишет в стор;
   - деление на 0;
   - равные по значению варианты;
   - формулы шире 360 px;
   - строки kk;
   - «Меньше анимаций».
   Исправь найденное.
3. npm run review:kk по строкам игр — правки по правилам Т-9.
4. e2e/games-full.spec.ts по GAMES 15 («полный проход случайным игроком»): каждая игра × 3 темпа, page.clock, до итогов; XP начислен один раз и не выше лимита; рекорд — только в «Обычном» и «Блице»; без pageerror.

Нельзя: менять механику игры без записи в DECISIONS.

Готово, когда:
- все 4 игры видны на /practice;
- чек-лист GAMES 15 пройден, кроме пунктов «глазами» — их перечисли владельцу.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (360×640 и 390×844, светлая и тёмная, ru и kk): вступление, игра, итоги — каждой игры.
Документы: CHANGELOG (v0.6.0, «вычитано моделью, носителем — нет»), ROADMAP (6.3 → ✅ ждёт приёмки), HANDOFF; DECISIONS — отличия чисел темпа от образца.
Сдать: коммиты по-русски в etap-6-3, push, PR в main (не мержить). Отчёт: таблица «игра → найдено ревью → исправлено»; что владельцу сыграть (все темпы на телефоне). Волны 1б и 2 — через Т-4.
```

---

### П-7.1 · Трек «Математическая грамотность»: план и сцены данных (этап 7.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-7-1` · заранее:** разделы 1–2 трека «Математика» готовы.

```text
Задача: спланировать второй трек «Математическая грамотность» и сделать сцены для диаграмм и таблиц. Этап 7.1 из docs/ROADMAP.md. Трек работает на том же движке и банке.

Перед началом
- git status чистый; ветка etap-7-1 от main.
- Прочитай:
  - docs/ENT_MATH.md — раздел про «Математическую грамотность»: формат, темы, демо;
  - docs/CONCEPT.md — 6.3;
  - docs/DESIGN.md — 2.6 (цвета разделов трека), 11.8;
  - docs/ARCHITECTURE.md — 4.4, 10 (ENT_FORMAT), 16.

Сделать
1. docs/tasks/track-literacy.md:
   - 4 раздела по спецификации → уроки (id, название ru/kk, навык lit.*);
   - генераторы: уровни A/B/C, типичные ошибки;
   - что уже есть в треке «Математика» (проценты, прогрессии, площади) — переиспользовать, не дублировать.
2. Сцены: круговая и столбчатая диаграммы, таблица частот, гистограмма, фигура из кубов.
   - Числа и подписи считает logic.ts: проценты складываются в 100 %, запятая.
   - validateScene, tests/scenes.test.ts, describeScene ru/kk; раздел на /dev.
3. course.ts: разделы трека (уроки "soon").
4. ENT_FORMAT.literacy.options — настройка. В демо НЦТ 4 варианта, на странице НЦТ написано «из пяти» — проверить; по умолчанию 4.

Нельзя: писать уроки трека в этой задаче (они — через Т-1).

Готово, когда:
- владелец утвердил план;
- диаграммы читаются на 360 px в обеих темах.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (360×640, светлая и тёмная, ru и kk): сцены на /dev.
Документы: CHANGELOG, ROADMAP (7.1 → ✅ ждёт приёмки; список уроков трека), HANDOFF; DECISIONS — id трека и разделов, число вариантов.
Сдать: коммиты по-русски в etap-7-1, push, PR в main (не мержить). Отчёт: план таблицей, вопросы; дальше — Т-1 на каждый урок, потом П-7.2.
```

---

### П-7.2 · Мини-тест трека и карта двух треков (этап 7.2)

**Прораб · GPT-6.1 Sol · Light (меняются ENT_FORMAT и словарь) · без плана · ветка `etap-7-2` · заранее:** в треке есть хотя бы по 1 уроку в каждом разделе.

```text
Задача: сделать мини-тест «Математическая грамотность» на движке мини-ЕНТ и довести карту трека. Этап 7.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-7-2 от main.
- Прочитай: docs/ENT_MATH.md — формат «Математической грамотности»; код мини-ЕНТ (этап 5.5); docs/DECISIONS.md.

Сделать
1. Мини-тест трека: 10 заданий «один ответ» (число вариантов — ENT_FORMAT.literacy.options), по 1 баллу, ориентир ~20 минут. Условия как на ЕНТ: без ИИ, только калькулятор и черновик.
2. Карта: прогресс трека отдельно, переключатель сохраняет выбор.
3. Тесты состава мини-теста (детерминизм, максимум 10 баллов).

Нельзя: копировать код экрана ЕНТ — переиспользуй его через параметры трека.

Готово, когда: мини-тест проходится на телефоне; балл из 10; переключение треков сохраняет прогресс каждого.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): карта трека, задание мини-теста, итоги.
Документы: CHANGELOG (v0.7.0), ROADMAP (этап 7 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-7-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-8.1 (GPT-6.1 Sol · High).
```

---

### П-8.1 · Облако: план и решение (этап 8.1)

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `etap-8-1` · заранее:** этап 6 принят (или владелец решил начать раньше).

```text
Задача: подготовить решение о входе через Google и хранении прогресса в облаке. Без кода: план, варианты, шаги для владельца. Этап 8.1 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-8-1 от main.
- Прочитай: docs/ARCHITECTURE.md — 1, 12, 20, 21; docs/AI.md — 9.2, 15; docs/CONCEPT.md — 6.7, 6.9; docs/DECISIONS.md.

Сделать: docs/tasks/cloud.md:
1. Варианты. В плане образца — Supabase (вход и Postgres, бесплатный тариф) — плюс 1–2 альтернативы. Сравнить:
   - вход через Google;
   - база и хранение фото;
   - защита данных по пользователю;
   - работа с Vercel;
   - бесплатные лимиты и цена при росте — с официальных страниц, с датой проверки; не нашёл — «проверить».
2. Модель данных: что в облаке (профиль, навыки, уроки, ошибки, дни, достижения, конспекты, чаты, фото), что остаётся на устройстве.
3. Синхронизация:
   - правила слияния (XP, серия, освоение, ошибки);
   - перенос локального прогресса при первом входе;
   - выход из аккаунта;
   - работа без сети;
   - удаление аккаунта и выгрузка данных.
4. Интерфейс действий стора не меняется (правило образца).
5. Переменные окружения: какие секретные (только сервер), какие нет.
6. Шаги владельца по кнопкам: создать проект, настроить вход Google, где взять ключи, куда вписать (Vercel).
7. Данные учеников: минимум (имя без фамилии, без телефона). Требования закона РК о персональных данных несовершеннолетних в наборе не изучались — отметь как «проверить до запуска».
8. Риски и план отката.

Нельзя: код, установка пакетов, регистрация в сервисах.

Готово, когда: владелец выбрал вариант — решение в DECISIONS.

Проверка: кода нет — git diff --stat.
Документы: DECISIONS (после выбора), ROADMAP (8.1 → ✅), HANDOFF.
Сдать: коммит по-русски в etap-8-1, push, PR в main. Отчёт: сравнение таблицей, рекомендация, что сделать владельцу; следующий шаг — П-8.2 (GPT-6.1 Sol · Medium).
```

---

### П-8.2 · Вход через Google и синхронизация (этап 8.2)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-8-2` · заранее:** владелец создал проект выбранного сервиса и вход Google по шагам из П-8.1 и вписал ключи в `.env.local` и Vercel.

```text
Задача: сделать вход через Google и синхронизацию прогресса по решению docs/tasks/cloud.md. Этап 8.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-8-2 от main.
- Прочитай: docs/tasks/cloud.md; docs/DECISIONS.md (решение по облаку); docs/ARCHITECTURE.md — 12, 21.

Сделать
1. Вход через Google и выход; профиль показывает «вошли как …» вместо «данные на этом устройстве».
2. Слой синхронизации за действиями стора. Компоненты и интерфейс действий не меняются.
3. Первый вход: локальный прогресс переносится по правилам слияния из cloud.md.
4. Без входа и без сети всё работает, как раньше.
5. Секретные ключи — только на сервере. Данные из облака — недоверенные: санитизация.
6. Тесты: правила слияния (чистые функции), перенос старого сохранения. e2e без настоящего облака: заглушка или флаг.

Нельзя: менять интерфейс действий стора; терять локальный прогресс.

Готово, когда:
- телефон A: вход → урок; телефон B с тем же аккаунтом видит тот же XP, серию и урок;
- старый локальный прогресс не пропал при первом входе;
- после выхода приложение работает.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): профиль до и после входа.
Документы: CHANGELOG, ROADMAP (8.2 → ✅ ждёт приёмки), HANDOFF; ARCHITECTURE — слой хранения, env; DECISIONS — отличия от плана.
Сдать: коммиты по-русски в etap-8-2, push, PR в main (не мержить). Отчёт: сценарий проверки на двух устройствах; следующий шаг — П-8.3 (GPT-6.1 Sol · Medium).
```

---

### П-8.3 · Лимиты ИИ на аккаунт и серверный бюджет (этап 8.3)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-8-3` · заранее:** П-8.2 влит; владелец создал Redis (Upstash или Vercel KV) и отдельный боевой ключ OpenAI и сам вписал их в Vercel.

```text
Задача: перевести лимиты ИИ с IP и браузера на аккаунт и добавить серверный дневной бюджет. Этап 8.3 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-8-3 от main.
- Прочитай: docs/AI.md — 9.2, 15; src/server/rate-limit.ts; docs/DECISIONS.md.

Сделать
1. Счётчики в Redis:
   - лимит обращений на аккаунт в день;
   - для гостя — на анонимный id устройства + IP.
   Лимит в памяти процесса остаётся запасным для разработки.
2. Серверный дневной бюджет токенов на весь проект. Превышен → 503 ai_budget, ученик видит «ИИ отдыхает до завтра», остальное работает.
3. Клиентский лимит 60 в день становится подсказкой, а не защитой.
4. Тесты с заглушкой Redis.

Нельзя: печатать ключи; отключать лимит по IP до готовности нового.

Готово, когда:
- лимит одинаковый на любом устройстве одного аккаунта и не обходится очисткой браузера;
- при исчерпанном бюджете — понятное сообщение, урок работает.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, ru и kk): сообщение «лимит исчерпан» и «ИИ отдыхает».
Документы: CHANGELOG (v0.8.0), ROADMAP (этап 8 → ✅ ждёт приёмки), HANDOFF; DECISIONS — лимиты и бюджет; docs/AI.md — раздел защиты.
Сдать: коммиты по-русски в etap-8-3, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-9.1 (GPT-6.1 Sol · Medium).
```

---

### П-9.1 · Конспекты 2.0: эскизы и план (этап 9.1)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-9-1` · заранее:** этап 8 принят.

```text
Задача: показать эскизы тетради (конспекты 2.0) и написать ТЗ для исполнителя. Этап 9.1 из docs/ROADMAP.md (замечания образца №20–22).

Перед началом
- git status чистый; ветка etap-9-1 от main.
- Прочитай: docs/CONCEPT.md — 6.9; docs/DESIGN.md — 7.11; docs/tasks/cloud.md; текущие /notes.

Сделать
1. /dev/sketches/notes (noindex):
   - список с папками и закреплёнными;
   - редактор с панелью: заголовок, список, чек-лист, жирный, цветной маркер, кнопки формул (дробь, корень, степень, система);
   - заметка с фото тетради и рисунком.
2. docs/tasks/notes-v2.md:
   - модель данных в облаке;
   - перенос старых заметок (ключи уроков и "general");
   - формат текста (Markdown + $…$ или другой — с причиной);
   - библиотека редактора, если нужна (новая зависимость → DECISIONS);
   - лимиты размера фото;
   - «Можно менять / Нельзя / Готово, когда»;
   - строки ru/kk.
3. После «ок» владельца подготовь общие файлы, чтобы исполнитель их не трогал: типы и действия стора для конспектов 2.0, ключи dict.ts (ru и kk), тесты стора.

Нельзя: менять экраны текущих конспектов.

Готово, когда: владелец выбрал вид, ТЗ готово.

Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (390×844, светлая и тёмная, ru и kk): эскизы.
Документы: ROADMAP (9.1 → ✅ ждёт приёмки), HANDOFF; DECISIONS — формат и редактор.
Сдать: коммиты по-русски в etap-9-1, push, PR в main (не мержить). Отчёт: вопросы владельцу; следующий шаг — П-9.2 (GPT-6.1 Sol · Medium).
```

---

### П-9.2 · Конспекты 2.0 (этап 9.2)

**Исполнитель · GPT-6.1 Sol · Medium · без плана · ветка `etap-9-2` · заранее:** П-9.1 принят.

```text
Задача: сделать тетрадь — конспекты 2.0 по ТЗ docs/tasks/notes-v2.md. Этап 9.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-9-2 от main.
- Прочитай: docs/tasks/notes-v2.md целиком; docs/DESIGN.md — 7.11, 14.

Сделать: всё из раздела «Сделать» ТЗ, в том числе:
- перенос старых заметок без потерь;
- «лист черновика → в конспект»;
- «ответ ИИ → в конспект → выбрать папку».

Можно менять — только файлы из списка ТЗ.
Нельзя: общие файлы (lib/types.ts, lib/store.ts, dict.ts) — недостающее списком в отчёт; терять старые заметки; хранить фото в localStorage.

Готово, когда:
- конспект с формулой, фото и рисунком создаётся на телефоне и виден на другом устройстве после входа;
- поиск находит конспект по слову;
- ответ ИИ сохраняется в выбранную папку;
- лист черновика переносится в конспект.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): список, редактор с формулой, заметка с фото.
Документы: CHANGELOG (v0.9.0), ROADMAP (этап 9 → ✅ ждёт приёмки), HANDOFF; ARCHITECTURE — модель конспектов.
Сдать: коммиты по-русски в etap-9-2, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-10.1 (GPT-6.1 Sol · Light).
```

---

### П-10.1 · ИИ 2.0: много чатов (этап 10.1)

**Прораб · GPT-6.1 Sol · Light (меняется стор) · без плана · ветка `etap-10-1` · заранее:** этап 8 принят; для пункта 3 — этап 9 принят (папки конспектов).

```text
Задача: дать ученику несколько чатов с наставником. Этап 10.1 из docs/ROADMAP.md (замечание образца №19).

Перед началом
- git status чистый; ветка etap-10-1 от main.
- Прочитай: docs/AI.md — 5.1, 15; docs/DESIGN.md — 7.12; стор chats (этап 2.3); docs/tasks/notes-v2.md (папки), если этап 9 сделан.

Сделать
1. Список чатов: новый, переименовать, закрепить, удалить (с подтверждением), поиск по тексту. Название чата — по первому вопросу, можно поменять.
2. Чаты хранятся в облаке по решению этапа 8, гость — локально.
3. «Сохранить в конспект → выбрать папку» у каждого ответа ИИ — папки из этапа 9. Этапа 9 ещё нет — пункт пропусти: остаётся «В конспект» из этапа 2.3, свои папки не делай.
4. Тесты стора: создание, переименование, удаление, закрепление; лимит сообщений на чат.

Нельзя: менять промпты (это П-10.2).

Готово, когда: можно вести 3 чата, закрепить один, найти старый по слову; ответ сохраняется в выбранную папку (если этап 9 сделан).

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): список чатов, чат, выбор папки.
Документы: CHANGELOG, ROADMAP (10.1 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-10-1, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-10.2 (GPT-6.1 Sol · High).
```

---

### П-10.2 · ИИ 2.0: режимы наставника (этап 10.2)

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `etap-10-2` · заранее:** П-10.1 влит; ключ в `.env.local`.

```text
Задача: добавить режимы наставника «Объясни тему», «Дай задачи», «Проверь решение», «Готовимся к ЕНТ» — при той же экономии: задачи и ответы даёт код, ИИ объясняет. Этап 10.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-10-2 от main.
- Прочитай: docs/AI.md — 7 (промпты), 10, 14, 15; docs/ARCHITECTURE.md — 9.3 (draw); src/server/prompts.ts.

Сделать
1. Режимы в /tutor — выбор чипами в начале чата.
2. «Дай задачи»:
   - задачи берутся из банка (draw) по слабым навыкам ученика;
   - ответы проверяет код мгновенно;
   - модель только выбирает навык и уровень структурированным ответом (json_schema) из списка навыков ученика, задач с ответами не придумывает (docs/AI.md 15).
   - Способ — предложение, запиши в DECISIONS.
3. «Объясни тему» и «Готовимся к ЕНТ» — новые MODE_RULE в prompts.ts; «Проверь решение» — через check-solution.
4. Изменение промптов — строго по чек-листу docs/AI.md 14:
   - tests/prompts.test.ts;
   - npm run check:prompts с новыми случаями ru/kk;
   - ручные сценарии.

Нельзя: выдавать ответ в hint и ask до ответа ученика; сильную модель на запросах учеников.

Готово, когда:
- «Дай задачи» выдаёт 5 задач по слабой теме, ответы проверяются без ИИ;
- check:prompts ok на ru и kk;
- расход токенов на запрос — в отчёте, рост объяснён.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e && npm run check:prompts.
Скриншоты (390×844, светлая и тёмная, ru и kk): каждый режим.
Документы: CHANGELOG — каждая правка промпта отдельной строкой с «проверено живыми запросами ru/kk»; DECISIONS — режимы, способ выбора задач; docs/AI.md — режимы; ROADMAP (10.2 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-10-2, push, PR в main (не мержить). Отчёт: что изменилось для ученика и как проверить самому; следующий шаг — П-10.3 (GPT-6.1 Sol · Medium).
```

---

### П-10.3 · ИИ 2.0: голосовые вопросы и игра «Объясни Пи» (этап 10.3)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-10-3` · заранее:** П-10.2 влит; ключ в `.env.local`.

```text
Задача: дать спросить наставника голосом и сделать игру «Объясни Пи» (метод Фейнмана). Этап 10.3 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-10-3 от main.
- Прочитай: docs/AI.md — 2.4 (OPENAI_TRANSCRIBE_MODEL), 4.0, 9, 14, 16; docs/GAMES.md — 2, 4, 13.9; src/server/*.

Сделать
1. Голос:
   - запись в браузере → новый маршрут /api/ai/transcribe;
   - лимит, обрезка размера и длительности, лог [ai];
   - модель из env;
   - поддержку kk при расшифровке проверь живым запросом; если не работает — отключи для kk и напиши;
   - затем обычный ответ наставника. Прослушать ответ — по желанию, если решено в DECISIONS.
2. «Объясни Пи» — единственная игра с ИИ:
   - ученик объясняет тему своими словами без запрещённых слов;
   - ИИ оценивает и задаёт уточнение;
   - свой маршрут, промпт в prompts.ts, лимиты;
   - игра по контракту src/games/types.ts, запрещённые слова проверяет код;
   - промпт — по чек-листу docs/AI.md 14.
3. Тесты маршрутов с заглушкой OpenAI.

Нельзя: хранить аудио после расшифровки; сильную модель на запросах учеников.

Готово, когда:
- голосовой вопрос на ru понят и получил ответ (kk — по итогам проверки);
- в «Объясни Пи» объяснение с запрещённым словом не засчитывается.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e && npm run check:prompts.
Скриншоты (390×844, светлая и тёмная, ru и kk): кнопка записи, игра.
Документы: CHANGELOG (v0.10.0, промпты отдельными строками), DECISIONS — модель расшифровки, лимиты; docs/AI.md; ROADMAP (этап 10 → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски в etap-10-3, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — по ROADMAP.
```

---

### П-11.1 · Пробный ЕНТ «Математика» (этап 11.1)

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `etap-11-1` · заранее:** все разделы трека «Математика» готовы, есть контекстные задания.

```text
Задача: сделать полный пробный ЕНТ по профильной математике — 40 заданий, оценка из 50 по Правилам ЕНТ, разбор. Этап 11.1 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-11-1 от main.
- Прочитай:
  - docs/ENT_MATH.md — формат «Математики» (типы, баллы, уровни, время, контекст, оформление), таблица п. 18;
  - docs/CONCEPT.md — 6.12;
  - docs/ARCHITECTURE.md — 4.4 (ContextBlock), 9.3, 10;
  - docs/DESIGN.md — 7.15;
  - код мини-ЕНТ.

Сделать
1. lib/ent.ts — сборка варианта по seed:
   - 25 «один ответ» (4 варианта);
   - 1 контекст + 5 вопросов к нему;
   - 5 «несколько ответов» (6 вариантов, 1–3 верных);
   - 5 «соответствие» (2 × 4);
   - уровни A/B/C ≈ 20/12/8;
   - покрытие разделов, без повторов.
   Тесты: максимум ровно 50 баллов, пропорции, детерминизм.
2. Форма банка context (если её ещё нет) и контекстные задания: общий текст и рисунок видны над каждым из 5 вопросов.
3. Экран — экран мини-ЕНТ с параметрами:
   - таймер ~80 минут (в среднем 2 минуты на задание);
   - сохранение незавершённого варианта (перезагрузка не теряет ответы);
   - навигатор на 40 номеров.
4. Итоги: балл из 50, разбор по номерам, ИИ-объяснение после разбора. XP — по DECISIONS.
5. e2e: вариант собирается, нет ИИ и справочника формул, есть калькулятор и черновик.

Нельзя: показывать правильность до конца; формулировки инструкций не по НЦТ.

Готово, когда:
- вариант проходится на телефоне целиком;
- ручной подсчёт по таблице Правил на 3 вариантах ответов совпадает с баллом приложения (покажи в отчёте).

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): контекстное задание, «соответствие», навигатор, итоги.
Документы: CHANGELOG, ROADMAP (11.1 → ✅ ждёт приёмки), HANDOFF; DECISIONS — состав варианта, XP; ARCHITECTURE — форма context.
Сдать: коммиты по-русски в etap-11-1, push, PR в main (не мержить). Отчёт 5–10 строк; следующий шаг — П-11.2 (GPT-6.1 Sol · Medium).
```

---

### П-11.2 · Пробный ЕНТ «Мат. грамотность», прогноз балла, урок «Как решать ЕНТ» (этап 11.2)

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `etap-11-2` · заранее:** П-11.1 влит.

```text
Задача: сделать пробный ЕНТ «Математическая грамотность», прогноз балла на главной и паспорт урока «Как решать ЕНТ». Этап 11.2 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-11-2 от main.
- Прочитай: docs/ENT_MATH.md — формат мат. грамотности, стратегия частичных баллов, пороги; docs/CONCEPT.md — 6.3, 6.12, 12 (прогноз не подтверждён); docs/LESSON_METHOD.md — 15.

Сделать
1. Пробный ЕНТ «Математическая грамотность»: 10 заданий, ~20 минут, оценка из 10 — на том же экране.
2. Прогноз балла:
   - предложи 2 простые формулы, которые объясняются одной фразой (например, «по двум последним пробным»);
   - после выбора владельца — в DECISIONS;
   - чистая функция с тестом;
   - блок на главной с этой фразой.
   Официальных весов тем нет — не выдавай прогноз за точный.
3. docs/tasks/lesson-ent-strategy.md — паспорт урока «Как решать ЕНТ» по LESSON_METHOD 15.1:
   - темп 2 минуты на задание;
   - почему не отмечать сомнительный вариант;
   - проверять все 6 вариантов (−2,5 = −2½ = −5/2);
   - работа с контекстом.
   Сам урок — через Т-1б.

Нельзя: прогноз без пояснения, как он посчитан.

Готово, когда:
- пробный по мат. грамотности проходится;
- прогноз виден на главной с пояснением;
- владелец утвердил паспорт урока.

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): итоги пробного, блок прогноза.
Документы: CHANGELOG, ROADMAP (11.2 → ✅ ждёт приёмки), HANDOFF; DECISIONS — формула прогноза.
Сдать: коммиты по-русски в etap-11-2, push, PR в main (не мержить). Отчёт 5–10 строк; дальше — Т-1б для урока, затем П-11.3.
```

---

### П-11.3 · «Детектив» и аудит v1.0 (этап 11.3)

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `etap-11-3` · заранее:** всё остальное в этапе 11 принято. Игру «Детектив» делает исполнитель через Т-4 до этого промпта или параллельно.

```text
Задача: провести финальный аудит перед версией 1.0 и выпустить её. Этап 11.3 из docs/ROADMAP.md.

Перед началом
- git status чистый; ветка etap-11-3 от main.
- Прочитай: docs/ROADMAP.md — «Готово, когда» этапа 11; docs/DESIGN.md — 14; docs/AI.md — 9, 11; раздел «Code Review Rules» в AGENTS.md.

Сделать — аудит, каждый пункт с результатом в отчёте:
1. Курс: все разделы обоих треков «доступны», у каждого урока зелёный тест, у каждого навыка генератор.
2. Поиск по коду:
   - эмодзи;
   - глаголы с родом в строках ru (окончания -л, -ла, -лся, -лась после «ты»);
   - hex и dark: в компонентах;
   - русские строки в компонентах;
   - NEXT_PUBLIC_ с ключами;
   - console.log с данными учеников.
3. /review всего проекта против прошлого релиза по Code Review Rules. Найденное — исправить или вынести в отчёт с оценкой риска.
4. npm run review:kk по всем строкам — правки по правилам Т-9.
5. ИИ: npm run check:prompts ok; лимиты и бюджет работают; расход на ученика по логам за неделю против оценки docs/AI.md 11.
6. Чек-лист DESIGN 14 — скриншоты всех основных экранов.
7. Публичный адрес отвечает 200, все e2e зелёные.

Нельзя: выпускать v1.0 с красными проверками; прятать известные проблемы — они идут в «Ещё нет».

Готово, когда: аудит пройден, владелец сказал «выпускаем».

Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e && npm run check:prompts.
Скриншоты: все экраны из DESIGN 14 — 360×640, 390×844, 1280 px; светлая и тёмная; ru и kk.
Документы: CHANGELOG (v1.0.0 с честным разделом «Ещё нет»), ROADMAP (этап 11 → ✅), DECISIONS, HANDOFF.
Сдать: коммиты по-русски в etap-11-3, push, PR в main; после «выпускаем» — Т-6. Отчёт: таблица аудита.
```

---

## 4. Типовые ситуации

### Т-1 · Новый урок (три шага)

Урок пишется в три шага. Параллельно можно вести несколько уроков серии — у каждого свой чат, worktree и ветка. Т-1в делается один раз на серию.

#### Т-1а · Паспорт урока

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `lesson-<id>`**

```text
Задача: написать паспорт урока «<название>» (id <id>, раздел <раздел>, навык <навык>) — до кода. Этап 4 docs/ROADMAP.md.

Перед началом
- git status чистый; ветка lesson-<id> от main.
- Прочитай:
  - docs/LESSON_METHOD.md — 0, 2, 3.3, 4, 5, 6.2–6.3, 7, 10, 12.1 (образец паспорта), 15.1;
  - docs/tasks/section-<раздел>.md;
  - docs/ENT_MATH.md — тема спецификации и примеры из демо;
  - docs/DECISIONS.md — сюжет.

Сделать: docs/tasks/lesson-<id>.md:
1. Таблица шагов как LESSON_METHOD 12.1: id, тип, уровень, блок, что происходит. 12–15 шагов, ≤ 8 вопросов, A → B → C, не больше двух одинаковых типов подряд.
2. Сюжет: первый и последний story, мостик к следующему уроку.
3. Мост «известное → новое»; где «Как думаешь?» с reveal.
4. Ловушки (типичные ошибки) и в каких вариантах они стоят.
5. Минимум 2 задания ent: true в настоящем формате ЕНТ.
6. Нужные сцены. Нет готовой — отметь «нужен Т-3».
7. Генератор навыка: уровни A/B/C, типичные ошибки (LESSON_METHOD 10.8).
8. Конспект: пункты.
9. Термины kk из ENT_MATH раздел 4; «проверить» — в отчёт.

Нельзя: писать файл урока.

Готово, когда: паспорт утверждён владельцем (для первого урока серии — обязательно) или прорабом.
Проверка: кода нет.
Документы: ROADMAP (урок → 🔜), HANDOFF.
Сдать: коммит по-русски в lesson-<id>, push. Отчёт: паспорт кратко, вопросы; следующий шаг — Т-1б (GPT-6 Luna · High) в новом чате.
```

#### Т-1б · Урок по паспорту

**Исполнитель · GPT-6 Luna · High (или GPT-6.1 Sol · Light) · без плана · ветка `lesson-<id>` (продолжение)**

```text
Задача: написать урок <id> по паспорту docs/tasks/lesson-<id>.md: файл урока и его тест. Этап 4 docs/ROADMAP.md.

Перед началом
- Ветка lesson-<id>, git status чистый.
- Прочитай:
  - docs/tasks/lesson-<id>.md целиком;
  - docs/LESSON_METHOD.md — 9, 10, 11, 12.3 и 12.5 (образцы файла и теста), 13, 14, 16;
  - пример src/content/lessons/num-2-frac-add.ts.

Сделать
1. src/content/lessons/<id>.ts строго по паспорту. Тексты ru и kk сразу оба. Формулы: Unicode для простого, $…$ для сложного, запятая.
2. tests/lessons/<id>.test.ts по образцу 12.5: таблица EXPECT, ответы посчитаны в тесте независимо (своя мини-арифметика), каждое «=» — правда.
3. Если паспорт требует генератор — src/lib/bank/<тема>.ts, только функции своего навыка, и тест вторым способом.

Можно менять: src/content/lessons/<id>.ts, tests/lessons/<id>.test.ts, свой навык в src/lib/bank/<тема>.ts.
Нельзя:
- course.ts, skills.ts, bank/index.ts, lib/types.ts, dict.ts — нужные строки регистрации списком в отчёт;
- менять паспорт;
- придумывать термины kk.

Готово, когда: npx vitest run tests/lessons/<id>.test.ts зелёный; npm run typecheck && npm run lint зелёные.
Проверка: команды выше. Скриншоты — в Т-1в.
Документы: HANDOFF (строка «урок <id> написан, ждёт регистрации»).
Сдать: коммит по-русски в lesson-<id>, push. Отчёт: строки регистрации, термины «проверить», что было неясно в паспорте; следующий шаг — Т-1в (GPT-6.1 Sol · Light).
```

#### Т-1в · Регистрация, вычитка, приёмка урока или серии

**Прораб · GPT-6.1 Sol · Light · без плана · ветка `lesson-<id>` (или `series-<имя>` — сюда влиты ветки уроков) · заранее:** ключ в `.env.local`.

```text
Задача: подключить урок(и) <id, id…> к курсу, вычитать казахский и подготовить к приёмке. Этап 4 docs/ROADMAP.md.

Перед началом
- Ветка lesson-<id> (или series-<имя>, куда влиты ветки уроков), git status чистый.
- Прочитай: docs/LESSON_METHOD.md — 12.4, 16; отчёты Т-1б (строки регистрации).

Сделать
1. Регистрация: skills.ts, course.ts (status "available"), bank/index.ts.
2. npm run review:kk — по правилам Т-9.
3. Пройди каждый урок скриптом на 390 px: каждое задание — нарочно неверный ответ. Объяснение видно целиком, формулы не вылезают.
4. Чек-лист LESSON_METHOD 16, кроме пункта «владелец прошёл».

Нельзя: удалять или переименовывать id уроков и шагов из прогресса.

Готово, когда: npm test зелёный; уроки открываются с карты; чек-лист пройден.
Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (390×844, светлая и тёмная, ru и kk): первый шаг, разбор, задание ЕНТ, панель ошибки, итоги — каждого урока.
Документы:
- CHANGELOG — урок на строку: «вычитано моделью, носителем — нет: принято N, отклонено M»;
- ROADMAP — урок → ✅ ждёт приёмки;
- HANDOFF.
Сдать: коммиты по-русски, push, PR в main (не мержить). Отчёт: какие уроки пройти владельцу и на что смотреть.
```

---

### Т-2 · Новый навык в банке (генератор)

**Исполнитель · GPT-6 Luna · High · без плана · ветка `bank-<навык>`**

```text
Задача: сделать генератор заданий для навыка <навык> («<название>»), чтобы он появился в «Тренировке» и играх. Этап 4 docs/ROADMAP.md.

Перед началом
- git status чистый; ветка bank-<навык> от main.
- Прочитай:
  - docs/ARCHITECTURE.md — 9 (целиком);
  - docs/LESSON_METHOD.md — 6.3 (типичные ошибки), 10.8;
  - описание навыка в docs/tasks/section-<раздел>.md или lesson-<id>.md;
  - пример src/lib/bank/num.ts.

Сделать
1. В src/lib/bank/<тема>.ts — SkillBank навыка: question обязательно; statement, pair, short, trace — какие указаны в задании. Уровни A/B/C — по таблице навыка.
2. Ответ считает код. Неверные варианты — типичные ошибки, уникальные по значению (0,5 и 1/2 — один вариант). У каждого задания explanation ru и kk с названной ловушкой.
3. Тест: все уровни × seed 1..299 →
   - validateStep пусто;
   - эталон проходит свою проверку;
   - ответ пересчитан вторым, независимым способом;
   - вариантов ровно 4 (или 6 для multi);
   - детерминизм;
   - утверждения: баланс верных и неверных.

Можно менять: src/lib/bank/<тема>.ts (только свой навык), тест навыка.
Нельзя: bank/index.ts, skills.ts — строку регистрации в отчёт; Math.random и Date.now внутри генератора.

Готово, когда: тест навыка и npm run typecheck && npm run lint зелёные.
Проверка: npx vitest run <тест навыка> && npm run typecheck && npm run lint.
Документы: HANDOFF.
Сдать: коммит по-русски в bank-<навык>, push. Отчёт: строка регистрации, 3 примера заданий A/B/C; регистрирует прораб (Т-1в).
```

---

### Т-3 · Новая сцена, песочница или вид шага

**Прораб · GPT-6.1 Sol · Medium · сначала план · ветка `scene-<вид>`**

```text
Задача: добавить <сцену / песочницу / вид шага> «<что>» для раздела <раздел> (например: числовая прямая с промежутками, координатная плоскость, песочница параболы, единичная окружность). Нужна до первого урока раздела. Этап 4 docs/ROADMAP.md.

Перед началом
- git status чистый; ветка scene-<вид> от main.
- Прочитай:
  - docs/ARCHITECTURE.md — 3.1 (строки «Тип шага» и «Вид сцены»), 4.2–4.3, 16;
  - docs/DESIGN.md — 11 (нужный подраздел), 2.7;
  - docs/LESSON_METHOD.md — 7.5, 8;
  - docs/tasks/section-<раздел>.md.

Сделать
- Сцена: Scene в lib/types.ts → components/scenes/<Kind>Scene.tsx → расчёты в scenes/logic.ts → case в SceneView → validateScene → tests/scenes.test.ts → describeScene ru/kk → раздел на /dev.
- Вид шага: lib/types.ts (union Step) → lib/evaluate.ts (Answer, isReady, evaluate, expectedText) → components/lesson/steps/<Тип>View.tsx → ветка в LessonPlayer → tests/validate.ts + тест.
- Песочница: explore-tool, цель через goalReached, «Продолжить» закрыто до цели.
- Числа на схеме считает logic.ts. Цвета — токены. Анимации ≤ 400 мс, уважать «Меньше анимаций». Касание пальцем + стрелки клавиатуры, «прилипание» к делениям.

Нельзя: картинки вместо SVG; ответы, введённые автором вместо расчёта.

Готово, когда: на /dev работает на 360 px в обеих темах; тесты зелёные.
Проверка: npm run typecheck && npm run lint && npm test && npm run build.
Скриншоты (360×640 и 390×844, светлая и тёмная): раздел на /dev.
Документы: CHANGELOG, HANDOFF; DECISIONS — новый вид; ARCHITECTURE 4 — новые типы.
Сдать: коммиты по-русски в scene-<вид>, push, PR в main (не мержить). Отчёт 5–10 строк.
```

---

### Т-4 · Новая мини-игра (три шага)

#### Т-4а · ТЗ игры

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `game-<id>`**

```text
Задача: написать ТЗ на мини-игру <id> («<название>») для исполнителя. Этап 6 docs/ROADMAP.md.

Перед началом
- git status чистый; ветка game-<id> от main.
- Прочитай: docs/GAMES.md — 1, 2, 5–8, раздел игры (13.x для бэклога), 14.3, 14.4, 15; src/games/types.ts, src/lib/game-pool.ts, src/lib/bank/types.ts.

Сделать: docs/tasks/game-<id>.md:
- механика;
- источник заданий (формы банка);
- MODE_CONFIG трёх темпов (стартовые числа);
- очки;
- экран 390 px;
- клавиатура;
- крайние случаи;
- доступность;
- строки ru/kk целиком;
- «Можно менять / Нельзя / Готово, когда»;
- риски 14.3;
- тесты logic.ts.
Если игре нужна новая форма банка или строки в общих файлах — сначала сделай их сам в этой ветке.

Готово, когда: исполнитель может работать без вопросов.
Проверка: npm run typecheck && npm run lint && npm test (если менялись общие файлы).
Документы: HANDOFF; DECISIONS — если меняются общие файлы.
Сдать: коммит по-русски в game-<id>, push. Следующий шаг — Т-4б (GPT-6 Luna · High) в новом чате.
```

#### Т-4б · Игра по ТЗ

**Исполнитель · GPT-6 Luna · High (или GPT-6.1 Sol · Light) · без плана · ветка `game-<id>` · параллельно с другими играми — в своём worktree**

```text
Задача: реализовать мини-игру <id> по ТЗ docs/tasks/game-<id>.md. Этап 6 docs/ROADMAP.md.

Перед началом
- Ветка game-<id>, git status чистый.
- Прочитай: AGENTS.md; docs/tasks/game-<id>.md целиком; docs/GAMES.md — 1, 2, 5, 7 и раздел своей игры; src/games/types.ts.

Сделать: src/games/<id>/Game.tsx, logic.ts, strings.ts и tests/games/<id>.test.ts по ТЗ.
- Логика — в logic.ts: чистая, без React.
- Все числа темпа — в MODE_CONFIG.
- Ответы считает код.
- onFinish ровно один раз.
- Один rAF-цикл на performance.now(), пауза в скрытой вкладке и на разборе, отмена при размонтировании.
- Тексты — только из strings.ts, ru и kk из ТЗ, свои не выдумывать.

Можно менять ТОЛЬКО: src/games/<id>/*, tests/games/<id>.test.ts (и шаблоны trace в банке, если это сказано в ТЗ).
Нельзя: types.ts, registry.ts, components.ts, GameShell, lib/* (кроме сказанного в ТЗ), dict.ts, store — их правит прораб.

Готово, когда: npx vitest run tests/games/<id>.test.ts && npm run typecheck && npm run lint — зелёные.
Проверка: команды выше. Скриншоты — при подключении (Т-4в).
Документы: HANDOFF (строка «игра <id> готова к подключению»).
Сдать: коммит по-русски в game-<id>, push. Отчёт 5–10 строк: что сделано, что не получилось, как проверить руками.
```

#### Т-4в · Подключение и ревью игры

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `game-<id>`**

```text
Задача: подключить игру <id> к приложению и провести ревью. Этап 6 docs/ROADMAP.md.

Перед началом: ветка game-<id>; прочитай docs/GAMES.md — 14.3, 15.

Сделать
1. Строки в registry.ts и components.ts; id в e2e/games.spec.ts.
2. /review против main с фокусом на риски GAMES 14.3, исправить.
3. npm run review:kk по строкам игры — по правилам Т-9.
4. Сыграть скриптом во всех темпах до итогов.

Готово, когда: чек-лист GAMES 15 пройден, кроме пунктов «глазами».
Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Скриншоты (360×640 и 390×844, светлая и тёмная, ru и kk): вступление, игра, итоги.
Документы: CHANGELOG (игра, «вычитано моделью, носителем — нет»), ROADMAP (игра → ✅ ждёт приёмки), HANDOFF.
Сдать: коммиты по-русски, push, PR в main (не мержить). Отчёт: что найдено ревью; что владельцу сыграть.
```

---

### Т-5 · Исправить баг по скриншоту

**Прораб · GPT-6.1 Sol · Medium (простая вёрстка — Sol · Light) · без плана · ветка `fix-<коротко>` · заранее:** приложи скриншот к сообщению.

```text
Задача: исправить баг. Скриншот приложен.

Что делал(а): <по шагам: какой экран, что нажал(а)>
Ожидал(а): <что должно было быть>
Получилось: <что вышло, текст ошибки если есть>
Где: <превью ветки / публичный адрес>, <телефон и браузер>, тема <светлая/тёмная>, язык <ru/kk>, ширина <примерно>

Перед началом
- git status чистый; ветка fix-<коротко> от main.

Сделать
1. Сначала воспроизведи: тестом (чистая логика) или Playwright-скриптом в scripts/out/ на той же ширине, теме и языке. Не воспроизводится — скажи, что ещё нужно узнать, и не правь наугад.
2. Найди причину и объясни её в 1–2 предложениях простыми словами.
3. Минимальный фикс + регрессионный тест (юнит или e2e), который падал до фикса.
4. Не меняй поведение и API вокруг. Причина в общем файле (types, store, dict, реестры) — правь аккуратно и напиши об этом.

Нельзя: «заодно» рефакторить; удалять тесты, чтобы стало зелёно.

Готово, когда: шаги из описания больше не воспроизводят баг; новый тест зелёный; остальные тоже.
Проверка: npm run typecheck && npm run lint && npm test && npm run build (+ npm run e2e, если баг в интерфейсе).
Скриншоты (как на присланном: ширина, тема, язык): до и после.
Документы: CHANGELOG (строка «Исправлено: …»), HANDOFF.
Сдать: коммит по-русски в fix-<коротко>, push, PR в main (не мержить). Отчёт: причина, что поменялось, как проверить самому.
```

---

### Т-6 · Ревью и выкладка

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка: PR этапа · заранее:** владелец принял работу на превью.

```text
Задача: проверить PR <номер или ветка> перед выкладкой и после моего «выкладываем» влить его в main.

Перед началом
- git fetch; переключись на ветку PR, git status чистый.
- Прочитай: раздел «Code Review Rules» в AGENTS.md; docs/DESIGN.md — 14.

Сделать
1. /review против main с фокусом: Code Review Rules (секреты, лимиты ИИ, утечка ответа в подсказке, ответы не от кода, kk, род, эмодзи, токены цветов, двойные тапы, таймеры, setState в эффекте, прогресс мимо стора).
2. Полные проверки + e2e.
3. Поиск в изменённых файлах:
   - эмодзи;
   - hex и dark: в компонентах;
   - русские строки в компонентах;
   - NEXT_PUBLIC_ с ключами;
   - глаголы с родом в строках.
4. Скриншоты изменённых экранов по чек-листу DESIGN 14 (360/390 px, светлая и тёмная, ru и kk).
5. Отчёт: что найдено, что исправлено (коммиты в эту же ветку), что осталось и насколько это опасно.
6. ЖДИ моего ответа. После «выкладываем»:
   - влей PR в main;
   - первый раз (после П-1.1) проект ещё не подключён к Vercel: дай мне шаги из docs/WORKFLOW.md 1.6 и жди, пока я подключу;
   - дождись, пока Vercel выложит;
   - проверь, что публичный адрес <проект>.vercel.app отвечает 200 и показывает новую версию.

Нельзя: вливать без моего «выкладываем»; push --force в main.

Готово, когда: PR влит, публичный адрес обновился, статус этапа в ROADMAP — ✅.
Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run e2e.
Документы: CHANGELOG — версия по ROADMAP (раздел 1), ROADMAP (✅), HANDOFF (что выложено, что дальше).
Сдать: отчёт: что выложено, ссылка на публичный адрес, следующий промпт и модель.
```

По желанию можно дополнительно написать в PR на GitHub `@codex review`. Это ревью считается отдельно, как «Code Review usage».

---

### Т-7 · Обновить документацию

**Механика · GPT-6 Luna · Medium (если меняется ARCHITECTURE или DECISIONS — GPT-6.1 Sol · Light) · без плана · ветка `docs-<дата>`**

```text
Задача: привести документы в соответствие с тем, что сделано с <даты или коммита>. <Если есть: «Владелец решил: …» — записать в DECISIONS.>

Перед началом
- git status чистый; ветка docs-<дата> от main.
- Посмотри git log --oneline <с какого коммита>..HEAD и git diff --stat. Читай только изменённые места.

Сделать по AGENTS.md, раздел 3:
1. docs/CHANGELOG.md:
   - сверху запись «## ГГГГ-ММ-ДД · vX.Y.Z — тема»;
   - изменения промптов ИИ — отдельными строками;
   - честно: «Ещё нет», «Проверить человеком».
2. docs/ROADMAP.md — статусы и новые планы.
3. docs/DECISIONS.md — решения: Решение / Почему / Альтернативы / Пересмотреть.
4. docs/ARCHITECTURE.md — только если поменялось «как работает».
5. docs/HANDOFF.md — дата, что сделано, где остановились, следующая задача и модель, вопросы владельцу.

Если меняются названия моделей Codex — обнови их везде одинаково по списку docs/WORKFLOW.md 5.1 («Если названия поменялись»).

Нельзя: выдумывать то, чего нет в коде и коммитах (не знаешь — пиши «проверить»); менять код.

Готово, когда: документы описывают текущее состояние; противоречий между ними нет.
Проверка: кода нет — git diff --stat.
Сдать: коммит по-русски в docs-<дата>, push, PR в main. Отчёт: что поменялось в документах (3–5 строк).
```

---

### Т-8 · Сессии: продолжить и закрыть

#### Т-8а · Продолжить в новом чате

**Механика · GPT-6 Luna · Medium · без плана · ветка — по ситуации**

```text
Продолжаем проект. Прочитай docs/HANDOFF.md, затем в docs/ROADMAP.md — строку текущего этапа и его «Готово, когда». Больше ничего не читай.

Ответь в 5–7 строках:
1) где мы остановились;
2) что не доделано или ждёт меня (решения, приёмка, ключи);
3) какой следующий промпт из docs/PROMPTS.md и на какой модели;
4) есть ли незакоммиченные изменения (git status).
Работу не начинай, пока я не скажу «начинай» и не переключу модель.
```

#### Т-8б · Закрыть сессию

**Та же модель, что в чате · без плана**

```text
Заканчиваем сессию. Обнови docs/HANDOFF.md:
- дата;
- что сделано в этой сессии;
- где остановились (ветка, последний коммит, незакоммиченное);
- следующая задача — номер промпта из docs/PROMPTS.md и модель;
- вопросы ко мне.
Если в этой сессии менялся код — проверь, что CHANGELOG и ROADMAP тоже обновлены (AGENTS.md, раздел 3).
Закоммить по-русски и запушь ветку. Ответь одной строкой: что записано в HANDOFF.
```

---

### Т-9 · Вычитка казахского

**Прораб · GPT-6.1 Sol · Light (правки идут в dict.ts и уроки — общие файлы) · без плана · ветка `kk-<дата>` (или текущая ветка урока или игры) · заранее:** ключ OpenAI в `.env.local`.

```text
Задача: вычитать новые казахские тексты скриптом-редактором и применить только обоснованные правки. Носителя-редактора у нас нет — это замена.

Перед началом
- git status чистый; ветка kk-<дата> от main (или текущая ветка).
- Прочитай: docs/AI.md — 12.1; docs/LESSON_METHOD.md — 11; docs/ENT_MATH.md — раздел 4 (термины и пометки «проверить»).

Сделать
1. npm run review:kk → scripts/out/kk-review.json. Ключ не выводи. Первый прогон — сначала посмотри, сколько строк собрано из каждого файла: у существующих файлов больше 0, термины из ENT_MATH раздел 4 подставлены (скрипт — из П-1.1, docs/AI.md 12.1). Не так — сначала почини скрипт.
2. По каждой правке реши «принять / отклонить»:
   - термин из ENT_MATH раздел 4 главнее мнения модели: правку, ломающую такой термин, отклоняй;
   - числа, формулы ($…$ и Unicode), десятичная запятая, Markdown не меняются;
   - падежный суффикс не клеится к подставленному числу ({n} санынан);
   - ЕНТ → ҰБТ;
   - правки «на вкус» отклоняй.
3. Принятые примени (npm run review:kk -- --apply или вручную), прогони npm test.
4. Термины с пометкой «проверить» и спорные места — список для учителя-носителя.

Нельзя: применять все правки вслепую; менять русские тексты.

Готово, когда: правки разобраны, тесты зелёные.
Проверка: npm run typecheck && npm test.
Документы: CHANGELOG — «Казахский: вычитано моделью, носителем — нет: принято N, отклонено M (причины кратко)»; HANDOFF.
Сдать: коммит по-русски, push, PR в main (или в ветку урока). Отчёт: таблица «принято / отклонено / почему» (до 15 строк), список для носителя.
```

---

### Т-10 · Изменить промпт или модель ИИ

**Прораб · GPT-6.1 Sol · High · сначала план · ветка `ai-prompt-<коротко>` · заранее:** ключ в `.env.local`.

```text
Задача: <что поменять в поведении ИИ или какую модель поставить и почему; пример ответа ИИ, который не устраивает>.

Перед началом
- git status чистый; ветка ai-prompt-<коротко> от main.
- Прочитай: docs/AI.md — 2.3 (модели), 7 (промпты и почему они такие), 7.5, 12.4, 14; src/server/prompts.ts.

Сделать — строго по чек-листу docs/AI.md 14:
1. План: что меняешь и почему, какие запреты затронуты. Жди «ок».
2. Правка только в src/server/prompts.ts (и словари в src/server/context.ts):
   - LaTeX — в String.raw;
   - неизменная часть промпта — в начале;
   - kk-термины только из ENT_MATH раздел 4.
   Модель меняется только переменной окружения; умолчание в openai.ts — только после проверки.
3. tests/prompts.test.ts обновить.
4. npm run check:prompts на ru и kk. Если меняется модель — на старой и новой, сравнение таблицей (качество, токены, время).
5. Список ручных проверок для меня: сценарии 1–3, 5, 6, 15 из docs/AI.md 7.5; «просто скажи ответ» — дважды подряд.
6. Токены до и после по логам [ai]. Рост больше 20 % — объясни.

Нельзя:
- выдавать ответ в hint и в ask до ответа ученика;
- убирать запреты (род, эмодзи, язык, формат формул);
- сильную модель на запросах учеников.

Готово, когда: check:prompts ok на ru и kk; ручные сценарии мной проверены.
Проверка: npm run typecheck && npm run lint && npm test && npm run build && npm run check:prompts.
Документы:
- CHANGELOG — ОТДЕЛЬНОЙ строкой: «Промпт: что изменено; проверено живыми запросами ru/kk: сценарии …»;
- DECISIONS — если поменялось поведение или модель по умолчанию;
- docs/AI.md — таблицы моделей и стоимости, если поменялась модель;
- HANDOFF.
Сдать: коммиты по-русски в ai-prompt-<коротко>, push, PR в main (не мержить). Отчёт: что изменилось для ученика и как я могу это проверить сам (2–3 шага).
```

---

### Т-11 · Замечания владельца или тестеров → план правок

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `docs-feedback-<дата>`**

```text
Задача: разобрать замечания и превратить их в план правок. Код в этой задаче не меняем.

Замечания (как есть):
<вставь список; можно со скриншотами>

Перед началом
- git status чистый; ветка docs-feedback-<дата> от main.
- Прочитай: docs/ROADMAP.md (текущий этап и раздел 4); docs/CONCEPT.md — 10 (уроки образца).

Сделать
1. Пронумеруй замечания. По каждому:
   - что именно не так (переформулируй, если неясно — вопрос мне);
   - баг, правка вида, правка методики или новая функция;
   - где решаем: текущий этап / номер этапа / Т-5;
   - объём: маленький / средний / большой;
   - предложение.
2. Таблица «№ | замечание | где решаем | объём | предложение».
3. Похожее на уже известный урок образца (CONCEPT 10) — сошлись на него.
4. После моего «ок»:
   - внеси в docs/ROADMAP.md: таблица замечаний + пункты в этапах;
   - маленькие баги — отдельным списком для Т-5.

Нельзя: менять код; отбрасывать замечание без объяснения.

Готово, когда: у каждого замечания есть место в плане, я согласен с порядком.
Проверка: кода нет.
Документы: ROADMAP, HANDOFF; DECISIONS — если меняется принятое решение.
Сдать: коммит по-русски, push, PR в main. Отчёт: таблица и порядок работ; первые 1–3 промпта, с которых начать, и модели.
```

---

### Т-12 · Ретроспектива: правило или skill

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `docs-retro-<дата>`**

```text
Задача: ты (или прошлый чат) дважды одинаково ошибся: <что случилось, ссылки на коммиты или PR>. Проведи ретроспективу и предложи, как не повторять.

Перед началом: git status чистый; ветка docs-retro-<дата> от main; прочитай AGENTS.md.

Сделать
1. Причина в 2–3 предложениях: правило было неясным, противоречивым, отсутствовало или промпт был неполным.
2. Одно из двух:
   - правило в AGENTS.md — 1–2 строки в нужном разделе, без повторов и противоречий; размер AGENTS.md после правки ≤ 24 КБ (wc -c);
   - или skill .agents/skills/<имя>/SKILL.md (front-matter name и description; шаги работы), если это повторяющаяся работа: новый урок, вычитка kk, проверка перед коммитом.
3. Покажи diff и жди «ок».

Нельзя: раздувать AGENTS.md; добавлять правило, противоречащее DECISIONS.

Готово, когда: правило или skill добавлены после моего «ок».
Проверка: wc -c AGENTS.md.
Документы: CHANGELOG («Правила: …»), HANDOFF.
Сдать: коммит по-русски, push, PR в main. Отчёт: правило одной строкой; skill вызывается так: $<имя>.
```

---

### Т-13 · Осенняя сверка ЕНТ (раз в год)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `docs-ent-<год>`**

```text
Задача: проверить, не изменился ли ЕНТ по математике и математической грамотности, и что из этого следует для курса. НЦТ публикует спецификации осенью.

Перед началом
- git status чистый; ветка docs-ent-<год> от main.
- Прочитай docs/ENT_MATH.md (источники и раздел «Не подтверждено»).

Сделать
1. Проверь testcenter.kz, страницы «Подготовка к тестированию» (RU и KK):
   - есть ли спецификации «для использования с <следующего> года» по «Математике» и «Математической грамотности»;
   - новые демоверсии;
   - изменения Правил ЕНТ (калькулятор, черновик, баллы п. 18).
   Если поиск отдаёт старые страницы или PDF не открывается — скажи, какие файлы мне скачать и приложить.
2. Сравни с docs/ENT_MATH.md: число заданий и типы, баллы, уровни A/B/C, темы, время, калькулятор, пороги, число вариантов в мат. грамотности.
3. Таблица «что было → что стало → источник (ссылка, дата) → что менять в курсе (ENT_FORMAT, уроки, пробный ЕНТ)».
4. Обнови docs/ENT_MATH.md только по подтверждённым фактам; неподтверждённое — в «Не подтверждено».

Нельзя: менять код до моего «ок»; писать факты без источника.

Готово, когда: ENT_MATH актуален, есть список изменений для курса.
Проверка: кода нет.
Документы: docs/ENT_MATH.md («проверено ГГГГ-ММ-ДД»), ROADMAP (задачи по изменениям), CHANGELOG, HANDOFF.
Сдать: коммит по-русски, push, PR в main. Отчёт: изменилось ли что-то (одной фразой) и таблица.
```

---

### Т-14 · Сверка с образцом Informatica (раз в 2–4 недели)

**Прораб · GPT-6.1 Sol · Medium · без плана · ветка `docs-sample-<дата>` · заранее:** владелец получил от владельца Informatica свежие `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md` образца и положил их в `scripts/out/sample/` (папка не попадает в git).

```text
Задача: найти в новых журналах образца Informatica то, что стоит перенести в Matematika. Код не менять.

Перед началом
- git status чистый; ветка docs-sample-<дата> от main.
- Дата прошлой сверки — в docs/DECISIONS.md (последняя запись «Сверка с образцом») или дата снимка reference/ (2026-10-03).
- Читай в scripts/out/sample/ только записи новее этой даты. Наши docs — только разделы, к которым относится находка.

Сделать
1. Выпиши из журналов образца новое: решения, исправленные баги и уроки ревью, выбор по пунктам, помеченным у нас [план образца] (карта курса, стиль видео, игры на банке, облако, мини-ЕНТ), смену моделей ИИ.
2. Предложи не больше 10 пунктов к переносу. По каждому: что у образца, где это у нас (файл, раздел), что поменять, цена (мало / средне / много), польза для ученика. Что математике не подходит — одной строкой «пропускаем, потому что…».
3. ЖДИ моего ответа. Принятое — записи в docs/DECISIONS.md («Сверка с образцом ГГГГ-ММ-ДД: …», с «Откуда: Informatica, запись …») и правки в docs по этим записям; задачи на код — в ROADMAP.

Нельзя: менять код; править reference/ (новый снимок образца кладётся целиком, отдельной задачей, с датой в reference/README.md); переносить без моего «ок».

Готово, когда: таблица показана, принятое записано в DECISIONS и ROADMAP.
Проверка: кода нет — git diff --stat.
Документы: DECISIONS, ROADMAP, CHANGELOG, HANDOFF.
Сдать: коммит по-русски в docs-sample-<дата>, push, PR в main. Отчёт: 3–5 строк, что взяли и что дальше.
```

---

## 5. Как тратить меньше лимита Codex

- **Один чат — одна задача.** Сменилась тема → Т-8б и новый чат.
- **Дешёвая модель на механике.** По кредитам Luna примерно в 20 раз дешевле Sol. Прогон проверок, вычитка, итог сессии — на Luna.
- **Прораб пишет ТЗ, исполнитель делает.** Сильная модель не пишет однотипный код.
- **Читать не всё, а нужные разделы.** В промптах указаны разделы документов; `reference/` — по одному файлу.
- **Не включать Fast, Max, Ultra** без нужды. Субагенты тоже тратят больше: каждый работает своей моделью.
- **Остаток лимита** смотреть раз в 1–2 недели: https://chatgpt.com/codex/settings/usage, в чате — `/status`.
- **Ошибка повторилась дважды** → Т-12: правило или skill, а не одно и то же объяснение в каждом промпте.
