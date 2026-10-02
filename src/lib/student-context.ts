import type { StudentContext } from "./ai-types";
import type { WithTrack } from "./school";
import type { AppState } from "./store";
import { liveStreak, levelInfo } from "./gamification";
import { masteryLevel } from "./mastery";
import { todayKey, tx } from "./text";
import { ownNotesText } from "./notebook";
import { skillById } from "@/content/skills";
import { LESSONS } from "@/content/course";

/** Сжатый портрет ученика для ИИ: только то, что помогает персонализации. */
export function buildStudentContext(s: AppState): StudentContext & WithTrack {
  const lang = s.profile.lang;
  const weak: string[] = [];
  const strong: string[] = [];
  for (const [id, stat] of Object.entries(s.skills)) {
    // Названия — на языке ученика, чтобы ИИ не смешивал языки в ответе.
    const title = skillById(id) ? tx(skillById(id)!.title, lang) : id;
    const label = `${title} (${Math.round(stat.mastery * 100)}%)`;
    const level = masteryLevel(stat);
    if (level === "weak") weak.push(label);
    if (level === "mastered") strong.push(label);
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
    lessons: Object.keys(s.lessons).map((id) => (LESSONS[id] ? tx(LESSONS[id].title, lang) : id)),
  };
}
