import type { IdeTask } from "../types";

// Задачи HTML/CSS (docs/specs/ide.md, I3): 8 задач от A к C. Один документ — HTML со <style>.
// Тексты на странице (My site, Python…) — латиницей и без перевода: ученик набирает их в коде как есть.
// Правильность решает checks.ts: структура — скриптом в iframe, CSS — разбором <style>.

const SKELETON = `<!DOCTYPE html>
<html>
<body>
  <!-- ... -->
</body>
</html>`;

export const TASKS: IdeTask[] = [
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
      kk: "CSS ережесі: селектор, жақшалар, ішінде — `қасиет: мән;`. Мысалы, `h1 { … }`.",
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
