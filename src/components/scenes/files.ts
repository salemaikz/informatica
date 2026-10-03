import type { FileNode } from "@/lib/types";

// Чистая логика сцены files: плоский список узлов дерева, вид иконки по расширению, путь в стиле Windows.

export type FileKind = "doc" | "image" | "music" | "video" | "code" | "archive" | "generic";

const EXT: Record<Exclude<FileKind, "generic">, string[]> = {
  doc: ["doc", "docx", "pdf", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx"],
  image: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "heic"],
  music: ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
  video: ["mp4", "avi", "mkv", "mov", "webm"],
  code: ["py", "html", "htm", "css", "js", "ts", "java", "c", "cpp", "cs", "json", "xml", "sql", "php"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
};

const KIND_BY_EXT = new Map<string, FileKind>(
  (Object.entries(EXT) as [Exclude<FileKind, "generic">, string[]][]).flatMap(([kind, list]) => list.map((e) => [e, kind] as const)),
);

/** Вид иконки по расширению: принимает «docx», «.docx», «урок.docx» — регистр не важен. */
export function iconFor(ext: string): FileKind {
  const s = ext.trim().toLowerCase();
  const dot = s.lastIndexOf(".");
  const e = dot >= 0 ? s.slice(dot + 1) : s;
  return KIND_BY_EXT.get(e) ?? "generic";
}

export interface FlatNode {
  name: string;
  /** Вложенность: 0 — верхний уровень. */
  depth: number;
  isFolder: boolean;
  /** Путь через «/»: «Информатика/Практика/task.docx». */
  path: string;
  /** Вид иконки файла (у папки — «generic», не используется). */
  kind: FileKind;
}

/** Дерево → список строк «сверху вниз» (папка, затем её содержимое) с глубиной и путём. */
export function flattenTree(tree: FileNode[], depth = 0, parent = ""): FlatNode[] {
  const out: FlatNode[] = [];
  for (const node of tree) {
    const path = parent ? `${parent}/${node.name}` : node.name;
    const isFolder = Array.isArray(node.children);
    out.push({ name: node.name, depth, isFolder, path, kind: isFolder ? "generic" : iconFor(node.name) });
    if (node.children) out.push(...flattenTree(node.children, depth + 1, path));
  }
  return out;
}

/** Приводит путь к виду «а/б/в»: разделители «/» и «\», без пустых и лишних частей. */
export function normalizePath(path: string | undefined): string {
  return (path ?? "")
    .split(/[\\/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

/** Путь в стиле Windows: «Учёба/Информатика/урок.docx» → «C:\Учёба\Информатика\урок.docx». Без пути — «C:\». */
export function windowsPath(active: string | undefined, drive = "C"): string {
  const p = normalizePath(active);
  return `${drive}:\\${p.split("/").join("\\")}`;
}

/** Строка относительно выделенного пути: сама цель, её родитель-папка («на пути») или посторонняя. */
export function pathState(path: string, active: string | undefined): "active" | "ancestor" | "none" {
  const a = normalizePath(active);
  if (!a) return "none";
  if (path === a) return "active";
  return a.startsWith(`${path}/`) ? "ancestor" : "none";
}
