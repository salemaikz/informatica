# Этап 13 — поделиться результатом, вызов другу, отчёт родителю (ТЗ)

> Решения: #72 (ссылка с числами, карточка, без имени), #73 (вызов другу), #74 (отчёт родителю); исходники — волна 3B (`origin/claude/sleepy-clarke-b2gj8f`, #49). Разведка — 4 читателя + критик полноты (2026-10-05).
> Правила проекта (CLAUDE.md) действуют целиком: ru + kk, без эмодзи, цвета токенами, `cn()`, `ButtonLink`, без глаголов с родом, без синхронного `setState` в эффектах, чистая логика в `src/lib` с тестами, стек не называем (#62).

## 0. Каркас (сделан главной моделью — менять только через главную модель)

| Файл | Что даёт |
|---|---|
| `src/lib/share-code.ts` | `ShareResult` (exam / course / streak), `encodeShare`, `parseShare` (строго, только каноническая запись), `sharePath`, `sharePercent`. Формат кода — в шапке файла. |
| `src/lib/challenge.ts` | `Challenge {s, m, pool}`, `encodeChallenge`/`decodeChallenge` (`ch=14-19-a9zq`), `withChallenge`, `sanitizeChallenge`, `poolTag`, `compareWithChallenge(points, max, c, pool)`. |
| `src/lib/exam-pool.ts` | `currentPoolTag()`, `EXAM_BUILD_VERSION` (сторож — `tests/challenge.test.ts`). |
| `src/lib/exam-store.ts` | `ExamAttempt.pool?`, `ExamAttempt.challenge?` (+ проверка в `sanitizeState`; у `unit` вызова нет), `isPoolTag`; `buildSummary` переносит `pool` в `ExamSummary.pool?`. |
| `src/lib/course-view.ts` | `courseViewOf({lessons, track, grade, skipBasics})` — чистая шкала курса/класса (хук `useCourseView` — обёртка). |
| `src/lib/share.ts` | `whatsappUrl`, `telegramUrl`, `messageOf`, `canShareNative`, `canShareFile`, `shareNative` (с файлом или без), `copyText`, `absoluteUrl` (origin окна). |
| `src/components/share/ShareTargets.tsx` | Готовый блок «Отправить / WhatsApp / Telegram / Скопировать ссылку» (+ поле для ручного копирования, `role=status`, событие `share`). Пропсы: `url` (абсолютная), `title`, `text` (без ссылки), `what`, `file?`. |
| `src/components/share/ExamShareActions.tsx` | **Заглушка** с итоговыми пропсами — реализует пакет A, монтирует пакет B. |
| `src/lib/analytics.ts` и схема | События `share {what, how}`, `share_open {what}`, `challenge {step}`; поля `sh:`, `so:`, `chl:`; раздел «Поделиться» на `/owner`. |
| `src/lib/public-paths.ts` | `/report` и `/r/*` — без онбординга; `/exam/run` — нет. `isRecipientPath` — страницы получателя; `AnalyticsAgent` там не шлёт `active`. |
| `src/i18n/parts/{share,challenge,report}.ts` | Части словаря подключены в `dict.ts`; `share.targets.*` готовы. Каждый пакет пишет **только свою** часть. |
| `assets/fonts/Nunito-{ExtraBold,Black}.ttf` + `OFL.txt` | Статичные TTF с казахскими буквами — для картинки превью на сервере. |

## Пакет A — карточка, лист «Поделиться», страница `/r/<код>`, превью ссылки

**Файлы (только эти):** `src/lib/share-card.ts`, `src/components/share/*` (кроме `ShareTargets.tsx` — его не менять, только использовать), `src/app/r/[code]/{page,opengraph-image,twitter-image}.tsx` (+ при необходимости `not-found.tsx`), `src/components/progress/CourseProgressCard.tsx`, `src/components/progress/StatsTiles.tsx`, `src/i18n/parts/share.ts` (добавлять ключи, `share.targets.*` не трогать), `next.config.ts` (только если нужна трассировка шрифтов), `public/sw.js` (только исключение `/r/`), тесты `tests/share-card*.test.ts`, `tests/share-landing*.test.ts`, `e2e/share.spec.ts`.

### A1. Карточка-картинка — `src/lib/share-card.ts`
- Порт `share-card.ts` из 3B (`git show origin/claude/sleepy-clarke-b2gj8f:src/lib/share-card.ts`) + варианты: модель-дискриминатор `{kind:"exam", …} | {kind:"course", …} | {kind:"streak", …}`, общие поля — тексты (приходят готовыми из компонента на языке ученика), `siteName` (`APP_NAME`), `siteHost` (хост из `siteUrl()`, не `window.location`).
- 1080×1920, светлая палитра `CARD_COLORS` = hex-копии `:root` из `globals.css` (+ `streak`, `gold`); тест `share-card-colors.test.ts` парсит `globals.css` и сверяет.
- Шрифт — `"Nunito Variable"` (так называется семейство `@fontsource-variable/nunito`), ждать `document.fonts.load` для 900 и 800 с казахскими буквами в тестовой строке.
- Пробник: вид пробника, крупно баллы («14 из 19»; kk — «19 ішінен 14»), кольцо/полоса доли, **до 3 сильных тем** (доля ≥ 0,5, по убыванию; слабые не показывать), подвал — хост и «Пройди этот же вариант». Курс: % (как `sharePercent`), «N из M уроков», «курса подготовки к ЕНТ» / «программы N класса». Серия: пламя (путь иконки, цвет `streak`), «N дней подряд», рекорд. Маскот «Бит» — по желанию статичным SVG через data-URL.
- Иконки — пути (Path2D) из lucide, **никаких эмодзи**. Без названий подрядчиков и технологий.
- Чистые функции (`pickStrongTopics`, тон по доле, имя файла, разметка текста по языку) — с тестами; `drawShareCard(canvas, model)` отдельно от `renderShareCard(model): Promise<Blob>`.

### A2. Лист «Поделиться» — `src/components/share/ShareSheet.tsx` (+ кнопка)
- Общий компонент: кнопка открывает `Modal` (ui/Modal); **рендер картинки запускается в обработчике нажатия** (promise, `setState` в `then`) — не в эффекте; превью `<img>` (object URL, освободить при закрытии), подсказка «на телефоне можно нажать и удерживать картинку».
- Внутри — `ShareTargets` с `file` (пока картинка готовится — кнопка системного меню ждёт с подписью «Готовлю картинку…», мессенджеры и копирование доступны сразу).
- «Сохранить картинку» (`downloadBlob` из `lib/download.ts`, событие `share … how:"save"`) — **только если** `canShareFile(file)` = false (десктоп).
- Сообщение: текст без глаголов с родом, без «официально» и «прогноз ЕНТ»; ссылка — `absoluteUrl(sharePath(result))`.

### A3. Где кнопки
- `ExamShareActions` (реализовать заглушку, пропсы не менять): две кнопки в ряд — «Поделиться результатом» (`what:"exam"`, с карточкой) и «Вызвать друга» (`what:"challenge"`, без карточки, текст-вызов «У меня 14 из 19 в мини-ЕНТ. Пройди этот же вариант — сможешь больше?»). Обе дают одну ссылку `/r/x1-…` (`pool` из пропса, иначе `currentPoolTag()`); `kind === "unit"` или невалидный код — `null`.
- `CourseProgressCard`: маленькая кнопка «Поделиться» (иконка `Share2`, подпись), если в процент входит хотя бы один пройденный урок (`done > 0`, ≥ 1%); код `c1` (класс у школьного трека).
- `StatsTiles`: на плитке серии — кнопка «Поделиться», если текущая серия (`liveStreak`) ≥ 1; код `s1` (рекорд = max(best, current)).
- Значки и цвета — токены: основное действие `primary`, серия `streak`.

### A4. Страница получателя — `src/app/r/[code]/page.tsx`
- Серверная: `const { code } = await props.params`, `parseShare(code)`. `generateMetadata`: заголовок и описание **на языке из кода** (`dict[key][lang]` напрямую, с подстановкой чисел), `robots: { index: false, follow: false }`, `openGraph` без `images` (картинку подставит файл-конвенция), `twitter.card = summary_large_image`. Проверить итоговый HTML (`curl`): ровно один `og:image` и один `twitter:image`, оба ведут на `/r/<код>/opengraph-image…` / `twitter-image…`.
- Клиентская часть `src/components/share/ResultLanding.tsx`: язык — `profile.lang`, если ученик прошёл онбординг, иначе язык из кода; маленький переключатель ru/kk (локальное состояние). Пробник: «Результат друга в пробном ЕНТ» (вид, баллы), кнопка `primary` «Пройти этот же вариант» → `withChallenge(examLink(kind, seed, topics), {s, m, pool})` (событие `challenge step:"accept"`), вторичная «Начать заниматься» → `/`. Курс и серия — результат и «Начать заниматься». Битый код — нейтральная карточка Informatica и «Начать заниматься» (страница 200, не 404). При открытии — `share_open {what}` один раз (только для валидного кода).
- Страница без нижнего меню приложения (вне группы `(main)`), мобильная вёрстка 360–430 px, тёмная тема.

### A5. Превью — `opengraph-image.tsx` (+ `twitter-image.tsx` — реэкспорт)
- Читать `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` и `…/04-functions/image-response.md`. Next 16: `params` — Promise; edge-рантайм устарел — **не объявлять** `runtime`; шрифты только TTF/OTF/WOFF — брать `assets/fonts/*.ttf` через `readFile(join(process.cwd(), "assets/fonts/…"))` на уровне модуля.
- 1200×630, `alt` — двуязычный (`biText`), светлая палитра, только flex-вёрстка. Разбор кода **до** любой тяжёлой работы; битый код — брендовая заглушка (как `public/og.png`), не ошибка.
- Заголовок `Cache-Control: public, max-age=31536000, immutable` (картинка — чистая функция кода; смена дизайна — новый префикс `x2`/`c2`/`s2`).
- Проверка: `curl -sI` → 200, `image/png`, < 300 КБ; открыть PNG для ru и kk глазами (буквы «ә ғ қ ң ө ұ ү һ і» не квадраты).
- `public/sw.js`: адреса `/r/` не кэшировать (каждая ссылка уникальна).

### A6. Тесты A
- Юнит: чистые функции карточки, сверка палитры, модель лендинга (если вынесена в чистую функцию: метки по коду, ссылка вызова).
- e2e `e2e/share.spec.ts`: итог пробника → «Поделиться результатом» → лист, превью картинки появилось, «Скопировать ссылку» даёт `/r/x1-…` (буфер в Playwright: `context.grantPermissions(["clipboard-read","clipboard-write"])`); `/r/<валидный код>` без онбординга на 390 px в тёмной теме — без прокрутки вбок, кнопка «Пройти этот же вариант» ведёт на `/exam/run?…&ch=…`; `/r/мусор` — нейтральная карточка; `GET /r/<код>/opengraph-image…` (адрес взять из `og:image`) — 200 `image/png`.

## Пакет B — вызов в пробнике и возврат после онбординга

**Файлы (только эти):** `src/components/exam/{logic.ts, ExamRun.tsx, ExamResult.tsx, ChallengeBanner.tsx}`, `src/app/exam/run/page.tsx`, `src/lib/pending-link.ts`, `src/components/app/Providers.tsx`, `src/app/onboarding/page.tsx`, `src/i18n/parts/challenge.ts`, тесты `tests/share-challenge.test.ts`, `tests/pending-link.test.ts`, `e2e/challenge.spec.ts`.

### B1. Адрес и попытка
- `RunParams.challenge: Challenge | null` (`decodeChallenge(first(sp.ch))`; у `unit` — всегда `null`). `examLink(kind, seed, topics = [], unit?, challenge?)` — вызов через `withChallenge`, у `unit` игнорируется; существующие вызовы (`ExamHub`, `CheckpointNode`) не ломаются.
- `app/exam/run/page.tsx` передаёт `challenge` пропом (читается на сервере — без `useSearchParams`).
- `ExamRun`: при создании попытки `pool: currentPoolTag()` и `challenge` (кроме `unit`). Если по ссылке с вызовом открыта уже начатая попытка того же варианта без вызова — дописать вызов в попытку. Экран продолжения чужого варианта — как сейчас, вызов не теряется при «Начать этот».
- Перед стартом — `ChallengeBanner` (из 3B `ChallengeBanner.tsx`, без имени): «У друга: 14 из 19. Сможешь больше?»; если `challenge.pool !== currentPoolTag()` или максимум другой — «Задания обновились — вариант может отличаться, сравним по доле». Цена входа не меняется (1 сердечко, `HeartCost` как есть).
- События: `challenge step:"start"` при оплаченном старте с вызовом; `more|same|less` — один раз при завершении попытки с вызовом (там же, где `exam_finish`).

### B2. Итоги — `ExamResult.tsx`
- После итоговой карточки: сравнение `ChallengeCompare` (если у попытки есть вызов): «Больше, чем у друга: +2» (`gold` — достижение), «Столько же» (нейтрально), «Меньше на 3 — попробуй ещё раз» (нейтрально, **не красный**: это не ошибка) + пометка «по доле», если вариант другой.
- Смонтировать `<ExamShareActions kind seed topics points max pool topicRows />` из пакета A (там же, после карточки; для `unit` компонент сам вернёт `null`). `pool` — `attempt?.pool ?? summary?.pool`.

### B3. Возврат после онбординга — `src/lib/pending-link.ts`
- `savePendingLink(href, now)`: принимает **только** `/exam/run?…` с валидными `kind` + `seed` и валидным `ch` (через `parseRunParams`), иначе ничего не делает (защита от открытого редиректа). Хранит в `localStorage` (try/catch, ключ `informatica:pending-link`), срок — 1 час. `takePendingLink(now)` — вернуть и удалить (просрочено/мусор — `null`).
- `Providers.tsx`: перед `router.replace("/onboarding")` — `savePendingLink(pathname + window.location.search, Date.now())`. Там же: на страницах получателя (`isRecipientPath`) при сбое чтения сохранения не показывать экран восстановления — рендерить страницу (там стор нужен только для языка).
- `onboarding/page.tsx` → `finish`: если `takePendingLink()` вернул адрес — `router.replace(адрес)` вместо диагностики/тарифов (и для школьного трека тоже: `/exam/run` сам покажет карточку «для ЕНТ» с переключением).

### B4. Тесты B
- Юнит: `parseRunParams`/`examLink` с `ch` и с `unit`; `sanitizeState` с `challenge`/`pool` (у `unit` вызов отбрасывается); `pending-link` (только `/exam/run`, `//evil`, `/exam/run?kind=mini` без `ch`, просрочка, мусор в хранилище).
- e2e `e2e/challenge.spec.ts`: новый ученик открывает `/exam/run?kind=mini&seed=…&ch=…` → онбординг → сразу баннер «У друга: …» → «Начать» (−1 сердечко) → завершить → сравнение; ученик с профилем — то же без онбординга; перезагрузка посередине — баннер/вызов не теряется.

## Пакет C — отчёт родителю

**Файлы (только эти):** `src/lib/parent-report.ts`, `src/lib/hash-pack.ts`, `src/components/report/*`, `src/app/report/page.tsx`, `src/app/(main)/profile/page.tsx` (одна вставка кнопки), `src/i18n/parts/report.ts`, тесты `tests/parent-report.test.ts`, `tests/hash-pack.test.ts`, `e2e/report.spec.ts`.

### C1. Данные — `src/lib/parent-report.ts` (порт `report.ts` из 3B, схема v2)
- `ParentReport = { v: 2, at, lang, name?, track, streak: {cur, best}, xp, d7: {active, lessons, min, acc: number|null}, d30: {active, lessons}, course: {pct, done, total, grade?}, ent?: {forecast: {basis, score, low, high} | null, topics: number[13], exams: {at, kind, p, m}[≤5], weak: EntTopicId[≤3]} }`.
- `buildParentReport(state, now, {withName})`: точность и минуты за 7 дней — `dayTotals(days, lastDays(now, 7))` (#66, #68; нет ответов — `null`), активные дни и уроки — по `days`; курс — `courseViewOf` (#71); серия — `liveStreak`; ЕНТ-блок только у трека ЕНТ: `forecastScore({…, diagnostic: profile.diagnostic})` (basis `none` → `forecast: null`), темы — `forecast.byTopic` в %, пробники — без `unit`, слабые — 3 темы с наименьшим освоением среди тем с данными. Имя — `cleanName` (из 3B `challenge.ts` больше нет: своя чистка — управляющие и bidi-символы, `<>`, до 30 символов) и **только при `withName`**.
- `parseParentReport(raw)`: недоверенные данные — белые списки и обрезка чисел, `v === 2`, длина `topics` = 13; иначе `null`.

### C2. Упаковка — `src/lib/hash-pack.ts`
- Из 3B `share-link.ts` только `packData`/`unpackData` (JSON → deflate-raw → base64url, префикс `z`; без `CompressionStream` — `r`), `dataFromHash`, лимиты. **Без** backup/restore/QR (#49, #60). `MAX_LINK_LENGTH = 4000`, защита от «бомбы» (`MAX_UNPACKED_BYTES`). Ссылка — `${origin}/report#d=<packed>`.

### C3. Экраны
- Профиль: карточка/кнопка «Отчёт для родителей» (рядом с «Отзывами», значок `Users` или `FileText`) → окно `ReportShareSheet`: переключатель «Показать имя» (выключен; нет имени — скрыт), язык отчёта ru/kk (по умолчанию язык ученика), «Посмотреть отчёт» (новая вкладка), затем `ShareTargets` (`what:"report"`, текст «Мой прогресс в Informatica»). Ссылка пересобирается при смене переключателей (асинхронно, `setState` в `then`).
- `src/app/report/page.tsx`: серверная обёртка, `metadata` с `robots noindex`, `referrer: "no-referrer"`, заголовок без персональных данных; рендерит клиентский `ReportView` (из 3B, переписать под v2): читает фрагмент (`useHash` из 3B), язык — выбор на странице → `r.lang` → язык устройства; секции: серия и активность, точность и время за 7 дней (`null` — «пока нет ответов»), % курса/класса, у ЕНТ — прогноз диапазоном («предварительно» для `diagnostic`, `null` — «пока рано судить»), темы полосами (цвет по доле: ≥ 80% `success`, ≥ 50% `warning`, иначе `danger`), пробники, «стоит подтянуть». Подвал: «Снимок на {дата}. Данные — только в этой ссылке, у нас они не хранятся». Кнопка «Узнать об Informatica» → `/`. `share_open {what:"report"}` один раз при удачном разборе. Повреждённая ссылка — понятная карточка «Ссылка повреждена».
- Тексты из 3B (`links.rep.*`) — перенести в `report.*`, по-русски экзамен — **ЕНТ** (не ҰБТ).

### C4. Тесты C
- Юнит: `buildParentReport` (диагностика → `basis:"diagnostic"`, школьный трек без ЕНТ-блока, `acc: null`, имя выкл./вкл., худшая длина ссылки ≤ 1500 символов), `parseParentReport` (мусор, чужая версия, длина тем), `hash-pack` (туда-обратно, «бомба», лимиты, без `CompressionStream`).
- e2e `e2e/report.spec.ts`: профиль → «Отчёт для родителей» → ссылка; открыть её в **новом контексте** (чистое устройство) → без онбординга, данные видны, имени нет; с «Показать имя» — имя есть; ru/kk переключатель; 390 px, тёмная тема, без прокрутки вбок.

## Общее для всех пакетов
- Работать в своей рабочей копии; чужие файлы не править — нужна правка общего файла → описать в отчёте.
- Перед сдачей: `npx next typegen && npx tsc --noEmit`, `npx eslint` по своим файлам, `npx vitest run` целиком, свои e2e (сервер: `npm run build && npx next start -p 3100`, Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, переменная `PW_CHROMIUM_PATH`; после — остановить сервер по PID).
- Казахский — литературный, термины как в словаре (поискать, как уже переведены «пробный ЕНТ», «серия», «урок», «вариант»); kk-тексты главная модель потом вычитает.
- Один коммит в своей ветке (не пушить), итог — коротко: что сделано, проверки, вопросы.

## Приёмка (главная модель)
Слияние → typecheck, lint, все тесты, сборка, полный e2e → ревью (воркфлоу с проверкой находок) → вычитка kk → политика (`content/legal.ts`: «Поделиться» создаёт ссылку только с числами результата; отчёт родителю целиком в ссылке, у нас не хранится и не отзывается; адреса страниц, как обычно, видит хостинг) → CHANGELOG, ROADMAP, PLAN, ARCHITECTURE, HANDOFF.
