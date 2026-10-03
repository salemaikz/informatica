# Дизайн-система Matematika

Matematika должна выглядеть и ощущаться как Informatica — «образец». Значения в файле взяты из кода образца на 2026-10-03, сам код лежит в `reference/` набора.

Метки:
- **[образец]** — так сделано в Informatica, копируем;
- **[новое]** — добавляем для математики, в образце этого нет;
- **[проверить]** — не подтверждено, нужно проверить.

Как читать (Codex): сначала `rg -n "^#" docs/DESIGN.md`, потом читай только нужный раздел. Эталонные файлы смотри по одному, по ссылке из текста. `reference/` целиком не читай.

Приоритет: `AGENTS.md` > `docs/DECISIONS.md` > этот файл > `reference/`.

**Словарик для владельца** (слово → что это на экране). Остальные слова продукта — `docs/CONCEPT.md`, 13.

| Слово | Что это |
|---|---|
| токен | цвет или размер с именем (`primary`, `success`, `surface`). В коде пишут имя, а не код цвета, поэтому тёмная тема работает сама |
| hex | код цвета вида `#1a91d6` |
| грань кнопки | тёмная полоса 3–4 px под кнопкой: кнопка выглядит объёмной, при нажатии «проседает» |
| Pill | маленькая метка-«таблетка»: «Теория», «ЕНТ», «Освоено» |
| шторка | панель, которая выезжает снизу экрана телефона |
| скелетон | мерцающие серые (у ИИ — фиолетовые) полоски на месте того, что ещё грузится |
| пружина, spring 520/32 | анимация с лёгким отскоком. Первое число — жёсткость (больше — быстрее), второе — затухание (больше — меньше раскачки) |
| safe-area | края экрана iPhone под «чёлкой» и полоской жестов, туда нельзя ставить кнопки |
| blur | размытие того, что просвечивает под полупрозрачной шапкой |
| `pathLength` | линия графика «рисуется» от начала к концу |
| `aria-label` | невидимая подпись для программы чтения с экрана (для незрячих) |
| контраст 3:1, 4,5:1 | во сколько раз текст светлее или темнее фона. Больше — легче читать |
| эскиз | черновой вариант экрана, по которому владелец выбирает дизайн (раздел 7, «Процесс эскизов») |

---

## 0. Двенадцать правил, которые нельзя нарушать

1. **Сначала телефон**: экран делаем под ширину 360–430 px, потом под десктоп.
2. **Цвет несёт смысл** (раздел 2.1). Всё, что делает ИИ, — фиолетовое, и только оно.
3. **Только токены.** В компонентах нет hex-цветов и `dark:`-классов. Исключения перечислены в 2.5.
4. **Новый цвет добавляется в 4 места**: `:root`, `:root[data-theme="dark"]`, блок `@media (prefers-color-scheme: dark)` и `@theme inline`.
5. **Без эмодзи** — ни в интерфейсе, ни в ответах ИИ. Иконки — только `lucide-react`.
6. **Объём как в Duolingo**: рамки 2 px, нижняя «грань» у кнопок (`box-shadow: 0 4px 0`), скругления 12–24 px, при нажатии кнопка сдвигается вниз.
7. **Цели касания**: минимум 40 px, у основных элементов 44–56 px.
8. **Одна главная кнопка на экран**, внизу. После ответа она красится по результату.
9. **Анимация ≤ 400 мс** на отклик, пружинная. Двигаем только `transform`/`opacity`. Уважаем «Меньше анимаций».
10. **Звук и вибрация** вызываются только через `feedback()` (`src/lib/feedback.ts`).
11. **Тексты**: на «ты», коротко, ru + kk, **без глаголов с родом**.
12. **Формулы**: простое пишем Unicode (`x²`, `√2`, `3,5`). Остальное — KaTeX. Десятичная **запятая**.

---

## 1. Принципы

| Принцип | Что значит на практике |
|---|---|
| Дружелюбно, но не по-детски | шрифт Nunito, крупные скругления, маскот «Пи»; без мультяшного шума и без канцелярита |
| Минимализм | одна мысль на экран, подписи вместо абзацев, много воздуха (`gap-5` между блоками) |
| Цвет = смысл | ученик по цвету сразу понимает, что произошло: зелёный — верно, красный — ошибка, фиолетовый — ИИ |
| Живость без спешки | пружины, «+N XP», конфетти, звуки. Таймеры — только там, где ученик сам выбрал скорость |
| Лёгкость | маскот, иллюстрации и сцены — SVG/React, звуки — Web Audio, картинок и аудиофайлов нет. Шрифты самохостинговые, работают офлайн |
| Две темы | светлая и тёмная; тема переключается сама через CSS-переменные |
| Математика честная | числа на схемах и графиках считает код, не рисуем «на глаз» |
| Доступность | фокус виден, у иконок есть `aria-label`, у графиков — текстовое описание, режим «Меньше анимаций» |

---

## 2. Цвет

### 2.1 Семантика (жёсткое правило)

| Токен | Цвет | Когда используем | Когда НЕ используем |
|---|---|---|---|
| `primary` | голубой | основные действия, навигация, активная вкладка, прогресс урока и онбординга, выбранный вариант, «то, что ученик сейчас двигает» на сцене | для «верно» и для ИИ |
| `success` | зелёный | верно, освоено, «Проверить», «Продолжить» после верного ответа, выполненная цель дня | для обычных кнопок навигации |
| `danger` | красный | неверно, слабая тема, деструктивное действие (сброс), «Продолжить» после ошибки | для украшений и заголовков |
| `warning` | янтарный | частично верно («Почти!»), «в процессе», предупреждения, плашка «Работа над ошибками», таймер на исходе | для XP и наград |
| `gold` | золотой | XP, награды, достижения, рекорды, пройденный урок на карте, метка «ЕНТ» | для «верно» (это `success`) |
| `streak` | оранжевый | серия дней, комбо (огонёк) | для всего остального |
| `ai` | фиолетовый | **всё, что делает ИИ**: «Подсказка», «Спроси Пи», «Объясни, ИИ», чат, отзыв после урока, память наставника, проверка фото | для того, что делает код (проверка ответа, генератор, калькулятор, графики) |
| `bg`, `surface`, `surface-2`, `border`, `text`, `muted` | серо-синие | фон, карточки, рамки, текст, подписи | — |

У каждого смыслового цвета есть тройка оттенков:

| Оттенок | Назначение | Пример класса |
|---|---|---|
| `X` | заливка кнопки, иконка, линия | `bg-success`, `text-danger` |
| `X-strong` | нижняя грань кнопки; текст на мягком фоне | `shadow-[0_4px_0_var(--success-strong)]`, `text-success-strong` |
| `X-soft` | бледный фон плашек и выбранных состояний | `bg-success-soft` |

У `gold` и `streak` нет `-strong`. Текст на золотом мягком фоне пишется цветом `text-warning-strong`. Прозрачность задаём так: `border-danger/30`, `bg-ai/15`.

### 2.2 Токены — файл `src/app/globals.css` целиком [образец]

Эталон — `reference/src/app/globals.css`. Скопируй его **без изменений**: ниже тот же текст дословно. Конфига `tailwind.config` нет — это Tailwind v4. Токены попадают в утилиты через `@theme inline`, поэтому `bg-primary`, `text-success-strong`, `border-danger/30`, `animate-pop` работают сразу.

Почему тёмная тема записана дважды: тема «как в системе» — это когда у `<html>` нет атрибута `data-theme`. Тогда работает блок `@media`. Ручной выбор «светлая»/«тёмная» ставит `data-theme="light|dark"`. **Значения в двух тёмных блоках должны совпадать один в один.**

```css
@import "tailwindcss";

/*
  Дизайн-токены. Семантика цветов (правило проекта, см. CLAUDE.md):
  - primary (голубой)  — основные действия и навигация
  - success (зелёный)  — верно / освоено
  - danger  (красный)  — неверно / слабая тема
  - warning (янтарный) — в процессе / предупреждение
  - gold    (золотой)  — XP, награды, достижения
  - streak  (оранжевый)— серия дней
  - ai      (фиолетовый)— всё, что делает ИИ
*/
:root {
  --bg: #f6f7fb;
  --surface: #ffffff;
  --surface-2: #f0f2f7;
  --border: #e3e7ef;
  --text: #1b2333;
  --muted: #6b7487;

  --primary: #1a91d6;
  --primary-strong: #1277b3;
  --primary-soft: #e4f3fc;

  --success: #21b26f;
  --success-strong: #17935a;
  --success-soft: #e3f7ec;

  --danger: #ec4c4c;
  --danger-strong: #c93636;
  --danger-soft: #fdeaea;

  --warning: #f2a516;
  --warning-strong: #c98507;
  --warning-soft: #fff3dc;

  --gold: #f0b400;
  --gold-soft: #fff6d6;
  --streak: #ff7a1a;
  --streak-soft: #ffeedf;

  --ai: #7656f5;
  --ai-strong: #5d3fe0;
  --ai-soft: #efebff;

  color-scheme: light;
}

/* Тёмная тема: ручной выбор (data-theme) или системная настройка. Значения дублируются — держать в синхроне. */
:root[data-theme="dark"] {
  --bg: #0f1420;
  --surface: #171d2b;
  --surface-2: #1f2637;
  --border: #2b3447;
  --text: #e8ecf4;
  --muted: #98a2b8;

  --primary: #3aa9eb;
  --primary-strong: #1e86c4;
  --primary-soft: #142f45;

  --success: #2fc480;
  --success-strong: #1f9c63;
  --success-soft: #133325;

  --danger: #f06262;
  --danger-strong: #c94343;
  --danger-soft: #3a1b1f;

  --warning: #f5b23a;
  --warning-strong: #c98c1c;
  --warning-soft: #382a12;

  --gold: #f5c22e;
  --gold-soft: #352c10;
  --streak: #ff8c3a;
  --streak-soft: #3a2414;

  --ai: #9479ff;
  --ai-strong: #7656f5;
  --ai-soft: #251f45;

  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1420;
    --surface: #171d2b;
    --surface-2: #1f2637;
    --border: #2b3447;
    --text: #e8ecf4;
    --muted: #98a2b8;

    --primary: #3aa9eb;
    --primary-strong: #1e86c4;
    --primary-soft: #142f45;

    --success: #2fc480;
    --success-strong: #1f9c63;
    --success-soft: #133325;

    --danger: #f06262;
    --danger-strong: #c94343;
    --danger-soft: #3a1b1f;

    --warning: #f5b23a;
    --warning-strong: #c98c1c;
    --warning-soft: #382a12;

    --gold: #f5c22e;
    --gold-soft: #352c10;
    --streak: #ff8c3a;
    --streak-soft: #3a2414;

    --ai: #9479ff;
    --ai-strong: #7656f5;
    --ai-soft: #251f45;

    color-scheme: dark;
  }
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--muted);

  --color-primary: var(--primary);
  --color-primary-strong: var(--primary-strong);
  --color-primary-soft: var(--primary-soft);
  --color-success: var(--success);
  --color-success-strong: var(--success-strong);
  --color-success-soft: var(--success-soft);
  --color-danger: var(--danger);
  --color-danger-strong: var(--danger-strong);
  --color-danger-soft: var(--danger-soft);
  --color-warning: var(--warning);
  --color-warning-strong: var(--warning-strong);
  --color-warning-soft: var(--warning-soft);
  --color-gold: var(--gold);
  --color-gold-soft: var(--gold-soft);
  --color-streak: var(--streak);
  --color-streak-soft: var(--streak-soft);
  --color-ai: var(--ai);
  --color-ai-strong: var(--ai-strong);
  --color-ai-soft: var(--ai-soft);

  --font-sans: "Nunito Variable", ui-rounded, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  --animate-pop: pop 0.25s ease-out;
  --animate-shake: shake 0.4s ease-in-out;
  --animate-slide-up: slide-up 0.25s ease-out;
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-pulse-ring: pulse-ring 1.8s ease-out infinite;
  --animate-rise-in: rise-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  --animate-ring-out: ring-out 0.5s ease-out forwards;
}

@keyframes pop {
  0% { transform: scale(0.9); opacity: 0; }
  60% { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); }
  70% { box-shadow: 0 0 0 14px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* Появление снизу с лесенкой (animation-delay задаёт компонент). Через opacity + translate — не конфликтует с transform у motion. */
@keyframes rise-in {
  from { opacity: 0; translate: 0 10px; }
  to { opacity: 1; translate: 0 0; }
}
/* Кольцо-«вспышка» вокруг верного варианта. */
@keyframes ring-out {
  0% { opacity: 0.9; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.09); }
}

html,
body {
  background: var(--bg);
  color: var(--text);
}

body {
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* «Меньше анимаций» в профиле: гасим CSS-анимации так же, как системная настройка (JS-анимации — через MotionConfig). */
:root[data-reduce-motion="true"] *,
:root[data-reduce-motion="true"] *::before,
:root[data-reduce-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

/* Типографика для markdown (теория, конспекты, ответы ИИ) */
.prose-app {
  line-height: 1.6;
}
.prose-app > * + * {
  margin-top: 0.6em;
}
.prose-app h1 {
  font-size: 1.4rem;
  font-weight: 800;
}
.prose-app h2 {
  font-size: 1.15rem;
  font-weight: 800;
  margin-top: 1.1em;
}
.prose-app h3 {
  font-size: 1.02rem;
  font-weight: 800;
  margin-top: 0.9em;
}
.prose-app strong {
  font-weight: 800;
}
.prose-app ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.prose-app ol {
  list-style: decimal;
  padding-left: 1.25rem;
}
.prose-app li + li {
  margin-top: 0.25em;
}
.prose-app code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--surface-2);
  border-radius: 6px;
  padding: 0.1em 0.35em;
}
.prose-app pre {
  background: var(--surface-2);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  overflow-x: auto;
}
.prose-app pre code {
  background: none;
  padding: 0;
}
.prose-app blockquote {
  border-left: 4px solid var(--primary);
  background: var(--primary-soft);
  border-radius: 0 12px 12px 0;
  padding: 0.6rem 0.9rem;
}
.prose-app table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.95em;
}
.prose-app th,
.prose-app td {
  border: 1px solid var(--border);
  padding: 0.35rem 0.6rem;
  text-align: left;
}
.prose-app th {
  background: var(--surface-2);
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}

/* Моргание маскота */
@keyframes blink {
  0%, 93%, 100% { transform: scaleY(1); }
  96% { transform: scaleY(0.1); }
}
.mascot-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 4.5s infinite;
}

/* Маскот: лёгкое «дыхание» тела и покачивание антенны. transform-box — чтобы вращение шло вокруг самого элемента. */
@keyframes mascot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2.5px); }
}
@keyframes mascot-antenna {
  0%, 100% { transform: rotate(0deg); }
  30% { transform: rotate(5deg); }
  70% { transform: rotate(-5deg); }
}
.mascot-body {
  animation: mascot-float 3.8s ease-in-out infinite;
}
.mascot-antenna {
  transform-origin: 60px 27px;
  animation: mascot-antenna 4.6s ease-in-out infinite;
}
```

Мелочь: в комментарии вверху файла слово `CLAUDE.md` замени на `AGENTS.md`. Больше в этом блоке ничего не трогай.

### 2.3 Добавки для математики [новое]

Эти куски дописываются **в конец** `src/app/globals.css`. Блок 2.2 они не меняют.

**(а) Цвета графиков.** Нужны в «Помощниках» → «Графики» и в сценах, где на одной плоскости несколько функций. Смысловые цвета для этого брать нельзя. Поэтому вводим 3 нейтральных «цвета данных». Их нужно добавить во все 4 места, как любой новый цвет:

```css
/* Цвета данных: графики функций, диаграммы. Не несут смысла «верно/неверно». */
:root {
  --plot-1: #1a91d6; /* = primary */
  --plot-2: #d6336c;
  --plot-3: #0b8a7d;
}
:root[data-theme="dark"] {
  --plot-1: #3aa9eb;
  --plot-2: #f06595;
  --plot-3: #2bbfae;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --plot-1: #3aa9eb;
    --plot-2: #f06595;
    --plot-3: #2bbfae;
  }
}
@theme inline {
  --color-plot-1: var(--plot-1);
  --color-plot-2: var(--plot-2);
  --color-plot-3: var(--plot-3);
}
```

Контраст линии к фону карточки посчитан. Светлая тема, к `#ffffff`: 3,46 / 4,62 / 4,25. Тёмная, к `#171d2b`: 6,46 / 5,61 / 7,35. Для линий нужно не меньше 3:1 — это выполняется.

Цвет никогда не бывает единственным отличием графиков:
- у графиков разные типы линии: сплошная, штрих `6 4`, пунктир `2 4`;
- подпись `y₁`, `y₂`, `y₃` стоит прямо у линии.

**(б) KaTeX.** Подключи его стили в `src/app/layout.tsx` рядом со шрифтами: `import "katex/dist/katex.min.css";`. Шрифты KaTeX приходят из пакета, работают офлайн. Затем добавь:

```css
/* Формулы KaTeX: чуть мельче стандартных 1.21em, цвет — от текста (обе темы сами). */
.katex { font-size: 1.1em; }
/* Длинная формула не ломает вёрстку 360 px — прокручивается внутри себя. */
.katex-display { overflow-x: auto; overflow-y: hidden; padding: 0.25rem 0; margin: 0.5em 0; }
.prose-app .katex-display { margin: 0.6em 0; }
```

### 2.4 Где можно сменить фирменный оттенок (primary)

Все цвета, кроме `primary`, менять нельзя: их смысл общий с образцом. Фирменный голубой можно заменить, если владелец захочет «свой» цвет. Условия:
- новый цвет остаётся в семье голубого/синего/бирюзового. Зелёный, красный, янтарный, золотой, оранжевый и фиолетовый уже заняты смыслом;
- белый текст на `--primary` даёт контраст **не меньше 3:1**. У образца `#1a91d6` — 3,46:1, это нижняя граница. Темнее можно, светлее нельзя;
- 3:1 — **осознанное допущение образца**: по WCAG этого хватает только крупному или жирному тексту, обычному нужно 4,5:1. Поэтому белый текст на цветной заливке (кнопки, баннеры, шапки плиток, заголовки разделов) всегда `font-extrabold` или `font-black` и не мельче 14 px. Исключения — короткие метки капсом `text-xs font-extrabold uppercase` («РАЗДЕЛ 1») и цифры в круглых счётчиках. Новый primary и его контраст записываются в `docs/DECISIONS.md`;
- `-strong` темнее основного примерно на 15–20 %, `-soft` — очень бледный (светлая тема) или очень тёмный (тёмная тема), как в 2.2.

Если `primary` меняется, правь **синхронно**:

| Где | Что |
|---|---|
| `src/app/globals.css` | `--primary`, `--primary-strong`, `--primary-soft` во всех трёх блоках; `--plot-1` (= primary) |
| `src/app/manifest.ts` | `theme_color` |
| конфетти на итогах урока | первый цвет `#1a91d6` |
| `src/components/mascot/Mascot.tsx`, `public/icons/icon.svg` | тело `#1a91d6`, «уши» и ножки антенны `#1277b3`, фон иконки `#e4f3fc` |
| цвет раздела 1 курса | `#1a91d6` (2.6) |

### 2.5 Цвета вне токенов — разрешённые исключения [образец]

| Исключение | Значение | Почему можно |
|---|---|---|
| Маскот «Пи» | фиксированные hex (раздел 10) | персонаж одинаков в обеих темах |
| Конфетти на итогах урока | `["#1a91d6", "#21b26f", "#f0b400", "#7656f5"]` | рисуется на canvas, CSS-переменные туда не доходят |
| Конфетти при рекорде в игре | `["#f0b400", "#1a91d6", "#21b26f"]` | то же |
| Цвета разделов курса (`unit.color`) и игр (`meta.color`, `meta.ink`) | задаются в данных, применяются через `style={{ background }}` | это данные, а не тема |
| Цвета освоения навыка (`MASTERY_COLOR`) | `new → var(--border)`, `weak → var(--danger)`, `progress → var(--warning)`, `mastered → var(--success)` | передаются в `ProgressBar color=…` |
| Тёмный текст на золоте (монета, лампочка) | `text-[color-mix(in_srgb,var(--warning-strong)_45%,#000)]` (`ON_GOLD`) | на золоте белый не читается |
| Затемнение под модалкой | `bg-black/40` | одинаково в обеих темах |
| Холст `DrawingCanvas`: файл и картинка для ИИ | чернила `#111`, фон для ИИ `#fff` (7.4.4) | картинка не должна зависеть от темы; на экране чернила — `--text` |

### 2.6 Цвета разделов курса [новое, предложение — владелец может поменять]

Разделы — по `docs/CONCEPT.md`, 6.3. Цвет — фон заголовка раздела и узлов карты, текст на нём белый. Он одинаков в обеих темах. Из 9 цветов образца берём 6. Три заменены, потому что не проходят правило ниже: `#0f9f8f` (почти `success`), `#e0457b` (светлый, рядом с `danger`), `#5b63e6` (почти `ai`). Добавлены коричневый и оливковый.

| № | Раздел трека «Математика» | Цвет | Контраст белого текста |
|---|---|---|---|
| 1 | Числа, степени, корни, выражения | `#1a91d6` | 3,46 |
| 2 | Уравнения и неравенства, системы | `#a3367f` [новое] | 6,19 |
| 3 | Функции и графики | `#2563a8` [новое] | 6,12 |
| 4 | Прогрессии | `#c2410c` | 5,18 |
| 5 | Тригонометрия | `#be185d` [новое] | 6,04 |
| 6 | Показательные и логарифмические | `#0e8fb0` | 3,77 |
| 7 | Начала анализа | `#b7791f` | 3,64 |
| 8 | Планиметрия | `#8b5e34` [новое] | 5,60 |
| 9 | Стереометрия | `#64748b` | 4,76 |
| 10 | Текстовые задачи и моделирование | `#5f7a1f` [новое] | 4,89 |
| 11 | Как решать ЕНТ | `#334155` | 10,35 |

Трек «Математическая грамотность»:

| Раздел | Цвет |
|---|---|
| Количественные рассуждения | `#1a91d6` |
| Неопределённость | `#be185d` |
| Изменение и зависимости | `#2563a8` |
| Пространство и форма | `#8b5e34` |

Правило для любого цвета раздела. Оттенок (hue) и светлоту считаем по HSL, контраст — по WCAG. Все цвета таблиц выше правило проходят (проверено расчётом):
- контраст белого текста не меньше **3:1** (заголовок раздела крупный и жирный);
- оттенок отличается от `ai` (252°) и `success` (152°) **не меньше чем на 30°**. На карте это самые опасные смыслы: «это ИИ» и «освоено»;
- если оттенок ближе 30° к `danger` (0°), `streak` (25°), `warning` (39°) или `gold` (45°), цвет должен быть заметно темнее их: светлота **не больше 42 %** (у смысловых цветов 47–61 %);
- у соседних разделов цвета из разных семейств.

Тест `tests/content.test.ts` проверяет эти правила для каждого `unit.color`.

### 2.7 Цвета в сценах и схемах [новое, по образцу]

Как в образце: схема плоская, крупная, цифры моноширинные, много воздуха.

| Роль на схеме | Токен | Пример |
|---|---|---|
| обычные линии, фигуры, подписи | `text` (`stroke-text`, `fill-text`) | стороны треугольника, оси |
| вспомогательное | `border` (сетка), `muted` (засечки, подписи делений, невидимые рёбра пунктиром) | клетки плоскости, высота пунктиром |
| заливка фигуры | `primary-soft` или `surface-2` | треугольник, грань куба |
| то, что выбрал или двигает ученик; искомое `x` | `primary` | точка на прямой, ползунок, подпись «x = ?» |
| результат проверки | `success` / `danger` / `warning` | промежуток, отмеченный верно или неверно |
| ключевой итог, «важное» | `gold`, **не больше одного акцента на схему** | ответ в рамке; в образце так светились «единицы» |
| несколько графиков, секторы диаграммы | `plot-1`, `plot-2`, `plot-3` (2.3) | `y = x²` и `y = 2x + 3` |
| ИИ | `ai` | на схемах не встречается |

---

## 3. Типографика

### 3.1 Шрифты [образец]

- `@fontsource-variable/nunito` — основной шрифт, в нём есть казахские буквы ә ғ қ ң ө ұ ү һ і. `@fontsource-variable/jetbrains-mono` — для чисел, ответов и выражений.
- Оба подключаются импортом в `src/app/layout.tsx`: `import "@fontsource-variable/nunito"; import "@fontsource-variable/jetbrains-mono";`. Без `next/font` и без Google Fonts по сети. Образец — `reference/src/app/layout.tsx`.
- Семейства заданы в `@theme`: `font-sans` (по умолчанию у `body`) и `font-mono`.

### 3.2 Размеры и веса [образец]

`rem` = 16 px. Веса Nunito: подписи — 600 (`font-semibold`), почти весь интерфейс — 700/800 (`font-bold`/`font-extrabold`), логотип и счёт в игре — 900 (`font-black`). `font-normal` почти не используется.

| Элемент | Классы | px |
|---|---|---|
| Заголовок страницы | `text-2xl font-extrabold` | 24 |
| Заголовок секции/карточки (`SectionTitle`) | `text-lg font-extrabold` | 18 |
| Вопрос в уроке | `text-xl sm:text-2xl font-extrabold leading-snug` | 20 / 24 |
| Заголовок теории | `text-2xl font-extrabold` | 24 |
| Текст теории | `Markdown className="text-[17px]"` | 17 |
| Вариант ответа | `text-[17px] font-bold`; числовой — `font-mono text-xl` | 17 / 20 |
| Кнопка sm / md / lg | `text-sm` / `text-[15px]` / `text-base` + `font-extrabold tracking-wide` | 14 / 15 / 16 |
| Подпись, описание | `text-sm font-semibold text-muted` | 14 |
| Мелкая подпись | `text-xs font-bold` | 12 |
| Подпись в нижнем меню | `text-[11px] font-extrabold` | 11 |
| «Оверлайн» (Раздел N, Новое достижение!) | `text-xs font-extrabold uppercase` | 12 |
| Число в плитке итогов | `text-2xl font-extrabold` | 24 |
| Заголовок итогов | `text-3xl font-extrabold` | 30 |
| Очки в игре | `text-5xl font-black` | 48 |
| Дисплей калькулятора | `text-4xl` → `text-2xl` (> 11 знаков) → `text-xl` (> 18) | 36 / 24 / 20 |
| Логотип-слово «Matematika» | `text-lg font-black tracking-tight text-primary` | 18 |

### 3.3 Моноширинный шрифт и числа [образец + новое]

Где `font-mono` [образец]:
- числа в плитках;
- варианты-числа;
- «Правильный ответ: …»;
- дисплей калькулятора и поле ответа.

Для ровных столбиков чисел добавляй `tabular-nums`.

Математические правила записи [новое, по материалам НЦТ, см. `docs/ENT_MATH.md`]:

| Что | Как пишем | Пример |
|---|---|---|
| Десятичная дробь | запятая, и в ru, и в kk | `0,25`, `67,5` |
| Минус | настоящий минус U+2212 | `−2,5` (не `-2,5`) |
| Координаты, промежутки, множества | через точку с запятой | `(2; −1)`, `[6; 10)`, `(4,5; +∞)`, `{1; 3}` |
| Тригонометрия | `tg`, `ctg` (не `tan`) | `tg x = 1` |
| Умножение в выражении | точка по центру `·`; в калькуляторе — `×` | `19·b₁` |
| Степени, индексы, корни, дроби | Unicode, если хватает | `2³`, `x²`, `b₁`, `√2`, `½`, `¾` |
| Целые решения | `n ∈ Z` | `x = πn, n ∈ Z` |
| Разряды тысяч | пробел — **[проверить]** по демоверсиям НЦТ | `1 000 000` |

### 3.4 Формулы: Unicode или KaTeX [новое]

- **Unicode** — когда формула умещается в строку текста: `x² − 5x + 6 = 0`, `√2`, `2³`, `3,5`.
- **KaTeX** — когда Unicode не справляется:
  - дробь с выражением;
  - система уравнений;
  - корень из выражения;
  - предел, интеграл, сумма;
  - многоэтажная степень.
- В Markdown формулы пишутся как `$...$` (в строке) и `$$...$$` (отдельной строкой). Markdown рендерится с `remark-math` + `rehype-katex`, сырой HTML запрещён.
- Вне Markdown (варианты ответа, плитки, подписи на схемах) используется компонент `src/components/math/Tex.tsx`: `<Tex math="\frac{x+1}{2}" />`, для отдельной строки — `display`. В `Tex` передаём **только авторский контент** из `src/content`, ни текст ИИ, ни ввод ученика туда не попадают.
- **Запятая внутри LaTeX — ловушка.** `$3,5$` KaTeX рисует как «3, 5»: после запятой появляется пробел 0,1667em. Проверено на KaTeX 0.19.0. Пиши `3{,}5`. Контент-тест должен ловить `\d,\d` внутри `$…$`. Для ИИ это правило записано в `docs/AI.md`.
- Проверено на KaTeX 0.19.0, рендерится без ошибок:
  - `\tg x`, `\ctg x`;
  - `\begin{cases} … \end{cases}`;
  - `\sqrt{x+1}`, `\frac{…}{…}`;
  - `\lim_{x\to 0}`, `\int_0^1 x^2\,dx`;
  - `\ln x`, `\lg x`, `x \in \mathbb{Z}`.
- **Стиль формулы.** Цвет — `currentColor`, поэтому обе темы работают сами. Размер — `1.1em` от текста (2.3 б).
- **Формулы в вариантах ответа.** Если хотя бы одному варианту в задании нужен LaTeX, **все** варианты рисуем через `Tex`. Смешанный вид (часть в mono, часть в KaTeX) выглядит неряшливо. Варианты с формулами выстраиваем в 1 колонку, текст выравниваем по левому краю.

### 3.5 Markdown-стиль `.prose-app` [образец]

Используется в теории, конспектах и ответах ИИ. Стили — в блоке 2.2.
- межстрочный интервал 1,6;
- между блоками 0,6em;
- `h1` 1,4rem, `h2` 1,15rem, `h3` 1,02rem, все жирностью 800;
- `blockquote` — левая полоса `primary` 4 px на `primary-soft`. Так оформляем «Запомни» и «Лайфхак для ЕНТ»;
- таблицы с рамкой 1 px `border`;
- `code` моноширинный на `surface-2`.

Образец компонента — `reference/src/components/Markdown.tsx`. Для математики добавь `remarkMath` в `remarkPlugins` и `rehypeKatex` в `rehypePlugins`. `rehype-raw` **не** подключай.

---

## 4. Форма: радиусы, тени, отступы, касание [образец]

### 4.1 Радиусы

Значения Tailwind v4: `rounded-xl` = 12 px, `rounded-2xl` = 16 px, `rounded-3xl` = 24 px.

| Элемент | Радиус |
|---|---|
| Кнопка sm | `rounded-xl` (12) |
| Кнопка md/lg, вариант ответа, плитка, поле ввода, строка списка, клавиша | `rounded-2xl` (16) |
| Карточка `Card`, баннер, заголовок раздела, модалка на десктопе | `rounded-3xl` (24) |
| Шторка на телефоне | `rounded-t-3xl` |
| Pill, прогресс-бар, аватар, узел карты (72×72) | `rounded-full` |
| Иконка-кнопка в шапке 40×40, «таблетка» активной вкладки 48×32 | `rounded-xl` |
| Иконка игры на вступлении 80×80 | `rounded-[1.75rem]` (28) |

### 4.2 Тени: правило «нижней грани»

| Что | Тень |
|---|---|
| Кнопка primary / success / danger / ai | `shadow-[0_4px_0_var(--X-strong)]` |
| Кнопка secondary | `border-2 border-border shadow-[0_3px_0_var(--border)]` |
| Кнопка disabled | `shadow-[0_4px_0_var(--border)]`, фон `surface-2`, текст `muted` |
| Вариант ответа idle / selected / correct / wrong | `0_3px_0` цвета `border` / `primary` / `success` / `danger` |
| Баннер-карточка действия | `shadow-[0_5px_0_var(--primary-strong)]` |
| Модалка, шторка «Помощников» | `shadow-2xl` |
| Плавающая кнопка, форма чата, иконка игры | `shadow-lg` |
| Бейдж «Начать» над узлом, XpBurst | `shadow-sm` |
| `Card` | **без тени**, только рамка 2 px |

Нажатие:
- кнопка — `active:translate-y-[3px] active:shadow-none`;
- вариант ответа — `active:translate-y-[2px]`;
- узел карты — `active:translate-y-1 active:border-b-2`.

Свечение:
- «горящий» элемент (в образце — лампочка) — `shadow-[0_0_24px_var(--gold)]`;
- огонёк комбо от 5 — `drop-shadow(0 0 5px var(--streak))`.

### 4.3 Отступы и контейнеры

| Где | Значения |
|---|---|
| Страница в оболочке | `px-4 sm:px-6`, `pt-5 lg:pt-8`, `pb-28 lg:pb-12` (низ — место под меню) |
| Колонка контента | `max-w-2xl` (672 px), по центру; внешний контейнер `max-w-6xl` (1152 px), `gap-8` |
| Между блоками страницы | `flex flex-col gap-5` (20 px) |
| Внутри карточки | `gap-3` (12 px), padding `p-4 sm:p-5` |
| Урок | `max-w-2xl px-4 pb-48 pt-2` (низ 192 px под нижнюю панель) |
| Итоги | `max-w-xl px-4 pb-32 pt-8` |
| Онбординг | `max-w-lg px-4 pb-6 pt-4` |
| Сетка вариантов | `gap-3`; все варианты ≤ 14 символов — 2 колонки, иначе 1 |
| Сетка плиток | `grid-cols-2 sm:grid-cols-3 gap-3` |

### 4.4 Брейкпоинты (Tailwind v4 по умолчанию)

| Ширина | Что меняется |
|---|---|
| < 640 | телефон: модалки — шторки снизу |
| `sm` ≥ 640 | модалка — окно по центру; карточка `p-5`; вопрос 24 px; кнопка «Продолжить» `sm:w-56` |
| `lg` ≥ 1024 | боковое меню слева 256 px; верхняя панель и нижнее меню скрыты; «Помощники» — панель справа |
| `xl` ≥ 1280 | справа колонка виджетов 320 px (`w-80`) |
| `[@media(max-height:700px)]` | низкий экран (360×640): клавиши калькулятора и матклавиатуры `h-12` вместо `h-14` |

### 4.5 Safe-area и высота экрана

- В `viewport` стоит `viewportFit: "cover"`. Высота экрана — `min-h-dvh`, не `h-screen`.
- Отступы под системные зоны:
  - нижнее меню — `pb-[env(safe-area-inset-bottom)]`;
  - верхняя панель — `pt-[env(safe-area-inset-top)]`;
  - нижние панели урока, итогов, плавающая кнопка, шторки — `pb-[max(1rem,env(safe-area-inset-bottom))]`.
- Модалка — `max-h-[88dvh]`, шторка «Помощников» — `h-[min(40rem,90dvh)]`.

### 4.6 Размеры касания

| Элемент | Размер |
|---|---|
| Button sm / md / lg | `h-9` (36) / `h-11` (44) / `h-13` (52). Главная кнопка урока — всегда lg |
| Иконка-кнопка в шапке | 40×40 |
| Вкладка нижнего меню | вся ячейка `h-16` (64) |
| Пункт бокового меню | `h-12` |
| Вариант ответа | `min-h-14` (56) |
| Поле ввода (онбординг, ответ) | `h-14` |
| Клавиша калькулятора и матклавиатуры | `h-14` (56), на низких экранах `h-12` (48) |
| Плавающая кнопка «Помощники» | 56×56 |
| Кнопка отправки в чате | 44×44 |
| Перетаскиваемая точка на схеме [новое] | рисуем r = 6–8, невидимая зона касания r = 22 (≈ 44 px) |

Минимум — 40 px. Фокус на кнопках и вкладках: `focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary`.

---

## 5. UI-компоненты

Все классы склеиваются через `cn()` (`src/lib/cn.ts` = clsx + tailwind-merge), чтобы `className` снаружи мог переопределять стили. Образец — `reference/src/lib/cn.ts`.

**Есть ли эталон.** Метка [образец] значит «так сделано в Informatica», а не «файл лежит в `reference/`». Файлы есть только у части компонентов. Остальные делай по описанию и по интерфейсу из таблицы. Не ищи их в `reference/`.

| Компонент (файл в проекте) | Эталон в `reference/` | Описание | Интерфейс, если эталона нет |
|---|---|---|---|
| `ui/Button`, `Card`, `Pill`, `ProgressBar` (+ `Ring`), `Modal` | есть | 5.1–5.5 | — |
| `motion/*` | есть | 8 | — |
| `mascot/Mascot.tsx` (+ `MascotSays`) | есть | 10, 5.9 | — |
| `app/AppShell.tsx` | есть, но импортирует `Widgets` и `Toolbox`, которых нет | 6 | — |
| `app/AchievementBadge.tsx`, `Markdown.tsx`, `ai/AiPanel.tsx`, `ai/useTutor.ts` | есть | 5.9, 3.5, 7.6 | — |
| `app/Providers.tsx` | нет | ниже, 6.4, 8.6, 13 | `Providers({ children })` |
| `app/Widgets.tsx`: `StreakChip`, `XpChip`, `LevelChip`, `LevelCard`, `DailyGoalCard`, `WeakTopicsCard` | нет | 5.9, 6.2, 7.2 | без пропсов, данные из стора; `DailyGoalCard({ compact? })` |
| `app/WeekChart.tsx` | нет | 5.9 | `WeekChart()`, данные `days` из стора |
| `Segmented`, `Row` (в `profile/page.tsx`) | нет | 5.6, 7.13 | `Segmented<T>({ value, options: { id: T; label: string }[], onChange })`, `Row({ label, hint?, children })` |
| `Tile` (в `stats/page.tsx`) | нет | 5.9 | `Tile({ icon, label, value, sub? })` |
| `Choice` (в `onboarding/page.tsx`) | нет | 5.8 | `Choice({ selected, onClick, children })` |
| `lesson/LessonPlayer.tsx` | нет | 7.3–7.5 | `LessonPlayer({ kind: "lesson" \| "drill", lessonId?, title, steps, mistakeMap? })` |
| `lesson/steps/Option.tsx` | нет | 5.7 | `Option({ state: "idle" \| "selected" \| "correct" \| "wrong" \| "dim", onClick?, children, badge?, disabled?, index? })` |
| `lesson/steps/*View.tsx` (вопросы) | нет | 7.4 | все одинаково: `StepProps = { step, answer, onAnswer(a, { submit? }), locked, result }` (`docs/ARCHITECTURE.md`, 5) |
| `lesson/steps/WorkedView.tsx` | нет | 7.4.1 | `WorkedView({ step, revealed })`: сколько шагов открыто, решает плеер |
| `lesson/DrawingCanvas.tsx` | нет | 7.4.4 | `ref` с `exportCanvas()`, пропсы `onChange(empty)`, `disabled` |
| `lesson/Results.tsx` | нет | 7.7 | `Results({ kind, lessonId?, title, result, bonusXp, achievements, feedback })` |
| `games/GameShell.tsx` | нет | 7.9 | `GameShell({ id })`; сама игра — по `reference/src/games/types.ts` |
| `tools/Toolbox.tsx` (+ `ToolboxButton`), `tools/useToolbox.ts` | нет | 7.14 | `ToolboxButton({ variant?: "icon" \| "fab", className? })`; стор и `useToolboxLevel(level)` — `docs/ARCHITECTURE.md`, 15 |
| `tools/Calculator.tsx`, `Scratchpad.tsx`, `Formulas.tsx`, `GraphTool.tsx` | нет | 7.14 | `Calculator({ active })`, остальные без пропсов |
| `scenes/SceneView.tsx` и сцены | нет | 11 | `SceneView({ scene, className? })` (`docs/ARCHITECTURE.md`, 16) |
| `math/Tex.tsx`, `math/MathKeypad.tsx`, `AnswerField`, `Slider` | нет, это новое | 5.10, 7.4.3 | 5.10 |

**`Providers`** (эталона нет; его импортирует `reference/src/app/layout.tsx`) оборачивает всё приложение и делает пять вещей:
1. Ждёт, пока стор прочитается из `localStorage` (`useApp.persist.hasHydrated()` через `useSyncExternalStore`). До этого показывает заставку: маскот 88 px с `animate-pulse` по центру.
2. Если `onboarded = false` и адрес не `/onboarding`, делает `router.replace("/onboarding")`.
3. Тема и язык: при `theme = "system"` убирает `data-theme` у `<html>`, иначе ставит его; ставит `lang` (`ru` / `kk`).
4. Ставит `data-reduce-motion="true" | "false"` (8.6).
5. Оборачивает всё в `MotionProvider` и рисует **один** `Toolbox` на всё приложение.

### 5.1 Button и ButtonLink [образец]
Файл — `src/components/ui/Button.tsx`, образец — `reference/src/components/ui/Button.tsx`.

- Пропсы:
  - `variant`: `"primary" | "success" | "danger" | "ai" | "secondary" | "ghost"`, по умолчанию `primary`;
  - `size`: `"sm" | "md" | "lg"`, по умолчанию `md`;
  - `block` — ширина 100 %;
  - `icon` — иконка слева от текста;
  - `disabled`; `type` по умолчанию `"button"`.
- Варианты:
  - primary / success / danger / ai — заливка `bg-X text-white`, грань `X-strong`, при наведении `hover:brightness-105`;
  - secondary — `bg-surface border-2 border-border`, грань `border`;
  - ghost — прозрачная, `text-muted`, без тени;
  - disabled — серая с гранью `border`, при нажатии не сдвигается.
- Движение:
  - при нажатии `scale 0.97` (spring 700/22);
  - когда кнопка из disabled становится активной, она один раз «подпрыгивает»: `scale [1, 1.05, 1]` за 0,28 с.
- `buttonClass({variant,size,block,disabled})` возвращает классы кнопки, чтобы оформить ими другой элемент.
- `ButtonLink` — `next/link` с теми же классами. **Нельзя вкладывать `<button>` в `<a>`**.

### 5.2 Card и SectionTitle [образец]
- `Card`: `rounded-3xl border-2 border-border bg-surface p-4 sm:p-5`.
  - `interactive` — нажатие `scale 0.985`;
  - `appear` — появление `opacity 0→1, y 14→0`, springSoft.
- Цветная рамка задаётся классом:
  - `border-ai/30` — карточка ИИ;
  - `border-danger/30` — слабые темы;
  - `border-primary/30` — главное.
- `SectionTitle` — заголовок `h2 text-lg font-extrabold`, справа слот `action`.

### 5.3 Pill [образец]
`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold` + иконка 14 px.

| Тон | Классы | Где |
|---|---|---|
| primary | `bg-primary-soft text-primary` | «Теория», «Видео», «Исследуй» |
| success | `bg-success-soft text-success-strong` | «Освоено» |
| danger | `bg-danger-soft text-danger` | «Слабо» |
| warning | `bg-warning-soft text-warning-strong` | «В процессе» |
| gold | `bg-gold-soft text-warning-strong` | «ЕНТ» / «ҰБТ» с иконкой `Target` |
| streak | `bg-streak-soft text-streak` | серия |
| ai | `bg-ai-soft text-ai` | всё про ИИ |
| muted | `bg-surface-2 text-muted` | «Скоро» |

### 5.4 ProgressBar и Ring [образец]
- `ProgressBar({ value 0..1, color = "var(--success)", height = 14, label })`:
  - трек `rounded-full bg-surface-2`, `role="progressbar"`;
  - заливка растёт пружиной (150/22);
  - минимальная ширина равна высоте, чтобы при значении > 0 была видна «капля»;
  - внутри сверху блик `bg-white/30`;
  - при росте значения по полосе пробегает белый блик (0,7 с).
- Где используется:

  | Где | Цвет | Высота |
  |---|---|---|
  | урок | success | 14 |
  | онбординг | `var(--primary)` | 14 |
  | освоение навыка | `MASTERY_COLOR` | 10 |
  | уровень | primary | 10 |

- `Ring({ value, size = 56, stroke = 7, color = "var(--gold)" })` — SVG-кольцо, трек `surface-2`, иконка в центре. Цель дня: кольцо золотое, когда цель выполнена — зелёное.
- Образец — `reference/src/components/ui/ProgressBar.tsx`.

### 5.5 Modal [образец]
- **Телефон (< 640 px)** — шторка снизу: `rounded-t-3xl`, spring 380/34, выезжает `y: 100%`.
- **Десктоп** — окно по центру: `sm:max-w-md sm:rounded-3xl`, spring 420/28, `scale 0.92→1`.
- Затемнение `bg-black/40`: клик по нему закрывает. Esc закрывает. Прокрутка страницы блокируется.
- `role="dialog" aria-modal`, `z-50`.
- Типовое содержимое, сверху вниз:
  1. маскот 72 px;
  2. заголовок `text-xl font-extrabold`;
  3. текст `text-muted`;
  4. кнопки в колонку: главная — `lg block`, вторая — `ghost` или `secondary`.

Образец — `reference/src/components/ui/Modal.tsx`.

### 5.6 Segmented (переключатель в профиле) [образец]
Чипы `rounded-xl border-2 px-3 py-1.5 text-sm font-bold`.
- Выбранный — `border-primary bg-primary-soft text-primary`.
- Остальные — `border-border bg-surface text-muted`.
- У каждой кнопки `aria-pressed`.

### 5.7 Option — вариант ответа [образец]
Файл — `src/components/lesson/steps/Option.tsx`.

- Базовые классы: `min-h-14 w-full rounded-2xl border-2 px-4 py-3 text-left text-[17px] font-bold`, `animate-rise-in`.
- Варианты появляются лесенкой: `animation-delay = min(index,5)*40ms`.

| Состояние | Классы | Движение |
|---|---|---|
| idle | `border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2` | нажатие scale 0.97 |
| selected | `border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]` | «поп» scale [1,1.04,1] 0,22 с |
| correct | `border-success bg-success-soft text-success-strong shadow-[0_3px_0_var(--success)]` | scale [1,1.035,1] 0,3 с + кольцо-вспышка `animate-ring-out` |
| wrong | `border-danger bg-danger-soft text-danger shadow-[0_3px_0_var(--danger)]` | встряска x [0,−7,7,−4,4,0] 0,36 с |
| dim | `border-border bg-surface opacity-50` | — |

- **Бейдж номера** 1–4: `h-7 w-7 rounded-lg border-2 text-xs`, виден только с `sm`. Цифры 1–4 на клавиатуре выбирают вариант, но только когда фокус не в поле ввода, не в «Помощниках» и не на матклавиатуре.
- **`ChoiceView`**:
  - короткие варианты — 2 колонки;
  - числовые — `font-mono text-xl`;
  - формулы — все через `Tex`, в 1 колонку (3.4).
- **`MultiView`** («один или несколько»):
  - подпись `text-sm font-bold text-muted`;
  - 2 колонки;
  - чекбокс 20×20 `rounded-md border-2` с галочкой `Check` 14 px.
  - Для ЕНТ-формата подпись — официальная инструкция НЦТ (`docs/ENT_MATH.md`, 4.9).

### 5.8 Choice — карточка выбора в онбординге и выборе темпа [образец]
- Карточка: `rounded-2xl border-2 px-4 py-3.5 text-left font-bold`. Выбранная выглядит как Option selected.
- Иконка-плитка 44×44 `rounded-2xl`: у выбранной — `bg-primary text-white`, иначе — `bg-primary-soft text-primary`.

### 5.9 Мелкие повторяющиеся паттерны [образец]

| Паттерн | Классы |
|---|---|
| Плитка статистики `Tile` | `rounded-2xl border-2 border-border bg-surface p-3`. Подпись — `text-xs font-extrabold text-muted` + иконка 14 px смыслового цвета. Значение — `text-2xl font-extrabold mt-1` |
| Строка-ссылка списка | `flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-3 font-bold hover:bg-surface-2`. Закрытая — `border-dashed text-muted pointer-events-none` |
| Закрыто / «скоро» | `border-dashed opacity-60` + иконка `Lock` |
| Баннер-действие | `rounded-3xl bg-primary p-5 text-white shadow-[0_5px_0_var(--primary-strong)] active:translate-y-1 active:shadow-none` (красный — `danger`) |
| Плашка-уведомление | `rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger` (так же `warning`) |
| Скелетон загрузки | `animate-pulse rounded bg-ai/15` — для ИИ; `bg-surface-2` — для остального |
| Аватар | круг `bg-primary-soft text-primary font-extrabold`, первая буква имени |
| `LevelChip` | `h-7 min-w-7 rounded-lg bg-primary px-1.5 text-sm font-extrabold text-white` |
| `LevelCard` | квадрат 48×48 `rounded-2xl bg-primary text-xl font-extrabold text-white shadow-[0_4px_0_var(--primary-strong)]` + название уровня + «X / Y XP» + серия справа + ProgressBar primary, высота 10 |
| `AchievementBadge` | круг 48 px `border-b-4`. Получено — `border-warning-strong/60 bg-gold text-white`, нет — `border-border bg-surface-2 text-muted`. Иконка lucide 50 % размера, `strokeWidth 2.4`. В данных иконка — строка-имя (`"pi"` → `Pi`). Образец — `reference/src/components/app/AchievementBadge.tsx` |
| `WeekChart` (XP за неделю) | 7 столбцов, область 140 px. Цвет `primary`, при выполненной цели — `success`. Линия цели — `border-gold/70`. Значение подписано только у «сегодня», у остальных — во всплывающей подсказке `bg-text text-surface rounded-lg`. Рядом скрытая таблица `sr-only` |
| `MascotSays` | маскот слева + пузырь `rounded-2xl border-2 border-border bg-surface px-4 py-3 text-[15px] font-semibold leading-snug animate-fade-in` с «хвостиком» (квадрат 16×16 `rotate-45`, рамки слева и снизу) |

### 5.10 Новые компоненты математики [новое]

| Компонент | Путь | Вид |
|---|---|---|
| `Tex` | `src/components/math/Tex.tsx` | формула KaTeX, в строке или `display`. Цвет — `currentColor`, размер — 1,1em. Если формула не рендерится, показываем исходный текст `font-mono text-danger` и пишем предупреждение в консоль (в продакшене этого не должно быть: тест) |
| `MathKeypad` | `src/components/math/MathKeypad.tsx` | экранная клавиатура, раздел 7.4.3 |
| `AnswerField` | `src/components/lesson/steps/` (рядом с `InputView`) | поле-дисплей ответа `h-14 rounded-2xl border-2 px-4 font-mono text-2xl`, фокус `border-primary`. Под ним превью «Твой ответ: ¾» через `Tex`, `text-sm text-muted` |
| `Slider` (ползунок параметра в песочнице) | `src/components/scenes/primitives.tsx` | трек `h-2 rounded-full bg-surface-2`, заливка `bg-primary`. «Бегунок» 28 px `rounded-full bg-surface border-2 border-primary shadow-[0_2px_0_var(--primary-strong)]`, зона касания 44 px. Подпись `a = 1,5` `font-mono font-bold`. `role="slider"` + `aria-valuenow`, стрелки клавиатуры меняют значение |
| Сцены и схемы | `src/components/scenes/*` | раздел 11 |

---

## 6. Навигация [образец]

Файл — `src/components/app/AppShell.tsx`, образец — `reference/src/components/app/AppShell.tsx`.

### 6.1 Пункты меню

| # | Адрес | Иконка | Ключ словаря | ru / kk |
|---|---|---|---|---|
| 1 | `/learn` | `BookOpen` | `nav.learn` | Учиться / Оқу |
| 2 | `/practice` | `Dumbbell` | `nav.practice` | Тренировка / Жаттығу |
| 3 | `/tutor` | `Sparkles` | `nav.tutor` (флаг `ai: true`) | ИИ-помощник / ЖИ-көмекші |
| 4 | `/notes` | `NotebookPen` | `nav.notes` | Конспекты / Конспектілер |
| 5 | `/stats` | `ChartColumn` | `nav.stats` | Прогресс / Прогресс |
| — | `/profile` | аватар | `nav.profile` | Профиль / Профиль |
| — | «Помощники» | `Calculator` | `tools.open` | Помощники / kk — через `npm run review:kk` [новое] |

### 6.2 Телефон и планшет (< 1024 px)

```
┌──────────────────────────────────────────┐
│ [Пи 34] Matematika   [Flame 3][Zap 120]  │ ← верхняя панель h-14, sticky,
│                          [Calculator] (А)│   bg-bg/90 backdrop-blur, border-b-2
├──────────────────────────────────────────┤
│                                          │
│            контент страницы              │ ← pb-28, чтобы не прятался
│                                          │
├──────────────────────────────────────────┤
│ [Book]  [Dumbbell] [Sparkles] [Notebook] [Chart] │ ← нижнее меню h-16, fixed,
│ Учиться Тренировка ИИ-помощ.  Конспекты Прогресс │   bg-surface border-t-2
└──────────────────────────────────────────┘
```

**Верхняя панель.**
- Слева — маскот 34 px и слово «Matematika».
- Справа:
  - `StreakChip` — огонёк и число. Оранжевый и залитый, если сегодня уже занимались, иначе серый;
  - `XpChip` — молния и число;
  - кнопка «Помощники» 40×40 (иконка 22 px);
  - аватар 32 px — ссылка в профиль.

**Нижнее меню.**
- `grid-cols-5`. В каждой ячейке иконка 22 px в зоне 48×32 и подпись `text-[11px] font-extrabold truncate`.
- Цвета:
  - активная вкладка — `text-primary`;
  - активная «ИИ-помощник» — `text-ai`;
  - неактивные — `text-muted`.
- Под активной иконкой **одна** «таблетка» 48×32 `rounded-xl bg-primary-soft` (для ИИ — `bg-ai-soft`). Она переезжает между вкладками пружиной 520/34.
- Иконка активной вкладки подпрыгивает: `y [0,−5,0], scale [1,1.15,1]`, 0,32 с.

**Смена страницы:** контент проявляется — `opacity 0→1, y 8→0`, 0,22 с, ease `[0.22,1,0.36,1]`.

### 6.3 Десктоп (≥ 1024 px)

```
┌────────────┬──────────────────────────────┬──────────────┐
│ [Пи] Mate… │                              │ Flame XP Lvl │
│            │      контент max-w-2xl       │ LevelCard    │ ← только ≥1280,
│ [Учиться ] │                              │ Цель на день │   w-80, sticky top-8
│  Трениров. │                              │ Слабые темы  │
│  ИИ-помощ. │                              │              │
│  Конспекты │                              │              │
│  Прогресс  │                              │              │
│            │                              │              │
│ Помощники  │                              │              │
│ (А) Профиль│                              │              │
└────────────┴──────────────────────────────┴──────────────┘
  w-64, border-r-2
```

- **Боковое меню.**
  - Пункты: `h-12 gap-3 rounded-2xl border-2 px-3 font-extrabold`, иконка 22 px.
  - Активный — `border-primary/40 bg-primary-soft text-primary`, для ИИ — `border-ai/40 bg-ai-soft text-ai`.
  - Неактивный — `border-transparent text-muted hover:bg-surface-2`.
- Контент сдвинут на `lg:pl-64`.
- Если экран уже 1280 px, правой колонки нет. Виджеты «Цель на день» и «Слабые темы» тогда показываются прямо на `/learn` (`xl:hidden`).

### 6.4 Экраны без оболочки
- Без меню открываются `/lesson/[id]`, `/drill`, `/game/[id]`, `/onboarding`, мини-ЕНТ и пробный ЕНТ. У них свои шапки.
- Пока стор не загрузился, по центру экрана маскот 88 px с `animate-pulse`. Пока `onboarded = false`, приложение отправляет на `/onboarding`.
- Кнопка «Помощники» бывает двух видов:
  - `ToolboxButton variant="icon"` — в шапке, 40×40, активная `bg-primary-soft text-primary`;
  - `variant="fab"` — круг 56 px `fixed bottom-[max(1rem,safe)] right-4 z-40 bg-primary text-white shadow-lg`.

---

## 7. Экраны

Схемы ниже рисуют телефон шириной 360–430 px. `[...]` — кнопка, `(...)` — Pill или чип, `[Name]` — иконка lucide. Есть ли у экрана эталонный файл — таблица в начале раздела 5. Пустые состояния всех экранов — 7.16.

**Процесс эскизов.** Большой новый экран (в образце его нет) сначала показываем владельцу. Сейчас это карта курса (7.2), контекстная группа ЕНТ (7.4.2), режимы ЕНТ (7.15) и стиль видео (11.10).
1. Codex делает служебную страницу `/dev/sketches/<имя>` (`noindex`, не в меню). На ней 2–3 варианта на настоящих данных курса, ru и kk. Это вёрстка «для показа»: без стора и без логики.
2. Codex снимает скриншоты 390×844 в светлой и тёмной теме и в отчёте даёт адрес превью и скриншоты. Готовые промпты: `docs/PROMPTS.md`, П-3.1 (сюжет) и П-5.1 (карта и экран ЕНТ).
3. В `docs/HANDOFF.md`, раздел 6 «Вопросы владельцу», Codex пишет вопрос с рекомендацией: «Карта: А, Б или В? Рекомендую А — …».
4. Владелец открывает превью **на телефоне** и отвечает в чате: «вариант 2» (можно с правками). На что смотреть: понятно ли с первого взгляда, что делать дальше; видно ли, что пройдено; удобно ли нажимать пальцем.
5. Выбор записывается в `docs/DECISIONS.md`. Только после этого экран верстают по-настоящему, а страницу эскиза удаляют.
6. Пока выбора нет, работает простой временный вариант (для карты — тропинка из 7.2). В `docs/HANDOFF.md`, раздел 11, стоит строка «временно: <экран>, ждёт выбора эскиза», чтобы его не забыли заменить.

Для видео вместо страниц — тестовый ролик в каждом стиле, в ветке `video-lab` (11.10).

### 7.1 Онбординг `/onboarding` [образец]

```
┌──────────────────────────────────────────┐
│ [<]  ████████░░░░░░░░░░░░░░░░░░░░░░░░    │ h-12: «назад» 40×40 (невидима на шаге 0)
│                                          │       + ProgressBar primary (step+1)/6
│ [Пи 88]  ( Как тебя зовут?            )  │ MascotSays, animate-fade-in
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Айша                                 │ │ input h-14 rounded-2xl border-2
│ └──────────────────────────────────────┘ │ text-xl font-bold, фокус border-primary
│                                          │
│                                          │
│ [            Продолжить               ]  │ Button lg block, mt-6
└──────────────────────────────────────────┘
```

| Шаг | Экран | Маскот |
|---|---|---|
| 0 | Язык: две `Choice` — «Қазақша» (бейдж ҚАЗ) и «Русский» (РУС). Приветствие «Привет! Сәлем!». Кнопки нет: выбор сразу переводит дальше | happy |
| 1 | Имя: до 30 символов, Enter — дальше. Кнопка неактивна, пока поле пустое | happy |
| 2 | Класс: сетка 2 колонки — 8, 9, 10, 11, «Другое» | happy |
| 3 | Цель: 3 варианта с иконками `Target`, `BookOpen`, `Lightbulb` | happy |
| 4 | Стиль объяснений: 3 варианта с иконками `Zap`, `Puzzle`, `ListOrdered` | thinking |
| 5 | Цель на день: 20, 50 или 100 XP с подписью «≈ N мин». Кнопка «Поехали!» | happy |

Тексты шагов — в `docs/CONCEPT.md`, 6.2. Контейнер — `max-w-lg px-4 pb-6 pt-4 min-h-dvh`.

### 7.2 «Учиться» `/learn` [образец, карта — на эскизы]

```
┌──────────────────────────────────────────┐
│ [Пи 72] ( Привет, Айша!               )  │ MascotSays happy;
│         ( Продолжить обучение         )  │ имя text-lg extrabold
│ ┌──────────────────────────────────────┐ │
│ │ (Ring Target)  Цель на день          │ │ DailyGoalCard compact (только <1280)
│ │                30 / 50 XP            │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │ «герой»: border-2 border-primary/30
│ │▓ Урок 3                  [v] Лучший 90%│ │ полоса bg-primary py-2 text-sm white
│ │ Квадратные уравнения                 │ │ text-2xl extrabold
│ │ Дискриминант и корни за 6 минут      │ │ muted
│ │ [Clock] 6 мин · 8 шагов · [Sparkles] │ │ мета; Sparkles фиолетовым
│ │ [Play        Начать                 ]│ │ Button lg block
│ └──────────────────────────────────────┘ │
│ ┌ Подтянем слабые темы? ───────────────┐ │ Card border-danger/30 (только <1280)
│ │ (Степени 45%) (Корни 52%)            │ │ чипы bg-danger-soft text-danger
│ │ [   Тренировка · 3 мин              ]│ │ кнопка-ссылка danger h-11
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │ заголовок раздела: rounded-3xl
│ │ РАЗДЕЛ 1                             │ │ px-5 py-4 text-white, фон unit.color
│ │ Числа, степени, корни                │ │ text-xl extrabold
│ └──────────────────────────────────────┘ │
│                 (Star)                   │ пройден: bg-gold border-warning-strong
│                      (Star)              │ «тропинка»: сдвиги 0,44,64,44,0,−44,−64,−44 px
│              ┌───────┐                   │
│              │Начать │                   │ метка над текущим (absolute -top-9)
│                        (Play)            │ доступен: unit.color + pulse-ring
│                      (Lock)              │ «скоро»: bg-surface-2 text-muted
└──────────────────────────────────────────┘
```

- **Узел карты:**
  - круг 72×72 с нижней гранью `border-b-[6px]`;
  - у доступного узла рамка `rgba(0,0,0,0.25)`;
  - под узлом подпись `max-w-40 text-sm font-bold text-center`.
- **Тап по узлу** открывает Modal с описанием и кнопкой «Начать» или «Повторить». Если урок «скоро» — иконка `Hammer`.
- **Тропинка «кружочками вниз»** в образце признана слишком простой (`docs/CONCEPT.md`, 6.3). Делаем её как временную, а до выкладки показываем владельцу эскизы: «Путешествие», «Метро» или «Карта ЕНТ». Требования к любой карте:
  - те же состояния узла (пройден — золото и `Star`; доступен — цвет раздела и пульс; скоро — серый и `Lock`);
  - те же цвета разделов (2.6);
  - работает на 360 px без горизонтальной прокрутки;
  - узел ≥ 56 px.

**Данные** (правила образца, `docs/CONCEPT.md`, 6.3):
- **Строка под приветствием:** «Начни с первого урока», если `lessons` пуст. «Продолжить обучение», если есть следующий урок. «Все готовые уроки пройдены — повтори или потренируйся», если его нет.
- **Следующий урок («герой»):** первый по порядку разделов урок со статусом `available`, которого ещё нет в `lessons`. Если все пройдены — первый урок курса, кнопка «Повторить урок». «Урок N» — сквозной номер по курсу (`lessonNumber`).
- **«Лучший N%»** — `lessons[id].bestAccuracy`, только у пройденного урока.
- **Мета:** минуты — `lesson.durationMin`, шаги — `steps.length`. Метки «Видео» и «Решение по фото» — только если в уроке есть шаги `video` и `solution`. В образце они показаны всегда — это недочёт, не копировать. Метка ИИ — всегда.
- **«Цель на день»** — `useDaily()` (`src/lib/hooks.ts`): XP за сегодня / `profile.dailyGoalXp`. Выполнена — кольцо зелёное, текст «Цель на сегодня выполнена!».
- **«Подтянем слабые темы?»** — `weakSkills(skills).slice(0, 3)` (`src/lib/mastery.ts`), от самого слабого. Слабых нет — карточки нет.
- **Узел карты:** `available` / `soon` — из данных курса, «пройден» — урок есть в `lessons`, «текущий» — это следующий урок.

### 7.3 Урок `/lesson/[id]` — каркас [образец]

```
┌──────────────────────────────────────────┐
│ [X] █████████░░░░░░░ [Flame 3] [AI] [Calc]│ h-16 sticky bg-bg/95 backdrop-blur
├──────────────────────────────────────────┤
│                                          │ main max-w-2xl px-4 pb-48 pt-2;
│        содержимое шага (7.4)             │ новый шаг въезжает x 24→0,
│                                          │ 0,25 с, ease [0.22,1,0.36,1]
│                                          │
├──────────────────────────────────────────┤
│ [             Проверить                ] │ нижняя панель fixed z-30,
└──────────────────────────────────────────┘ bg-bg border-t-2, pb-safe
```

**Шапка.**
- `X` — 24 px в зоне 40×40, `text-muted`. Открывает модалку выхода.
- ProgressBar — `flex-1`, высота 14, зелёный, показывает долю пройденных шагов.
- `ComboFlame` — `min-w-14`.
- Кнопка ИИ «Спроси Пи» — `Sparkles` 20 px в зоне 40×40, `rounded-xl bg-ai-soft text-ai`.
- Кнопка «Помощники».

**Модалка выхода:**
- маскот sad 72;
- заголовок «Выйти из урока?»;
- текст «Прогресс этого урока не сохранится.»;
- кнопки «Остаться» (lg primary) и «Выйти» (ghost, текст красный).

### 7.4 Урок — виды шагов

#### 7.4.1 Информационные шаги [образец]

| Тип | Сверху вниз |
|---|---|
| `video` | **Этап позже** (11.10): пока стиль не выбран, шага `video` в уроках нет. Вид, когда появится: Pill «Видео» (primary, `Clapperboard`) → заголовок 2xl → плеер Remotion в `rounded-3xl border-2 bg-surface`. Ролик квадратный 1080×1080, 30 fps. Постер: кнопка `Play` в круге 80 px `bg-primary shadow-[0_6px_0_var(--primary-strong)]` и название. Субтитры включаются кнопкой `Captions` / `CaptionsOff` |
| `theory` | Pill «Теория» (`BookOpen`) → заголовок 2xl → схема `SceneView` (11) → Markdown 17 px с формулами → ссылка «Непонятно? Спроси Пи» (фиолетовая, `Sparkles`) |
| `story` | Pill «Ситуация» → сцена-картинка → реплика Пи через `MascotSays` |
| `worked` («Разбор») | Pill «Разбор» (primary, `ListOrdered`) → заголовок 2xl → схема (одна, меняется вместе с шагом: берётся сцена последнего открытого шага, у которого она есть) → нумерованный список шагов `flex flex-col gap-2.5`. Шаги открываются по одному кнопкой «Следующий шаг» (или Enter); сколько открыто, решает плеер. **Шаг:** `flex items-start gap-3 rounded-2xl border-2 px-3 py-2`, слева кружок 28 px с номером `rounded-full text-sm font-extrabold`, справа Markdown 17 px. **Последний открытый шаг:** `border-primary/40 bg-primary-soft`, кружок `bg-primary text-white`, текст `font-semibold`. **Прежние шаги:** `border-transparent text-muted`, кружок `bg-surface-2 text-muted`; смена цвета — `transition-colors duration-300`. Появление шага: `opacity 0→1, y 12→0`, springSoft. Новый шаг плавно докручивается в зону видимости над нижней панелью. **Итог** (после последнего шага): `flex items-start gap-3 rounded-2xl border-2 border-success/30 bg-success-soft px-4 py-3 text-success-strong`, кружок 24 px `bg-success text-white` с `Check` 16 (`strokeWidth 3.5`), текст `font-bold`; появление `opacity 0→1, y 12→0, scale 0.97→1`, springBouncy с задержкой 0,08 с. Файла в `reference/` нет — описание снято с кода образца, делай по нему |
| `explore` («Попробуй», Pill с иконкой `Hand`) | цель в одну строку → песочница (схема + ползунки/точки) → когда цель достигнута, плашка `bg-success-soft text-success-strong` «Получилось!». Пока цель не достигнута, «Продолжить» закрыта |

#### 7.4.2 Задание с вариантами [образец]

```
┌──────────────────────────────────────────┐
│ (Как думаешь?) (Target ЕНТ)  [Lightbulb Подсказка] │ метки слева; справа ИИ-кнопка
│                                          │ rounded-xl bg-ai-soft text-ai px-3 py-1.5
│ Реши уравнение x² − 5x + 6 = 0.          │ text-xl sm:text-2xl font-extrabold
│ Укажи меньший корень.                    │
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │        2        │ │        3        │  │ Option, 2 колонки (все ≤ 14 симв.),
│ └─────────────────┘ └─────────────────┘  │ font-mono text-xl
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │       −2        │ │       −3        │  │
│ └─────────────────┘ └─────────────────┘  │
├──────────────────────────────────────────┤
│ [             Проверить                ] │ success lg; disabled, пока нет выбора
└──────────────────────────────────────────┘
```

- **Метки над заданием:**
  - «Решаем вместе» — у `cloze`;
  - «Как думаешь?» — «предскажи → проверь»;
  - «ЕНТ» / «ҰБТ» — Pill gold с иконкой `Target`;
  - уровень A/B/C ученику не показываем.
- «Подсказка» видна, только пока ученик не ответил.
- **Повтор ошибки:** над заданием плашка `rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong` с `RotateCcw` — «Работа над ошибками».
- **Форматы ЕНТ.** Правила — `docs/ENT_MATH.md`, 3.1; баллы — 0.5; инструкции НЦТ — 4.9. У шага с `ent: true` Pill «ЕНТ».

  | Формат | Шаг | Варианты | Верных | Баллы |
  |---|---|---|---|---|
  | один верный ответ | `choice` | ровно 4 | 1 | 1 |
  | на основе контекста | `choice` с `contextId` | по 4 у каждого из 5 вопросов | 1 | по 1 |
  | один или несколько | `multi` | ровно 6 | от 1 до 3 | до 2 |
  | соответствие | `assign` | 2 пункта × 4 значения | одно на пункт | до 2 |

- **Соответствие** (`assign`) [новое по виду]:

  ```
  │ (Target ЕНТ)                             │
  │ Установи соответствие.                   │ вопрос text-xl font-extrabold
  │ A) Область определения y = √(x − 7)      │ пункт text-[17px] font-bold
  │ ┌──────────────┐ ┌──────────────┐        │ 4 чипа-значения grid-cols-2 gap-2,
  │ │   [7; 12]    │ │   (12; 18)   │        │ стиль Option, font-mono;
  │ └──────────────┘ └──────────────┘        │ выбранный — selected
  │ ┌──────────────┐ ┌──────────────┐        │
  │ │   [7; +∞)    │ │   (−∞; 7]    │        │
  │ └──────────────┘ └──────────────┘        │
  │ B) Множество значений y = …              │ тот же список из 4 значений
  │ (4 чипа так же)                          │
  ```

  - У каждого пункта выбирается одно значение. «Проверить» активна, когда выбраны оба.
  - После проверки: верное значение пункта — correct, ошибочный выбор — wrong, остальные — dim.
- **«Один или несколько»** — `MultiView`: 6 вариантов в 2 колонки, у каждого чекбокс. Подпись над вариантами — инструкция НЦТ `ent.instr.multi` (`docs/ENT_MATH.md`, 4.9). «Проверить» активна, когда выбран хотя бы один.
- **Контекстная группа** (1 текст + 5 вопросов) [новое, на эскизы]:

  ```
  │ ┌ Условие ─────────────── [ChevronUp] ┐  │ Card: текст условия + рисунок
  │ │ Бассейн имеет форму прямоугольного  │  │ (сцена из раздела 11)
  │ │ параллелепипеда…  [схема бассейна]  │  │
  │ └─────────────────────────────────────┘  │
  │ (Target ЕНТ)  Вопрос 2 из 5              │ счётчик text-sm font-bold text-muted
  │ Найди объём воды в бассейне.             │
  │ [ 1 … ]  [ 2 … ]                         │ 4 Option
  │ [ 3 … ]  [ 4 … ]                         │
  ```

  - На телефоне при прокрутке карточка сворачивается в строку «Условие · показать» (`ChevronDown`) и прилипает под шапкой. Тап раскрывает её.
  - Вопросы идут шагами подряд, у каждого своя проверка.
- **Частичный балл** (`multi` и `assign`, 1 балл из 2). В уроке это янтарная панель «Почти!» (`score 0.5`, 7.5). В разборе пробного ЕНТ — `warning` и подпись «1 из 2» (7.15).

#### 7.4.3 Ввод ответа и математическая клавиатура [новое]

```
┌──────────────────────────────────────────┐
│ Реши уравнение 3x − 7 = 11.              │
│ x =                                      │
│ ┌──────────────────────────────────────┐ │ AnswerField h-14 rounded-2xl border-2
│ │ 6|                                   │ │ font-mono text-2xl, фокус border-primary
│ └──────────────────────────────────────┘ │
│ Твой ответ: 6                            │ превью через Tex, text-sm text-muted
│ ┌──────┬──────┬──────┬──────┬──────┐     │ MathKeypad (режим number):
│ │  7   │  8   │  9   │  /   │  ⌫   │     │ grid-cols-5 gap-2, клавиши h-14
│ │  4   │  5   │  6   │  −   │  √   │     │ (h-12 при max-height 700)
│ │  1   │  2   │  3   │  x   │  π   │     │
│ │  ,   │  0   │  (   │  )   │Готово│     │
│ └──────┴──────┴──────┴──────┴──────┘     │
├──────────────────────────────────────────┤
│ [             Проверить                ] │
└──────────────────────────────────────────┘
```

- **Раскладка зависит от режима ответа** — поля `mode` у шага `input` или у пропуска в `cloze`. Плеер передаёт `mode` в `MathKeypad`, клавиши берутся из `KEYS_FOR[mode]` (`docs/ARCHITECTURE.md`, 7). Сетка всегда `grid-cols-5 gap-2` и **4 ряда**, чтобы высота клавиатуры не прыгала между заданиями.
- **`number`** (и `algebra` [план]) — базовая раскладка на макете выше: 20 клавиш из `docs/CONCEPT.md`, 11.
- **`expression`** — `2√3`, `3π/4`, `2^10`, `1 + √2`. От базовой отличается двумя клавишами: `x` → `^`, `,` → `+`. Знак умножения не нужен: `2√3`, `3π`, `2(1 + √2)` парсер понимает без него (`docs/ARCHITECTURE.md`, 6.6). Если ответ — десятичная дробь, автор выбирает режим `number`.

  ```
  7  8  9  /  ⌫
  4  5  6  −  √
  1  2  3  ^  π
  +  0  (  )  Готово
  ```

- **`interval`** — промежутки. Отдельной клавиши `∪` нет: клавиша `;` сразу после `)` или `]` вставляет `∪` и в этот момент подписана `∪`. Клавиши `+` нет, поэтому `∞` без знака парсер понимает как `+∞`.

  ```
  7  8  9  [  ⌫
  4  5  6  −  ]
  1  2  3  ;  ∞
  ,  0  (  )  Готово
  ```

- **`set`** — корни через `;` и `∅`. **`point`** — та же раскладка, но вместо `∅` стоит `π`.

  ```
  7  8  9  /  ⌫
  4  5  6  −  √
  1  2  3  ;  ∅
  ,  0  (  )  Готово
  ```

- **`text`** — обычная системная клавиатура, `MathKeypad` не показывается. Клавиатура графиков — 7.14.
- **Стрелок `←` `→` нет:** каретку ставит тап по полю.
- **Правило для автора:** эталон шага должен набираться на клавишах своего режима. Тест контента это проверяет. Ответ, которого не набрать (например, дробь в промежутке), автор даёт заданием с вариантами.
- **Стиль клавиш** — как у калькулятора образца:

  | Клавиша | Классы |
  |---|---|
  | цифры, «,» | `bg-surface-2 text-text font-mono text-2xl font-bold` |
  | знаки и символы (`/ − + · ^ √ π x ( ) [ ] ; ∞ ∪ ∅`) | `bg-primary-soft text-primary text-2xl font-extrabold` |
  | функции в графиках (`sin cos tg ctg ln lg`) | `bg-primary-soft text-primary text-lg font-extrabold` |
  | служебные: «⌫» (иконка `Delete` 22 px) и «Готово» | `bg-surface-2 text-muted` |

  Общее для всех: `h-14 rounded-2xl active:scale-95`. У «⌫» есть `aria-label` из словаря (`keypad.*`).
- **«Готово»** только сворачивает клавиатуру, как на телефоне, и ничего не проверяет. Раскладка при этом не меняется: она меняется, только когда фокус переходит в поле с другим `mode` (следующий шаг или другой пропуск в `cloze`). Тап по полю открывает клавиатуру снова. Проверяет ответ **только** главная кнопка «Проверить» внизу: на экране одна главная кнопка.
- **Фокус:** клавиши не забирают фокус (`onMouseDown={e => e.preventDefault()}`). Нажатия на клавиатуре не выбирают варианты ответа и не перехватываются как Enter урока.
- **Когда видна:** клавиатура показывается на сенсорных экранах (`(pointer: coarse)`). У поля стоит `inputMode="none"`, чтобы не выскакивала системная клавиатура. **[проверить]** на iPhone. На ПК клавиатуры нет, работает обычная, с заменами: `.` → `,`, `-` → `−`, `sqrt` → `√`, `pi` → `π`. Кириллические «х», «у» из русской раскладки засчитываются как `x`, `y`. Если ученик набрал буквы казахской раскладки (`ә і ң ғ ү ұ қ ө һ` в цифровом ряду), под полем — янтарная подсказка «переключи раскладку», а не красное «неверно» (`docs/ARCHITECTURE.md`, 7). Замена символа не сбивает каретку.
- Тап по клавише звучит `tap` через `feedback("tap")`.
- **Высота:**
  - обычный экран: 4 ряда по 56 px + 3 зазора по 8 px = 248 px;
  - низкий экран (≤ 700 px, например 360×640): клавиши `h-12`, 4 × 48 + 3 × 8 = 216 px, вопросу остаётся около 200 px;
  - если вопрос длинный, «Готово» сворачивает клавиатуру.

#### 7.4.4 Развёрнутое решение `solution` [образец]
Файла в `reference/` нет — описание снято с кода образца.

- **Переключатель** стоит над холстом: сегмент `grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1`. Кнопки `flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-extrabold`: «Решить здесь» (`PenLine` 16) и «Фото из тетради» (`Camera` 16). Активная — `bg-surface text-text shadow-sm`, вторая — `text-muted`.
- **«Решить здесь»** — холст на всю ширину `overflow-hidden rounded-2xl border-2 border-border`. Фон — `var(--surface)` с клеткой 22 px из линий `var(--border)`, у `<canvas>` класс `touch-none`, чтобы палец не прокручивал страницу. Чернила — цвет `text`. Над холстом ряд `flex flex-wrap items-center gap-2`, кнопки `h-10 rounded-xl border-2 px-3 text-sm font-bold`:
  - слева «Ручка» (`Pencil` 16) и «Ластик» (`Eraser` 16) с подписями: выбранная — `border-primary bg-primary-soft text-primary`, другая — `border-border bg-surface text-muted`;
  - справа только иконки с `aria-label`: «Отменить» (`Undo2`) и «Очистить» (`Trash2`). Неактивны, пока холст пуст.
  - Холст не размонтируется при смене вкладки и при проверке, иначе рисунок пропадёт.
- **Цвет чернил и тема** (правила образца `DrawingCanvas`, появились после ревью: «черновик перекрашивается при смене темы»):
  - **Хранение не зависит от темы.** Сохранённый рисунок (`exportImage()`, PNG для черновика) — чернила `#111` на прозрачном фоне, масштаб фиксирован: `EXPORT_SCALE = 2` пикселя на CSS-пиксель, не `devicePixelRatio`. Размер слоя — не меньше сохранённого рисунка, поэтому на узком экране рисунок не обрезается.
  - **На экране** чернила — цвет `--text` (читается из CSS-переменной), сохранённый рисунок перекрашивается в него же. При смене темы холст перерисовывается: `MutationObserver` на атрибут `data-theme` у `<html>` и `matchMedia("(prefers-color-scheme: dark)")` для темы «как в системе».
  - **Для ИИ** (`exportCanvas()`, шаг `solution`) — всегда тёмные чернила `#111` на белом `#fff`, в любой теме. Если отправить «как на экране», в тёмной теме уйдёт белое на белом, и ИИ ответит «не разобрать».
  - Hex `#111` и `#fff` здесь — исключение из 2.5: это данные картинки, а не оформление.
- **«Фото из тетради»** — широкая пунктирная кнопка `flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary-soft px-4 py-6 font-extrabold text-primary` с `ImagePlus` 22 и текстом «Сфотографировать или выбрать фото» (скрытый `<input type="file" accept="image/*">`). После выбора над кнопкой превью `max-h-80 w-full rounded-2xl border-2 border-border object-contain`, текст кнопки — «Заменить фото». Фото сжимается до 1280 px (`src/lib/image.ts`).
- **«Итоговый ответ»** — строка `flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-2`, фокус `border-primary`: подпись `text-sm font-bold text-muted`, поле `font-mono text-xl font-bold`. В Matematika поле работает как `AnswerField` с `MathKeypad` (7.4.3).
- Пока нет ни рисунка, ни фото, ни ответа — подсказка `text-center text-sm text-muted` (`sol.need`).
- **Кнопки внизу:** слева ghost «Пропустить». Главная: есть рисунок или фото — «Проверить с ИИ», вариант `ai`; есть только итоговый ответ — обычная «Проверить» (`success`), ответ проверяет код. Во время проверки кнопка неактивна, на ней «ИИ проверяет решение…».
- **После проверки** вкладки и холст скрываются. Видны присланная картинка (`max-h-56 w-full rounded-2xl border-2 border-border object-contain`) и карточка вердикта `rounded-2xl border-2 p-4 animate-fade-in`. Цвет карточки — по вердикту: верно — `border-success bg-success-soft`, частично — `border-warning bg-warning-soft`, неверно — `border-danger bg-danger-soft`. Внутри:
  - заголовок с `Sparkles` цветом `text-ai` (это сделал ИИ);
  - отзыв `font-semibold`;
  - шаги решения `font-mono text-sm` с `CircleCheck` (success) или `CircleX` (danger);
  - совет `text-sm text-muted` с `Lightbulb` цвета `text-warning-strong`.

  Тот же вердикт красит нижнюю панель (7.5).
- ИИ недоступен — итоговый ответ проверяет код, под карточкой строка `text-center text-sm font-semibold text-warning-strong` (`sol.offline`).

### 7.5 Урок — панель обратной связи [образец]

```
├──────── bg-danger-soft border-danger/30 ──┤ выезжает y 100%→0, spring 420/32
│ [Пи sad 52] (X) Неверно                   │ заголовок text-xl extrabold цветом тона
│             Правильный ответ: 2           │ font-bold; ответ font-mono
│             Корни 2 и 3; меньший — 2.     │ text-[15px] font-semibold opacity-90
│ [Sparkles ИИ]  [       Продолжить       ] │ ai | danger lg (w-full sm:w-56)
└───────────────────────────────────────────┘
```

| Результат | Подложка | Иконка 28 px | Заголовок | Маскот | «Продолжить» |
|---|---|---|---|---|---|
| верно | `bg-success-soft border-success/30` | `Check` на `bg-success` | одна из похвал по кругу: «Отлично!», «Верно!», «Супер!», «Так держать!» | happy | success |
| частично (score > 0) | `bg-warning-soft border-warning/30` | `Minus` на `bg-warning` | «Почти!» | thinking | primary |
| неверно | `bg-danger-soft border-danger/30` | `X` на `bg-danger` | «Неверно» | sad | danger |

**Детали панели:**
- Иконка результата въезжает `scale 0→1, rotate −40→0` (springBouncy, `strokeWidth 3.5`).
- Справа «+N XP» `text-base text-warning-strong` с «попом». Над главной кнопкой всплывает `XpBurst`.
- При ошибке:
  - «Правильный ответ: …» (`font-mono`);
  - бесплатное объяснение автора;
  - слева фиолетовая кнопка «Объясни, ИИ» (на телефоне просто «ИИ»).
- Кнопка у информационных шагов — «Продолжить» primary, у `worked` — «Следующий шаг».

**Защита от двойного тапа.** Ввод блокируется от первого ответа до следующего шага. Автоповтор Enter игнорируется. Это реальный баг образца, `docs/CONCEPT.md`, 10.2.

### 7.6 Панель ИИ (`AiPanel`) [образец]
Образец — `reference/src/components/ai/AiPanel.tsx`.

- Это Modal (`sm:max-w-lg`).
- **Шапка:** маскот thinking 44 px + заголовок `text-lg font-extrabold text-ai` с `Sparkles` 18. Заголовок зависит от режима: «Подсказка», «Спроси Пи» или «Объясни, ИИ».
- **Лента** (`max-h-[52dvh] overflow-y-auto`):
  - вопрос ученика — справа, `rounded-2xl rounded-br-md bg-primary text-white`;
  - ответ ИИ — `rounded-2xl rounded-bl-md border-2 border-ai/25 bg-ai-soft`, внутри Markdown с формулами;
  - под ответом кнопка «В конспект» `text-xs font-extrabold text-ai`, после сохранения — `text-success` и `Check`.
- **Чипы быстрых вопросов:** `rounded-full border-2 border-ai/30 bg-ai-soft px-3 py-1.5 text-sm font-extrabold text-ai`.
- **Поле ввода:** `h-11 rounded-2xl border-2 focus:border-ai`, кнопка отправки 44×44 `bg-ai`.
- **Ошибка или лимит:** плашка `bg-danger-soft text-danger`. На лимит — свой текст, не «ошибка связи».

### 7.7 Итоги `Results` [образец]

```
┌──────────────────────────────────────────┐
│              [Пи celebrate 112]          │ scale 0.6→1, y 20→0, springBouncy
│               Урок пройден!              │ text-3xl extrabold
│            Квадратные уравнения          │ muted
│ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ 3 плитки, лесенка 0.15 + i·0.12 с
│ │▓Zap Опыт▓│ │▓Target ▓ │ │▓Clock  ▓ │   │ шапки bg-gold / bg-success / bg-primary
│ │   +60    │ │   88%    │ │   5:42   │   │ CountUp, text-2xl
│ └──────────┘ └──────────┘ └──────────┘   │
│ ┌ (Badge) НОВОЕ ДОСТИЖЕНИЕ! ───────────┐ │ border-gold bg-gold-soft, звук pop
│ │         Первый шаг                   │ │
│ └──────────────────────────────────────┘ │
│ ┌ [Sparkles] Отзыв наставника ─────────┐ │ border-ai/30 bg-ai-soft rounded-3xl
│ │ Хорошая работа с дискриминантом…     │ │ скелетон bg-ai/15, пока грузится
│ │ (Знак при переносе) (Корни)          │ │ чипы bg-surface text-ai
│ └──────────────────────────────────────┘ │
│ ┌ Темы ────────────────────────────────┐ │ Card; ProgressBar 10, MASTERY_COLOR
│ └──────────────────────────────────────┘ │
│ [BookOpen] Конспект урока сохранён · Открыть │ border-primary/40 bg-primary-soft
│ ┌ Ошибки ──────────────────────────────┐ │ строки rounded-xl bg-surface-2:
│ │ −3 (зачёркнуто, danger) → 2 (mono)   │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│ [             Продолжить               ] │ disabled первые 700 мс
└──────────────────────────────────────────┘
```

**Плитка «Точность»:** число ≥ 80 % — success, ≥ 50 % — `warning-strong`, ниже — danger.

**Конфетти:**
- 90 частиц, `spread 70`, `origin y 0.35`;
- при 100 % ещё два залпа по 40 с боков через 350 мс;
- при «Меньше анимаций» конфетти нет.

**Достижения** выскакивают по одному: задержка `0.9 + i·0.28` с, `scale 0.6→1, rotate −3→0`. Отзыв ИИ появляется через `Reveal` с задержкой 0,5 с.

### 7.8 «Тренировка» `/practice` и сессия `/drill` [образец]

```
┌──────────────────────────────────────────┐
│ Тренировка                               │ text-2xl + подзаголовок muted
│ ┌──────────────────┐ ┌──────────────────┐│ grid gap-3 sm:grid-cols-2
│ │ [Brain 30]       │ │ [RotateCcw]      ││ баннеры: primary / danger,
│ │ Умная тренировка │ │ Работа над       ││ тень 0_5px_0 -strong
│ │ Подберём задания…│ │ ошибками · 4     ││ без ошибок — серый, неактивный
│ └──────────────────┘ └──────────────────┘│
│ Мини-игры                                │
│ ┌─────────────┐ ┌─────────────┐          │ grid-cols-2 gap-3; карточка
│ │ [иконка 48] │ │ [иконка 48] │          │ rounded-3xl border-2 p-3.5;
│ │ Спринт      │ │ Найди ошибку│          │ иконка rounded-2xl цвета игры;
│ │ 2 строки…   │ │ 2 строки…   │          │ описание line-clamp-2 text-xs muted;
│ │ [Trophy] 24 │ │ [Lock] после│          │ закрытая — border-dashed opacity-60
│ └─────────────┘ └─────────────┘          │
│ ┌ - - - - - - - - - - - - - - - - - - -┐ │ «Мини-ЕНТ на время» — пунктир,
│ │ [Timer] Мини-ЕНТ        (Скоро)      │ │ Pill «Скоро», пока режима нет
│ └ - - - - - - - - - - - - - - - - - - -┘ │
│ ┌ Навыки ──────────────────────────────┐ │ Card, divide-y-2
│ │ Степени   • В процессе · 64%  [Тренировать] │ кнопка rounded-xl border-2
│ │ ████████░░░░                         │ │ border-primary/40 bg-primary-soft
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

`/drill` использует тот же плеер урока (без теории), итоги — `Results kind="drill"`. Если заданий нет, экран «Ошибок нет — так держать!» со ссылкой назад.

**Данные** (`docs/CONCEPT.md`, 6.5):
- **«Умная тренировка»** — по навыкам пройденных уроков. Пока их нет, текст «Пройди урок, чтобы открыть тренировку», и баннер ведёт на `/learn`.
- **«Работа над ошибками · N»** — число открытых записей об ошибках в сторе. Ноль — серый неактивный баннер «Ошибок нет — так держать!».
- **Игра открыта**, если открыт хотя бы один её навык (пройден урок с ним). Рекорд — из стора, у темпа «Спокойно» рекорда нет.
- **«Навыки»** — навыки пройденных уроков: точка и подпись — `masteryLevel`, % — `mastery`. У остальных — замок вместо «Тренировать».
- **«Мини-ЕНТ»** — Pill «Скоро», пока режима нет (7.15).

### 7.9 Мини-игра `/game/[id]` (`GameShell`) [образец]

- **Шапка `h-14`:**
  - `X` → `/practice`;
  - иконка игры 20 px цвета `meta.ink` + название `text-lg font-extrabold`;
  - кнопка «Помощники» (зависит от темпа);
  - справа кубок и рекорд `text-sm font-extrabold text-warning-strong`.
- **Вступление:**
  - иконка 80×80 `rounded-[1.75rem] shadow-lg`, название 2xl, описание muted;
  - карточка «Правила» (`whitespace-pre-line`);
  - выбор темпа — 3 карточки `Choice`:
    - «Спокойно» (`Feather`);
    - «Обычный» (`Timer`);
    - «Блиц» (`Zap`);
  - строка «Рекорд: N · Игр: M»;
  - внизу липкая кнопка «Играть» (`Play`, lg).
- **Игра:** поле на всю ширину. Пока грузится — скелетон `h-96 animate-pulse rounded-3xl bg-surface-2`.
- **Итоги:**
  - маскот 100 px (celebrate при рекорде, иначе happy);
  - «Игра окончена» `text-sm uppercase muted`;
  - очки `text-5xl font-black`;
  - плашка «Новый рекорд!» `rounded-full bg-gold-soft text-warning-strong animate-pop` с `Trophy`;
  - плитки «Верно» (рамка success) и XP (рамка gold);
  - кнопки «Ещё раз» (primary, `RotateCcw`) и «К практике» (secondary).
  - При рекорде — конфетти 80 частиц.

Контракт и ТЗ игр — `docs/GAMES.md`.

### 7.10 «Прогресс» `/stats` [образец]

Сверху вниз:
1. Заголовок.
2. 6 плиток (`grid-cols-2 sm:grid-cols-3`):

   | Плитка | Иконка | Цвет | Подпись |
   |---|---|---|---|
   | Всего XP | `Zap` | gold | — |
   | Уровень | `Trophy` | primary | + название уровня |
   | Серия | `Flame` | streak | «Рекорд: N» |
   | Точность | `Target` | success | — |
   | Время | `Clock` | primary | «N ч M мин» |
   | Уроков пройдено | `BookCheck` | primary | — |

3. Card «XP за 7 дней» — `WeekChart`.
4. Card «Освоение тем»: название, точка-статус, %, ProgressBar 10.
5. Card «Последние ошибки» со ссылкой «Работа над ошибками».
6. Card `border-ai/30` «Что ИИ знает обо мне» (`Sparkles`, `text-ai`) с кнопкой «Удалить» (`Trash2`, muted → danger).

Пустое состояние — «Пока нет данных — пройди первый урок» (muted).

**Данные** (`docs/CONCEPT.md`, 6.10):
- XP, серия и рекорд — из стора; уровень и его название — `levelInfo(xp)` (`src/lib/gamification.ts`).
- Точность — все верные / все ответы за всё время; данных нет — «—».
- Время — сумма секунд сессий, одна сессия — не больше 2 часов.
- `WeekChart` — `days[дата].xp` за 7 дней, линия цели — `profile.dailyGoalXp`.
- «Освоение тем» — все навыки со статистикой; «Последние ошибки» — до 6 последних, карточки нет, если ошибок нет.
- «Что ИИ знает обо мне» — `memory` из стора; пусто — подсказка, что память появится после уроков.

### 7.11 «Конспекты» `/notes`, `/notes/[id]` [образец]

**`/notes`:**
- карточка «Общие заметки»: `rounded-3xl border-2 border-ai/30 bg-ai-soft p-4 text-ai`, иконка `MessageSquareText` 26, счётчик в круге `bg-ai text-white`, справа `ChevronRight`;
- ниже по разделам:
  - метка раздела `text-sm font-extrabold uppercase` цвета раздела;
  - строки-ссылки с иконкой `NotebookPen` цвета раздела;
  - закрытые строки — пунктир и замок;
  - справа бейдж «+N».

**`/notes/[id]`:**
- конспект урока — Markdown с формулами; «Лайфхак для ЕНТ» оформлен как `blockquote`;
- «Мои заметки» — textarea `rounded-2xl border-2`, метка «Сохранено»;
- «Сохранённые ответы ИИ» — карточки `border-ai/30`;
- кнопка «Спросить ИИ по теме» — вариант `ai`.

### 7.12 «ИИ-помощник» `/tutor` [образец]

```
┌──────────────────────────────────────────┐
│ [Sparkles] ИИ-помощник Пи      [Trash Очистить] │ text-2xl extrabold text-ai
│ Спроси что угодно по математике          │ muted
│                                          │
│            ┌──────────────────────────┐  │ ученик: справа, max-w-[85%]
│            │ Как решать x² − 4 = 0?   │  │ rounded-2xl rounded-br-md bg-primary
│            └──────────────────────────┘  │ text-white font-semibold
│ ┌──────────────────────────────┐         │ Пи: слева, max-w-[92%]
│ │ Перенеси 4 вправо: x² = 4…   │         │ border-2 border-ai/20 bg-surface,
│ │ [BookmarkPlus В конспект]    │         │ Markdown + KaTeX
│ └──────────────────────────────┘         │
│ ┌──────────────────────────────────────┐ │ форма: sticky bottom-20 lg:bottom-4
│ │ [ImagePlus] [ Сообщение…      ] [Send]│ │ rounded-3xl border-2 bg-surface p-2
│ └──────────────────────────────────────┘ │ shadow-lg; Send 44×44 bg-ai
└──────────────────────────────────────────┘
```

- **Пустое состояние:**
  - маскот happy 96 px по центру;
  - приветствие;
  - 4 чипа `rounded-2xl border-2 border-ai/30 bg-ai-soft px-3.5 py-2 text-sm font-bold text-ai`. Тексты — в `docs/CONCEPT.md`, 6.7.
- **Во время ответа:**
  - текст печатается по мере генерации;
  - пока текста нет — «…» `animate-pulse text-ai`;
  - кнопка отправки меняется на «Стоп» (`Square`).
- Textarea растёт до `max-h-40`. Enter — отправить, Shift+Enter — новая строка.

### 7.13 Профиль `/profile` [образец]

Сверху вниз:
1. Аватар 64 + имя-инпут (`text-2xl font-extrabold`, прозрачный, при фокусе `bg-surface-2`) + подпись «Данные хранятся на этом устройстве».
2. `LevelCard`.
3. Card «Достижения» (`grid-cols-2 sm:grid-cols-3 gap-2`):
   - получено — `border-gold bg-gold-soft`;
   - нет — `opacity-70`.
4. Card настроек (`divide-y-2`). Каждая строка — подпись `font-extrabold` + подсказка + `Segmented`. Строки: Язык, Класс, Цель, Стиль объяснений, Цель на день, Тема (Как в системе / Светлая / Тёмная), Звуки, Вибрация, Меньше анимаций.
5. Кнопки «Скачать мои данные» (secondary, `Download`) и «Сбросить прогресс» (ghost, красный, `RotateCcw`). Сброс подтверждается модалкой: кнопки danger и «Отмена».

**Данные** (`docs/CONCEPT.md`, 6.11): каждая строка настроек — поле `profile`, меняется через `updateProfile(p)` и применяется сразу (тема и язык — через `Providers`). `LevelCard` — `useLevel()` и `useStreak()`. «Скачать мои данные» — JSON всего состояния (`matematika-progress.json`). «Сбросить прогресс» — `resetProgress()`, затем `/onboarding`.

### 7.14 «Помощники» — панель инструментов [каркас — образец, вкладки — новые]

Каркас — Toolbox образца:
- **один на всё приложение:** `Toolbox` рисует `Providers`, открывает его `ToolboxButton` (6.4). Корень панели помечен `data-toolbox`: горячие клавиши урока и игр пропускают события оттуда;
- **телефон:** шторка `h-[min(40rem,90dvh)] rounded-t-3xl border-t-2 bg-surface shadow-2xl`, spring 420/38, под ней затемнение `bg-black/40` (тап закрывает). «Ручка» `h-1.5 w-10 rounded-full bg-border`. Шторка идёт за пальцем; отпустили ниже 90 px — закрылась, выше — вернулась на место;
- **десктоп:** панель справа `w-[400px] h-dvh border-l-2`, без затемнения;
- **шапка:** иконка вкладки (primary) + название `text-lg font-extrabold` + «закрыть» 40×40;
- **вкладки:** сегмент `rounded-2xl bg-surface-2 p-1`, кнопки `h-11 rounded-xl`, активная `bg-primary-soft text-primary`. Подписи видны, только если вкладок ≤ 2, иначе только иконки с `aria-label`;
- **режим `ent`:** под вкладками подсказка `text-xs font-bold text-muted` с `Info`: «Как на ЕНТ: только калькулятор и черновик»;
- **фокус:** на телефоне Tab ходит по кругу только по видимым элементам панели (свой обработчик, без библиотек); закрытая панель получает `inert`; при закрытии фокус возвращается на кнопку, которой панель открыли; Esc закрывает только панель, не урок;
- **вкладки** грузятся `dynamic()` при первом открытии и потом не размонтируются: набранное в калькуляторе и черновике переживает закрытие панели.

| Вкладка | Иконка | Вид |
|---|---|---|
| Калькулятор [образец + ряд] | `Calculator` | дисплей `rounded-2xl bg-surface-2 px-4 py-3 text-right`: выражение `font-mono text-base text-muted`, результат `font-mono font-bold` (36/24/20 px). Сетка `grid-cols-4 gap-2`, клавиши `h-14 rounded-2xl font-mono text-2xl font-bold active:scale-95`. Раскладка образца: `C ( ) ÷` / `7 8 9 ×` / `4 5 6 −` / `1 2 3 +` / `⌫ 0 , =`. Типы клавиш: цифры `bg-surface-2`, операции `bg-primary-soft text-primary text-3xl`, функции `bg-surface-2 text-muted`, «=» `bg-primary text-white`. В режиме `full` над цифрами ряд `√ xⁿ π %` в стиле операций, в `ent` его нет. Состав `ent` — **[проверить]**: возможности калькулятора ЕНТ официально не описаны, считаем его простым (`docs/ENT_MATH.md`, 0.2). Если в нём есть `√` или `%`, ряд включается и в `ent` |
| Формулы [новое] | `Sigma` | поиск `h-11 rounded-2xl border-2` + разделы-аккордеоны (заголовок `font-extrabold`, `ChevronDown`). Формула — строка `rounded-2xl bg-surface-2 px-4 py-3`: подпись `text-sm font-bold text-muted` + `Tex display`. Длинная формула прокручивается вбок |
| Графики [новое] | `ChartSpline` | до 3 строк ввода `y₁ = [x² − 4]`: слева цветная точка `plot-N`, справа крестик. Под ними плоскость `CoordPlane` (11.3), квадрат на всю ширину. Кнопки масштаба `ZoomIn`/`ZoomOut` и «по центру» `LocateFixed` — 40×40 secondary в углу. По тапу на график — точка и плашка с координатами «(1,5; −1,75)» `font-mono`. Ввод и ошибки — ниже, «Ввод функции» |
| Черновик [образец] | `PenLine` | лист «в клетку» (линии `border`), перо (`text`) и ластик. 3 листа — вкладки «Лист 1–3». «Очистить» срабатывает со второго нажатия (первое красит кнопку в `danger`). Автосохранение в IndexedDB. Координаты хранятся независимо от размера экрана |

Что видно на каждом уровне `ToolLevel`:

| Уровень | Вкладки |
|---|---|
| `full` | калькулятор с рядом `√ xⁿ π %`, формулы, графики, черновик |
| `ent` | только обычный калькулятор и черновик (на ЕНТ по математике справочника формул нет, `docs/ENT_MATH.md`, 0.2) |
| `off` | кнопки «Помощники» нет |

Какой уровень на каком экране (уровень задаёт экран через `useToolboxLevel`, при уходе с экрана снова `full`; `docs/ARCHITECTURE.md`, 15):

| Экран | Уровень |
|---|---|
| меню, уроки (и задания ЕНТ-формата внутри урока), тренировка | `full` |
| мини-игра: вступление и итоги | `full` |
| мини-игра во время игры: «Спокойно» / «Обычный» / «Блиц» | `full` / `ent` / `off` |
| режим «как на ЕНТ», мини-ЕНТ, пробный ЕНТ [план] | `ent` |
| онбординг | кнопки нет: экран без оболочки и без `ToolboxButton` |

**Ввод функции во вкладке «Графики»** [новое]:
- Строка: слева точка `plot-N` и подпись `y₁ =` `font-mono font-bold`, поле `h-11 flex-1 rounded-2xl border-2 px-3 font-mono text-lg`, фокус `border-primary`, справа «удалить строку» `X` 40×40 ghost. Кнопка «+ функция» (`Plus`, secondary sm) — пока строк меньше 3.
- Синтаксис — тот же парсер, что у проверки ответов (`docs/ARCHITECTURE.md`, 6.6; график — `src/lib/math/graph.ts`). Принимается: `x^2` и `x²`, `2x` без знака умножения, `sqrt(x)` и `√x`, `sin(x)`, `tg(x)` (и `tan(x)`), `ln(x)`, `lg(x)`, `|x|`, запятая и точка в числах. Функции пишутся со скобками.
- На телефоне у поля `inputMode="none"` и своя клавиатура в стиле 7.4.3. Пока поле в фокусе, клавиатура стоит **на месте плоскости**: 5 колонок × 6 рядов по 48 px (`h-12`) = 328 px, как сама плоскость. «Готово» сворачивает её и показывает плоскость с новым графиком. Клавиша функции вставляет имя со скобкой (`sin(`), `|x|` — пару `||` с кареткой внутри:

  ```
  7    8    9    +    ⌫
  4    5    6    −    ^
  1    2    3    ·    /
  0    ,    x    (    )
  π    √    |x|  sin  cos
  tg   ctg  ln   lg   Готово
  ```

- График перерисовывается через 300 мс после последнего нажатия. Пока строка не разбирается, её график не рисуется, а под строкой янтарная подсказка `rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong`: «Не получается прочитать формулу. Пример: x^2 − 4x + 3» (ключ `graph.error`, kk — через `npm run review:kk`). Янтарный, а не красный: это ошибка записи, а не неверный ответ, как подсказка формата в уроке (`docs/ARCHITECTURE.md`, 5).

### 7.15 Режим «как на ЕНТ», мини-ЕНТ, пробный ЕНТ [новое — сначала эскизы владельцу]

В образце этих экранов ещё нет. Ниже — рамка, в которой рисуем эскизы.

```
┌──────────────────────────────────────────┐
│ [X]  Вопрос 12 / 40   [Timer 41:20] [Calc]│ шапка h-14; таймер font-mono muted,
├──────────────────────────────────────────┤ последние 5 мин — text-warning-strong
│ (Target ҰБТ) Один или несколько          │ Pill gold + тип задания
│ Сізге бір немесе бірнеше дұрыс жауабы…   │ инструкция НЦТ (ENT_MATH 4.9): text-sm muted
│ Условие задания…                         │
│ [ ] A …          [ ] B …                 │ MultiView, 6 вариантов
│ [ ] C …          [ ] D …                 │
│ [ ] E …          [ ] F …                 │
├──────────────────────────────────────────┤
│ [<  Назад]  [Grid]  [     Далее      >]  │ secondary | навигатор | primary
└──────────────────────────────────────────┘
```

- **Цвета:**
  - фиолетового и ИИ на экране нет;
  - маскот только на старте и на итогах;
  - после ответа нет зелёного и красного: на экзамене правильность не показывают.
- **Навигатор** (`Grid`) — Modal с сеткой номеров `grid-cols-5 gap-2`, ячейки 48 px `rounded-xl border-2`:

  | Ячейка | Классы |
  |---|---|
  | без ответа | `bg-surface border-border` |
  | отвечено | `bg-primary-soft border-primary text-primary` |
  | текущая | `ring-4 ring-primary/25` |

- **Итоги:**
  - балл из 50 (или 10) крупно, `text-5xl font-black`;
  - разбор по номерам: верно `success`, частично (1 из 2) `warning`, неверно `danger`;
  - после разбора можно открыть ИИ-объяснение.
- **«Помощники»** работают на уровне `ent`.

### 7.16 Пустые состояния и ошибки [образец]

| Ситуация | Как выглядит |
|---|---|
| Нет данных | маскот neutral 72 + строка muted + кнопка-действие («Пройди первый урок») |
| Ошибка запроса ИИ | плашка `rounded-xl bg-danger-soft text-danger text-sm font-bold`, попытка возвращается |
| Лимит ИИ исчерпан | плашка `warning`: «Лимит вопросов к ИИ на сегодня исчерпан. Возвращайся завтра!» |
| Нет ключа OpenAI | ИИ-кнопки показывают статический текст, интерфейс без ошибок |
| Урок «в разработке» | замок, пунктир, в модалке иконка `Hammer` и «Скоро» |

---

## 8. Анимации [образец]

### 8.1 Библиотека и правила
- Используется `motion` в облегчённом режиме: `LazyMotion features={domAnimation}`, везде `m.*`, а не `motion.*`. Подключается в `MotionProvider` в корне. Образец — `reference/src/components/motion/MotionProvider.tsx`.
- `MotionConfig reducedMotion = profile.reduceMotion ? "always" : "user"`.
- Быстро и пружинисто: отклик ≤ 400 мс, без долгого раскачивания. Анимируем только `transform` и `opacity`.

### 8.2 Пресеты (`src/components/motion/presets.ts`)

| Имя | Значение | Для чего |
|---|---|---|
| `springSnappy` | spring stiffness 520, damping 32 | нажатия, переключатели |
| `springSoft` | spring 340 / 28 | появление панелей и карточек |
| `springBouncy` | spring 460 / 17 | награды, «поп» с перелётом |
| `easeOut` | cubic-bezier `[0.22, 1, 0.36, 1]` | переходы между шагами и страницами |

### 8.3 CSS-анимации (из `globals.css`)

| Класс | Длительность | Что делает | Где |
|---|---|---|---|
| `animate-pop` | 0,25 с | scale 0.9 → 1.04 → 1 + opacity | плашка, цифра |
| `animate-shake` | 0,4 с | translateX 0, −6, 6, −4, 4, 0 | ошибка |
| `animate-slide-up` | 0,25 с | translateY 100 % → 0 | снизу |
| `animate-fade-in` | 0,3 с | opacity + translateY 6 → 0 | смена шага онбординга, ответ ИИ |
| `animate-pulse-ring` | 1,8 с, бесконечно | кольцо 0 → 14 px цвета primary | доступный узел карты |
| `animate-rise-in` | 0,28 с | opacity + `translate` 10 px → 0 (не `transform`, чтобы не спорить с motion) | лесенка вариантов |
| `animate-ring-out` | 0,5 с | кольцо opacity 0.9 → 0, scale 1 → 1.09 | верный вариант |
| `animate-pulse` | Tailwind | мерцание | скелетоны, заставка |

### 8.4 Компоненты движения (`src/components/motion/*`, образцы в `reference/src/components/motion/`)

| Компонент | Что делает |
|---|---|
| `Reveal({delay})` | появление `opacity 0→1, y 18→0`, springSoft; задержка — для лесенки |
| `Shake({active, strength=7})` | один раз `x [0,−s,s,−0.6s,0.6s,0]`, 0,36 с. В образце — при ошибке в интерактивах |
| `XpBurst({id, amount, delay})` | плашка `Zap` + «+N» (`border-2 border-gold bg-gold-soft text-warning-strong`), взлетает вверх и гаснет за 0,95 с. Повторяется при новом `id` |
| `CountUp({value, from, delay, format})` | число «накручивается» пружиной (110/20, mass 0.8). При «Меньше анимаций» сразу показывает значение |
| `ComboFlame({combo})` | огонёк в шапке урока. От 2 — цвет `streak`; от 3 — scale 1.08 и пульс; от 5 — 1.18 и свечение; от 7 — 1.3 и пульс 0,55 с. На порогах 3/5/7 от огонька расходится кольцо. Число при росте «прыгает» |
| `XpChipAnimated`, `StreakChipAnimated` | рост XP и серии в шапке после урока: XP подпрыгивает, огонёк качается. Помнит, что ученик уже видел |
| `useReduceMotion()` | true, если включена «Меньше анимаций» или системная настройка |

### 8.5 Каталог таймингов

| Что | Анимация |
|---|---|
| Смена страницы | opacity 0→1, y 8→0, 0,22 с |
| Смена шага урока | x 24→0, opacity, 0,25 с, `easeOut` |
| Нижняя панель ответа | подложка y 100 %→0 spring 420/32 (уходит за 0,18 с); содержимое opacity, y 14→0 springSoft с задержкой 0,04 |
| Иконка результата | scale 0→1, rotate −40→0, springBouncy, задержка 0,06 |
| «+N XP» на панели | scale 0.5→1, задержка 0,14 |
| Плитки итогов | лесенка `0.15 + i·0.12` с, y 28→0, scale 0.85→1, springBouncy |
| Достижения на итогах | `0.9 + i·0.28` с, scale 0.6→1, rotate −3→0 |
| Кнопка «Продолжить» на итогах | неактивна 700 мс |
| Modal | телефон spring 380/34; десктоп spring 420/28 |
| «Помощники» | spring 420/38 |
| ProgressBar | spring 150/22 + блик 0,7 с |
| Схемы [новое] | точка «прилипает» к делению springSnappy; новый элемент графика рисуется `pathLength 0→1` за ≤ 0,4 с; подпись появляется `animate-pop` |

### 8.6 «Меньше анимаций»
Работают две ступени:
- системная настройка `prefers-reduced-motion: reduce`;
- переключатель в профиле. Он ставит `data-reduce-motion="true"` на `<html>` (ставит `Providers`).

Как гасятся анимации:
- CSS гасят оба правила из блока 2.2;
- JS-анимации гасит `MotionConfig` и `useReduceMotion`;
- конфетти не запускается.

### 8.7 Конфетти
Библиотека `canvas-confetti`, подключается динамическим импортом. Параметры — в 7.7 и 7.9, цвета — в 2.5.

---

## 9. Звук и вибрация [образец]

### 9.1 Звуки — `src/lib/sound.ts` (образец `reference/src/lib/sound.ts`)

**Устройство:**
- Только Web Audio, **без аудиофайлов**.
- Один `AudioContext` на приложение (`latencyHint: "interactive"`), создаётся лениво.
- «Разблокировка» звука — на первом `pointerdown` / `touchend` / `keydown` / `click`.
- Цепочка: голоса → мастер-громкость **0,15** → компрессор (threshold −16 dB, knee 18, ratio 4, attack 0.003, release 0.2) → выход.
- Ошибки звука глушатся.

Ноты: C5 523,25 · E5 659,25 · G5 783,99 · A5 880 · C6 1046,5 · E6 1318,5 · G6 1568 · C7 2093.

| Звук | Когда | Как звучит |
|---|---|---|
| `tap` | тап по варианту, клавише матклавиатуры | тихий щелчок 700→430 Гц, 0,04 с |
| `correct` | верный ответ | двойной звон A5 → E6 |
| `wrong` | неверный ответ | мягкий «бонк» 240→150 Гц, без дребезга |
| `combo` | верный при комбо ≥ 3 | взлетающая искра, чем больше комбо — тем выше и длиннее |
| `xp` | получен XP (через 180 мс после ответа) | «монетка» E6 + 1760 Гц |
| `complete` | урок, тренировка или игра завершены | арпеджио C5-E5-G5-C6 + аккорд |
| `levelUp` | новый уровень (вместо `xp` / `complete`) | бас + арпеджио + большой аккорд |
| `pop` | достижение на итогах | «пузырёк» 320→760 Гц |

### 9.2 Единая точка отклика — `src/lib/feedback.ts` (образец `reference/src/lib/feedback.ts`)
`feedback(kind, {combo?})` включает звук (если `profile.sound`) и вибрацию (если `profile.vibration` и есть `navigator.vibrate`). **Компоненты не вызывают звук и вибрацию напрямую.**

| Событие | Вибрация, мс (вибро, пауза, вибро…) |
|---|---|
| `correct` | `[12]` |
| `wrong` | `[40, 60, 40]` |
| `combo` | `[10, 30, 10]` |
| `complete` | `[20, 40, 20, 40, 60]` |
| `levelUp` | `[30, 50, 30, 50, 90]` |
| `tap`, `xp`, `pop` | без вибрации |

Звук и вибрация по умолчанию включены, выключаются в профиле. На iPhone вибрации для сайтов нет. На реальном телефоне в образце звук не проверяли — **[проверить]** в новом проекте.

---

## 10. Маскот «Пи» [новое по образцу «Бита»]

### 10.1 Идея
«Пи» — родственник «Бита»: тот же робот, те же пропорции, цвета, настроения и анимации. Отличие одно: вместо антенны-шарика у него **антенна в форме буквы π**. Это золотая «перекладина» с завитком и две синие «ножки», правая чуть изогнута, как в рукописной π. Силуэт сразу читается как π даже в 34 px (проверено рендером). Образец кода — `reference/src/components/mascot/Mascot.tsx`. Файл в проекте — `src/components/mascot/Mascot.tsx`.

### 10.2 Геометрия
Один SVG, `viewBox="0 0 120 120"`. Цвета — фиксированные hex, не токены: персонаж одинаков в обеих темах.

| Часть | Форма | Цвет |
|---|---|---|
| ножки антенны π | левая `M51 13 v14`, правая `M69 13 q0 9 4 14`; stroke 6, round | `#1277b3` |
| перекладина π | `M38 15 q2 -6 9 -6 h29 q4 0 6 -3`; stroke 7, round cap и join, без заливки | `#f0b400`; при `sad` — `#9aa6b8` |
| «уши» | два rect 12×24 rx 6 в (9, 54) и (99, 54) | `#1277b3` |
| тело | rect x 17, y 26, 86×78, rx 28 | `#1a91d6` |
| блик | rect (25, 30) 70×16 rx 8 | `#fff`, opacity 0.18 |
| экран-лицо | rect (28, 42) 64×50 rx 17 | `#10263d` |
| глаза и рот | по настроению (10.3) | `#7fe3ff` |
| щёчки | круги r 4 в (35, 80) и (85, 80) | `#ff8fb1`, opacity 0.55 |

Готовый кусок вместо антенны «Бита». Всё остальное в `Mascot.tsx` образца остаётся как есть, плюс `aria-label="Пи"`:

```tsx
<g className="mascot-antenna">
  <path d="M51 13 v14" stroke="#1277b3" strokeWidth="6" strokeLinecap="round" />
  <path d="M69 13 q0 9 4 14" stroke="#1277b3" strokeWidth="6" strokeLinecap="round" fill="none" />
  <path
    d="M38 15 q2 -6 9 -6 h29 q4 0 6 -3"
    stroke={mood === "sad" ? "#9aa6b8" : "#f0b400"}
    strokeWidth="7"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
</g>
```

Ножки стоят на плоской части макушки: тело от x 45 до x 75 при y = 26. Поэтому центр покачивания `.mascot-antenna` (`transform-origin: 60px 27px`) менять не нужно.

### 10.3 Настроения (`Mood = happy | neutral | thinking | sad | celebrate`)

| Настроение | Глаза | Рот | Реакция при смене |
|---|---|---|---|
| neutral | два круга r 5.5 в (46, 62) и (74, 62) | улыбка `M50 75 q10 9 20 0` | — |
| happy | дуги «^^» `M39 64 q7 -9 14 0`, `M67 64 q7 -9 14 0`, stroke 5 | улыбка | прыжок `y [0,−9,0,−3,0]`, 0,5 с |
| celebrate | те же дуги | открытый закрашенный рот `M48 74 q12 14 24 0 z` | двойной прыжок `y [0,−16,0,−9,0,−3,0]`, `rotate [0,−7,7,−4,0]`, `scale [1,1.1,1]`, 0,9 с |
| thinking | один круг r 5 в (46, 62) + «щёлка» rect 13×4.5 в (68, 60) | черта `M52 78 h14` | наклон `rotate 5`, spring 220/14 |
| sad | круги r 4.5 в (46, 64) и (74, 64) + «брови» `M38 55 l12 4`, `M82 55 l-12 4` | дуга вниз `M50 80 q10 -7 20 0` | `y 2, rotate −3, scaleY 0.96`, spring 160/16; перекладина π серая |

**Постоянная «жизнь»** — это CSS из блока 2.2:
- тело «дышит» (`mascot-body`, 3,8 с, ±2,5 px);
- антенна покачивается (`mascot-antenna`, 4,6 с, ±5°);
- глаза моргают (`mascot-eyes`, 4,5 с).

У каждого маскота на экране своя фаза моргания: задержка считается из хэша `useId()`, поэтому они не моргают хором. Реакции — через motion `variants` по `mood`, `transform-origin: 50% 90%`, `overflow-visible`, `role="img"`.

### 10.4 Где появляется и какого размера

| Место | Размер | Настроение |
|---|---|---|
| Заставка загрузки | 88 | neutral + `animate-pulse` |
| Логотип в шапке и меню | 34 | happy |
| Онбординг | 88 | happy / thinking по шагу |
| Главная `/learn` | 72 | happy |
| Нижняя панель ответа | 52 | happy / thinking / sad |
| Модалка выхода | 72 | sad |
| Панель ИИ | 44 | thinking |
| Итоги урока | 112 | celebrate |
| Итоги игры | 100 | celebrate при рекорде, иначе happy; «побей рекорд» — 56 |
| Чат `/tutor`, пустой | 96 | happy |

### 10.5 Иконка приложения [по образцу]

- **`public/icons/icon.svg`** — квадрат 120×120 `rx 28` с фоном `#e4f3fc`. Внутри маскот happy с `transform="translate(6 8) scale(0.9)"`, как в образце: внутри иконки нет CSS-анимации, поэтому глаза-дуги и улыбка нарисованы статично.
- **PNG** из неё:

  | Файл | Размер |
  |---|---|
  | `icon-192.png` | 192×192 |
  | `icon-512.png` | 512×512 |
  | `icon-maskable-512.png` | 512×512, маскот с полями ~10 % |
  | `apple-touch-icon.png` | 180×180 |

  Как именно образец получал PNG, в репозитории не записано. В Matematika их делает скрипт `scripts/icons.mts` (П-1.3): открывает `icon.svg` в Playwright-Chromium и снимает скриншоты нужных размеров; PNG коммитятся. Это единственные PNG в проекте.
- **`src/app/manifest.ts`:**
  - `name: "Matematika — математика к ЕНТ"`, `short_name: "Matematika"`;
  - `start_url: "/learn"`, `display: "standalone"`;
  - `background_color: "#f6f7fb"`, `theme_color: "#1a91d6"`;
  - `lang: "ru"`.

  Образец — `reference/src/app/manifest.ts`.
- **`viewport.themeColor`** в `layout.tsx`: `#f6f7fb` для светлой темы и `#0f1420` для тёмной.

---

## 11. Иллюстрации и сцены для математики [новое, по принципам образца]

### 11.1 Общие правила
- **Всё — React/SVG**, без картинок. Картинки-«крючки» к ситуациям (OpenAI Images, `webp`) из плана образца — по умолчанию нет; можно только по «ок» владельца и на условиях `docs/DECISIONS.md`, #34. Файлы:
  - сцены — `src/components/scenes/`;
  - кирпичики — `src/components/scenes/primitives.tsx`.
- **Числа и координаты на схеме считает код.** Сцена получает данные пропсами, например `{ a: 1, b: -5, c: 6 }`, и сама вычисляет корни, вершину и деления, используя ту же логику, что `src/lib/math/`. Подписывать «на глаз» нельзя.
- **Подложка сцены** (`SceneView`; в образце — рамка `Visual`): `rounded-3xl bg-surface-2/60 px-4 py-5` [образец].
- **Размеры:**
  - `viewBox` по ширине примерно равен реальной ширине на телефоне (около 320), тогда `fontSize 14` в SVG выглядит как 14 px;
  - ширина `w-full`, на десктопе `max-w-[420px] mx-auto`.
- **Цвета** — только токены через классы Tailwind на SVG: `stroke-text`, `fill-primary-soft`, `stroke-plot-2`. Роли — в таблице 2.7. Тогда тёмная тема работает сама.
- **Шрифт подписей:**
  - числа — `font-mono font-bold`;
  - буквы-обозначения (A, B, x, α) — `font-sans font-extrabold italic` для переменных.
  - Подписи не перекрывают линии: под подписью подложка `fill-surface` со скруглением.
- **Линии:**
  - основные — 2–2,5 px, `strokeLinecap="round"`;
  - сетка — 1 px;
  - вспомогательные — пунктир `6 4`;
  - невидимые рёбра — `5 4`, `muted`.
- **Интерактив:**
  - зона касания точки r = 22;
  - перетаскивание через `pointer`-события, точка «прилипает» к делениям;
  - клавиатура: Tab — к точке, стрелки — двигать;
  - для экранного чтения `role="slider"` с `aria-valuetext` («x = 2,5»).
- **Доступность.** У статичной схемы `role="img"` и `aria-label` на языке ученика через `t()` или `l()`, например «Числовая прямая, отмечен промежуток от −2 до 3».
- **Анимация** — пружины ≤ 400 мс на элемент:
  - линия графика рисуется `pathLength 0→1`;
  - новые подписи — `animate-pop`;
  - смена значения — `springSnappy`;
  - при «Меньше анимаций» всё появляется сразу.
- **Иллюстрация — помощник, а не украшение.** В теории одна схема на шаг, рядом с текстом, который её объясняет.

### 11.2 Числовая прямая `NumberLine`

```
      ○━━━━━━━━━━━━━━━━━━━━━●
──┼────┼────┼────┼────┼────┼────┼────┼──> x
 −3   −2   −1    0    1    2    3    4
```

- **Ось:** линия `stroke-text` 2 px со стрелкой вправо. Засечки через шаг (1 или 0,5): высота 8, `stroke-muted`. Подписи под засечками — `font-mono text-sm fill-muted`. Ноль подписан всегда.
- **Точки:**

  | Точка | Вид | Пример |
  |---|---|---|
  | включённая | закрашенный круг r 6 | `[` |
  | выколотая | круг r 6, `fill-surface`, обводка 2,5 | `(` |

  Цвет точки — по роли (2.7). Выбранная учеником — `primary`.
- **Промежуток:** полоса над осью высотой 6 `rounded-full` или штриховка — как в школьных учебниках **[проверить]**, какой вид привычнее. Цвет: `primary` — пока ученик выбирает, `success` / `danger` — после проверки. Бесконечность — полоса до края со стрелкой.
- **Интерактив:** тап по прямой ставит точку, перетаскивание двигает её. Тап по точке переключает «включена / выколота». Подпись промежутка `(−2; 3]` обновляется под схемой через `Tex`.

### 11.3 Координатная плоскость и графики `CoordPlane`, `FunctionGraph`

- **Плоскость:**
  - квадрат `aspect-square`;
  - сетка `stroke-border` 1 px;
  - оси `stroke-text` 2 px со стрелками;
  - подписи `x`, `y`, `O` и единичные деления `font-mono text-xs fill-muted`.
- **Точка:** `fill-primary` r 6 с подписью `A(2; −1)`. Координаты — через «;».
- **График:** `stroke-plot-N` 3 px, round.
  - Ключевые точки (вершина, корни, пересечения) — круги `fill-surface` с обводкой цвета графика.
  - Подпись формулы стоит у правого конца линии.
- **Площадь под графиком или криволинейная трапеция:** заливка `fill-primary/20`, границы — пунктиром.
- **Разрыв и асимптота:** пунктир `stroke-muted`. График строится по точкам **с разрывами**, без соединения через асимптоту — проверить тестом на `y = 1/x`.
- **Песочница «параметры»:**
  - `Slider` для a, b, c под плоскостью;
  - график меняется вслед за ползунком;
  - формула над плоскостью обновляется: `y = 1,5x² − 2x + 1`.

### 11.4 Дроби: «пицца» и полоска `FractionPie`, `FractionBar`

```
   ╭───┬───╮        ┌────┬────┬────┬────┐
   │███│███│        │████│████│████│    │   ¾
   ├───┼───┤        └────┴────┴────┴────┘
   │███│   │
   ╰───┴───╯
```

- **Круг** делится на n секторов: закрашенные `fill-primary`, пустые `fill-surface-2`. Между секторами просвет 2 px — обводка `stroke-surface`. Внешний контур `stroke-text` 2 px.
- **Полоска** — то же, прямоугольником с `rx 8`.
- **Смешанное число** — несколько кругов в ряд.
- **Сравнение двух дробей** — две полоски одна под другой, одной длины.
- **Анимация «дробь = дробь»:** сектора делятся пополам пружиной, закрашенная площадь не меняется.
- Подпись дроби — `Tex` (`\frac{3}{4}`) или Unicode `¾`.

### 11.5 Единичная окружность `UnitCircle`
- Окружность `stroke-text` 2 px, оси и сетка — как в 11.3.
- Радиус к точке — `stroke-primary`, дуга угла — `stroke-primary` с подписью `α`.
- Проекции:
  - на ось x — `cos α`, `stroke-plot-3` пунктир;
  - на ось y — `sin α`, `stroke-plot-2` пунктир;
  - подписи — того же цвета.
- Точку на окружности можно тянуть пальцем. Она прилипает к «табличным» углам 0, π/6, π/4, π/3, π/2, …
- Под схемой — значения `sin α = ½`, `cos α = √3/2`.
- Линия тангенсов — по желанию, `stroke-muted`.

### 11.6 Планиметрия `Shape`
- Фигура: контур `stroke-text` 2,5, заливка `fill-primary-soft`.
- Вершины подписаны заглавными курсивными буквами снаружи фигуры.
- Известные длины — `font-mono` у середины стороны. Искомая величина — `x` или `?` цвета `primary`, жирно.
- Обозначения:
  - прямой угол — квадратик 10×10;
  - равные стороны — одинаковые засечки;
  - равные углы — одинаковое число дуг;
  - высота, медиана, биссектриса — пунктир `muted`; выделенный элемент — `primary`.
- Вписанная или описанная окружность — `stroke-plot-3`.
- Векторы — стрелка `primary` с подписью и стрелкой над буквой (`Tex`: `\vec{a}`).

### 11.7 Стереометрия `Solid`
- Куб, призма, пирамида, цилиндр, конус, шар — кабинетная проекция (глубина под 45°, сокращение 0,5).
- Рёбра:
  - видимые — `stroke-text` 2,5;
  - невидимые — пунктир `5 4` `stroke-muted` 1,5.
- Грани — `fill-primary-soft`, у задних opacity 0,6.
- Сечение — `fill-primary/25` с контуром `stroke-primary`.
- Ось вращения, высота, радиус — пунктир, подписи `font-mono`.
- Фигуры из кубиков (мат. грамотность) — изометрия: верх `surface`, лево `surface-2`, право `border`, контур `text`.

### 11.8 Диаграммы и данные (трек «Математическая грамотность»)

| Диаграмма | Вид |
|---|---|
| Столбчатая | по образцу `WeekChart`. Значение подписано над столбцом; ось и подписи `muted`. Если это вопрос «найди максимум», цвета не подсказывают ответ: все столбцы `plot-1` |
| Круговая | до 3 секторов `plot-1..3`, остальные `muted` и `surface-2`. Подпись % прямо на секторе или выноской. В центре можно оставить «дырку» (кольцо) для итога |
| Гистограмма, полигон частот | как столбчатая, без зазоров / линия `plot-1` с точками |
| Таблица частот | стиль таблиц `.prose-app`, числа `font-mono tabular-nums` |
| Диаграмма Венна | два-три круга с заливкой `fill-plot-N/20` и контуром `stroke-plot-N`; подписи множеств; пересечение — естественное наложение |
| Вероятность: кубик, монета | простые SVG без эмодзи: кубик — квадрат `rx 10` с точками `fill-text`; монета — круг `border-[3px]` (по образцу `Coin`) |

Если у задания ответ — «прочитать с диаграммы», рисуем её точно по данным задания. Тест проверяет, что высота столбца пропорциональна значению.

### 11.9 Числа, разряды, действия
- Кирпичик образца `DigitTile` подходит для разрядов, столбика и десятичной записи:
  - `rounded-2xl border-2 font-mono font-bold`, высота 56, шрифт 36;
  - тона: default, highlight (`border-primary bg-primary-soft ring-4 ring-primary/25`), danger;
  - смена цифры — `animate-pop`.
- Строка-итог `SumLine` по образцу: `rounded-2xl border-2 px-4 py-2 font-mono text-lg font-bold`. Слагаемые появляются по очереди.
- **Шаги преобразования** (для `worked` и `cloze`) — столбик строк, знак «=» выровнен по одной вертикали:
  - новая строка — через `Reveal`;
  - изменённая часть подсвечена `bg-primary-soft rounded-md`;
  - пропуск в `cloze` — поле `w-16 h-10 rounded-xl border-2 border-dashed border-primary font-mono`.

### 11.10 Видео [этап позже]
**Пока не делаем.** Видео — после выбора стиля (`docs/ROADMAP.md`, 3.4, по желанию; `docs/DECISIONS.md`, #19). До этого шага `video` в уроках нет: урок обязан работать без видео.

**Выбор стиля.** Один тестовый ролик с одной озвучкой делается в каждом стиле (в образце их 4: мультфильм-квест, доска и рука, тетрадь в клетку, моушн-графика). Работа идёт в ветке `video-lab`, промпт — `docs/PROMPTS.md`, П-3.4. Владелец смотрит ролики на телефоне, выбор записывается в `docs/DECISIONS.md`.

**Минимум ролика, когда стиль выбран:**
- длина 60–90 с, 3–5 сцен. Ролик — первый шаг урока, его можно пропустить (`docs/LESSON_METHOD.md`, 2);
- плеер Remotion (`@remotion/player`) в браузере, mp4 не рендерим. Квадрат 1080×1080, 30 fps;
- сцены — `src/videos/<id>/script.ts`: `SCENES: { id, narration, heading, fallbackSec }[]`. Реестр и плеер — `docs/ARCHITECTURE.md`, 17;
- на экране — `heading` и формулы через `Tex`, крупные цифры. Шаг решения появляется, когда о нём говорит голос, прежние остаются на экране;
- субтитры — текст `narration` на языке ученика, включены по умолчанию;
- озвучка — `npm run voiceover -- <id>`, проверка обратной расшифровкой (`docs/LESSON_METHOD.md`, 9.4). Пока озвучки нет, сцена идёт `fallbackSec` секунд;
- те же токены, шрифты, маскот и схемы, что в приложении. Постер и кнопки плеера — 7.4.1.

---

## 12. Тексты интерфейса

### 12.1 Тон
- На «ты», дружелюбно, коротко, активные глаголы. Без канцелярита и без сюсюканья.
- Подписи — одной строкой `text-muted` вместо абзацев.
- Заголовки и кнопки без точки в конце. Предложения-описания — с точкой.
- Кнопка — глагол в повелительном наклонении или короткое слово: «Проверить», «Продолжить», «Начать», «Повторить», «Пропустить», «Остаться», «Выйти», «Закрыть», «Играть», «Ещё раз».
- Ошибка — без упрёка: «Неверно», потом «Правильный ответ: …» и объяснение.
- Числа без склонений: «{n} мин», «Урок {n}», «{n}-сабақ». Числительные не склоняем. В kk суффикс не приклеиваем к подставляемому числу (правило из `AGENTS.md`).
- **Без эмодзи.** Вместо них иконки:

  | Смысл | Иконка |
  |---|---|
  | XP | `Zap` |
  | серия | `Flame` |
  | рекорд | `Trophy` |
  | закрыто | `Lock` |
  | пройдено | `Star` |
  | ИИ | `Sparkles` |
  | ЕНТ | `Target` |
  | π | `Pi` |

### 12.2 Пол ученика неизвестен
- **Нельзя:** глаголы прошедшего времени и краткие прилагательные с родом: «ты сделал/сделала», «разобрался», «дошёл», «готов/готова», «уверен», «молодец, справился».
- **Можно:** «у тебя получилось», «задание решено», «урок пройден», «тема освоена», «хорошая работа!», «готово».
- Ловушки образца, которые нельзя копировать:
  - статические отзывы с «разобрался/дошёл»;
  - достижение «Любопытный» (в Matematika — «Любопытство»).
- Перед релизом ищи такие слова: `rg -n "\b[А-Яа-яЁё]+(лся|лась|ла|л)\b" src/i18n src/content` и просмотри находки глазами. Ложные срабатывания будут («мал», «стол»), это нормально.

### 12.3 Готовые строки образца (ru / kk из словаря Informatica)

| Ключ | ru | kk |
|---|---|---|
| `common.check` | Проверить | Тексеру |
| `common.continue` | Продолжить | Жалғастыру |
| `onb.finish` | Поехали! | Кеттік! |
| `fb.correct.1…4` | Отлично! · Верно! · Супер! · Так держать! | Керемет! · Дұрыс! · Жарайсың! · Тамаша! |
| `fb.partial` | Почти! | Сәл қалды! |
| `fb.wrong` | Неверно | Қате |
| `fb.correctAnswer` | Правильный ответ: | Дұрыс жауап: |
| `fb.example` | Например: | Мысалы: |
| `lesson.exitTitle` | Выйти из урока? | Сабақтан шығасың ба? |
| `lesson.exitText` | Прогресс этого урока не сохранится. | Осы сабақтың барысы сақталмайды. |
| `lesson.stay` / `lesson.exit` | Остаться / Выйти | Қалу / Шығу |
| `lesson.hint` | Подсказка | Кеңес |
| `tools.calc` / `tools.scratch` | Калькулятор / Черновик | Калькулятор / Қаралама |
| `tools.entOnly` | Как на ЕНТ: только калькулятор и черновик | ҰБТ-дағыдай: тек калькулятор мен қаралама |

**Новые строки математики** («Помощники», «Формулы», «Графики», «Готово», «Твой ответ:», «Условие»):
- kk пишем сами;
- прогоняем через `npm run review:kk`;
- термины берём из `docs/ENT_MATH.md`, раздел 4.

### 12.4 Двуязычные элементы и бренд
- Переключатель языка («Қазақша», «Русский») и первое приветствие «Привет! Сәлем!» намеренно двуязычны.
- «Matematika» и «Пи» не переводятся.
- ЕНТ на kk — **ҰБТ**.
- Официальные инструкции к типам заданий ЕНТ (ru/kk) — дословно из `docs/ENT_MATH.md`, 4.9.

---

## 13. Тёмная тема

- **Как переключается.** В профиле `theme: "system" | "light" | "dark"`. `Providers` ставит или снимает `document.documentElement.dataset.theme`, а также `lang` (`ru` / `kk`) и `data-reduce-motion`. У `<html>` стоит `suppressHydrationWarning`.
- **В компонентах нет `dark:`.** Тема меняется сама через переменные. Если компоненту понадобился `dark:`, значит, нужен новый токен (правило 0.4).
- **Что одинаково в обеих темах:**
  - маскот;
  - цвета разделов и игр (`unit.color`, `meta.color`) с белым текстом;
  - конфетти;
  - затемнение `bg-black/40`.
- **Типичные ошибки:**
  - `bg-white` / `text-black` в компоненте — в тёмной теме получится белое пятно;
  - SVG с `fill="#fff"` — используй `fill-surface`;
  - холст черновика с белым фоном — фон `surface`, чернила `text` на экране; но в файл и для ИИ — `#111` на прозрачном / белом (7.4.4), и перерисовка при смене темы;
  - KaTeX с жёстким цветом — не задавать `color`.
- Ученик в тёмной теме видит то же самое, меняется только освещение. Смысловые цвета в тёмной теме светлее, их «мягкие» фоны — тёмные (блок 2.2).

---

## 14. Чек-лист «посмотреть глазами»

Проверяем каждый UI-кусок перед коммитом. Как запустить и снять скриншоты — `docs/WORKFLOW.md`.

**Ширина и раскладка**
- [ ] 360 px, 390 px, 430 px: нет горизонтальной прокрутки, ничего не обрезано, длинные формулы прокручиваются внутри себя.
- [ ] Низкий экран 360×640: главная кнопка видна, матклавиатура не закрывает вопрос целиком (есть «Готово»).
- [ ] 1024 px и 1280 px: боковое меню, правая колонка, «Помощники» справа.
- [ ] Safe-area: на iPhone с «чёлкой» шапка и нижнее меню не залезают под системные зоны.

**Цвет и тема**
- [ ] Светлая, тёмная и «как в системе»: всё читается, нет белых пятен и невидимого текста.
- [ ] Каждый цвет на экране совпадает со смыслом (2.1). Фиолетовое — только то, что делает ИИ.
- [ ] В изменённых файлах нет hex и `dark:` (`rg -n "#[0-9a-fA-F]{3,6}|dark:" src/components src/app`), кроме исключений из 2.5.

**Тексты**
- [ ] Переключить язык на kk: нет русских слов (в образце проскакивали «ИИ» и «ошибок: N»), строки не вылезают за кнопки. Казахские строки длиннее русских.
- [ ] Нет эмодзи. Нет глаголов с родом (12.2).
- [ ] Десятичная запятая, «−», `tg`, «;» в координатах и промежутках.
- [ ] Формулы KaTeX не «прыгают» по высоте строки и не дают «3, 5».

**Взаимодействие**
- [ ] Цели касания ≥ 40 px, основные — 44–56 px.
- [ ] Двойной тап и зажатый Enter не проскакивают обратную связь и итоги.
- [ ] Цифры с матклавиатуры и из калькулятора не выбирают варианты ответа.
- [ ] Фокус виден (Tab), Esc закрывает модалку и шторку, фокус возвращается.
- [ ] Перетаскивание точек на схемах пальцем, «прилипание» к делениям, управление стрелками.

**Движение и отклик**
- [ ] Анимации короткие и не мешают. Включить «Меньше анимаций»: всё появляется сразу, конфетти нет.
- [ ] Звук и вибрация срабатывают на нужных событиях и выключаются в профиле.
- [ ] Маскот «Пи» моргает и «дышит», реагирует на результат; в 34 px читается π.

**Состояния**
- [ ] Пустые состояния, загрузка (скелетоны), ошибка и лимит ИИ, работа без ключа OpenAI.
- [ ] Закрытые и «скоро» элементы: пунктир, замок, не нажимаются.

---

## 15. Что взять из `reference/`, что поменять

Файлы `reference/` — код Informatica с её импортами (`@/lib/store`, ключи словаря, типы курса). Скопированный файл соберётся, только когда на месте всё, от чего он зависит. Поэтому копируй **по шагам** и после каждого шага запускай `npm run typecheck`. Чини только импорты и имена, классы и стиль не меняй. Логику (`check`, `evaluate`, `ent`, банк) переносит `docs/ARCHITECTURE.md`; здесь — то, что отвечает за вид.

| Шаг | Файл образца | Что делать | Зависит от |
|---|---|---|---|
| 1 | `reference/src/app/globals.css` | копировать дословно (2.2), дописать добавки (2.3) | — |
| 1 | `reference/src/lib/cn.ts`, `reference/src/lib/sound.ts` | как есть | пакеты `clsx`, `tailwind-merge` |
| 1 | `reference/src/components/motion/presets.ts`, `Shake.tsx`, `XpBurst.tsx`, `Reveal.tsx` | как есть | `cn` |
| 1 | `reference/src/components/ui/*` (Button, Card, Modal, Pill, ProgressBar) | как есть | `cn`, `presets` |
| 1 | `reference/src/components/mascot/Mascot.tsx` | заменить антенну (10.2), `aria-label="Пи"` | — |
| 1 | `reference/src/components/Markdown.tsx` | добавить `remark-math` + `rehype-katex` | пакеты `react-markdown`, `remark-gfm` |
| 2 | `reference/src/lib/types.ts` → `text.ts`, `mastery.ts`, `gamification.ts`, `src/games/types.ts`, `games.ts` | `types.ts` — переписать под математику (`docs/ARCHITECTURE.md`, 4), остальное почти как есть (там же, 11) | друг от друга, по порядку |
| 2 | `reference/src/i18n/dict.ts` | структура как есть, строки свои | `types` |
| 3 | `reference/src/lib/store.ts` | ключ `informatica-v1` → `matematika-v1`, поля — `docs/ARCHITECTURE.md`, 12 | шаг 2 |
| 3 | `reference/src/i18n/useT.ts`, `src/lib/hooks.ts`, `src/lib/feedback.ts` | как есть | `store`, `text`, `sound` |
| 3 | `reference/src/components/motion/MotionProvider.tsx`, `useReduceMotion.ts`, `CountUp.tsx`, `ComboFlame.tsx`, `AnimatedChips.tsx` | как есть | `store`, `useT`, `hooks` |
| 3 | `reference/src/components/app/AchievementBadge.tsx` | дополнить словарь иконок (`pi` → `Pi`, `target` → `Target`) | `gamification`, `cn` |
| 4 | `Providers`, `Widgets`, `tools/Toolbox`, `tools/useToolbox` — **эталона нет** | сделать по таблице и описанию в начале раздела 5 и по 7.14 | шаг 3 |
| 5 | `reference/src/app/layout.tsx`, `reference/src/app/manifest.ts` | шрифты и `viewport` как есть; добавить `katex/dist/katex.min.css`; `metadata` и манифест — на Matematika (10.5) | `Providers` |
| 5 | `reference/src/components/app/AppShell.tsx` | логотип-слово «Matematika», кнопка «Помощники» | `Widgets`, `Toolbox`, `AnimatedChips`, `store`, `useT` |
| 6 | `reference/src/lib/ai-types.ts`, `ai.ts`, `src/components/ai/useTutor.ts`, `AiPanel.tsx` | вид как есть, тексты и чипы — математические (`docs/AI.md`) | `store`, `Modal`, `Markdown`, `Mascot`; `student-context.ts` ещё и `src/content/course.ts`, `skills.ts` |
| — | сцены образца (биты, лампочки, лесенка, монеты) | **не переносим**, вместо них — раздел 11 | — |
| — | вкладки «Системы счисления», «Единицы», «Степени 2» | **не переносим**, вместо них — «Формулы» и «Графики» (7.14) | — |
