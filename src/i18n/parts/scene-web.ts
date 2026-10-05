import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцены box, url, message и режим web page; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.box.*`, `scene.url.*`, `scene.message.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneWebDict = {
  // ---- box: блочная модель CSS (слои margin/border/padding/content подписаны кодовыми словами, не переводятся) ----
  "scene.box.aria": {
    ru: "Блочная модель CSS: content {content} px, padding {padding}, border {border}, margin {margin}",
    kk: "CSS блоктық моделі: content {content} px, padding {padding}, border {border}, margin {margin}",
  },
  "scene.box.ariaCollapse": {
    ru: ". Второй блок ниже: между блоками остаётся больший из отступов, {gap} px",
    kk: ". Төменде екінші блок: екі шегіністің үлкені қалады, {gap} px",
  },

  // ---- url: роли частей адреса ----
  "scene.url.aria": { ru: "Адресная строка браузера: {url}.", kk: "Браузердің мекенжай жолағы: {url}." },
  "scene.url.ariaPart": { ru: "{role}: {text}", kk: "{role}: {text}" },
  "scene.url.role.protocol": { ru: "протокол", kk: "хаттама" },
  "scene.url.role.subdomain": { ru: "поддомен", kk: "субдомен" },
  "scene.url.role.domain": { ru: "домен", kk: "домен" },
  "scene.url.role.zone": { ru: "зона", kk: "аймақ" },
  "scene.url.role.port": { ru: "порт", kk: "порт" },
  "scene.url.role.path": { ru: "путь", kk: "жол" },
  "scene.url.role.query": { ru: "параметры", kk: "параметрлер" },
  "scene.url.role.fragment": { ru: "якорь", kk: "зәкір" },

  // ---- message: SMS, письмо, чат ----
  "scene.message.from": { ru: "От", kk: "Кімнен" },
  "scene.message.subject": { ru: "Тема", kk: "Тақырып" },
  "scene.message.ariaMark": { ru: "Признак {n}: «{text}»", kk: "{n}-белгі: «{text}»" },
  "scene.message.aria.sms": { ru: "SMS от {from}: {text}", kk: "{from} жіберген SMS: {text}" },
  "scene.message.aria.chat": { ru: "Чат, {from}: {text}", kk: "Чат, {from}: {text}" },
  "scene.message.aria.email": { ru: "Письмо от {from}: {text}", kk: "{from} жіберген хат: {text}" },
  "scene.message.aria.emailSubject": {
    ru: "Письмо от {from}, тема «{subject}»: {text}",
    kk: "{from} жіберген хат, тақырыбы «{subject}»: {text}",
  },
} satisfies Record<string, L>;
