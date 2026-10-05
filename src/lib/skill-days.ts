// Дневной срез по навыкам (решение #71): сколько заданий, сумма баллов, с подсказкой, активные секунды.
// Нужен для динамики по темам за 30 дней, времени и точности по темам, «Слабых мест». Хранится 60 последних дней.
// Чистые функции без React; запись — в сторе (recordAnswer, recordCodeTask, recordExam).

export interface SkillDay {
  /** Заданий (первые попытки, пропуск тоже). */
  n: number;
  /** Сумма баллов. */
  s: number;
  /** С подсказкой. */
  h?: number;
  /** Активных секунд на ответы. */
  sec?: number;
}

/** День «ГГГГ-ММ-ДД» → навык → итог дня. */
export type SkillDays = Record<string, Record<string, SkillDay>>;

export const SKILL_DAYS_KEEP = 60;
/** Время одного ответа в срезе — не больше (защита от забытой вкладки). */
export const ANSWER_SEC_CAP = 300;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SKILL_RE = /^[\w.-]{1,60}$/;

/** Оставить SKILL_DAYS_KEEP последних дней (ключи «ГГГГ-ММ-ДД» сортируются как даты). */
export function pruneSkillDays(sd: SkillDays): SkillDays {
  const keys = Object.keys(sd);
  if (keys.length <= SKILL_DAYS_KEEP) return sd;
  const keep = keys.sort().slice(-SKILL_DAYS_KEEP);
  return Object.fromEntries(keep.map((k) => [k, sd[k]]));
}

/** Добавить к итогу навыка за день. */
export function addSkillDay(sd: SkillDays, day: string, skill: string, add: Partial<SkillDay>): SkillDays {
  if (!DAY_RE.test(day) || !SKILL_RE.test(skill)) return sd;
  const today = sd[day] ?? {};
  const cur = today[skill] ?? { n: 0, s: 0 };
  const next: SkillDay = { n: cur.n + Math.max(0, add.n ?? 0), s: cur.s + Math.max(0, add.s ?? 0) };
  const h = (cur.h ?? 0) + Math.max(0, add.h ?? 0);
  const sec = (cur.sec ?? 0) + Math.max(0, Math.min(ANSWER_SEC_CAP, add.sec ?? 0));
  if (h > 0) next.h = h;
  if (sec > 0) next.sec = Math.round(sec);
  return pruneSkillDays({ ...sd, [day]: { ...today, [skill]: next } });
}

/** Данные из localStorage — недоверенные: только корректные дни и навыки, числа ≥ 0. */
export function sanitizeSkillDays(raw: unknown): SkillDays {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SkillDays = {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  for (const [day, skills] of Object.entries(raw as Record<string, unknown>).slice(0, 400)) {
    if (!DAY_RE.test(day) || !skills || typeof skills !== "object" || Array.isArray(skills)) continue;
    const row: Record<string, SkillDay> = {};
    for (const [skill, v] of Object.entries(skills as Record<string, unknown>).slice(0, 300)) {
      if (!SKILL_RE.test(skill) || !v || typeof v !== "object") continue;
      const x = v as Partial<SkillDay>;
      const item: SkillDay = { n: Math.floor(num(x.n)), s: num(x.s) };
      if (num(x.h) > 0) item.h = Math.floor(num(x.h));
      if (num(x.sec) > 0) item.sec = Math.round(num(x.sec));
      if (item.n > 0) row[skill] = item;
    }
    if (Object.keys(row).length) out[day] = row;
  }
  return pruneSkillDays(out);
}
