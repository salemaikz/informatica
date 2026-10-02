import type { L } from "@/lib/types";

// Строки раздела (ru + kk). Префикс ключей — см. docs/specs/stage3.md. Казахский — литературный, термины по глоссарию НЦТ.
export const profileDict = {
  // Выбор аватара (components/app/AvatarPicker.tsx)
  "avatar.title": { ru: "Аватар", kk: "Аватар" },
  "avatar.tab.presets": { ru: "Аватары", kk: "Аватарлар" },
  "avatar.tab.letter": { ru: "Буква", kk: "Әріп" },
  "avatar.tab.photo": { ru: "Фото", kk: "Фото" },
  "avatar.letter.hint": { ru: "Первая буква имени на цветном круге. Выбери цвет.", kk: "Атыңның бірінші әрпі түсті шеңберде. Түсті таңда." },
  "avatar.color.primary": { ru: "Голубой", kk: "Көгілдір" },
  "avatar.color.success": { ru: "Зелёный", kk: "Жасыл" },
  "avatar.color.warning": { ru: "Янтарный", kk: "Сарғыш" },
  "avatar.color.danger": { ru: "Красный", kk: "Қызыл" },
  "avatar.color.ai": { ru: "Фиолетовый", kk: "Күлгін" },
  "avatar.color.gold": { ru: "Золотой", kk: "Алтын" },
  "avatar.color.streak": { ru: "Оранжевый", kk: "Қызғылт сары" },
  "avatar.photo.hint": { ru: "Фото обрежется до квадрата по центру и сожмётся до 160×160. Оно хранится только на этом устройстве.", kk: "Фото ортасынан шаршыға қиылып, 160×160 өлшеміне дейін кішірейтіледі. Ол тек осы құрылғыда сақталады." },
  "avatar.photo.choose": { ru: "Выбрать фото", kk: "Фото таңдау" },
  "avatar.photo.change": { ru: "Другое фото", kk: "Басқа фото" },
  "avatar.photo.remove": { ru: "Удалить фото", kk: "Фотоны жою" },
  "avatar.photo.error": { ru: "Не получилось открыть фото. Попробуй другой файл.", kk: "Фотоны ашу мүмкін болмады. Басқа файлды байқап көр." },
  "avatar.save": { ru: "Сохранить", kk: "Сақтау" },
  "avatar.cancel": { ru: "Отмена", kk: "Бас тарту" },
} satisfies Record<string, L>;
