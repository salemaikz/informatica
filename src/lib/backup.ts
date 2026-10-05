// Резервная копия прогресса: сборка и проверка файла. Чистая логика без React и IndexedDB
// (чтение и запись IndexedDB — lib/backup-idb.ts), поэтому покрыта тестами в node (tests/backup.test.ts).
//
// Формат v3 — плоский, как v2 (старые версии приложения читают его, игнорируя `idb`):
//   { app: "informatica", version: 3, exportedAt,
//     <поля стора>: profile, xp, streak, days, skills, lessons, mistakes, achievements, newAchievements, notebook,
//                   memory, chat, aiUsage, maxCombo, games, exams, hearts, wallet, ledger, boost, practiceHearts,
//                   paywall, history, chats, codeTasks,
//     idb: { chats: { <chatId>: ChatMsg[] }, images: { <imageId>: dataURL }, scratch: ScratchPage[] } }
// Не входят: тариф и пробный период (привязаны к устройству), onboarded (после импорта всегда true).
//
// Файл — недоверенные данные: у каждого поля проверяется тип и длина. Битое поле пропускается (и попадает в `skipped`),
// битый элемент списка отбрасывается — импорт целиком не падает. Не копия Informatica (нет xp или profile) → null.

import type { AppState } from "./store";
import {
  BOOST_PACKS,
  HOUR,
  MINUTE,
  PLAN_FEATURES,
  PRACTICE_HEART_DAILY,
  SHOP_ITEMS,
  sanitizeAiUsage,
  sanitizeBoost,
  sanitizeHearts,
  sanitizePaywall,
  sanitizeWallet,
  type Boost,
  type ChipReason,
  type Hearts,
  type Wallet,
} from "./economy";
import { sanitizeHistory } from "./history";
import { sanitizeChats, type ChatMsg } from "./chats";
import { NOTE_LIMITS, repairNotebook, type FolderColor, type Note, type NoteSource, type Notebook } from "./notebook";
import { checkImageDataUrl } from "./note-images";
import { imageIds } from "./note-markdown";
import { sanitizeMessages } from "./chat-store";
import { sanitizePages, type ScratchPage } from "./scratch";

export const BACKUP_VERSION = 3;

/**
 * Лимиты. Обычная копия — 0,1–6 МБ. Потолок файла 40 МБ: фото 16 МБ (≈ 12 МБ картинок ≈ 40 снимков 1280 px) +
 * переписка 3 млн знаков (до 6 МБ в UTF-8) + черновик 2 МБ + состояние (в localStorage его не больше ~5 млн знаков).
 * Больше — телефону тяжело держать файл в памяти целиком.
 */
export const BACKUP_LIMITS = {
  fileBytes: 40 * 1024 * 1024,
  /** Все фото вместе — длина dataURL (base64). */
  imageChars: 16_000_000,
  imageCount: 200,
  /** Все сообщения чатов вместе, знаков. */
  chatChars: 3_000_000,
  /** Листы черновика, длина JSON. */
  scratchChars: 2_000_000,
  /** Запас файла на служебные поля при расчёте бюджета фото. */
  headroomBytes: 64 * 1024,
} as const;

/**
 * Потолки для экономики: файл копии — недоверенный, правленый вручную кошелёк или бустер не должен ломать баланс.
 * Чипы: 0,4 чипа за XP при множителе до ×4 (тариф «Безлимит» ×2 и бустер ×2) — 1 млн чипов это ≈ 625 тыс. XP, то есть
 * больше, чем ученик наберёт за годы занятий по 100 XP в день. Сердечки — наибольший запас среди тарифов (у «Безлимита» их нет,
 * heartsNow при чтении всё равно обрезает запас по текущему тарифу). Бустер — самый долгий из продаваемых (пакет на 7 дней)
 * и множитель самого сильного.
 */
export const ECONOMY_CAPS = {
  chips: 1_000_000,
  hearts: Math.max(...Object.values(PLAN_FEATURES).map((f) => f.maxHearts).filter(Number.isFinite)),
  boostMs: Math.max(...BOOST_PACKS.map((p) => p.hours * HOUR), ...SHOP_ITEMS.map((i) => (i.minutes ?? 0) * MINUTE)),
  boostMult: Math.max(...BOOST_PACKS.map((p) => p.mult), ...SHOP_ITEMS.map((i) => i.mult ?? 1)),
} as const;

/** Поля стора, которые попадают в копию. Нового поля нет в списке — не скомпилируется (см. BackupKeysComplete). */
export const BACKUP_STATE_KEYS = [
  "profile", "xp", "streak", "days", "skills", "lessons", "mistakes", "achievements", "newAchievements", "notebook",
  "memory", "chat", "aiUsage", "maxCombo", "games", "exams", "hearts", "wallet", "ledger", "boost", "practiceHearts",
  "paywall", "history", "chats", "codeTasks",
] as const;

type MustBeNever<T extends never> = T;
/** Если в AppState появилось поле, которого нет в копии (и нет среди сознательно исключённых), здесь ошибка компиляции. */
// Не входят: onboarded, тариф (привязан к устройству), незаконченные уроки (lessonRuns — временные, #41) и срез по навыкам (skillDays, #71).
export type BackupKeysComplete = MustBeNever<Exclude<keyof AppState, "onboarded" | "plan" | "lessonRuns" | "skillDays" | (typeof BACKUP_STATE_KEYS)[number]>>;

const CHIP_REASONS = ["welcome", "xp", "lesson", "perfect", "dailyGoal", "achievement", "exam", "buy", "ai", "refund"] as const satisfies readonly ChipReason[];
export type BackupReasonsComplete = MustBeNever<Exclude<ChipReason, (typeof CHIP_REASONS)[number]>>;

const FOLDER_COLORS: readonly FolderColor[] = ["primary", "success", "warning", "danger", "ai", "gold", "streak", "muted"];
const NOTE_SOURCES: readonly NoteSource[] = ["own", "ai", "scratch", "lesson"];
const LESSON_VIA = ["learn", "check", "game", "extern"] as const;
const EXAM_KINDS = ["full", "mini", "topic", "unit"] as const;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nonNeg = (v: unknown): number => (isNum(v) && v >= 0 ? v : 0);
const int = (v: unknown, max = 1e9): number => Math.min(max, Math.floor(nonNeg(v)));
const unit = (v: unknown): number => (isNum(v) ? Math.min(1, Math.max(0, v)) : 0);
const str = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOPIC_RE = /^t\d{2}$/;
const IMG_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
/** Ключи словарей (id уроков, навыков, задач): без служебных имён, чтобы не задеть прототип. */
const okKey = (k: string): boolean => k.length >= 1 && k.length <= 100 && k !== "__proto__" && k !== "constructor" && k !== "prototype";

/** Словарь «ключ → элемент»: ключ и элемент проходят проверку, лишнее отбрасывается. undefined — поле не словарь. */
function cleanMap<T>(v: unknown, cap: number, item: (x: Obj) => T | null, keyOk: (k: string) => boolean = okKey): Record<string, T> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, T> = {};
  let n = 0;
  for (const [k, x] of Object.entries(v)) {
    if (n >= cap) break;
    if (!keyOk(k) || !isObj(x)) continue;
    const c = item(x);
    if (c === null) continue;
    out[k] = c;
    n++;
  }
  return out;
}

/** Список элементов: битые отбрасываются. undefined — поле не массив. */
function cleanList<T>(v: unknown, cap: number, item: (x: Obj) => T | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const x of v) {
    if (out.length >= cap) break;
    if (!isObj(x)) continue;
    const c = item(x);
    if (c !== null) out.push(c);
  }
  return out;
}

// ---------- Элементы состояния ----------

const cleanDay = (x: Obj) => ({
  xp: nonNeg(x.xp),
  answers: nonNeg(x.answers),
  correct: nonNeg(x.correct),
  seconds: nonNeg(x.seconds),
  ...(isNum(x.lessons) ? { lessons: nonNeg(x.lessons) } : {}),
});

const cleanSkill = (x: Obj) =>
  isNum(x.attempts) ? { attempts: int(x.attempts), correct: int(x.correct), mastery: unit(x.mastery), lastSeen: nonNeg(x.lastSeen) } : null;

const cleanLesson = (x: Obj) => {
  if (!isNum(x.completions)) return null;
  return {
    completions: int(x.completions),
    bestAccuracy: unit(x.bestAccuracy),
    lastAt: nonNeg(x.lastAt),
    totalXp: nonNeg(x.totalXp),
    ...(isNum(x.firstAt) ? { firstAt: nonNeg(x.firstAt) } : {}),
    ...((LESSON_VIA as readonly unknown[]).includes(x.via) ? { via: x.via } : {}),
    ...(isNum(x.stage) ? { stage: Math.min(5, int(x.stage)) } : {}),
    ...(isNum(x.dueAt) ? { dueAt: nonNeg(x.dueAt) } : {}),
  };
};

const cleanGame = (x: Obj) => ({ best: nonNeg(x.best), plays: int(x.plays), lastAt: nonNeg(x.lastAt) });

const cleanCodeTask = (x: Obj) => (isNum(x.attempts) ? { solved: x.solved === true, attempts: int(x.attempts), at: nonNeg(x.at) } : null);

function cleanMistake(x: Obj) {
  const id = str(x.id, 80);
  const stepId = str(x.stepId, 120);
  if (!id || !stepId) return null;
  return {
    id,
    stepId,
    ...(str(x.lessonId, 80) ? { lessonId: str(x.lessonId, 80) } : {}),
    ...(str(x.skill, 80) ? { skill: str(x.skill, 80) } : {}),
    prompt: str(x.prompt, 2000) ?? "",
    given: str(x.given, 2000) ?? "",
    expected: str(x.expected, 2000) ?? "",
    at: nonNeg(x.at),
  };
}

function cleanExam(x: Obj) {
  const id = str(x.id, 80);
  if (!id || !(EXAM_KINDS as readonly unknown[]).includes(x.kind) || !isNum(x.points) || !isNum(x.maxPoints)) return null;
  const byTopic: Record<string, { points: number; max: number }> = {};
  if (isObj(x.byTopic)) {
    for (const [k, v] of Object.entries(x.byTopic)) {
      if (TOPIC_RE.test(k) && isObj(v) && isNum(v.points) && isNum(v.max)) byTopic[k] = { points: nonNeg(v.points), max: nonNeg(v.max) };
    }
  }
  const topics = Array.isArray(x.topics) ? x.topics.filter((t): t is string => typeof t === "string" && TOPIC_RE.test(t)).slice(0, 13) : undefined;
  return {
    id,
    kind: x.kind,
    seed: isNum(x.seed) ? x.seed : 0,
    at: nonNeg(x.at),
    points: nonNeg(x.points),
    maxPoints: nonNeg(x.maxPoints),
    durationSec: nonNeg(x.durationSec),
    byTopic,
    ...(topics?.length ? { topics } : {}),
    ...(str(x.unit, 60) ? { unit: str(x.unit, 60) } : {}),
    ...(str(x.title, 160) ? { title: str(x.title, 160) } : {}),
  };
}

function cleanLedger(x: Obj) {
  const id = str(x.id, 80);
  if (!id || !isNum(x.amount) || !(CHIP_REASONS as readonly unknown[]).includes(x.reason)) return null;
  const amount = Math.max(-ECONOMY_CAPS.chips, Math.min(ECONOMY_CAPS.chips, Math.trunc(x.amount)));
  return { id, at: nonNeg(x.at), amount, reason: x.reason, ...(str(x.note, 40) ? { note: str(x.note, 40) } : {}) };
}

function cleanChatMessage(x: Obj) {
  const role = x.role;
  const id = str(x.id, 80);
  if (!id || (role !== "user" && role !== "assistant")) return null;
  return { id, role, content: str(x.content, 8000) ?? "", ...(x.hadImage === true ? { hadImage: true } : {}), at: nonNeg(x.at) };
}

function cleanStreak(x: Obj): Obj | null {
  if (!isNum(x.current)) return null;
  return {
    current: int(x.current),
    best: int(x.best),
    lastDay: typeof x.lastDay === "string" && DAY_RE.test(x.lastDay) ? x.lastDay : null,
    ...(isNum(x.freezes) ? { freezes: int(x.freezes, 99) } : {}),
    ...(Array.isArray(x.frozenDays) ? { frozenDays: x.frozenDays.filter((d): d is string => typeof d === "string" && DAY_RE.test(d)).slice(-10) } : {}),
  };
}

/** Картинки записей: id из списка images и из ссылок note-img: в тексте. */
export function noteImageIds(notebook: Pick<Notebook, "notes"> | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of notebook?.notes ?? []) {
    for (const id of [...(n.images ?? []), ...imageIds(n.body)]) {
      if (IMG_ID_RE.test(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

function cleanNotebook(v: unknown): Notebook | undefined {
  if (!isObj(v)) return undefined;
  const nb = repairNotebook(v);
  return {
    folders: nb.folders.map((f) => ({ ...f, color: FOLDER_COLORS.includes(f.color) ? f.color : "primary" })),
    notes: nb.notes.map((n): Note => {
      const images = (n.images ?? []).filter((id) => IMG_ID_RE.test(id)).slice(0, 50);
      return {
        id: n.id.slice(0, 80),
        folderId: n.folderId,
        title: n.title,
        body: n.body,
        ...(str(n.lessonId, 80) ? { lessonId: str(n.lessonId, 80) } : {}),
        source: NOTE_SOURCES.includes(n.source) ? n.source : "own",
        ...(n.pinned === true ? { pinned: true } : {}),
        ...(images.length ? { images } : {}),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      };
    }),
  };
}

/** Заметки версии 1 (по ключу урока): их превратит в папки миграция стора. */
const cleanLegacyNotes = (v: unknown) =>
  cleanMap(v, NOTE_LIMITS.notes, (x) => ({
    ...(str(x.own, NOTE_LIMITS.body) ? { own: str(x.own, NOTE_LIMITS.body) } : {}),
    saved: (cleanList(x.saved, 100, (s) => (str(s.id, 80) && str(s.text, NOTE_LIMITS.body) ? { id: str(s.id, 80)!, text: str(s.text, NOTE_LIMITS.body)!, at: nonNeg(s.at) } : null)) ?? []),
  }));

/** Кошелёк из файла: каждое число не выше потолка. */
function capWallet(w: Wallet): Wallet {
  const cap = ECONOMY_CAPS.chips;
  return { chips: Math.min(cap, w.chips), earned: Math.min(cap, w.earned), spent: Math.min(cap, w.spent) };
}

/** Сердечки из файла: не больше наибольшего запаса среди тарифов. */
const capHearts = (h: Hearts): Hearts => ({ ...h, count: Math.min(ECONOMY_CAPS.hearts, h.count) });

/** Бустер из файла: множитель и срок не выше того, что можно купить (срок отсчитывается от now). */
function capBoost(b: Boost | null, now: number): Boost | null {
  return b ? { mult: Math.min(ECONOMY_CAPS.boostMult, b.mult), until: Math.min(b.until, now + ECONOMY_CAPS.boostMs) } : null;
}

// ---------- Состояние ----------

export interface CleanState {
  state: Obj;
  /** Поля, которые не удалось прочитать и пришлось пропустить. */
  skipped: string[];
}

/** Состояние из файла → только известные поля с проверенными типами. Не копия Informatica → null. now — для срока бустера. */
export function cleanState(raw: unknown, now: number = Date.now()): CleanState | null {
  if (!isObj(raw)) return null;
  if (!isNum(raw.xp) || raw.xp < 0 || !isObj(raw.profile)) return null;
  const state: Obj = { xp: int(raw.xp), profile: raw.profile };
  const skipped: string[] = [];
  // Поле есть в файле, но битое → пропускаем (значение по умолчанию подставит стор).
  const put = (key: string, value: unknown) => {
    if (raw[key] === undefined) return;
    if (value === undefined) skipped.push(key);
    else state[key] = value;
  };

  if (isNum(raw.version)) state.version = raw.version;
  put("streak", isObj(raw.streak) ? (cleanStreak(raw.streak) ?? undefined) : undefined);
  put("days", cleanMap(raw.days, 4000, cleanDay, (k) => DAY_RE.test(k)));
  put("skills", cleanMap(raw.skills, 2000, cleanSkill));
  put("lessons", cleanMap(raw.lessons, 2000, cleanLesson));
  put("games", cleanMap(raw.games, 500, cleanGame));
  put("codeTasks", cleanMap(raw.codeTasks, 3000, cleanCodeTask));
  put("achievements", isObj(raw.achievements) ? Object.fromEntries(Object.entries(raw.achievements).filter(([k, v]) => okKey(k) && isNum(v)).slice(0, 300)) : undefined);
  put("newAchievements", Array.isArray(raw.newAchievements) ? raw.newAchievements.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, 100) : undefined);
  put("mistakes", cleanList(raw.mistakes, 100, cleanMistake));
  put("exams", cleanList(raw.exams, 50, cleanExam));
  put("ledger", cleanList(raw.ledger, 50, cleanLedger));
  put("chat", cleanList(raw.chat, 120, cleanChatMessage));
  put("notebook", cleanNotebook(raw.notebook));
  put("aiUsage", isObj(raw.aiUsage) ? sanitizeAiUsage(raw.aiUsage) : undefined);
  put("hearts", isObj(raw.hearts) ? capHearts(sanitizeHearts(raw.hearts)) : undefined);
  put("wallet", isObj(raw.wallet) ? capWallet(sanitizeWallet(raw.wallet)) : undefined);
  put("practiceHearts", isObj(raw.practiceHearts) && typeof raw.practiceHearts.day === "string" && isNum(raw.practiceHearts.count) ? { day: raw.practiceHearts.day.slice(0, 10), count: int(raw.practiceHearts.count, PRACTICE_HEART_DAILY) } : undefined);
  put("paywall", isObj(raw.paywall) ? sanitizePaywall(raw.paywall) : undefined);
  if (raw.boost !== undefined) state.boost = capBoost(sanitizeBoost(raw.boost), now);
  put("history", Array.isArray(raw.history) ? sanitizeHistory(raw.history) : undefined);
  put("chats", Array.isArray(raw.chats) ? sanitizeChats(raw.chats).filter((c) => okKey(c.id)) : undefined);
  put("memory", typeof raw.memory === "string" ? raw.memory.slice(0, 1500) : undefined);
  put("maxCombo", isNum(raw.maxCombo) ? int(raw.maxCombo, 1e6) : undefined);
  // Заметки версии 1 нужны только миграции из v1.
  if (raw.notes !== undefined && !(isNum(raw.version) && raw.version >= 2)) put("notes", cleanLegacyNotes(raw.notes));
  return { state, skipped };
}

// ---------- Данные IndexedDB ----------

export interface IdbData {
  /** null — раздела нет в файле: локальные данные не трогаем. */
  chats: Record<string, ChatMsg[]> | null;
  images: Record<string, string> | null;
  scratch: ScratchPage[] | null;
}

export interface CleanIdb {
  idb: IdbData;
  /** Фото, которые есть в файле, но не вошли (не картинка, больше 3 МБ, не хватило бюджета). */
  droppedImages: number;
}

/**
 * Данные IndexedDB из файла (или собранные для экспорта) → проверенные и в пределах бюджета.
 * Сообщения — только чатов, которые есть в `state.chats`; фото — только те, на которые ссылаются записи.
 */
export function cleanIdb(raw: unknown, state: Obj, imageBudget: number = BACKUP_LIMITS.imageChars): CleanIdb {
  const r = isObj(raw) ? raw : {};
  const idb: IdbData = { chats: null, images: null, scratch: null };
  let droppedImages = 0;

  if (isObj(r.chats)) {
    const chats: Record<string, ChatMsg[]> = {};
    let chars = 0;
    for (const meta of Array.isArray(state.chats) ? (state.chats as { id: string }[]) : []) {
      if (!okKey(meta.id) || !has(r.chats, meta.id)) continue;
      const msgs = sanitizeMessages(r.chats[meta.id]);
      // Бюджет исчерпан — старые сообщения отбрасываем, новые остаются.
      const kept: ChatMsg[] = [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const len = msgs[i].content.length + 60;
        if (chars + len > BACKUP_LIMITS.chatChars) break;
        chars += len;
        kept.unshift(msgs[i]);
      }
      if (kept.length) chats[meta.id] = kept;
    }
    idb.chats = chats;
  }

  if (isObj(r.images)) {
    const images: Record<string, string> = {};
    let chars = 0;
    let count = 0;
    for (const id of noteImageIds(state.notebook as Notebook | undefined)) {
      if (!has(r.images, id)) continue;
      const url = r.images[id];
      if (checkImageDataUrl(url) !== "ok" || count >= BACKUP_LIMITS.imageCount || chars + (url as string).length > imageBudget) {
        droppedImages++;
        continue;
      }
      images[id] = url as string;
      chars += (url as string).length;
      count++;
    }
    idb.images = images;
  }

  if (Array.isArray(r.scratch)) {
    let pages = sanitizePages(r.scratch);
    while (pages.length && JSON.stringify(pages).length > BACKUP_LIMITS.scratchChars) pages = pages.slice(0, -1);
    idb.scratch = pages;
  }
  return { idb, droppedImages };
}

// ---------- Файл копии ----------

export interface ParsedBackup {
  /** Версия копии: 1–2 — только стор; 3 — вместе с IndexedDB. */
  version: number;
  state: Obj;
  /** null — в файле нет раздела idb (копия v2). */
  idb: IdbData | null;
  skipped: string[];
  droppedImages: number;
}

/** Копия, сохранённая прямо из localStorage ({ state, version }) — тоже подходит. */
function unwrapPersisted(raw: unknown): unknown {
  if (isObj(raw) && raw.xp === undefined && isObj(raw.state)) {
    return { ...raw.state, ...(isNum(raw.version) ? { version: raw.version } : {}) };
  }
  return raw;
}

/** Файл → проверенная копия; не копия Informatica → null. Битые поля пропускаются. now — для срока бустера. */
export function parseBackup(raw: unknown, now: number = Date.now()): ParsedBackup | null {
  const file = unwrapPersisted(raw);
  const cleaned = cleanState(file, now);
  if (!cleaned || !isObj(file)) return null;
  const version = isNum(file.version) ? file.version : isObj(file.notebook) ? 2 : 1;
  let idb: IdbData | null = null;
  let droppedImages = 0;
  if (isObj(file.idb)) {
    const c = cleanIdb(file.idb, cleaned.state);
    idb = c.idb;
    droppedImages = c.droppedImages;
  }
  return { version, state: cleaned.state, idb, skipped: cleaned.skipped, droppedImages };
}

/** Совместимость: проверенное состояние из копии (без данных IndexedDB). */
export function cleanBackup(raw: unknown, now: number = Date.now()): Obj | null {
  return parseBackup(raw, now)?.state ?? null;
}

export interface BackupSummary {
  version: number;
  xp: number;
  lessons: number;
  chats: number;
  images: number;
}

/** Что в копии — для окна подтверждения. */
export function summarizeBackup(p: ParsedBackup): BackupSummary {
  const len = (v: unknown) => (isObj(v) ? Object.keys(v).length : Array.isArray(v) ? v.length : 0);
  return { version: p.version, xp: Number(p.state.xp) || 0, lessons: len(p.state.lessons), chats: len(p.state.chats), images: len(p.idb?.images) };
}

/** Данные IndexedDB, собранные для экспорта (сырые: проверит buildBackup). */
export interface IdbSnapshot {
  chats: Record<string, unknown>;
  images: Record<string, string>;
  scratch: unknown;
}

export interface BuiltBackup {
  file: Obj;
  /** Фото, которые не поместились в файл. */
  droppedImages: number;
}

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

/**
 * Состояние стора + IndexedDB → объект копии v3. Всё проходит те же проверки и бюджеты, что и при импорте,
 * поэтому файл всегда можно загрузить обратно.
 */
export function buildBackup(state: object, snapshot: IdbSnapshot, now: number): BuiltBackup {
  const picked: Obj = {};
  for (const k of BACKUP_STATE_KEYS) if (has(state, k)) picked[k] = (state as Obj)[k];
  const cleaned = cleanState({ ...picked, version: BACKUP_VERSION }, now);
  if (!cleaned) throw new Error("backup: состояние не похоже на прогресс");
  const { version: _version, ...fields } = cleaned.state;
  void _version;
  // Сначала переписка и черновик — оставшееся место отдаём фото.
  const base = cleanIdb(snapshot, cleaned.state, 0).idb;
  const otherBytes = utf8Bytes(JSON.stringify({ ...fields, idb: { chats: base.chats, scratch: base.scratch } }));
  const imageBudget = Math.max(0, Math.min(BACKUP_LIMITS.imageChars, BACKUP_LIMITS.fileBytes - otherBytes - BACKUP_LIMITS.headroomBytes));
  const { idb, droppedImages } = cleanIdb(snapshot, cleaned.state, imageBudget);
  return {
    file: { app: "informatica", version: BACKUP_VERSION, exportedAt: now, ...fields, idb: { chats: idb.chats ?? {}, images: idb.images ?? {}, scratch: idb.scratch ?? [] } },
    droppedImages,
  };
}
