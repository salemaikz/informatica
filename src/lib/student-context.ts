import type { StudentContext } from "./ai-types";
import type { WithTrack } from "./school";
import type { AppState } from "./store";
import { liveStreak, levelInfo } from "./gamification";
import { decaySkills, masteryLevel } from "./mastery";
import { weakSpots } from "./progress";
import { todayKey, tx } from "./text";
import { ownNotesText } from "./notebook";
import { skillById } from "@/content/skills";
import { LESSON_META } from "@/content/catalog";

/** Сжатый портрет ученика для ИИ: только то, что помогает персонализации. */
export function buildStudentContext(s: AppState): StudentContext & WithTrack {
  const lang = s.profile.lang;
  // Слабые места — те же, что видит ученик в «Прогрессе» (lib/progress → weakSpots): низкая оценка, падение точности, давность.
  // Названия — на языке ученика, чтобы ИИ не смешивал языки в ответе.
  const titled = (id: string, mastery: number) => `${skillById(id) ? tx(skillById(id)!.title, lang) : id} (${Math.round(mastery * 100)}%)`;
  // Освоение — с затуханием без практики (#45, #80): давно не тренированный навык не «сильный», а «слабое место: давно не было практики».
  // Вызывается из обработчиков, не из рендера, поэтому Date.now() здесь допустим.
  const now = Date.now();
  const skills = decaySkills(s.skills, now);
  const spots = weakSpots({ skills, skillDays: s.skillDays, now }, 5);
  const weak: string[] = spots.map((w) => titled(w.skill, w.mastery));
  // Слабые навыки, у которых ответов ещё мало для «Слабых мест» (например, после диагностики), — тоже наставнику, до 5 всего.
  const listed = new Set(spots.map((w) => w.skill));
  for (const [id, stat] of Object.entries(skills)) {
    if (weak.length >= 5) break;
    if (!listed.has(id) && skillById(id) && masteryLevel(stat) === "weak") weak.push(titled(id, stat.mastery));
  }
  const strong: string[] = [];
  for (const [id, stat] of Object.entries(skills)) {
    if (masteryLevel(stat) !== "mastered") continue;
    strong.push(titled(id, stat.mastery));
  }
  const notes = ownNotesText(s.notebook, 700);
  return {
    name: s.profile.name,
    lang,
    grade: s.profile.grade,
    track: s.profile.track,
    goal: s.profile.goal,
    style: s.profile.style,
    level: levelInfo(s.xp).level,
    xp: s.xp,
    streak: liveStreak(s.streak, todayKey()),
    weak,
    strong,
    mistakes: s.mistakes.slice(0, 5).map((m) => ({ q: m.prompt.slice(0, 200), given: m.given, expected: m.expected })),
    memory: s.memory,
    notes,
    lessons: Object.keys(s.lessons).map((id) => (LESSON_META[id] ? tx(LESSON_META[id].title, lang) : id)),
  };
}
