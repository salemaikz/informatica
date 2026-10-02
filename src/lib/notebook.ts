// Конспекты 2.0: папки и записи (markdown). Чистая логика без React — покрыта тестами.
// Текст записей живёт в сторе (localStorage); рисунки и фото — в IndexedDB (lib/note-images.ts),
// в тексте на них ссылка ![](note-img:<id>), в записи — список images (чтобы удалить вместе с записью).

export type FolderColor = "primary" | "success" | "warning" | "danger" | "ai" | "gold" | "streak" | "muted";

/** Системные папки: создаются сами, не удаляются, названия — из словаря (notes.folder.<system>). */
export type SystemFolder = "general" | "lessons" | "ai" | "scratch";

export interface NoteFolder {
  id: string;
  /** Название папки ученика. У системных — пусто (берётся из словаря). */
  name: string;
  color: FolderColor;
  createdAt: number;
  system?: SystemFolder;
}

export type NoteSource = "own" | "ai" | "scratch" | "lesson";

export interface Note {
  id: string;
  folderId: string;
  title: string;
  /** Markdown: заголовки, списки, чек-листы, **жирный**, ==маркер== (=={g}зелёный==), код, ![](note-img:<id>). */
  body: string;
  /** Урок, к которому относится запись (заметка к уроку, ответ ИИ на шаге урока). */
  lessonId?: string;
  source: NoteSource;
  pinned?: boolean;
  /** id картинок в IndexedDB. */
  images?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  folders: NoteFolder[];
  notes: Note[];
}

export const NOTE_LIMITS = { notes: 500, folders: 40, body: 20_000, title: 120, folderName: 40 } as const;

/** Цвета папок системных разделов. */
const SYSTEM_COLORS: Record<SystemFolder, FolderColor> = { general: "primary", lessons: "success", ai: "ai", scratch: "warning" };

export const SYSTEM_FOLDER_ORDER: SystemFolder[] = ["general", "lessons", "ai", "scratch"];

export function systemFolderId(system: SystemFolder): string {
  return `sys-${system}`;
}

export function defaultFolders(now = 0): NoteFolder[] {
  return SYSTEM_FOLDER_ORDER.map((system) => ({ id: systemFolderId(system), name: "", color: SYSTEM_COLORS[system], createdAt: now, system }));
}

export function emptyNotebook(now = 0): Notebook {
  return { folders: defaultFolders(now), notes: [] };
}

/** Заголовок по первой строке текста (без markdown), если ученик его не задал. */
export function titleFromBody(body: string, max = 60): string {
  const line = body
    .split("\n")
    .map((l) =>
      l
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/==(\{[a-z]+\})?/g, "")
        .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/, "")
        .replace(/^\[[ xX]\]\s*/, "")
        .replace(/[*_`~]/g, "")
        .trim(),
    )
    .find(Boolean);
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Папка по умолчанию для записи из источника. */
export function folderForSource(source: NoteSource, lessonId?: string): string {
  if (source === "ai") return systemFolderId("ai");
  if (source === "scratch") return systemFolderId("scratch");
  if (lessonId) return systemFolderId("lessons");
  return systemFolderId("general");
}

/** Добавляет недостающие системные папки и чинит записи с несуществующей папкой (данные из хранилища недоверенные). */
export function repairNotebook(raw: unknown, now = 0): Notebook {
  const nb = (raw ?? {}) as Partial<Notebook>;
  const folders: NoteFolder[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(nb.folders) ? nb.folders : []) {
    if (!f || typeof f !== "object" || typeof f.id !== "string" || seen.has(f.id)) continue;
    seen.add(f.id);
    folders.push({
      id: f.id,
      name: typeof f.name === "string" ? f.name.slice(0, NOTE_LIMITS.folderName) : "",
      color: f.color ?? "primary",
      createdAt: typeof f.createdAt === "number" ? f.createdAt : now,
      ...(f.system && SYSTEM_FOLDER_ORDER.includes(f.system) ? { system: f.system } : {}),
    });
  }
  for (const def of defaultFolders(now)) if (!seen.has(def.id)) folders.push(def);
  const ids = new Set(folders.map((f) => f.id));
  const notes: Note[] = [];
  const seenNotes = new Set<string>();
  for (const n of Array.isArray(nb.notes) ? nb.notes : []) {
    if (!n || typeof n !== "object" || typeof n.id !== "string" || seenNotes.has(n.id) || typeof n.body !== "string") continue;
    seenNotes.add(n.id);
    notes.push({
      ...n,
      title: typeof n.title === "string" ? n.title.slice(0, NOTE_LIMITS.title) : "",
      body: n.body.slice(0, NOTE_LIMITS.body),
      folderId: ids.has(n.folderId) ? n.folderId : systemFolderId("general"),
      source: n.source ?? "own",
      images: Array.isArray(n.images) ? n.images.filter((x): x is string => typeof x === "string") : undefined,
      createdAt: typeof n.createdAt === "number" ? n.createdAt : now,
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : now,
    });
  }
  return { folders, notes: notes.slice(0, NOTE_LIMITS.notes) };
}

/** Старый формат (v1): по ключу урока/«general» — своя заметка и сохранённые ответы ИИ. */
export interface LegacyNotes {
  [key: string]: { own?: string; saved?: { id: string; text: string; at: number }[] } | undefined;
}

/** Переносит конспекты v1 в папки v2: своя заметка → «Мои записи»/«К урокам», ответы ИИ → «Ответы Бита». */
export function migrateLegacyNotes(legacy: LegacyNotes | undefined, now: number): Notebook {
  const nb = emptyNotebook(now);
  if (!legacy || typeof legacy !== "object") return nb;
  let i = 0;
  const id = () => `m${now.toString(36)}${(i++).toString(36)}`;
  for (const [key, data] of Object.entries(legacy)) {
    if (!data || typeof data !== "object") continue;
    const lessonId = key === "general" ? undefined : key;
    const own = typeof data.own === "string" ? data.own.trim() : "";
    if (own) {
      nb.notes.push({
        id: id(),
        folderId: folderForSource("own", lessonId),
        title: titleFromBody(own),
        body: own.slice(0, NOTE_LIMITS.body),
        lessonId,
        source: "own",
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const s of Array.isArray(data.saved) ? data.saved : []) {
      if (!s || typeof s.text !== "string" || !s.text.trim()) continue;
      const at = typeof s.at === "number" ? s.at : now;
      nb.notes.push({
        id: id(),
        folderId: folderForSource("ai", lessonId),
        title: titleFromBody(s.text),
        body: s.text.slice(0, NOTE_LIMITS.body),
        lessonId,
        source: "ai",
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  nb.notes = nb.notes.slice(0, NOTE_LIMITS.notes);
  return nb;
}

/** Записи папки: закреплённые сверху, затем по дате изменения. */
export function notesInFolder(nb: Notebook, folderId: string): Note[] {
  return nb.notes
    .filter((n) => n.folderId === folderId)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
}

/** Своё (не ИИ) в записях — для портрета ученика в ИИ (что он сам отмечает). */
export function ownNotesText(nb: Notebook, max = 700): string {
  return nb.notes
    .filter((n) => n.source === "own")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((n) => n.body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}
