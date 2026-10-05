// Модель освоения навыка: экспоненциальное сглаживание по ответам.
// Первый ответ задаёт стартовую оценку, дальше каждый ответ сдвигает её на ALPHA × вес ответа.
//
// «Освоено» (решение #67, аудит T5): оценка ≥ MASTERED_FROM и не меньше MASTER_CLEAN верных самостоятельных
// первых попыток и успехи минимум в MASTER_DAYS разных дня. Ответ после подсказки и повтор ошибки весят вдвое меньше
// и не считаются самостоятельными.
//
// Затухание без практики (этап 14, #45): часть оценки выше DECAY_BASE тает вдвое за DECAY_HALF_LIFE_DAYS дней
// с последнего ответа (lastSeen). В хранилище лежит оценка «на момент lastSeen»; читатели берут decaySkills(stats, now),
// а новый ответ сдвигает уже затухшую оценку (updateSkill). Ниже базы оценка не тает: слабый навык и так слабый.

export interface SkillStat {
  attempts: number;
  correct: number;
  /** 0..1 */
  mastery: number;
  lastSeen: number;
  /** Верных самостоятельных первых попыток (без подсказки, не повтор) — #67. */
  clean?: number;
  /** В скольких разных днях были верные самостоятельные ответы — #67. */
  okDays?: number;
  /** День последнего верного самостоятельного ответа «ГГГГ-ММ-ДД» (чтобы считать разные дни). */
  okDay?: string;
}

export const ALPHA = 0.3;
export const WEAK_BELOW = 0.6;
export const MASTERED_FROM = 0.8;
/** «Освоено» требует столько верных самостоятельных ответов… */
export const MASTER_CLEAN = 4;
/** …в стольких разных днях. */
export const MASTER_DAYS = 2;
/** Вес ответа после подсказки и повтора ошибки. */
export const ASSISTED_WEIGHT = 0.5;
/** Стартовая оценка навыка по входной диагностике (#70) — ниже «слабого» порога: диагностика не делает навык освоенным. */
export const SEED_RIGHT = 0.45;
export const SEED_WRONG = 0.15;

/** Затухание (#45): уровень, ниже которого оценка не тает, и полураспад части выше него. */
export const DECAY_BASE = 0.5;
export const DECAY_HALF_LIFE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Оценка навыка на момент now с учётом затухания: BASE + (m − BASE) · 2^(−дни/30), m ≤ BASE — без изменений.
 * Через 30 дней без практики 1,0 → 0,75, 0,9 → 0,7; через 60 — 0,625 и 0,6. now ≤ lastSeen (или lastSeen = 0) — без затухания.
 */
export function decayedMastery(stat: Pick<SkillStat, "mastery" | "lastSeen"> | undefined, now: number): number {
  const m = num(stat?.mastery);
  const seen = num(stat?.lastSeen);
  if (m <= DECAY_BASE || !seen || !(now > seen)) return m;
  const days = (now - seen) / DAY_MS;
  return Math.round((DECAY_BASE + (m - DECAY_BASE) * 2 ** (-days / DECAY_HALF_LIFE_DAYS)) * 1000) / 1000;
}

/** Навык с затухшей оценкой (остальные поля как есть). Тот же объект, если оценка не изменилась. */
export function decayStat<T extends SkillStat>(stat: T, now: number): T {
  const m = decayedMastery(stat, now);
  return m === stat.mastery ? stat : { ...stat, mastery: m };
}

/**
 * Все навыки на момент now (#45) — так их читают карта, прогресс, прогноз, тренировка, игры и ИИ-наставник.
 * now = 0 (сервер, первый кадр) — без затухания. Тот же объект, если ничего не затухло.
 */
export function decaySkills<T extends SkillStat>(stats: Record<string, T>, now: number): Record<string, T> {
  if (!(now > 0)) return stats;
  let out: Record<string, T> | null = null;
  for (const [id, st] of Object.entries(stats)) {
    if (!st) continue;
    const d = decayStat(st, now);
    if (d !== st) (out ??= { ...stats })[id] = d;
  }
  return out ?? stats;
}

export function emptySkillStat(): SkillStat {
  return { attempts: 0, correct: 0, mastery: 0, lastSeen: 0, clean: 0, okDays: 0, okDay: "" };
}

/** Вес ответа для освоения: подсказка до ответа или повтор ошибки — половина (#67). */
export function answerWeight(a: { retry?: boolean; hinted?: boolean }): number {
  return a.retry || a.hinted ? ASSISTED_WEIGHT : 1;
}

export interface SkillUpdate {
  /** Вес ответа 0..1 (answerWeight). По умолчанию 1. */
  weight?: number;
  /** Самостоятельная первая попытка (не повтор, без подсказки): верная — копит clean и дни. */
  clean?: boolean;
  /** День ответа «ГГГГ-ММ-ДД» (todayKey) — для «успехов в разные дни». */
  day?: string;
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);

/** score: 1 — верно, 0 — неверно, промежуточное — частично верно. */
export function updateSkill(stat: SkillStat | undefined, score: number, now = Date.now(), opts: SkillUpdate = {}): SkillStat {
  const s = stat ?? emptySkillStat();
  const outcome = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  const w = Math.max(0, Math.min(1, opts.weight ?? 1));
  const attempts = num(s.attempts);
  // Новый ответ сдвигает оценку, уже затухшую с прошлого раза (#45): после долгого перерыва навык быстро «вспоминается».
  const prev = decayedMastery(s, now);
  // Первый ответ: старт 0,2 + 0,5 × результат (верный ответ после подсказки стартует ниже — 0,45, а не 0,7).
  const mastery = attempts === 0 ? 0.2 + 0.5 * outcome * w : prev + ALPHA * w * (outcome - prev);
  const success = outcome >= 0.99;
  const cleanHit = !!opts.clean && success && w >= 1;
  let okDays = num(s.okDays);
  let okDay = typeof s.okDay === "string" ? s.okDay : "";
  if (cleanHit && opts.day && opts.day !== okDay) {
    okDays += 1;
    okDay = opts.day;
  }
  return {
    attempts: attempts + 1,
    correct: num(s.correct) + (success ? 1 : 0),
    mastery: Math.round(Math.max(0, Math.min(1, mastery)) * 1000) / 1000,
    lastSeen: now,
    clean: num(s.clean) + (cleanHit ? 1 : 0),
    okDays,
    okDay,
  };
}

/**
 * Стартовая оценка по входной диагностике (#70): только если навык ещё не встречался.
 * Не копит clean и дни — «освоено» диагностика не даёт; оценка ниже WEAK_BELOW.
 */
export function seedSkill(stat: SkillStat | undefined, right: boolean, now = Date.now()): SkillStat {
  if (stat && num(stat.attempts) > 0) return stat;
  return { attempts: 1, correct: right ? 1 : 0, mastery: right ? SEED_RIGHT : SEED_WRONG, lastSeen: now, clean: 0, okDays: 0, okDay: "" };
}

export type MasteryLevel = "new" | "weak" | "progress" | "mastered";

export function masteryLevel(stat: SkillStat | undefined): MasteryLevel {
  if (!stat || !(num(stat.attempts) > 0)) return "new";
  const m = num(stat.mastery);
  if (m < WEAK_BELOW) return "weak";
  if (m < MASTERED_FROM) return "progress";
  // Высокая оценка без самостоятельных успехов в разные дни — ещё «в процессе» (#67).
  if (num(stat.clean) < MASTER_CLEAN || num(stat.okDays) < MASTER_DAYS) return "progress";
  return "mastered";
}

/** Чего не хватает до «освоено»: самостоятельных верных ответов и дней (0 — хватает). */
export function masteryNeeds(stat: SkillStat | undefined): { clean: number; days: number } {
  return {
    clean: Math.max(0, MASTER_CLEAN - num(stat?.clean)),
    days: Math.max(0, MASTER_DAYS - num(stat?.okDays)),
  };
}

/** Слабые навыки — от самого слабого к сильному. */
export function weakSkills(stats: Record<string, SkillStat>): string[] {
  return Object.entries(stats)
    .filter(([, s]) => masteryLevel(s) === "weak")
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([id]) => id);
}

/** День «ГГГГ-ММ-ДД» по местному времени для момента ms (как todayKey). */
function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Переход сохранений на правило #67 (версия 3): у старых навыков нет clean и дней.
 * Оценка ≥ MASTERED_FROM и ≥ 6 ответов — остаётся «освоено» (никого не разжалуем без данных);
 * остальным clean = число верных (не больше MASTER_CLEAN − 1), один день — день последнего ответа.
 */
export function migrateSkillStat(raw: unknown): SkillStat | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Partial<SkillStat>;
  const attempts = Math.floor(num(s.attempts));
  const correct = Math.floor(num(s.correct));
  const mastery = Math.min(1, num(s.mastery));
  const lastSeen = num(s.lastSeen);
  if (typeof s.clean === "number" && typeof s.okDays === "number") {
    return { attempts, correct, mastery, lastSeen, clean: Math.floor(num(s.clean)), okDays: Math.floor(num(s.okDays)), okDay: typeof s.okDay === "string" ? s.okDay.slice(0, 10) : "" };
  }
  const legacyMastered = mastery >= MASTERED_FROM && attempts >= 6;
  return {
    attempts,
    correct,
    mastery,
    lastSeen,
    clean: legacyMastered ? Math.max(MASTER_CLEAN, correct) : Math.min(correct, MASTER_CLEAN - 1),
    okDays: legacyMastered ? MASTER_DAYS : correct > 0 ? 1 : 0,
    okDay: correct > 0 && lastSeen > 0 ? dayOf(lastSeen) : "",
  };
}
