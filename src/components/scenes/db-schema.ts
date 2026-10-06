// Схема БД: раскладка таблиц-карточек и линий связей (чистая логика, без React).
// Компонент DbSchemaScene только рисует то, что посчитано здесь: размеры, шрифты, координаты линий и подписей «1» / «N».
//
// Геометрия: одна колонка карточек (1 таблица) или две (2–4 таблицы: 2 — рядом, 3–4 — в два ряда). Между колонками — «коридор»:
// все линии связей идут только по нему (горизонтальный выход от поля к краю карточки, вертикаль по своей полосе, горизонтальный вход),
// поэтому не пересекают текст полей.

import type { Scene } from "@/lib/types";
import type { DictKey } from "@/i18n/dict";
import { estimateTextWidth } from "./text-width";

export type DbSchemaScene = Extract<Scene, { kind: "db-schema" }>;
type DbTable = DbSchemaScene["tables"][number];

/** Размеры (px). Всё в одних единицах: SVG-линии и HTML-карточки лежат в одной системе координат. */
export const DB_GEO = {
  /** Рамка карточки (border-2) — входит в её размеры. */
  border: 2,
  /** Заголовок в одну строку (если имя таблицы не влезло — выше, см. DbLayout.headH). */
  headH: 30,
  rowH: 26,
  /** Вертикальные поля строки, где имя и тип стоят в несколько строк. */
  stackPad: 10,
  /** Межстрочный множитель: строки считаются целыми пикселями, чтобы оценка высоты совпадала с вёрсткой. */
  lineMul: 1.2,
  padX: 8,
  /** Значок ключа / ссылки: всегда занимает колонку, чтобы имена полей выстраивались. */
  icon: 14,
  iconGap: 5,
  typeGap: 8,
  /** Зазор между значками ключа и ссылки у поля, которое одновременно PK и FK. */
  iconPairGap: 2,
  /** Зазор между рядами карточек. */
  rowGap: 18,
  minCard: 104,
  minSingle: 148,
  /** Потолок ширины карточки на телефоне (по ТЗ — не больше 160) и на широком экране. */
  maxNarrow: 160,
  maxWide: 208,
  /** Контейнер шире этого — «широкий». */
  wideFrom: 420,
  /** Расстояние от края карточки до первой полосы линий (под подпись «1»/«N»). */
  edge: 16,
  laneStep: 10,
  /** Кегли: имя поля, тип, подпись связи. */
  namePx: 13,
  typePx: 11.5,
  cardLabelPx: 12,
} as const;

/** Масштабы шрифта строк: сначала пробуем без сжатия, потом сжимаем (не ниже 0.85), потом — тип под именем. */
export const DB_SCALES = [1, 0.92, 0.85] as const;
/** Кегли заголовка таблицы — от крупного к мелкому (HTML-карточки идут в натуральную величину, 10.5 px читаются). */
export const DB_HEAD_PX = [14, 13, 12, 11, 10.5] as const;
/** Горизонтальные поля заголовка таблицы (меньше, чем у строк полей: длинное слово не переносится зря). */
export const HEAD_PADX = 4;
/** Поправка оценки (она для начертания 700) на начертание 800. */
const EXTRA = 1.04;

/** Ширина колонки значков поля: один значок (ключ или ссылка) или два (поле — и PK, и FK: связь 1:1). */
export const iconColWidth = (f: { pk?: boolean; fk?: string }) => (f.pk && f.fk ? 2 * DB_GEO.icon + DB_GEO.iconPairGap : DB_GEO.icon) + DB_GEO.iconGap;

export interface DbFieldBox {
  name: string;
  type?: string;
  pk: boolean;
  fk?: string;
  /** Верх строки относительно верха карточки (с рамкой), высота строки. */
  y: number;
  h: number;
  /** Тип под именем (не влез в одну строку). */
  stacked: boolean;
  /** Число строк имени (имя переносится по словам, по дефису и, если слово длиннее строки, по буквам — без обрезания). */
  nameLines: number;
  /** Высоты строк имени и типа (px): по ним посчитана высота поля. */
  nameLineH: number;
  typeLineH: number;
  highlighted: boolean;
}

export interface DbCard {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  col: 0 | 1;
  row: 0 | 1;
  headFont: number;
  highlighted: boolean;
  fields: DbFieldBox[];
}

export type DbSide = "left" | "right";

export interface DbLink {
  /** Идентификатор связи — «Таблица.поле FK». */
  id: string;
  fkTable: string;
  fkField: string;
  pkTable: string;
  pkField: string;
  card: "1:1" | "1:N";
  /** Ломаная от FK к PK: углы (вершины) в координатах рисунка. */
  points: [number, number][];
  fk: { x: number; y: number; side: DbSide };
  pk: { x: number; y: number; side: DbSide };
  highlighted: boolean;
}

export interface DbLabel {
  x: number;
  y: number;
  text: "1" | "N";
  anchor: "start" | "end";
  highlighted: boolean;
}

export interface DbLayout {
  width: number;
  height: number;
  cards: DbCard[];
  links: DbLink[];
  labels: DbLabel[];
  /** Выбранный масштаб шрифта строк (1 — без сжатия). */
  scale: number;
  /** Высота заголовка карточек и число строк в нём (имя таблицы переносится, если не влезло и в мелком кегле). */
  headH: number;
  headLines: number;
  /** Сколько полос коридора занято (непересекающиеся по высоте связи делят одну полосу). */
  lanes: number;
  cols: 1 | 2;
}

/** Разбор ссылки «Таблица.поле». */
export function splitRef(ref: string): [string, string] {
  const i = ref.indexOf(".");
  return [ref.slice(0, i), ref.slice(i + 1)];
}

/**
 * Порядок таблиц на сетке: как в сцене, но при трёх таблицах таблица-связка (две ссылки на две разные таблицы) идёт последней —
 * сверху два справочника, под ними связка (так N:M читается сверху вниз).
 */
export function orderTables(tables: DbTable[]): DbTable[] {
  if (tables.length !== 3) return tables;
  const junction = tables.findIndex((t) => new Set(t.fields.filter((f) => f.fk).map((f) => splitRef(f.fk!)[0]).filter((n) => n !== t.name)).size >= 2);
  if (junction < 0 || junction === 2) return tables;
  return [...tables.filter((_, i) => i !== junction), tables[junction]];
}

/** Ширина строки поля в одну строку при масштабе s (px, без отступов карточки). */
export function fieldOneLineWidth(f: { name: string; type?: string; pk?: boolean; fk?: string }, s: number): number {
  const nameW = estimateTextWidth(f.name, DB_GEO.namePx * s) * (f.pk ? EXTRA : 1);
  return iconColWidth(f) + nameW + (f.type ? DB_GEO.typeGap + estimateTextWidth(f.type, DB_GEO.typePx * s) : 0);
}

/**
 * Сколько строк займёт текст при ширине width: перенос по пробелам и дефисам, слово длиннее строки ломается по буквам
 * (в вёрстке — `overflow-wrap: anywhere`). mult — поправка на жирность.
 */
export function wrapLines(text: string, px: number, width: number, mult = 1): number {
  if (width <= 0) return 1;
  const w = (x: string) => estimateTextWidth(x, px) * mult;
  let lines = 1;
  let cur = 0;
  for (const tok of text.split(/(?<=[ -])/)) {
    const word = tok.replace(/ $/, "");
    const ww = w(word);
    const full = w(tok);
    if (ww > width) {
      if (cur > 0) lines++;
      let c = 0;
      for (const ch of word) {
        const cw = w(ch);
        if (c + cw > width) {
          lines++;
          c = 0;
        }
        c += cw;
      }
      cur = c + (full - ww);
      continue;
    }
    if (cur > 0 && cur + ww > width) {
      lines++;
      cur = 0;
    }
    cur += full;
  }
  return lines;
}

/** Как поле ляжет в карточку: в одну строку, либо имя (с переносом) и тип под ним. Высота — по числу строк. */
export function fitField(f: { name: string; type?: string; pk?: boolean; fk?: string }, s: number, inner: number) {
  const nameLineH = Math.ceil(DB_GEO.namePx * s * DB_GEO.lineMul);
  const typeLineH = Math.ceil(DB_GEO.typePx * s * DB_GEO.lineMul);
  if (fieldOneLineWidth(f, s) <= inner) return { stacked: false, nameLines: 1, nameLineH, typeLineH, h: DB_GEO.rowH };
  const nameLines = wrapLines(f.name, DB_GEO.namePx * s, inner - iconColWidth(f), f.pk ? EXTRA : 1);
  const h = Math.max(DB_GEO.rowH, DB_GEO.stackPad + nameLines * nameLineH + (f.type ? typeLineH : 0));
  return { stacked: !!f.type, nameLines, nameLineH, typeLineH, h };
}

const headWidth = (name: string, px: number) => estimateTextWidth(name, px) * EXTRA;

/** Ширина области текста внутри карточки шириной w. */
export const innerWidth = (w: number) => w - 2 * DB_GEO.border - 2 * DB_GEO.padX;
/** Ширина области заголовка внутри карточки шириной w. */
export const headInnerWidth = (w: number) => w - 2 * DB_GEO.border - 2 * HEAD_PADX;
/** Какой ширины должна быть карточка, чтобы имя таблицы в заголовке влезло в одну строку кеглем px. */
export const headNeedWidth = (name: string, px: number) => Math.ceil(headWidth(name, px)) + 2 * DB_GEO.border + 2 * HEAD_PADX;

/** Ширина карточки, которой хватает без сжатия (по самой широкой строке и заголовку). */
export function naturalCardWidth(tables: DbTable[]): number {
  let need = 0;
  for (const t of tables) {
    need = Math.max(need, headWidth(t.name, DB_HEAD_PX[0]));
    for (const f of t.fields) need = Math.max(need, fieldOneLineWidth(f, 1));
  }
  return Math.ceil(need) + 2 * DB_GEO.padX + 2 * DB_GEO.border;
}

/** Ширина коридора между колонками под relations связей. */
export function gutterWidth(relations: number): number {
  return Math.max(2 * DB_GEO.edge + 8, 2 * DB_GEO.edge + 8 + Math.max(0, relations - 1) * DB_GEO.laneStep);
}

/** Ломаная со скруглёнными углами (радиус r не больше половины соседних отрезков). */
export function roundedPath(pts: [number, number][], r: number): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k < 0.5) {
      d += ` L${cx} ${cy}`;
      continue;
    }
    const ax = cx + ((px - cx) / l1) * k;
    const ay = cy + ((py - cy) / l1) * k;
    const bx = cx + ((nx - cx) / l2) * k;
    const by = cy + ((ny - cy) / l2) * k;
    d += ` L${round1(ax)} ${round1(ay)} Q${cx} ${cy} ${round1(bx)} ${round1(by)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

/** Запас между вертикалями одной полосы (px). */
const LANE_PAD = 6;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Заголовок: кегль (самый крупный, где имена всех таблиц влезают в строку своей карточки) или, если не влезли и в мелком, — перенос
 * имени (в крайнем случае: слово без пробела ломается по буквам). innerOf — ширина области заголовка карточки каждой таблицы.
 */
function headFit(tables: DbTable[], innerOf: (i: number) => number): { font: number; lines: number; h: number } {
  for (const px of DB_HEAD_PX) {
    if (tables.every((t, i) => headWidth(t.name, px) <= innerOf(i))) return { font: px, lines: 1, h: DB_GEO.headH };
  }
  const font = DB_HEAD_PX[2];
  const lines = Math.max(...tables.map((t, i) => wrapLines(t.name, font, innerOf(i), EXTRA)));
  return { font, lines, h: Math.max(DB_GEO.headH, DB_GEO.stackPad + lines * Math.ceil(font * DB_GEO.lineMul)) };
}

/**
 * Раскладка схемы. avail — ширина контейнера (px). Ширина результата не больше avail (кроме совсем узких экранов, где карточки
 * уже не сжимаются ниже 80 px), высота — по самому длинному ряду. Текст не обрезается: длинные имена переносятся на следующую строку.
 * Связи, чьи вертикальные участки не пересекаются по высоте, делят одну полосу коридора — он не растёт с числом связей зря.
 */
export function layoutDbSchema(scene: DbSchemaScene, avail: number): DbLayout {
  const relCount = scene.tables.reduce((s, t) => s + t.fields.filter((f) => f.fk).length, 0);
  const first = buildLayout(scene, avail, relCount);
  if (first.lanes < relCount) {
    const second = buildLayout(scene, avail, first.lanes);
    if (second.lanes <= first.lanes) return second;
  }
  return first;
}

/** Раскладка при заданном числе полос коридора (по нему считается ширина коридора, а значит, и карточек). */
function buildLayout(scene: DbSchemaScene, avail: number, lanesAllowed: number): DbLayout {
  const tables = orderTables(scene.tables);
  const n = tables.length;
  const cols: 1 | 2 = n === 1 ? 1 : 2;
  const hi = new Set(scene.highlight ?? []);
  const hasRel = tables.some((t) => t.fields.some((f) => f.fk));
  const laneSlots = hasRel ? Math.max(1, lanesAllowed) : 0;
  // Одна таблица: поля по бокам нужны только самосвязям (поле таблицы ссылается на её же ключ) — по одному запасу слева и справа.
  const gutter = cols === 2 ? gutterWidth(laneSlots) : hasRel ? gutterWidth(laneSlots) - 8 : 0;

  // --- ширина карточки ---
  const cap = avail <= DB_GEO.wideFrom ? DB_GEO.maxNarrow : DB_GEO.maxWide;
  const room = cols === 2 ? Math.floor((avail - gutter) / 2) : Math.floor(avail - 2 * gutter);
  const maxCard = Math.max(80, Math.min(cap, room));
  const natural = naturalCardWidth(tables);
  const cardW = Math.min(Math.max(natural, cols === 1 ? DB_GEO.minSingle : DB_GEO.minCard), maxCard);
  // Ширина каждой колонки. По умолчанию одинаковая. Если имя таблицы не влезает в заголовок даже мелким кеглем, колонка с длинным
  // именем расширяется за счёт соседней (слово не рвём по слогам: сначала кегль и ширина, перенос — в самом крайнем случае).
  const colW: number[] = cols === 2 ? [cardW, cardW] : [cardW];
  if (cols === 2) {
    const minPx = DB_HEAD_PX[DB_HEAD_PX.length - 1];
    const need = [0, 1].map((c) => Math.max(0, ...tables.filter((_, i) => i % 2 === c).map((t) => headNeedWidth(t.name, minPx))));
    if (need[0] > cardW || need[1] > cardW) {
      const total = Math.max(2 * cardW, Math.min(Math.floor(avail - gutter), 2 * cap));
      const wide = need[0] > cardW ? 0 : 1;
      const other = 1 - wide;
      // у соседней колонки остаётся не меньше минимума карточки и того, что нужно её собственным заголовкам
      const floorOther = Math.max(DB_GEO.minCard, need[other]);
      const wantWide = Math.min(cap, Math.max(cardW, need[wide]));
      const w = Math.min(wantWide, total - floorOther);
      if (w >= need[wide]) {
        colW[wide] = w;
        colW[other] = Math.min(cap, total - w);
      }
    }
  }
  const innerOf = (col: number) => innerWidth(colW[Math.min(col, colW.length - 1)]);
  const colOfTable = (i: number) => (cols === 1 ? 0 : i % 2);

  // --- масштаб шрифта строк: общий для всей схемы ---
  let scale: number = DB_SCALES[DB_SCALES.length - 1];
  for (const sc of DB_SCALES) {
    if (tables.every((t, i) => t.fields.every((f) => fieldOneLineWidth(f, sc) <= innerOf(colOfTable(i))))) {
      scale = sc;
      break;
    }
  }
  // --- заголовок: общий кегль и высота ---
  const head = headFit(tables, (i) => headInnerWidth(colW[colOfTable(i)]));

  // --- карточки ---
  const protos = tables.map((t, ti) => {
    let y = DB_GEO.border + head.h;
    const fields: DbFieldBox[] = t.fields.map((f) => {
      const fit = fitField(f, scale, innerOf(colOfTable(ti)));
      const box: DbFieldBox = {
        name: f.name,
        type: f.type,
        pk: !!f.pk,
        fk: f.fk,
        y,
        h: fit.h,
        stacked: fit.stacked,
        nameLines: fit.nameLines,
        nameLineH: fit.nameLineH,
        typeLineH: fit.typeLineH,
        highlighted: hi.has(`${t.name}.${f.name}`),
      };
      y += fit.h;
      return box;
    });
    return { table: t, fields, h: y + DB_GEO.border };
  });

  const rowsCount = Math.ceil(n / cols);
  const rowH = Array.from({ length: rowsCount }, (_, r) => Math.max(...protos.filter((_, i) => Math.floor(i / cols) === r).map((p) => p.h)));
  const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, b) => a + b, 0) + r * DB_GEO.rowGap);
  const height = rowY[rowsCount - 1] + rowH[rowsCount - 1];
  const width = cols === 2 ? colW[0] + colW[1] + gutter : cardW + 2 * gutter;

  const cards: DbCard[] = protos.map((p, i) => {
    const col = (i % cols) as 0 | 1;
    const row = Math.floor(i / cols) as 0 | 1;
    return {
      name: p.table.name,
      x: cols === 1 ? gutter : col === 0 ? 0 : colW[0] + gutter,
      y: rowY[row],
      w: colW[col],
      h: p.h,
      col,
      row,
      headFont: head.font,
      highlighted: hi.has(p.table.name),
      fields: p.fields,
    };
  });
  const cardOf = new Map(cards.map((c) => [c.name, c]));

  // --- связи ---
  interface Rel {
    id: string;
    fkTable: string;
    fkField: string;
    pkTable: string;
    pkField: string;
    card: "1:1" | "1:N";
  }
  const rels: Rel[] = [];
  for (const t of tables) {
    for (const f of t.fields) {
      if (!f.fk) continue;
      const [pt, pf] = splitRef(f.fk);
      const card = (scene.cards ?? []).find((c) => c.field === `${t.name}.${f.name}`)?.card ?? "1:N";
      rels.push({ id: `${t.name}.${f.name}`, fkTable: t.name, fkField: f.name, pkTable: pt, pkField: pf, card });
    }
  }

  // Сторона выхода: карточки левой колонки выходят вправо (в коридор), правой — влево; единственная таблица — вправо.
  const sideOf = (c: DbCard): DbSide => (cols === 1 || c.col === 0 ? "right" : "left");
  const anchor = (table: string, field: string) => {
    const c = cardOf.get(table)!;
    const fb = c.fields.find((x) => x.name === field)!;
    const side = sideOf(c);
    return { x: side === "right" ? c.x + c.w : c.x, y: Math.round(c.y + fb.y + fb.h / 2), side };
  };

  // Коридор для полос: между колонками (или справа от единственной карточки).
  const gl = cards[0].x + cards[0].w;
  const gr = gl + gutter;
  const lo = gl + DB_GEO.edge;
  const hi2 = gr - DB_GEO.edge;
  const laneX = (k: number, total: number) => (total <= 1 ? Math.round((lo + hi2) / 2) : Math.round(lo + ((hi2 - lo) * k) / (total - 1)));

  // Полосы: связи по возрастанию верхней точки; связь идёт в первую полосу, где её вертикаль (с запасом) не задевает уже стоящие.
  const geo = rels.map((r) => {
    const a = anchor(r.fkTable, r.fkField);
    const b = anchor(r.pkTable, r.pkField);
    return { r, a, b, straight: a.y === b.y && a.side !== b.side, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
  });
  const laneEnd: number[] = [];
  const laneOf = new Map<string, number>();
  for (const g of [...geo].filter((x) => !x.straight).sort((p, q) => p.top - q.top || p.bottom - q.bottom)) {
    let k = laneEnd.findIndex((end) => end + LANE_PAD < g.top);
    if (k < 0) k = laneEnd.length;
    laneEnd[k] = g.bottom;
    laneOf.set(g.r.id, k);
  }
  const lanes = laneEnd.length;
  const slots = Math.max(laneSlots, lanes);

  const links: DbLink[] = geo.map(({ r, a, b, straight }) => {
    const lx = laneX(Math.min(laneOf.get(r.id) ?? 0, slots - 1), slots);
    const points: [number, number][] = straight ? [[a.x, a.y], [b.x, b.y]] : [[a.x, a.y], [lx, a.y], [lx, b.y], [b.x, b.y]];
    return {
      id: r.id,
      fkTable: r.fkTable,
      fkField: r.fkField,
      pkTable: r.pkTable,
      pkField: r.pkField,
      card: r.card,
      points,
      fk: a,
      pk: b,
      highlighted: hi.has(`${r.fkTable}.${r.fkField}`) || hi.has(`${r.pkTable}.${r.pkField}`),
    };
  });

  // --- подписи «1» и «N» у концов ---
  const labels: DbLabel[] = [];
  const used = new Map<string, string[]>();
  const put = (table: string, field: string, pt: { x: number; y: number; side: DbSide }, text: "1" | "N", highlighted: boolean) => {
    const key = `${table}.${field}`;
    const had = used.get(key) ?? [];
    if (had.includes(text)) return;
    // Два разных знака у одного поля (поле — и PK, и FK): второй под линией.
    const below = had.length > 0;
    used.set(key, [...had, text]);
    labels.push({
      x: pt.side === "right" ? pt.x + 5 : pt.x - 5,
      y: pt.y + (below ? 14 : -5),
      text,
      anchor: pt.side === "right" ? "start" : "end",
      highlighted,
    });
  };
  for (const l of links) {
    put(l.pkTable, l.pkField, l.pk, "1", l.highlighted);
    put(l.fkTable, l.fkField, l.fk, l.card === "1:1" ? "1" : "N", l.highlighted);
  }

  return { width, height, cards, links, labels, scale, cols, headH: head.h, headLines: head.lines, lanes };
}

/** Короткий пересказ схемы для скринридера (`t` — перевод интерфейса на язык ученика). */
export function dbSchemaAria(scene: DbSchemaScene, t: (key: DictKey, params?: Record<string, string | number>) => string): string {
  const field = (f: DbTable["fields"][number]) => `${f.name}${f.pk ? ` (${t("scene.db.pk")})` : ""}${f.fk ? ` (${t("scene.db.fk")}: ${f.fk})` : ""}`;
  const tables = scene.tables.map((x) => t("scene.db.ariaTable", { name: x.name, fields: x.fields.map(field).join(", ") })).join("; ");
  let out = t("scene.db.aria", { tables });
  const links = scene.tables.flatMap((x) =>
    x.fields
      .filter((f) => f.fk)
      .map((f) => {
        const card = (scene.cards ?? []).find((c) => c.field === `${x.name}.${f.name}`)?.card ?? "1:N";
        return t("scene.db.ariaLink", { from: `${x.name}.${f.name}`, to: f.fk!, card });
      }),
  );
  if (links.length) out += t("scene.db.ariaLinks", { links: links.join("; ") });
  if (scene.highlight?.length) out += t("scene.db.ariaHl", { items: scene.highlight.join(", ") });
  return out;
}
