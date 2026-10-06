import type { L } from "@/lib/types";

// Этап 16Г, пакет F2: панель видеоплеера (`video.*`) и фоновая музыка (`music.*`).
// Казахский — литературный; ещё не вычитан (npm run review:kk после слияния), носителем — нет. Без глаголов с родом.
export const media16dDict = {
  // Панель видеоплеера (videos/PlayerInner.tsx)
  "video.controls": { ru: "Управление видео", kk: "Бейнені басқару" },
  "video.play": { ru: "Воспроизвести видео", kk: "Бейнені ойнату" },
  "video.pause": { ru: "Приостановить видео", kk: "Бейнені кідірту" },
  "video.mute": { ru: "Выключить звук видео", kk: "Бейненің дыбысын өшіру" },
  "video.unmute": { ru: "Включить звук видео", kk: "Бейненің дыбысын қосу" },
  "video.fullscreen": { ru: "На весь экран", kk: "Толық экран" },
  "video.exitFullscreen": { ru: "Выйти из полного экрана", kk: "Толық экраннан шығу" },
  "video.seek": { ru: "Позиция воспроизведения", kk: "Ойнату орны" },
  "video.seek.value": { ru: "{cur} из {total}", kk: "{cur} / {total}" },

  // Фоновая музыка (lib/music.ts, components/music/*, профиль)
  "music.title": { ru: "Фоновая музыка", kk: "Фондық музыка" },
  "music.on": { ru: "Включить музыку", kk: "Музыканы қосу" },
  "music.off": { ru: "Выключить музыку", kk: "Музыканы өшіру" },
  "music.track": { ru: "Трек", kk: "Трек" },
  "music.track.auto": { ru: "Авто", kk: "Авто" },
  "music.track.arcade": { ru: "Bit Arcade", kk: "Bit Arcade" },
  "music.track.focus": { ru: "Quiet Focus", kk: "Quiet Focus" },
  "music.hint": {
    ru: "Играет в играх, уроках и тренировках. В пробном ЕНТ и тестах — тишина, как на экзамене.",
    kk: "Ойындарда, сабақтарда және жаттығуларда ойнайды. Сынақ ҰБТ мен тесттерде емтихандағыдай тыныштық.",
  },
  "music.needSound": { ru: "Включи «Звуки», чтобы слышать музыку.", kk: "Музыканы есту үшін «Дыбыстарды» қос." },
  "music.unavailable": {
    ru: "Коснись экрана, чтобы включить музыку.",
    kk: "Музыканы қосу үшін экранды түрт.",
  },
} satisfies Record<string, L>;
