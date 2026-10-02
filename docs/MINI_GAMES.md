# Мини-игры — ТЗ

> Сгенерировано панелью моделей (см. DECISIONS #15): 3 дизайнера → 2 судьи → синтез. Тексты ТЗ — на английском (по ним работали исполнители). При изменении механики игры — обновлять соответствующий раздел.

## Почему этот набор

Выбраны четыре игры с разным типом нагрузки: «Бит-спринт» тренирует беглость и быстрое вспоминание (варианты ответа плюс ввод на клавиатуре), «Битовый тумблер» — сборку числа из разрядов и понимание их весов, «Сортировщик» — классификацию по свойствам с чередованием правил, «Найди ошибку» — разбор готовых решений и их исправление (типичные ловушки ЕНТ). Вместе они покрывают все четыре навыка урока (ns.base, ns.bin2dec, ns.dec2bin, ns.props), а способы ввода у всех разные: тап по варианту или клавиатура, переключатели, свайп по корзинам, выбор строки. В победителей перенесены лучшие идеи остальных концепций: возврат ошибочного задания в конец раунда, бонус за минимум переключений, «слепой» режим без суммы, предикатные правила и шаг «исправь» из «Сборки по шагам». Три игры из четырёх — универсальные движки (поток вопросов, правила сортировки, поиск ошибки в решении), поэтому новые темы подключаются генераторами и данными, без новых игр. Всё работает в браузере без вызовов ИИ, на уже готовых генераторах, звуках и маскоте, так что стоимость выполнения нулевая. Интервальное повторение своих ошибок («Эхо-ошибки») стоит первым в бэклоге — его лучше делать, когда тем будет две-три.

## ⚡ Бит-спринт / Бит-спринт (`bit-rush`)

*60 секунд быстрых вопросов: верный ответ добавляет время, ошибка его отнимает.*

Навыки: ns.base, ns.bin2dec, ns.dec2bin, ns.props

```text
ENGINE: content-agnostic answer stream. It consumes any QuestionStep of type 'choice' or 'input' produced by generateStep(skill, mastery, seed). New topics plug in by adding generators; the game itself does not change. Merges concepts #5, #0 and #10: the clock mechanic of #5, weak-skill weighting and the retry of #0/#10. It has no lives and no per-question failure timer, so there are fewer rules.

FILES: src/games/bit-rush/Game.tsx (default export, props { lang, sound, onFinish }) and src/games/bit-rush/strings.ts. Use tx() and fmt() from '@/lib/text' for Text/L values and {param} templates, seeded() and shuffle() from '@/lib/text' for randomness, and checkInput(value, answers, mode) from '@/lib/check' for typed answers.

QUESTION SOURCE
- Pool: ns.base, ns.bin2dec, ns.dec2bin, ns.props.
- Optional read-only mastery: at mount, read useApp.getState().skills[id]?.mastery from '@/lib/store'. Never write to the store; the shell records the attempts. Fall back to 0.3 when the value is absent.
- Skill pick: weight = (1.1 - mastery)^2, the same formula as buildDrill. Never pick the same skill 3 times in a row.
- Tier t in {0,1,2} is passed to generateStep as the mastery value [0.3, 0.65, 0.9], which gives number ranges 5-15 / 16-63 / 64-255. Start at t=0, or t=1 for a skill whose stored mastery is >= 0.8. Every 5th correct answer of the round raises t by 1 (max 2). Two wrong answers in a row lower it by 1 (min 0).
- generateStep can return type 'bits' or 'ladder' for bin2dec and dec2bin. Re-roll with seed + 7919*k (k = 1..10) until the type is 'choice' or 'input'; if that fails, pick another skill.
- Dedupe: skip a step whose id prefix (the first 4 ':'-separated parts) was already asked this round.
- Retry after failure: a wrongly answered step is re-inserted once, 3 questions later, with its options reshuffled (remap the correct index). The retry counts as a normal attempt.

ROUND FLOW
1. Mount: the clock is set to 60.0 s and starts at once (the shell already showed the intro). The first question slides in (animate-slide-up).
2. choice: 2-4 option buttons with text tx(option, lang). input: an answer field above an on-screen keypad. Mode 'binary' shows keys 0, 1, Erase, OK. Mode 'number' shows a 3x4 grid: 1-9, Erase, 0, OK. The field shows the typed value plus step.suffix (₂ or ₁₀), max 9 characters. OK is disabled while the field is empty.
3. Correct: clock +1.5 s (remaining time capped at 60 s), streak +1, points as below. The chosen button turns success with a check icon for 300 ms, a gold '+N' floats to the score, playSound('correct'). The next question appears after 350 ms.
4. Wrong: clock -4 s, streak = 0, apply the tier rule. animate-shake on the question card; the chosen option turns danger with a cross icon and the correct option turns success with a check icon. For input questions, show the line 'Правильный ответ: X'. Show tx(step.explanation) below the card in text-sm, playSound('wrong'). This reveal PAUSES the clock. Continue on a tap anywhere, Enter/Space or the 'Дальше' button; auto-continue after 3 s.
5. End: remaining time <= 0, OR 120 s of total active play time (a hard cap that keeps the session under 2 min). Lock input, show a 'Время!' overlay for 700 ms, playSound('complete'), then call onFinish exactly once (useRef guard). A question still on screen at the end is not logged.

TIMER
- One requestAnimationFrame loop using performance.now() deltas (no setInterval drift). Pause while document.visibilityState === 'hidden' and during the wrong-answer reveal.
- Clock bar: 6 px tall, full width, width = remaining/60. bg-primary normally, bg-warning below 15 s, bg-danger below 5 s; below 5 s the seconds number also pulses.
- Per-question speed ring (bonus only, no penalty): window 6 s for choice and 9 s for input at t0, minus 1 s per tier (floors 4 s / 6 s). A thin 28 px SVG circle at the top right of the card that drains clockwise.

SCORING
- base = 10 for choice, 15 for input (typed recall is harder).
- Multiplier from the streak after the increment: 1-2 x1, 3-5 x2, 6-9 x3, 10-14 x4, 15+ x5.
- speedFrac = max(0, 1 - secondsOnQuestion / window); points = round(base * mult * (1 + 0.5 * speedFrac)). A wrong answer gives 0; the score never decreases.
- Call onFinish({ score, correct, total: attempts.length, attempts }) with attempts[i] = { skill: step.skill, correct }.

LAYOUT (390 x ~788 below the 56 px header)
- Root: relative flex h-[calc(100dvh-56px)] w-full max-w-[640px] mx-auto flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] select-none touch-manipulation.
- Top row, h-12: score on the left (text-xl font-bold tabular-nums); combo chip 'x3' in the centre (bg-streak-soft text-streak, hidden at x1); seconds and <Mascot size={36}/> on the right. The clock bar sits right under this row.
- Question card: flex-1 with centred content, bg-surface border border-border rounded-2xl p-5. Prompt in text-xl sm:text-2xl font-semibold; binary and decimal literals in font-mono. Feedback zone below it (min-h-12, aria-live).
- Thumb zone (bottom ~45 %): for choice, grid grid-cols-2 gap-3 with buttons min-h-16 rounded-xl border-2 text-lg. 2 options use 2 columns; with 3 options the third spans both columns. For input, a field h-14 plus keypad keys h-14 with gap-2.
- Background: an absolutely positioned gradient layer (primary-soft to streak-soft) whose opacity follows the multiplier: 0 up to x3, 0.6 at x4, 1 at x5, with a 400 ms transition.

JUICE
- Mascot mood: neutral by default; happy for 600 ms after a correct answer; sad for 600 ms after a wrong one; celebrate on reaching x5.
- Floating '+1,5 с' (text-success) or '−4 с' (text-danger) next to the clock. A 'Быстро!' chip when speedFrac > 0.6.
- Play sounds only when props.sound is true.
- prefers-reduced-motion: no shake, no floating numbers, no gradient transition (state changes are instant).

KEYBOARD
- choice: keys 1-4. input: 0-9 type digits (binary mode ignores 2-9), Backspace erases, Enter = OK. During the reveal, Enter or Space continues.

EDGE CASES
- Lock input from the first answer until the next question renders (no double answers, no double logging).
- On unmount, cancel rAF and timeouts and never call onFinish.
- If the hard cap is reached during a reveal, end immediately.
- Options are Text (string | L), so always render them with tx().
- 2-option parity questions accept only keys 1-2.

ACCESSIBILITY
- Option buttons and keypad keys have aria-labels ('Стереть', 'OK'). An aria-live='polite' region announces 'Верно' or 'Неверно. Правильный ответ: X'.
- Colour is never the only signal: judged buttons show check or cross icons.
- Touch targets >= 48 px, focus-visible:ring-2 ring-primary, text >= 16 px.

STRINGS (strings.ts, key: ru / kk)
score: 'Очки' / 'Ұпай'
combo: 'Комбо' / 'Комбо'
seconds: '{n} с' / '{n} с'
correct: 'Верно!' / 'Дұрыс!'
wrong: 'Неверно' / 'Қате'
answerWas: 'Правильный ответ: {a}' / 'Дұрыс жауап: {a}'
next: 'Дальше' / 'Келесі'
tapToContinue: 'Нажми, чтобы продолжить' / 'Жалғастыру үшін бас'
timeUp: 'Время!' / 'Уақыт бітті!'
typeAnswer: 'Введи ответ' / 'Жауапты енгіз'
erase: 'Стереть' / 'Өшіру'
ok: 'OK' / 'OK'
clockPlus: '+1,5 с' / '+1,5 с'
clockMinus: '−4 с' / '−4 с'
fast: 'Быстро!' / 'Жылдам!'
rules: '60 секунд. Верный ответ: +1,5 с, ошибка: −4 с. Серия верных ответов поднимает множитель до x5, быстрый ответ даёт бонус.' / '60 секунд. Дұрыс жауап: +1,5 с, қате: −4 с. Қатарынан берілген дұрыс жауаптар көбейткішті x5-ке дейін көтереді, жылдам жауап бонус береді.'
```

## 🎛️ Битовый тумблер / Бит қосқыштары (`bit-flip`)

*Переключай биты и собирай заданное число — вес каждого разряда перед глазами.*

Навыки: ns.dec2bin, ns.bin2dec, ns.props

```text
MECHANIC: a row of bit switches labelled with place values. The player builds a decimal target, reads a preset pattern, or builds a number that satisfies a property. Merges concepts #8 and #13: the re-queue of failed targets and the variants from #8, the minimum-flip and property goals from #13. It adds a tier-2 'blind' mode with the sum hidden, so the player has to add the weights mentally. Specific to number systems; later versions add hex groups and logic gates.

FILES: src/games/bit-flip/Game.tsx (default export, props { lang, sound, onFinish }) and strings.ts. Helpers: toBinary(n, bits) from '@/lib/check'; seeded, shuffle, tx, fmt from '@/lib/text'; playSound, cn, Mascot. Optional read-only mastery from useApp.getState().skills (fallback 0.3); never write to the store.

TASK TYPES (each task is one attempt)
- BUILD (skill ns.dec2bin): the prompt 'Собери число' plus a big target (text-5xl font-mono). All switches start at 0.
- READ (skill ns.bin2dec): the switches are preset to n and locked (aria-disabled). The player picks the decimal value from 3 buttons. Distractors, all unique and > 0: the value with its bits reversed; n with one bit misread (n XOR 2^j at a random position); n+1 or n-1. If a distractor collides, use n±2. Keys 1-3.
- PROPERTY (skill ns.props): build a number that satisfies a goal, checked by a predicate. Offer only goals satisfiable with the current bit count B:
  a) an even number with exactly k ones (1 <= k <= B-1): v > 0 && v % 2 == 0 && popcount(v) == k.
  b) the number 2^k (1 <= k <= B-1), shown with a superscript exponent such as '2⁵': v == 2^k.
  c) the number 2^k − 1 (2 <= k <= B): v == 2^k − 1.
  d) the smallest number with n binary digits (2 <= n <= B): v == 2^(n-1).
  e) an odd number greater than m (m <= 2^B − 3): v % 2 == 1 && v > m.
  On failure, show the first matching reason: wrong parity, wrong count of ones, wrong digit count, not the smallest, not greater than m, not equal (for b and c).

ROUND
- 10 primary tasks or 90 s on the round clock, whichever comes first. A failed task is re-queued once at the back of the queue (max 3 retries per round); the round also ends when the queue is empty.
- Tasks are generated lazily, when needed, so they follow the current tier. Tasks 1 and 2 are BUILD at tier 0 to teach the control. After that, the mode is a weighted pick: BUILD 0.45, READ 0.30, PROPERTY 0.25, each multiplied by (1.1 − mastery of its skill)^2 and then normalised. Never the same mode 3 times in a row, never the same target twice in a round.
- Tier: start at 0; becomes 1 after the 3rd correct task and 2 after the 6th. Bits B = 4 / 6 / 8. Targets: tier 0 uses 1..15; tier 1 uses 16..63 with a 30 % chance of a boundary value (31, 32, 63, 2^k, 2^k−1); tier 2 uses 64..255 with a 30 % chance of a boundary value (127, 128, 255, 2^k−1).
- Per-task timer by tier: BUILD and PROPERTY 20 / 16 / 12 s, READ 10 / 8 / 6 s. A timeout counts as wrong.
- Tier-2 blind mode: in BUILD the live sum is hidden ('= ?'). In READ the place-value labels show '?', so the weights must be recalled.

INPUT
- Tap a switch to flip it: playSound('tap'), flips + 1, a spring animation (scale 0.92 to 1, 120 ms). Live readout: the binary string (font-mono text-2xl tracking-widest) and '= sum' (text-3xl tabular-nums).
- 'Сброс' sets all switches to 0 but does not reset the flip counter. 'Готово' submits (also Enter). There is no auto-submit; the player commits the answer.
- Keyboard: keys 1..B flip the switches from left to right, Enter submits, Backspace or Escape resets. In READ, keys 1-3 pick an option.

SCORING
- Correct: 10 + ceil(seconds left on the task timer), plus a 5-point 'perfect' bonus when flips == popcount(answer). The bonus applies to BUILD and to PROPERTY goals b, c and d, which have a unique answer.
- Wrong or timeout: 0 points.
- attempts[i] = { skill, correct } for every task; retries are separate attempts. Call onFinish({ score, correct, total: attempts.length, attempts }).

FEEDBACK
- Correct: the switches flash success one after another (40 ms stagger), a gold '+N' pop, a gold 'Идеально' chip when the answer is perfect, playSound('correct'), mascot happy.
- Wrong: switches that differ from the correct pattern get a danger outline. Below, show the correct pattern as a mini row with its breakdown, e.g. '64 + 8 + 4 + 1 = 77'. For PROPERTY, show the reason line plus 'Например: 0110₂ = 6' using the smallest valid example. Show the 'Это задание вернётся позже' chip when the task is re-queued. playSound('wrong'), mascot sad.
- Feedback pauses both clocks. Continue on a tap, Enter or 'Дальше'; auto-continue after 2.5 s (900 ms after a correct answer).
- End: when the round clock runs out, show a 'Время!' overlay for 700 ms, playSound('complete'), then call onFinish once (useRef guard). A task on screen when the clock ends is not logged.

LAYOUT (390 px)
- Root: flex h-[calc(100dvh-56px)] w-full max-w-[640px] mx-auto flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] select-none touch-manipulation.
- Top row, h-11: progress '3/10', the score, round seconds and Mascot size 32. Under it, the 6 px round clock bar.
- Prompt card: mode label in text-sm text-muted; the target in text-5xl font-mono font-bold, or the goal in text-xl font-semibold. A 4 px task timer bar under it.
- Readout block, centred: binary string and '= sum' (or '= ?'), with the flip counter in text-xs text-muted.
- Switch row: grid with B columns, gap-1. 8 switches fit in 328 px (each ~38 px wide, 64 px tall, rounded-xl). Each switch has its place value above it (text-[11px] text-muted tabular-nums). Off: bg-surface-2 border border-border with '0' in text-muted. On: bg-primary text-white with '1' and a soft shadow.
- Bottom row, h-14: 'Сброс' (secondary, 1/3 width) and 'Готово' (bg-primary, 2/3 width). In READ, three option buttons replace them (h-16 text-2xl font-mono, 3-column grid).

EDGE CASES
- Targets are never 0 and always <= 2^B − 1. READ patterns are never all zeros. PROPERTY goal e) is skipped when no odd value above m fits.
- Lock all input during feedback and after submit. Ignore taps on the locked READ switches.
- Pause the clocks while the tab is hidden. On unmount, cancel rAF and timeouts and never call onFinish.
- prefers-reduced-motion: no spring, no stagger, plain colour change.

ACCESSIBILITY
- Switches are real buttons with role='switch', aria-checked and an aria-label such as 'Бит, вес 32, включён'.
- An aria-live='polite' region reads 'Сумма: 77' after each flip (debounced 300 ms; it reads 'Сумма скрыта' in blind mode) and announces the result after submit.
- Colour plus check or cross icons; switches are 64 px tall; focus-visible rings.

STRINGS (strings.ts, key: ru / kk). In kk templates never attach a case suffix to an interpolated number; attach it to the word 'сан' instead.
progress: '{i}/{n}' / '{i}/{n}'
score: 'Очки' / 'Ұпай'
build: 'Собери число' / 'Санды құрастыр'
read: 'Какое это число в десятичной системе?' / 'Бұл ондық жүйеде қандай сан?'
property: 'Собери число по условию' / 'Шарт бойынша санды құрастыр'
goalEvenOnes: 'Чётное число, в котором единиц: {k}' / 'Бірліктер саны {k} болатын жұп сан'
goalNumber: 'Число {expr}' / '{expr} саны'   (expr = '2⁵' or '2⁵ − 1')
goalSmallest: 'Наименьшее число, у которого разрядов: {n}' / 'Разряд саны {n} болатын ең кіші сан'
goalOddGreater: 'Нечётное число больше {m}' / '{m} санынан үлкен тақ сан'
sum: 'Сумма' / 'Қосынды'
sumHidden: 'Сумма скрыта — считай в уме' / 'Қосынды жасырылған — ойша есепте'
flips: 'Переключений: {n}' / 'Ауыстырулар: {n}'
reset: 'Сброс' / 'Тазарту'
submit: 'Готово' / 'Дайын'
correct: 'Верно!' / 'Дұрыс!'
wrong: 'Неверно' / 'Қате'
perfect: 'Идеально: без лишних переключений' / 'Мінсіз: артық ауыстырусыз'
taskTimeUp: 'Время на задание вышло' / 'Тапсырма уақыты бітті'
retryLater: 'Это задание вернётся позже' / 'Бұл тапсырма кейін қайта келеді'
reasonOdd: 'Число нечётное: последний бит 1' / 'Сан тақ: соңғы бит 1'
reasonEven: 'Число чётное: последний бит 0' / 'Сан жұп: соңғы бит 0'
reasonOnes: 'Единиц: {have}, а нужно: {need}' / 'Бірліктер саны: {have}, ал керегі: {need}'
reasonDigits: 'Разрядов: {have}, а нужно: {need}' / 'Разряд саны: {have}, ал керегі: {need}'
reasonNotSmallest: 'Есть число меньше с тем же числом разрядов: {ex}' / 'Разряд саны бірдей, бірақ кішірек сан бар: {ex}'
reasonNotGreater: 'Число {v} не больше {m}' / '{v} саны {m} санынан үлкен емес'
reasonNotEqual: 'Получилось {v}, а нужно {n}' / '{v} шықты, ал керегі {n}'
example: 'Например: {bin}₂ = {n}' / 'Мысалы: {bin}₂ = {n}'
bitAria: 'Бит, вес {w}, {state}' / 'Бит, салмағы {w}, {state}'
bitOn: 'включён' / 'қосулы'
bitOff: 'выключен' / 'өшірулі'
next: 'Дальше' / 'Келесі'
timeUp: 'Время!' / 'Уақыт бітті!'
rules: 'Переключай биты, чтобы получить число. Чем меньше лишних переключений и быстрее ответ, тем больше очков. Задание с ошибкой вернётся в конце раунда.' / 'Санды алу үшін биттерді ауыстыр. Артық ауыстыру неғұрлым аз әрі жауап жылдам болса, ұпай соғұрлым көп. Қате кеткен тапсырма раунд соңында қайта келеді.'
```

## 🗂️ Сортировщик / Сұрыптағыш (`bit-sort`)

*Раскладывай карточки по корзинам по правилу: чётность, число разрядов, допустимые цифры.*

Навыки: ns.props, ns.base, ns.bin2dec

```text
ENGINE: content-agnostic classification. One card falls toward 2-3 labelled bins and the player sorts it by the active rule. Rules switch every 8 cards, which forces interleaving. A rule set is pure data plus a predicate: type RuleSet = { id; skill; title(params) -> L; bins: L[] (2-3); gen(rand, tier) -> Item; classify(item) -> binIndex; explain(item) -> L }, with Item = { label: string; value: number; extra?: any }. New topics (IP valid/invalid, AND true/false) add rule sets only. Merges concepts #1 and #12: rule switching and interleaving from #1, a single card at a time and data-only rule sets from #12. Wrong answers slow the game down instead of killing the run.

FILES: src/games/bit-sort/Game.tsx (default export, props { lang, sound, onFinish }) and strings.ts; the rule sets live in the same folder (rules.ts is fine, or inline). Helpers: toBinary; seeded, shuffle, tx, fmt; playSound, cn, Mascot. Optional read-only mastery from useApp.getState().skills (fallback 0.3); never write to the store.

RULE SETS FOR LESSON 1 (B = bits by tier: 4-5 / 5-6 / 7-8)
1. parity (ns.props): the item is a binary string such as '10110₂'. Bins: Чётное / Нечётное. classify = last bit. Explanation: the last digit decides.
2. digits (ns.props): the item is a decimal number. 3 bins with consecutive digit counts: tier 0 has 4/5/6 (numbers 8..63), tier 1 has 5/6/7 (16..127), tier 2 has 6/7/8 (32..255). classify = toBinary(n).length. Explanation: n = bin₂, digit count, with the hint 2^(k-1) <= n < 2^k.
3. shape (ns.props): the item is a binary string, 3 bins: '2ⁿ: 1 и нули', '2ⁿ − 1: все единицы', 'Другое'. Generate about 1/3 of each kind, length 3-5 / 4-6 / 5-8 by tier. Decoys for 'Другое' look close: 1001, 1110, 0111 is never shown (no leading zero), 11011.
4. base (ns.base): the item is a digit string with 3-5 digits. Tier 0 asks only whether it can be a binary number: half the strings use only 0 and 1, half contain exactly one digit from 2-9. Tier 1+ uses the binary question 50 % of the time and the octal question otherwise (half valid with digits 0-7, half containing an 8 or a 9). Bins: Может / Не может. Never a leading 0.
5. compare (ns.bin2dec): threshold T in 8..20 / 20..50 / 50..120 by tier. The item is a binary string of a value ≠ T; at tier 2 the value is close to T (±1..6). Bins: 'Меньше T' / 'Больше T'. Explanation: the weights sum, e.g. '10110₂ = 16 + 4 + 2 = 22'.
Order: parity first (easiest). Each next rule set is a weighted pick by (1.1 − mastery of its skill)^2, never the same set twice in a row. 75 s at ~3 s per card is about 22-25 cards, i.e. 3 rule sets per round. No identical item twice in a row; items are unique within one rule session.

ROUND FLOW
1. A banner 'Новое правило: <title>' shows for 1.2 s (animate-fade-in, the clock is paused), then the first card appears at the top of the play field.
2. The card falls via requestAnimationFrame (translateY from 0 to the top of the bins) over D seconds. D starts at 5.0 s, is multiplied by 0.92 after every 4 correct sorts (floor 2.2 s), and a wrong sort sets D = min(5.0, D / 0.92).
3. Decide by tapping a bin, swiping the card, or using the keyboard.
4. Correct: the card flies into the bin (180 ms CSS transition), the bin flashes bg-success-soft with a check icon, '+N' pops, playSound('correct'), streak + 1. The next card appears after 250 ms.
5. Wrong or timeout (the card reaches the bins untouched): the chosen bin flashes bg-danger-soft with animate-shake; the correct bin gets a 2 px success outline; an explanation strip appears under the play field (text-sm, e.g. '1011₂ — последняя цифра 1 → нечётное'). playSound('wrong'), streak = 0. The clock pauses for the explanation; continue on a tap, Enter or 'Дальше', auto after 2 s. The item is re-queued 3 cards later if the same rule is still active (once).
6. After 8 resolved cards of a rule, the next rule's banner appears. Rules only switch between cards, never while a card is falling.
7. End: 75 s on the round clock (which pauses during banners, explanations and a hidden tab), plus a 110 s wall-time cap. Show a 'Время!' overlay for 700 ms, playSound('complete'), then call onFinish once (useRef guard). A card still in flight is not logged.

TIER
- Start at 0; +1 after every 6 correct sorts (max 2). Two wrong in a row: −1 (min 0). The tier only changes item ranges, never the active rule mid-session.

SCORING
- Correct: (10 + round(5 × (1 − fallProgress))) × mult, where fallProgress is 0..1 at the moment of the decision. Multiplier from the streak: 0-3 x1, 4-7 x2, 8-11 x3, 12+ x4.
- Wrong or timeout: 0 points (the score never decreases).
- attempts[i] = { skill: ruleSet.skill, correct } for every resolved card. Call onFinish({ score, correct, total: attempts.length, attempts }).

INPUT
- Tap: the whole bin is a button.
- Swipe the card with pointer events (setPointerCapture). The card follows the finger horizontally. On release, with 2 bins: dx < −40 px goes left, dx > 40 px goes right. With 3 bins: dx < −40 goes left, dx > 40 goes right, dy > 40 with |dx| < 40 goes to the middle bin. Otherwise the card snaps back and keeps falling (the fall continues while dragging).
- Keyboard: ArrowLeft / ArrowRight (plus ArrowDown for the middle bin when there are 3), or digits 1-3. Enter continues after an explanation.

LAYOUT (390 px)
- Root: flex h-[calc(100dvh-56px)] w-full max-w-[640px] mx-auto flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] select-none touch-manipulation.
- Top row, h-11: score, combo chip (bg-streak-soft text-streak, hidden at x1), seconds and Mascot size 32. Under it, the 6 px clock bar.
- Rule chip, always visible under the clock: 'Правило: <title>' in bg-primary-soft text-primary rounded-full px-3 py-1 text-sm, allowed to wrap onto 2 lines.
- Play field: flex-1, relative, overflow-hidden. The card is centred horizontally, 168x76 px, bg-surface border-2 border-border rounded-2xl, font-mono text-3xl, NEUTRAL colour until judged. A faint dashed line marks the bin top.
- Explanation strip: min-h-10, aria-live, under the play field.
- Bins row, h-24: grid with 2 or 3 columns, gap-2. Each bin is rounded-2xl border-2 bg-surface-2, label text-base font-semibold (text-sm when there are 3 bins), wrapping allowed, with a small arrow hint (←, ↓, →) in the corner.
- First round only: a one-line hint 'Смахни карточку к корзине или нажми на корзину' above the bins until the first decision.

EDGE CASES
- Ignore input during the banner, the explanation and the fly-out animation.
- compare never generates value == T. base strings never start with 0. digits always has a correct bin among the 3 shown.
- Re-queued items are dropped if the rule changed.
- Pause on a hidden tab. On unmount, cancel rAF and timeouts and never call onFinish.
- prefers-reduced-motion: the card stays in place and a horizontal bar under it drains over D seconds instead of falling; no shake or fly-out.

ACCESSIBILITY
- The card has aria-label = the item text. Bins are buttons with aria-label = the bin label. The aria-live region announces the new rule, the result and the explanation.
- Colour is never the only signal (check and cross icons on bins); bins are >= 96 px tall; focus-visible rings.

STRINGS (strings.ts, key: ru / kk). In kk never attach a case suffix to an interpolated number; use the 'санынан / санымен' pattern.
score: 'Очки' / 'Ұпай'
rule: 'Правило: {title}' / 'Ереже: {title}'
newRule: 'Новое правило' / 'Жаңа ереже'
parityTitle: 'Чётное или нечётное?' / 'Жұп па, тақ па?'
binEven: 'Чётное' / 'Жұп'
binOdd: 'Нечётное' / 'Тақ'
explainParity: 'Последняя цифра {d} → {res}' / 'Соңғы цифр {d} → {res}'   (res: 'чётное'/'нечётное', 'жұп'/'тақ')
digitsTitle: 'Сколько разрядов в двоичной записи?' / 'Екілік жазбада неше разряд?'
binDigits: 'Разрядов: {n}' / '{n} разряд'
explainDigits: '{n} = {bin}₂ → разрядов: {k}' / '{n} = {bin}₂ → {k} разряд'
shapeTitle: 'Какой вид у числа?' / 'Сан қандай түрде?'
binPow: '2ⁿ: 1 и нули' / '2ⁿ: 1 және нөлдер'
binPowMinus: '2ⁿ − 1: все единицы' / '2ⁿ − 1: бәрі бірлік'
binOther: 'Другое' / 'Басқа'
explainPow: '{bin}₂: единица, затем только нули → степень двойки' / '{bin}₂: бір, одан кейін тек нөлдер → екінің дәрежесі'
explainPowMinus: '{bin}₂: только единицы → 2ⁿ − 1' / '{bin}₂: тек бірліктер → 2ⁿ − 1'
explainOther: '{bin}₂: не «1 и нули» и не «все единицы»' / '{bin}₂: «1 және нөлдер» де, «бәрі бірлік» те емес'
base2Title: 'Может ли это быть числом в двоичной системе?' / 'Бұл екілік жүйедегі сан бола ала ма?'
base8Title: 'Может ли это быть числом в восьмеричной системе?' / 'Бұл сегіздік жүйедегі сан бола ала ма?'
binCan: 'Может' / 'Бола алады'
binCannot: 'Не может' / 'Бола алмайды'
explainBad2: 'В двоичной системе только цифры 0 и 1, а здесь есть {d}' / 'Екілік жүйеде тек 0 және 1 цифрлары бар, ал мұнда {d} бар'
explainOk2: 'Только цифры 0 и 1 — подходит' / 'Тек 0 және 1 цифрлары — сәйкес келеді'
explainBad8: 'В восьмеричной системе цифры 0–7, а здесь есть {d}' / 'Сегіздік жүйенің цифрлары: 0–7, ал мұнда {d} бар'
explainOk8: 'Все цифры от 0 до 7 — подходит' / 'Барлық цифрлар 0–7 аралығында — сәйкес келеді'
compareTitle: 'Сравни с {t}₁₀' / '{t}₁₀ санымен салыстыр'
binLess: 'Меньше {t}' / '{t} санынан кіші'
binGreater: 'Больше {t}' / '{t} санынан үлкен'
explainCompare: '{bin}₂ = {terms} = {n}' / '{bin}₂ = {terms} = {n}'
cardTimeout: 'Карточка упала — время вышло' / 'Карточка түсіп кетті — уақыт бітті'
swipeHint: 'Смахни карточку к корзине или нажми на корзину' / 'Карточканы себетке қарай сырғыт немесе себетті бас'
correct: 'Верно!' / 'Дұрыс!'
wrong: 'Неверно' / 'Қате'
next: 'Дальше' / 'Келесі'
timeUp: 'Время!' / 'Уақыт бітті!'
rules: '75 секунд. Раскладывай карточки по корзинам согласно правилу. Правило меняется каждые 8 карточек — следи за заголовком.' / '75 секунд. Карточкаларды ереже бойынша себеттерге бөл. Ереже әр 8 карточкадан кейін ауысады — тақырыпты бақыла.'
```

## 🔍 Найди ошибку / Қатені тап (`bug-hunt`)

*Найди строку с ошибкой в готовом решении и исправь её — тренировка ловушек ЕНТ.*

Навыки: ns.dec2bin, ns.bin2dec, ns.props, ns.base

```text
ENGINE: content-agnostic practice on erroneous examples. A puzzle is data: { skill, header: L, lines: L[] (3-8), fault: null | { line, type, fixOptions: L[] (2-3, unique), fixCorrect, explain: L } }. Each template computes the CORRECT worked solution in code, then (in ~80 % of puzzles) mutates exactly one line with a typed mutation, so the answer is known without AI. Later topics (Python, algorithms, units) add templates and mutations only. Based on concept #9; it borrows the trap blocks of #3 (wrong remainder, wrong reading order) as mutation types and adds a short 'fix it' step after a correct find (recognition, then repair).

FILES: src/games/bug-hunt/Game.tsx (default export, props { lang, sound, onFinish }) and strings.ts; the templates can live in templates.ts in the same folder. Helpers: toBinary and divisionLadder(n) from '@/lib/check' (rows { value, quotient, remainder }); weightsSum(bin) from '@/lib/generators' if useful; seeded, shuffle, tx, fmt. A local sup(k) helper maps digits to superscripts (⁰¹²³⁴⁵⁶⁷⁸⁹). Optional read-only mastery from useApp.getState().skills (fallback 0.3); never write to the store.

LINE RULE: every line must be checkable on its own from the header and the previous lines. A mutation makes exactly that one line false and leaves every other line true.

TEMPLATES (tier ranges)
A. ladder (ns.dec2bin). Header 'Перевод {n} в двоичную систему'. n in 9..31 / 32..90 / 91..127 (5-8 lines). One line per divisionLadder row, '{v} : 2 = {q}, ост. {r}', plus 'Ответ: {bin}₂'. Mutations:
  - remainder: flip r in one row. Explanation: parity of v. Fix options: the row with ост. 0 and the row with ост. 1.
  - reversed: the answer is the remainders read top-down. Skip if the string is a palindrome. Fix options: the correct answer, the reversed answer, the answer with a dropped digit.
  - dropped: the answer is missing one digit (the leading 1). Fix options: the correct answer, the dropped answer, the reversed answer.
B. weights (ns.bin2dec). Header 'Перевод {bin}₂ в десятичную систему'. Lengths 4 / 5-6 / 7 (n 8..15 / 16..63 / 64..127). One line per digit, '{d} · 2{sup(k)} = {d·2^k}', plus 'Итого: {nonzero terms joined by ' + '} = {n}'. The sum line always uses the correct values. Mutations:
  - powerMul: a term with d = 1 and k >= 3 shows 2·k instead of 2^k (e.g. '1 · 2³ = 6').
  - zeroCounted: a term with d = 0 shows 2^k instead of 0.
  - sum: the total is off by ±1, ±2 or ± a weight that is not among the terms.
  - shift (tier >= 1): one term uses exponent k−1 with a consistent value; the position is wrong.
  Fix options: the correct line, the shown line, and one other plausible variant.
C. props (ns.props). Header 'Заметки о числе {n}'. n from the tier range of the generators (5-15 / 16-63 / 64-255). 4 lines: '{n} = {bin}₂', the parity claim, 'Разрядов в записи: {k}', 'Единиц в записи: {k}'. In 30 % of puzzles, replace one claim with '2{sup(k)} = 1 0…0₂' or '2{sup(k)} − 1 = 1…1₂'. Mutations: parity word swapped while the bit stays the same, digit count ±1, ones count ±1, a zero added or removed in 2^k, an extra 1 in 2^k − 1. Fix options: the correct claim and the shown claim (plus a ±1 variant for counts).
D. base (ns.base). Header 'Утверждения о системах счисления'. 4 distinct claims picked from: 'Цифры системы с основанием {b}: 0…{b−1}' (b in 2, 3, 5, 8, 10); 'В системе с основанием {b} разных цифр: {b}'; 'Запись {s} может быть двоичным числом' (s uses only 0 and 1); 'Запись {s} не может быть двоичным числом' (s contains 2-9); 'Наибольшая цифра восьмеричной системы: 7'. Mutations: max digit = b, count = b±1, the 'может' claim with an s that contains a 2, the 'не может' claim with an s that uses only 0 and 1, the largest octal digit = 8.
Pick templates with weight (1.1 − mastery of the skill)^2 and never the same template twice in a row. No-error puzzles appear 20 % of the time (25 % at tier 2), never twice in a row.

ROUND FLOW
1. The round clock is 90 s. The puzzle card slides in (animate-slide-up) with a per-puzzle timer: tier 0 gives 8 s + 2.0 s per line, tier 1 gives 6 s + 1.6 s per line, tier 2 gives 5 s + 1.3 s per line.
2. The player taps a line (the choice is immediate) or the big 'Ошибок нет' button.
3. Correct find (the faulty line, or 'Ошибок нет' when there is no fault): the line flashes success with a check icon, playSound('correct'), points, mascot happy. If there was a fault, a FIX sheet slides up from the bottom: 'Как должно быть?' with 2-3 full-width chips (font-mono, h-12) showing the line variants; it has an 8 s limit and the round clock pauses. Correct fix: +5, the line text is replaced by the corrected text in text-success. Wrong fix or timeout: the correct chip is highlighted. Then the explanation appears (see 4) and the game moves on.
4. Wrong find, a false alarm or a timeout: the real faulty line flashes danger with a cross icon, labelled 'Ошибка была здесь'. A tapped correct line shows 'Здесь всё верно'; if there was no fault, the text reads 'Ошибок не было — все строки верны'. A one-sentence explanation (fault.explain) appears under the card, playSound('wrong'), streak = 0, mascot sad. There is no fix step after a miss. The round clock pauses; continue on a tap, Enter or 'Дальше', auto after 4 s.
5. End: the round clock reaches 0, or the 120 s wall-time cap. Show a 'Время!' overlay for 700 ms, playSound('complete'), then call onFinish once (useRef guard). A puzzle in progress is not logged.

TIER
- Start at 0; +1 after every 3 correct finds (max 2); 2 wrong finds in a row give −1 (min 0).

SCORING
- A correct find (including a correct 'Ошибок нет') scores (10 + min(10, floor(seconds left on the puzzle))) × mult. Multiplier from the streak of correct finds: 0-2 x1, 3-5 x2, 6+ x3.
- A correct fix adds a flat +5. A wrong answer gives 0.
- attempts: one { skill, correct } per find decision (a timeout counts as false), plus one { skill, correct } per fix step. Call onFinish({ score, correct, total: attempts.length, attempts }).

LAYOUT (390 px)
- Root: flex h-[calc(100dvh-56px)] w-full max-w-[640px] mx-auto flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] select-none touch-manipulation.
- Top row, h-11: score, combo chip (bg-streak-soft text-streak), seconds and Mascot size 32 (mood 'thinking' while a puzzle is open). Under it, the 6 px round clock bar.
- Card: flex-1 overflow-y-auto, bg-surface border border-border rounded-2xl p-3. Header in text-sm text-muted; the prompt 'Найди строку с ошибкой' in text-base font-semibold; the per-puzzle timer bar is 4 px.
- Lines: a vertical list with gap-1.5. Each line is a full-width button, min-h-11, rounded-lg, text-left, whitespace-normal, with a 24 px gutter holding the line number (text-xs text-muted) and the text in font-mono text-[17px]. The idle state uses hover:bg-surface-2. 8 lines × 50 px fit in the card on a 390x844 phone.
- Bottom: an 'Ошибок нет' button, h-14, full width, border-2, bg-surface, font-semibold. The FIX sheet (absolute bottom-0, bg-surface, rounded-t-2xl, shadow, animate-slide-up) covers the bottom zone.
- Explanation zone: min-h-10 under the card, text-sm, aria-live.

EDGE CASES
- Assert that the mutated text differs from the correct text, and regenerate if not (e.g. a palindrome with reversed, or 2^k == 2k for k = 2).
- Fix options are unique and shuffled, with fixCorrect remapped. A no-error puzzle never shows a fix step.
- Lock input after a decision until the next phase. Ignore taps on lines during the fix step.
- Long kk claims wrap; never truncate them. Pause on a hidden tab. On unmount, cancel timers and never call onFinish.
- prefers-reduced-motion: no slide-up and no shake, instant colour states.

KEYBOARD AND ACCESSIBILITY
- Keys 1-8 pick a line, 0 or N picks 'Ошибок нет', 1-3 pick a fix chip in the fix step, Enter continues.
- Lines have aria-label 'Строка {i}: {text}'. The aria-live region announces the result and the explanation. Check and cross icons always accompany colour; focus-visible rings.

STRINGS (strings.ts, key: ru / kk). In kk never attach a case suffix to an interpolated number; attach it to 'сан' or 'жазба'.
score: 'Очки' / 'Ұпай'
findPrompt: 'Найди строку с ошибкой' / 'Қате жолды тап'
noError: 'Ошибок нет' / 'Қате жоқ'
fixPrompt: 'Как должно быть?' / 'Дұрысы қалай?'
found: 'Ошибка найдена!' / 'Қате табылды!'
fixed: 'Исправлено' / 'Түзетілді'
missedHere: 'Ошибка была здесь' / 'Қате осы жерде еді'
falseAlarm: 'Здесь всё верно' / 'Мұнда бәрі дұрыс'
noneWas: 'Ошибок не было — все строки верны' / 'Қате болған жоқ — барлық жолдар дұрыс'
puzzleTimeUp: 'Время на задание вышло' / 'Тапсырма уақыты бітті'
lineAria: 'Строка {i}: {text}' / '{i}-жол: {text}'
next: 'Дальше' / 'Келесі'
timeUp: 'Время!' / 'Уақыт бітті!'
hLadder: 'Перевод {n} в двоичную систему' / '{n} санын екілік жүйеге аудару'
hWeights: 'Перевод {bin}₂ в десятичную систему' / '{bin}₂ санын ондық жүйеге аудару'
hProps: 'Заметки о числе {n}' / '{n} саны туралы жазбалар'
hBase: 'Утверждения о системах счисления' / 'Санау жүйелері туралы тұжырымдар'
lLadderRow: '{v} : 2 = {q}, ост. {r}' / '{v} : 2 = {q}, қалдық {r}'
lAnswer: 'Ответ: {bin}₂' / 'Жауабы: {bin}₂'
lTotal: 'Итого: {terms} = {n}' / 'Барлығы: {terms} = {n}'
lOdd: '{n} — нечётное: последний бит 1' / '{n} — тақ: соңғы бит 1'
lEven: '{n} — чётное: последний бит 0' / '{n} — жұп: соңғы бит 0'
lOddWrong: '{n} — чётное: последний бит 1' / '{n} — жұп: соңғы бит 1'
lEvenWrong: '{n} — нечётное: последний бит 0' / '{n} — тақ: соңғы бит 0'
lLen: 'Разрядов в записи: {k}' / 'Жазбадағы разряд саны: {k}'
lOnes: 'Единиц в записи: {k}' / 'Жазбадағы бірлік саны: {k}'
lRange: 'Цифры системы с основанием {b}: 0…{max}' / 'Негізі {b} санау жүйесінің цифрлары: 0…{max}'
lCount: 'В системе с основанием {b} разных цифр: {c}' / 'Негізі {b} санау жүйесіндегі әртүрлі цифрлар саны: {c}'
lCanBin: 'Запись {s} может быть двоичным числом' / '{s} жазбасы екілік жүйедегі сан бола алады'
lCannotBin: 'Запись {s} не может быть двоичным числом' / '{s} жазбасы екілік жүйедегі сан бола алмайды'
lMax8: 'Наибольшая цифра восьмеричной системы: {d}' / 'Сегіздік жүйенің ең үлкен цифры: {d}'
eRemEven: '{v} — чётное, поэтому остаток 0' / '{v} — жұп, сондықтан қалдық 0'
eRemOdd: '{v} — нечётное, поэтому остаток 1' / '{v} — тақ, сондықтан қалдық 1'
eReversed: 'Остатки читают снизу вверх: {bin}₂' / 'Қалдықтар төменнен жоғары қарай оқылады: {bin}₂'
eDropped: 'Строк деления {k}, значит и цифр в ответе {k}: {bin}₂' / 'Бөлу жолдары {k}, демек жауаптағы цифрлар да {k}: {bin}₂'
ePowerMul: '2{exp} = {pow}, а не 2 · {k}' / '2{exp} = {pow}, 2 · {k} емес'
eZero: 'Цифра 0 даёт 0: 0 · 2{exp} = 0' / '0 цифры 0 береді: 0 · 2{exp} = 0'
eSum: 'Сумма {terms} равна {n}' / '{terms} қосындысы {n} санына тең'
eShift: 'Разряды нумеруют справа налево с нуля: вес этой цифры 2{exp} = {pow}' / 'Разрядтар оңнан солға қарай нөлден нөмірленеді: бұл цифрдың салмағы 2{exp} = {pow}'
eParity: 'Последний бит {b} — значит число {res}' / 'Соңғы бит {b} — демек сан {res}'   (res: 'чётное'/'нечётное', 'жұп'/'тақ')
eLen: 'В записи {bin}₂ разрядов: {k}' / '{bin}₂ жазбасында {k} разряд'
eOnes: 'В записи {bin}₂ единиц: {k}' / '{bin}₂ жазбасындағы бірлік саны: {k}'
ePow: '2{exp} — это единица и нули (нулей: {k}): {bin}₂' / '2{exp} — бір және нөлдер ({k} нөл): {bin}₂'
ePowMinus: '2{exp} − 1 — только единицы (единиц: {k}): {bin}₂' / '2{exp} − 1 — тек бірліктер ({k} бірлік): {bin}₂'
eRange: 'В системе с основанием {b} цифры от 0 до {max}' / 'Негізі {b} жүйенің цифрлары: 0…{max}'
eCount: 'Цифр столько же, сколько основание: {b}' / 'Цифрлар саны негізге тең: {b}'
eCanBin: 'В записи {s} есть цифра {d}, а в двоичной системе только 0 и 1' / '{s} жазбасында {d} цифры бар, ал екілік жүйеде тек 0 және 1'
eCannotBin: 'В записи {s} только 0 и 1 — это может быть двоичное число' / '{s} жазбасында тек 0 және 1 — бұл екілік сан бола алады'
eMax8: 'В восьмеричной системе цифры 0…7, наибольшая: 7' / 'Сегіздік жүйенің цифрлары: 0…7, ең үлкені: 7'
rules: '90 секунд. В каждом решении не больше одной ошибки — найди строку и исправь её. Иногда ошибок нет: тогда жми «Ошибок нет».' / '90 секунд. Әр шешімде ең көбі бір қате бар — жолды тауып, түзет. Кейде қате болмайды: онда «Қате жоқ» батырмасын бас.'
```

## Бэклог

См. docs/ROADMAP.md → «Бэклог мини-игр».