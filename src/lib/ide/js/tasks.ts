import type { IdeTask } from "../types";

// Задачи JavaScript (docs/specs/ide.md, I3): 6 базовых задач + 4 задачи курса 2.0 (docs/specs/ide-v2.md), всего 10, от A к C. Навыка курса нет — JavaScript в ҰБТ почти не встречается,
// это база для веба. Проверка — вывод console.log (check.ts). Эталоны гоняются в node:vm (tests/ide-js.test.ts).
// Строки в выводе — латиницей: код и вывод не переводятся.

const BASE: IdeTask[] = [
  {
    id: "js-1-log",
    lang: "js",
    level: 1,
    title: { ru: "Вывод строки", kk: "Жолды шығару" },
    prompt: {
      ru: "Выведите на экран строку `Hello, world!` с помощью `console.log`.",
      kk: "`console.log` көмегімен экранға `Hello, world!` жолын шығарыңыз.",
    },
    starter: "// ...\n",
    hint: {
      ru: "Текст берётся в кавычки и пишется в скобках: `console.log(\"…\");`.",
      kk: "Мәтін тырнақшаға алынып, жақшаның ішіне жазылады: `console.log(\"…\");`.",
    },
    solution: 'console.log("Hello, world!");',
    check: { kind: "js", stdout: "Hello, world!" },
  },
  {
    id: "js-2-vars",
    lang: "js",
    level: 1,
    title: { ru: "Переменные и арифметика", kk: "Айнымалылар және арифметика" },
    prompt: {
      ru: "Даны переменные `a` и `b`. Выведите их сумму, разность (`a - b`) и произведение — каждое число с новой строки.",
      kk: "`a` және `b` айнымалылары берілген. Олардың қосындысын, айырмасын (`a - b`) және көбейтіндісін шығарыңыз — әр сан жаңа жолдан.",
    },
    starter: "let a = 12;\nlet b = 5;\n\n// ...\n",
    hint: {
      ru: "Каждое `console.log` печатает одну строку: сначала `a + b`, затем `a - b`, затем `a * b`.",
      kk: "Әр `console.log` бір жол шығарады: алдымен `a + b`, одан кейін `a - b`, сосын `a * b`.",
    },
    solution: "let a = 12;\nlet b = 5;\n\nconsole.log(a + b);\nconsole.log(a - b);\nconsole.log(a * b);",
    check: { kind: "js", stdout: "17\n7\n60" },
  },
  {
    id: "js-3-if",
    lang: "js",
    level: 1,
    title: { ru: "Условие if", kk: "if шарты" },
    prompt: {
      ru: "Допишите функцию `status(age)`: если `age` не меньше 18 — она возвращает `adult`, иначе `minor`. Вызовы ниже выведут результаты.",
      kk: "`status(age)` функциясын аяқтаңыз: егер `age` 18-ден кем болмаса — `adult`, әйтпесе `minor` қайтарсын. Төмендегі шақырулар нәтижелерді шығарады.",
    },
    starter: "function status(age) {\n  // ...\n}\n\nconsole.log(status(16));\nconsole.log(status(18));\nconsole.log(status(30));\n",
    hint: {
      ru: "Конструкция: `if (условие) { return … } else { return … }`. «Не меньше» записывается как `>=`; число 18 уже считается взрослым.",
      kk: "Құрылымы: `if (шарт) { return … } else { return … }`. «Кем емес» дегені `>=` түрінде жазылады; 18 жас та ересек болып саналады.",
    },
    solution: 'function status(age) {\n  if (age >= 18) {\n    return "adult";\n  } else {\n    return "minor";\n  }\n}\n\nconsole.log(status(16));\nconsole.log(status(18));\nconsole.log(status(30));',
    check: { kind: "js", stdout: "minor\nadult\nadult" },
  },
  {
    id: "js-4-for",
    lang: "js",
    level: 2,
    title: { ru: "Цикл for", kk: "for циклі" },
    prompt: {
      ru: "С помощью цикла `for` выведите числа от 1 до 5, каждое с новой строки.",
      kk: "`for` циклі арқылы 1-ден 5-ке дейінгі сандарды шығарыңыз, әрқайсысы жаңа жолдан.",
    },
    starter: "for (let i = 0; i < 0; i++) {\n  // ...\n}\n",
    hint: {
      ru: "В заголовке цикла три части: начало (`let i = 1`), условие продолжения (`i <= 5`) и шаг (`i++`).",
      kk: "Цикл тақырыбында үш бөлік бар: басы (`let i = 1`), жалғастыру шарты (`i <= 5`) және қадам (`i++`).",
    },
    solution: "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}",
    check: { kind: "js", stdout: "1\n2\n3\n4\n5" },
  },
  {
    id: "js-5-func",
    lang: "js",
    level: 2,
    title: { ru: "Функция", kk: "Функция" },
    prompt: {
      ru: "Допишите функцию `square(n)`: она должна возвращать квадрат числа `n` (команда `return`). Вызовы ниже выведут результаты.",
      kk: "`square(n)` функциясын аяқтаңыз: ол `n` санының квадратын қайтаруы керек (`return` командасы). Төмендегі шақырулар нәтижелерді шығарады.",
    },
    starter: "function square(n) {\n  // ...\n}\n\nconsole.log(square(4));\nconsole.log(square(-3));\nconsole.log(square(10));\n",
    hint: {
      ru: "Внутри функции напишите `return n * n;` — тогда вызов `square(4)` даст 16.",
      kk: "Функция ішіне `return n * n;` деп жазыңыз — сонда `square(4)` шақыруы 16 береді.",
    },
    solution: "function square(n) {\n  return n * n;\n}\n\nconsole.log(square(4));\nconsole.log(square(-3));\nconsole.log(square(10));",
    check: { kind: "js", stdout: "16\n9\n100" },
  },
  {
    id: "js-6-array",
    lang: "js",
    level: 3,
    title: { ru: "Массив и сумма", kk: "Массив және қосынды" },
    prompt: {
      ru: "Дан массив `nums`. Найдите сумму всех его элементов с помощью цикла и выведите её.",
      kk: "`nums` массиві берілген. Цикл көмегімен оның барлық элементтерінің қосындысын тауып, шығарыңыз.",
    },
    starter: "const nums = [3, 8, 1, 6, 2];\nlet sum = 0;\n\n// ...\n\nconsole.log(sum);\n",
    hint: {
      ru: "Пройдите по массиву циклом (`for` по индексу или `for (const x of nums)`) и прибавляйте каждый элемент к `sum`.",
      kk: "Массивті циклмен аралап (индекс бойынша `for` немесе `for (const x of nums)`) әр элементті `sum` айнымалысына қосыңыз.",
    },
    solution: "const nums = [3, 8, 1, 6, 2];\nlet sum = 0;\n\nfor (const x of nums) {\n  sum += x;\n}\n\nconsole.log(sum);",
    check: { kind: "js", stdout: "20" },
  },
];

// Задачи курса 2.0: строки, цикл с условием, map/filter, функция со строкой.
const V2: IdeTask[] = [
  {
    id: "js-7-string",
    lang: "js",
    level: 1,
    title: { ru: "Длина и регистр строки", kk: "Жолдың ұзындығы және регистрі" },
    prompt: {
      ru: "Дана строка `s`. Выведите её длину, затем строку заглавными буквами, затем первый символ — каждое значение с новой строки.",
      kk: "`s` жолы берілген. Оның ұзындығын, одан кейін жолды бас әріптермен, сосын бірінші символын шығарыңыз — әр мән жаңа жолдан.",
    },
    starter: 'let s = "informatics";\n\n// ...\n',
    hint: {
      ru: "Длина — свойство `s.length` (без скобок), заглавные буквы — метод `s.toUpperCase()`, первый символ — `s[0]`: нумерация с нуля.",
      kk: "Ұзындық — `s.length` қасиеті (жақшасыз), бас әріптер — `s.toUpperCase()` әдісі, бірінші символ — `s[0]`: нөмірлеу нөлден басталады.",
    },
    solution: 'let s = "informatics";\n\nconsole.log(s.length);\nconsole.log(s.toUpperCase());\nconsole.log(s[0]);',
    check: { kind: "js", stdout: "11\nINFORMATICS\ni" },
  },
  {
    id: "js-8-even",
    lang: "js",
    level: 2,
    title: { ru: "Чётные числа", kk: "Жұп сандар" },
    prompt: {
      ru: "С помощью цикла `for` и условия `if` выведите все чётные числа от 1 до 10, каждое с новой строки.",
      kk: "`for` циклі мен `if` шарты арқылы 1-ден 10-ға дейінгі барлық жұп сандарды шығарыңыз, әрқайсысы жаңа жолдан.",
    },
    starter: "for (let i = 1; i <= 10; i++) {\n  // ...\n}\n",
    hint: {
      ru: "Число чётное, если остаток от деления на 2 равен нулю: `i % 2 === 0`. Печатайте `i` только внутри `if`.",
      kk: "Сан 2-ге бөлгендегі қалдық нөлге тең болса, жұп болады: `i % 2 === 0`. `i` мәнін тек `if` ішінде шығарыңыз.",
    },
    solution: "for (let i = 1; i <= 10; i++) {\n  if (i % 2 === 0) {\n    console.log(i);\n  }\n}",
    check: { kind: "js", stdout: "2\n4\n6\n8\n10" },
  },
  {
    id: "js-9-filter",
    lang: "js",
    level: 3,
    title: { ru: "filter и map", kk: "filter және map" },
    prompt: {
      ru: "Дан массив `nums`. Оставьте в нём только чётные числа (`filter`), возведите каждое в квадрат (`map`) и выведите результат одной строкой через пробел (`join(\" \")`).",
      kk: "`nums` массиві берілген. Одан тек жұп сандарды қалдырыңыз (`filter`), әрқайсысын квадраттаңыз (`map`) және нәтижені бос орынмен бөліп бір жолға шығарыңыз (`join(\" \")`).",
    },
    starter: 'const nums = [5, 12, 7, 8, 3, 10, 4];\nconst result = [];\n\n// ...\n\nconsole.log(result.join(" "));\n',
    hint: {
      ru: "Методы можно записать цепочкой: `nums.filter(x => …).map(x => …)`. В `filter` функция возвращает условие, в `map` — новое значение.",
      kk: "Әдістерді тізбектеп жазуға болады: `nums.filter(x => …).map(x => …)`. `filter` ішіндегі функция шартты, `map` ішіндегі функция жаңа мәнді қайтарады.",
    },
    solution: 'const nums = [5, 12, 7, 8, 3, 10, 4];\nconst result = nums.filter((x) => x % 2 === 0).map((x) => x * x);\n\nconsole.log(result.join(" "));',
    check: { kind: "js", stdout: "144 64 100 16" },
  },
  {
    id: "js-10-palindrome",
    lang: "js",
    level: 3,
    title: { ru: "Палиндром", kk: "Палиндром" },
    prompt: {
      ru: "Допишите функцию `isPalindrome(s)`: она возвращает `yes`, если строка читается одинаково слева направо и справа налево, иначе `no`. Вызовы ниже выведут результаты.",
      kk: "`isPalindrome(s)` функциясын аяқтаңыз: жол солдан оңға да, оңнан солға да бірдей оқылса, `yes`, әйтпесе `no` қайтарсын. Төмендегі шақырулар нәтижелерді шығарады.",
    },
    starter: 'function isPalindrome(s) {\n  // ...\n}\n\nconsole.log(isPalindrome("level"));\nconsole.log(isPalindrome("python"));\nconsole.log(isPalindrome("kazak"));\n',
    hint: {
      ru: "Переверните строку: `s.split(\"\").reverse().join(\"\")` — и сравните результат с самой `s` через `===`.",
      kk: "Жолды аударыңыз: `s.split(\"\").reverse().join(\"\")` — және нәтижені `s` жолының өзімен `===` арқылы салыстырыңыз.",
    },
    solution:
      'function isPalindrome(s) {\n  const rev = s.split("").reverse().join("");\n  if (rev === s) {\n    return "yes";\n  }\n  return "no";\n}\n\nconsole.log(isPalindrome("level"));\nconsole.log(isPalindrome("python"));\nconsole.log(isPalindrome("kazak"));',
    check: { kind: "js", stdout: "yes\nno\nyes" },
  },
];

/** Все задачи; порядок — от A к C (сортировка устойчивая: внутри уровня базовые задачи идут первыми). */
export const TASKS: IdeTask[] = [...BASE, ...V2].sort((a, b) => a.level - b.level);
