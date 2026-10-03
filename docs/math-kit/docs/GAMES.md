# Мини-игры Matematika

> **Для кого.** Для Codex — это ТЗ на игры. Для владельца — объяснение, что и зачем делается.
> **Что здесь:**
> - правила для всех игр;
> - контракт игры, файлы, реестры, оболочка `GameShell`;
> - три темпа, награды, общая техника игрового поля;
> - уроки тестеров Informatica;
> - ТЗ на 4 стартовые игры и бэклог из 8 игр.
>
> **Образец** — мини-игры Informatica (снимок 2026-10-03). Там четыре игры, все про двоичную систему: «Бит-спринт» (`bit-rush`), «Битовый тумблер» (`bit-flip`), «Сортировщик» (`bit-sort`), «Найди ошибку» (`bug-hunt`). Механику повторяем, наполнение делаем математическим.
> **Метки:**
> - **[образец]** — так сделано и проверено в Informatica, переносим;
> - **[новое]** — придумано для Matematika; при реализации записать решение в `docs/DECISIONS.md`;
> - **[проверить]** — стартовое число или неподтверждённый факт, подстроить после игры тестеров.
>
> Все числа времени и очков — **стартовые**. Меняются только в `MODE_CONFIG` своей игры, остальной код не трогаем.
> Пути в этом файле — пути проекта Matematika. Код образца лежит в `reference/` (только читать, не импортировать).
>
> **Этот файл дополняет `docs/ARCHITECTURE.md`.** Форма банка `trace`, `lib/game-pool.ts`, `tests/game-pool.test.ts`, `tests/helpers/trace.ts`, `games/math-sort/rules.ts`, `games/cipher/phrases.ts`, `content/terms.ts` появляются на этапе 6 (игры), в ARCHITECTURE их может ещё не быть. По играм и банку для игр прав этот файл. Прораб на этапе 6.1 переносит эти дополнения в ARCHITECTURE (дерево папок, 9.3, 19.1) и в DECISIONS.

**Слова, которые встретятся** (остальные — `docs/WORKFLOW.md`, 16 «Словарик»):

| Слово | Что значит |
|---|---|
| прораб | сильная модель Codex в отдельном чате: план, ТЗ, общие файлы, ревью. Не человек. Какая модель — `AGENTS.md`, «Модели Codex» |
| исполнитель | модель подешевле в другом чате: делает одну игру по готовому ТЗ |
| владелец | ты. Код сам не пишешь: копируешь готовый промпт из `docs/PROMPTS.md` в новый чат, выбираешь модель, смотришь результат |
| ветка, worktree | отдельная копия работы в git, чтобы исполнители не мешали друг другу (`docs/WORKFLOW.md`, 9) |
| `/review` | команда Codex «проверь код»; запускается в новом чате |
| seed | число, из которого игра получает задания. Тот же seed — тот же раунд: так тест повторяет игру |
| rAF | `requestAnimationFrame`: функция вызывается на каждом кадре экрана, так идут часы игры |
| `lazy` | код игры загружается, только когда её открыли |
| e2e | автотест, который проходит сайт в браузере как живой ученик |
| `key={round}` | React создаёт игру заново, с чистым состоянием, на каждый раунд |
| шит | панель, которая выезжает снизу экрана |
| `MODE_CONFIG` | объект в `logic.ts` игры со всеми числами трёх темпов |

---

## 0. Коротко для владельца

- **Что это.** Игры — короткие тренажёры на 1–3 минуты. В них ученик доводит до автоматизма то, что уже понял на уроке. ИИ в играх нет, поэтому игры **ничего не стоят**. Правильный ответ всегда считает код.
- **Три темпа у каждой игры:**
  - «Спокойно» — без таймера, после ошибки разбор, все помощники доступны;
  - «Обычный» — время зависит от сложности задания, есть калькулятор и черновик (как на ЕНТ);
  - «Блиц» — на скорость и рекорд, помощников нет.
- **Откуда задания.** Игры берут задания из общего банка. Новая тема сама появляется во всех подходящих играх. Игра открывается после урока с подходящим навыком.
- **Порядок.** Сначала 4 игры по проверенным механикам образца: «Пи-спринт», «Тумблер знаков», «Сортировщик», «Найди ошибку». Потом ещё 8 на банке.
- **Когда делать.** Когда выполнен чек-лист 14.1 (коротко: в курсе 2–3 темы с банками заданий). Урок образца: игры по одной теме оказались «про одно и то же».
- **Как принимать.** В каждой игре сыграть все три темпа: на телефоне, на ru и kk, в тёмной теме. Главный критерий: «Спокойно» проходится без стресса, а «Блиц» хочется переиграть.

### Карта игр

| Волна | id | Название ru / kk (kk — черновик для `review:kk`) | Механика | Откуда задания |
|---|---|---|---|---|
| 1 | `pi-rush` | Пи-спринт / Пи-спринт | поток коротких вопросов | банк: `question` (+ `short`) |
| 1 | `sign-flip` | Тумблер знаков / Таңба қосқыштары | переключать знаки, чтобы получить число | свой генератор в `logic.ts` |
| 1 | `math-sort` | Сортировщик / Сұрыптағыш | карточки по корзинам по правилу | свои правила в `rules.ts` |
| 1 | `bug-hunt` | Найди ошибку / Қатені тап | найти и исправить строку решения | банк: `trace` [новое] |
| 1б | `tower` | Башня / Мұнара | 10 этажей A → C | банк: `question` (choice) |
| 1б | `true-false` | Верю — не верю / Сенемін — сенбеймін | свайп утверждений | банк: `statement` |
| 1б | `memo` | Мемо-пары / Мемо-жұптар | найти пары | банк: `pair` |
| 1б | `bingo` | Бинго / Бинго | карточка 4×4 с ответами | банк: `short` |
| 2 | `cipher` | Шифровка / Шифр | ответы открывают фразу | банк: `short` / `question` |
| 2 | `bet` | Ставка / Бәс | ставка на уверенность | банк: `question` (choice) |
| 2 | `build-solution` | Собери решение / Шешімді құрастыр | шаги решения по порядку | банк: `trace` |
| 2 | `boss` | Босс-битва / Босспен шайқас | бой из слабых тем | банк: `question` |

Волны 1 и 1б повторяют план образца: 4 переделанные игры, затем «Башня», «Верю — не верю», «Мемо-пары», «Бинго». Волна 2 — тоже по плану образца. Названия kk — черновик, все прогнать через `npm run review:kk`.

---

## 1. Правила для всех игр

1. **Без ИИ в цикле игры.** Стоимость игры нулевая. [образец]
2. **Правильный ответ вычисляет код.** Источники — банк, генератор, `lib/math`. Числа точные: дроби — `Rational` на `BigInt`, без float в проверке. [образец + новое]
3. **Ошибка — это пауза и разбор**, а не просто красный экран. Показываем, как верно и почему. [образец]
4. **«Спокойно» есть у каждой игры.** Таймер — только там, где ученик сам выбрал скорость. [образец]
5. **Блиц — не дольше 2 минут активной игры.** Это жёсткий предел. [образец]
6. **Новое правило или вид задания объявляется заранее.** Пока висит объявление, часы стоят. Пролистать объявление (тап, Enter, пробел) можно не раньше чем через 800 мс после его появления — иначе двойной тап проскакивает правило (в образце `BANNER_SKIP_AFTER_MS = 800` в «Сортировщике», исправлено по ревью). [образец]
7. **Игра сама в стор не пишет.** Записывает только `GameShell` через `recordGame`. Игра лишь читает освоение навыков и пройденные уроки (`useApp.getState()`). [образец]
8. **`onFinish` вызывается ровно один раз.** После размонтирования — никогда. [образец]
9. **Тексты игрового поля — в `strings.ts` игры**, всегда ru и kk. `title` / `description` / `rules` — в `registry.ts` (как в образце), их вносит прораб из ТЗ (3.2). Пол ученика неизвестен — без глаголов с родом. [образец]
10. **Эмодзи нельзя** — только иконки lucide. Цвета — только токены. Фиолетовый `ai` в играх не используем: он закреплён за ИИ. [образец]
11. **Главный экран — телефон 360–430 px.** Цели касания ≥ 48 px, текст ≥ 16 px. Формулы не вылезают за край экрана. [образец + новое]
12. **Числа на экране** пишем с запятой и знаком «−» (U+2212). Ввод принимает и запятую, и точку. [новое]
13. **Неразборчивый ввод** — это подсказка формата, а не «неверно» (`checkFormat`, `docs/ARCHITECTURE.md`, 6.1). [новое]
14. **Подсказки в игре не раскрывают ответ** [образец] **и не обходят уровень «Помощников»** темпа (`full` / `ent` / `off`, раздел 4): что закрыто в темпе, то не открывает и подсказка. [новое]
15. **Ошибочное задание может вернуться один раз**, повтор повторно не возвращается. Есть ли повтор, в каких темпах и через сколько — в ТЗ игры и её `MODE_CONFIG`. Волна 1: Пи-спринт — через 3 вопроса, во всех темпах; Тумблер — в конце раунда, только «Обычный» и «Блиц», не больше 3; Сортировщик — через 3 карточки при том же правиле, во всех темпах; Найди ошибку — повтора нет. [образец]
16. **Не повторять одно и то же 3 раза подряд** — навык, правило или вид задания. [образец]
17. **Числа темпов — в `MODE_CONFIG`.** `Game.tsx` читает темп только оттуда, «магических» чисел в UI нет. [образец]

---

## 2. Контракт `src/games/types.ts` [образец, без изменений]

Скопировать из `reference/src/games/types.ts` дословно:

```ts
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { L, Lang, SkillId } from "@/lib/types";

// Контракт мини-игры. Игра — один React-компонент: рисует только игровое поле,
// сама ведёт таймер и ровно один раз вызывает onFinish. Вступление и итоги рисует GameShell.

export interface GameAttempt {
  skill: SkillId;
  correct: boolean;
}

export interface GameResult {
  /** Очки игры (для рекорда). */
  score: number;
  correct: number;
  total: number;
  /** Каждое оцениваемое действие → навык и верность (для модели освоения). */
  attempts: GameAttempt[];
}

/**
 * Темп игры (выбирает ученик перед началом):
 * - calm — без таймера, после ошибки показывается разбор, доступны все инструменты, рекорд не ставится;
 * - normal — время на задание зависит от его сложности, доступен калькулятор «как на ЕНТ»;
 * - blitz — на скорость и рекорд, без инструментов.
 */
export type GameMode = "calm" | "normal" | "blitz";

export interface GameProps {
  lang: Lang;
  sound: boolean;
  mode: GameMode;
  onFinish: (result: GameResult) => void;
}

export interface GameMeta {
  id: string;
  title: L;
  description: L;
  /** Короткие правила для экрана перед игрой (markdown не нужен). */
  rules: L;
  /** Рисованная иконка (lucide), не эмодзи. */
  icon: LucideIcon;
  /** CSS-цвет фона плитки игры. */
  color: string;
  /** CSS-цвет иконки на плитке. */
  ink: string;
  skills: SkillId[];
  /** Примерная длительность, сек. */
  durationSec: number;
}

/** Ленивый компонент игры (реестр компонентов — src/games/components.ts). */
export type GameComponent = ComponentType<GameProps>;
```

Что заполняет игра в `GameResult`:

| Поле | Что это | Пример |
|---|---|---|
| `score` | очки игры, по ним ставится рекорд; не убывают | 340 |
| `correct` | число верных оцениваемых действий | 11 |
| `total` | число всех оцениваемых действий (`attempts.length`) | 14 |
| `attempts` | по одному на действие: навык и верно/неверно. Повтор задания — тоже действие. В «Найди ошибку» «найти» и «исправить» — два разных действия | `[{ skill: "num.powers", correct: true }, …]` |

Действие, которое не успели закончить к концу раунда (вопрос ещё на экране), в `attempts` не попадает.

---

## 3. Файлы, реестры, общий пул навыков

### 3.1 Где что лежит

```
src/games/
  types.ts            контракт (раздел 2)
  registry.ts         GAMES: GameMeta[] + gameById(id)
  components.ts       id → lazy(() => import("./<id>/Game")) — код игры грузится при открытии
  <id>/
    Game.tsx          UI (default export). Темп читает только из MODE_CONFIG, логику — из logic.ts
    logic.ts          ЧИСТАЯ логика без React: поток заданий, очки, таймеры как функции времени, MODE_CONFIG
    strings.ts        export const S = { … } satisfies Record<string, L>
    rules.ts          [новое] только у «Сортировщика»: наборы правил (данные + предикаты)
    phrases.ts        [новое] только у «Шифровки» (волна 2): фразы { ru, kk }
src/components/games/GameShell.tsx   вступление → игра → итоги (раздел 4)
src/lib/games.ts                     награды (раздел 6), из reference/src/lib/games.ts без изменений
src/lib/game-pool.ts                 [новое] пул навыков игры, вес навыка, выбор навыка (3.5)
src/lib/bank/types.ts                + форма trace [новое] (3.7)
src/content/terms.ts                 [новое, волна 1б] термины ru ↔ kk для «Мемо-пар» (13.3)
src/app/game/[id]/page.tsx           серверная страница игры (3.4)
src/app/(main)/practice/page.tsx     плитки игр (замок, рекорд) — docs/DESIGN.md, «Тренировка»
tests/games/<id>.test.ts             логика каждой игры
tests/games.test.ts                  награды gameReward
tests/game-pool.test.ts              [новое] (3.5)
tests/helpers/trace.ts               [новое] независимая проверка строк trace (3.7)
tests/bank/trace.test.ts             [новое] шаблоны trace всех навыков (12.7)
e2e/games.spec.ts                    каждая игра открывается и стартует без ошибок (раздел 15)
```

**Кто какие файлы правит:**
- Общие файлы правит только прораб. Это `types.ts`, `registry.ts`, `components.ts`, `GameShell.tsx`, `lib/games.ts`, `lib/game-pool.ts`, `lib/bank/types.ts`, `i18n/dict.ts`, `e2e/games.spec.ts`.
- Исполнитель игры правит только папку `src/games/<id>/` и свой `tests/games/<id>.test.ts`. Такой порядок взят из образца: исполнители работали параллельно и не мешали друг другу.

### 3.2 `registry.ts` — метаданные

Цвета плиток взяты из образца. Они одинаковы в обеих темах — это данные, а не тема (`docs/DESIGN.md`, 2.5). Фиолетовый не использовать.

**Когда заполнять.** На шаге 1 (фундамент, 14.2) `GAMES = []`. Запись игры прораб добавляет на шаге 4, когда файлы игры уже есть, — иначе импорты `SORT_SKILLS` / `SIGN_SKILLS` не соберутся. Тексты `title` / `description` / `rules` лежат прямо в записи, как в образце; прораб берёт их из ТЗ игры (разделы 9.6, 10.8, 11.6, 12.6). Строки `rules` разделяются `\n`: GameShell показывает их с `whitespace-pre-line`.

```ts
import { Bug, Inbox, ToggleRight, Zap } from "lucide-react";
import { SKILLS } from "@/content/skills";
import { skillsWithShape } from "@/lib/bank";
import { SORT_SKILLS } from "./math-sort/rules";
import { SIGN_SKILLS } from "./sign-flip/logic";
import type { GameMeta } from "./types";

const ALL = SKILLS.map((s) => s.id);

// Реестр мини-игр (метаданные). Компоненты — в components.ts (лениво).
export const GAMES: GameMeta[] = [
  {
    id: "pi-rush",
    icon: Zap,
    color: "#fff3dc",
    ink: "#d97706",
    skills: skillsWithShape(ALL, "question"),
    durationSec: 60,
    title: { ru: "Пи-спринт", kk: "Пи-спринт" },
    description: {
      ru: "Поток коротких вопросов по пройденным темам — от простых к сложным. Темп выбираешь сам.",
      kk: "Өтілген тақырыптар бойынша қысқа сұрақтар легі — жеңілден күрделіге қарай. Қарқынды өзің таңдайсың.",
    },
    rules: {
      ru: "Выбирай вариант или вводи ответ. Серия верных ответов увеличивает множитель очков.\nСпокойно: 12 вопросов без таймера, после ошибки — разбор.\nОбычный: 15 вопросов, на каждый — время по сложности.\nБлиц: 60 секунд, верный ответ +2…4 с (чем сложнее, тем больше), ошибка −4 с.",
      kk: "Нұсқаны таңда немесе жауапты енгіз. Дұрыс жауаптар сериясы ұпай көбейткішін арттырады.\nАсықпай: таймерсіз 12 сұрақ, қатеден кейін — талдау.\nҚалыпты: 15 сұрақ, әрқайсысына күрделілігіне қарай уақыт беріледі.\nБлиц: 60 секунд, дұрыс жауап +2…4 с (неғұрлым күрделі болса, соғұрлым көп), қате −4 с.",
    },
  },
  // Остальные три — так же, тексты из их ТЗ:
  // sign-flip: ToggleRight, color "#e4f3fc", ink "#1a91d6", skills SIGN_SKILLS, durationSec 90 — тексты 10.8
  // math-sort: Inbox, color "#e3f7ec", ink "#16a34a", skills SORT_SKILLS, durationSec 75 — тексты 11.6
  // bug-hunt:  Bug, color "#ffe9e0", ink "#e5532d", skills skillsWithShape(ALL, "trace"), durationSec 90 — тексты 12.6
];

export function gameById(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
```

**Игра открыта**, если хотя бы один её навык открыт пройденными уроками [образец]:

```ts
// practice/page.tsx и GameShell
const unlocked = new Set(unlockedSkills(Object.keys(lessons)));   // unlockedSkills — src/content/course.ts
const open = meta.skills.some((s) => unlocked.has(s));
```

Закрытая плитка показывает замок и `t("games.locked")`. Текст ключа для математики: «Пройди урок, чтобы открыть» / «Ашу үшін сабақты өт».

### 3.3 `components.ts` [образец]

```ts
"use client";

import { lazy, type LazyExoticComponent } from "react";
import type { GameComponent } from "./types";

// Компоненты мини-игр: id → ленивый компонент (код игры грузится только при её открытии).
export const GAME_COMPONENTS: Record<string, LazyExoticComponent<GameComponent>> = {
  "pi-rush": lazy(() => import("./pi-rush/Game")),
  "sign-flip": lazy(() => import("./sign-flip/Game")),
  "math-sort": lazy(() => import("./math-sort/Game")),
  "bug-hunt": lazy(() => import("./bug-hunt/Game")),
};
```

### 3.4 `src/app/game/[id]/page.tsx` [образец]

В Next.js 16 `params` — это Promise. `PageProps<…>` — глобальный тип, его создаёт `next typegen`.

```tsx
import { notFound } from "next/navigation";
import { gameById } from "@/games/registry";
import { GameShell } from "@/components/games/GameShell";

export default async function GamePage(props: PageProps<"/game/[id]">) {
  const { id } = await props.params;
  if (!gameById(id)) notFound();
  return <GameShell id={id} />;
}
```

### 3.5 `src/lib/game-pool.ts` — пул навыков [новое]

**Зачем.** В образце каждая игра держала свой `pickSkill` и работала со всеми своими навыками: тема была одна. В математике тем много. Ученику, который прошёл только «Степени», игра не должна давать производные. Поэтому общая чистая функция выбирает только **открытые** навыки и только те, что умеют нужную форму.

```ts
import type { Level, SkillId } from "@/lib/types";
import type { Shape } from "@/lib/bank/types";
import { hasShape } from "@/lib/bank";

/** Освоение по умолчанию для игры (как в образце). */
export const DEFAULT_GAME_MASTERY = 0.3;

/** Навыки игры: из meta.skills, открытые уроками, умеющие форму shape (если shape задан). */
export function gamePool(gameSkills: SkillId[], unlocked: SkillId[], shape?: Shape): SkillId[] {
  const open = new Set(unlocked);
  return gameSkills.filter((s) => open.has(s) && (!shape || hasShape(s, shape)));
}

/** Вес навыка (1,1 − освоение)² — та же формула, что в buildDrill: слабые чаще. */
export function skillWeight(mastery: number): number {
  return (1.1 - mastery) ** 2;
}

/** Выбор навыка рулеткой по весу; навык, выпавший 2 раза подряд, в третий раз не берём. */
export function pickSkill(
  pool: SkillId[], masteries: Record<string, number | undefined>, recent: SkillId[], rand: () => number, exclude: SkillId[] = [],
): SkillId | null;

/** Стартовый уровень игры: A, а если освоение навыка ≥ 0,8 — B. */
export function startLevel(mastery: number): Level;
```

**Как работает `pickSkill`** (как в «Бит-спринте» образца плюс правило одного навыка; файла игры в `reference/` нет, алгоритм ниже полный):
1. `candidates` = `pool` без навыков из `exclude`. `exclude` — навыки, которые в этом вызове брать нельзя: игра уже пробовала их и не нашла нового задания (в образце так перебирают навыки по очереди).
2. Если два последних элемента `recent` одинаковые, этот навык убираем из `candidates`. Но если после этого `candidates` пуст, а до этого был не пуст, возвращаем этот навык: правило «не 3 раза подряд» не действует, когда навык один. [новое: в образце вернулся бы `null`]
3. `candidates` пуст → `null`. Иначе рулетка по весам `skillWeight(masteries[s] ?? DEFAULT_GAME_MASTERY)`.

`null` для игры значит «заданий больше нет»: раунд заканчивается досрочно с тем, что набрано (`onFinish` как обычно). Падать игра не должна.

Как игра читает данные. Один раз при монтировании, в инициализаторе `useState`, а не в эффекте:

```ts
const [setup] = useState(() => {
  const s = useApp.getState();
  const pool = gamePool(GAME_SKILLS, unlockedSkills(Object.keys(s.lessons)), "question");
  const masteries = Object.fromEntries(pool.map((id) => [id, s.skills[id]?.mastery ?? DEFAULT_GAME_MASTERY]));
  return { pool, masteries, seed: Date.now() >>> 0 };   // seed создаётся СНАРУЖИ логики
});
```

**Тесты `tests/game-pool.test.ts`:**
- [ ] `gamePool` не возвращает закрытые навыки и навыки без нужной формы;
- [ ] **частота:** пул из двух навыков (освоение 0,2 и 0,9), 10 000 вызовов, каждый раз `recent = []` (чистая рулетка). Слабый выпадает примерно в 20 раз чаще (ожидание (0,9/0,2)² ≈ 20,25; допуск 16–25);
- [ ] **без трёх подряд:** пул из 3 навыков, один очень слабый, `recent` накапливается между вызовами, 1000 вызовов — нигде нет трёх одинаковых подряд;
- [ ] пул из одного навыка, `recent = [a, a]` → `a`;
- [ ] пустой пул или все навыки в `exclude` → `null`;
- [ ] `startLevel(0.79)` = 1, `startLevel(0.8)` = 2.

### 3.6 Откуда игры берут задания

Банк заданий описан в `docs/ARCHITECTURE.md`, раздел 9. Принцип [образец]: **каждый навык выдаёт задания в нескольких «формах», игры берут нужную форму.**

| Форма банка | Что это | Какие игры берут |
|---|---|---|
| `question` | шаг урока (`choice`, `input` …) | Пи-спринт, Башня, Ставка, Босс-битва, Шифровка |
| `statement` | утверждение «верно / неверно» + «почему» | Верю — не верю |
| `pair` | пара соответствия: левое ↔ правое | Мемо-пары |
| `short` | короткий однозначный ответ | Бинго, Шифровка, запасной источник для Пи-спринта |
| `trace` [новое] | решение по шагам и типичные «порчи» строк | Найди ошибку, Собери решение |
| `context` | контекстная группа ЕНТ | позже: «Детектив» |

У «Тумблера знаков» и «Сортировщика» источник свой. Их задания — особые конструкции, которых в банке нет: выражение со слотами знаков, карточка + правило. Значения всё равно считает общий `lib/math`.

**Рабочие id навыков в этом файле** — `num.order`, `num.int`, `num.fractions`, `num.powers`, `num.roots`, `eq.linear`, `eq.quadratic`, `eq.ineq`, `lit.prob`. Схема id — `docs/ENT_MATH.md`, 3.6 (префиксы разделов) и `docs/ARCHITECTURE.md`, 4.4 (формат). Оттуда взяты `num.fractions`, `num.powers`, `num.roots`, `eq.linear`, `eq.quadratic`, `lit.prob`. Предложения этого файла (записать в DECISIONS при первом использовании): `num.order` — порядок действий, `num.int` — целые и отрицательные числа, `eq.ineq` — линейные неравенства (неравенства входят в раздел 2 с префиксом `eq`). Окончательный список — в `src/content/skills.ts`. Если там id другие, поправить их в `logic.ts` / `rules.ts` игр.

### 3.7 Форма банка `trace` — решение по шагам [новое]

Нужна двум играм: «Найди ошибку» и «Собери решение». Добавить в `src/lib/bank/types.ts` (делает прораб, запись в DECISIONS):

```ts
/** Что утверждает строка решения — для независимой проверки в тестах. Синтаксис — парсер lib/math (x — переменная). */
export type Claim =
  | { kind: "eq"; lhs: string; rhs: string }   // «левая = правая»; без x — числовое равенство, с x — уравнение
  | { kind: "roots"; values: string[] };       // итог «x = 2 или x = 3»; [] — корней нет

export interface TraceLine {
  /** Как показать строку: Unicode или LaTeX в $…$ (рендерит MathText). */
  text: Text;
  /** Все утверждения строки (строка верна, если верны все). Обязаны связывать строку с УСЛОВИЕМ, а не только арифметику внутри строки. */
  claims: Claim[];
}

export interface TraceFault {
  line: number;          // индекс портящейся строки
  type: string;          // тип ошибки: "sign" | "powMul" | "addFractions" | "order" | "discriminant" | "rootSign" | "lostRoot" | "extraRoot" | "arith" …
  wrong: TraceLine;      // испорченная строка — вычислена кодом
  explain: L;            // одно предложение: почему неверно и как правильно
}

export interface Trace {
  id: string;            // "g:<skill>:trace:<параметры>:<seed>" — как у всех заданий банка (ARCHITECTURE 9.2)
  skill: SkillId;
  level: Level;
  header: L;             // условие: «Реши уравнение $3x - 7 = 2x + 5$»
  given: Claim;          // условие в синтаксисе парсера — точка отсчёта для проверки
  lines: TraceLine[];    // 3–6 верных строк
  faults: TraceFault[];  // ≥ 2 порчи; у строки, которую можно испортить, — ≥ 2 разных порчи (для вариантов исправления)
}

// В SkillBank добавить:  trace?: (level: Level, seed: number) => Trace;
// В Shape добавить:      "trace"   (повторы в draw — по первым 4 сегментам id, без seed)
```

**Почему `claims` связаны с условием.** Пример: строка «D = 25 + 24 = 49». Арифметика внутри строки верна, а формула дискриминанта — нет. Поэтому у строки два утверждения:
- `{ lhs: "(-5)^2 - 4*1*6", rhs: "25 + 24" }` — неверно, тест это поймает;
- `{ lhs: "25 + 24", rhs: "49" }` — верно.

**Как тест проверяет строку независимо** (`tests/helpers/trace.ts`, только парсер `lib/math`, без кода шаблона):
- **Строка без `x`.** Обе части каждого `eq` вычисляются точно (`evalExact`) и должны совпасть.
- **Строка с `x` и итог `roots`.** Сравниваем «подпись» — множество значений `v` из сетки `G`, при которых строка верна:
  - `G` = все `k/2` для `k ∈ [−40; 40]` плюс все числа из всех `roots` этого `trace`;
  - верная строка: подпись совпадает с подписью `given`;
  - испорченная: подпись отличается. Так ловится и потерянный корень: `x = 3` вместо `x = ±3`.

**Пример шаблона** `eq.quadratic`, уровень B: `x² − 5x + 6 = 0`.

| # | Строка (text) | claims | Порчи (faults) |
|---|---|---|---|
| 0 | $D = b^2 - 4ac = 25 - 24 = 1$ | `(-5)^2-4*1*6` = `25-24`; `25-24` = `1` | `discriminant`: «= 25 + 24 = 49»; `arith`: «= 25 − 24 = 2» |
| 1 | $x_1 = \frac{5 - 1}{2} = 2$ | `(5-1)/2` = `2`; `2^2-5*2+6` = `0` | `rootSign`: $x_1 = \frac{-5 - 1}{2} = -3$; `arith`: «= 3» |
| 2 | $x_2 = \frac{5 + 1}{2} = 3$ | `(5+1)/2` = `3`; `3^2-5*3+6` = `0` | `rootSign`: «= −2»; `arith`: «= 4» |
| 3 | Ответ: 2; 3 | `roots: ["2","3"]` | `lostRoot`: «Ответ: 3»; `extraRoot`: «Ответ: 2; 3; 6» |

**Строка с корнем подставляет его в условие** (второй claim в строках 1 и 2). Без этого порчу `rootSign` не поймать: `(-5-1)/2 = -3` арифметически верно. С подстановкой строка ложна: `(-3)^2-5*(-3)+6 = 30`, а не 0. Каждая порча в таблице делает ложной ровно свою строку, у каждой строки — 2 порчи.

`explain` для `discriminant`: ru «Дискриминант D = b² − 4ac, а не b² + 4ac», kk «Дискриминант D = b² − 4ac, b² + 4ac емес».

---

## 4. `GameShell` — оболочка игры [образец]

Файла `GameShell.tsx` в `reference/` нет. Код ниже — полный эталон: файл Informatica с правками для Matematika (помечены `// [новое]`). Перенести как есть, ничего не досочинять. Зависимости, которых нет в `reference/`: `ToolboxButton` и `useToolboxLevel` — этап 1.9 «Помощники» (`docs/ARCHITECTURE.md`, 15). К этапу игр они уже готовы (14.1).

**Фазы:** `intro` (правила + выбор темпа) → `playing` (игра) → `result` (итоги).
- Игра монтируется с `key={round}`. «Ещё раз» создаёт новый раунд с чистым состоянием и новым seed.
- **Уровень «Помощников»** во время игры задаёт темп: `calm` → `full`, `normal` → `ent` (калькулятор и черновик), `blitz` → `off`. Вне игры — `full`. На ЕНТ встроенный калькулятор есть, справочника формул нет (`docs/ENT_MATH.md`, раздел 0).

```tsx
"use client";

import { Feather, Lock, Play, RotateCcw, Timer, Trophy, X, Zap, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import type { GameMode, GameResult } from "@/games/types";
import { gameById } from "@/games/registry";
import { GAME_COMPONENTS } from "@/games/components";
import { gameStatKey, type GameReward } from "@/lib/games";
import { useApp } from "@/lib/store";
import { feedback } from "@/lib/feedback";
import { unlockedSkills } from "@/content/course";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { useToolboxLevel } from "@/components/tools/useToolbox";
import { Mascot, MascotSays } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";

type Phase = { name: "intro" } | { name: "playing"; round: number } | { name: "result"; result: GameResult; reward: GameReward };

const MODES: { id: GameMode; icon: LucideIcon; title: DictKey; desc: DictKey }[] = [
  { id: "calm", icon: Feather, title: "game.mode.calm", desc: "game.mode.calm.desc" },
  { id: "normal", icon: Timer, title: "game.mode.normal", desc: "game.mode.normal.desc" },
  { id: "blitz", icon: Zap, title: "game.mode.blitz", desc: "game.mode.blitz.desc" },
];

/** Оболочка мини-игры: вступление с правилами → игра → итоги (очки, рекорд, XP). */
export function GameShell({ id }: { id: string }) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const meta = gameById(id)!;
  const sound = useApp((s) => s.profile.sound);
  const mode = useApp((s) => s.profile.gameMode);
  const lessons = useApp((s) => s.lessons);                                   // [новое]
  const updateProfile = useApp((s) => s.updateProfile);
  const statKey = gameStatKey(id, mode);
  const stat = useApp((s) => (statKey ? s.games[statKey] : undefined));
  const recordGame = useApp((s) => s.recordGame);
  const reduceMotion = useReduceMotion();                                     // [новое]
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [round, setRound] = useState(0);
  const Game = GAME_COMPONENTS[id];
  const Icon = meta.icon;
  const open = meta.skills.some((s) => unlockedSkills(Object.keys(lessons)).includes(s)); // [новое]
  // Инструменты во время игры: «Спокойно» — все, «Обычный» — как на ЕНТ, «Блиц» — никаких.
  useToolboxLevel(phase.name !== "playing" ? "full" : mode === "calm" ? "full" : mode === "normal" ? "ent" : "off");

  const start = () => {
    const next = round + 1;
    setRound(next);
    setPhase({ name: "playing", round: next });
  };

  const finish = (result: GameResult) => {
    const reward = recordGame(id, result, mode);
    feedback("complete");                                                      // [новое] звук + вибрация по настройкам
    if (reward.newBest && stat && !reduceMotion) {                             // [новое] уважать «Меньше анимаций»
      void import("canvas-confetti").then(({ default: confetti }) =>
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.35 }, colors: ["#f0b400", "#1a91d6", "#21b26f"] }),
      );
    }
    setPhase({ name: "result", result, reward });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          <button type="button" onClick={() => router.push("/practice")} aria-label={t("common.close")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
            <X size={24} />
          </button>
          <span className="flex flex-1 items-center gap-2 truncate text-lg font-extrabold">
            <Icon size={20} strokeWidth={2.4} style={{ color: meta.ink }} className="shrink-0" /> {l(meta.title)}
          </span>
          {phase.name === "playing" && <ToolboxButton variant="icon" />}
          {statKey && (
            <span className="flex items-center gap-1 text-sm font-extrabold text-warning-strong">
              <Trophy size={16} className="text-gold" /> {stat?.best ?? 0}
            </span>
          )}
        </div>
      </header>

      <main className={cn("mx-auto flex w-full max-w-2xl flex-1 flex-col", phase.name !== "playing" && "px-4 pb-8")}>
        {!open && (                                                            /* [новое] прямой заход по ссылке на закрытую игру */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Lock size={40} className="text-muted" />
            <p className="font-bold text-muted">{t("games.locked")}</p>
            <ButtonLink href="/learn">{t("nav.learn")}</ButtonLink>
          </div>
        )}

        {open && phase.name === "intro" && (
          <div className="flex flex-1 flex-col gap-5 pt-4 animate-fade-in">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] shadow-lg" style={{ background: meta.color, color: meta.ink }}>
                <Icon size={40} strokeWidth={2.2} />
              </span>
              <h1 className="text-2xl font-extrabold">{l(meta.title)}</h1>
              <p className="font-semibold text-muted">{l(meta.description)}</p>
            </div>
            <div className="rounded-3xl border-2 border-border bg-surface p-4">
              <p className="mb-1 text-sm font-extrabold text-muted">{t("game.rules")}</p>
              <p className="whitespace-pre-line font-semibold leading-relaxed">{l(meta.rules)}</p>
            </div>
            <div role="radiogroup" aria-label={t("game.mode")} className="flex flex-col gap-2">
              <p className="text-sm font-extrabold text-muted">{t("game.mode")}</p>
              {MODES.map((m) => {
                const on = m.id === mode;
                const MIcon = m.icon;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => updateProfile({ gameMode: m.id })}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors active:translate-y-[2px]",
                      on ? "border-primary bg-primary-soft shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
                    )}>
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-primary text-white" : "bg-surface-2 text-muted")}>
                      <MIcon size={20} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block font-extrabold", on && "text-primary")}>{t(m.title)}</span>
                      <span className="block text-xs font-semibold text-muted">{t(m.desc)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center gap-4 text-sm font-bold text-muted">
              {statKey ? (
                <>
                  <span>{stat ? t("game.best", { n: stat.best }) : t("game.noBest")}</span>
                  {stat && <span>· {t("game.plays", { n: stat.plays })}</span>}
                </>
              ) : (
                <span>{t("game.calmNoRecord")}</span>
              )}
            </div>
            <div className="flex-1" />
            {/* Кнопка всегда видна внизу экрана, даже если правила и выбор темпа не помещаются. */}
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg from-70% to-transparent px-4 pb-4 pt-6">
              <Button size="lg" block onClick={start} icon={<Play size={20} fill="currentColor" />} autoFocus>
                {t("game.play")}
              </Button>
            </div>
          </div>
        )}

        {open && phase.name === "playing" && (
          <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-surface-2" />}>
            <Game key={phase.round} lang={lang} sound={sound} mode={mode} onFinish={finish} />
          </Suspense>
        )}

        {open && phase.name === "result" && (
          <div className="flex flex-1 flex-col gap-5 pt-6 animate-fade-in">
            <div className="flex flex-col items-center gap-2 text-center">
              <Mascot mood={phase.reward.newBest ? "celebrate" : "happy"} size={100} />
              <p className="text-sm font-extrabold uppercase text-muted">{t("game.over")}</p>
              <p className="text-5xl font-black">{phase.result.score}</p>
              <p className="font-bold text-muted">{t("game.score")}</p>
              {phase.reward.newBest && (
                <span className="flex items-center gap-1.5 rounded-full bg-gold-soft px-4 py-1.5 font-extrabold text-warning-strong animate-pop">
                  <Trophy size={18} className="text-gold" /> {t("game.newBest")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-success bg-surface p-3 text-center">
                <p className="text-xs font-extrabold text-muted">{t("game.correct")}</p>
                <p className="text-2xl font-extrabold text-success-strong">{phase.result.correct}/{phase.result.total}</p>
              </div>
              <div className="rounded-2xl border-2 border-gold bg-surface p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-muted"><Zap size={14} className="text-gold" /> XP</p>
                <p className="text-2xl font-extrabold text-warning-strong">+{phase.reward.xp}</p>
              </div>
            </div>
            {!phase.reward.newBest && stat && statKey && (
              <MascotSays mood="happy" size={56}>{t("game.beat", { n: stat.best })}</MascotSays>
            )}
            {!statKey && <p className="text-center text-sm font-bold text-muted">{t("game.calmNoRecord")}</p>}
            <div className="flex-1" />
            <div className="flex flex-col gap-3">
              <Button size="lg" block onClick={start} icon={<RotateCcw size={20} />}>{t("game.again")}</Button>
              <Button variant="secondary" block onClick={() => router.push("/practice")}>{t("game.toPractice")}</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

**При переносе добавить** [новое]: кнопки итогов «Ещё раз» и «К тренировкам» становятся активными через 0,7 с после показа итогов. Это защита от двойного тапа последним ответом, как у «Продолжить» в итогах урока образца. Таймер ставится в `setTimeout` внутри эффекта, `setState` — в колбэке таймера, не синхронно.

**Строки оболочки** — ключи `game.*` и `games.*` в `src/i18n/dict.ts`. Скопировать из `reference/src/i18n/dict.ts`; там же «Спокойно» / «Асықпай», «Обычный» / «Қалыпты», «Блиц» / «Блиц». Описания темпов:

| Ключ | ru | kk |
|---|---|---|
| `game.mode.calm.desc` | Без таймера, с помощниками и разбором ошибок. Рекорд не ставится. | Таймерсіз, көмекшілермен және қателерді талдаумен. Рекорд жазылмайды. |
| `game.mode.normal.desc` | Время зависит от сложности задания. Калькулятор — как на ЕНТ. | Уақыт тапсырманың күрделілігіне байланысты. Калькулятор — ҰБТ-дағыдай. |
| `game.mode.blitz.desc` | На скорость и рекорд, без подсказок. | Жылдамдыққа және рекордқа, кеңестерсіз. |

`calm.desc` изменён: в образце было «с калькулятором», а в Matematika в «Спокойно» есть ещё формулы и графики. Новую kk-строку прогнать через `review:kk`.

**Тест оболочки** — e2e, раздел 15. Отдельный юнит-тест не нужен: логика наград проверяется в `tests/games.test.ts`.

---

## 5. Три темпа [образец]

Темпы появились по замечаниям тестеров образца (раздел 8). **Выбор темпа запоминается** в `profile.gameMode` (по умолчанию `"normal"`). Выбирают его на экране игры, не в профиле.

| | «Спокойно» (`calm`) | «Обычный» (`normal`) | «Блиц» (`blitz`) |
|---|---|---|---|
| Для чего | понять и потренироваться без стресса | тренировка в темпе, близком к ЕНТ | азарт, скорость, рекорд |
| Таймер | нет; карточки не падают | своё время на каждое задание, зависит от уровня A/B/C | общие часы раунда, ≤ 2 мин активной игры |
| После ошибки | разбор, ждём «Дальше» | разбор, авто-переход через 3–5 с или «Дальше»; часы стоят | короткий разбор 2–4 с; часы стоят |
| «Помощники» | все: калькулятор, формулы, графики, черновик | как на ЕНТ: калькулятор и черновик | нет (кнопка скрыта) |
| Пауза | не нужна (времени нет) | кнопка «Пауза» + авто-пауза в скрытой вкладке | только авто-пауза в скрытой вкладке |
| Длина | фиксированное число заданий | фиксированное число заданий | пока идут часы |
| XP | 1 за верное, максимум 15 | 2 за верное, максимум 30, +5 за новый рекорд | как «Обычный» |
| Рекорд | не ставится | свой, ключ `id` | свой, ключ `id:blitz` |

**Как это устроено в коде** [образец]: в `logic.ts` каждой игры есть объект `MODE_CONFIG: Record<GameMode, ModeConfig>`. В нём все числа темпа: время, число заданий, бонусы, задержки, «падает ли». `Game.tsx` берёт числа только оттуда. Тест проверяет конфиг: у `calm` нет таймеров, у `blitz` есть общие часы и жёсткий предел.

**Тип `ModeConfig`** у каждой игры свой, он объявляется в её `logic.ts`. Поля и их смысл даны в ТЗ игры (интерфейс с комментариями). Общие договорённости:
- единица времени — в имени поля или в комментарии: `…Ms` — миллисекунды, `…Seconds` — секунды. Не смешивать в одном поле;
- массив по уровням — `[A, B, C]`, индекс = уровень − 1; таблица по уровням — `Record<Level, …>` с ключами 1, 2, 3;
- `null` значит «этого в темпе нет»: нет таймера, нет авто-перехода, нет часов.

**Уровни внутри игры — единственный источник** (ТЗ игр ссылаются сюда). Уровни A/B/C = 1/2/3, в коде образца `tier` = уровень − 1. Задания идут от лёгкого к сложному. [образец, кроме `startLevel`]

| Игра | Старт | Рост | Спад | Лесенка |
|---|---|---|---|---|
| `pi-rush` | `startLevel` освоения первого навыка: A или B [новое, в образце всегда A] | +1 на каждом `tierEvery`-м верном ответе раунда (calm 4, normal и blitz 5) | −1 после 2 неверных подряд | нет |
| `sign-flip` | задания 1–2 — `build` уровня A | B с 3-го верного задания раунда, C с 6-го | нет | нет |
| `math-sort` | A | +1 на каждом `tierEvery`-м верном, не выше `maxTier` (calm и normal: каждые 8, до B; blitz: каждые 6, до C) | −1 после 2 неверных подряд | нет |
| `bug-hunt`, calm и normal | по лесенке | лесенка `tiers` по номеру задания: calm `[A, A, B, B, C, C]`, normal `[A, A, A, B, B, B, C, C]` | уровень = min(лесенка, адаптивный). Адаптивный стартует с C: −1 после 2 неверных подряд, +1 после каждых 3 верных | да |
| `bug-hunt`, blitz | A | +1 после каждых 3 верных находок | −1 после 2 неверных подряд | нет |
| бэклог (13) | задаёт ТЗ игры; по умолчанию как `pi-rush` | | | |

---

## 6. Награды, рекорды, освоение [образец]

`src/lib/games.ts` — скопировать из `reference/src/lib/games.ts` без изменений:

```ts
export const GAME_XP = {
  perCorrect: 2,
  cap: 30,
  newBest: 5,
  /** В спокойном режиме XP вдвое меньше (нет времени и есть помощь). */
  calmPerCorrect: 1,
  calmCap: 15,
} as const;

/** Ключ рекорда: у «Обычного» и «Блица» рекорды раздельные, в «Спокойном» рекорда нет. */
export function gameStatKey(gameId: string, mode: GameMode): string | null {
  if (mode === "calm") return null;
  return mode === "blitz" ? `${gameId}:blitz` : gameId;
}

export function gameReward(result: GameResult, prevBest: number | undefined, mode: GameMode = "normal"): GameReward {
  const calm = mode === "calm";
  const newBest = !calm && result.score > 0 && (prevBest === undefined || result.score > prevBest);
  const xp = calm
    ? Math.min(GAME_XP.calmCap, result.correct * GAME_XP.calmPerCorrect)
    : Math.min(GAME_XP.cap, result.correct * GAME_XP.perCorrect) + (newBest && prevBest !== undefined ? GAME_XP.newBest : 0);
  // освоение: доля верных по навыку, только если действий по навыку ≥ 3
  …                                   // полный код — reference/src/lib/games.ts
}
```

Что делает `recordGame(gameId, result, mode)` в сторе (`reference/src/lib/store.ts`) — **единственное место записи**:

| Что | Как |
|---|---|
| XP | `+reward.xp`, пишется и в `days[сегодня].xp`. Потолок 30 (calm 15) — игра не должна быть «фермой» XP вместо уроков |
| Рекорд | `games[gameStatKey] = { best, plays, lastAt }`. Бонус +5 только если прошлый рекорд был: первая игра «рекордом» не считается |
| Освоение | один раз за игру: по каждому навыку с ≥ 3 действиями `updateSkill(stat, доля верных)`. Меньше 3 действий — слишком мало данных |
| Серия дней | продлевается, если `result.total > 0` |
| День | `answers += total`, `correct += correct` |
| Достижение | `gamer` («Игрок» / «Ойыншы») после первой игры |

Итоговый экран рисует `GameShell` (раздел 4):
- очки;
- «Верно N/M»;
- «+XP»;
- «Новый рекорд!» с конфетти **или** «Рекорд — N. Ещё попытка — и побьёшь!»;
- кнопки «Ещё раз» и «К тренировкам».

---

## 7. Техника игрового поля (общая для всех игр)

### 7.1 Раскладка [образец]

```
Корень игры:  relative flex h-[calc(100dvh-56px)] w-full max-w-[640px] mx-auto flex-col
              px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] select-none touch-manipulation
Верхняя строка h-12:  очки слева (text-xl font-bold tabular-nums) · чип комбо «×3» по центру
                      (bg-streak-soft text-streak, скрыт при ×1) · секунды и <Mascot size={36}/> справа
Под ней — полоса времени 6 px: bg-primary → bg-warning (< 15 с) → bg-danger (< 5 с, секунды пульсируют)
Поле задания: flex-1, карточка bg-surface border-2 border-border rounded-3xl p-5
Нижняя треть («зона большого пальца»): кнопки ответа min-h-16, клавиатура, «Готово»
```

- Высота шапки `GameShell` — 56 px. Поле игры занимает всё место под ней, отступы задаёт сама игра.
- Проверять на ширинах 360 и 390 px (высота 844). На 360 px не должно быть горизонтальной прокрутки.

### 7.2 Часы и состояние [образец]

- **Один цикл `requestAnimationFrame`** на `performance.now()`, без `setInterval`: тот «уплывает». Шаг времени ограничить, как в образце `Math.min(dt, 100)`, чтобы после сна вкладки часы не прыгнули.
- **Пауза:**
  - вкладка скрыта (`document.visibilityState === "hidden"`);
  - идёт разбор ошибки;
  - висит баннер нового правила;
  - нажата «Пауза».
- **Таймеры — чистые функции в `logic.ts`:** `tick(state, dtMs)`, `remainingFraction(…)`, `isRoundOver(…)`. Тогда их можно проверить тестом без браузера.
- **Блокировка ввода.** С первого ответа до показа следующего задания ввод заблокирован. Так нет двойных ответов и двойных записей.
- **`onFinish` ровно один раз** [образец «Бит-спринта»; файла игры в `reference/` нет, нужное — в коде ниже]. Финиш идёт через таймер («Время!» → итоги). Все таймауты ставятся через `later()`, их id хранятся в наборе. При размонтировании набор очищается, поэтому `onFinish` после ухода со страницы не придёт. `finishedRef` защищает от второго вызова:

```ts
const finishedRef = useRef(false);
const timersRef = useRef<Set<number>>(new Set());
const later = (fn: () => void, ms: number) => {
  const id = window.setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
  timersRef.current.add(id);
  return id;
};
const end = () => {
  if (finishedRef.current) return;              // второй вызов ничего не делает
  finishedRef.current = true;
  lockedRef.current = true;                      // ввод заблокирован
  setTimeUp(true);                               // надпись «Время!»
  later(() => onFinish(buildResult()), END_DELAY_MS);
};
useEffect(() => {
  const timers = timersRef.current;
  let raf = 0;
  // … цикл часов: raf = requestAnimationFrame(loop)
  return () => {                                 // размонтировали: rAF и все таймауты отменены
    cancelAnimationFrame(raf);
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };
}, [mode]);
```

- **Не ставить `finishedRef.current = true` в очистке эффекта.** В режиме разработки (StrictMode) React монтирует компонент дважды; флаг останется `true`, и игра никогда не закончится.
- `seed` раунда создаётся снаружи логики (`Date.now()`), вся логика дальше детерминирована. Так тест может воспроизвести раунд.

### 7.3 Клавиатура [образец + новое]

- Глобальный обработчик `keydown` пропускает автоповтор (`e.repeat`) и события из полей, инструментов и экранной клавиатуры:

```ts
// src/lib/keys.ts — как в образце + [новое] data-keypad
export function ignoreKey(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.closest("[data-toolbox]") || el.closest("[data-keypad]")) return true;
  const tag = el.tagName;
  return el.isContentEditable || tag === "TEXTAREA" || (tag === "INPUT" && (el as HTMLInputElement).type !== "checkbox");
}
```

- Поле ответа само обрабатывает Enter (`onKeyDown` на `<input>`): глобальный обработчик его пропускает.
- Варианты ответа — клавиши 1–4. «Дальше» — Enter или пробел. Остальные клавиши указаны в ТЗ игр.
- Урок образца: цифры, набранные в калькуляторе, выбирали ответ в уроке. Поэтому всё внутри `[data-toolbox]` и `[data-keypad]` игнорируется.

### 7.4 Формулы, числа, ввод [новое]

- **Показ.** Текст с формулами выводит `MathText` из `src/components/math/Tex.tsx`: формулы в `$…$` рендерит KaTeX. Простые числа и степени пишем в Unicode (`2⁻²`, `√12`, `3/4`, `−5`), шрифт JetBrains Mono, `tabular-nums`. LaTeX — только то, что Unicode не передаёт: дробь с выражением, корень из выражения. Правило — `docs/ARCHITECTURE.md`, раздел 8.
- **Ширина.** Контейнер формулы — `max-w-full overflow-x-auto`. Длинную карточку сначала уменьшить шрифтом до 70 %, только потом прокрутка. Цвет KaTeX не задавать: тогда работает тёмная тема.
- **Числа на экране** — через `formatValue` / `formatRational` (`lib/math/format.ts`): запятая, «−», дроби.
- **Ввод на телефоне** — общий `MathKeypad` (`src/components/math/MathKeypad.tsx`) в компактном виде: клавиши `h-12`, сетка 4 × 4. Поле `inputMode="none"`, чтобы системная клавиатура не открывалась. Под полем `AnswerPreview` показывает, как код понял запись (`3/4` → ¾).
- **Ввод на ПК** — обычная клавиатура.
- **Проверка** — `checkInput(value, answers, mode, opts)` из `src/lib/check.ts`. Если `checkFormat` вернул ключ подсказки — показать подсказку, **не засчитывать ошибкой**, поле оставить открытым. В «Блице» штрафа за это нет.
- **Неверные варианты** — уникальные **по значению** (`checkAnswer`), а не по строке. В варианты нельзя ставить `0,5` и `1/2` как «разные». Исключение — игры, где равенство разных записей и есть задание («Сортировщик», правило «Равно X?»).

### 7.5 Отклик, анимация, доступность [образец]

- **Звук и вибрация** — `feedback(kind)` из `src/lib/feedback.ts`. Он читает настройки профиля. Виды: `correct`, `wrong`, `combo` (с `{ combo }`), `tap`, `pop`, `complete`. [новое: в образце игры вызывали `playSound` при `props.sound` и не вибрировали]
- **Маскот «Пи»** в верхней строке, 36 px:
  - по умолчанию `neutral`;
  - `happy` 600 мс после верного ответа;
  - `sad` 600 мс после ошибки;
  - `celebrate` на максимальном множителе.
- **Эффекты:**
  - встряска `Shake` на ошибке;
  - золотое всплывающее «+N» (`XpBurst`);
  - плавающие «+2 с» (зелёным) и «−4 с» (красным);
  - пружины `springSnappy` / `springSoft` (`src/components/motion/presets.ts`).
- **«Меньше анимаций»** (`useReduceMotion()`): без встряски, полёта и всплывающих чисел; состояния меняются мгновенно. В «Сортировщике» карточка стоит на месте, а под ней убывает полоса.
- **Доступность:**
  - область `aria-live="polite"`: «Верно» / «Неверно. Правильный ответ: X»;
  - цвет никогда не единственный сигнал — есть иконки `Check` / `X`;
  - фокус `focus-visible:ring-2 ring-primary`;
  - у переключателей — `aria-label`.
- **Семантика цветов** (`docs/DESIGN.md`):
  - верно — `success`;
  - неверно — `danger`;
  - частично или «почти» — `warning`;
  - очки и XP — `gold`;
  - комбо — `streak`;
  - основные кнопки — `primary`.

---

## 8. Уроки тестеров и ревью Informatica

Первый отзыв владельца и тестеров на Informatica — 2026-10-02, 25 замечаний. Номера — как в таблице `docs/CONCEPT.md`, раздел 10. Ниже то, что касается игр, и то, что нашло независимое ревью кода.

| № | Что сказали / что нашли | Что сделали в Informatica | Правило для Matematika |
|---|---|---|---|
| 5 | «Бит-спринт»: слишком быстро, много вопросов, нет помощи | три темпа, мягкий старт, плавный рост сложности, время по сложности, калькулятор в «Спокойно» | три темпа с первого дня; старт с A; время растёт с уровнем; в «Спокойно» все помощники |
| 6 | «Тумблер» местами быстровато | больше времени; в «Спокойно» веса разрядов и сумма всегда на экране; в «Обычном» 25–55 с на задание | в «Спокойно» значение выражения видно всегда; в «Обычном» 20–60 с на задание |
| 7 | «Сортировщик»: на трудных правилах (разряды) нужно больше времени | вес правила (трудные падают медленнее), пауза, правило объявляется заранее, в «Спокойно» карточки не падают | у каждого правила `weight`; баннер с паузой часов; в «Спокойно» карточки стоят |
| 8 | Больше эффектов, звуков, анимаций | библиотека motion, звуки Web Audio, вибрация, настройка «Меньше анимаций» | эффекты по `docs/DESIGN.md`; всё выключается настройками |
| 17 | Игры должны подходить к любым урокам | банк заданий с «формами»; игры станут универсальными | игры с первого дня берут задания из банка (3.6) |
| — | Все 4 игры «про одно и то же» — одна тема | игры делать, когда в курсе несколько тем | игры — после 2–3 тем с банками |
| 2 | Смайлики в названиях игр | заменены иконками lucide | только lucide |
| ревью | В «Тумблере» клик «Готово» проскакивал экран обратной связи | блокировка ввода до следующего задания | блокировка ввода (7.2), тест «двойной клик» |
| ревью | Двойной тап пропускал разбор ошибки; двойной клик «проскакивал» итоги урока | блокировка ввода через ref (`lockedRef`) от ответа до следующего вопроса; на итогах урока «Продолжить» активна через 0,7 с | то же; на итогах игры кнопки тоже активны через 0,7 с [новое] (раздел 4) |
| ревью | Enter: автоповтор, двойное срабатывание | `e.repeat` игнорируется; поле само обрабатывает Enter | 7.3 |
| ревью | Цифры из калькулятора выбирали ответ | `ignoreKey` и `data-toolbox` | + `data-keypad` для экранной клавиатуры (7.3) |
| ревью | Генератор иногда давал 2–3 варианта вместо 4 | тест-инвариант «ровно N уникальных вариантов» | тот же инвариант, уникальность **по значению** |
| ревью | Неточное округление больших чисел в калькуляторе | — | в математике критично: только `Rational` / `BigInt` |

**Что в образце признано удачным (отзыв и разбор игр) — оставить:**
- разные способы ввода: варианты и клавиатура;
- серия и множитель;
- «слепой» режим, где сумма скрыта;
- бонус «Идеально» за отсутствие лишних переключений;
- ловушки ЕНТ как «порчи» в «Найди ошибку» — самая «ЕНТ-шная» игра.

**Как придумывали игры в образце.** Работала «панель» моделей:
- 3 «дизайнера» смотрели с разных сторон: наука запоминания, игровой азарт, стоимость и переиспользуемость;
- 2 «судьи» оценивали: строгий учитель ЕНТ и защитник интересов подростка;
- сильная модель выбирала и писала подробные ТЗ;
- 4 исполнителя писали код параллельно, у каждого был ревьюер.

Для новых игр Matematika можно повторить так же: прораб пишет ТЗ, исполнители делают, ревью обязательно.

---

## 9. ТЗ игры 1: «Пи-спринт» (`pi-rush`)

**Суть.** Поток коротких вопросов по пройденным темам. Отвечать вариантом или вводом. Серия верных ответов поднимает множитель. Это движок «поток вопросов» образца (`bit-rush`): новые темы подключаются банком, игра не меняется.
**Тренирует:** беглость, быструю устную математику, узнавание ловушек.
**Навыки:** `skillsWithShape(ALL, "question")` ∩ открытые уроками.

### 9.1 Источник заданий

- Задание = `bankFor(skill).question(level, seed)`. Годится только «шаг раунда»:
  - `choice` с 2–4 уникальными по значению вариантами;
  - `input` с `mode: "number"` и опциональными `opts` (`round`, `tolerance`, `form`).
- Неподходящий шаг (`multi`, `match`, `plane`, `input` в режимах `set`/`interval`/`point` и т. п.):
  1. перебросить `seed + 7919·k` для `k = 1..10`;
  2. не вышло — взять `short` того же навыка и превратить его в `input`;
  3. нет и `short` — взять другой навык.
- **Уровень** `tier ∈ {0, 1, 2}` → `Level = tier + 1` (A/B/C). Старт, рост и спад — таблица раздела 5 (строка `pi-rush`).
- **Выбор навыка** — `pickSkill` (3.5): вес `(1,1 − m)²`, не 3 раза подряд.
- **Без повторов.** Ключ — первые 4 сегмента `id` (`g:skill:форма:параметры`). Порядок попыток:
  1. открытые навыки без повторов;
  2. открытые с повторами;
  3. если вопросов нет совсем — `nextQuestion` возвращает `null`, раунд заканчивается досрочно с тем, что набрано (`onFinish` как обычно). В образце здесь `throw`; в живой игре это белый экран. Тест проверяет, что на настоящем банке `null` не бывает.
- **Повтор после ошибки** — во всех темпах. Неверный вопрос возвращается один раз через `RETRY_GAP = 3` вопроса, варианты перемешаны (индекс верного пересчитан). Повтор считается обычным действием.

### 9.2 Ход раунда

1. После «Играть» сразу первый вопрос (въезжает снизу). В «Блице» часы пошли.
2. **`choice`:** кнопки с вариантами, `MathText`.
   **`input`:** поле + `AnswerPreview` + `MathKeypad` (телефон) + «OK». «OK» неактивна при пустом поле.
3. **Верно:**
   - кнопка зелёная с `Check` 300 мс;
   - «+N» летит к очкам;
   - `feedback("correct")`, а с серии 3 — `feedback("combo", { combo })`;
   - через `nextDelayMs` — следующий вопрос.
4. **Неверно:**
   - встряска карточки;
   - выбранное — красное с `X`, верное — зелёное с `Check`;
   - у `input` строка «Правильный ответ: X» (`expectedText`);
   - под карточкой `explanation` шага (`text-sm`);
   - `feedback("wrong")`;
   - **часы стоят**, пока виден разбор. Дальше — по тапу, Enter, пробелу, кнопке «Дальше» или сами через `revealAutoMs`.
5. **Время вопроса вышло** («Обычный»): засчитать как ошибку, показать разбор, текст `questionTimeUp`.
6. **Конец:**
   - «Спокойно» и «Обычный» — ответов стало `questions`;
   - «Блиц» — часы ≤ 0 или 120 с активной игры.
   Потом надпись «Время!» на 700 мс → `onFinish` один раз.

### 9.3 Темпы — `MODE_CONFIG` (стартовые значения)

```ts
export const ROUND_MS = 60_000;
export const HARD_CAP_MS = 120_000;
export const PENALTY_MS = 4_000;
export const RETRY_GAP = 3;

export interface ModeConfig {
  clockMs: number | null;                   // общие часы раунда, мс; null — часов нет
  hardCapMs: number | null;                 // жёсткий предел активной игры, мс; null — нет
  bonusMs: readonly number[];               // + к часам за верный ответ, мс, [A, B, C] (только blitz)
  penaltyMs: number;                        // − от часов за ошибку, мс (только blitz)
  questions: number | null;                 // вопросов в раунде; null — пока идут часы
  choiceBudgetMs: readonly number[] | null; // время на вопрос с вариантами, мс, [A, B, C]; null — без лимита
  inputExtraMs: number;                     // добавка к choiceBudgetMs для вопроса с вводом, мс
  questionTimeout: boolean;                 // вышло время вопроса → ошибка
  tierEvery: number;                        // каждый N-й верный ответ — уровень +1 (раздел 5)
  revealAutoMs: number | null;              // разбор ошибки сам закрывается через, мс; null — ждём «Дальше»
  nextDelayMs: number;                      // пауза после верного ответа, мс
  scoring: "flat" | "remaining" | "window"; // очки: ровно база / + остаток времени / + окно скорости (9.4)
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm:   { clockMs: null,     hardCapMs: null,        bonusMs: [],                    penaltyMs: 0,          questions: 12,   choiceBudgetMs: null,                     inputExtraMs: 0,      questionTimeout: false, tierEvery: 4, revealAutoMs: null,  nextDelayMs: 700, scoring: "flat" },
  normal: { clockMs: null,     hardCapMs: null,        bonusMs: [],                    penaltyMs: 0,          questions: 15,   choiceBudgetMs: [15_000, 20_000, 25_000], inputExtraMs: 10_000, questionTimeout: true,  tierEvery: 5, revealAutoMs: 4_000, nextDelayMs: 500, scoring: "remaining" },
  blitz:  { clockMs: ROUND_MS, hardCapMs: HARD_CAP_MS, bonusMs: [2_000, 3_000, 4_000], penaltyMs: PENALTY_MS, questions: null, choiceBudgetMs: null,                     inputExtraMs: 0,      questionTimeout: false, tierEvery: 5, revealAutoMs: 3_000, nextDelayMs: 350, scoring: "window" },
};
```

| | Образец (`bit-rush`) | Matematika | Почему |
|---|---|---|---|
| «Обычный», время на вопрос с вариантами A/B/C | 12 / 16 / 20 с | 15 / 20 / 25 с | математическое задание думается дольше [проверить] |
| «Обычный», добавка за ввод | +8 с | +10 с | дробь и минус набирать дольше [проверить] |
| «Блиц», бонус за верный ответ A/B/C | +1,5 / 2,5 / 3,5 с | +2 / 3 / 4 с | то же [проверить] |
| «Блиц», штраф за ошибку | −4 с | −4 с | без изменений |
| «Блиц», окно скорости | 6 с (варианты) / 9 с (ввод), −1 с за уровень, не ниже 4 / 6 | 8 / 12 с, −1 с за уровень, не ниже 6 / 9 | [проверить] |

Потолок часов в «Блице» — 60 с: бонус не поднимает время выше. Счёт никогда не убывает.

### 9.4 Очки [образец]

- База: 10 за вопрос с вариантами, 15 за ввод.
- Множитель по серии (с учётом текущего ответа): 1–2 → ×1; 3–5 → ×2; 6–9 → ×3; 10–14 → ×4; 15+ → ×5.
- По темпам:
  - «Спокойно»: `база × множитель`;
  - «Обычный»: `(база + round(10 × доля оставшегося времени)) × множитель`;
  - «Блиц»: `round(база × множитель × (1 + 0,5 × скорость))`, где `скорость = max(0, 1 − секунд на вопрос / окно)`.
- Ошибка даёт 0.
- Чип «Быстро!» — при `скорость > 0,6`.
- Фон-градиент (`primary-soft` → `streak-soft`) по множителю: непрозрачность 0 до ×3, 0,6 на ×4, 1 на ×5.

### 9.5 Экран (390 px)

```
┌──────────────────────────────────────┐
│ 120          ×3           42 с  [Пи] │ h-12
│ ████████████████████░░░░░░░░░░░░░░░ │ полоса 6 px (Блиц — часы, Обычный — время вопроса)
│ ┌──────────────────────────────────┐ │
│ │ Вопрос 4 из 15         [Повтор]  │ │ text-xs muted; «Повтор» — Pill warning
│ │                                  │ │
│ │     Вычисли: 2⁻² · 8          ◔  │ │ text-2xl; кольцо скорости 28 px (Блиц)
│ └──────────────────────────────────┘ │
│  Верно!  ·  или разбор ошибки         │ min-h-12, aria-live
│ ┌───────────────┐ ┌───────────────┐ │
│ │       2       │ │      −32      │ │ grid-cols-2 gap-3, min-h-16, text-xl mono
│ └───────────────┘ └───────────────┘ │
│ ┌───────────────┐ ┌───────────────┐ │
│ │      32       │ │       4       │ │
│ └───────────────┘ └───────────────┘ │
└──────────────────────────────────────┘
Ввод: поле h-14 (font-mono text-2xl) · AnswerPreview · MathKeypad 4×4 (клавиши h-12) · «OK» h-14
```

Неверные варианты в примере — типичные ошибки:
- −32 — «2⁻² = −4»;
- 32 — потерян минус в показателе;
- 4 — «2⁻² = ½».
Их строит банк, игра их только показывает.

**Клавиши:**
- варианты — 1–4;
- ввод — цифры, `,` / `.`, `-`, `/`, Backspace, Enter = OK;
- во время разбора — Enter или пробел.

### 9.6 Тексты `src/games/pi-rush/strings.ts`

kk — черновик, прогнать `npm run review:kk`. Строки с пометкой «образец» уже вычитаны в Informatica.

| Ключ | ru | kk |
|---|---|---|
| `score` | Очки | Ұпай (образец) |
| `combo` | Комбо | Комбо (образец) |
| `seconds` | {n} с | {n} с |
| `correct` | Верно! | Дұрыс! (образец) |
| `wrong` | Неверно | Қате (образец) |
| `answerWas` | Правильный ответ: {a} | Дұрыс жауап: {a} (образец) |
| `tapToContinue` | Нажми, чтобы продолжить | Жалғастыру үшін бас (образец) |
| `next` | Дальше | Келесі |
| `timeUp` | Время! | Уақыт бітті! (образец) |
| `questionTimeUp` | Время на вопрос вышло | Сұрақтың уақыты бітті |
| `typeAnswer` | Введи ответ | Жауапты енгіз (образец) |
| `erase` | Стереть | Өшіру (образец) |
| `ok` | OK | OK |
| `clockPlus` | +{n} с | +{n} с |
| `clockMinus` | −{n} с | −{n} с |
| `fast` | Быстро! | Жылдам! (образец) |
| `retryTag` | Повтор | Қайталау (образец) |
| `progress` | Вопрос {n} из {total} | {n}-сұрақ, барлығы {total} (образец) |
| `announceRight` | Верно | Дұрыс |
| `announceWrong` | Неверно. Правильный ответ: {a} | Қате. Дұрыс жауап: {a} (образец) |
| `announceTimeout` | Время вышло. Правильный ответ: {a} | Уақыт бітті. Дұрыс жауап: {a} (образец) |
| `pause` / `paused` / `resume` | Пауза / Игра на паузе / Продолжить | Үзіліс / Ойын кідіртілді / Жалғастыру |

Подсказку формата игра не хранит: она берёт текст из словаря по ключу, который вернул `checkFormat` (`input.format.*`).

**`meta` (в `registry.ts`):**
- `title`: «Пи-спринт» / «Пи-спринт».
- `description`: ru «Поток коротких вопросов по пройденным темам — от простых к сложным. Темп выбираешь сам.» / kk «Өтілген тақырыптар бойынша қысқа сұрақтар легі — жеңілден күрделіге қарай. Қарқынды өзің таңдайсың.»
- `rules` ru:
  ```
  Выбирай вариант или вводи ответ. Серия верных ответов увеличивает множитель очков.
  Спокойно: 12 вопросов без таймера, после ошибки — разбор.
  Обычный: 15 вопросов, на каждый — время по сложности.
  Блиц: 60 секунд, верный ответ +2…4 с (чем сложнее, тем больше), ошибка −4 с.
  ```
- `rules` kk:
  ```
  Нұсқаны таңда немесе жауапты енгіз. Дұрыс жауаптар сериясы ұпай көбейткішін арттырады.
  Асықпай: таймерсіз 12 сұрақ, қатеден кейін — талдау.
  Қалыпты: 15 сұрақ, әрқайсысына күрделілігіне қарай уақыт беріледі.
  Блиц: 60 секунд, дұрыс жауап +2…4 с (неғұрлым күрделі болса, соғұрлым көп), қате −4 с.
  ```

### 9.7 Тесты `tests/games/pi-rush.test.ts`

- [ ] `MODE_CONFIG`: у `calm` нет часов и лимита на вопрос; у `normal` 15 вопросов и `questionTimeout`; у `blitz` 60 с, предел 120 с.
- [ ] Для каждого навыка пула × уровни 1–3 × seed 1..100 поток выдаёт только шаги раунда. У `choice` 2–4 варианта, уникальных по значению, индекс верного в диапазоне. У `input` эталон проходит `checkInput(answer, answers, mode, opts)`.
- [ ] Детерминизм: одинаковые `seed` и ответы дают одинаковую последовательность вопросов.
- [ ] Нет повторов по ключу id в раунде, пока есть уникальные задания. Пустой пул → `null` и конец раунда, без исключения.
- [ ] Повтор после ошибки — ровно через 3 вопроса, один раз, варианты перемешаны, верный индекс пересчитан.
- [ ] Уровень: +1 на каждом `tierEvery`-м верном, −1 после двух ошибок подряд, границы 0..2.
- [ ] `multiplier` на границах 2/3, 5/6, 9/10, 14/15.
- [ ] `scoreFor` во всех трёх темпах. `clockAfter`: потолок 60 с, штраф −4 с.
- [ ] `isRoundOver`: по числу вопросов (`calm`, `normal`), по часам и пределу (`blitz`).
- [ ] Ответ с ошибкой формата (`checkFormat` ≠ null) не меняет счётчики.

### 9.8 Готово, когда

- [ ] Все три темпа играются на 390 px, ru и kk, светлая и тёмная тема.
- [ ] Формулы в вопросах и вариантах не вылезают за экран на 360 px.
- [ ] На телефоне не открывается системная клавиатура. На ПК ввод с клавиатуры работает, Enter = OK.
- [ ] Двойной тап по варианту не даёт двух ответов. Двойной тап по «Дальше» не пропускает следующий вопрос.
- [ ] Цифры в калькуляторе «Помощников» не выбирают вариант.
- [ ] Ошибка формата не считается ошибкой.
- [ ] Скрытая вкладка ставит часы на паузу.
- [ ] `onFinish` вызывается один раз. Уход со страницы посреди игры не записывает результат.
- [ ] Тесты зелёные. Нет строк без kk.

---

## 10. ТЗ игры 2: «Тумблер знаков» (`sign-flip`)

**Суть.** Аналог «Битового тумблера» образца. Там переключатели-биты собирали число, здесь переключатели-**знаки** между числами собирают выражение. Тап по знаку переключает его по кругу: `+ → − → × → ÷ → +`. Нужно получить заданное значение или выполнить условие.
**Тренирует:** порядок действий, действия с отрицательными числами, дроби (уровни B–C).
**Навыки:**

```ts
export const SIGN_SKILLS = ["num.order", "num.int", "num.fractions"];
```

**Навык задания** — одно правило на все виды и уровни [новое]. Код считает его по эталонной расстановке: в `build` — `sol`, в `read` — показанная, в `property` — пример решения.
1. `num.fractions` — если цель или хоть одно промежуточное значение (по порядку действий) не целое.
2. Иначе `num.int` — если в выражении есть отрицательное число.
3. Иначе `num.order`.

### 10.1 Три вида заданий (как BUILD / READ / PROPERTY в образце)

| Вид | Что делает ученик | Как проверяет код |
|---|---|---|
| **«Получи число»** (`build`) | расставляет знаки так, чтобы выражение равнялось цели T | значение выражения считается точно (`evalExact` из `lib/math`) и сравнивается с T. **Засчитывается любая** расстановка, дающая T |
| **«Сколько получится?»** (`read`) | знаки уже стоят (заблокированы), выбрать значение из 3 вариантов | индекс верного варианта |
| **«По условию»** (`property`) | получить: наибольшее / наименьшее значение, отрицательное число, ноль, число, кратное k, дробное (не целое) число | предикат над точным значением; «наибольшее» и «наименьшее» — сравнение с перебором всех расстановок |

### 10.2 Генерация (код, детерминированно по seed)

| Уровень | Чисел / слотов | Числа | Знаки в цикле | Особенности |
|---|---|---|---|---|
| A | 3 / 2 | 1–10 | только `+`, `−` (цикл из 2) | цель — целое число от −20 до 30 |
| B | 4 / 3 | 1–12 | `+ − × ÷` | цель целая; промежуточные дроби разрешены |
| C | 4 / 3 | одно отрицательное в скобках `(−7)` или одно число в квадрате `3²` | `+ − × ÷` | цель целая, промежуточные дроби разрешены; в «Обычном» и «Блице» — «слепой» режим в `build` (10.4) |

Алгоритм `build`:
1. Взять числа уровня и случайную расстановку `sol`.
2. Посчитать `T = value(nums, sol)` точно. Деление на 0 → `null` → заново.
3. Отбросить, если `T` не целое или `|T| > 100`.
4. Перебрать **все** расстановки: при 3 слотах и 4 знаках это 4³ = 64 варианта. Решения `S` — все, где значение = T. Нужно `1 ≤ |S| ≤ 3`, иначе заново.
5. Начальное положение — все `+`. Если оно уже даёт T — заново.
6. До 50 попыток, дальше другой вид задания.

**`read`.** Знаки случайные, значение `V`. Три варианта, уникальные по значению:
- `V`;
- **«слева направо без приоритета»** — главная ловушка (6 + 2 × 3 → 24 вместо 12), если оно отличается от `V`;
- недостающие варианты — первые подходящие из `V + k`, `V − k` (k = 1…3), `−V`, уникальные по значению. Если ловушка совпала с `V`, оба недостающих берутся так же.

**`property`.** Условие выбирается по уровню:
- A: ноль, отрицательное, наибольшее;
- B: + наименьшее, кратное k ∈ {3, 4, 5};
- C: + дробное.

Требования к условию:
- хотя бы одна расстановка подходит;
- подходит не больше половины расстановок — иначе условие слишком лёгкое;
- начальное положение не подходит;
- у «наибольшего» и «наименьшего» значение единственное, хотя расстановок с ним может быть несколько: подходит любая.

**«Идеально»** [образец]. Переключений столько же, сколько минимально нужно, чтобы из начального положения дойти до **какого-то** решения. Расстояние слота — `(индекс цели − индекс начала + длина цикла) % длина цикла`. «Сброс» счётчик переключений не обнуляет. Бонус +5 даётся только в `build` и `property`.

**Пример (B):** числа 6, 2, 3; цель 12.
- Единственное решение: 6 + 2 × 3 = 12. Переключений минимум 2: второй знак `+ → − → ×`.
- Ловушка для `read`: (6 + 2) × 3 = 24.

### 10.3 Раунд

- 10 основных заданий («Блиц» — пока идут 90 с).
- Задания 1–2 — `build` уровня A: учим управление.
- Дальше вид выбирается с весами: `build` 0,45 / `read` 0,30 / `property` 0,25 × вес навыка.
- Уровень — раздел 5: B с 3-го верного задания, C с 6-го.
- Неверное задание возвращается один раз в конец раунда, не больше `maxRetries` (3) за раунд, только в «Обычном» и «Блице». В «Спокойно» повторов нет (`maxRetries: 0`), вместо них разбор [образец].

### 10.4 Темпы — `MODE_CONFIG`

```ts
type Limits = Record<"build" | "read" | "property", Record<Level, number>>;   // секунды
const NORMAL_LIMITS: Limits = { build: { 1: 30, 2: 40, 3: 50 }, read: { 1: 20, 2: 25, 3: 30 }, property: { 1: 40, 2: 50, 3: 60 } };
const BLITZ_LIMITS:  Limits = { build: { 1: 20, 2: 16, 3: 14 }, read: { 1: 10, 2: 9,  3: 8  }, property: { 1: 22, 2: 18, 3: 16 } };

export interface ModeConfig {
  taskSeconds: Limits | null;               // секунды на задание по виду и уровню; null — без таймера
  roundSeconds: number | null;              // общие часы раунда, с; null — часов нет
  primaryTasks: number;                     // основных заданий в раунде
  maxRetries: number;                       // сколько ошибочных заданий вернётся в конце раунда; 0 — повторов нет
  valueHiddenFrom: Level | null;            // с какого уровня живое значение скрыто в build; null — никогда
  timeBonus: "none" | "scaled" | "seconds"; // бонус: нет / round(20 × доля остатка) / ceil(секунд осталось) (10.5)
  pausable: boolean;                        // есть кнопка «Пауза»
  correctAdvanceMs: number;                 // переход после верного ответа, мс
  wrongAdvanceMs: number | null;            // переход после ошибки, мс; null — ждём «Дальше»
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm:   { taskSeconds: null,          roundSeconds: null, primaryTasks: 10, maxRetries: 0, valueHiddenFrom: null, timeBonus: "none",    pausable: false, correctAdvanceMs: 1300, wrongAdvanceMs: null },
  normal: { taskSeconds: NORMAL_LIMITS, roundSeconds: null, primaryTasks: 10, maxRetries: 3, valueHiddenFrom: 3,    timeBonus: "scaled",  pausable: true,  correctAdvanceMs: 1100, wrongAdvanceMs: 4000 },
  blitz:  { taskSeconds: BLITZ_LIMITS,  roundSeconds: 90,   primaryTasks: 10, maxRetries: 3, valueHiddenFrom: 3,    timeBonus: "seconds", pausable: false, correctAdvanceMs: 900,  wrongAdvanceMs: 2500 },
};
```

- **`valueHiddenFrom`** — с какого уровня живое значение выражения скрыто («= ?», «слепой» режим образца). Как в образце: только уровень C, только в «Обычном» и «Блице» [образец: `blind && tier === 2`]. Скрытие действует только в `build`: в `read` значение и есть вопрос, до ответа его не видно никогда; в `property` значение видно. В «Спокойно» значение видно всегда: так решили по замечанию №6.
- **Время задания вышло** — это ошибка, задание вернётся в конец раунда.
- **Образец для сравнения:** «Обычный» 25/35/45 с (условие 35/45/55), «Блиц» 20/16/12 с (чтение 10/8/6). В Matematika на A больше, потому что считать выражение дольше, чем смотреть на биты. [проверить]

### 10.5 Очки [образец]

- Верно: `10 + бонус`:
  - «Обычный» — `round(20 × доля оставшегося времени)`;
  - «Блиц» — `ceil(секунд осталось)`;
  - «Спокойно» — 0.
- «Идеально»: +5.
- Ошибка и тайм-аут: 0.

### 10.6 Обратная связь

- **Верно:**
  - слоты по очереди вспыхивают зелёным, задержка 40 мс;
  - золотое «+N»;
  - чип «Идеально», если было.
- **Неверно:**
  - слоты, которые отличаются от ближайшего решения, — в красной рамке;
  - ниже «Можно так:» и верная расстановка с вычислением **по порядку действий**. Строит код: «2 × 3 = 6, потом 6 + 6 = 12»;
  - причина: «Получилось {v}, а нужно {t}».
- Если значение ученика совпадает с подсчётом «слева направо», добавить строку правила: «Сначала умножение и деление, потом сложение и вычитание».
- Для `property` — причина своя (таблица строк) и пример верной расстановки.

### 10.7 Экран

```
┌──────────────────────────────────────┐
│ 85    3/10                  27 с [Пи]│
│ █████████████░░░░░░░░░░░░░░░░░░░░░░ │
│ Расставь знаки, чтобы получилось 12  │ text-lg font-bold
│                                      │
│    6   [ + ]   2   [ × ]   3         │ числа font-mono text-3xl; слот 48×56 rounded-xl:
│                                      │ знак в цикле bg-surface-2, изменённый — bg-primary text-white
│            = 12                      │ живое значение (в «слепом» режиме «= ?»)
│  Переключений: 2                     │ text-xs muted
│ ┌──────────┐ ┌─────────────────────┐ │
│ │  Сброс   │ │       Готово        │ │ h-14: «Сброс» 1/3, «Готово» 2/3 (primary)
│ └──────────┘ └─────────────────────┘ │
└──────────────────────────────────────┘
`read`: знаки заблокированы (bg-surface-2, Lock 12 px), ниже 3 кнопки-варианта min-h-16.
```

- **Ширина.** 4 числа и 3 слота на 360 px: числа ≤ 3 символов и `(−7)` при `text-3xl`. Сверх этого шрифт уменьшается (`monoFit`), не переносится.
- **Знаки** — Unicode: `+`, `−` (U+2212), `×`, `÷`.
- **Доступность.** Слот — `button` с `aria-label`: «Знак 2: умножить. Нажми, чтобы сменить».
- **Клавиши:**
  - 1…k — переключить слот k;
  - Backspace — «Сброс»;
  - Enter — «Готово»;
  - в `read` 1–3 — выбрать вариант.
- **Автоотправки нет** [образец]: проверка только по «Готово».

### 10.8 Тексты `src/games/sign-flip/strings.ts`

kk — черновик, прогнать `review:kk`. Правило kk: падежный суффикс клеим к слову «сан» / «мән», а не к подставленному числу.

| Ключ | ru | kk |
|---|---|---|
| `build` | Расставь знаки, чтобы получилось {t} | {t} шығатындай таңбаларды қой |
| `read` | Сколько получится? | Неше шығады? |
| `property` | Расставь знаки по условию | Таңбаларды шарт бойынша қой |
| `goalMax` | Получи наибольшее значение | Ең үлкен мәнді шығар |
| `goalMin` | Получи наименьшее значение | Ең кіші мәнді шығар |
| `goalNegative` | Получи отрицательное число | Теріс сан шығар |
| `goalZero` | Получи ноль | Нөл шығар |
| `goalMultiple` | Получи число, кратное {k} | {k} санына еселі сан шығар |
| `goalNotInteger` | Получи дробное (не целое) число | Бүтін емес сан шығар |
| `value` | Значение | Мәні |
| `valueHidden` | Значение скрыто — считай в уме | Мәні жасырылған — ойша есепте |
| `taps` | Переключений: {n} | Ауыстырулар: {n} (образец) |
| `reset` | Сброс | Тазарту (образец) |
| `submit` | Готово | Дайын (образец) |
| `correct` / `wrong` | Верно! / Неверно | Дұрыс! / Қате (образец) |
| `perfect` | Идеально: без лишних переключений | Мінсіз: артық ауыстырусыз (образец) |
| `perfectChip` | Идеально | Мінсіз (образец) |
| `taskTimeUp` | Время на задание вышло | Тапсырма уақыты бітті (образец) |
| `retryLater` | Это задание вернётся позже | Бұл тапсырма кейін қайта келеді (образец) |
| `canBe` | Можно так: | Былай болады: |
| `reasonNotEqual` | Получилось {v}, а нужно {t} | {v} шықты, ал керегі {t} (образец) |
| `reasonOrder` | Сначала умножение и деление, потом сложение и вычитание | Алдымен көбейту мен бөлу, содан кейін қосу мен азайту |
| `reasonNotMax` | Можно больше: {ex} | Бұдан да үлкен болады: {ex} |
| `reasonNotMin` | Можно меньше: {ex} | Бұдан да кіші болады: {ex} |
| `reasonNotNegative` | {v} — не отрицательное число | {v} — теріс сан емес |
| `reasonNotMultiple` | {v} не делится на {k} | {v} саны {k} санына бөлінбейді |
| `reasonInteger` | {v} — целое число | {v} — бүтін сан |
| `divZero` | На ноль делить нельзя | Нөлге бөлуге болмайды |
| `slotAria` | Знак {i}: {sign}. Нажми, чтобы сменить | {i}-таңба: {sign}. Ауыстыру үшін бас |
| `signPlus` / `signMinus` / `signTimes` / `signDiv` | плюс / минус / умножить / разделить | қосу / азайту / көбейту / бөлу |
| `optionsAria` | Варианты ответа | Жауап нұсқалары (образец) |
| `timeUp` | Время! | Уақыт бітті! (образец) |

**`meta`:**
- `title`: «Тумблер знаков» / «Таңба қосқыштары».
- `description`: ru «Переключай знаки между числами и получай нужное значение — тренировка порядка действий.» / kk «Сандар арасындағы таңбаларды ауыстырып, керекті мәнді шығар — амалдар ретіне жаттығу.»
- `rules` ru:
  ```
  Нажимай на знак между числами: + → − → × → ÷. Получи нужное число или выполни условие. Без лишних переключений — бонус «Идеально».
  Спокойно: значение выражения всегда на экране, после ошибки — разбор.
  Обычный: на каждое задание своё время; в сложных заданиях значение скрыто.
  Блиц: 90 секунд на всё.
  ```
- `rules` kk:
  ```
  Сандар арасындағы таңбаны бас: + → − → × → ÷. Керекті санды шығар немесе шартты орында. Артық ауыстырусыз — «Мінсіз» бонусы.
  Асықпай: өрнектің мәні әрдайым экранда, қатеден кейін — талдау.
  Қалыпты: әр тапсырмаға өз уақыты; күрделі тапсырмаларда мәні жасырылады.
  Блиц: барлығына 90 секунд.
  ```

### 10.9 Тесты `tests/games/sign-flip.test.ts`

- [ ] **Значение выражения.** `value()` через `lib/math` совпадает с независимым подсчётом: свой мини-вычислитель в тесте, два прохода по приоритету, float с допуском 1e-9. Проверить на всех расстановках 1000 случайных наборов.
- [ ] **`build`.**
  - Решений от 1 до 3, найдены полным перебором.
  - Начальное положение не решение.
  - `T` целое, `|T| ≤ 100`.
  - Деление на 0 не даёт решения и не роняет код.
- [ ] **`read`.** 3 варианта, уникальны по значению, ровно один верный. Ловушка «слева направо» есть, если отличается от `V`; если совпала — варианты из `V ± k`.
- [ ] **Навык задания** по правилу из начала раздела 10: дробное промежуточное значение → `num.fractions`; отрицательное число без дробей → `num.int`; иначе `num.order`.
- [ ] **«Слепой» режим** — только уровень C, только `build`, только `normal` и `blitz`.
- [ ] **`property`.**
  - Предикат верен: «наибольшее» = максимум перебора.
  - Подходящих расстановок от 1 до половины.
  - Начальное положение не подходит.
- [ ] **«Идеально».** Минимум переключений посчитан верно, в том числе по кругу: из `÷` в `+` — 1 тап.
- [ ] **Раунд.**
  - Первые 2 задания — `build` A.
  - Уровень растёт после 3-го и 6-го верного (раздел 5).
  - Повторов ≤ 3, повтор в конце.
  - В `calm` повторов нет.
- [ ] **Конфиг.** У `calm` нет таймеров. У `blitz` 90 с. Время задания берётся из таблиц.
- [ ] **Детерминизм** по seed.

### 10.10 Готово, когда

- [ ] Все три темпа на 360 и 390 px, ru и kk, тёмная тема.
- [ ] Длинное выражение уровня C не переносится и не вылезает за экран.
- [ ] «Готово» нельзя нажать дважды. Клик во время обратной связи не проскакивает её (баг образца).
- [ ] Разбор показывает верную расстановку и вычисление по шагам.
- [ ] В «Спокойно» значение видно всегда, в «слепом» режиме — «= ?».
- [ ] Тесты зелёные.

---

## 11. ТЗ игры 3: «Сортировщик» (`math-sort`)

**Суть** [образец `bit-sort`]. Карточка с числом или выражением медленно падает к 2–3 корзинам. Ученик отправляет её в корзину по **текущему правилу**: тапом по корзине, свайпом карточки или клавишей. Правило меняется каждые N карточек — это **чередование тем**, оно полезно для запоминания.
**Тренирует:** классификацию и узнавание. Например: «это рациональное?», «это корень?», «это равно 0,25?».
**Навыки:** навыки правил (`SORT_SKILLS` = объединение `rule.skill`). В раунд идут только правила с открытыми навыками.

### 11.1 Правила — данные + предикат (`src/games/math-sort/rules.ts`)

```ts
export interface Card {
  /** Что на карточке: Unicode или $…$. Процент пишется «25 %». */
  text: string;
  /** Выражение в синтаксисе парсера lib/math — для вычисления. Процент — как дробь: 25 % → "25/100". */
  expr: string;
  /** Только для правил, где класс нельзя посчитать точно (rational): вид шаблона и его числа. */
  tmpl?: { kind: string; nums: number[] };
}

export interface RuleSet {
  id: RuleId;
  skill: SkillId;
  /** Сложность: множитель времени падения (1 — лёгкое). */
  weight: number;
  /** Заголовок; params — параметры правила (X, уравнение…), выбираются при смене правила. */
  title: (p: RuleParams) => L;
  /** 2–3 подписи корзин. */
  bins: (p: RuleParams) => L[];
  params: (rand: Rand, level: Level) => RuleParams;
  gen: (rand: Rand, level: Level, p: RuleParams) => Card;
  /** Индекс верной корзины — СЧИТАЕТ КОД: точно через evalExact (lib/math); у rational — по card.tmpl (ниже), не через float. */
  classify: (card: Card, p: RuleParams) => number;
  /** Одна строка разбора: «√12 = 2√3 — корень не извлекается → иррациональное». */
  explain: (card: Card, p: RuleParams) => L;
}
export const RULES: RuleSet[] = [ … ];
export const SORT_SKILLS: SkillId[] = [...new Set(RULES.map((r) => r.skill))];
```

**Новая тема** — это новые наборы правил в этом файле, а не новая игра [образец].

**Стартовый набор правил** (раздел 1–2 курса и трек «Математическая грамотность»):

| id | Правило (ru) | Корзины | Примеры карточек → корзина | Навык | weight |
|---|---|---|---|---|---|
| `sign` | Какой знак у значения? | < 0 · = 0 · > 0 | (−2)³ → < 0; **−3² → < 0** (ловушка: не 9); (−3)² → > 0; 5 − 2·4 → < 0; (−1)¹⁰⁰ − 1 → 0 | `num.int` | 1,0 |
| `compare1` | Сравни с единицей | < 1 · = 1 · > 1 | (2/3)⁻¹ → > 1; 2⁻³ → < 1; (1/2)⁰ → = 1; 0,9² → < 1; 7/9 → < 1 | `num.fractions` | 1,1 |
| `rational` | Рациональное или иррациональное? | рациональное · иррациональное | √16 → рац.; √12 → иррац.; **√2·√8 → рац.** (= 4); √(9/4) → рац.; 2 + √3 → иррац.; (√3)² → рац.; π → иррац. | `num.roots` | 1,2 |
| `equal` | Равно {x}? (x ∈ {0,25; 0,5; 0,2; 0,75; 1,5}) | равно · не равно | для 0,25: 1/4, 25 %, 2⁻², (1/2)², 2/8 → равно; 0,025, 1/25, 2,5, 0,52 → не равно | `num.fractions` | 1,2 |
| `root` | Корень уравнения {eq}? | корень · не корень | для x² − 5x + 6 = 0: 2, 3 → корень; −2, −3, 6, 1 → не корень | `eq.quadratic` (A: линейное — `eq.linear`) | 1,4 |
| `ineq` | Решение неравенства {ineq}? | решение · не решение | для 2x − 3 > 5: 5; 4,5 → решение; **4** (граница) и 3 → не решение | `eq.ineq` | 1,4 |
| `prob` | Может ли это быть вероятностью? | может · не может | 0,3; 1; 0; 45 % → может; 7/5; −0,2; 120 % → не может | `lit.prob` | 1,0 |

Правило `equal` повторяет ловушку демоверсии ЕНТ (№37): одно число записано по-разному, и все записи верны (`docs/ENT_MATH.md`).

**Проценты.** Парсер процентов внутри выражения не нужен: карточку «25 %» генератор пишет так — `text: "25 %"`, `expr: "25/100"`.

**Граничные значения** [новое]. `ineq`: не меньше 15 % карточек — граница, то есть решение уравнения `2x − 3 = 5` (x = 4). При строгом знаке она «не решение», при нестрогом — «решение». `root`: не меньше 15 % карточек — корни с обратным знаком (−2, −3 для `x² − 5x + 6 = 0`).

**`rational`: класс задаёт шаблон, а не float.** `evalExact` точно считает только рациональные значения (`docs/ARCHITECTURE.md`, 6.5): `√2·√8` и `(√3)²` он вернёт как приближённые. Поэтому карточка `rational` строится из шаблона с известным классом. `gen` кладёт вид шаблона и числа в `card.tmpl`, `classify` берёт корзину оттуда.

| Уровень | Шаблоны → корзина |
|---|---|
| A | целое, дробь, десятичная (−3, 2/5, 0,7) → рац.; `√(k²)` (√16) → рац.; `√n`, n не квадрат (√12) → иррац.; `π` → иррац. |
| B | `√(p²/q²)` (√(9/4)) → рац.; `√a·√b`, где a·b — квадрат, а a и b — нет (√2·√8) → рац.; `√a·√b`, a·b не квадрат (√2·√3) → иррац.; `(√n)²` → рац. |
| C | `a + √b`, b не квадрат (2 + √3) → иррац.; `a + √(k²)` (1 + √9) → рац.; `√a / √b`, где a/b — квадрат (√18 / √2) → рац.; `kπ` → иррац. |

**Уровни внутри правила** — `gen(rand, level)`:
- A — простые числа и одно действие;
- B — степени и дроби;
- C — составные выражения и ловушки.

Конкретные диапазоны задаются в коде правила. В тесте проверяется баланс корзин:
- 2 корзины — каждая получает ≥ 25 % из 200 карточек;
- 3 корзины — каждая ≥ 15 %;
- корзина «= 0» / «= 1» — ≥ 15 %.

**Смена правила** [образец]:
- Первое правило — самое лёгкое (наименьший `weight`) из доступных.
- Дальше выбор взвешенный: вес навыка × «не повторять прошлое правило».
- Если доступно одно правило, «новое правило» — то же правило с новыми параметрами: другой X, другое уравнение.
- Правило меняется только **между** карточками.
- Баннер «Новое правило: …» показывается с паузой часов.

### 11.2 Ход и падение

- **Время падения:** `D = fallStart × (1 + (weight − 1) × weightScale)`.
  - После каждых `speedUpEvery` верных: `D × fallFactor`, но не меньше `fallMin`.
  - После ошибки: `D = min(старт, D / fallFactor)`.
- **Ошибка или «карточка упала»:**
  - корзина вспыхивает красным + встряска;
  - верная корзина получает зелёный контур;
  - под полем строка `explain`;
  - карточка возвращается один раз через 3 карточки при том же правиле, во всех темпах [образец].
- **Уровень** карточек — раздел 5 (`tierEvery`, `maxTier`).
- **Ввод:**
  - тап по корзине;
  - свайп карточки (pointer events, порог ±40 px; средняя корзина — свайп вниз);
  - клавиши ←/→/↓ или 1–3.
- **В первом раунде** подсказка: «Смахни карточку к корзине или нажми на корзину».
- **«Меньше анимаций»:** карточка не падает, под ней убывает полоса.

### 11.3 Темпы — `MODE_CONFIG`

```ts
export interface ModeConfig {
  roundSeconds: number;      // общие часы, с; 0 — нет (конец по числу правил)
  wallCapSeconds: number;    // предел реального времени, с; 0 — нет
  rulesPerGame: number;      // правил за игру; 0 — сколько успеешь за часы
  cardsPerRule: number;      // карточек на одно правило
  falls: boolean;            // карточка падает; false — стоит и ждёт ответа
  fallStart: number;         // время падения в начале, с
  fallMin: number;           // минимальное время падения, с
  fallFactor: number;        // множитель ускорения: D × fallFactor
  speedUpEvery: number;      // ускорять после каждых N верных
  weightScale: number;       // влияние weight правила: D × (1 + (weight − 1) × weightScale)
  tierEvery: number;         // каждый N-й верный — уровень +1 (раздел 5)
  maxTier: Level;            // потолок уровня
  bannerMs: number | null;   // баннер нового правила, мс; null — до «Понятно»
  explainMs: number | null;  // разбор ошибки, мс; null — до «Дальше»
  pausable: boolean;         // есть кнопка «Пауза»
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  // Спокойно: без таймеров, 4 правила по 4 карточки = 16, после ошибки ждём «Дальше».
  calm:   { roundSeconds: 0,  wallCapSeconds: 0,   rulesPerGame: 4, cardsPerRule: 4, falls: false, fallStart: 0,  fallMin: 0, fallFactor: 1,    speedUpEvery: 1, weightScale: 0,    tierEvery: 8, maxTier: 2, bannerMs: null, explainMs: null, pausable: false },
  // Обычный: без общих часов, 4 правила по 6 карточек = 24, падение 10 с × вес правила.
  normal: { roundSeconds: 0,  wallCapSeconds: 0,   rulesPerGame: 4, cardsPerRule: 6, falls: true,  fallStart: 10, fallMin: 6, fallFactor: 0.95, speedUpEvery: 4, weightScale: 1,    tierEvery: 8, maxTier: 2, bannerMs: 2500, explainMs: 3000, pausable: true },
  // Блиц: 75 с, правило каждые 8 карточек, падение 6 → 3 с, трудные правила дольше (×0,75 веса).
  blitz:  { roundSeconds: 75, wallCapSeconds: 110, rulesPerGame: 0, cardsPerRule: 8, falls: true,  fallStart: 6,  fallMin: 3, fallFactor: 0.92, speedUpEvery: 4, weightScale: 0.75, tierEvery: 6, maxTier: 3, bannerMs: 1200, explainMs: 2000, pausable: false },
};
```

**Образец для сравнения:**

| Темп | Правил × карточек | Падение | Ускорение | Прочее |
|---|---|---|---|---|
| «Спокойно» | 5 × 4 | — | — | — |
| «Обычный» | 5 × 8 | 8 → 4,5 с | ×0,95 | — |
| «Блиц» | — | 5 → 2,2 с | ×0,92 | раунд 75 с, предел 110 с |

В Matematika карточки нужно **посчитать** (√2·√8), а не просто прочитать. Поэтому падение медленнее, а карточек меньше. [проверить]

### 11.4 Очки [образец]

- Верно: `(10 + round(5 × (1 − доля падения))) × множитель`. В «Спокойно» доля падения = 0.
- Множитель по серии: 0–3 → ×1; 4–7 → ×2; 8–11 → ×3; 12+ → ×4.
- Ошибка и «упала» — 0.

### 11.5 Экран

```
┌──────────────────────────────────────┐
│ 140     ×2   Правило 2/4   51 с [Пи] │
│ ██████████████████░░░░░░░░░░░░░░░░░ │
│ Правило: Рациональное или           │ плашка правила всегда под часами, text-sm font-bold
│          иррациональное?            │
│                                      │
│          ┌────────────────┐          │ карточка min-w-[168px] max-w-[300px] h-20 rounded-2xl
│          │    √2 · √8     │  ↓       │ text-3xl (KaTeX/Unicode), нейтральный цвет до ответа
│          └────────────────┘          │
│                                      │
│ ┌────────────────┐ ┌────────────────┐│ корзины h-24 (≥ 96 px), подпись text-base font-extrabold,
│ │  Рациональное  │ │ Иррациональное ││ стрелка-подсказка в углу (← / →)
│ └────────────────┘ └────────────────┘│
└──────────────────────────────────────┘
Разбор: «√2 · √8 = √16 = 4 → рациональное» (text-sm) над корзинами; в «Спокойно» кнопка «Дальше».
```

**Три корзины** (`sign`, `compare1`) — в один ряд, как в образце: сетка из 3 колонок, `gap-2`, высота `h-24`. Средняя корзина — свайп вниз и клавиша ↓.

```
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ на 360 px корзина ≈ 104 px; подпись text-sm font-extrabold,
│ │  Меньше  │ │   Ноль   │ │  Больше  │ │ до 2 строк, без обрезки
│ │  нуля  ← │ │    ↓     │ │  нуля  → │ │ стрелки-подсказки ← / ↓ / →
│ └──────────┘ └──────────┘ └──────────┘ │ карточка падает над средней корзиной
```

### 11.6 Тексты `src/games/math-sort/strings.ts`

Формулы и параметры подставляются кодом. Падежный суффикс kk клеим к «сан» / «теңдеу» / «теңсіздік».

| Ключ | ru | kk |
|---|---|---|
| `rule` | Правило: {title} | Ереже: {title} (образец) |
| `newRule` | Новое правило | Жаңа ереже (образец) |
| `ruleNum` | Правило {i}/{n} | Ереже {i}/{n} (образец) |
| `signTitle` | Какой знак у значения? | Мәнінің таңбасы қандай? |
| `binNeg` / `binZero` / `binPos` | Меньше нуля / Ноль / Больше нуля | Нөлден кіші / Нөл / Нөлден үлкен |
| `cmpTitle` | Сравни с единицей | Бірмен салыстыр |
| `binLt1` / `binEq1` / `binGt1` | Меньше 1 / Равно 1 / Больше 1 | Бірден кіші / Бірге тең / Бірден үлкен |
| `ratTitle` | Рациональное или иррациональное? | Рационал ма, иррационал ма? |
| `binRat` / `binIrr` | Рациональное / Иррациональное | Рационал сан / Иррационал сан |
| `eqTitle` | Равно {x}? | {x} санына тең бе? |
| `binEq` / `binNeq` | Равно / Не равно | Тең / Тең емес |
| `rootTitle` | Корень уравнения {eq}? | {eq} теңдеуінің түбірі ме? |
| `binRoot` / `binNotRoot` | Корень / Не корень | Түбір / Түбір емес |
| `ineqTitle` | Решение неравенства {ineq}? | {ineq} теңсіздігінің шешімі ме? |
| `binSol` / `binNotSol` | Решение / Не решение | Шешімі / Шешімі емес |
| `probTitle` | Может ли это быть вероятностью? | Бұл ықтималдық бола ала ма? |
| `binCan` / `binCannot` | Может / Не может | Бола алады / Бола алмайды (образец) |
| `exValue` | {card} = {v} → {bin} | {card} = {v} → {bin} |
| `exIrr` | √{n}: {n} — не квадрат рационального числа → иррациональное | √{n}: {n} — рационал санның квадраты емес → иррационал сан |
| `exSubst` | Подставим {x}: {calc} = {v} → {bin} | {x} мәнін қойсақ: {calc} = {v} → {bin} |
| `exProb` | Вероятность — от 0 до 1 (от 0 до 100 %), а здесь {v} | Ықтималдық 0-ден 1-ге дейін (0-ден 100 %-ға дейін), ал мұнда {v} |
| `cardTimeout` | Карточка упала — время вышло | Карточка түсіп кетті — уақыт бітті (образец) |
| `swipeHint` | Смахни карточку к корзине или нажми на корзину | Карточканы себетке қарай сырғыт немесе себетті бас (образец) |
| `calmHint` | Не торопись. Смахни карточку к корзине или нажми на корзину | Асықпа. Карточканы себетке қарай сырғыт немесе себетті бас (образец) |
| `rightBin` | Правильная корзина: {bin} | Дұрыс себет: {bin} (образец) |
| `correct` / `wrong` / `timeUp` / `done` / `gotIt` | Верно! / Неверно / Время! / Готово! / Понятно | Дұрыс! / Қате / Уақыт бітті! / Дайын! / Түсінікті (образец) |

**`meta`:**
- `title`: «Сортировщик» / «Сұрыптағыш».
- `description`: ru «Раскладывай карточки по корзинам по правилу: знак, рациональное или нет, корень уравнения или нет.» / kk «Карточкаларды ереже бойынша себеттерге сал: таңбасы, рационал ма, теңдеудің түбірі ме.»
- `rules` ru:
  ```
  Отправь карточку в нужную корзину свайпом или кнопкой. Новое правило объявляется заранее.
  Спокойно: карточки не падают, после ошибки — разбор.
  Обычный: карточки падают медленно, на трудных правилах — ещё медленнее.
  Блиц: 75 секунд, карточки падают всё быстрее.
  ```
- `rules` kk:
  ```
  Карточканы сырғытып немесе түймемен керекті себетке жібер. Жаңа ереже алдын ала хабарланады.
  Асықпай: карточкалар түспейді, қатеден кейін — талдау.
  Қалыпты: карточкалар баяу түседі, күрделі ережелерде — одан да баяу.
  Блиц: 75 секунд, карточкалар барған сайын жылдамырақ түседі.
  ```

### 11.7 Тесты `tests/games/math-sort.test.ts`

- [ ] **Независимая проверка `classify`.** Для каждого правила × уровни 1–3 × seed 1..200 корзина совпадает со вторым способом:
  - `sign`, `compare1`, `equal` — float с допуском 1e-9;
  - `rational` — по числам `card.tmpl`: целочисленная проверка на BigInt «подкоренное — точный квадрат» (для `√a·√b` — произведение a·b, для `√a / √b` и `√(p/q)` — числитель и знаменатель после сокращения), `π` и `kπ` — иррациональные по определению. Результат совпадает с корзиной шаблона. Все шаблоны A/B/C из таблицы 11.1 встречаются;
  - `root`, `ineq` — подстановка числа в float;
  - `prob` — `0 ≤ v ≤ 1`.
- [ ] Баланс корзин (11.1). Граничные значения `ineq` и `root` — не меньше 15 % карточек.
- [ ] `expr` каждой карточки разбирается парсером `lib/math`; у процентов `expr` — дробь `/100`.
- [ ] Каждая `text` с `$…$` рендерится `katex.renderToString(…, { throwOnError: true })`.
- [ ] `title`, `bins`, `explain` — ru и kk непустые.
- [ ] Смена правила:
  - каждые `cardsPerRule`;
  - первое — наименьший `weight`;
  - одно правило не два раза подряд (кроме случая с единственным правилом);
  - правило не меняется посреди карточки.
- [ ] Падение: формула `D`, ускорение, откат после ошибки, `fallMin`.
- [ ] Повтор карточки через 3 при том же правиле.
- [ ] Уровень: +1 на каждом `tierEvery`-м верном до `maxTier`, −1 после двух ошибок подряд.
- [ ] Конфиг. В `calm` `falls: false`. В `blitz` 75 с / 110 с.
- [ ] Только правила с открытыми навыками (`gamePool`).

### 11.8 Готово, когда

- [ ] Свайп, тап и клавиши работают. Свайп на 39 px не засчитывается.
- [ ] Баннер правила останавливает часы.
- [ ] «Спокойно» — карточки стоят.
- [ ] Карточка с длинным выражением помещается на 360 px.
- [ ] Разбор после ошибки понятен без ИИ.
- [ ] Тесты зелёные.

---

## 12. ТЗ игры 4: «Найди ошибку» (`bug-hunt`)

**Суть** [образец]. Показано готовое решение из 3–6 строк. В большинстве решений одна строка с ошибкой, иногда ошибок нет. Ученик тапает строку с ошибкой или жмёт «Ошибок нет». Если нашёл — выбирает верное исправление из 2–3 вариантов.
**Тренирует:** самопроверку и ловушки ЕНТ — знак при переносе, потерянный корень, неверная формула, порядок действий, степени, дроби, ОДЗ (уровень C).
**Навыки:** `skillsWithShape(ALL, "trace")` ∩ открытые. Задания — форма банка `trace` (3.7): новая тема появляется в игре, когда её банк умеет `trace`.

### 12.1 Головоломка из `trace`

1. Взять `trace = bankFor(skill).trace(level, seed)`.
2. С вероятностью **80 %** (на C — 75 %) выбрать одну порчу `fault`: строка `fault.line` заменяется на `fault.wrong`. Иначе решение без ошибок. Два решения без ошибок подряд не бывает. В «Спокойно» и «Обычном» первое задание всегда с ошибкой (`firstFault`).
3. **Варианты исправления** — 2–3 уникальных по тексту строки:
   - верная строка;
   - 1–2 **других** порчи той же строки.
   Перемешаны, индекс верного пересчитан.

**Шаблоны волны 1** — живут в файлах банка тем, не в игре:

| Навык | Пример условия | Строки (верно) | Порчи (`type`) |
|---|---|---|---|
| `num.order` | Вычисли 2 + 3 · 4 − 6 : 2 | 2 + 3·4 − 6:2 = 2 + 12 − 3; 2 + 12 − 3 = 11 | `order` («= 5·4 − 3» — сначала сложили); `arith` (±1, ±2) |
| `num.powers` | Упрости 2³ · 2⁴ : 2⁵ | = 2³⁺⁴⁻⁵; = 2²; = 4 | `powMul` (2³·2⁴ = 2¹²); `powDivAdd` (вычитание → сложение); `zeroPower` (a⁰ = 0); `negSquare` (−3² = 9) |
| `num.fractions` | Вычисли 2/3 + 1/4 | = 8/12 + 3/12; = 11/12 | `addFractions` (= 3/7); `numerator` (8/12 + 1/12); `reduce` (неверное сокращение) |
| `eq.linear` | Реши 3x − 7 = 2x + 5 (или 2x + 3 = 11) | 3x − 2x = 5 + 7; x = 12 (или 2x = 8; x = 4) | `sign` (5 − 7 при переносе); `divide` (в шаблоне с шагом `ax = b`: 2x = 8 → x = 6 — вычли вместо деления); `arith` |
| `eq.quadratic` | Реши x² − 5x + 6 = 0 | таблица в 3.7 | `discriminant`; `rootSign`; `lostRoot`; `arith` |
| C, позже | log₂(x + 1) + log₂(x + 2) = 1 (демо НЦТ №16) | … ответ: 0 | `odz` — оставлен посторонний корень −3 |

**Требования к шаблону:**
- Каждая строка проверяема сама по `given` и предыдущим строкам.
- Порча делает ложной **ровно одну** строку и меняет её текст.
- Если текст совпал с верным (как у образца для палиндромов) — сгенерировать заново.
- Длинные kk-строки переносятся, а не обрезаются.

### 12.2 Ход

1. Тап по строке — мгновенно, или «Ошибок нет».
2. **Нашёл верно.** Строка зелёная.
   - Если ошибка была, выезжает шит «Как должно быть?» с 2–3 вариантами (`h-12`, `MathText`). Время на исправление — `fixMs`, часы раунда стоят.
   - Верное исправление: +5 очков. Потом разбор: строка «Должно быть: …» и `fault.explain`.
3. **Промахнулся, ложная тревога или тайм-аут:**
   - настоящая строка красная «Ошибка была здесь»;
   - если тапнута верная строка — на ней «Здесь всё верно»;
   - для решения без ошибок — «Ошибок не было — все строки верны»;
   - одна строка `explain`;
   - шага исправления после промаха нет.
4. **В `attempts`** отдельно действие «найти» и действие «исправить», оба с навыком `trace.skill`.
5. **Повтора нет** ни в одном темпе: после промаха решение уже разобрано, следующее задание — новое [образец].

### 12.3 Темпы — `MODE_CONFIG`

```ts
export interface ModeConfig {
  puzzles: number | null;     // заданий в раунде; null — пока идут часы
  roundMs: number | null;     // общие часы раунда, мс (только blitz)
  wallCapMs: number | null;   // предел реального времени, мс
  fixMs: number | null;       // время на выбор исправления, мс; null — без таймера
  revealMs: number | null;    // разбор сам закрывается через, мс; null — ждём «Далее»
  pause: boolean;             // есть кнопка «Пауза»
  tiers: Level[] | null;      // лесенка уровней по номеру задания; null — адаптивно (раздел 5)
  firstFault: boolean;        // первое задание всегда с ошибкой
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  // 6 заданий без таймеров; после каждого — «Далее».
  calm:   { puzzles: 6,    roundMs: null,   wallCapMs: null,    fixMs: null,   revealMs: null, pause: false, tiers: [1, 1, 2, 2, 3, 3],       firstFault: true },
  // 8 заданий без общих часов; время на поиск — findMs(level, lines).
  normal: { puzzles: 8,    roundMs: null,   wallCapMs: null,    fixMs: 20_000, revealMs: 5000, pause: true,  tiers: [1, 1, 1, 2, 2, 2, 3, 3], firstFault: true },
  // Общие часы 90 с; уровень растёт после каждых 3 верных находок.
  blitz:  { puzzles: null, roundMs: 90_000, wallCapMs: 120_000, fixMs: 10_000, revealMs: 4000, pause: false, tiers: null,                     firstFault: false },
};

/** Время на поиск, мс. «Обычный»: max(30 с, база + 3 с на каждую строку сверх 5); «Блиц»: a + b·строк. */
const NORMAL_FIND_MS = { 1: 40_000, 2: 50_000, 3: 60_000 };
const BLITZ_FIND = { 1: [10_000, 2_500], 2: [8_000, 2_000], 3: [6_000, 1_600] };   // [a, b на строку]
```

**Образец для сравнения:**

| Темп | Поиск | Исправление | Прочее |
|---|---|---|---|
| «Обычный» | 35 / 45 / 55 с + 2 с на строку сверх 6, минимум 25 с | 15 с | — |
| «Блиц» | 8 + 2 / 6 + 1,6 / 5 + 1,3 с на строку | 8 с | раунд 90 с |

Строки с формулами читаются дольше, поэтому времени больше. [проверить]

Уровни — раздел 5: в «Спокойно» и «Обычном» уровень задания = `min(уровень по лесенке, адаптивный уровень)`, ошибки подряд опускают потолок; в «Блице» — адаптивно с A [образец].

### 12.4 Очки [образец]

- Нашёл: `(10 + min(10, floor(бонус))) × множитель`. Бонус:
  - «Блиц» — секунд осталось;
  - «Обычный» — доля оставшегося времени × 10;
  - «Спокойно» — 5.
- Множитель по серии находок: 0–2 → ×1; 3–5 → ×2; 6+ → ×3.
- Исправил: +5.
- Промах: 0, серия обнуляется.

### 12.5 Экран

```
┌──────────────────────────────────────┐
│ 60   Задание 3 из 8   Серия 2  38 с  │
│ ████████████████████████░░░░░░░░░░░ │
│ Найди строку с ошибкой               │ text-lg font-bold
│ Реши уравнение 3x − 7 = 2x + 5       │ header, MathText
│ ┌──┬───────────────────────────────┐ │ строки — кнопки min-h-12, номер в поле 24 px,
│ │1 │ 3x − 2x = 5 − 7               │ │ MathText text-[17px], overflow-x-auto
│ ├──┼───────────────────────────────┤ │
│ │2 │ x = −2                        │ │
│ └──┴───────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │           Ошибок нет             │ │ h-14 внизу
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
Шит «Как должно быть?»: 2–3 варианта h-12, своя полоса времени (Обычный / Блиц).
```

- 6 строк по 56 px помещаются на 390 × 844 вместе с шапкой и кнопкой.
- **Клавиши:**
  - 1–6 — строка;
  - 0 или N — «Ошибок нет»;
  - в шите 1–3 — вариант.

### 12.6 Тексты `src/games/bug-hunt/strings.ts`

Интерфейс взят из образца. Условия, строки и объяснения порч строит банк (`trace`), в `strings.ts` их нет.

| Ключ | ru | kk |
|---|---|---|
| `findPrompt` | Найди строку с ошибкой | Қате жолды тап (образец) |
| `noError` | Ошибок нет | Қате жоқ (образец) |
| `fixPrompt` | Как должно быть? | Дұрысы қалай? (образец) |
| `found` | Ошибка найдена! | Қате табылды! (образец) |
| `fixed` | Исправлено | Түзетілді (образец) |
| `missedHere` | Ошибка была здесь | Қате осы жерде еді (образец) |
| `falseAlarm` | Здесь всё верно | Мұнда бәрі дұрыс (образец) |
| `noneWas` | Ошибок не было — все строки верны | Қате болған жоқ — барлық жолдар дұрыс (образец) |
| `puzzleTimeUp` | Время на задание вышло | Тапсырма уақыты бітті (образец) |
| `shouldBe` | Должно быть: | Дұрысы: (образец) |
| `taskOf` | Задание {i} из {n} | Тапсырма {i} / {n} (образец) |
| `streak` | Серия | Серия (образец) |
| `lineAria` | Строка {i}: {text} | {i}-жол: {text} (образец) |
| `fixAria` | Вариант {i}: {text} | {i}-нұсқа: {text} (образец) |
| `timeUp` / `done` | Время! / Готово! | Уақыт бітті! / Дайын! (образец) |

**Примеры `fault.explain`** (пишутся в банке):

| type | ru | kk (черновик) |
|---|---|---|
| `sign` | При переносе в другую часть уравнения слагаемое меняет знак | Қосылғышты теңдеудің екінші жағына көшіргенде, оның таңбасы өзгереді |
| `powMul` | При умножении степеней с одинаковым основанием показатели складывают: aᵐ · aⁿ = aᵐ⁺ⁿ | Негіздері бірдей дәрежелерді көбейткенде, көрсеткіштері қосылады: aᵐ · aⁿ = aᵐ⁺ⁿ |
| `addFractions` | Дроби складывают через общий знаменатель, а не «числитель с числителем, знаменатель со знаменателем» | Бөлшектерді ортақ бөлімге келтіріп қосады, алымды алымға, бөлімді бөлімге қоспайды |
| `order` | Сначала умножение и деление, потом сложение и вычитание | Алдымен көбейту мен бөлу, содан кейін қосу мен азайту |
| `discriminant` | Дискриминант D = b² − 4ac, а не b² + 4ac | Дискриминант D = b² − 4ac, b² + 4ac емес |
| `lostRoot` | У уравнения x² = 9 два корня: 3 и −3 | x² = 9 теңдеуінің екі түбірі бар: 3 және −3 |
| `negSquare` | −3² = −9: в квадрат возводится только 3, минус остаётся | −3² = −9: квадратқа тек 3 шығарылады, минус сақталады |

**`meta`:**
- `title`: «Найди ошибку» / «Қатені тап».
- `description`: ru «Найди строку с ошибкой в готовом решении и исправь её — тренировка ловушек ЕНТ.» / kk «Дайын шешімдегі қате жолды тауып, оны түзет — ҰБТ-дағы тұзақтарға дайындық.» (образец)
- `rules` ru (образец):
  ```
  Нажми на строку решения, где допущена ошибка, или «Ошибок нет». Затем выбери верное исправление.
  Спокойно: 6 задач без таймера, после ошибки — разбор.
  Обычный: 8 задач, на каждую — своё время.
  Блиц: 90 секунд, за быстрый ответ бонус.
  ```
- `rules` kk (образец):
  ```
  Шешімдегі қате кеткен жолды бас немесе «Қате жоқ» түймесін бас. Сосын дұрыс түзетуді таңда.
  Асықпай: таймерсіз 6 есеп, қатеден кейін — талдау.
  Қалыпты: 8 есеп, әрқайсысына өз уақыты беріледі.
  Блиц: 90 секунд, жылдам жауапқа бонус.
  ```

### 12.7 Тесты

**`tests/bank/trace.test.ts`** — по всем навыкам с `trace`, уровни 1–3, seed 1..200:
- [ ] все верные строки истинны по независимой проверке (3.7);
- [ ] каждая порча делает ложной ровно свою строку и меняет её текст;
- [ ] у каждой строки-цели ≥ 2 разных порчи;
- [ ] каждый `text` с `$…$` рендерится KaTeX без ошибки;
- [ ] `header` и `explain` — ru и kk;
- [ ] детерминизм.

**`tests/games/bug-hunt.test.ts`:**
- [ ] доля решений без ошибок 20 % ± 5 % (на C 25 % ± 5 %) на 1000 заданий;
- [ ] двух решений без ошибок подряд нет;
- [ ] `firstFault`: первое задание с ошибкой;
- [ ] варианты исправления: 2–3, уникальны, верный ровно один, индекс верный после перемешивания;
- [ ] время поиска по формулам 12.3 и минимум 30 с;
- [ ] очки, множитель, бонус +5;
- [ ] `attempts` содержит «найти» и «исправить» отдельно;
- [ ] уровни по разделу 5: в `calm` и `normal` — лесенка с потолком `min(лесенка, адаптивный)`, в `blitz` — адаптивно.

### 12.8 Готово, когда

- [ ] Решение из 6 строк с формулами помещается на 390 px, длинная строка прокручивается внутри себя.
- [ ] Двойной тап по строке не открывает шит дважды.
- [ ] Шит исправления останавливает часы раунда.
- [ ] После промаха видно, где была ошибка и почему.
- [ ] Минимум 3 темы дают задания (`num.order`, `num.powers` или `num.fractions`, `eq.linear`).
- [ ] Тесты зелёные.

---

## 13. Бэклог: 8 игр на банке

Все 8 игр — из плана образца (владелец Informatica выбрал все идеи). Наполнение — математическое. **Ниже — только идеи, не ТЗ.** Игру из этого раздела нельзя делать, пока прораб не написал `docs/tasks/game-<id>.md` по шаблону ниже (промпт — `docs/PROMPTS.md`, Т-4а).

**Шаблон ТЗ игры (10 пунктов)** — по образцу разделов 9–12:
1. **Суть** и что тренирует.
2. **Источник заданий:** форма банка, фильтр, что делать с неподходящим заданием.
3. **Ход раунда** по шагам: верно / неверно / время вышло / конец.
4. **`ModeConfig`** с комментарием к каждому полю (раздел 5) и `MODE_CONFIG` трёх темпов; строка для таблицы уровней раздела 5; повтор ошибок — есть или нет, когда, в каких темпах.
5. **Очки и `GameResult`:** из чего `score`; что считается одним действием в `attempts` и с каким навыком.
6. **Экран** 390 px (схема) и клавиши.
7. **Строки** ru/kk целиком (`strings.ts`) и `meta`.
8. **Тесты** `logic.ts`.
9. **«Готово, когда».**
10. **Можно менять / нельзя** (14.4).

ТЗ готово, когда исполнитель может сделать игру, не задав ни одного вопроса.

Общее для всех:
- три темпа;
- награды по разделу 6;
- без ИИ;
- задания из банка через `draw` / `gamePool`;
- ответы вычисляет код.

### 13.1 «Башня» (`tower`) — волна 1б

- **Суть.** 10 этажей, уровни растут: этажи 1–4 — A, 5–7 — B, 8–10 — C (`rampLevel`). На 5-м и 10-м этаже «несгораемые» площадки. Формат ЕНТ «один ответ из 4» — приучает к экзамену.
- **Задания.** `question` → только `choice` с 4 вариантами (ЕНТ-формат); остальные перебрасываются.
- **Подсказки** — по одной на игру каждого вида, не обходят уровень «Помощников» (правило 14):
  - «50/50» — убирает 2 неверных;
  - «Формула» — карточка из справочника `src/content/formulas.ts` по теме навыка. [новое: в образце была «подсказка Бита»; в математике бесплатная замена — формула, ИИ в играх нет]
  - «Калькулятор» из плана образца не берём: в «Спокойно» и «Обычном» он и так есть в «Помощниках», в «Блице» инструментов нет. [новое]
- **Какие подсказки в каком темпе:** «Спокойно» — «50/50» и «Формула»; «Обычный» — только «50/50» (справочника формул на ЕНТ нет, `docs/ENT_MATH.md`, 0.2); «Блиц» — никаких.
- **Темпы:**
  - «Спокойно» — ошибка не роняет: разбор и новый вопрос того же этажа;
  - «Обычный» — без таймера (как в плане образца); ошибка роняет до последней площадки, игра окончена;
  - «Блиц» — 30 с на этаж, подсказок нет.
- **Очки.** Этаж k даёт 10·k. Итог — сумма до последнего пройденного этажа или до площадки при падении. Неиспользованная подсказка — +5 (только из тех, что доступны в темпе).
- **`GameResult`:** `score` — итог выше; действие в `attempts` — каждый ответ на вопрос этажа, навык вопроса.
- **Готово, когда:** площадки работают; подсказки по одному разу; на ЕНТ-формате всегда 4 варианта.

### 13.2 «Верю — не верю» (`true-false`) — волна 1б

- **Суть.** Утверждение на карточке: свайп вправо — верно, влево — неверно. Ловит заблуждения.
- **Задания.** `statement`. Истинность считает код, баланс верных и неверных — тест банка (`docs/ARCHITECTURE.md`, 9.3).
- **Примеры:**
  - «2⁻³ = −8» — неверно;
  - «√(a²) = a при любом a» — неверно;
  - «−2,5 = −5/2» — верно;
  - «sin 30° = 0,5» — верно;
  - «если D < 0, у квадратного уравнения нет корней» — верно.
- **Механика.** После ответа короткое «почему» (`explanation`) на 2–3 с или до тапа. Серия даёт множитель.
- **Темпы:**
  - «Спокойно» — 12 карточек без таймера;
  - «Обычный» — 15 карточек, 12 / 15 / 18 с по уровню;
  - «Блиц» — 60 с, ошибка −3 с.
- **Ввод.** Свайп ±60 px, кнопки «Не верю» / «Верю» (danger / success outline), клавиши ← / →.
- **`GameResult`:** `score` — за верную карточку 10 × множитель серии (множитель как в Пи-спринте, 9.4) [проверить]; действие — каждая карточка, навык утверждения.

### 13.3 «Мемо-пары» (`memo`) — волна 1б

- **Суть.** Карточки рубашкой вверх. Открываешь две; если это пара — они остаются открытыми.
- **Задания.** `pair`. Виды пар:
  - выражение ↔ значение: 2⁻² ↔ 0,25;
  - формула ↔ название: S = πR² ↔ площадь круга;
  - функция ↔ мини-график: SVG по `lib/math/graph.ts`;
  - термин ru ↔ kk: из глоссария `docs/ENT_MATH.md`, раздел 4 — данные `src/content/terms.ts`, файл [новое].
- **Важно.** Пары уникальны **по значению**: на поле не бывает двух карточек с равными значениями из разных пар.
- **Темпы:**
  - «Спокойно» — 6 пар, в начале все открыты 3 с, без таймера;
  - «Обычный» — 6 пар (B, C — 8), 90 с;
  - «Блиц» — 8 пар, 60 с, без показа в начале.
- **Очки.** За пару 10. Бонус = `max(0, 2·пар − ходы) × 5` — меньше ходов, больше очков.
- **`GameResult`:** `score` — пары + бонус. Обычный промах — угадывание, в `attempts` не идёт. Действие с навыком пары:
  - верное — найдена пара;
  - неверное — открыта вторая карточка не из пары, хотя нужная карточка уже была открыта раньше (ученик мог её помнить).

### 13.4 «Бинго» (`bingo`) — волна 1б

- **Суть.** Карточка 4 × 4 из 16 разных ответов, вопросы приходят по одному. Нашёл ответ на карточке — тап. Собрал линию (строку, столбец, диагональ) — «Бинго!».
- **Задания.** `short`, `mode: "number"`. 16 ответов уникальны по значению, на экране — `formatValue`. Ответ каждого вопроса есть на карточке.
- **Темпы:**
  - «Спокойно» — без таймера, после ошибки разбор;
  - «Обычный» — 20 / 25 / 30 с на вопрос;
  - «Блиц» — 90 с на всё.
- **Ход.** Ровно 16 вопросов — по одному на каждую клетку, в случайном порядке. Неверный тап: клетка не закрывается, вопрос не повторяется. Конец — после 16-го вопроса (в «Блице» — раньше, если вышли часы).
- **Очки.** Верно — 10, линия — +30.
- **`GameResult`:** `score` — сумма выше; действие — каждый вопрос, навык вопроса.

### 13.5 «Шифровка» (`cipher`) — волна 2

- **Суть.** Скрыта фраза. Каждый верный ответ открывает слово, или букву для коротких фраз. Фразу можно «разгадать» раньше: выбрать из 4 вариантов, без набора текста — тогда бонус.
- **Задания.** `short` или `question` (`choice`).
- **Фразы** — данные `src/games/cipher/phrases.ts` (`{ ru, kk }`): факты о математике и ЕНТ, пословицы. **Цитаты не выдумывать.** Каждая фраза — проверенный факт или народная пословица, в kk — своя пословица, а не перевод. [проверить с владельцем]
- **Темпы:**
  - «Спокойно» — без таймера;
  - «Обычный» — 20 / 25 / 30 с на вопрос;
  - «Блиц» — 90 с.
- **Очки.** Верно — 10. Ранняя разгадка — +5 за каждое закрытое слово. Неверная разгадка — −10, но не ниже 0, и разгадывать можно снова через 3 вопроса.
- **`GameResult`:** `score` — сумма выше; действие — каждый ответ на вопрос, навык вопроса. Разгадка фразы — не действие (это не математика).

### 13.6 «Ставка» (`bet`) — волна 2

- **Суть.** Перед ответом ставишь 1, 2 или 3 очка уверенности. В конце — «карта уверенности»: при какой ставке какой процент верных. Учит отличать «знаю» от «угадываю». Это важно для частичных баллов ЕНТ: лишний неверный вариант стоит балла, второй обнуляет задание (`docs/ENT_MATH.md`, раздел 0).
- **Задания.** `question` → `choice`.
- **Очки.** Верно — `+10 × ставка`, неверно — `−5 × ставка`. Счёт не ниже 0.
- **`GameResult`:** `score` — счёт выше; действие — каждый ответ, навык вопроса.
- **Темпы:**
  - «Спокойно» — 10 вопросов без таймера;
  - «Обычный» — 10 вопросов, 25 / 35 / 45 с;
  - «Блиц» — 60 с.
- **Итог игры.** Мини-диаграмма из 3 столбцов: ставка 1 / 2 / 3 → % верных. Цвета `success` / `warning` / `danger` по проценту. Рисуется внутри игры до `onFinish`, затем «Дальше».

### 13.7 «Собери решение» (`build-solution`) — волна 2

- **Суть.** Строки решения перемешаны. Среди них 1–2 ловушки — порченые строки. Нужно расставить верные строки по порядку, а ловушки оставить в стороне. Тренирует понимание «как решать».
- **Задания.** `trace` (3.7): верные строки + 1–2 `fault.wrong` из разных строк.
- **Ввод.** Тап по строке добавляет её в решение снизу, тап по строке в решении возвращает её обратно. Перетаскивания нет: на телефоне оно ненадёжно.
- **Проверка.** Порядок совпадает с `lines` и нет ловушек. Частичный результат — доля верных позиций (для очков), но действие засчитывается верным только при полном совпадении.
- **Темпы:**
  - «Спокойно» — 5 решений без таймера;
  - «Обычный» — 6 решений, 40 / 55 / 70 с;
  - «Блиц» — 120 с на всё.
- **Очки.** 10 за решение + 5 за каждую ловушку, которую не взяли.
- **`GameResult`:** `score` — сумма выше; действие — одно на решение, навык `trace.skill`, верное только при полном совпадении.

### 13.8 «Босс-битва» (`boss`) — волна 2

- **Суть.** Пошаговый бой с «боссом», собранным из **слабых тем** ученика. Это персональная работа над слабым.
- **Задания.** `question` по 3 самым слабым открытым навыкам (`weakSkills`). Если слабых нет — все открытые.
- **Механика.**
  - У босса 100 HP. Верный ответ бьёт на 10 / 15 / 20 (A / B / C).
  - Ошибка: у ученика −1 сердце из 3.
  - Конец — победа или 0 сердец.
  - После боя отчёт «Что подтянуть»: навыки и % верных, кнопка «Тренировать» → `/drill?mode=skill&skill=ID`. ИИ не нужен.
- **Внешний вид.** Босс — SVG-персонаж в стиле маскота (`docs/DESIGN.md`, раздел 10), не эмодзи. Полоса HP босса — `danger`, сердца ученика — `streak`.
- **Еженедельный большой босс.** Отдельная запись реестра `boss-weekly`: 20 вопросов, seed = номер ISO-недели. Рекорд по ключу игры, как у остальных. [новое]
- **Темпы:**
  - «Спокойно» — сердца не тратятся;
  - «Обычный» — 25 / 35 / 45 с на вопрос;
  - «Блиц» — 90 с на бой.
- **`GameResult`:** `score` — нанесённый урон + 20 за каждое оставшееся сердце при победе [новое] [проверить]; действие — каждый ответ, навык вопроса.

### 13.9 Позже (не входят в 8)

| Игра | Суть | Когда |
|---|---|---|
| «Объясни Пи» | ученик объясняет тему своими словами без запрещённых слов, ИИ оценивает (метод Фейнмана). **Единственная игра с ИИ** — свой маршрут, лимиты, промпт (`docs/AI.md`) | этап «ИИ 2.0» |
| «Детектив» | история как контекстные задания ЕНТ, улики из разных тем; форма банка `context` | этап «пробный ЕНТ» |
| «Эхо-ошибки» | интервальное повторение своих ошибок (`mistakes` + давно не встречавшиеся навыки; 1 / 3 / 7 дней) на движке Пи-спринта. В образце названа «самой полезной механикой для запоминания» | когда тем ≥ 3 |
| «Дуэль с тенью» | гонка с «призраком» своего лучшего забега на 10 одинаковых вопросах (общий seed) | бэклог |
| «Мемо-пары» рус ↔ каз | режим «Мемо-пар» на глоссарии | вместе с 13.3 |

---

## 14. Порядок работ и как поручать Codex

Роли и модели Codex — `AGENTS.md`, раздел «Модели Codex»; подробно — `docs/WORKFLOW.md`, 5.3–5.5:
- **прораб** — сильная модель в своём чате: план, ТЗ, общие файлы, ревью;
- **исполнитель** — модель подешевле в новом чате, работает по готовому ТЗ.

Прораб и исполнитель — это не люди, а чаты Codex. Владелец сам код не пишет: открывает новый чат, выбирает модель, вставляет готовый промпт из `docs/PROMPTS.md` и смотрит результат.

### 14.1 Когда начинать — чек-лист

- [ ] В `docs/ROADMAP.md` закрыты этапы 1 (особенно 1.5 «ядро», 1.7 «банк», 1.9 «Помощники») и 3; этап 4 дал 2–3 темы раздела 1.
- [ ] Не меньше 3 навыков с формами `question` и `short`.
- [ ] Не меньше 2 навыков с формой `statement`.
- [ ] Есть банки трёх навыков для «Найди ошибку»: `num.order`, `num.powers` или `num.fractions`, `eq.linear`. Формы `trace` до этапа 6 ещё нет: тип делает прораб на шаге 1, шаблоны — исполнитель `bug-hunt` на шаге 3 (14.2).
- [ ] Готовы `lib/math` (проверка), `MathText`, `MathKeypad`, «Помощники».

### 14.2 Шаги

| # | Кто | Что | Результат | Промпт (`docs/PROMPTS.md`) |
|---|---|---|---|---|
| 1 | прораб | **Фундамент:** `games/types.ts`, `lib/games.ts` (из reference), `lib/game-pool.ts` + тест, форма `trace` в `bank/types.ts` + `tests/helpers/trace.ts`, `GameShell`, `registry.ts` (пустой), `components.ts`, `game/[id]/page.tsx`, плитки на `/practice`, ключи `game.*` / `games.*` в `dict.ts`, `ignoreKey` с `data-keypad`, e2e-каркас; дополнения этого файла — в ARCHITECTURE и DECISIONS | `npm test` зелёный, пустой реестр не ломает `/practice` | П-6.1 |
| 2 | прораб | ТЗ на каждую игру: `docs/tasks/game-<id>.md` = раздел этого файла + точные файлы + «не трогать» + строки ru/kk + «готово, когда» | 4 файла ТЗ | П-6.2 |
| 3 | исполнители (параллельно, у каждого свой чат и ветка) | `src/games/<id>/*` + `tests/games/<id>.test.ts` (для `bug-hunt` — ещё шаблоны `trace` в файлах банка тем) | тесты игры зелёные | Т-4б (шаблон — 14.4) |
| 4 | прораб | записи в `registry.ts` (3.2), `components.ts`, id в `e2e/games.spec.ts`, интеграция | все игры видны на `/practice` | П-6.3 |
| 5 | ревью: новый чат, сильная модель, команда `/review` | ревью по списку рисков 14.3 | список багов → исправления | П-6.3 |
| 6 | исполнитель на дешёвой модели (механика) | `npm run review:kk` по строкам игр, скриншоты 360 / 390 px, светлая и тёмная тема, ru и kk | отчёт 5–10 строк | П-6.3 |
| 7 | владелец | играет все 3 темпа каждой игры на телефоне | замечания → правка чисел в `MODE_CONFIG` | — |

### 14.3 Список рисков для ревью

Взят из багов образца, их каждый раз находил независимый ревьюер:
- [ ] двойные тапы и клики: два ответа, «Готово» проскакивает обратную связь, двойной тап пропускает разбор;
- [ ] Enter: автоповтор, двойное срабатывание, Enter из калькулятора или клавиатуры уходит в игру;
- [ ] таймеры: дрейф, нет паузы в скрытой вкладке и на разборе, rAF и таймауты не отменены при размонтировании;
- [ ] `onFinish` вызывается дважды или после ухода со страницы;
- [ ] игра пишет в стор сама;
- [ ] деление на 0, корень из отрицательного, огромные числа — падение вместо `null`;
- [ ] варианты равны по значению (`0,5` и `1/2`);
- [ ] ошибка формата засчитана как «неверно»;
- [ ] формулы вылезают за 360 px; KaTeX с жёстким цветом в тёмной теме;
- [ ] захардкоженные русские строки, kk-строка с падежом на подставленном числе;
- [ ] «Меньше анимаций» не выключает встряску, падение, конфетти.

### 14.4 Шаблон промпта исполнителю

```
Задача: реализовать мини-игру <id> по ТЗ docs/tasks/game-<id>.md.
Прочитай: AGENTS.md; docs/GAMES.md — разделы 1, 2, 3.5–3.6, 5, 6, 7 и раздел своей игры (для bug-hunt ещё 3.7); reference/src/games/types.ts.
Можно менять ТОЛЬКО: src/games/<id>/*, tests/games/<id>.test.ts.
Нельзя: types.ts, registry.ts, components.ts, GameShell, lib/*, dict.ts, store — их правит прораб.
Логика — в logic.ts (чистая, без React), все числа темпа — в MODE_CONFIG. Ответы считает код.
Тексты — только из strings.ts (ru и kk из ТЗ, не выдумывай свои).
Перед сдачей: npx vitest run tests/games/<id>.test.ts && npm run typecheck && npm run lint.
Сдать: что сделано, что не получилось, как проверить руками (5–10 строк).
```

---

## 15. Чек-лист приёмки любой игры

**Код и тесты**
- [ ] Контракт `GameProps` / `GameResult` соблюдён, `onFinish` ровно один раз.
- [ ] `logic.ts` без React, покрыт тестами: конфиг темпов, поток заданий, очки, таймеры, повторы, детерминизм.
- [ ] Ответы вычисляет код и проверяются независимым способом в тестах.
- [ ] Все числа темпа в `MODE_CONFIG`.
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` зелёные.

**e2e (`e2e/games.spec.ts`)** [образец]
- Подложить в `localStorage["matematika-v1"]` состояние `{ state: { onboarded: true, profile: {…, sound: false}, lessons: { "<id первого урока>": {…} } }, version: 1 }`.
- Для каждого `id`: `/practice` → `a[href="/game/<id>"]` → «Играть» → правила скрылись, в `main` есть кнопки → 1,5 с без `pageerror`.
- [новое] На ширине 360 px нет горизонтальной прокрутки: `document.documentElement.scrollWidth <= innerWidth`.

**e2e: полный проход «случайным игроком» (`e2e/games-full.spec.ts`)** [новое; в образце каждую игру при интеграции так проходили в браузере вручную (CHANGELOG образца v0.2.0) — это ловит повторный `onFinish`, зависания и двойное начисление XP]
- [ ] Каждая игра × 3 темпа. Часы ускорены через `page.clock` (таймеры и «Блиц» не ждут реальные минуты). Случайные тапы по кнопкам игрового поля, пока не появится экран итогов; предел — 300 действий, не дошли — тест падает («игра зависла»).
- [ ] Итоги показаны; нет `pageerror`.
- [ ] XP из `localStorage["matematika-v1"]` до и после: прибавка начислена **один раз**, равна «+N XP» на итогах и не выше лимита: 30 в «Обычном» и «Блице» при первой игре (+5 только за побитый прежний рекорд), 15 в «Спокойно».
- [ ] Рекорд записан после «Обычного» и «Блица» и **не** записан после «Спокойно».

**Глазами** (скриншоты делает дешёвая модель, решение — прораб и владелец)
- [ ] 360 и 390 px, светлая и тёмная тема, ru и kk.
- [ ] Все три темпа. В «Спокойно» нет ни одного таймера.
- [ ] Звук и вибрация выключаются настройками. «Меньше анимаций» работает.
- [ ] Ошибка всегда объяснена: верный ответ + почему.

**Документы**
- [ ] `docs/CHANGELOG.md` — что за игра. kk — «вычитано моделью, носителем — нет».
- [ ] `docs/DECISIONS.md` — решения [новое] из этого файла, которые реализованы: `game-pool`, форма `trace`, отличия чисел от образца.
- [ ] `docs/ROADMAP.md` — отметить игру. Этот файл — если механика изменилась.

---

## 16. Не подтверждено — проверить

- **Числа времени и очков** помечены [проверить]. Это стартовые значения, увеличенные против образца: математика думается дольше. Подстроить по игре тестеров, менять только `MODE_CONFIG`.
- **Калькулятор в «Обычном».** Он «как на ЕНТ» и может обесценить устный счёт в Пи-спринте. Если тестеры просто считают на калькуляторе — обсудить с владельцем уровень `off` для отдельных навыков. На ЕНТ калькулятор встроен; простой он или инженерный — официально не описано, мы считаем его простым (`docs/ENT_MATH.md`, раздел 5).
- **Пауза часов при открытых «Помощниках»** в «Обычном». Сейчас часы не останавливаются. Проверить с тестерами.
- **Форма `trace` и `lib/game-pool.ts`** — предложения этого файла. До реализации записать в `docs/DECISIONS.md`.
- **id навыков** — рабочие (3.6). Сверить с `src/content/skills.ts`.
- **Все новые kk-строки** — черновик, прогнать `npm run review:kk`. Носителя-редактора нет. Термины — по `docs/ENT_MATH.md`, раздел 4. Особо проверить: «Таңба қосқыштары», «Сенемін — сенбеймін», «Мемо-жұптар», «Шешімді құрастыр», «Босспен шайқас», «еселі сан».
- **Иконки lucide для бэклога** (`Castle`, `ThumbsUp`, `Layers`, `Grid3x3`, `KeyRound`, `Coins`, `ListOrdered`, `Swords`) — проверить имена в установленной версии `lucide-react`. Иконки волны 1 (`Zap`, `ToggleRight`, `Inbox`, `Bug`) уже используются в образце.
- **Фразы «Шифровки»** — только проверенные факты и пословицы. Список согласовать с владельцем.
