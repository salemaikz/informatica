// Адреса «Теории»: карточка урока и раздел курса. Чистые функции без импортов (их используют и lib/search.ts, и lib/theory.ts).
//
// Якорь передаём параметром адреса, а не «#»: при переходе внутри приложения (Next 16) `window.location.hash` в первом
// рендере ещё старый и `hashchange` не срабатывает, а параметры страница получает сразу.
//   /theory/<урок>?card=<id шага>   (`?card=conspect` — конспект)
//   /theory?unit=<id раздела>
// Старые ссылки с «#<шаг>» и «#u3» при полной загрузке страницы продолжают работать (lib/theory.ts).

/** Id карточки-конспекта (последняя карточка урока): `?card=conspect` и якорь секции. */
export const CONSPECT_ID = "conspect";
/** Параметр адреса: какую карточку урока открыть. */
export const CARD_PARAM = "card";
/** Параметр адреса: какой раздел раскрыть на странице «Теория». */
export const UNIT_PARAM = "unit";

/** Адрес чтения урока; cardId — id шага или `conspect` (без него — урок с того места, где остановились). */
export function theoryCardHref(lessonId: string, cardId?: string): string {
  return cardId ? `/theory/${lessonId}?${CARD_PARAM}=${encodeURIComponent(cardId)}` : `/theory/${lessonId}`;
}

/** Адрес «Теории» с раскрытым разделом. */
export function theoryUnitHref(unitId: string): string {
  return `/theory?${UNIT_PARAM}=${encodeURIComponent(unitId)}`;
}

/** Значение параметра адреса: у повторяющегося берём первое, пустое и отсутствующее — null. */
export function paramValue(v: string | readonly string[] | null | undefined): string | null {
  const first = typeof v === "string" ? v : v?.[0];
  return typeof first === "string" && first ? first : null;
}
