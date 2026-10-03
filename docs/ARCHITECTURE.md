# Архитектура

> Как устроена платформа (начиная с v0.1; изменения этапа 3 — в конце файла). Обновлять при каждом изменении «как работает».

## Общая схема

```
Браузер (телефон / ПК)                         Сервер (Next.js route handlers)
┌──────────────────────────────────┐          ┌──────────────────────────────┐
│ Страницы (App Router, client)    │          │ /api/ai/tutor          stream │
│ Плеер урока + шаги-задания       │  fetch   │ /api/ai/check-solution  JSON │──► OpenAI API
│ Remotion Player (видео)          │ ───────► │ /api/ai/lesson-feedback JSON │   (ключ только тут)
│ Zustand store ─► localStorage    │          │ лимиты · обрезка · логи      │
└──────────────────────────────────┘          └──────────────────────────────┘
```

- Весь прогресс ученика хранится **на устройстве** (localStorage, ключ `informatica-v1`). Сервер ничего не хранит — он только посредник к OpenAI. Это MVP-решение (см. DECISIONS #3); бэкенд — в ROADMAP.
- Клиент сам собирает **сжатый портрет ученика** (`buildStudentContext`) и отправляет его с каждым запросом к ИИ.

## Папки

```
src/
  app/                      страницы и API (Next.js App Router)
    (main)/                 разделы с навигацией: learn, practice, tutor, notes, stats, profile
    lesson/[id]/            полноэкранный урок
    drill/                  полноэкранная тренировка (?mode=smart|mistakes|skill)
    onboarding/             знакомство: язык, имя, класс, цель, стиль, дневная цель
    api/ai/*                серверные маршруты ИИ
  components/
    lesson/                 LessonPlayer, Results, DrawingCanvas, steps/* (по компоненту на тип задания)
    ai/                     AiPanel (подсказка/разбор в уроке), useTutor (общий хук стриминга)
    app/                    AppShell (навигация), Widgets, WeekChart
    ui/                     Button, Card, Modal, ProgressBar/Ring, Pill
    mascot/                 маскот «Бит» (SVG, 5 настроений)
    visuals/                иллюстрации к теории
  content/                  курс: UNITS (карта), LESSONS, SKILLS, уроки в lessons/*.ts
  i18n/                     dict.ts (все строки интерфейса ru/kk), useT()
  lib/                      чистая логика: типы, проверка ответов, генераторы, геймификация, освоение, стор
    bank/                   банк заданий: формы заданий по навыкам (вопрос, утверждение, пара, короткий ответ)
    ent.ts                  правила оценивания ЕНТ (2/1/0), уровни A/B/C
  server/                   только сервер: клиент OpenAI, промпты, лимиты, санитизация
  videos/                   Remotion-композиции + реестр + ленивый плеер
scripts/generate-voiceover.mts   озвучка видео через OpenAI TTS
tests/                      vitest: логика + валидация контента
public/media/videos/…       mp3 озвучки (ru/kk)
```

## Урок

**Модель.** `Lesson` = список `Step`. Типы — в `src/lib/types.ts`.
- **Информационные шаги** (без проверки):
  - `video`, `theory` (может иметь `scene`);
  - `story` — ситуация: сцена и реплика;
  - `worked` — пошаговый разбор, у каждого подшага своя `scene`;
  - `explore` — песочница `lamps` / `weights` / `coins`. С `goal` кнопка «Продолжить» открывается после достижения цели.
- **Вопросы:**
  - `choice`, `multi`, `input`, `bits`, `ladder`, `match`, `order`, `solution`;
  - `cloze` — «решаем вместе», пропуски в строках решения.
- Каждый вопрос привязан к навыку (`skill`), имеет уровень `level` (A/B/C), может быть помечен `ent: true` (формат ЕНТ) и иметь `reveal` — сцену, которая показывается после ответа («предскажи → проверь»).

**Сцены** (`components/scenes/SceneView.tsx`):
- типы: `binary` (веса, зачёркивание, сумма, ловушка «веса слева»), `ladder`, `lamps`, `coins`, `decimal`, `quest` (иллюстрации сюжета);
- сцена — данные, а не картинка: подшаги разбора передают новую сцену того же вида, и элементы плавно меняются, а не перерисовываются;
- чистая логика сцен — `components/scenes/logic.ts` (тесты `tests/scenes.test.ts`).

**Плеер** (`components/lesson/LessonPlayer.tsx`):

1. Очередь шагов. Ответ ученика (`Answer`) хранится в плеере; шаг-компонент только отображает и сообщает изменения.
2. «Проверить» → `evaluate()` (`lib/evaluate.ts`, чистая функция) → `StepResult {correct, score, given, expected}`.
   - `match` проверяется сам, когда собраны все пары (`score = 1 − 0.25 × ошибок`).
   - `multi` оценивается **по правилам ЕНТ** (`lib/ent.ts`): 2 балла — всё верно, 1 — частично (`score 0.5`, `partial: true`), 0 — неверно.
   - `solution` с картинкой → `/api/ai/check-solution`; если ИИ недоступен — проверка только итогового ответа; «нечитаемо» не засчитывается как ошибка.
3. Результат → `recordAnswer` в стор (XP, освоение навыка, ошибки, серия, дневная статистика) → нижняя панель обратной связи (зелёная/красная/янтарная) со статическим объяснением и кнопкой «Объясни, ИИ».
4. Ошибочный шаг один раз повторяется в конце («работа над ошибками»). Прогресс-бар растёт только за решённые шаги.
5. Конец → `finishSession` (бонус XP, статистика урока, достижения) → `Results` + запрос отзыва ИИ и обновление «памяти наставника».

Клавиатура: Enter — проверить/продолжить, 1–9 — выбрать вариант.

## Персонализация

- **Освоение навыка** (`lib/mastery.ts`): экспоненциальное сглаживание. Первый ответ: 0.7 (верно) / 0.2 (неверно), дальше `m += 0.3 × (результат − m)`. Уровни: `< 0.6` слабо (красный), `< 0.8` в процессе (янтарный), иначе освоено (зелёный).
- **Уровни A/B/C** (`Level = 1 | 2 | 3`, как в ЕНТ: 50/30/20%). Уровень задания — поле `level` у шага. Уровень по освоению — `levelFromMastery` (`lib/ent.ts`): < 0.5 → A, < 0.8 → B, иначе C.
- **Тренировка** (`lib/generators.ts`): задания генерируются кодом для навыков пройденных уроков (`generateLeveled(skill, level, seed)`). Вес навыка `(1.1 − m)²` — слабые выпадают в разы чаще. Уровень — по освоению, последняя треть тренировки на уровень выше, задания отсортированы **от лёгкого к сложному**. Генерация детерминирована по `seed`.
- **Работа над ошибками**: берёт исходные задания урока (по `stepId`) или свежие задания на тот же навык; верный ответ закрывает ошибку.
- **Портрет для ИИ** (`lib/student-context.ts`): имя, класс, цель, стиль объяснений, уровень, слабые/сильные темы с %, 5 последних ошибок, «память наставника», личные заметки, пройденные уроки. На сервере всё обрезается по длине (`server/context.ts`).
- **Память наставника**: после урока дешёвая модель возвращает обновлённые заметки (≤ 600 символов) — что западает, что помогает, какой стиль подходит. Ученик видит и может удалить их на странице «Прогресс».

## Геймификация (`lib/gamification.ts`)

| Механика | Правило |
|---|---|
| XP | 10 за верный ответ, +5 при комбо ≥ 3, 5 за исправленную ошибку; +20 за урок, +20 за урок без ошибок; +10 за тренировку |
| Уровень | уровень n начинается с 50·n·(n−1) XP (0, 100, 300, 600, 1000…), названия: Новичок → Бит → Байт → Килобайт… |
| Серия | +1 за каждый день с хотя бы одним ответом; пропуск дня обнуляет |
| Дневная цель | 20 / 50 / 100 XP (выбирается в онбординге) |
| Комбо | счётчик верных подряд в уроке (огонёк вверху) |
| Достижения | 10 штук, проверяются в сторе после каждого действия |

## ИИ

| Маршрут | Модель | Что делает | Расход (замер) |
|---|---|---|---|
| `POST /api/ai/tutor` mode=`hint` | gpt-5.4-mini, effort none | 1 подсказка без ответа | ~725 вх / ~85 вых токенов |
| … mode=`explain` | то же | разбор ошибки ученика | ~850 / ~160 |
| … mode=`chat` (+ фото) | то же (с фото — effort low) | свободный диалог | ~725 / ~230 |
| `POST /api/ai/check-solution` | gpt-5.4-mini, effort low, JSON-схема | проверка решения по фото | ~1200 / ~200 |
| `POST /api/ai/lesson-feedback` | gpt-5.4-nano, JSON-схема | отзыв + память наставника | ~490 / ~280 |

- Промпты — `src/server/prompts.ts` (на русском, язык ответа задаётся явно, казахская терминология перечислена).
- Защита: лимит по IP (40 / 15 / 20 запросов за 10 мин), дневной лимит на устройстве (60 обращений), обрезка всех входных полей, картинки только `data:image/(jpeg|png|webp)` до ~4 МБ; клиент сжимает фото до 1280px JPEG.
- Ответы стримятся (`text/plain`), рендер — `react-markdown` без HTML.
- Лог `[ai] route=… model=… in=… out=…` в серверных логах — для контроля затрат.

## Банк заданий (`lib/bank/`)

Единый источник заданий для уроков, тренировки, мини-игр и (позже) пробного ЕНТ. Каждый навык описан объектом `SkillBank` и умеет выдавать задания разных **форм**:

| Форма | Тип | Где нужна |
|---|---|---|
| `question` | обычный шаг урока (`QuestionStep`) | уроки, тренировка, Спринт, Башня, Босс |
| `statement` | утверждение + верно/неверно + почему | «Верю — не верю», «Ставка» |
| `pair` | пара «левое ↔ правое» | «Мемо-пары», «Бинго», соответствие |
| `short` | вопрос с коротким однозначным ответом | «Шифровка», «Бинго», Спринт с вводом |

`draw(shape, { skills, count, seed, minLevel, maxLevel, ramp })` достаёт задания: навыки чередуются, повторы отсеиваются, уровень растёт от первого задания к последнему. Правильность всегда вычисляет код. **Новая тема = новый файл `lib/bank/<тема>.ts` + строка в `lib/bank/index.ts`** — и она появляется во всех играх, которым подходят её формы.

## Мини-игры

- Контракт — `src/games/types.ts`: игра — один компонент `Game({ lang, sound, mode, onFinish })`, рисует только игровое поле, сама ведёт таймер и **один раз** вызывает `onFinish({ score, correct, total, attempts: [{ skill, correct }] })`.
- Файлы игры: `src/games/<id>/Game.tsx` (компонент), `strings.ts` (тексты ru/kk), `logic.ts` (чистая логика: генерация, проверка, очки) + `tests/games/<id>.test.ts`.
- Реестр: метаданные (название, правила, навыки, цвет) — `src/games/registry.ts`; ленивые компоненты — `src/games/components.ts`.
- Оболочка `components/games/GameShell.tsx` (маршрут `/game/[id]`): правила, **выбор темпа** и рекорд → игра → итоги (очки, «новый рекорд», XP).
- **Темп** (`GameMode`, выбор запоминается в профиле):
  - `calm` («Спокойно») — без таймеров, после ошибки разбор, есть все инструменты, XP вдвое меньше, без рекорда;
  - `normal` («Обычный») — время на задание по его сложности, калькулятор «как на ЕНТ», свой рекорд;
  - `blitz` («Блиц») — на скорость, без инструментов, отдельный рекорд (`games["<id>:blitz"]`).
- Награды (`lib/games.ts`, действие стора `recordGame`): XP = 2 за верное действие, не больше 30 за игру, +5 за новый рекорд; освоение навыка обновляется один раз за игру долей верных действий (если действий ≥ 3); игра продлевает серию дней.
- Игры открываются, когда пройден урок с их навыками. Список — в разделе «Тренировка».

## Видео

- Видео — это **React-компонент Remotion**, который проигрывается прямо в браузере через `@remotion/player`. Нет рендера mp4, нет хранения и CDN-трафика за видео; язык и субтитры переключаются пропсами.
- Сценарий и озвучка: `src/videos/<id>/script.ts` → `npm run voiceover -- <id>` (OpenAI `gpt-4o-mini-tts`, голос `coral`) → mp3 (обрезка тишины, mono 48 кбит/с) в `public/media/videos/<id>/<lang>/` + `durations.json`. Длительность сцен берётся из озвучки.
- Плеер грузится лениво (только на шаге видео). Реестр видео — `src/videos/registry.ts`.
- Урок 1: 7 сцен, ~75 сек, 880 КБ аудио на оба языка.

## i18n

- `dict.ts`: `ключ → { ru, kk }`; `useT()` даёт `t(key, params)` и `l(L)`. Язык — в профиле, переключается на лету.
- Контент уроков содержит оба языка внутри (`L`), поэтому урок — один файл.

## Тесты

- `tests/*.test.ts` (vitest): нормализация и проверка ответов, лесенка деления, уровни/серии/XP, модель освоения, генераторы (тысячи сгенерированных заданий проверяются валидатором), **валидация контента всех уроков** (двуязычность, корректные индексы, ответы проходят свою проверку, уникальные id).
- `e2e/*.spec.ts` (Playwright, `npm run e2e`): онбординг → урок (неверный/верный ответ, цвета обратной связи) → тренировка на казахском. Без обращений к ИИ. В облачной среде нужен `PW_CHROMIUM_PATH`.

## Этап 3 (v0.5): курс ЕНТ, навигация, пробный ЕНТ, конспекты 2.0

### Контент
- Курс — `src/content/course.ts` (`UNITS`: у раздела `icon`, `theme`, `entTopics`). Урок «готов», если он есть в `LESSONS`; название берётся из урока.
- Урок = три файла: `src/content/lessons/<id>.ts` (`export const lesson`), `src/lib/bank/<id>.ts` (`export const BANKS: SkillBank[]`), `src/content/ent/<id>.ts` (`export const ITEMS: EntItem[]`). Подключение — `node scripts/register-content.mjs` (пишет `generated.ts` в трёх папках). Проверка одного урока — `npx tsx scripts/check-content.ts <id>`; общие тесты — `tests/content.test.ts`, `tests/content-pool.test.ts`.
- Темы ЕНТ и их веса — `src/content/ent-topics.ts`; навык → тема — `SKILLS[].ent`.
- Задания: у вопроса может быть `scene` (код/таблица/схема под условием), `hint` (бесплатная подсказка), `whyWrong` (разбор каждого неверного варианта).
- Банк из статичных заданий — `lib/bank/pool.ts` (`poolBank`, варианты перемешиваются по seed вместе с `whyWrong`); id вида `<id>#<seed>` — хвост `#…` отбрасывается при отсеве повторов.
- Задания ЕНТ: `EntSingle` (4 варианта), `EntMulti` (6, 2–3 верных, 2/1/0), `EntMatch` (2 пункта × 4 описания), `EntContext` (текст/программа + 5 вопросов). Общий пул — `src/content/ent/index.ts` (`ENT_POOL`).

### Сцены (`components/scenes`)
`table` (в т. ч. `sheet` — как в Excel), `code` (подсветка, текущая строка, переменные, вывод), `circuit` (раскладка и значения — `circuit.ts`), `flow`, `cards` (иконки — `icons.ts`, имена `IconName`), `pixels`, `venn` (круги Эйлера на 2–3 множества: геометрия и места чисел — `venn.ts`, области `VennRegion` в `lib/types.ts`), `web` (iframe `sandbox=""`). Плюс прежние сцены двоичной системы. Валидация — `tests/validate.ts`.

### Хранилище v2 (`lib/store.ts`, версия 2)
- Профиль: `avatar`, `reminder`, `examDate`, `targetScore`, `weeklyLessons`. Недоверенные данные проверяются (`mergeState`, `sanitizeAvatar`).
- `lessons[id]`: `via` (learn/check/game/extern), `stage`/`dueAt` — расписание повторения (`lib/review.ts`: `scheduleAfter`, `dueLessons`, `lessonXpFactor`).
- `notebook` — конспекты 2.0 (`lib/notebook.ts`), картинки — IndexedDB (`lib/note-images.ts`).
- `exams` — итоги пробников; сами вопросы и ответы попытки — IndexedDB (`lib/exam-store.ts`).
- Новые действия: `completeLessons`, `markReviewed`, `createFolder/updateFolder/deleteFolder`, `createNote/updateNote/deleteNote`, `recordExam`, `importProgress`.
- Серия с заморозками — `lib/gamification.ts` (`bumpStreak`, `liveStreak`, `streakAtRisk`).

### Маршруты
| Адрес | Что |
|---|---|
| `/learn` | главная: быстрые действия, «Продолжить», «Путь» / «Карта ЕНТ» (`components/learn/*`, шторка урока `LessonSheet`) |
| `/lesson/<id>?mode=check` | «Проверить себя» (только задания, добор из банка до 6) |
| `/drill?mode=smart|skill|mistakes|review|extern&unit=|topic&topic=` | тренировки (`lib/drill.ts`) |
| `/game/<id>?lesson=<id>` или `?skills=` | урок игрой (≥ 70%, ≥ 5 ответов) |
| `/theory`, `/theory/<id>` | справочник и чтение урока без заданий |
| `/search?q=` | поиск (`lib/search.ts` + мягкий повтор `lib/theory.ts`) |
| `/notes`, `/notes/<noteId>`, `/notes/folder/<id>`, `/notes/lesson/<id>` | конспекты 2.0 |
| `/exam`, `/exam/run?kind=mini|full|topic&seed=&topics=`, `/exam/result/<id>` | пробный ЕНТ (`lib/exam.ts`, `lib/forecast.ts`); `/exam/run` — вне `(main)`, без навигации |
| `/profile`, `/stats` | профиль (аватар, цели, напоминания, копия), прогресс (`components/goals/*`) |

### ИИ: кэш и лестница подсказок
```
Кнопка «Подсказка» → hint автора (бесплатно) → «Ещё подсказка от Бита»
  → кэш на устройстве (lib/ai-cache.ts, 150) → POST /api/ai/tutor
     → neutral-запрос? → LRU в памяти → unstable_cache (30 дней) → OpenAI
     → подсказка: leaksAnswer? → повтор с NO_LEAK_NOTE → запасной текст (не кэшируется)
  ← X-AI-Cache: hit | miss | skip (hit → refundAi: дневной лимит не тратится)
```
Неперсональные (кэшируемые) запросы: `hint` и `explain` на первый запрос, `ask` с быстрым вопросом-кнопкой первым сообщением. Всё остальное (чат, вопросы своими словами) — как раньше, с портретом ученика. Все три маршрута ИИ отклоняют чужой `Origin`.

### Напоминания
`ReminderAgent` (в `Providers`) — таймер до времени напоминания, пока приложение открыто, и зеркало настроек в IndexedDB (`informatica:reminder`) → `public/sw.js` (`periodicsync` на Android с установленным приложением, `notificationclick` → `/learn`). Логика текста — `lib/reminders.ts` (продублирована в `sw.js`, совпадение проверяет тест). Календарь — `.ics` с `RRULE:FREQ=DAILY`.

## v0.6: экономика, тарифы, история тестов, школьная программа

### Экономика (`lib/economy.ts`, решения #31–#32)
Чистые функции, состояние — в сторе (версия хранилища та же, новые поля получают значения по умолчанию в `mergeState`).
```
plan   { tier: free|lite|unlimited, period, until, trial, trialUsed }   effectiveTier(plan, now)
hearts { count, updatedAt, day }      heartsNow/heartsView: новый день → полный запас; +1 за regenMs
wallet { chips, earned, spent }       ledger — история чипов (свежие записи одной причины склеиваются)
boost  { mult, until } | null         chipMultiplier = тариф × бустер
aiUsage { day, count, free }          quoteAi(kind) → AiReceipt: free (по тарифу) | plan (безлимит) | chips | ok:false (chips|cap)
paywall { lastShownAt, views }        shouldShowPaywall: бесплатным — раз в 3 дня
```
- **Начисление чипов** — одна функция `settleChips(prev, next, extra)` в сторе: разница XP (5 XP = 1 чип), пересечение дневной цели, новые достижения, бонусы (урок, без ошибок, пробный ЕНТ). Вызывается в конце `recordAnswer`, `finishSession`, `completeLessons`, `recordGame`, `recordExam`, `noteCombo`, `unlock`, `createNote`.
- **ИИ**: каждый вызов модели идёт через `spendAi(kind)` → квитанция; неудача запроса или ответ из кэша → `refundAi(receipt)` (чипы и бесплатное обращение возвращаются). Виды: `hint`, `explain`, `ask`, `chat`, `photo` (чат с фото и проверка решения), `review` (ИИ-разбор пробного ЕНТ), `feedback` (отзыв после урока — бесплатно).
- **Сердечки**: `loseHeart()` — ошибка с первой попытки в уроке; `finishSession` тренировки возвращает `heart: true`, если вернула сердечко; `buy(id)` — покупки за чипы (`SHOP_ITEMS`).
- **Деньги** (тарифы, `CHIP_PACKS`, `BOOST_PACKS`) — пока только `ComingSoonSheet` («Оплата скоро»); работает `startTrial()` — 7 дней «Безлимита» один раз.
- Интерфейс: хуки `components/economy/useEconomy.ts` (`useNow` — общие «часы» раз в 15 с, `useHearts`, `useChips`, `usePlan`, `useAiQuote`), магазин `/shop`, окно тарифов `/plans?from=…` (вне оболочки), `PaywallAgent` в `Providers`.

### История тестов (`lib/history.ts`, решение #33)
`history: HistoryEntry[]` (до 100, новые первыми) пишется в `finishSession` (урок, «Проверить себя», тренировки) и `recordExam` (пробный ЕНТ, `id = exam-<id попытки>`). У записи — неверные ответы с первой попытки (`WrongItem`), `fixed` — исправленные. Верный ответ на задание (в любом месте) и `dismissMistake` отмечают ошибку исправленной во всех записях (`markFixed`).
- Ошибки пробного ЕНТ: `stepId = "ent:<id>"` или `"ent:<id>:<n>"` (пункт соответствия / вопрос контекстного задания) → `lib/ent-steps.ts` превращает их в шаги урока для работы над ошибками.
- Экраны: `/history`, `/history/<id>`, `/drill?mode=history&entry=<id>` — исправить ошибки одного теста.

### Трек «Школьная программа»
`profile.track: "ent" | "school"`, классы `"5"…"11"`. Данные — `content/school-program.ts` (класс → разделы → темы → id готовых уроков), логика — `lib/school.ts`, карта — `components/school/*`; переключатель трека на `/learn`. Источники программы — `docs/SCHOOL.md`.

## v0.7: «Старт» с нуля, иллюстрации, практикум кода, ИИ-чат 2.0

### Раздел «Старт: компьютер с нуля» (решение #36)
Первый раздел `u0` в `src/content/course.ts` (8 уроков `base-*`, навыки `base.*` в `skills.ts`). Рекомендация «что дальше» (`components/learn/useLearn.ts`) пропускает `u0`, если `profile.skipBasics` (выбор «Основы знаю» в онбординге, переключатель в профиле → «Программа обучения»).

### Сцены-иллюстрации (`components/scenes`)
| Сцена | Компонент | Данные |
|---|---|---|
| `hardware` | `HardwareScene` | рисунки `HARDWARE_ART` (`scenes/hardware/`: `internals.tsx` — детали и носители, `devices.tsx` — устройства и «компьютеры вокруг нас»), названия `HARDWARE_NAMES` |
| `pc-inside` | `PcInsideScene` | системный блок изнутри, подсветка `PcPart[]` |
| `cpu-cycle` | `CpuCycleScene` | выборка → декодирование → выполнение → запись |
| `keyboard` | `KeyboardScene` | подсветка клавиш сочетания |
| `sizes` | `SizesScene` | объёмы (логарифмическая шкала, Б…ТБ по 1024) |
| `files` | `FilesScene` | дерево папок, путь `C:\…` |
| `layers` | `LayersScene` | слои (ОС, уровни памяти) с осью |
| `venn` | `VennScene` | круги Эйлера: `sets`, `values`, `highlight`, `universe`; области заливаются через `clipPath` |
Проверка данных сцен — `tests/validate.ts` (`validateScene`), используется `scripts/check-content.ts`.

### Практикум кода (`/code`, решение #35)
```
/code → /code/<lang> (задачи | песочница) → /code/<lang>/<task>
IdeShell (условие, подсказка, решение, итог, XP, «Объясни ошибку» — AiPanel)
  └─ IDE_REGISTRY[lang].Workspace (лениво, только в браузере)
       python: public/ide/python-worker.js (Pyodide с CDN, таймаут, trace) · sql: sql.js (wasm с CDN), база src/lib/ide/sql/db.ts
       web: iframe sandbox="allow-scripts" + postMessage с nonce · js: public/ide/js-worker.js · excel: src/lib/sheet (движок формул)
```
Контракт — `src/lib/ide/types.ts` (`IdeTask`, `IdeCheck`, `CheckResult`, `WorkspaceProps`), задачи — `src/lib/ide/<lang>/tasks.ts`, черновики — `src/lib/ide/drafts.ts` (localStorage), прогресс — `codeTasks` и `recordCodeTask(task, ok)` в сторе.

### ИИ-чат 2.0 (`/tutor`, решение #37)
- Список — `AppState.chats: ChatMeta[]` (`lib/chats.ts`), сообщения — IndexedDB (`lib/chat-store.ts`, `informatica:chat:v1:msgs:<id>`). Старый `chat` переносится в первый чат.
- Режим чата и тема уходят на сервер (`TutorRequest.chatMode`, `topic`) → `CHAT_MODE_RULE` в `server/prompts.ts`.
- «Дай задачи» — `components/chat/quiz/ChatQuiz` (банк заданий, `evaluate`, `recordAnswer`, `finishSession({kind:"drill", mode:"chat"})`), оценка `quizGrade`.
- Голос: `VoiceButton` → `spendAi("voice")` → `POST /api/ai/transcribe` (`MODELS.stt`); озвучка — `speechSynthesis` браузера.

## v0.8: курс 2.0, группы разделов, контрольные, план, подсказки без ИИ

### Навигация (решение #39)
- Конфигурация — `src/components/app/nav.ts`: `NAV_GROUPS` (Учиться · Практика · ИИ-чат · Материалы · Прогресс) с подразделами, чистые `groupOf(path)`, `subOf(path)`, `hubGroup(path)` (тесты `tests/nav.test.ts`).
- `AppShell`: нижняя панель телефона и боковое меню компьютера строятся из `NAV_GROUPS` (у активной группы в меню раскрыты подразделы); `SectionTabs` — строка подразделов над содержимым хаб-страниц (на телефоне), страницы её не подключают сами. Новая страница `/materials`.
- Шпаргалка — вкладка `cheat` «Инструментов» (`components/tools/CheatSheet.tsx`, данные и таблицы считает `cheat-data.ts`); `openCheatSheet()` открывает её из «Материалов».

### Подсказки без ИИ
- Статическая подсказка есть у всех заданий уроков, банка и ЕНТ (`EntItem.hint`, `EntContextQuestion.hint`; `check-content` предупреждает о пропуске). `lib/ent-steps.ts` переносит её в шаг работы над ошибками (варианты там перемешиваются: `drill.ts` + `shuffleOptions`).
- `lib/ai-static.ts` → `staticAiText(mode, task)`: бесплатный текст шторки (подсказка или разбор неверного варианта + объяснение). `AiPanel` сам ИИ не вызывает: только кнопка с ценой.

### Контрольная по разделу и план
- Вид пробного теста `unit` (`lib/exam.ts`): 15 заданий (10 single, 2 multi, 2 match, 1 вопрос контекста) по навыкам уроков раздела, 25 минут, `?kind=unit&unit=<id>`. `components/exam/checkpoint.ts` — `checkpointOf/ById`, ленивый пул ЕНТ (`useEntPool`), `examTitle`; на карте — `CheckpointNode` (звёзды по лучшему итогу из `exam-store`), в «Пробном ЕНТ» — список контрольных.
- План подготовки — `lib/plan.ts` (`buildPlan`: недели до даты ЕНТ или 12, ≤ 7 уроков в неделю, контрольная после раздела, мини-ЕНТ раз в 2 недели, последние недели — повторение и полные пробники; тесты `tests/plan.test.ts`), UI — `components/plan/*`, страница `/plan`, карточка `PlanCard` на `/learn`.

### Контент
- 113 уроков (`course.ts`), регистрация частями: `node scripts/register-content.mjs --add=id1,id2` (добавляет к уже подключённым, недописанные файлы не трогает).
- Практикум: 100 задач; движок таблиц `lib/sheet` знает текстовые функции (`СТРОЧН`, `ПРОПИСН`, `ДЛСТР`, `СЦЕПИТЬ`, `ЛЕВСИМВ`, `ПРАВСИМВ`, `&`); список задач языка группируется по навыку.
- Магазин: `ShopStatus` (строка сердечек и бустера, часы `useNowSeconds` через `useSyncExternalStore`).
