import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DbSchemaScene as DbSchemaView } from "@/components/scenes/DbSchemaScene";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/db-schema";
import {
  DB_GEO,
  DB_SCALES,
  dbSchemaAria,
  fieldOneLineWidth,
  gutterWidth,
  innerWidth,
  layoutDbSchema,
  orderTables,
  roundedPath,
  splitRef,
  wrapLines,
  iconColWidth,
  type DbCard,
  type DbLayout,
  type DbSchemaScene,
} from "@/components/scenes/db-schema";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import type { Lang } from "@/lib/types";
import { validateScene } from "./validate";

const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);
const scene = (tables: DbSchemaScene["tables"], extra: Partial<DbSchemaScene> = {}): DbSchemaScene => ({ kind: "db-schema", tables, ...extra });

// Ширины контейнера: узкий телефон, обычный 360 px (≈296–330 внутри сцены), крупный телефон, планшет/ПК.
const WIDTHS = [296, 320, 336, 390, 420, 576];

const inside = (c: DbCard, x: number, y: number) => x > c.x + 0.5 && x < c.x + c.w - 0.5 && y > c.y + 0.5 && y < c.y + c.h - 0.5;

/** Точки вдоль отрезка (каждые 2 px) — для проверки «линия не задевает карточки». */
function along(a: [number, number], b: [number, number]): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
}

describe("образцы db-schema проходят проверку параметров", () => {
  it("все образцы корректны", () => {
    for (const [i, s] of SAMPLES.entries()) expect(validateScene(s), `образец ${i}`).toEqual([]);
  });
});

describe("layoutDbSchema: геометрия на экранах телефона и шире", () => {
  for (const avail of WIDTHS) {
    describe(`контейнер ${avail} px`, () => {
      for (const [i, s] of SAMPLES.entries()) {
        const L: DbLayout = layoutDbSchema(s, avail);

        it(`образец ${i}: всё внутри рисунка, ширина не больше контейнера, карточки не налезают друг на друга`, () => {
          expect(L.width).toBeLessThanOrEqual(avail);
          for (const c of L.cards) {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.y).toBeGreaterThanOrEqual(0);
            expect(c.x + c.w).toBeLessThanOrEqual(L.width);
            expect(c.y + c.h).toBeLessThanOrEqual(L.height);
          }
          for (const a of L.cards)
            for (const b of L.cards) {
              if (a === b) continue;
              const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
              expect(apart, `${a.name} / ${b.name}`).toBe(true);
            }
          // таблицы на 360 px — не шире 160
          if (avail <= DB_GEO.wideFrom) for (const c of L.cards) expect(c.w).toBeLessThanOrEqual(160);
          for (const v of [L.width, L.height, ...L.cards.flatMap((c) => [c.x, c.y, c.w, c.h])]) expect(Number.isFinite(v)).toBe(true);
        });

        it(`образец ${i}: текст не обрезается — что не влезло в строку, переносится, а высота строки считана по числу строк`, () => {
          for (const c of L.cards) {
            expect(c.h).toBeGreaterThan(0);
            for (const f of c.fields) {
              expect(f.nameLines, `${c.name}.${f.name}`).toBeGreaterThanOrEqual(1);
              if (f.nameLines > 1 || f.stacked) expect(f.h, `${c.name}.${f.name}`).toBeGreaterThanOrEqual(DB_GEO.stackPad + f.nameLines * f.nameLineH + (f.type ? f.typeLineH : 0));
              else expect(f.h).toBe(DB_GEO.rowH);
            }
          }
        });

        it(`образец ${i}: строки полей лежат подряд внутри карточки`, () => {
          for (const c of L.cards) {
            let y = DB_GEO.border + L.headH;
            for (const f of c.fields) {
              expect(f.y).toBe(y);
              y += f.h;
            }
            expect(c.h).toBe(y + DB_GEO.border);
          }
        });

        it(`образец ${i}: линии только вертикальные и горизонтальные, концы — на краях полей, текст не задевают`, () => {
          const byName = new Map(L.cards.map((c) => [c.name, c]));
          for (const link of L.links) {
            const pts = link.points;
            for (let k = 1; k < pts.length; k++) expect(pts[k][0] === pts[k - 1][0] || pts[k][1] === pts[k - 1][1], `${link.id}: наклонный отрезок`).toBe(true);
            // концы: на вертикальном краю карточки, на высоте своего поля
            const fkCard = byName.get(link.fkTable)!;
            const pkCard = byName.get(link.pkTable)!;
            const fkF = fkCard.fields.find((f) => f.name === link.fkField)!;
            const pkF = pkCard.fields.find((f) => f.name === link.pkField)!;
            expect(link.fk.y).toBeGreaterThan(fkCard.y + fkF.y);
            expect(link.fk.y).toBeLessThan(fkCard.y + fkF.y + fkF.h);
            expect(link.pk.y).toBeGreaterThan(pkCard.y + pkF.y);
            expect(link.pk.y).toBeLessThan(pkCard.y + pkF.y + pkF.h);
            expect([fkCard.x, fkCard.x + fkCard.w]).toContain(link.fk.x);
            expect([pkCard.x, pkCard.x + pkCard.w]).toContain(link.pk.x);
            // линия не заходит внутрь ни одной карточки и не выходит за рисунок
            for (let k = 1; k < pts.length; k++)
              for (const [x, y] of along(pts[k - 1], pts[k])) {
                for (const c of L.cards) expect(inside(c, x, y), `${link.id} задевает ${c.name}`).toBe(false);
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(L.width);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThanOrEqual(L.height);
              }
          }
        });

        it(`образец ${i}: подписи «1» и «N» не налезают на соседние линии и остаются в рисунке`, () => {
          for (const lb of L.labels) {
            expect(["1", "N"]).toContain(lb.text);
            expect(lb.x).toBeGreaterThanOrEqual(0);
            expect(lb.x).toBeLessThanOrEqual(L.width);
            for (const c of L.cards) expect(inside(c, lb.x + (lb.anchor === "start" ? 4 : -4), lb.y - 4), "подпись внутри карточки").toBe(false);
          }
        });
      }
    });
  }

  it("на 296–420 px схема из двух таблиц стоит в один ряд, из трёх и четырёх — в два", () => {
    expect(new Set(layoutDbSchema(SAMPLES[0], 320).cards.map((c) => c.row)).size).toBe(1);
    expect(new Set(layoutDbSchema(SAMPLES[1], 320).cards.map((c) => c.row)).size).toBe(2);
    expect(new Set(layoutDbSchema(SAMPLES[2], 320).cards.map((c) => c.row)).size).toBe(2);
    expect(layoutDbSchema(SAMPLES[4], 320).cols).toBe(1);
  });
});

describe("layoutDbSchema: подписи связей", () => {
  it("1:N — «1» у первичного ключа и «N» у внешнего; 1:1 — «1» у обоих концов", () => {
    const one = layoutDbSchema(SAMPLES[0], 320);
    expect(one.labels.map((l) => l.text).sort()).toEqual(["1", "N"]);
    const l = one.links[0];
    const nLabel = one.labels.find((x) => x.text === "N")!;
    expect(Math.abs(nLabel.x - l.fk.x)).toBe(5);
    const oneToOne = layoutDbSchema(SAMPLES[3], 320);
    expect(oneToOne.labels.map((x) => x.text)).toEqual(["1", "1"]);
  });

  it("два внешних ключа в один первичный: подпись «1» у первичного ключа одна", () => {
    const L = layoutDbSchema(SAMPLES[5], 320);
    expect(L.links).toHaveLength(2);
    expect(L.labels.filter((x) => x.text === "1")).toHaveLength(1);
    expect(L.labels.filter((x) => x.text === "N")).toHaveLength(2);
  });

  it("поле — и первичный, и внешний ключ (связь 1:1): знаки у одного поля не слипаются", () => {
    const s = scene(
      [
        { name: "A", fields: [{ name: "ID", pk: true }, { name: "BID", fk: "B.ID" }] },
        { name: "B", fields: [{ name: "ID", pk: true, fk: "C.ID" }] },
        { name: "C", fields: [{ name: "ID", pk: true }] },
      ],
      {},
    );
    expect(validateScene(s)).toEqual([]);
    const L = layoutDbSchema(s, 320);
    const keys = L.labels.map((x) => `${x.x}:${x.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("самосвязь: линия выходит вправо от поля ManagerID, возвращается к ID и не задевает таблицу", () => {
    const L = layoutDbSchema(SAMPLES[4], 320);
    expect(L.cols).toBe(1);
    const link = L.links[0];
    expect(link.fk.side).toBe("right");
    expect(link.pk.side).toBe("right");
    expect(link.points).toHaveLength(4);
    expect(Math.max(...link.points.map((p) => p[0]))).toBeLessThanOrEqual(L.width);
    expect(link.points[1][0]).toBeGreaterThan(L.cards[0].x + L.cards[0].w);
  });

  it("подсвеченное поле подсвечивает и связь; подсвеченная таблица — только таблицу", () => {
    const hl = layoutDbSchema(SAMPLES[0], 320);
    expect(hl.links[0].highlighted).toBe(true);
    expect(hl.cards[0].fields[2].highlighted).toBe(true);
    expect(hl.cards[0].highlighted).toBe(false);
    const tbl = layoutDbSchema(SAMPLES[3], 320);
    expect(tbl.cards.find((c) => c.name === "Profiles")!.highlighted).toBe(true);
    expect(tbl.links[0].highlighted).toBe(false);
  });
});

describe("layoutDbSchema: краевые случаи", () => {
  it("одна таблица без связей: по центру, без запаса по бокам", () => {
    const L = layoutDbSchema(SAMPLES[7], 320);
    expect(L.links).toEqual([]);
    expect(L.labels).toEqual([]);
    expect(L.cards[0].x).toBe(0);
    expect(L.width).toBe(L.cards[0].w);
  });

  it("поле с типом, который не влезает рядом с именем, ставится в две строки (выше строка)", () => {
    const long = scene([{ name: "Tbl", fields: [{ name: "RegistrDate", type: "TIMESTAMP" }, { name: "ID", type: "INT", pk: true }] }, { name: "Other", fields: [{ name: "ID", pk: true }] }]);
    expect(validateScene(long)).toEqual([]);
    const L = layoutDbSchema(long, 296);
    const f = L.cards[0].fields;
    expect(f[0].stacked).toBe(true);
    expect(f[0].nameLines).toBe(1);
    expect(f[0].h).toBe(DB_GEO.stackPad + f[0].nameLineH + f[0].typeLineH);
    expect(f[1].stacked).toBe(false);
    expect(f[1].h).toBe(DB_GEO.rowH);
  });

  it("максимум полей (7) и 4 таблицы: высота ряда — по самой длинной карточке", () => {
    const seven = (name: string) => ({ name, fields: Array.from({ length: 7 }, (_, i) => ({ name: `f${i}`, type: "INT", ...(i === 0 ? { pk: true } : {}) })) });
    const L = layoutDbSchema(scene([seven("A"), seven("B"), { name: "C", fields: [{ name: "x" }] }, seven("D")]), 320);
    expect(L.cards[2].y).toBe(L.cards[0].h + DB_GEO.rowGap);
    expect(L.height).toBe(L.cards[0].h + DB_GEO.rowGap + L.cards[2].h > L.cards[3].y + L.cards[3].h ? L.cards[0].h + DB_GEO.rowGap + L.cards[2].h : L.cards[3].y + L.cards[3].h);
  });

  it("сжатие шрифта: сначала масштаб, не ниже 0.85", () => {
    for (const avail of WIDTHS) {
      const L = layoutDbSchema(SAMPLES[6], avail);
      expect(L.scale).toBeGreaterThanOrEqual(0.85);
      expect(DB_SCALES).toContain(L.scale);
    }
    // шире экран — без сжатия
    expect(layoutDbSchema(SAMPLES[6], 576).scale).toBe(1);
  });

  it("длинное имя поля переносится на вторую строку, а не обрезается; высота строки растёт", () => {
    const s = scene([{ name: "T", fields: [{ name: "AbcdefghijkL", type: "INT" }, { name: "Оқушының аты-жөні", type: "INT" }, { name: "Жетекшінің коды", type: "INT" }] }, { name: "U", fields: [{ name: "ID", pk: true }] }]);
    expect(validateScene(s)).toEqual([]);
    for (const avail of [296, 320, 336]) {
      const f = layoutDbSchema(s, avail).cards[0].fields;
      expect(f[0].nameLines).toBe(1);
      expect(f[1].nameLines).toBeGreaterThanOrEqual(2);
      expect(f[1].h).toBeGreaterThan(f[0].h);
      expect(f[1].stacked).toBe(true);
    }
  });

  it("имя таблицы из 14 широких букв переносится: заголовок выше, высота общая для всех карточек", () => {
    const L = layoutDbSchema(SAMPLES[8], 296);
    expect(L.headLines).toBeGreaterThanOrEqual(2);
    expect(L.headH).toBeGreaterThan(DB_GEO.headH);
    expect(layoutDbSchema(SAMPLES[0], 320).headLines).toBe(1);
    expect(layoutDbSchema(SAMPLES[0], 320).headH).toBe(DB_GEO.headH);
  });

  it("wrapLines: по пробелам и дефисам, слово длиннее строки ломается по буквам", () => {
    expect(wrapLines("ID", 13, 100)).toBe(1);
    expect(wrapLines("Оқушының аты-жөні", 13, 300)).toBe(1);
    expect(wrapLines("Оқушының аты-жөні", 13, 110)).toBe(2);
    expect(wrapLines("ЖҰМЫСШЫЛАРДЫҢ", 14, 60)).toBeGreaterThanOrEqual(2);
    expect(wrapLines("abc", 13, 0)).toBe(1);
  });

  it("в разметке нет обрезания (truncate / «…»): ни у заголовков, ни у полей", () => {
    for (const s of SAMPLES) {
      const out = renderToStaticMarkup(createElement(DbSchemaView, { scene: s }));
      expect(out).not.toContain("truncate");
      expect(out).not.toContain("text-ellipsis");
    }
  });

  it("поле — и PK, и FK: колонка значков шире, в разметке оба значка", () => {
    expect(iconColWidth({ pk: true, fk: "A.ID" })).toBeGreaterThan(iconColWidth({ pk: true }));
    expect(iconColWidth({ fk: "A.ID" })).toBe(iconColWidth({ pk: true }));
    expect(fieldOneLineWidth({ name: "UserID", pk: true, fk: "Users.ID" }, 1)).toBeGreaterThan(fieldOneLineWidth({ name: "UserID", pk: true }, 1));
    const out = renderToStaticMarkup(createElement(DbSchemaView, { scene: SAMPLES[3] }));
    // образец 1:1: Users.ID (PK), Profiles.UserID (PK и FK) — два значка ключа в карточках, один в легенде; ссылка — в карточке и в легенде
    expect(out.match(/lucide-key-round/g)?.length).toBe(3);
    expect(out.match(/lucide-link/g)?.length).toBe(2); 
  });

  it("при очень узком контейнере карточки не уже 80 px и не отрицательные", () => {
    const L = layoutDbSchema(SAMPLES[2], 160);
    for (const c of L.cards) expect(c.w).toBeGreaterThanOrEqual(80);
  });

  it("число полос коридора растёт с числом связей", () => {
    expect(gutterWidth(1)).toBe(2 * DB_GEO.edge + 8);
    expect(gutterWidth(5)).toBe(2 * DB_GEO.edge + 8 + 4 * DB_GEO.laneStep);
    const L = layoutDbSchema(SAMPLES[2], 320);
    expect(L.links.length).toBe(3);
    expect(L.lanes).toBeGreaterThanOrEqual(1);
    expect(L.lanes).toBeLessThanOrEqual(3);
  });

  it("связи с непересекающимися по высоте вертикалями делят одну полосу: коридор не растёт зря", () => {
    // три независимые пары таблиц не нужны — достаточно двух рядов: связи в верхнем и нижнем ряду не пересекаются по высоте
    const mk = (a: string, b: string) => [
      { name: a, fields: [{ name: "ID", pk: true }] },
      { name: b, fields: [{ name: "ID", pk: true }, { name: "AID", fk: `${a}.ID` }] },
    ];
    const s = scene([...mk("A", "B"), ...mk("C", "D")]);
    expect(validateScene(s)).toEqual([]);
    const L = layoutDbSchema(s, 320);
    expect(L.links).toHaveLength(2);
    expect(L.lanes).toBeLessThanOrEqual(1);
    expect(L.width).toBeLessThanOrEqual(320);
  });

  it("предел validate (6 связей): схема не шире контейнера на всех ширинах телефона", () => {
    const tables = [
      { name: "Root", fields: [{ name: "ID", pk: true }] },
      { name: "A", fields: [{ name: "ID", pk: true }, ...Array.from({ length: 3 }, (_, i) => ({ name: `R${i}ID`, fk: "Root.ID" }))] },
      { name: "B", fields: [{ name: "ID", pk: true }, ...Array.from({ length: 3 }, (_, i) => ({ name: `S${i}ID`, fk: "Root.ID" }))] },
    ];
    const s = scene(tables);
    expect(validateScene(s)).toEqual([]);
    expect(validateScene(scene([...tables, { name: "C", fields: [{ name: "X", fk: "Root.ID" }] }]))).not.toEqual([]);
    for (const avail of [296, 320, 336, 390]) expect(layoutDbSchema(s, avail).width, `${avail}`).toBeLessThanOrEqual(avail);
  });

  it("ширина строки в одну строку растёт с длиной имени и типа; у PK — чуть шире (жирный)", () => {
    expect(fieldOneLineWidth({ name: "Name", type: "TEXT" }, 1)).toBeGreaterThan(fieldOneLineWidth({ name: "ID", type: "TEXT" }, 1));
    expect(fieldOneLineWidth({ name: "ID", type: "TEXT", pk: true }, 1)).toBeGreaterThan(fieldOneLineWidth({ name: "ID", type: "TEXT" }, 1));
    expect(fieldOneLineWidth({ name: "ID" }, 0.85)).toBeLessThan(fieldOneLineWidth({ name: "ID" }, 1));
    expect(innerWidth(160)).toBe(160 - 4 - 16);
  });
});

describe("orderTables и splitRef", () => {
  it("три таблицы со связкой: связка идёт последней, остальные — в прежнем порядке", () => {
    const order = orderTables(SAMPLES[1].tables).map((t) => t.name);
    expect(order).toEqual(["Students", "Courses", "Enrollments"]);
    expect(orderTables(SAMPLES[0].tables).map((t) => t.name)).toEqual(["Students", "Classes"]);
    expect(orderTables(SAMPLES[2].tables).map((t) => t.name)).toEqual(["Customers", "Orders", "Products", "OrderItems"]);
  });

  it("splitRef делит «Таблица.поле» (в имени поля могут быть пробелы и кириллица)", () => {
    expect(splitRef("Classes.ID")).toEqual(["Classes", "ID"]);
    expect(splitRef("Оқушылар.Сынып коды")).toEqual(["Оқушылар", "Сынып коды"]);
  });
});

describe("roundedPath", () => {
  it("прямая линия — без закруглений; углы скругляются, радиус не больше половины отрезка", () => {
    expect(roundedPath([[0, 0], [10, 0]], 6)).toBe("M0 0 L10 0");
    const d = roundedPath([[0, 0], [20, 0], [20, 40], [50, 40]], 6);
    expect(d).toContain("Q20 0");
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d.endsWith("L50 40")).toBe(true);
    // короткий отрезок 4 px: радиус урезан до 2 px
    expect(roundedPath([[0, 0], [10, 0], [10, 4], [30, 4]], 6)).toContain("L10 2");
    expect(roundedPath([], 6)).toBe("");
  });
});

describe("dbSchemaAria", () => {
  it("пересказ на двух языках: таблицы, ключи, связи и выделение", () => {
    const ru = dbSchemaAria(SAMPLES[0], tr("ru"));
    expect(ru).toBe("Схема базы данных. Таблицы: Students — поля: ID (первичный ключ), Name, ClassID (внешний ключ: Classes.ID); Classes — поля: ID (первичный ключ), Title. Связи: Students.ClassID ссылается на Classes.ID, связь 1:N. Выделено: Students.ClassID.");
    const kk = dbSchemaAria(SAMPLES[0], tr("kk"));
    expect(kk).toContain("Деректер қорының сызбасы. Кестелер:");
    expect(kk).toContain("бастапқы кілт");
    expect(kk).toContain("сыртқы кілт: Classes.ID");
    expect(kk).toContain("Students.ClassID өрісі Classes.ID өрісіне сілтеме жасайды, байланыс 1:N");
    // без связей и выделения — без лишних фраз
    expect(dbSchemaAria(SAMPLES[7].tables.length === 1 ? { ...SAMPLES[7], highlight: undefined } : SAMPLES[7], tr("ru"))).not.toContain("Связи");
  });
});

describe("DbSchemaScene (SceneView)", () => {
  const html = (s: DbSchemaScene) => renderToStaticMarkup(createElement(SceneView, { scene: s }));

  it("рисунок с role=img и aria-label, значки ключей, подписи 1 и N, подпись сцены", () => {
    const out = html({ ...SAMPLES[0], caption: "подпись" });
    expect(out).toContain('role="img"');
    expect(out).toMatch(/aria-label="Схема базы данных\. Таблицы: Students — поля/);
    expect(out).toContain("lucide-key-round");
    expect(out).toContain("lucide-link");
    expect(out).toContain("подпись");
    expect(out).toContain("Students");
    expect(out).toContain("Classes");
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("undefined");
  });

  it("цвета — только токены; нет захардкоженных hex и эмодзи", () => {
    for (const s of SAMPLES) {
      const out = html(s);
      expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(out).not.toMatch(/rgb\(|hsl\(/);
    }
  });

  it("подсвеченные таблица и поле получают primary", () => {
    const tbl = html(SAMPLES[3]);
    expect(tbl).toContain("border-primary");
    expect(tbl).toContain("bg-primary-soft");
    const fld = html(SAMPLES[0]);
    expect(fld).toContain("bg-primary-soft");
    expect(fld).toContain("stroke-primary");
  });

  it("PK — жирнее обычных полей; без ключей легенда не рисуется", () => {
    const out = html(SAMPLES[0]);
    expect(out).toContain("font-extrabold");
    const none = html(scene([{ name: "T", fields: [{ name: "a" }, { name: "b" }] }]));
    expect(none).not.toContain("lucide-key-round");
    expect(none).not.toContain("первичный ключ");
  });

  it("легенда на языке ученика (ru)", () => {
    const out = renderToStaticMarkup(createElement(DbSchemaView, { scene: SAMPLES[0] }));
    expect(out).toContain("первичный ключ");
    expect(out).toContain("внешний ключ");
  });

  it("все образцы рисуются без ошибок, на каждую связь — линия и два кружка", () => {
    for (const s of SAMPLES) {
      const out = html(s);
      const links = s.tables.reduce((n, t) => n + t.fields.filter((f) => f.fk).length, 0);
      expect(out.match(/<path [^>]*class="[^"]*stroke-(?:muted|primary)/g)?.length ?? 0).toBe(links);
      expect(out.match(/<circle [^>]*r="3\.5"/g)?.length ?? 0).toBe(links * 2);
    }
  });
});

describe("словарь scene.db.*: оба языка и одинаковые параметры", () => {
  it("каждый ключ заполнен, подстановки {…} совпадают в ru и kk", () => {
    const keys = (Object.keys(dict) as DictKey[]).filter((k) => k.startsWith("scene.db.") || k.startsWith("scene.table."));
    expect(keys.length).toBeGreaterThanOrEqual(13);
    for (const k of keys) {
      expect(dict[k].ru.trim(), k).not.toBe("");
      expect(dict[k].kk.trim(), k).not.toBe("");
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
      expect(ph(dict[k].kk), k).toBe(ph(dict[k].ru));
      expect(dict[k].ru + dict[k].kk, k).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
