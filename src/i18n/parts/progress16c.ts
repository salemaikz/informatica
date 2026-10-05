import type { L } from "@/lib/types";

// Этап 16В, пакет P5 (docs/specs/stage16c.md §8): «Прогресс» по разделам и навыкам, «Поделиться» уроком.
// Вычитано моделью, носителем — нет.
export const progress16cDict = {
  // ---------- Разделы программы: навыки и переход на карту ----------
  "progress16c.units.skills": { ru: "освоено навыков: {m} из {n}", kk: "меңгерілген дағдылар: {m} / {n}" },

  // ---------- Освоение навыков по разделам ----------
  "progress16c.skills.counts": {
    ru: "освоено {m} · в процессе {p} · слабо {w} · не начато {n}",
    kk: "меңгерілді {m} · үдерісте {p} · әлсіз {w} · басталмаған {n}",
  },
  "progress16c.skills.other": { ru: "Другие навыки", kk: "Басқа дағдылар" },
  "progress16c.skills.empty": {
    ru: "Решай задания — здесь появятся оценки по навыкам.",
    kk: "Тапсырмаларды шеш — дағдылар бойынша бағалар осында пайда болады.",
  },

  // ---------- «Поделиться» на итогах урока ----------
  "progress16c.share.title": { ru: "Поделиться уроком", kk: "Сабақпен бөлісу" },
  "progress16c.share.msg": { ru: "Урок в Informatica: точность {p}%, +{xp} XP.", kk: "Informatica-дағы сабақ: дәлдік {p}%, +{xp} XP." },
  "progress16c.share.msgPerfect": { ru: "Урок в Informatica — без единой ошибки! +{xp} XP.", kk: "Informatica-дағы сабақ — бірде-бір қатесіз! +{xp} XP." },
  "progress16c.share.kicker": { ru: "Мой урок", kk: "Менің сабағым" },
  "progress16c.share.lead": { ru: "Урок пройден", kk: "Сабақ өтілді" },
  "progress16c.share.leadPerfect": { ru: "Без единой ошибки!", kk: "Бірде-бір қатесіз!" },
  "progress16c.share.count": { ru: "Пройдено уроков: {n}", kk: "Өтілген сабақтар: {n}" },
  "progress16c.share.land.eyebrow": { ru: "Результат друга в уроке", kk: "Достың сабақтағы нәтижесі" },
  "progress16c.share.og.title": { ru: "Урок пройден на {p}%", kk: "Сабақ {p}% дәлдікпен өтілді" },
  "progress16c.share.og.titlePerfect": { ru: "Урок без единой ошибки", kk: "Бірде-бір қатесіз сабақ" },
  "progress16c.share.og.desc": { ru: "+{xp} XP в Informatica. Занимайся вместе!", kk: "Informatica-да +{xp} XP. Бірге дайындалайық!" },
} satisfies Record<string, L>;
