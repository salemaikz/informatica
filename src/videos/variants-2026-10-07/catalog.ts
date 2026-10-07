import type { ComponentType } from "react";
import { ShelfLesson, NotebookLesson, DetectiveLesson } from "./lessons";
import { TeachReel, MemeReel, InviteReel } from "./instagram";

export type VariantLanguage = "ru" | "kk";
export type VariantProps = { lang: VariantLanguage; music?: boolean };
type L = Record<VariantLanguage, string>;
export type VariantMeta = { id: string; kind: "lesson" | "instagram"; component: ComponentType<VariantProps>; title: L; description: L; width: number; height: number; frames: number; music: boolean };

export const VIDEO_VARIANTS: VariantMeta[] = [
  { id: "shelf", kind: "lesson", component: ShelfLesson, title: { ru: "01 · Полка с числами", kk: "01 · Сандар сөресі" }, description: { ru: "Предметная анимация: индекс указывает на ячейку, срез переносит нужные значения в новый список.", kk: "Көрнекі анимация: индекс ұяшықты көрсетеді, тілім қажетті мәндерді жаңа тізімге көшіреді." }, width: 1080, height: 1080, frames: 900, music: false },
  { id: "notebook", kind: "lesson", component: NotebookLesson, title: { ru: "02 · Живой конспект", kk: "02 · Жанды конспект" }, description: { ru: "Светлая тетрадь, маркеры и пошаговые пометки. Подходит для спокойного объяснения и повторения.", kk: "Ашық түсті дәптер, маркерлер және қадамдық жазбалар. Тақырыпты түсіндіруге және қайталауға ыңғайлы." }, width: 1080, height: 1080, frames: 900, music: false },
  { id: "detective", kind: "lesson", component: DetectiveLesson, title: { ru: "03 · Детектив ошибки", kk: "03 · Қатені іздеу" }, description: { ru: "Разбираем улику IndexError: почему три элемента не означают, что существует индекс 3.", kk: "IndexError қатесін талдаймыз: үш элемент бар болса да, неліктен 3 индексі жоқ?" }, width: 1080, height: 1080, frames: 900, music: false },
  { id: "teach", kind: "instagram", component: TeachReel, title: { ru: "04 · Мини-загадка", kk: "04 · Шағын жұмбақ" }, description: { ru: "bool('False'): сначала зритель делает предположение, затем видит правило о непустой строке.", kk: "bool('False'): алдымен болжам жаса, содан кейін бос емес жол туралы ережені біл." }, width: 1080, height: 1920, frames: 600, music: true },
  { id: "meme", kind: "instagram", component: MemeReel, title: { ru: "05 · Комикс с Битом", kk: "05 · Битпен комикс" }, description: { ru: "Добрая шутка об индексе 3 и понятное исправление. Ошибка становится поводом запомнить правило.", kk: "3 индексі туралы жеңіл әзіл және түсінікті түзету. Қате ережені есте сақтауға көмектеседі." }, width: 1080, height: 1920, frames: 600, music: true },
  { id: "invite", kind: "instagram", component: InviteReel, title: { ru: "06 · Знакомство с сервисом", kk: "06 · Сервиспен танысу" }, description: { ru: "Урок → вопрос → разбор. Показываем, как выглядит обучение, и приглашаем открыть пробный урок.", kk: "Сабақ → сұрақ → талдау. Оқудың қалай өтетінін көрсетіп, сынақ сабағын ашуға шақырамыз." }, width: 1080, height: 1920, frames: 600, music: true },
];
