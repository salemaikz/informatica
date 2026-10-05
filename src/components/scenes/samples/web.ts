import type { Scene } from "@/lib/types";

/** Образцы сцен url, message и режима web page. Дополняет исполнитель пакета S7. */
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
  {
    kind: "message",
    channel: "sms",
    from: "Kaspi-Bonus",
    text: {
      ru: "Ваша карта заблокирована! Срочно перейдите по ссылке kaspi-bonus.top и введите код из SMS.",
      kk: "Картаңыз бұғатталды! Дереу kaspi-bonus.top сілтемесіне өтіп, SMS-тағы кодты енгізіңіз.",
    },
    marks: [{ text: { ru: "Срочно", kk: "Дереу" } }, { text: "kaspi-bonus.top" }],
  },
  {
    kind: "web",
    page: true,
    html: "<h1>Концерт</h1><p>Суббота, 19:00</p>",
    htmlKk: "<h1>Концерт</h1><p>Сенбі, 19:00</p>",
    css: "h1{color:#2563eb}",
  },
];
