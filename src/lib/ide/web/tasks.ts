import type { IdeTask } from "../types";

// Задачи HTML/CSS (docs/specs/ide.md, I3): 8 базовых задач + 6 задач курса 2.0 (docs/specs/ide-v2.md), всего 14, от A к C. Один документ — HTML со <style>.
// Тексты на странице (My site, Python…) — латиницей и без перевода: ученик набирает их в коде как есть.
// Правильность решает checks.ts: структура — скриптом в iframe, CSS — разбором <style>.

const SKELETON = `<!DOCTYPE html>
<html>
<body>
  <!-- ... -->
</body>
</html>`;

const BASE: IdeTask[] = [
  {
    id: "web-1-h1",
    lang: "web",
    level: 1,
    skill: "web.html",
    title: { ru: "Заголовок", kk: "Тақырып" },
    prompt: {
      ru: "Создайте на странице заголовок первого уровня `<h1>` с текстом `My site`.",
      kk: "Бетте мәтіні `My site` болатын бірінші деңгейлі `<h1>` тақырыбын жасаңыз.",
    },
    starter: SKELETON,
    hint: {
      ru: "Заголовок пишется парой тегов: открывающий `<h1>`, текст и закрывающий `</h1>`. Всё это — внутри `<body>`.",
      kk: "Тақырып тегтер жұбымен жазылады: ашатын `<h1>`, мәтін және жабатын `</h1>`. Мұның бәрі `<body>` ішінде болады.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <h1>My site</h1>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        {
          type: "exists",
          selector: "h1",
          count: 1,
          why: { ru: "На странице должен быть один заголовок `<h1>`.", kk: "Бетте бір `<h1>` тақырыбы болуы керек." },
        },
        {
          type: "text",
          selector: "h1",
          equals: "My site",
          why: { ru: "Текст заголовка должен быть `My site`.", kk: "Тақырыптың мәтіні `My site` болуы керек." },
        },
      ],
    },
  },
  {
    id: "web-2-text",
    lang: "web",
    level: 1,
    skill: "web.html",
    title: { ru: "Абзац и жирный текст", kk: "Абзац және қалың мәтін" },
    prompt: {
      ru: "Добавьте абзац `<p>` с текстом `I study informatics`. Слово `informatics` выделите жирным: `<b>` или `<strong>`.",
      kk: "Мәтіні `I study informatics` болатын `<p>` абзацын қосыңыз. `informatics` сөзін қалың етіп белгілеңіз: `<b>` немесе `<strong>`.",
    },
    starter: SKELETON,
    hint: {
      ru: "Тег жирного текста стоит внутри абзаца и обрамляет только одно слово: `<p>I study <b>…</b></p>`.",
      kk: "Қалың мәтін тегі абзацтың ішінде тұрады және тек бір сөзді қамтиды: `<p>I study <b>…</b></p>`.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <p>I study <b>informatics</b></p>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "p", min: 1, why: { ru: "На странице нужен абзац `<p>`.", kk: "Бетте `<p>` абзацы қажет." } },
        {
          type: "text",
          selector: "p",
          equals: "I study informatics",
          why: { ru: "Текст абзаца должен быть `I study informatics`.", kk: "Абзацтың мәтіні `I study informatics` болуы керек." },
        },
        {
          type: "text",
          selector: "p b, p strong",
          equals: "informatics",
          why: {
            ru: "Слово `informatics` должно быть внутри `<b>` или `<strong>` в абзаце.",
            kk: "`informatics` сөзі абзац ішіндегі `<b>` немесе `<strong>` ішінде болуы керек.",
          },
        },
      ],
    },
  },
  {
    id: "web-3-list",
    lang: "web",
    level: 1,
    skill: "web.html",
    title: { ru: "Маркированный список", kk: "Маркерленген тізім" },
    prompt: {
      ru: "Создайте маркированный список `<ul>` из трёх пунктов `<li>`: `Python`, `SQL`, `HTML`.",
      kk: "Үш `<li>` тармағы бар маркерленген `<ul>` тізімін жасаңыз: `Python`, `SQL`, `HTML`.",
    },
    starter: SKELETON,
    hint: {
      ru: "Пункты `<li>` пишутся внутри `<ul>…</ul>`, каждый на своей строке.",
      kk: "`<li>` тармақтары `<ul>…</ul>` ішіне, әрқайсысы жеке жолға жазылады.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <ul>
    <li>Python</li>
    <li>SQL</li>
    <li>HTML</li>
  </ul>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "ul", count: 1, why: { ru: "Нужен один список `<ul>`.", kk: "Бір `<ul>` тізімі қажет." } },
        {
          type: "exists",
          selector: "ul > li",
          count: 3,
          why: { ru: "В списке должно быть ровно три пункта `<li>`.", kk: "Тізімде дәл үш `<li>` тармағы болуы керек." },
        },
        { type: "text", selector: "ul li", equals: "Python", why: { ru: "Нет пункта `Python`.", kk: "`Python` тармағы жоқ." } },
        { type: "text", selector: "ul li", equals: "SQL", why: { ru: "Нет пункта `SQL`.", kk: "`SQL` тармағы жоқ." } },
        { type: "text", selector: "ul li", equals: "HTML", why: { ru: "Нет пункта `HTML`.", kk: "`HTML` тармағы жоқ." } },
      ],
    },
  },
  {
    id: "web-4-link",
    lang: "web",
    level: 1,
    skill: "web.html",
    title: { ru: "Ссылка", kk: "Сілтеме" },
    prompt: {
      ru: "Создайте ссылку `<a>` с текстом `Open`, которая ведёт на адрес `https://example.com`.",
      kk: "Мәтіні `Open` болатын, `https://example.com` мекенжайына апаратын `<a>` сілтемесін жасаңыз.",
    },
    starter: SKELETON,
    hint: {
      ru: "Адрес записывается в атрибуте `href` открывающего тега: `<a href=\"…\">текст</a>`.",
      kk: "Мекенжай ашатын тегтің `href` атрибутына жазылады: `<a href=\"…\">мәтін</a>`.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <a href="https://example.com">Open</a>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "a", count: 1, why: { ru: "На странице нужна одна ссылка `<a>`.", kk: "Бетте бір `<a>` сілтемесі қажет." } },
        {
          type: "attr",
          selector: "a",
          name: "href",
          equals: "https://example.com",
          why: { ru: "Атрибут `href` должен быть `https://example.com`.", kk: "`href` атрибуты `https://example.com` болуы керек." },
        },
        { type: "text", selector: "a", equals: "Open", why: { ru: "Текст ссылки должен быть `Open`.", kk: "Сілтеменің мәтіні `Open` болуы керек." } },
      ],
    },
  },
  {
    id: "web-5-img",
    lang: "web",
    level: 2,
    skill: "web.html",
    title: { ru: "Картинка с описанием", kk: "Сипаттамасы бар сурет" },
    prompt: {
      ru: "Вставьте картинку `<img>`: адрес `cat.jpg` (атрибут `src`) и описание `Cat` (атрибут `alt`).",
      kk: "`<img>` суретін енгізіңіз: мекенжайы `cat.jpg` (`src` атрибуты) және сипаттамасы `Cat` (`alt` атрибуты).",
    },
    starter: SKELETON,
    hint: {
      ru: "У `<img>` нет закрывающего тега, всё записывается в атрибутах: `<img src=\"…\" alt=\"…\">`.",
      kk: "`<img>` тегінің жабатын тегі жоқ, бәрі атрибуттарға жазылады: `<img src=\"…\" alt=\"…\">`.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <img src="cat.jpg" alt="Cat">
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "img", count: 1, why: { ru: "На странице нужна одна картинка `<img>`.", kk: "Бетте бір `<img>` суреті қажет." } },
        {
          type: "attr",
          selector: "img",
          name: "src",
          equals: "cat.jpg",
          why: { ru: "Атрибут `src` должен быть `cat.jpg`.", kk: "`src` атрибуты `cat.jpg` болуы керек." },
        },
        {
          type: "attr",
          selector: "img",
          name: "alt",
          equals: "Cat",
          why: { ru: "Атрибут `alt` должен быть `Cat`.", kk: "`alt` атрибуты `Cat` болуы керек." },
        },
      ],
    },
  },
  {
    id: "web-6-table",
    lang: "web",
    level: 2,
    skill: "web.html",
    title: { ru: "Таблица 2 на 2", kk: "2×2 кесте" },
    prompt: {
      ru: "Создайте таблицу `<table>` из двух строк `<tr>`; в каждой строке по две ячейки `<td>`. Всего четыре ячейки.",
      kk: "Екі `<tr>` жолынан тұратын `<table>` кестесін жасаңыз; әр жолда екі `<td>` ұяшығы болсын. Барлығы төрт ұяшық.",
    },
    starter: SKELETON,
    hint: {
      ru: "Строки лежат внутри `<table>`, ячейки — внутри строк: `<table><tr><td>…</td><td>…</td></tr>…</table>`.",
      kk: "Жолдар `<table>` ішінде, ұяшықтар жолдардың ішінде орналасады: `<table><tr><td>…</td><td>…</td></tr>…</table>`.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <table border="1">
    <tr>
      <td>1</td>
      <td>2</td>
    </tr>
    <tr>
      <td>3</td>
      <td>4</td>
    </tr>
  </table>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "table", count: 1, why: { ru: "Нужна одна таблица `<table>`.", kk: "Бір `<table>` кестесі қажет." } },
        {
          type: "exists",
          selector: "table tr",
          count: 2,
          why: { ru: "В таблице должно быть ровно две строки `<tr>`.", kk: "Кестеде дәл екі `<tr>` жолы болуы керек." },
        },
        {
          type: "exists",
          selector: "table td",
          count: 4,
          why: { ru: "В таблице должно быть четыре ячейки `<td>`: по две в каждой строке.", kk: "Кестеде төрт `<td>` ұяшығы болуы керек: әр жолда екіден." },
        },
        {
          type: "exists",
          selector: "tr > td:nth-child(2)",
          count: 2,
          why: { ru: "В каждой строке должно быть по две ячейки.", kk: "Әр жолда екі ұяшық болуы керек." },
        },
      ],
    },
  },
  {
    id: "web-7-color",
    lang: "web",
    level: 2,
    skill: "web.css",
    title: { ru: "Цвет текста", kk: "Мәтін түсі" },
    prompt: {
      ru: "Сделайте текст заголовка `h1` синим: в блоке `<style>` задайте свойство `color` со значением `blue`.",
      kk: "`h1` тақырыбының мәтінін көк түсті етіңіз: `<style>` блогында `color` қасиетіне `blue` мәнін беріңіз.",
    },
    starter: `<!DOCTYPE html>
<html>
<head>
  <style>

  </style>
</head>
<body>
  <h1>Hello</h1>
</body>
</html>`,
    hint: {
      ru: "Правило CSS: селектор, фигурные скобки, внутри — `свойство: значение;`. Например, `h1 { … }`.",
      kk: "CSS ережесі: селектор, фигуралы жақшалар, ішінде — `қасиет: мән;`. Мысалы, `h1 { … }`.",
    },
    solution: `<!DOCTYPE html>
<html>
<head>
  <style>
    h1 {
      color: blue;
    }
  </style>
</head>
<body>
  <h1>Hello</h1>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "h1", min: 1, why: { ru: "Заголовок `<h1>` должен остаться на странице.", kk: "`<h1>` тақырыбы бетте қалуы керек." } },
        {
          type: "css",
          selector: "h1",
          property: "color",
          equals: "blue",
          why: { ru: "В `<style>` нужно правило `h1` со свойством `color: blue`.", kk: "`<style>` ішінде `color: blue` қасиеті бар `h1` ережесі қажет." },
        },
      ],
    },
  },
  {
    id: "web-8-class",
    lang: "web",
    level: 3,
    skill: "web.css",
    title: { ru: "Класс .note", kk: ".note класы" },
    prompt: {
      ru: "Оформите заметку классом. В `<style>` создайте правило `.note` с жёлтым фоном (`background-color: yellow`) и внутренним отступом `padding`. Примените класс к абзацу: `<p class=\"note\">`.",
      kk: "Жазбаны класспен безендіріңіз. `<style>` ішінде сары фоны (`background-color: yellow`) және `padding` ішкі шегінісі бар `.note` ережесін жасаңыз. Класты абзацқа қолданыңыз: `<p class=\"note\">`.",
    },
    starter: `<!DOCTYPE html>
<html>
<head>
  <style>

  </style>
</head>
<body>
  <p>Remember this</p>
</body>
</html>`,
    hint: {
      ru: "Селектор класса начинается с точки: `.note { … }`, а в теге класс указывается без точки: `class=\"note\"`.",
      kk: "Класс селекторы нүктеден басталады: `.note { … }`, ал тегте класс нүктесіз жазылады: `class=\"note\"`.",
    },
    solution: `<!DOCTYPE html>
<html>
<head>
  <style>
    .note {
      background-color: yellow;
      padding: 10px;
    }
  </style>
</head>
<body>
  <p class="note">Remember this</p>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        {
          type: "exists",
          selector: "p.note",
          min: 1,
          why: { ru: "Абзац должен иметь класс: `<p class=\"note\">`.", kk: "Абзацтың класы болуы керек: `<p class=\"note\">`." },
        },
        {
          type: "css",
          selector: ".note",
          property: "background-color",
          equals: "yellow",
          why: { ru: "В `<style>` нужно правило `.note` с `background-color: yellow`.", kk: "`<style>` ішінде `background-color: yellow` бар `.note` ережесі қажет." },
        },
        {
          type: "css",
          selector: ".note",
          property: "padding",
          why: { ru: "Добавьте в правило `.note` свойство `padding`.", kk: "`.note` ережесіне `padding` қасиетін қосыңыз." },
        },
      ],
    },
  },
];

// Задачи курса 2.0: списки и ссылки (web.content), таблицы и формы (web.tables), блочная модель и выравнивание (web.layout).
const V2: IdeTask[] = [
  {
    id: "web-9-ol",
    lang: "web",
    level: 1,
    skill: "web.content",
    title: { ru: "Нумерованный список", kk: "Нөмірленген тізім" },
    prompt: {
      ru: "Создайте заголовок `<h2>` с текстом `Steps` и под ним нумерованный список `<ol>` из трёх пунктов `<li>`: `Open`, `Write`, `Save`.",
      kk: "Мәтіні `Steps` болатын `<h2>` тақырыбын және оның астында үш `<li>` тармағы бар нөмірленген `<ol>` тізімін жасаңыз: `Open`, `Write`, `Save`.",
    },
    starter: SKELETON,
    hint: {
      ru: "Нумерованный список отличается от маркированного только внешним тегом: пункты `<li>` лежат внутри `<ol>…</ol>`.",
      kk: "Нөмірленген тізім маркерленгеннен тек сыртқы тегімен ерекшеленеді: `<li>` тармақтары `<ol>…</ol>` ішінде тұрады.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <h2>Steps</h2>
  <ol>
    <li>Open</li>
    <li>Write</li>
    <li>Save</li>
  </ol>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "text", selector: "h2", equals: "Steps", why: { ru: "Нужен заголовок `<h2>` с текстом `Steps`.", kk: "Мәтіні `Steps` болатын `<h2>` тақырыбы қажет." } },
        { type: "exists", selector: "ol", count: 1, why: { ru: "Нужен один нумерованный список `<ol>`.", kk: "Бір нөмірленген `<ol>` тізімі қажет." } },
        {
          type: "exists",
          selector: "ol > li",
          count: 3,
          why: { ru: "В списке должно быть ровно три пункта `<li>`.", kk: "Тізімде дәл үш `<li>` тармағы болуы керек." },
        },
        { type: "text", selector: "ol li", equals: "Open", why: { ru: "Нет пункта `Open`.", kk: "`Open` тармағы жоқ." } },
        { type: "text", selector: "ol li", equals: "Write", why: { ru: "Нет пункта `Write`.", kk: "`Write` тармағы жоқ." } },
        { type: "text", selector: "ol li", equals: "Save", why: { ru: "Нет пункта `Save`.", kk: "`Save` тармағы жоқ." } },
      ],
    },
  },
  {
    id: "web-10-links",
    lang: "web",
    level: 2,
    skill: "web.content",
    title: { ru: "Две ссылки", kk: "Екі сілтеме" },
    prompt: {
      ru: "Создайте две ссылки `<a>`. Первая: текст `NCT`, адрес `https://nct.kz`, открывается в новой вкладке (`target=\"_blank\"`). Вторая: текст `Contacts`, адрес — файл `contacts.html` в той же папке (относительная ссылка).",
      kk: "Екі `<a>` сілтемесін жасаңыз. Біріншісі: мәтіні `NCT`, мекенжайы `https://nct.kz`, жаңа қойындыда ашылады (`target=\"_blank\"`). Екіншісі: мәтіні `Contacts`, мекенжайы — сол қалтадағы `contacts.html` файлы (қатысты сілтеме).",
    },
    starter: SKELETON,
    hint: {
      ru: "Оба адреса пишутся в `href`. Для новой вкладки к первой ссылке добавьте ещё один атрибут — `target`. Относительная ссылка — это просто имя файла без `https://`.",
      kk: "Екі мекенжай да `href` атрибутына жазылады. Жаңа қойынды үшін бірінші сілтемеге тағы бір атрибут — `target` қосыңыз. Қатысты сілтеме — `https://` жоқ, жай ғана файл атауы.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <a href="https://nct.kz" target="_blank">NCT</a>
  <a href="contacts.html">Contacts</a>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "a", count: 2, why: { ru: "На странице нужны ровно две ссылки `<a>`.", kk: "Бетте дәл екі `<a>` сілтемесі қажет." } },
        {
          type: "text",
          selector: "a[href^=\"https://nct.kz\"]",
          equals: "NCT",
          why: { ru: "Нужна ссылка с `href=\"https://nct.kz\"` и текстом `NCT`.", kk: "`href=\"https://nct.kz\"` және `NCT` мәтіні бар сілтеме қажет." },
        },
        {
          type: "attr",
          selector: "a[href^=\"https://nct.kz\"]",
          name: "target",
          equals: "_blank",
          why: { ru: "Первая ссылка должна открываться в новой вкладке: `target=\"_blank\"`.", kk: "Бірінші сілтеме жаңа қойындыда ашылуы керек: `target=\"_blank\"`." },
        },
        {
          type: "text",
          selector: "a[href=\"contacts.html\"]",
          equals: "Contacts",
          why: { ru: "Нужна ссылка с `href=\"contacts.html\"` и текстом `Contacts`.", kk: "`href=\"contacts.html\"` және `Contacts` мәтіні бар сілтеме қажет." },
        },
      ],
    },
  },
  {
    id: "web-11-colspan",
    lang: "web",
    level: 2,
    skill: "web.tables",
    title: { ru: "Таблица с объединением", kk: "Ұяшықтары біріктірілген кесте" },
    prompt: {
      ru: "Создайте таблицу из двух строк. В первой — одна ячейка-заголовок `<th>` с текстом `Results`, растянутая на два столбца (`colspan=\"2\"`). Во второй — две ячейки `<td>`: `Math` и `Info`.",
      kk: "Екі жолдан тұратын кесте жасаңыз. Біріншісінде — мәтіні `Results` болатын, екі бағанға созылған (`colspan=\"2\"`) бір тақырып ұяшығы `<th>`. Екіншісінде — екі `<td>` ұяшығы: `Math` және `Info`.",
    },
    starter: SKELETON,
    hint: {
      ru: "Атрибут `colspan` ставится в открывающий тег ячейки: `<th colspan=\"…\">`. Раз ячейка занимает два столбца, во второй строке их как раз две.",
      kk: "`colspan` атрибуты ұяшықтың ашатын тегіне жазылады: `<th colspan=\"…\">`. Ұяшық екі бағанды алатындықтан, екінші жолда да екі ұяшық болады.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <table border="1">
    <tr>
      <th colspan="2">Results</th>
    </tr>
    <tr>
      <td>Math</td>
      <td>Info</td>
    </tr>
  </table>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "table tr", count: 2, why: { ru: "В таблице должно быть ровно две строки `<tr>`.", kk: "Кестеде дәл екі `<tr>` жолы болуы керек." } },
        { type: "text", selector: "table th", equals: "Results", why: { ru: "Нужна ячейка-заголовок `<th>` с текстом `Results`.", kk: "Мәтіні `Results` болатын `<th>` тақырып ұяшығы қажет." } },
        {
          type: "attr",
          selector: "table th",
          name: "colspan",
          equals: "2",
          why: { ru: "Ячейка `<th>` должна занимать два столбца: `colspan=\"2\"`.", kk: "`<th>` ұяшығы екі бағанды алуы керек: `colspan=\"2\"`." },
        },
        { type: "exists", selector: "table td", count: 2, why: { ru: "Во второй строке нужны две ячейки `<td>`.", kk: "Екінші жолда екі `<td>` ұяшығы қажет." } },
        { type: "text", selector: "table td", equals: "Math", why: { ru: "Нет ячейки `Math`.", kk: "`Math` ұяшығы жоқ." } },
        { type: "text", selector: "table td", equals: "Info", why: { ru: "Нет ячейки `Info`.", kk: "`Info` ұяшығы жоқ." } },
      ],
    },
  },
  {
    id: "web-12-form",
    lang: "web",
    level: 3,
    skill: "web.tables",
    title: { ru: "Форма с подписью", kk: "Жазуы бар форма" },
    prompt: {
      ru: "Создайте форму `<form>`: поле ввода `<input type=\"text\">` с `id=\"name\"`, подпись `<label>` с текстом `Name`, связанную с полем атрибутом `for`, и кнопку `<button>` с текстом `Send`.",
      kk: "`<form>` формасын жасаңыз: `id=\"name\"` болатын `<input type=\"text\">` енгізу өрісі, өріспен `for` атрибуты арқылы байланысқан, мәтіні `Name` болатын `<label>` жазуы және мәтіні `Send` болатын `<button>` батырмасы.",
    },
    starter: SKELETON,
    hint: {
      ru: "Всё лежит внутри `<form>…</form>`. Значение `for` у подписи должно совпадать с `id` поля — так они связываются.",
      kk: "Бәрі `<form>…</form>` ішінде тұрады. Жазудың `for` мәні өрістің `id` мәнімен бірдей болуы керек — солай олар байланысады.",
    },
    solution: `<!DOCTYPE html>
<html>
<body>
  <form>
    <label for="name">Name</label>
    <input type="text" id="name">
    <button>Send</button>
  </form>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        { type: "exists", selector: "form", count: 1, why: { ru: "Нужна одна форма `<form>`.", kk: "Бір `<form>` формасы қажет." } },
        {
          type: "attr",
          selector: "form input#name",
          name: "type",
          equals: "text",
          why: { ru: "Внутри формы нужно поле `<input type=\"text\" id=\"name\">`.", kk: "Форма ішінде `<input type=\"text\" id=\"name\">` өрісі қажет." },
        },
        {
          type: "text",
          selector: "form label[for=\"name\"]",
          equals: "Name",
          why: { ru: "Нужна подпись `<label for=\"name\">` с текстом `Name`.", kk: "Мәтіні `Name` болатын `<label for=\"name\">` жазуы қажет." },
        },
        { type: "text", selector: "form button", equals: "Send", why: { ru: "Внутри формы нужна кнопка `<button>` с текстом `Send`.", kk: "Форма ішінде мәтіні `Send` болатын `<button>` батырмасы қажет." } },
      ],
    },
  },
  {
    id: "web-13-align",
    lang: "web",
    level: 1,
    skill: "web.layout",
    title: { ru: "Выравнивание и цвет", kk: "Туралау және түс" },
    prompt: {
      ru: "В `<style>` выровняйте заголовок `h1` по центру (`text-align: center`) и задайте абзацу `p` зелёный цвет `#008000` (свойство `color`).",
      kk: "`<style>` ішінде `h1` тақырыбын ортасына туралаңыз (`text-align: center`) және `p` абзацына `#008000` жасыл түсін беріңіз (`color` қасиеті).",
    },
    starter: `<!DOCTYPE html>
<html>
<head>
  <style>

  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Hello</p>
</body>
</html>`,
    hint: {
      ru: "Два отдельных правила: `h1 { … }` и `p { … }`. Выравнивание текста — свойство `text-align`, цвет — `color`.",
      kk: "Екі бөлек ереже: `h1 { … }` және `p { … }`. Мәтінді туралау — `text-align` қасиеті, түс — `color`.",
    },
    solution: `<!DOCTYPE html>
<html>
<head>
  <style>
    h1 {
      text-align: center;
    }
    p {
      color: #008000;
    }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Hello</p>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        {
          type: "exists",
          selector: "h1, p",
          min: 2,
          why: { ru: "Заголовок и абзац должны остаться на странице.", kk: "Тақырып пен абзац бетте қалуы керек." },
        },
        {
          type: "css",
          selector: "h1",
          property: "text-align",
          equals: "center",
          why: { ru: "В `<style>` нужно правило `h1` со свойством `text-align: center`.", kk: "`<style>` ішінде `text-align: center` қасиеті бар `h1` ережесі қажет." },
        },
        {
          type: "css",
          selector: "p",
          property: "color",
          equals: "#008000",
          why: { ru: "В `<style>` нужно правило `p` со свойством `color: #008000`.", kk: "`<style>` ішінде `color: #008000` қасиеті бар `p` ережесі қажет." },
        },
      ],
    },
  },
  {
    id: "web-14-box",
    lang: "web",
    level: 3,
    skill: "web.layout",
    title: { ru: "Блок по центру", kk: "Ортадағы блок" },
    prompt: {
      ru: "Оформите блок `<div class=\"card\">`. В `<style>` для `.card` задайте: ширину `width: 300px`, внутренний отступ `padding: 20px`, рамку `border` и внешние отступы `margin: 0 auto` (блок встанет по центру).",
      kk: "`<div class=\"card\">` блогын безендіріңіз. `<style>` ішінде `.card` үшін мыналарды беріңіз: ені `width: 300px`, ішкі шегініс `padding: 20px`, `border` жиегі және сыртқы шегініс `margin: 0 auto` (блок ортада тұрады).",
    },
    starter: `<!DOCTYPE html>
<html>
<head>
  <style>

  </style>
</head>
<body>
  <div class="card">
    <p>Hello</p>
  </div>
</body>
</html>`,
    hint: {
      ru: "Все четыре свойства пишутся в одном правиле `.card { … }`. Рамка задаётся, например, так: `border: 1px solid black;`. В `margin: 0 auto` первое значение — сверху и снизу, второе — слева и справа.",
      kk: "Төрт қасиеттің бәрі бір `.card { … }` ережесіне жазылады. Жиек, мысалы, былай беріледі: `border: 1px solid black;`. `margin: 0 auto` жазбасында бірінші мән — жоғарғы және төменгі, екінші мән — сол және оң жақ шегініс.",
    },
    solution: `<!DOCTYPE html>
<html>
<head>
  <style>
    .card {
      width: 300px;
      padding: 20px;
      border: 1px solid black;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="card">
    <p>Hello</p>
  </div>
</body>
</html>`,
    check: {
      kind: "web",
      rules: [
        {
          type: "exists",
          selector: "div.card p",
          min: 1,
          why: { ru: "Абзац должен остаться внутри блока `<div class=\"card\">`.", kk: "Абзац `<div class=\"card\">` блогының ішінде қалуы керек." },
        },
        {
          type: "css",
          selector: ".card",
          property: "width",
          equals: "300px",
          why: { ru: "В правиле `.card` нужно `width: 300px`.", kk: "`.card` ережесінде `width: 300px` қажет." },
        },
        {
          type: "css",
          selector: ".card",
          property: "padding",
          equals: "20px",
          why: { ru: "В правиле `.card` нужно `padding: 20px`.", kk: "`.card` ережесінде `padding: 20px` қажет." },
        },
        {
          type: "css",
          selector: ".card",
          property: "border",
          why: { ru: "Добавьте в правило `.card` рамку — свойство `border`.", kk: "`.card` ережесіне жиек — `border` қасиетін қосыңыз." },
        },
        {
          type: "css",
          selector: ".card",
          property: "margin",
          equals: "0 auto",
          why: { ru: "В правиле `.card` нужно `margin: 0 auto`.", kk: "`.card` ережесінде `margin: 0 auto` қажет." },
        },
      ],
    },
  },
];

/** Все задачи; порядок — от A к C (сортировка устойчивая: внутри уровня базовые задачи идут первыми). */
export const TASKS: IdeTask[] = [...BASE, ...V2].sort((a, b) => a.level - b.level);
