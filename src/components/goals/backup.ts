// Резервная копия прогресса: проверка файла перед importProgress и скачивание файлов.
// Файл — недоверенные данные: пропускаем только известные поля и только нужных типов,
// иначе битое поле (например, lessons: null) уронит экраны после импорта.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Поля-словари: если есть — объект, и каждое значение тоже объект. */
const MAPS = ["days", "skills", "lessons", "games"] as const;
/** Поля-объекты. */
const OBJECTS = ["streak", "achievements", "notebook", "aiUsage", "notes"] as const;
/** Поля-массивы. */
const ARRAYS = ["mistakes", "exams", "chat", "newAchievements"] as const;

/**
 * Копия Informatica → объект только с известными полями; не копия или битые поля → null.
 * Остальное (значения внутри профиля, конспекты, расписание) чинит стор при слиянии.
 */
export function cleanBackup(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  if (typeof raw.xp !== "number" || !Number.isFinite(raw.xp) || raw.xp < 0) return null;
  if (!isObj(raw.profile)) return null;
  const out: Obj = { xp: Math.floor(raw.xp), profile: raw.profile };
  if (typeof raw.version === "number" && Number.isFinite(raw.version)) out.version = raw.version;
  for (const k of MAPS) {
    if (raw[k] === undefined) continue;
    const v = raw[k];
    if (!isObj(v) || !Object.values(v).every(isObj)) return null;
    out[k] = v;
  }
  for (const k of OBJECTS) {
    if (raw[k] === undefined) continue;
    if (!isObj(raw[k])) return null;
    out[k] = raw[k];
  }
  for (const k of ARRAYS) {
    if (raw[k] === undefined) continue;
    if (!Array.isArray(raw[k])) return null;
    out[k] = raw[k];
  }
  if (typeof raw.memory === "string") out.memory = raw.memory.slice(0, 1500);
  if (typeof raw.maxCombo === "number" && Number.isFinite(raw.maxCombo)) out.maxCombo = raw.maxCombo;
  return out;
}

/** Скачать файл. Ссылку отзываем с задержкой: Safari и Firefox иначе иногда отменяют загрузку. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
