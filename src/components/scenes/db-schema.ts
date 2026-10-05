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
  headH: 30,
  rowH: 26,
  /** Строка, где тип не влез рядом с именем: имя над типом. */
  rowStackH: 40,
  padX: 8,
  /** Значок ключа / ссылки: всегда занимает колонку, чтобы имена полей выстраивались. */
  icon: 14,
  iconGap: 5,
  typeGap: 8,
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
/** Кегли заголовка таблицы — от крупного к мелкому. */
export const DB_HEAD_PX = [14, 13, 12, 11] as const;
/** Поправка оценки (она для начертания 700) на начертание 800. */
const EXTRA = 1.04;

const ICON_COL = DB_GEO.icon + DB_GEO.iconGap;

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
  /** Даже в минимальном кегле не влезает — компонент обрежет с «…». */
  clipped: boolean;
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
  headClipped: boolean;
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
export function fieldOneLineWidth(f: { name: string; type?: string; pk?: boolean }, s: number): number {
  const nameW = estimateTextWidth(f.name, DB_GEO.namePx * s) * (f.pk ? EXTRA : 1);
  return ICON_COL + nameW + (f.type ? DB_GEO.typeGap + estimateTextWidth(f.type, DB_GEO.typePx * s) : 0);
}

/** Ширина строки, когда тип стоит под именем. */
export function fieldStackedWidth(f: { name: string; type?: string; pk?: boolean }, s: number): number {
  const nameW = estimateTextWidth(f.name, DB_GEO.namePx * s) * (f.pk ? EXTRA : 1);
  const typeW = f.type ? estimateTextWidth(f.type, DB_GEO.typePx * s) : 0;
  return ICON_COL + Math.max(nameW, typeW);
}

const headWidth = (name: string, px: number) => estimateTextWidth(name, px) * EXTRA;

/** Ширина области текста внутри карточки шириной w. */
export const innerWidth = (w: number) => w - 2 * DB_GEO.border - 2 * DB_GEO.padX;

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

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Раскладка схемы. avail — ширина контейнера (px). Ширина результата не больше avail (кроме совсем узких экранов, где карточки
 * уже не сжимаются ниже 80 px), высота — по самому длинному ряду.
 */
export function layoutDbSchema(scene: DbSchemaScene, avail: number): DbLayout {
  const tables = orderTables(scene.tables);
  const n = tables.length;
  const cols: 1 | 2 = n === 1 ? 1 : 2;
  const hi = new Set(scene.highlight ?? []);
  const relCount = tables.reduce((s, t) => s + t.fields.filter((f) => f.fk).length, 0);
  // Одна таблица: поля по бокам нужны только самосвязям (поле таблицы ссылается на её же ключ) — по одному запасу слева и справа.
  const gutter = cols === 2 ? gutterWidth(relCount) : relCount > 0 ? gutterWidth(relCount) - 8 : 0;

  // --- ширина карточки ---
  const cap = avail <= DB_GEO.wideFrom ? DB_GEO.maxNarrow : DB_GEO.maxWide;
  const room = cols === 2 ? Math.floor((avail - gutter) / 2) : Math.floor(avail - 2 * gutter);
  const maxCard = Math.max(80, Math.min(cap, room));
  const natural = naturalCardWidth(tables);
  const cardW = Math.min(Math.max(natural, cols === 1 ? DB_GEO.minSingle : DB_GEO.minCard), maxCard);
  const inner = innerWidth(cardW);

  // --- масштаб шрифта строк: общий для всей схемы ---
  const allFields = tables.flatMap((t) => t.fields);
  let scale: number = DB_SCALES[DB_SCALES.length - 1];
  for (const s of DB_SCALES) {
    if (allFields.every((f) => fieldOneLineWidth(f, s) <= inner)) {
      scale = s;
      break;
    }
  }
  // --- кегль заголовка: общий ---
  let headFont: number = DB_HEAD_PX[DB_HEAD_PX.length - 1];
  for (const px of DB_HEAD_PX) {
    if (tables.every((t) => headWidth(t.name, px) <= inner)) {
      headFont = px;
      break;
    }
  }

  // --- карточки ---
  const protos = tables.map((t) => {
    let y = DB_GEO.border + DB_GEO.headH;
    const fields: DbFieldBox[] = t.fields.map((f) => {
      const stacked = !!f.type && fieldOneLineWidth(f, scale) > inner;
      const h = stacked ? DB_GEO.rowStackH : DB_GEO.rowH;
      const box: DbFieldBox = {
        name: f.name,
        type: f.type,
        pk: !!f.pk,
        fk: f.fk,
        y,
        h,
        stacked,
        clipped: (stacked ? fieldStackedWidth(f, scale) : fieldOneLineWidth(f, scale)) > inner,
        highlighted: hi.has(`${t.name}.${f.name}`),
      };
      y += h;
      return box;
    });
    return { table: t, fields, h: y + DB_GEO.border };
  });

  const rowsCount = Math.ceil(n / cols);
  const rowH = Array.from({ length: rowsCount }, (_, r) => Math.max(...protos.filter((_, i) => Math.floor(i / cols) === r).map((p) => p.h)));
  const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, b) => a + b, 0) + r * DB_GEO.rowGap);
  const height = rowY[rowsCount - 1] + rowH[rowsCount - 1];
  const width = cols === 2 ? 2 * cardW + gutter : cardW + 2 * gutter;

  const cards: DbCard[] = protos.map((p, i) => {
    const col = (i % cols) as 0 | 1;
    const row = Math.floor(i / cols) as 0 | 1;
    return {
      name: p.table.name,
      x: cols === 1 ? gutter : col === 0 ? 0 : cardW + gutter,
      y: rowY[row],
      w: cardW,
      h: p.h,
      col,
      row,
      headFont,
      headClipped: headWidth(p.table.name, headFont) > inner,
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
  const gl = cards[0].x + cardW;
  const gr = gl + gutter;
  const lo = gl + DB_GEO.edge;
  const hi2 = gr - DB_GEO.edge;
  const laneX = (k: number, total: number) => (total <= 1 ? Math.round((lo + hi2) / 2) : Math.round(lo + ((hi2 - lo) * k) / (total - 1)));

  const lanesTotal = rels.length;
  const links: DbLink[] = rels.map((r, k) => {
    const a = anchor(r.fkTable, r.fkField);
    const b = anchor(r.pkTable, r.pkField);
    const straight = a.y === b.y && a.side !== b.side;
    const lx = laneX(k, lanesTotal);
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

  return { width, height, cards, links, labels, scale, cols };
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
