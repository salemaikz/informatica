// Отправка ссылки (#72): системное меню телефона, WhatsApp, Telegram, копирование. Без React.
// Ссылки на мессенджеры — их общие адреса «поделиться»: открываются в приложении или на сайте мессенджера.
// Tests: tests/share.test.ts.

/** Текст и ссылка одним сообщением (для WhatsApp и для отправки с картинкой: там ссылка отдельным полем часто теряется). */
export const messageOf = (text: string, url: string): string => (text.trim() ? `${text.trim()}\n${url}` : url);

/** «Поделиться» в WhatsApp: текст вместе со ссылкой (отдельного поля для ссылки нет). */
export function whatsappUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(messageOf(text, url))}`;
}

/** «Поделиться» в Telegram: ссылка и текст отдельно (Telegram сам покажет превью ссылки). */
export function telegramUrl(text: string, url: string): string {
  const q = `url=${encodeURIComponent(url)}`;
  return `https://t.me/share/url?${q}${text.trim() ? `&text=${encodeURIComponent(text.trim())}` : ""}`;
}

type Nav = Pick<Navigator, "share" | "canShare" | "clipboard"> | undefined;
const nav = (): Nav => (typeof navigator === "undefined" ? undefined : navigator);

/** Есть системное меню «Поделиться» (телефоны, часть десктопов). */
export function canShareNative(n: Nav = nav()): boolean {
  return typeof n?.share === "function";
}

/** Системное меню примет картинку-файл (Android Chrome, iOS Safari; десктоп обычно нет). */
export function canShareFile(file: File, n: Nav = nav()): boolean {
  try {
    return typeof n?.share === "function" && typeof n.canShare === "function" && n.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type NativeResult = "shared" | "cancelled" | "failed";

/**
 * Системное меню. Вызывать прямо из обработчика нажатия (iOS требует жест пользователя: всё тяжёлое —
 * картинку — готовим заранее). С файлом текст и ссылка идут одним сообщением.
 */
export async function shareNative(data: { title: string; text: string; url: string; file?: File | null }, n: Nav = nav()): Promise<NativeResult> {
  if (!n || typeof n.share !== "function") return "failed";
  const payload: ShareData =
    data.file && canShareFile(data.file, n) ? { files: [data.file], title: data.title, text: messageOf(data.text, data.url) } : { title: data.title, text: data.text, url: data.url };
  try {
    await n.share(payload);
    return "shared";
  } catch (e) {
    // Закрыли меню — не ошибка.
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "failed";
  }
}

/** Копирование в буфер; false — браузер не дал (тогда показываем поле со ссылкой). */
export async function copyText(text: string, n: Nav = nav()): Promise<boolean> {
  try {
    if (!n?.clipboard?.writeText) return false;
    await n.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Абсолютная ссылка на страницу этого же сайта (там, где открыто приложение: боевой сайт, превью, локально). */
export function absoluteUrl(path: string, origin: string = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
