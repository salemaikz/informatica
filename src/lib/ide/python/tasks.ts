import type { IdeTask } from "../types";
import type { PyForbid } from "./check";

// Задачи «Практикума» — Python (ЕНТ: ввод-вывод, ветвления, циклы, строки, списки, функции, алгоритмы).
// Стиль как в ЕНТ: короткое условие, ввод — строки stdin, вывод — через print. Слова в выводе — латиницей (even/odd, yes/no),
// чтобы не зависеть от языка интерфейса. Тесты эталонов — tests/ide-python.test.ts (системный python3).
export const TASKS: IdeTask[] = [
  {
    id: "py-1-hello",
    lang: "python",
    level: 1,
    skill: "py.vars",
    title: { ru: "Вывод и арифметика", kk: "Шығару және арифметика" },
    prompt: {
      ru: "Выведите сумму, разность и произведение чисел 12 и 5 — каждое на отдельной строке.\n\nОжидаемый вывод:\n\n```\n17\n7\n60\n```",
      kk: "12 және 5 сандарының қосындысын, айырмасын және көбейтіндісін шығарыңыз — әрқайсысы жеке жолға.\n\nКүтілетін шығыс:\n\n```\n17\n7\n60\n```",
    },
    starter: "print(12 + 5)\n",
    hint: {
      ru: "`print(12 + 5)` выводит сумму. Добавьте ещё две строки с `print` — для вычитания `-` и умножения `*`.",
      kk: "`print(12 + 5)` қосындыны шығарады. Азайту `-` және көбейту `*` үшін тағы екі `print` жолын қосыңыз.",
    },
    solution: "print(12 + 5)\nprint(12 - 5)\nprint(12 * 5)\n",
    check: { kind: "python", tests: [{ stdout: "17\n7\n60" }] },
  },
  {
    id: "py-2-sum",
    lang: "python",
    level: 1,
    skill: "py.vars",
    title: { ru: "Сумма двух чисел", kk: "Екі санның қосындысы" },
    prompt: {
      ru: "Программа получает два целых числа — каждое на своей строке. Выведите их сумму.\n\nПример: ввод `3` и `5` → вывод `8`.",
      kk: "Программа екі бүтін сан алады — әрқайсысы жеке жолда. Олардың қосындысын шығарыңыз.\n\nМысал: енгізу `3` және `5` → шығыс `8`.",
    },
    starter: "a = int(input())\nb = int(input())\n",
    hint: {
      ru: "`input()` читает строку, а `int(...)` превращает её в число.",
      kk: "`input()` жолды оқиды, ал `int(...)` оны санға айналдырады.",
    },
    solution: "a = int(input())\nb = int(input())\nprint(a + b)\n",
    check: {
      kind: "python",
      tests: [
        { stdin: "3\n5\n", stdout: "8" },
        { stdin: "-4\n10\n", stdout: "6" },
        { stdin: "100\n250\n", stdout: "350" },
      ],
    },
  },
  {
    id: "py-3-parity",
    lang: "python",
    level: 1,
    skill: "py.if",
    title: { ru: "Чётное или нечётное", kk: "Жұп па, тақ па" },
    prompt: {
      ru: "Дано целое число. Выведите слово `even`, если оно чётное, и `odd` — если нечётное.",
      kk: "Бүтін сан берілген. Сан жұп болса, `even`, тақ болса, `odd` сөзін шығарыңыз.",
    },
    starter: "n = int(input())\n",
    hint: {
      ru: "Число чётное, если остаток от деления на 2 равен нулю: `n % 2 == 0`. Используйте `if` и `else`.",
      kk: "Санды 2-ге бөлгендегі қалдық нөлге тең болса, ол жұп болады: `n % 2 == 0`. `if` және `else` қолданыңыз.",
    },
    solution: 'n = int(input())\nif n % 2 == 0:\n    print("even")\nelse:\n    print("odd")\n',
    check: {
      kind: "python",
      tests: [
        { stdin: "7\n", stdout: "odd" },
        { stdin: "10\n", stdout: "even" },
        { stdin: "0\n", stdout: "even" },
        { stdin: "-3\n", stdout: "odd" },
      ],
    },
  },
  {
    id: "py-4-max3",
    lang: "python",
    level: 2,
    skill: "py.if",
    title: { ru: "Наибольшее из трёх", kk: "Үшеуінің ең үлкені" },
    prompt: {
      ru: "Даны три целых числа (каждое на своей строке). Выведите наибольшее из них. Решите с помощью `if`, без функции `max`.",
      kk: "Үш бүтін сан берілген (әрқайсысы жеке жолда). Олардың ең үлкенін шығарыңыз. `if` арқылы шешіңіз, `max` функциясын қолданбаңыз.",
    },
    starter: "a = int(input())\nb = int(input())\nc = int(input())\n",
    hint: {
      ru: "Сначала решите, что наибольшее — `a`. Если `b` больше, замените на `b`; затем так же сравните с `c`.",
      kk: "Алдымен ең үлкені — `a` деп алыңыз. `b` одан үлкен болса, ең үлкені — `b`; содан кейін `c` санымен де солай салыстырыңыз.",
    },
    solution: "a = int(input())\nb = int(input())\nc = int(input())\nbest = a\nif b > best:\n    best = b\nif c > best:\n    best = c\nprint(best)\n",
    check: {
      kind: "python",
      tests: [
        { stdin: "3\n9\n5\n", stdout: "9" },
        { stdin: "10\n2\n7\n", stdout: "10" },
        { stdin: "-1\n-5\n-3\n", stdout: "-1" },
        { stdin: "4\n4\n4\n", stdout: "4" },
        { stdin: "1\n2\n3\n", stdout: "3" },
        { stdin: "7\n7\n2\n", stdout: "7" },
        { stdin: "5\n1\n5\n", stdout: "5" },
      ],
    },
  },
  {
    id: "py-5-sum-for",
    lang: "python",
    level: 2,
    skill: "py.loops",
    title: { ru: "Сумма от 1 до n (цикл for)", kk: "1-ден n санына дейінгі қосынды (for циклі)" },
    prompt: {
      ru: "Дано натуральное число `n`. Выведите сумму 1 + 2 + … + n. Используйте цикл `for`.\n\nПример: `n = 5` → `15`.",
      kk: "`n` натурал саны берілген. 1 + 2 + … + n қосындысын шығарыңыз. `for` циклін қолданыңыз.\n\nМысал: `n = 5` → `15`.",
    },
    starter: "n = int(input())\ntotal = 0\n",
    hint: {
      ru: "`for i in range(1, n + 1):` перебирает числа от 1 до n. На каждом шаге прибавляйте `i` к `total`.",
      kk: "`for i in range(1, n + 1):` 1-ден бастап n санына дейінгі сандарды аралайды. Әр қадамда `i` санын `total` айнымалысына қосыңыз.",
    },
    solution: "n = int(input())\ntotal = 0\nfor i in range(1, n + 1):\n    total += i\nprint(total)\n",
    check: {
      kind: "python",
      tests: [
        { stdin: "1\n", stdout: "1" },
        { stdin: "5\n", stdout: "15" },
        { stdin: "10\n", stdout: "55" },
        { stdin: "100\n", stdout: "5050" },
      ],
    },
  },
  {
    id: "py-6-digit-sum",
    lang: "python",
    level: 2,
    skill: "py.loops",
    title: { ru: "Сумма цифр числа (цикл while)", kk: "Сан цифрларының қосындысы (while циклі)" },
    prompt: {
      ru: "Дано натуральное число. Выведите сумму его цифр. Используйте цикл `while`.\n\nПример: `123` → `6`.",
      kk: "Натурал сан берілген. Оның цифрларының қосындысын шығарыңыз. `while` циклін қолданыңыз.\n\nМысал: `123` → `6`.",
    },
    starter: "n = int(input())\ntotal = 0\n",
    hint: {
      ru: "Последняя цифра — `n % 10`, а число без последней цифры — `n // 10`. Повторяйте, пока `n > 0`.",
      kk: "Соңғы цифр — `n % 10`, ал соңғы цифрсыз сан — `n // 10`. `n > 0` болғанша қайталаңыз.",
    },
    solution: "n = int(input())\ntotal = 0\nwhile n > 0:\n    total += n % 10\n    n //= 10\nprint(total)\n",
    check: {
      kind: "python",
      tests: [
        { stdin: "123\n", stdout: "6" },
        { stdin: "7\n", stdout: "7" },
        { stdin: "9999\n", stdout: "36" },
        { stdin: "1000\n", stdout: "1" },
        { stdin: "2026\n", stdout: "10" },
      ],
    },
  },
  {
    id: "py-7-vowels",
    lang: "python",
    level: 2,
    skill: "py.strings",
    title: { ru: "Гласные в строке", kk: "Жолдағы дауысты әріптер" },
    prompt: {
      ru: "Дана строка из латинских букв и пробелов. Выведите, сколько в ней гласных `a`, `e`, `i`, `o`, `u` (заглавные тоже считаются).\n\nПример: `informatics` → `4`.",
      kk: "Латын әріптері мен бос орындардан тұратын жол берілген. Ондағы `a`, `e`, `i`, `o`, `u` дауысты әріптерінің санын шығарыңыз (бас әріптер де есептеледі).\n\nМысал: `informatics` → `4`.",
    },
    starter: "s = input()\ncount = 0\n",
    hint: {
      ru: 'Переберите символы циклом `for ch in s:` и проверяйте условие `ch.lower() in "aeiou"`.',
      kk: '`for ch in s:` циклімен жолдың таңбаларын аралап, `ch.lower() in "aeiou"` шартын тексеріңіз.',
    },
    solution: 's = input()\ncount = 0\nfor ch in s:\n    if ch.lower() in "aeiou":\n        count += 1\nprint(count)\n',
    check: {
      kind: "python",
      tests: [
        { stdin: "informatics\n", stdout: "4" },
        { stdin: "Hello World\n", stdout: "3" },
        { stdin: "rhythm\n", stdout: "0" },
        { stdin: "AEIOU\n", stdout: "5" },
        { stdin: "Python programming\n", stdout: "4" },
      ],
    },
  },
  {
    id: "py-8-list-stats",
    lang: "python",
    level: 2,
    skill: "py.lists",
    title: { ru: "Среднее и наибольшее в списке", kk: "Тізімдегі орташа мән және ең үлкен сан" },
    prompt: {
      ru: "В первой строке — количество чисел `n`, во второй — сами числа через пробел. Выведите среднее арифметическое (результат обычного деления `/`) и наибольшее число — каждое на своей строке.\n\nПример: `5` и `3 9 4 8 6` → `6.0` и `9`.",
      kk: "Бірінші жолда — сандар саны `n`, екінші жолда — сандардың өздері бос орын арқылы. Орташа арифметикалық мәнді (кәдімгі `/` бөлудің нәтижесін) және ең үлкен санды шығарыңыз — әрқайсысы жеке жолға.\n\nМысал: `5` және `3 9 4 8 6` → `6.0` және `9`.",
    },
    starter: "n = int(input())\na = list(map(int, input().split()))\n",
    hint: {
      ru: "Пригодятся `sum(a)`, `len(a)` и `max(a)`. Среднее — это сумма, делённая на количество.",
      kk: "`sum(a)`, `len(a)` және `max(a)` керек болады. Орташа мән — қосындыны сандар санына бөлгендегі нәтиже.",
    },
    solution: "n = int(input())\na = list(map(int, input().split()))\nprint(sum(a) / len(a))\nprint(max(a))\n",
    check: {
      kind: "python",
      tests: [
        { stdin: "5\n3 9 4 8 6\n", stdout: "6.0\n9" },
        { stdin: "4\n1 2 3 4\n", stdout: "2.5\n4" },
        { stdin: "3\n-5 -1 -3\n", stdout: "-3.0\n-1" },
        { stdin: "1\n42\n", stdout: "42.0\n42" },
      ],
    },
  },
  {
    id: "py-9-function",
    lang: "python",
    level: 3,
    skill: "py.functions",
    title: { ru: "Функция: простое число", kk: "Функция: жай сан" },
    prompt: {
      ru: "Напишите функцию `is_prime(n)`: она возвращает `True`, если число `n` простое, и `False`, если нет (число 1 не простое). Программа читает число и выводит `yes` или `no`.\n\nПример: `17` → `yes`, `18` → `no`.",
      kk: "Егер `n` саны жай болса `True`, әйтпесе `False` қайтаратын `is_prime(n)` функциясын жазыңыз (1 саны жай емес). Бағдарлама санды оқиды да, `yes` немесе `no` шығарады.\n\nМысал: `17` → `yes`, `18` → `no`.",
    },
    starter: 'def is_prime(n):\n    return False\n\n\nn = int(input())\nif is_prime(n):\n    print("yes")\nelse:\n    print("no")\n',
    hint: {
      ru: "Число простое, если у него нет делителей, начиная с 2 и пока `d * d <= n`. Проверяйте `n % d == 0`. Не забудьте про `n < 2`.",
      kk: "Сан жай болу үшін оның 2-ден бастап `d * d <= n` болғанша бөлгіштері болмауы керек. `n % d == 0` шартын тексеріңіз. `n < 2` жағдайын ұмытпаңыз.",
    },
    solution:
      'def is_prime(n):\n    if n < 2:\n        return False\n    d = 2\n    while d * d <= n:\n        if n % d == 0:\n            return False\n        d += 1\n    return True\n\n\nn = int(input())\nif is_prime(n):\n    print("yes")\nelse:\n    print("no")\n',
    check: {
      kind: "python",
      tests: [
        { stdin: "2\n", stdout: "yes" },
        { stdin: "1\n", stdout: "no" },
        { stdin: "17\n", stdout: "yes" },
        { stdin: "18\n", stdout: "no" },
        { stdin: "91\n", stdout: "no" },
        { stdin: "97\n", stdout: "yes" },
        { stdin: "9\n", stdout: "no" },
        { stdin: "49\n", stdout: "no" },
        { stdin: "4\n", stdout: "no" },
      ],
    },
  },
  {
    id: "py-10-binary",
    lang: "python",
    level: 3,
    skill: "py.algos",
    title: { ru: "Перевод в двоичную систему", kk: "Екілік жүйеге аудару" },
    prompt: {
      ru: "Дано натуральное число `n`. Выведите его запись в двоичной системе счисления. Функции `bin` и `format` не используйте — переводите вручную: делите на 2 и собирайте остатки.\n\nПример: `10` → `1010`.",
      kk: "`n` натурал саны берілген. Оның екілік санау жүйесіндегі жазбасын шығарыңыз. `bin` және `format` функцияларын қолданбаңыз — қолмен аударыңыз: 2-ге бөліп, қалдықтарды жинаңыз.\n\nМысал: `10` → `1010`.",
    },
    starter: 'n = int(input())\ns = ""\n',
    hint: {
      ru: "Пока `n > 0`: припишите слева к строке `s` остаток `n % 2` (как строку, `str(...)`), затем замените `n` на `n // 2`.",
      kk: "`n > 0` болғанша: `s` жолының сол жағына `n % 2` қалдығын (жол ретінде, `str(...)`) жалғаңыз, содан кейін `n` мәнін `n // 2` мәніне ауыстырыңыз.",
    },
    solution: 'n = int(input())\ns = ""\nwhile n > 0:\n    s = str(n % 2) + s\n    n //= 2\nprint(s)\n',
    check: {
      kind: "python",
      tests: [
        { stdin: "10\n", stdout: "1010" },
        { stdin: "1\n", stdout: "1" },
        { stdin: "37\n", stdout: "100101" },
        { stdin: "64\n", stdout: "1000000" },
        { stdin: "255\n", stdout: "11111111" },
      ],
    },
  },
];

/** Ограничения из условия задач (проверяются до запуска). Ключ — id задачи. */
export const PY_FORBID: Record<string, PyForbid[]> = {
  "py-4-max3": [
    {
      re: "\\bmax\\s*\\(",
      why: { ru: "В этой задаче функцию max использовать нельзя — сравните числа через if.", kk: "Бұл есепте max функциясын қолдануға болмайды — сандарды if арқылы салыстырыңыз." },
    },
  ],
  "py-10-binary": [
    {
      re: "\\b(bin|format)\\s*\\(",
      why: { ru: "Функции bin и format использовать нельзя — переводите вручную: делите на 2 и собирайте остатки.", kk: "bin және format функцияларын қолдануға болмайды — қолмен аударыңыз: 2-ге бөліп, қалдықтарды жинаңыз." },
    },
    {
      re: "\\bf[\"'][^\"'\\n]*:[#0-9]*b\\}",
      inStrings: true,
      why: { ru: "Форматирование f\"{n:b}\" использовать нельзя — переводите вручную: делите на 2 и собирайте остатки.", kk: "f\"{n:b}\" пішімдеуін қолдануға болмайды — қолмен аударыңыз: 2-ге бөліп, қалдықтарды жинаңыз." },
    },
  ],
};
