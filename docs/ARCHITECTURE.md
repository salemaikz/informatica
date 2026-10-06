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
- **Портрет для ИИ** (`lib/student-context.ts`): имя, класс, цель, стиль объяснений, уровень, слабые/сильные темы с %, 5 последних ошибок, личные заметки, пройденные уроки («памяти наставника» с v0.18 нет, #112). На сервере всё обрезается по длине (`server/context.ts`).
- **Память наставника**: после урока дешёвая модель возвращает обновлённые заметки (≤ 600 символов) — что западает, что помогает, какой стиль подходит. Ученик видит и может удалить их на странице «Прогресс».

## Геймификация (`lib/gamification.ts`)

| Механика | Правило |
|---|---|
| XP | 10 за верный ответ, +5 при комбо ≥ 3, 5 за исправленную ошибку; +20 за урок, +20 за урок без ошибок; +10 за тренировку |
| Уровень | уровень n начинается с 50·n·(n−1) XP (0, 100, 300, 600, 1000…), названия: Новичок → Бит → Байт → Килобайт… |
| Серия | +1 за каждый день с хотя бы одним ответом; пропуск дня обнуляет |
| Дневная цель | 20 / 50 / 100 XP (выбирается в онбординге) |
| Комбо | счётчик верных подряд в уроке (огонёк вверху) |
| Ступень уровня | `levelTier(level)`: 1–4 обычная, 5–9 редкая, 10–19 эпическая, 20–29 легендарная, 30+ мифическая; вид — `components/app/LevelBadge.tsx` (мягкий фон → кольцо → кольцо и свечение → свечение и блик → переливающийся кант и искры) |
| Достижения | 35 штук, у каждого `rarity` (обычное 12 · редкое 10 · эпическое 8 · легендарное 5); проверяются в сторе после каждого действия: «свои» условия — в `evaluate`, пороги по данным стора (уроки, серии, пробники, уровни, код, освоение) — в `lib/achievement-rules.ts`; чипы за новое достижение — по редкости (`ACHIEVEMENT_CHIPS`, 5 / 10 / 20 / 40) |

## ИИ

| Маршрут | Модель | Что делает | Расход (замер) |
|---|---|---|---|
| `POST /api/ai/tutor` mode=`hint` | gpt-5.4-mini, effort none | 1 подсказка без ответа | ~725 вх / ~85 вых токенов |
| … mode=`explain` | то же | разбор ошибки ученика | ~850 / ~160 |
| … mode=`chat` (+ фото) | то же (с фото — effort low) | свободный диалог | ~725 / ~230 |
| `POST /api/ai/check-solution` | gpt-5.4-mini, effort low, JSON-схема | проверка решения по фото | ~1200 / ~200 |
| `POST /api/ai/lesson-feedback` | gpt-5.4-nano, JSON-схема | отзыв + фокус (без памяти, #112) | ~490 / ~280 |

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
- Курс — карта `src/content/course-map.ts` (`UNITS`: у раздела `icon`, `theme`, `entTopics`; с этапа 16 — отдельно от содержимого), уроки целиком — `src/content/lessons/all.ts` (`LESSONS`, реэкспорт из `content/course.ts`). Урок «готов», если он есть в каталоге (`content/catalog.generated.ts`, повторяет `LESSONS`); название берётся из урока.
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
- Новые действия: `completeLessons`, `markReviewed`, `createFolder/updateFolder/deleteFolder`, `createNote/updateNote/deleteNote`, `recordExam` (`importProgress` удалён в v0.9.1 — резервной копии нет, решение #60).
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
- **Начисление чипов** — одна функция `settleChips(prev, next, extra)` в сторе: пересечение дневной цели, новые достижения и награды `extra` (урок 3/1, идеальный +5, пробный ЕНТ, тест раздела); за опыт чипов нет (#105), числа — `CHIP_REWARD`. Серия идеальных уроков — `lib/perfect.ts` (`nextPerfectRun`), поле `perfectRun`, меняется только в `finishSession`. Вызывается в конце `recordAnswer`, `finishSession`, `completeLessons`, `recordGame`, `recordExam`, `noteCombo`, `unlock`, `createNote`.
- **ИИ**: каждый вызов модели идёт через `spendAi(kind)` → квитанция; неудача запроса или ответ из кэша → `refundAi(receipt)` (чипы и бесплатное обращение возвращаются). Виды: `hint`, `explain`, `ask`, `chat`, `photo` (чат с фото и проверка решения), `review` (ИИ-разбор пробного ЕНТ), `feedback` (отзыв после урока — бесплатно).
- **Сердечки** (этап 11, #40): плата за вход — `payEntry(cost)` (не хватает — ничего не списано), цены — `ENTRY_COST` / `entryCost` / `lessonCost` в `lib/economy.ts`; `finishSession` тренировки (кроме экстерна) возвращает `heart: true`, если вернула сердечко (`practiceHeartsLeft`); `buy(id)` — покупки за чипы (`SHOP_ITEMS`, цена полного запаса — `itemPrice`).
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
- Конфигурация — `src/components/app/nav.ts`: `NAV_GROUPS` (с v0.18 — Учиться · Практика · Материалы · Прогресс; ИИ-чат — плавающая кнопка Бита, #110) с подразделами, чистые `groupOf(path)`, `subOf(path)`, `hubGroup(path)` (тесты `tests/nav.test.ts`).
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

## v0.9: этап 10 — честные цифры и основа

### Хранилище сервера (`server/kv.ts`)
- `getKv()` — счётчики и списки для серверных маршрутов: Upstash Redis по REST (`UPSTASH_REDIS_REST_URL`/`TOKEN` или `KV_REST_API_URL`/`TOKEN` из Vercel Marketplace), иначе память процесса (в production — одно предупреждение в журнал). Сбой Upstash → память, сайт не падает. `kzDay()` — сутки по Астане (UTC+5).

### Страж ИИ (`server/ai-guard.ts`, решение #54)
- Каждый маршрут `app/api/ai/*`: `guardAi(req, { route, units })` → отказ (`403 forbidden_origin`, `429 rate_limited`/`daily_limit`, `503 ai_busy`) или `GuardOk` с `release()` и cookie нового устройства (`withGuardHeaders`).
- Порядок: строгий `sameOrigin` (production — только с `Origin`) → устройство по подписанной cookie `inf_ai` (HMAC, `Path=/api`) → новые устройства с IP → всплеск (устройство и IP) → суточные лимиты устройства, IP и сайта. Списание атомарное (`incrBy`) до вызова модели; отказ на любом шаге откатывает уже списанное.
- IP — `clientIp()`/`ipKey()` в `server/rate-limit.ts`: первый адрес `x-forwarded-for`, IPv6 по /64, в хранилище — хеш. `kvRateLimit` — всплеск в общем хранилище; `preCheckAi` в `tutor` — дешёвый счётчик до разбора тела.
- `release()` — только если модель запрос не получила (`openAiRejected(e, signal)` в `server/openai.ts`: `APIError` со статусом и без обрыва клиентом). Таймаут вызова — `callTimeoutMs(maxDuration)`, потолки токенов на выход — `MAX_TOKENS`, бюджет входа — `INPUT_BUDGET` (символы: чат 16 000, фото 6 000 + изображение, отзыв 6 000) и `fitInput()` в `server/context.ts`: сначала отбрасывается старая история, потом укорачиваются необязательные части контекста; системные правила и последний вопрос не трогаются (#64). В лог `[ai]` пишется `chars=`.
- Клиент считает те же «обращения»: `AI_UNITS` и `AI_DAILY_CAP` в `lib/economy.ts`; коды ошибок → тексты — `lib/ai-errors.ts` (`aiCodeKey`) и `aiErrorKey` в `lib/ai.ts`.

### Поток ответа и кризис
- `lib/ai-stream.ts`: ответ `tutor` заканчивается `\u0000OK` / `\u0000CUT` / `\u0000ERR`; `splitStreamTail` → `ok | cut | error | open`. `streamTutor` без `ok` бросает `AiError("stream_cut")`, `useTutor` возвращает обращение; «Повторить» — в `ChatScreen` и `AiPanel`.
- `lib/safety.ts` `detectCrisis` (ru и kk) → ответ без модели из словаря (`ai.crisis.*`), обращение не списывается. Страховка — строка в общей части промпта.

### Сообщения об ошибках (`/api/issue`, решение #56)
- `lib/issue.ts` — типы, причины, лимиты, проверка и обрезка тела (`parseIssue`), отправка с клиента; `components/issue/ReportIssueButton.tsx` — кнопка и шторка (портал в `body`, общий набор «в полёте»). Запись — строка `[issue]` в журнал и `pushCapped` в `issues` / `client-errors`.
- `lib/client-errors.ts` + `components/app/ClientErrorReporter.tsx` (в `app/layout.tsx`, вне `Providers`) — автоотчёты о сбоях в production; страницы `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (язык без стора — `readStoredProfile` в `lib/client-errors.ts`).

### Сохранение (`lib/safe-storage.ts`, решения #57, #60)
- Стор пишет через `safeStorage`: статусы `ok | memory | full` (баннер `StorageBanner`). Нечитаемое сохранение (битый JSON, сбой чтения, миграции или слияния) не перезаписывается: запись в основной ключ заблокирована, `Providers` показывает `RecoveryScreen` («Попробовать ещё раз», «Начать заново» с подтверждением; фаза `hydrationPhase`: loading → ready | failed, таймаут 4 с). Копий и выгрузок нет (#60); старый ключ `informatica-v1-broken` при запуске удаляется.
- `requestPersistentStorage()` — по нажатию в конце онбординга. `downloadBlob` (`lib/download.ts`) — только для файла напоминаний (.ics).

### Школьный трек и правовые страницы
- `entVisible(profile)` (`lib/school.ts`) / `useEntVisible()` — одна точка решения «показывать ЕНТ»; `visibleGroups`/`hubGroup` в `components/app/nav.ts`; `EntOnly` — карточка на `/exam`, `/exam/run`, `/plan` (`ENT_ONLY_PATHS`).
- `/privacy`, `/terms` — `components/legal/LegalPage.tsx`, тексты — `content/legal.ts` (ru и kk; подрядчики и технологии не названы, решение #62; контакт — `LEGAL_CONTACT`); «Кто мы» убрано (#60); язык гостя — `lib/guest-lang.ts`.
- Прогресс общий для обоих треков: «урок пройден» — одно определение `isPassedStat` (`lib/school.ts`) для школьной карты и карт курса ЕНТ; источник — `lessons`/`skills` стора, `profile.track` на них не влияет (#63). Превью ссылки — `metadata` в `app/layout.tsx` (`lib/site-meta.ts`) и `public/og.png` (`scripts/og-image.mjs`).

### Веса ЕНТ
- `content/ent-topics.ts`: `examCount` по плану НЦТ, `CONTEXT_TOPICS = ["t06", "t07"]`, `topicWeight`; раскладка «Карты ЕНТ» — `components/learn/ent-grid.ts` (`fillGrid` повторяет `grid-flow-row-dense`, тест — `learn-map`).

## v0.10: этап 11 — сердечки 2.0 и продолжение урока

### Плата за вход (`lib/economy.ts`, решения #40, #65)
- `ENTRY_COST` (урок 1, «Проверить себя» 1, пробный ЕНТ 1, контрольная 2, экстерн 2, игра 1), `lessonCost(lesson)` (`Lesson.hearts = 2` — большой урок), `entryCost(kind, lesson?)` («урок игрой» — как урок); `spendHearts` / `canAfford`; стор — `payEntry(cost)`.
- Где списывается: `LessonPlayer` — `ensurePaid()` в обработчиках «Проверить» и «Пропустить» (проп `entryCost`; урок, «Проверить себя», экстерн); `ExamRun` — по «Начать» (`canAfford` → создание попытки → `payEntry`); `GameShell` — `start()` (каждый запуск). Только из обработчиков: эффекты в режиме разработки срабатывают дважды.
- Вход на экран: `components/economy/EntryGate` (`need` — цена или 0) → полноэкранное `OutOfHearts`; внутри экрана — шторка `OutOfHearts need` (`onResume` — один раз за открытие). Значок цены — `HeartCost` (при безлимите скрыт), «−N» — `HeartsBar`.

### Незаконченный урок (`lib/lesson-run.ts`, решение #41)
- `lessonRuns: Record<id, LessonRun>` в сторе (в резервную копию не входит): очередь `{id, retry}`, `pos` (следующий непройденный шаг), ответы, XP, комбо, `activeMs`, `xpFactor`, `chipsEarned`, `cost`, `paidAt`, `updatedAt`, отпечаток шагов `sig` (`lessonSig`). До `RUN_MAX` = 5 уроков, `RUN_TTL_MS` = 14 дней; `sanitizeLessonRuns` — проверка данных из localStorage.
- Плеер (`saveRun`) пишет снимок (`components/lesson/run-snapshot.ts` → `buildRun`) в обработчиках: после оплаты входа (на текущем шаге), после ответа (`pos + 1`, повтор ошибки уже в очереди), при переходе к шагу; после выхода с экрана не пишет. `finishSession` урока в режиме «Учиться» удаляет сохранение.
- `LessonScreen`: `usableRun` один раз при входе → `ResumeLesson` («Продолжить» бесплатно, если `runPaid` — оплачен и не позже `RUN_GRACE_MS` = 20 мин с последнего действия; оплата перепроверяется при нажатии) или плеер с нуля; `restoreRun` восстанавливает состояние плеера.


## v0.11: этап 12 — аналитика, прогресс, честные цифры, старт

### Честные цифры (решения #66–#68)
- **Точность** — `lib/accuracy.ts`: `tallyOf(records)` (первые попытки; `AnswerRecord.skipped` — счёт 0; `hinted` — отдельно), `accuracyOf`, `completionOf`, `daysAccuracy(days)` (по новым полям дня, иначе «приблизительно» по старым). У дня (`DayStat`) — `asked/score/skipped/hinted`, игры — `games/gameCorrect/gameSeconds`; старые `answers/correct` остаются для дней до v0.11.
- **Освоение** — `lib/mastery.ts`: `updateSkill(stat, score, now, { weight, clean, day })`, вес `answerWeight` (подсказка или повтор — 0,5), `masteryLevel` (≥ 0,8 + `MASTER_CLEAN` = 4 самостоятельных верных + `MASTER_DAYS` = 2 дня; поля `clean/okDays/okDay`), `migrateSkillStat` (при каждой загрузке в `mergeState`: старым навыкам с оценкой ≥ 0,8 и ≥ 6 ответами — «освоено»), `seedSkill` (диагностика, ≤ 0,45).
- **Активное время** — `lib/active-time.ts` (чистые `tick`/`input`/`takeSeconds`, `studyKindOf(pathname)`, пороги простоя 60 с / 3 мин), `lib/active-clock.ts` (часы вкладки: `startActiveClock`, `setStudyPath`, `activeMs()`), `components/app/ActiveTimeAgent.tsx` в `Providers` → `addActiveSeconds(sec, game)` — единственный писатель `DayStat.seconds`. Плеер считает длительность урока и время ответа разницей `activeMs()`.
- **Плеер** — `lib/player-events.ts`: запись пропуска, итог сессии через `tallyOf`, события урока; флаг «с подсказкой» — шторка ИИ в фазе ответа.
- **Срез по навыкам** — `lib/skill-days.ts`: `skillDays[день][навык] = { n, s, h?, sec? }`, 60 дней; пишут `recordAnswer`, `recordCodeTask`, `recordExam`.

### Прогресс ученика (решение #71)
- `lib/progress.ts`: `courseProgress` (готовые уроки на карте, `skipBasics` исключает `u0`), `unitRows`, `topicStats`, `topicTrend`, `weakSpots` (+ `drillHref`); компоненты — `components/progress/*` (`CourseProgressCard`/`CourseProgressBadge`, `UnitProgressList`, `TopicTable` со спарклайном, `WeakSpotsCard`, плитки статистики). «Слабые места» в оболочке (`Widgets.tsx`) — через `next/dynamic` без SSR.

### Старт (решение #70)
- Онбординг (`app/onboarding/page.tsx`) → ЕНТ: `/diagnostic?from=onboarding`; школа: окно тарифов. Диагностика: `lib/diagnostic.ts` (`buildDiagnostic` — 10 single A/B по темам, `scoreDiagnostic`), экран `app/diagnostic` + `components/diagnostic/*` (пул ЕНТ — динамический импорт), сохранение — `recordDiagnostic` (профиль `diagnostic`, мягкий посев навыков, `skipBasics`). Прогноз (`lib/forecast.ts`): `basis: "diagnostic"`, пока нет пробников и меньше 30 ответов; дальше темы с ответами меньше `TOPIC_PRACTICE_MIN` берутся из диагностики. Профиль: `targetScoreSet` («пока не знаю» → без цели на графиках).

### Аналитика и обратная связь (решения #47, #69)
- Контракт событий — `lib/analytics.ts` (`AnalyticsEvent`, `track`, `setAnalyticsSink`); проверка — `lib/analytics-schema.ts` (общая для клиента и сервера); отправка — `lib/analytics-client.ts` (буфер, пачки, `sendBeacon`, событие удержания `active`), приёмник — `components/app/AnalyticsAgent.tsx` в `Providers` до экранов. Включено только при `NEXT_PUBLIC_ANALYTICS=1` и `profile.analytics`.
- Сервер: `app/api/events` (sameOrigin → лимит по хешу IP до чтения тела → тело ≤ 4000 байт → проверка → потолки событий и новых полей) → `server/kv.ts` (`hincrMany` в хеш дня `ev:<день>`). Общие помощники — `server/body.ts`, `server/ip-hash.ts`.
- Владелец: `app/owner` + `app/api/owner/{login,logout}` (`server/owner-auth.ts` — cookie с HMAC и сроком, `OWNER_SECRET`; `server/owner-data.ts`, `lib/owner-report.ts` — сводка из счётчиков и списков жалоб/ошибок). Не кэшируется сервис-воркером, не требует онбординга.
- Отзывы: `/feedback` (`components/issue/FeedbackScreen.tsx`, вид обращения `feedback` в `lib/issue.ts`), «Что помешало?» — `components/issue/BreakReasonCard.tsx` в `AppShell`.

## v0.12: этап 13 — поделиться результатом, вызов другу, отчёт родителю

### Три транспорта ссылок (решения #72–#74)
- **Результат** — `/r/<код>`: код в пути (`lib/share-code.ts`: `x1-…` пробник, `c1-…` курс/класс, `s1-…` серия; только числа и метки, строгий разбор, принимается только каноническая запись). Сервер видит код → `app/r/[code]/page.tsx` (`generateMetadata` на языке из кода, `noindex`) и `opengraph-image.tsx` / `twitter-image.tsx` (картинка 1200×630, разметка — `components/share/og-image.tsx`, шрифты — `assets/fonts/*.ttf`, кэш на год; новая версия дизайна — новый префикс). Экран получателя — `components/share/ResultLanding.tsx` (модель — `components/share/landing.ts`).
- **Вызов** — `/exam/run?kind&seed[&topics]&ch=<баллы>-<максимум>-<тег>` (`lib/challenge.ts`). Тег банка — `lib/exam-pool.ts` (`currentPoolTag`: FNV по id заданий + `EXAM_BUILD_VERSION`; сторож — `tests/challenge.test.ts`). Попытка хранит `pool` и `challenge` (`lib/exam-store.ts`), итог — `pool` (`ExamSummary`). `ChallengeBanner` перед стартом, `ChallengeCompare` в итогах.
- **Отчёт родителю** — `/report#d=<z|r><base64url>`: данные во фрагменте (`lib/hash-pack.ts`: JSON → deflate-raw → base64url, защита от «бомбы», без сжатия — `r`), схема и разбор — `lib/parent-report.ts` (v2, `parseParentReport`; лёгкий — его грузит `/report`), сборка из стора — `lib/parent-report-build.ts` (`buildParentReport`: курс, прогноз, точность и минуты за 7 дней). Страница — `app/report/page.tsx` (`noindex`, `no-referrer`) + `components/report/ReportView.tsx`; окно в профиле — `components/report/ReportShareSheet.tsx`.

### Отправка
- `lib/share.ts` (WhatsApp/Telegram, системное меню с файлом и без, буфер) и `components/share/ShareTargets.tsx` — общий блок «Отправить / WhatsApp / Telegram / Скопировать ссылку» (событие `share`). Карточка-картинка 1080×1920 — `lib/share-card.ts` (canvas, светлая палитра = `:root` из `globals.css`, сверка тестом), лист — `components/share/ShareSheet.tsx` (картинка рисуется по нажатию; «Сохранить картинку» — только если меню не принимает файлы). Кнопки: `ExamShareActions` (итоги пробника), `CourseProgressCard`, плитка серии в `StatsTiles`.
- Шкала курса для карточки и отчёта — `lib/course-view.ts` (`courseViewOf`, хук `useCourseView` — обёртка).

### Возврат после онбординга и страницы получателя
- `lib/pending-link.ts`: `Providers` перед редиректом на онбординг сохраняет адрес варианта с вызовом (только `/exam/run` с верными `kind`, `seed`, `ch`; адрес пересобирается из разобранных полей; час), онбординг после «Поехали» открывает его вместо диагностики.
- `lib/public-paths.ts`: `/report` и `/r/*` — без онбординга; `isRecipientPath` — на этих страницах `AnalyticsAgent` не шлёт `active`, а сбой чтения сохранения не показывает экран восстановления. Сервис-воркер не кэширует `/r/`.
- Статистика (#69): `share {what, how}`, `share_open {what}`, `challenge {step}` → поля `sh:`, `so:`, `chl:`; раздел «Поделиться» на `/owner`.

## v0.13: этап 14 — курс 3.0

### Освоение с затуханием (`lib/mastery.ts`, решение #80)
- В сторе `skills[id].mastery` — оценка «на момент `lastSeen`». `decayedMastery(stat, now)` = `0,5 + (m − 0,5) · 2^(−дни/30)` для m > 0,5; `decaySkills(stats, now)` — весь набор (тот же объект, если ничего не затухло; `now = 0` — без затухания).
- Читатели: компоненты — хук `components/progress/useSkillStats.ts` (минутные часы `useMinuteClock`, на сервере 0 → гидратация не расходится); игры — `games/live-mastery.ts` (в обработчиках); `DrillScreen.buildSession`, `lib/student-context.ts`, `lib/parent-report.ts`, `ChatQuiz` — `decaySkills(…, Date.now())` в момент действия.
- `updateSkill` сдвигает затухшую оценку; `recordGame` в темпе «Спокойно» — вес 0,5. Достижения, запись и миграции — по сохранённой оценке.

### Группы и узлы курса 3.0 (`content/groups.ts`, `lib/course-mix.ts`, `lib/course-nodes.ts`, решение #81)
- `GROUPS_BY_UNIT` — группы уроков каждого раздела (с названиями ru/kk), `COURSE_GROUPS` — все группы в порядке карты (тест сверяет с `UNITS`). id узлов: `practice:<первый урок группы>` (после не последней группы), `recap:<раздел>`.
- Сборка (чистые функции): `buildPractice(group)` 12 / `buildRecap(unit)` 15 — доли текущая / 3 предыдущие группы / всё раньше = 50/30/20 (`round(0,3n)`, `round(0,2n)`), из прошлого — только «тронутые» навыки, пустая доля уходит дальше; каждая доля — `buildFromBank` (веса `(1,1 − освоение)²` по затухшему освоению), итог A → C. `buildMiniTest(group)` — 4 single + 1 multi + 1 match из `ENT_POOL` навыков группы, варианты перемешаны (`shuffleEntItem`), без `hint`; `miniTestPoints` — баллы как на ЕНТ.
- Маршруты: `/drill?mode=practice|minitest&node=practice:<урок>`, `/drill?mode=recap&unit=<раздел>`. Мини-тест — `ENTRY_COST.check` (1 сердечко), `LessonPlayer testMode` (нет подсказки и «Спросить Бита» до ответа, ошибки не повторяются).
- Прогресс узла — `store.courseNodes` (`runs/best/at`, у практики ещё `testRuns/testBest/testAt` — доля баллов мини-теста); `recordCourseNode` в `DrillScreen.onSessionFinish`. В «% курса» не входит.
- Карта: `map.ts` — `unitPathItems(unit)` (уроки + узлы), `pathPassed` (практика не рвёт дорогу, если её уроки пройдены), `unitNodeStates` (один «рекомендуется» на раздел); `PracticeNode`, `PracticeSheet` (лист с «Начать практику» / «Мини-тест» / «Начать повторение»).

### Награда по длине (`lib/gamification.ts`, решение #83)
- `SessionResult.planned` (шагов-вопросов в сессии) и `micro` ставит `LessonPlayer`; `rewardFactor(result)`: урок — 0,6 у микроурока, иначе 1; тренировка — `lengthFactor(planned)` (≤ 5 → 0,6, ≥ 10 → 1,5), но 1,5 только у `practice`/`recap`. Множитель — к бонусу XP за прохождение и к чипам урока.

### Микроуроки (решение #82)
- `Lesson.micro: true`: 9–12 шагов, 4–6 заданий (≥ 1 с `ent`), 3–5 минут, навык — общий с родительским уроком (своего банка и файла ЕНТ нет). Нормы — `scripts/check-content.ts` и `tests/micro-lessons.test.ts`.

### Формат ЕНТ в уроках (`lib/ent-boss.ts`, решение #84)
- Шаг `EntMatchStep` (`type: "entmatch"`, 2 пункта × 4 описания, `answer` — 2 индекса), ответ `{type:"entmatch", picks}`, оценка `matchPoints` → 1 / 0,5 / 0; вид — `steps/EntMatchView.tsx`.
- `withEntBoss(lesson)` (в `LessonScreen` для «Учиться», «Проверить себя» и «Продолжить»): нет `entmatch` → одно «соответствие» из банка урока, нет multi на 6 с `ent` → одно «несколько верных»; выбор — минимум `hash(урок|задание)` (устойчив к пополнению банка), варианты — `shuffleEntItem(item, hash(урок))`; вставка — после последнего задания ЕНТ; микроурок — без изменений. `lib/lesson-size.ts` — «N шагов» на карте без загрузки банка.
- `ent:<id>` на «соответствие» без номера пункта → `entmatch` (`entMatchStep`); `shuffleOptions` (работа над ошибками) перемешивает и `entmatch`. Реестр шагов статистики (`server/analytics-ids.ts`) строится по `withEntBoss(lesson).steps`.

### Практикум (решение #85)
- «Стоп»: `stopPython()` / `stopJs()` завершают текущий запуск с `stopped: true` и выводом до остановки, отменяют очередь; следующий запуск пересоздаёт воркер.
- Шаг `CodeStep` (`type: "code"`, `task` — id задачи `lib/ide/python/tasks.ts`): `steps/CodeStepView.tsx` (ленивая загрузка) → `CodeStepInner.tsx`: «Проверить код» (`checkPython` с `PY_FORBID`), повторные проверки, «Показать решение»; итог — `onAnswer({type:"code", ok, tries, code}, {submit:true})`; оценка 1 / 0,5 / 0; кнопка «Проверить» плеера у шага скрыта, «Пропустить» — есть; в конце урока не повторяется.
- Сцена `code` с `run: true` (только Python) — `components/ide/python/RunPanel.tsx`: «Запустить», поле ввода (если программа читает `input()`), вывод, «Стоп».
- Контекстные задания: `lib/context-drill.ts` (`contextItems`, `buildContextDrill` — 5 шагов `ent:<id>:<n>` со сценой `run`), страница `/code/context` (`components/ide/ContextHub.tsx`), режим `/drill?mode=context&item=<id>`.

## v0.14: этап 15 — «чтение кода» как на ЕНТ, школьная программа 2.0, правки по отзыву

### «Чтение кода» (`lib/code-read.ts`, решения #87–#88)
- У задания ЕНТ и вопроса контекстного задания — поле `read?: ReadKind` (`output` · `bug` · `fix` · `fill` · `purpose` · `schema`). Нет поля — вид выводится по тексту условия (ru) и сцене: `readKindOf` (кэш в `WeakMap`), материал для чтения — сцена `code`/`web`/`flow`, таблица в t09/t10/t12 или `код` в условии практической темы. `isReadItem` — обычное задание «на чтение».
- Квота в варианте (`lib/exam.ts`): `READ_SHARE` по темам (t06 — все, t07/t10/t13 — 2/3, t09/t12 — 1/2), `readTarget(тема, слотов)` с округлением вверх; слоты single идут первыми. Контрольная практического раздела (≥ 20% заданий «на чтение») — ≥ половины single. Выбор вида — `pickRead`: вес `min(заданий вида, 6) / (1 + взято)`, затем случайное задание вида — разнообразие без «прибитых» редких заданий. `EXAM_BUILD_VERSION = 3`, вид чтения — в подписи задания для тега «вызова другу».
- «Босс урока» (`lib/ent-boss.ts`): уроки `REVIEW_LESSON_RE` (`py|algo|db|data|web`) получают одно single bug/fix/fill/purpose из своего банка; `lessonStepCount` (`lib/lesson-size.ts`) учитывает его без загрузки банка.
- Тренировка `/drill?mode=codeview&area=py|db|sql|sheet|web|mix` (`lib/code-review-drill.ts`, области — лёгкий `lib/code-review-areas.ts`): 10 заданий, уровни 5/3/2, `pickRead` («что выведет» стартует с одного «взятого»). Страница `/code/review` — счётчики считает сервер (`page.tsx`), в клиент банк ЕНТ не уходит.

### Школьная программа 2.0 (`content/school-program.ts`, `docs/SCHOOL.md`)
- Данные — по долгосрочным планам приложений 55 (5–9), 108 (10–11 ЕМН), 109 (10–11 ОГН) к приказу № 399: разделы с `quarter`, у 10–11 — два плана с `direction: "emn" | "ogn"`. `schoolPlan(grade, direction)`; `profile.direction` (по умолчанию `emn`) — выбор на школьной карте (`DirectionPicker`) и в настройках; учитывают прогресс класса (`course-view`, `UnitProgressList`, отчёт родителю).
- Школьный урок — `Lesson.school: true`, `unitId: "school"`: не на карте ЕНТ (нет в `UNITS`), без заданий ЕНТ и «босса», навыки `school.*` без темы ЕНТ (`isSchoolSkill`) — их нет в разделах «Практики» и в прогнозе ЕНТ; «следующий урок» после него — нет (выход на карту). `scripts/check-content.ts` проверяет школьный урок по своим правилам.

### Напоминания: окно с первого входа (`lib/push-ask.ts`, решение #92)
- `pushAsk {lastAt, count}` в сторе, `notePushAsked()`; `shouldAskPush(permission, state, createdAt, now, pushOn)` → `ask` · `blocked-help` · `install-help` · null: первый раз — сразу, потом 3 дня в первую неделю и 7 дней дальше. `PushAskAgent` (в `Providers`) — нижняя шторка на главных экранах, запрос разрешения — только по нажатию.

## v0.15: этап 16 — скорость (решение #93)

### Лёгкое и тяжёлое
- **Тяжёлое** (содержимое, ~20 МБ JS): `content/course.ts` (`LESSONS`, `getLesson`, `findStep`), `lib/bank` (банки навыков), `content/ent` (банк ЕНТ), `lib/drill.ts` (сборка заданий), `lib/course-mix.ts`, `lib/ent-steps.ts`, `lib/ent-boss.ts`. В клиентских модулях — только там, где содержимое нужно (список — `HEAVY_CLIENT_OK` в `tests/bundle-guard.test.ts`), остальное — в серверных `page.tsx` или через `import()`.
- **Лёгкое:** `content/catalog.ts` (`LESSON_META`, `lessonMeta`, `hasBank`, `hasShape`, `skillsWithShape`, `skillsWithWorked`, `entUnitPaperSize`, `entPlainCount`, `ENT_TOPIC_COUNTS`), `content/course-map.ts` (`UNITS`, `lessonNumber`, `unlockedSkills`), `lib/drill-meta.ts` (режимы и параметры адреса, пороги, навыки уроков и разделов, `nextLessonId`, правила игр), `lib/course-mix-meta.ts` (числа «Практики»/«Повторения», `miniTestSize`), `lib/ent-ref.ts` (`entRef`, `isEntRef`). Тяжёлые модули реэкспортируют лёгкие.
- Тип `LessonInfo` = урок без `steps` и `conspect` (подходит и `Lesson`, и `LessonMeta`); `LessonMeta` = `LessonInfo` + `stepCount` (как `lessonStepCount`) + `reading` (как `readingStats` на ru и kk).

### Каталог (`scripts/catalog.ts` → `content/catalog.generated.ts`, `content/conspects.generated.ts`)
- `npm run catalog` (и сам `register-content.mjs`): уроки из `LESSONS`, банки из `lib/bank` (`bankSkills`), навыки с разборами (`collectWorked`), задания ЕНТ по навыкам `[обычные, контекстные с вопросами]` и по темам; шпаргалки — отдельным файлом для поиска в «Конспектах».
- `tests/catalog.test.ts` сравнивает файлы с тем, что сгенерировалось бы сейчас, и каждую лёгкую функцию — с тяжёлым оригиналом (`unitPaperSize`, `miniTestPool`, `readingStats`, `lessonStepCount`, `hasShape`, `collectWorked`).
- Статус урока на карте («готов» / «скоро») и его название `course-map.ts` берёт из каталога (раньше `course.ts` правил `UNITS` по `LESSONS`).

### Урок с сервера
- `/lesson/[id]`: `page.tsx` → `withEntBoss(getLesson(id))` и для `?mode=check` — `buildCheck(…, Date.now())` → `LessonScreen({ lesson, mode, check })` → `LessonPlayer`/`Results` получают урок пропсом (`lesson`). `tests/lesson-props.test.ts` — урок и набор «Проверить себя» простые данные.
- `/theory/[id]` → `TheoryReader({ lesson })`; `/notes/lesson/[id]` → `LessonNotesScreen({ id, lesson: { title, conspect } | null })`.

### По требованию
- Поиск `/search`: `useCourseIndex(lang)` грузит `components/theory/course-search-index.ts` после показа (до загрузки — «Загрузка…»). «Конспекты»: `useConspects(searching)` грузит шпаргалки при поиске. Чат: `ChatQuiz` — `next/dynamic`. Игры — реестр (`games/registry.ts`).
- Вес страниц после сборки — `npm run size` (`scripts/bundle-size.mjs`, `--over=1.5` — только тяжелее 1,5 МБ).


## v0.16: этап 16Б, волна 1 — по отзыву владельца (решения #94–#104)

### Тест по разделу (`lib/exam.ts`, `components/exam/*`, #96)
- `UNIT_COUNTS` 14/3/2/1 (20 заданий, 25 баллов), `unitTimeLimitSec` — 90 с на задание; `BuildExamOpts.prioritySkills` — навыки непройденных уроков первыми; `unitPaperSizeOf` общий с каталогом.
- Зачёт: `unitPassed` (≥ 80% баллов, `UNIT_PASS_RATIO`) → `lessonsToCredit(paper, ready, isDone)` (все навыки урока в варианте) → `completeLessons(ids, "extern", accuracy)` один раз; список — `ExamAttempt.credited` (`[]` — сдан, засчитывать нечего; `undefined` — старая попытка). `/drill?mode=extern` → redirect на `/exam/run?kind=unit`. Тип `LessonVia "extern"` оставлен (старые записи).
- Мини-тест: экран старта `MiniStart` в `DrillScreen` списывает `ENTRY_COST.check` на «Начать», плеер получает `prepaid` (сколько уже списано: показать «−N» и не списывать второй раз).
- «−N» сердечек: `components/economy/HeartLoss.tsx` (`useHeartDelta`, `HeartLossPop`, `HeartPaidPop`) в `HeartsChip`, `HeartsBar`, на старте теста.

### Серия, комбо, XP (#97, #98)
- `bumpStreak` вызывается только при завершении занятия (`finishSession`, итоги теста, игры), не в `recordAnswer`. Анимация «огонь загорелся» — по снимку занятия (`components/motion/streak-snapshot.ts`): видна на итогах первого занятия дня, не видна при открытии старого результата.
- `components/motion/ComboFlame.tsx`: `StreakFlame` — шапка урока, `ComboBadge` — панель ответа. `components/economy/XpIcon.tsx` — значок «XP»; `components/economy/xp-chips.ts` — курс и склонение «+N чипов».

### ИИ: бесплатные навсегда и без ответа к нерешённому (#99, #100)
- `AiUsage.freeTotal` + `aiFreeIsLifetime(plan)` (`lib/economy.ts`): «Бесплатный» — 3 за всё время, «Лайт» — 30 в день; `freeTotal` переживает `resetProgress`. Тексты — `i18n/parts/ai-limits.ts`, баланс рядом с ценой — `AiCost`.
- Нерешённое задание: клиент кладёт в `TaskContext.secrets` результат `taskSecrets(step, lang)` (`lib/task-secrets.ts`); сервер (`server/answer-guard.ts`: `unsolvedSecrets`, `leaksUnsolved`; общая логика — `lib/answer-leak.ts`, записи «предмет ~ ответ» через `PAIR_SEP`) получает ответ без потока, проверяет, при утечке — повтор с `NO_LEAK_NOTE`, затем `LEAK_FALLBACK`. Безопасный текст помечается заголовком `X-AI-Fallback: 1` → `streamTutor` сообщает `"fallback"` → `useTutor` возвращает обращение. `secrets` входят в ключ кэша; `PROMPT_VERSION` 4.

### Уведомления (`lib/reminder-texts.ts`, #101)
- Ситуация (`Situation`, 9 видов) выбирается по серии, заморозкам на сегодня, дням без занятий, повторениям и цели дня; шаблоны с подстановками `{streak} {lesson} …` (без имени — варианты с `{name}` не берутся). Пул и данные — в зеркале IndexedDB (`informatica:reminder`: name, due, nextTitle, goalXp, xpToday, xpDay, pool); `public/sw.js` повторяет выбор и подстановку (сверка — `tests/reminders.test.ts`).

### «Продолжить» и выбор слов (#102, #103)
- `resumeTarget(lessonRuns, now, accept?)` в `lib/lesson-run.ts` — незаконченный урок своего трека, пропуская засчитанные; `ContinueCard`, `GradeProgressCard`, `QuickActions`, `SchoolMap`.
- Пропуск `ClozeBlank` с `label` — «плашка»: `lib/cloze-bank.ts` (`clozeBank(step, lang)` — подписи + `bank`, без повторов, перемешаны по id шага), `ClozeView` заполняет первый пустой выбираемый пропуск; проверка — как у ввода (`label` в нормализованном виде входит в `blank`, `tests/validate.ts`). `expectedText` показывает подпись на языке урока.

### Проводник первого входа (`components/tour/*`, `lib/tour.ts`, `lib/tips.ts`, #104) — заменён в v0.18 (#109)
- `TourAgent` (в `Providers`): `learnScene({ completedLessons, onboarded, pathname })` → приветствие (`Spotlight` с вырезом вокруг `[data-tour=continue]`) или обзор панели (`hdr-*`, `nav-*`). `LessonFirstTip` — в `LessonScreen`, `AfterFirstLesson` — в `Results`, `PageTip` — на «Практике», «ИИ-чате», «Материалах», «Прогрессе», школьной карте. Показанные — `useApp.tips` (`noteTip`, `resetTips`; `TipsReset` в профиле).
- `tourBlocking` держит `PaywallAgent` и `PushAskAgent`; онбординг и диагностика ведут на `/learn` (`notePaywallShown()` — окно тарифов в этом запуске не открывается).

### Подготовка волны 3 — новые сцены (`docs/specs/stage16b-wave3-scenes.md`)
- Типы в `lib/types.ts` (`numberline`, `tape`, `chart`, `graph`, `grid`, `db-schema`, `box`, `wave`, `gates`, `switches`, `url`, `message`; расширения `binary`, `decimal`, `table`, `circuit`, `web`; `SceneTone`, `GateOp`, `BoxSides`, `UrlRole`), проверки — `tests/validate.ts`, образцы — `components/scenes/samples/*` (`tests/scene-samples.test.ts`), галерея — `/dev/scenes` (404 без `SCENES_GALLERY=1`).

## v0.17: этап 16Б, волна 1Б — награды и живость (#105, #106)
- **Чипы:** `CHIP_REWARD` (`lib/economy.ts`) — единственное место чисел; начисление — `settleChips` (см. выше), `finishSession` возвращает `perfect`, `firstPass`, `lessonChips`, `perfectChips` для итогов. `lib/exam-pass.ts` (`unitPassed`) — без импортов, чтобы стор не тянул `lib/exam`.
- **«Идеально!»:** `lib/perfect.ts` — `isPerfectSession` (все ответы с первой попытки, верно, без подсказок, без пропусков), `nextPerfectRun` (только первые прохождения); поле `perfectRun` (`lib/rewards-state.ts`).
- **Кейс:** `lib/level-case.ts` — `rollLevelCase(level, seed, heartsFull)` (лента 40 призов, выигрыш на 34-й), `claimLevelCase` (выдача; опыт приза кейсов не порождает), `casesForLevelUp`/`queueCases`; поле `pendingCases` пополняет `addLevelCases` внутри `settleChips`. UI — `components/rewards/LevelCase.tsx` (лента, касание — сразу приз, `initialRoll` — показать уже выданный), `CaseAgent` (в `Providers`; белый список страниц `caseAllowedPath`, ждёт проводник), `CaseWaiting` (на «Учиться» и в профиле). `PaywallAgent` ждёт, пока есть кейсы; `PushAskAgent` не открывается поверх другого `aria-modal` окна.
- **Звуки и похвала:** `lib/sound.ts` (`perfect`, `chips`, `streak`, `caseTick`, `caseReveal`, варианты верного, ступени комбо), `lib/feedback.ts` (звук + вибрация по настройкам), `i18n/parts/praise.ts` + выбор без повтора; `components/motion/ChipFlight.tsx` (полёт чипов к цели `targetSelector`), `StreakIgnite` (`sound`, `delay`).

## v0.18: этап 16В, волна 1 — украшения, всплывающий Бит, плавающий чат, «Теория 2.0» (#107–#114)

### Редкость (`lib/rarity.ts`, `components/ui/rarity.ts`)
- `Rarity` = common | rare | epic | legendary; токены `rarity-*` и `-soft` в обеих темах (только для редкости); статические классы `RARITY_TEXT/SOFT/BORDER/BG`, `RARITY_VAR` для SVG, подписи `rarity.*`. Используют украшения, достижения и `LevelBadge`.

### Украшения профиля (`lib/cosmetics.ts`, `components/cosmetics/*`, #108)
- Каталог `COSMETICS` (слот frame | banner | title, редкость, цена или `null` — только кейс), `COSMETIC_PRICE`. Стор: поле `cosmetics { owned, equipped }` (`sanitizeCosmetics` при загрузке), действия `buyAndEquipCosmetic` (списание + строка истории `reason: "buy"`, `note: id`) и `equipCosmetic`.
- Вид: `AvatarFrame` (SVG-рамка вокруг `Avatar`; < 40 px — тонкое кольцо), `ProfileBanner`, `TitleTag`, `ProfileCard` (верх профиля), `CosmeticsShop` + `TryOnSheet` (магазин), `MyCosmetics` (профиль). Анимации — `cosmetics.module.css`, выключаются «Меньше анимаций».
- Кейс: приз `cosmetic` (`LEVEL_CASE_WEIGHTS.cosmetic = 10`), `pickCaseCosmetic(owned, r)` до анимации, подмена на `chips30`; `rollLevelCase(level, seed, heartsFull, owned)`.

### Проводник Бита (`lib/guide.ts`, `components/guide/*`, #109)
- Сцены — данные: `GUIDE_SCENES` (шаги: метки `data-tour`, ключ реплики, настроение, `next | tap`, ожидание цели), выбор сцены — `sceneFor(tips, ctx)`; показано — `useApp.tips` / `noteTip` (`lib/tips.ts`, `TIP_IDS`). Геометрия — `placeBit` (угол, пузырь, «над целью», не за экраном), `fingerPose`.
- `GuideHost` (в `Providers`): пауза 600 мс, поиск цели каждые 150 мс (`targets.ts`: первый видимый `[data-tour=…]`, `foreignModal` — ждём чужое окно), затемнение из 4 прямоугольников (цель нажимаема), шаг `tap` засчитывается нажатием по интерактивному элементу внутри цели (capture на `document`), на шаге `next` нажатие по цели = «Дальше». `BitPopup` — Бит и пузырь, печать текста и `bitTalk` / `bitPop` (`lib/sound.ts`); `GuidePointer` — рамка и палец. Урок и итоги помечает `GuideSpot`. `useGuideUi.active` прячет плавающую кнопку, пока Бит говорит (кроме шага, где цель — сама кнопка).
- `tourBlocking` (из `lib/guide.ts`) держит окно тарифов, уведомлений и кейс до конца сцены nav.

### Плавающий Бит-чат (`components/guide/BitDock.tsx`, `BitChatPanel.tsx`, `lib/dock.ts`, #110)
- `dockVisible(path, …)` — белый список главных страниц; свайп — pointer events + `useMotionValue` (жесты — `lib/dock.ts`), `profile.bitHidden`. Панель — `ChatScreen` в режиме `embedded` (последний чат — `pickDockChat`), после первого открытия не размонтируется (скрыта `inert`), закрывается при смене страницы.

### Экономика (#111, #116)
- `PERFECT_DROP` + `rollPerfectDrop` (`lib/perfect.ts`); бросок — в `finishSession` (урок, мини-тест) и `recordExam` (тест по теме, по разделу); результат — `FinishOutcome.perfectDrop` / `ExamSummary.drop`, показ — `PerfectDropTile`.
- `ENTRY_COST.drill = 1`; `DrillScreen` → `EntryGate` + `payDrill(key)` (`lib/drill-paid.ts`, окно 20 минут). Поля возврата сердечка за тренировку (`practiceHearts`) убраны (старое сохранение — молча игнорируется).

### Прогресс и «Поделиться» (#114)
- `lib/progress.ts`: `unitSkillSections` / `schoolSkillSections` → `skillGroups(sections, skills)` (все навыки раздела, сводка `counts`, «Другие навыки», `defaultOpenGroup`). Код результата урока `l1-<точность>-<XP>-<идеально>-<уроков>-<язык>` (`lib/share-code.ts`), превью и страница `/r/…`.

### «Теория 2.0» (`components/theory/*`, `lib/theory.ts`, `lib/theory-pay.ts`, #113)
- Плата: `useTheoryAccess(id)` — решение `theoryOpenStep` (wait | pay | open | locked), списание `payTheory` из колбэка кадра при открытии страницы, повтор за сутки (`theoryPaid`) и «Безлимит» — сразу открыто; нет сердечек — `OutOfHearts`, текст не рендерится. Цена — `TheoryCost` (значок ½) на карточке темы.
- Чтение: `TheoryCrumbs` (раздел, «Урок K из M», лента уроков), `TheoryCards` (по одной, `useSwipe`, `data-no-swipe` у видео), `TheoryConspect`; режим `theoryMode` и «Продолжить чтение» `theoryLast`, «прочитано» `theoryRead` — в сторе. Ссылки — `?card=<шаг>` и `?unit=<раздел>` (страница читает `searchParams` на сервере), старые `#…` — при полной загрузке.
- Чат по уроку: `ChatMeta.lessonId`, `findLessonChat` (один на урок), `LessonChat` (статическое первое сообщение и 3 подсказки); сервер — `loadLessonChat` (`server/context.ts`) + `lessonChatRule` (`server/prompts.ts`).

## v0.18: этап 16В — экономика после ревью (#116)
- **Новые поля стора** (`lib/store.ts`; все проходят `mergeState` как недоверенные данные):
  - `achRules: number` — версия правил достижений (`ACH_RULES_VERSION = 2` в `lib/achievement-rules.ts`); нет поля или меньше → `backfillAchievements` один раз молча записывает выполненное (`earnedByState`) без чипов, истории и показа; у нового профиля сразу актуальная версия.
  - `drillPaid: { key, at } | null` (`lib/drill-paid.ts`: `drillPaidKey`, `drillPaidActive`, `sanitizeDrillPaid`, `DRILL_PAID_GRACE_MS` = 20 минут) — оплаченный вход в тренировку. Пишет `payDrill(key, cost)` (мини-тест — на «Начать», остальные режимы — плеер при первом ответе через `drillKey`); читает `DrillScreen` (`EntryGate` с нулевой ценой) и `payDrill`. Снимает `finishSession`, только если `result.drillKey === drillPaid.key` (`SessionResult.drillKey` кладёт `LessonPlayer`; у квиза чата ключа нет). Безлимит и нулевая цена ничего не запоминают.
  - `dropDay: { day, count }` (`lib/perfect.ts`: `testDropsLeft`, `noteTestDrop`, `sanitizeDropDay`) — сколько раз за день тесты бросали сюрприз; предел `PERFECT_DROP.testsPerDay = 3` (мини-тест в `finishSession`; тест по теме и по разделу в `recordExam`). Счётчик сбрасывается со сменой даты; уроки в него не входят.
- **Изменения в записях:** `LessonStat.perfect?: true` (`lib/review.ts`; ставит только `finishSession`, `nextLessonStat` его не теряет), `ExamSummary.dropSeen?: true` (действие `markDropSeen(examId)`; повторная запись попытки отметку сохраняет), `ExamSummary.answered?: number` (ставит `recordExam`).
- **Правило «полный пробный ЕНТ засчитан»** — `fullExamCounts(answered, asked)` в `lib/exam-pass.ts` (отвечено не меньше половины, `ceil(asked / 2)`); им пользуются чипы за пробный ЕНТ (`recordExam`) и достижение «Пять пробников» (`fullExamDone` в `lib/achievement-rules.ts`; у старых записей без `answered` — по баллам).
- **Загрузка** (`mergeState`): `cleanExams` (нужны `id`, вид из `full | mini | topic | unit`, конечные `points`/`maxPoints`/`at`; `drop` — через `sanitizePerfectDrop`; не больше `MAX_EXAMS`), `cleanLessons` (конечные `completions`), `cleanAchievements`, числа `xp` и `maxCombo`; `backfillAchievements` — последний шаг, сбой подсчёта загрузку не роняет.
- **Итоги:** `ExamResult` проигрывает капсулу сюрприза и звук только при `drop && !dropSeen`, после показа зовёт `markDropSeen` из обработчика (не из эффекта); звуки `PerfectDropTile` — `chips` / `pop` / тишина. `Results` на карточке нового достижения показывает редкость (`RARITY_LABEL`, `RARITY_TEXT`), а не чипы.
- **Тесты:** `tests/store-review16c.test.ts` (E1–E8), `tests/econ16c-ui.test.ts`, `tests/drill-paid-ui.test.ts`, `tests/achievement-rules.test.ts`.

## v0.18: этап 16В, волна 2 — «Нужна помощь?» (P8, #115)
- **Логика** — `lib/help-timer.ts` (чистая, `tests/help-timer.test.ts`): `expectedStepMs(step, lang, level?)` = (чтение + действие) × уровень; `helpAfterMs(expected)` = clamp(× 1,75, 20 с, 180 с); `helpWindowMs`/`stepHelpAfterMs` (у разбора — на подшаг); `helpKindFor`/`helpKindIn(step, { testMode })` — что предлагает плашка (`hint` / `simpler` / ничего); `canOfferHelp` (один раз на шаг, не больше `MAX_HELP_OFFERS` = 3, помощь не взята); часы шага `startHelpClock`/`tickHelpClock`/`helpDue` — идут, только пока `running`, и не больше `TICK_CAP_MS` за тик. Скрипт `scripts/step-times.ts` (`npm run step-times`) считает по тем же функциям весь курс, банк и ЕНТ и пишет `docs/content/step-times.md`.
- **Вид и хук** — `components/lesson/HelpNudge.tsx`: `useHelpNudge({ enabled, kind, stepKey, offerKey, afterMs, touch, paused })` → `{ kind, dismiss, markHelped }` (интервал 1 с; пауза — `paused`, `useGuideUi.active`, открытый `[role="dialog"][aria-modal="true"]`, `document.visibilityState`; смена `touch` во время показа — плашка уезжает) и `HelpNudge` (ставится первым ребёнком нижней панели плеера, `absolute bottom-full`: фон панели закрывает нижнюю часть Бита). `LessonPlayer`: `offerKey` = `step.id` (повтор после ошибки — тот же шаг), `openAi` вызывает `markHelped`, отступ контента растёт на `HELP_NUDGE_PAD`, пока плашка на экране. Плеер — единственный потребитель, поэтому плашка есть в уроке и в тренировке (`DrillScreen` рисует тот же `LessonPlayer`) и нет в `ExamRun` и играх; `testMode` (мини-тест) выключает её (`tests/help-nudge-ui.test.ts` сторожит и это).
- **ИИ** — плашка модель не вызывает. «Спросить Бита» открывает `AiPanel` в режиме `ask` с пропсом `autoAsk` (вопрос `tutor.q.simpler` уходит сам при открытии, через `setTimeout(0)`, чтобы двойной монтаж React в разработке не отправил его дважды); цену обращения берёт тот же `spendAi('ask')` в `useTutor`.

## v0.19: этап 16Г — учёт ИИ, история Бита, вход при начале, «Не хватает», экономика, обучение, интерфейс (#118–#125)

### Учёт ИИ (#118)
- `lib/ai.ts → streamTutor(req, onText, signal, onMeta)`: `onMeta({ cache, fallback, crisis })` — заголовки `X-AI-Cache`, `X-AI-Fallback`, `X-AI-Crisis` до текста. Маркер `CUT` с непустым текстом — ответ (с меткой `CUT_SUFFIX` « …»), `ERR`/нет маркера — `stream_cut`.
- `components/ai/useTutor.ts`: `spendAi` до запроса, в том числе при попадании в кэш устройства; возврат — только без ответа и за кризис. `useTutor({ detach: true })` (шторка) — закрытие не обрывает запрос.
- `lib/economy.ts`: вида `review` нет; `aiKindIsFree(kind)` — `feedback` и `voice` не тратят бесплатные и чипы (только `AI_UNITS` потолка); `quoteVoiceQuestion` — проверка «расшифровка + ответ» перед записью.
- Сервер (`api/ai/tutor`): при `hit` освобождает свой потолок (`g.release`), безопасный ответ считает — клиент списывает ученику в обоих случаях.

### Ветки шторок ИИ и синхронизация вкладок (#119)
- `components/ai/ai-threads.ts` (Zustand без сохранения): `Record<key, { turns, pending, rev }>`, ключ `threadKey(scope, step, mode)`; `startThread` (до запроса, `pending`), `streamThread`, `finishThread` (пишет, только если `rev` совпал), `dropThread`, `clearThreads(scope)`; зависший `pending` снимается через `THREAD_PENDING_MAX_MS` = 120 с.
- `AiPanel` получает `thread` и подписан на ветку; пока `pending` — новые вопросы и `autoAsk` закрыты. Подключено: `LessonPlayer` (scope — урок или `drill:<ключ>`), `TheoryReader` (`theory:<id>`), `IdeAiHelp` (`ide:<задача>`, «Объясни ошибку» — `ideThreadStep(task, "explain", ошибка)`).
- Чат: `chat/helpers.ts → unansweredTail(msgs)` → «Ответ не пришёл» + «Повторить» (или «прикрепи фото ещё раз»).
- `lib/storage-sync.ts` (`isPeerSave`, `watchPeerSaves`) + `Providers.usePeerSync`: событие `storage` по ключу сохранения той же версии → `useApp.persist.rehydrate()`.

### Вход при начале занятия (#120)
- `lib/entry-paid.ts`: `entryPaid: Record<key, at>` (≤ 8 ключей, окно `RUN_GRACE_MS` 20 мин), ключи `lessonEntryKey`, `checkEntryKey`, `codeEntryKey`, `quizEntryKey`, ключи тренировок — `drillPaidKey`; старое поле `drillPaid` переносится в `mergeState`.
- Стор: `payEntryOnce(key, cost)` (свежий ключ — 0, иначе `payEntry` и запись ключа при `paid > 0`), `payEntryFresh` («Начать заново»), `payDrill` — синоним; `finishSession` снимает ключ (`SessionResult.drillKey`).
- `components/economy/useEntryAccess.ts`: `(key, cost, enabled) → { access: wait | open | locked, paid, resume }`, списание в `requestAnimationFrame`; `locked` → `OutOfHearts layout="screen"`, `hearts_out` один раз.
- `LessonScreen` и `DrillScreen` платят хуком; `LessonPlayer` ничего не списывает — получает `prepaid`/`paidAt`. `ChatQuiz` — в `start(n)`. Практикум: `WorkspaceProps.beforeRun` (`IdeShell`), оплата запоминается в `ref`, пока задача открыта. `ENTRY_COST.checkpoint/extern = 1`, `lessonCost()` без аргумента, поля `Lesson.hearts` нет.
- Итоги: все переходы — `replace`.

### Окно «Не хватает» (#121)
- `components/economy/shortfall.ts` (чистая: товары-сердечки по `shopAvailability`, покрывающий набор `CHIP_PACKS`, «Безлимит», пробный, таймер) + `ShortfallSheet.tsx` (раскладки `sheet | screen | inline`; «Оплата скоро» — соседом окна, не внутри: у `Modal` есть transform; монтируется лениво; `ComingSoonSheet.hideTrial`; проп `onLeave` — ссылки закрывают окно).
- `OutOfHearts`, `NoChipsNotice` — обёртки; `ShopParts`, `TryOnSheet` открывают окно; `HEART_PASSES` нет, `HEARTS_REFILL_KZT = 490` (id аналитики `hearts-refill`); якорь `#shop-chips`.

### Экономика (#122)
- `PLAN_FEATURES.lite.maxHearts = 6`; `CHIP_REWARD` 2/0/2/5/5; `ACHIEVEMENT_CHIPS` 2/4/7/10; `chipMultiplier(tier)` — только тариф; `xpMultiplier(boost, now)` применяется в сторе (`recordAnswer`, `finishSession`, `recordGame`, `recordCodeTask`), плеер показывает зачисленный опыт (разница до/после).
- Лента чипов — `LEDGER_KEEP_MS` 7 дней (`pruneLedger` в `pushLedger` и при загрузке).
- `lib/exam-pass.ts`: `lessonCounted` (`LESSON_COUNT_RATIO` 0,7) → `FinishOutcome.counted`; `fullExamChipsAllowed` (новый seed и сегодня +5 не выдавали; `ExamSummary.chips`).
- `missLog: Record<stepId, { n, prompt, lessonId?, at }>` (≤ 300) — растёт на первой ошибке в задании (урок, тренировка, экзамен); `lib/progress.ts → repeatedMistakes` → блок «Повторяющиеся ошибки».

### Обучение (#124)
- `lib/tips.ts`: `TIP_IDS` += `intro`, `learn-next`, `lesson-icons`; `welcome` — отметка без сцены (`SceneId = Exclude<TipId, "welcome">`).
- `lib/guide.ts`: `sceneFor` — на «Учиться» `intro` / `nav` (видел старое приветствие) / `learn-next`; в уроке «Учиться» — `lesson-first` или `lesson-icons`; страницы — после конца обучения; `tourBlocking` = нет ни `learn-next`, ни `nav`; `GuideScene.also` + `alsoAfter` + `alsoDue` (первый урок отмечает `lesson-icons`, только пройдя шаг ИИ); `stepText` — порядок fallback, partial, noName, school, again, free, noCount, many; `dockExplained`.
- Метки: `ToolboxButton tour="lesson-tools"`; хук `useAiFreeDotShown` (`AiCost.tsx`).

### Интерфейс и медиа (#125)
- Токены `--action-primary|success|danger|ai` и `--action-*-edge` во всех трёх блоках тем `globals.css` (`@theme`: `--color-action-*`); `Button` и плитки с белым текстом — на них.
- Огонь серии — по `current > 0`, точка `streak.notToday`; `pulse-ring` 2,2 с ease-in-out; на карте пульсирует только рекомендованный урок.
- `src/videos/PlayerInner.tsx`: `controls={false}` + своя панель (пуск, звук, ползунок, полный экран с запасным «псевдо» режимом, клавиши); строки `video.*`.
- Музыка: `lib/music.ts` (общий `Audio`, `preload="none"`, пауза в скрытой вкладке, сброс после ошибки), `lib/music-pref.ts`, `components/music/*`; `profile.music { enabled, track: auto | arcade | focus }`; файлы `public/media/music/*.ogg|m4a` (синтез `scripts/generate-original-music.mjs`); в `ExamRun` не монтируется.
