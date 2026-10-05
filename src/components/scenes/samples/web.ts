import type { Scene } from "@/lib/types";

/** Образцы сцен url, message и режима web page. */
export const SAMPLES: Scene[] = [
  {
    kind: "url",
    parts: [
      { text: "https://", role: "protocol" },
      { text: "egov", role: "subdomain" },
      { text: ".kz", role: "zone" },
      { text: "/services", role: "path" },
    ],
    highlight: ["zone"],
  },
  // длинный адрес с портом, параметрами и якорем: все роли подписаны, подписи соседних частей разводятся по ярусам
  {
    kind: "url",
    parts: [
      { text: "https://", role: "protocol" },
      { text: "news.", role: "subdomain" },
      { text: "example", role: "domain" },
      { text: ".kz", role: "zone" },
      { text: ":8080", role: "port" },
      { text: "/path/page", role: "path" },
      { text: "?id=5", role: "query" },
      { text: "#top", role: "fragment" },
    ],
    highlight: ["protocol", "subdomain", "domain", "zone", "port", "path", "query", "fragment"],
    caption: { ru: "Адрес разбирается слева направо", kk: "Мекенжай солдан оңға қарай талданады" },
  },
  // http — замок открыт
  {
    kind: "url",
    parts: [
      { text: "http://", role: "protocol" },
      { text: "kaspi-bonus", role: "domain" },
      { text: ".top", role: "zone" },
    ],
    highlight: ["protocol", "domain", "zone"],
  },
  // длинная часть: переносится по частям
  {
    kind: "url",
    parts: [
      { text: "https://", role: "protocol" },
      { text: "www.", role: "subdomain" },
      { text: "informatika-ent-podgotovka", role: "domain" },
      { text: ".kz", role: "zone" },
      { text: "/uroki/", role: "path" },
    ],
    highlight: ["domain", "path"],
  },
  // без highlight — просто адресная строка
  {
    kind: "url",
    parts: [
      { text: "https://", role: "protocol" },
      { text: "ent.kz", role: "domain" },
    ],
  },
  {
    kind: "message",
    channel: "sms",
    from: "Kaspi-Bonus",
    text: {
      ru: "Ваша карта заблокирована! Срочно перейдите по ссылке kaspi-bonus.top и введите код из SMS.",
      kk: "Картаңыз бұғатталды! Дереу kaspi-bonus.top сілтемесіне өтіп, SMS-тағы кодты енгізіңіз.",
    },
    marks: [
      { text: { ru: "Срочно", kk: "Дереу" }, note: { ru: "давление спешкой", kk: "асықтыру арқылы қысым жасау" } },
      { text: "kaspi-bonus.top", note: { ru: "поддельный адрес", kk: "жалған мекенжай" } },
    ],
  },
  {
    kind: "message",
    channel: "email",
    from: { ru: "Служба безопасности банка", kk: "Банктің қауіпсіздік қызметі" },
    subject: { ru: "Срочно: подтвердите вход в аккаунт", kk: "Шұғыл: аккаунтқа кіруді растаңыз" },
    text: {
      ru: "Здравствуйте!\nМы заметили вход с нового устройства. Пришлите пароль в ответном письме, иначе доступ будет закрыт через 24 часа.",
      kk: "Сәлеметсіз бе!\nЖаңа құрылғыдан кіру байқалды. Құпия сөзді жауап хатта жіберіңіз, әйтпесе қолжетімділік 24 сағаттан кейін жабылады.",
    },
    marks: [
      { text: { ru: "Пришлите пароль", kk: "Құпия сөзді жауап хатта жіберіңіз" }, note: { ru: "банк не просит пароль", kk: "банк құпия сөзді сұрамайды" } },
      { text: { ru: "через 24 часа", kk: "24 сағаттан кейін" }, note: { ru: "срок давит на жертву", kk: "мерзім қысым жасайды" } },
    ],
  },
  {
    kind: "message",
    channel: "chat",
    from: "Айдар",
    text: { ru: "Привет! Скинь, пожалуйста, код, который тебе пришёл в SMS. Это для конкурса.", kk: "Сәлем! Саған SMS-пен келген кодты жіберші. Бұл байқауға керек." },
    marks: [{ text: { ru: "код, который тебе пришёл в SMS", kk: "SMS-пен келген кодты" } }],
  },
  {
    kind: "web",
    page: true,
    html: "<h1>Концерт</h1><p>Суббота, 19:00</p>",
    htmlKk: "<h1>Концерт</h1><p>Сенбі, 19:00</p>",
    css: "h1{color:#2563eb}",
  },
  // без htmlKk: одна и та же разметка на обоих языках
  { kind: "web", page: true, html: "<h2>Школа 42</h2><ul><li>Информатика</li><li>Математика</li></ul>" },
];
