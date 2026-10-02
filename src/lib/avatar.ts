import type { AvatarColor, AvatarConfig } from "./types";

// Чистая логика аватара: проверка конфигурации (данные из localStorage недоверенные) и геометрия обрезки фото.
// Сжатие самого фото работает с canvas — оно в components/app/AvatarPicker.tsx.

export const AVATAR_COLORS: readonly AvatarColor[] = ["primary", "success", "warning", "danger", "ai", "gold", "streak"];

/** id рисованных аватаров. components/app/avatars/presets.tsx обязан нарисовать каждый (это проверяет TypeScript). */
export const AVATAR_PRESET_IDS = [
  "bit-blue",
  "bit-headphones",
  "bit-glasses",
  "bit-cap",
  "bit-grad",
  "bit-crown",
  "bit-scarf",
  "bit-laptop",
  "bit-bolt",
  "owl-coder",
  "cat-hacker",
  "rocket",
] as const;
export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export function isPresetId(id: unknown): id is AvatarPresetId {
  return typeof id === "string" && (AVATAR_PRESET_IDS as readonly string[]).includes(id);
}

export const PHOTO_PREFIX = "data:image/jpeg;base64,";
/** Максимум длины dataURL фото, которое принимаем из хранилища. */
export const PHOTO_MAX_CHARS = 80_000;
/** Сторона квадратного фото после сжатия, px. */
export const PHOTO_SIZE = 160;
/** Целевой размер фото, байт: если больше — снижаем качество JPEG. */
export const PHOTO_TARGET_BYTES = 45 * 1024;

export function defaultAvatar(): AvatarConfig {
  return { kind: "initial", color: "primary" };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Проверка фото-dataURL: только JPEG base64 и не длиннее PHOTO_MAX_CHARS. */
export function isValidPhoto(data: unknown): data is string {
  return (
    typeof data === "string" &&
    data.length > PHOTO_PREFIX.length &&
    data.length <= PHOTO_MAX_CHARS &&
    data.startsWith(PHOTO_PREFIX) &&
    BASE64.test(data.slice(PHOTO_PREFIX.length))
  );
}

/** Приводит недоверенные данные к корректному AvatarConfig; всё неизвестное — аватар по умолчанию. */
export function sanitizeAvatar(raw: unknown): AvatarConfig {
  if (typeof raw !== "object" || raw === null) return defaultAvatar();
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "initial":
      return AVATAR_COLORS.includes(r.color as AvatarColor) ? { kind: "initial", color: r.color as AvatarColor } : defaultAvatar();
    case "preset":
      return isPresetId(r.id) ? { kind: "preset", id: r.id } : defaultAvatar();
    case "photo":
      return isValidPhoto(r.data) ? { kind: "photo", data: r.data } : defaultAvatar();
    default:
      return defaultAvatar();
  }
}

/** Буква для аватара-инициала: первый символ имени (целиком, даже если это суррогатная пара), заглавный; пусто → «?». */
export function avatarInitial(name: unknown): string {
  const first = typeof name === "string" ? Array.from(name.trim())[0] : undefined;
  return first ? first.toUpperCase() : "?";
}

/** Квадрат по центру исходного изображения: откуда резать при обрезке. */
export function centerSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.min(width, height));
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

/** Размер JPEG в байтах по длине dataURL (base64 → 3/4). */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const b64 = i < 0 ? dataUrl : dataUrl.slice(i + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Следующее (более низкое) качество JPEG для сжатия; null — ниже порога опускаться незачем. */
export function nextQuality(q: number): number | null {
  const next = Math.round((q - 0.1) * 100) / 100;
  return next < 0.3 ? null : next;
}
