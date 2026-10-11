// Пиксельные спрайты героев: сетка 32×32, слои-карты со своей палитрой символ→цвет.
// Тело (голова 12×11, туловище, ноги) общее, а силуэт задают слои: головные уборы, плащи, оружие.

export interface Layer {
  /** Левый верхний угол слоя на сетке 32×32. */
  x: number;
  y: number;
  /** Строки одинаковой длины; "." — прозрачно. */
  rows: string[];
}

export const GRID = 32;

/** Строка из пар «символ+число»: r("o1 t8 .3") → "ottttttttt..." (пробелы необязательны). */
const r = (spec: string): string => [...spec.matchAll(/(\S)(\d+)/g)].map((m) => m[1].repeat(Number(m[2]))).join("");
/** Зеркальная строка из левой половины; swap меняет символы правой половины (тень). */
const mir = (half: string, swap: Record<string, string> = {}): string =>
  half + [...half].reverse().map((c) => swap[c] ?? c).join("");
const L = (x: number, y: number, rows: string[]): Layer => ({ x, y, rows });
const rep = (row: string, n: number): string[] => Array.from({ length: n }, () => row);

/** Круглый щит: контур o, кольцо, поле (с чётвертями alt), умбон boss. */
function disc(d: number, c: { ring: string; face: string; alt?: string; hi?: string; boss: string }): string[] {
  const rows: string[] = [];
  const R = d / 2;
  for (let j = 0; j < d; j++) {
    let s = "";
    for (let i = 0; i < d; i++) {
      const dx = i + 0.5 - R;
      const dy = j + 0.5 - R;
      const dist = Math.hypot(dx, dy);
      let ch = ".";
      if (dist <= R) {
        if (dist > R - 1) ch = "o";
        else if (dist > R - 2.2) ch = c.ring;
        else if (dist < 1.7) ch = c.boss;
        else if (c.alt && dx * dy > 0) ch = c.alt;
        else if (c.hi && dx + dy < -R * 0.7) ch = c.hi;
        else ch = c.face;
      }
      s += ch;
    }
    rows.push(s);
  }
  return rows;
}

// ---------------------------------------------------------------- общее тело (14×25, левый верх: x=9, y=6)
const BASE: Layer = L(9, 6, [
  "...oooooooo...",
  "..okkkkkkkko..",
  ".okkkkkkkkkko.",
  ".okkkkkkkkkko.",
  ".okkkkkkkkkko.",
  ".okeekkkkeeko.",
  ".okewkkkkweko.",
  ".okeekkkkeeko.",
  ".ockkkKKkkkco.",
  "..oKkkkkkkKo..",
  "...oooooooo...",
  ".oTttttttttTo.",
  "oTTttttttttTTo",
  "oTTttttttttTTo",
  "okkTttttttTkko",
  ".ooTTggggTToo.",
  "..oTttttttTo..",
  "..oppppppppo..",
  "..oppppppppo..",
  "..oppPooPppo..",
  "..oppo..oppo..",
  "..oppo..oppo..",
  "..obbo..obbo..",
  ".obbbo..obbbo.",
  ".ooooo..ooooo.",
]);

// кулак с контуром у рукояти оружия (правый/левый)
const FIST_R = (x: number, y: number): Layer => L(x, y, [".oooo.", "kkkkko", ".oooo."]);
const FIST_L = (x: number, y: number): Layer => L(x, y, [".oooo.", "okkkkk", ".oooo."]);

/** Плащ за спиной: L — основа, l — складка, N — тень. */
const cape = (): Layer =>
  L(7, 17, [
    r(".2 o14 .2"),
    r(".1 o1 N2 L10 N2 o1 .1"),
    r(".1 o1 N2 L10 N2 o1 .1"),
    r(".1 o1 N2 L3 l1 L6 N2 o1 .1"),
    r(".1 o1 N2 L3 l1 L6 N2 o1 .1"),
    r("o1 N2 L3 l1 L8 N2 o1"),
    r("o1 N2 L3 l1 L8 N2 o1"),
    r("o1 N2 L3 l1 L8 N2 o1"),
    r("o1 N2 L3 l1 L8 N2 o1"),
    r("o1 N1 L4 .1 L2 N1 L3 .1 L2 N1 o1"),
    r(".1 o3 .1 o4 .1 o4 .1 o2 .1"),
  ]);

/** Меховые/кольчужные «уши» шапки по бокам лица. */
const flaps = (a: string, b: string): Layer =>
  L(7, 10, [
    r(`o1 ${a}2 o1 .10 o1 ${a}2 o1`),
    r(`o1 ${a}2 o1 .10 o1 ${a}2 o1`),
    r(`o1 ${a}1 ${b}1 o1 .10 o1 ${b}1 ${a}1 o1`),
    r(`.1 o1 ${b}1 o1 .10 o1 ${b}1 o1 .1`),
    r(".2 o2 .10 o2 .2"),
  ]);

// ---------------------------------------------------------------- Воин
const warrior: Layer[] = [
  BASE,
  L(9, 3, [
    r(".4 o1 .1 o2 .1 o1 .4"),
    r(".3 o8 .3"),
    r(".3 o1 h6 o1 .3"),
    r(".2 o1 h1 H2 h5 o1 .2"),
    r(".1 o1 h2 H2 h6 o1 .1"),
    r(".1 o1 h10 o1 .1"),
    r(".1 o1 h2 k1 h4 k1 h2 o1 .1"),
    r(".1 o1 h1 k1 .6 k1 h1 o1 .1"),
  ]),
  L(1, 15, disc(10, { ring: "A", face: "t", alt: "T", boss: "g" })),
  L(22, 3, [
    r(".2 o2 .2"),
    ...rep(r(".1 o1 a1 A1 o1 .1"), 13),
    r("o1 g2 G2 o1"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 g2 .2"),
  ]),
  FIST_R(22, 19),
];

// ---------------------------------------------------------------- Следопыт
const ranger: Layer[] = [
  cape(),
  BASE,
  L(9, 1, [
    r(".7 o2 .5"),
    r(".6 o1 l1 L1 o1 .4"),
    r(".5 o1 l1 L2 N1 o1 .3"),
    r(".4 o1 l1 L4 N1 o1 .2"),
    r(".3 o1 l1 L6 N1 o1 .1"),
    r(".1 o1 l1 L8 N1 o1 .1"),
    r(".1 o1 l1 L8 N1 o1 .1"),
    r(".1 o1 l2 L7 N1 o1 .1"),
    r(".1 o1 L1 N1 .6 N1 L1 o1 .1"),
    r(".1 o1 L1 .8 L1 o1 .1"),
    r(".1 o1 N1 .8 N1 o1 .1"),
    r(".1 o1 N1 .8 N1 o1 .1"),
    r(".1 o1 N1 .8 N1 o1 .1"),
    r(".1 o1 N1 .8 N1 o1 .1"),
    r(".2 o1 N1 .6 N1 o1 .2"),
  ]),
  L(7, 16, [
    r(".5 R1 r6 R1 .5"),
    r(".1 o1 N1 L5 g2 L5 N1 o1 .1"),
    r(".1 o1 L5 .4 L5 o1 .1"),
    r(".1 o1 L5 .4 L5 o1 .1"),
    r(".1 o1 L4 N1 .4 N1 L4 o1 .1"),
    r(".2 o1 L3 N1 .4 N1 L3 o1 .2"),
  ]),
  L(22, 12, [
    r(".2 o2 .2"),
    ...rep(r(".1 o1 a1 A1 o1 .1"), 4),
    r("o1 g2 G2 o1"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 y1 Y1 .2"),
    r(".2 g2 .2"),
  ]),
  FIST_R(22, 19),
];

// ---------------------------------------------------------------- Маг кода
const mage: Layer[] = [
  L(4, 1, [
    r(".2 o3 .3"),
    r(".1 o1 m3 o1 .2"),
    r("o1 m1 q1 m2 M1 o1 .1"),
    r("o1 m4 M1 o1 .1"),
    r("o1 m3 M2 o1 .1"),
    r(".1 o1 M3 o1 .2"),
    r(".2 o3 .3"),
    ...rep(r(".2 o1 y1 Y1 o1 .2"), 23),
  ]),
  BASE,
  L(7, 22, [
    r(".4 o1 T1 t6 T1 o1 .4"),
    r(".3 o1 T1 t8 T1 o1 .3"),
    r(".3 o1 T1 u1 t7 T1 o1 .3"),
    r(".2 o1 T1 t10 T1 o1 .2"),
    r(".2 o1 T1 u1 t9 T1 o1 .2"),
    r(".1 o1 T1 t12 T1 o1 .1"),
    r(".1 o1 T1 t5 T2 t5 T1 o1 .1"),
    r("o1 T1 t14 T1 o1"),
    r("o1 g8 G8 o1"),
    r("o18"),
  ]),
  L(9, 10, [r("h2 .10 h2"), r("h2 .10 h2"), r("h2 .10 h2"), r("H1 h1 .10 h1 H1"), r(".1 h1 .10 h1 .1"), r(".1 h1 .10 h1 .1")]),
  L(7, 0, [
    r(".11 o2 .5"),
    r(".9 o1 t1 T1 o1 .5"),
    r(".8 o1 u1 t1 T1 o1 .5"),
    r(".7 o1 u1 t2 T1 o1 .5"),
    r(".6 o1 u2 t2 T1 o1 .5"),
    r(".5 o1 u2 t3 T2 o1 .4"),
    r(".4 o1 u2 t4 T3 o1 .3"),
    r(".2 o1 g9 G3 o1 .2"),
    r(".1 o1 u4 t9 T1 o1 .1"),
    r("o1 T16 o1"),
  ]),
  FIST_L(5, 19),
];

// ---------------------------------------------------------------- Лучник (тымак + лук)
const archerBow: string[] = (() => {
  const cols = [3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3];
  return cols.map((c) => {
    const row = Array.from({ length: 5 }, () => ".");
    row[4] = "w";
    row[c] = "y";
    row[c + 1] = "Y";
    return row.join("");
  });
})();
const archer: Layer[] = [
  L(22, 9, [
    r(".1 r1 .1 r1 .1 r1"),
    r(".1 R1 .1 R1 .1 R1"),
    ...rep(r(".1 y1 .1 y1 .1 y1"), 3),
    r("o1 g4 o1"),
    ...rep(r("o1 Y1 y2 Y1 o1"), 11),
    r(".1 o4 .1"),
  ]),
  BASE,
  L(3, 9, archerBow),
  L(5, 19, [r(".1 o7"), r("k3 t5"), r(".1 o7")]),
  L(7, 2, [
    mir(".....oooo"),
    mir("....offff", { f: "F" }),
    mir("...offffq", { f: "F" }),
    mir("..offffff", { f: "F" }),
    mir(".offfffff", { f: "F" }),
    mir("offffffff", { f: "F" }),
    mir("offffffff", { f: "F" }),
    mir("oFFFFFFFF"),
  ]),
  flaps("f", "F"),
];

// ---------------------------------------------------------------- Батыр (шлем-шишак, копьё с тугом, щит)
const batyr: Layer[] = [
  L(2, 0, [
    r(".3 o2 .3"),
    r(".2 o1 a1 A1 o1 .2"),
    r(".2 o1 a1 A1 o1 .2"),
    r(".1 o1 a2 A1 z1 o1 .1"),
    r(".2 o1 a1 A1 o1 .2"),
    r(".2 o1 g2 o1 .2"),
    r(".1 o1 R1 L2 R1 o1 .1"),
    r(".1 o1 L1 R1 L1 R1 o1 .1"),
    r(".2 o1 R1 L1 o1 .2"),
    r(".3 L1 R1 .3"),
    ...rep(r(".3 y1 Y1 .3"), 22),
  ]),
  cape(),
  BASE,
  L(12, 17, (() => {
    const rows: string[] = [];
    for (let j = 0; j < 5; j++) rows.push(Array.from({ length: 8 }, (_, i) => ((i + j) % 2 ? "T" : "t")).join(""));
    return rows;
  })()),
  L(15, 18, ["gG", "Gg"]),
  L(7, 16, [
    r(".1 o3 .10 o3 .1"),
    r("o1 g2 G1 .10 G1 g2 o1"),
    r("o1 g2 G1 .10 G1 g2 o1"),
    r(".1 o1 G1 o1 .10 o1 G1 o1 .1"),
  ]),
  flaps("A", "z"),
  L(7, 0, [
    r(".8 o2 .8"),
    r(".7 o1 g1 G1 o1 .7"),
    r(".7 o1 g1 G1 o1 .7"),
    r(".6 o1 g2 G2 o1 .6"),
    mir("....oaaaa", { a: "A" }),
    mir("...oaaaaa", { a: "A" }),
    mir("..oaaaaaa", { a: "A" }),
    mir("..oaaaaaa", { a: "A" }),
    mir(".oaaaaaaa", { a: "A" }),
    mir(".oggggggg", { g: "G" }),
  ]),
  L(15, 10, rep("aA", 4)),
  L(14, 13, ["hhhh"]),
  L(19, 18, disc(11, { ring: "g", face: "L", alt: "N", boss: "q" })),
  FIST_L(5, 19),
];

// ---------------------------------------------------------------- Тёмный рыцарь (легендарный)
const knight: Layer[] = [
  cape(),
  L(7, 1, [
    mir("o........"),
    mir("oa......."),
    mir("oaa......"),
    mir(".oaa....."),
    mir(".oAaa...."),
    mir("..oAaa..."),
    mir("..oAAaa.."),
  ]),
  BASE,
  L(14, 18, [".mm.", "mMMm", ".mm."]),
  L(7, 15, [
    mir("o........"),
    mir("oa......."),
    mir("oaaaaao.."),
    mir("oaaAAAAo."),
    mir(".oAAAAzo."),
    mir("..ozzzo.."),
  ]),
  L(7, 2, [
    mir(".......oo"),
    mir("......ouu", { u: "T" }),
    mir(".....ouuu", { u: "T" }),
    mir("....ouuuu", { u: "T" }),
    mir("....ouuuu", { u: "T" }),
    mir("...ouuuuu", { u: "T" }),
    mir("...ouuuuu", { u: "T" }),
    mir("...ouuuuu", { u: "T" }),
    mir("...oaaaaa", { a: "A" }),
    mir("...ozrrzz"),
    mir("...ozrrzz"),
    mir("...ozzzzz"),
    mir("...oAzAzA"),
    mir("....oAAAA"),
    mir(".....oooo"),
  ]),
  L(22, 0, [
    r(".3 o2 .3"),
    ...rep(r(".1 o1 a1 m1 M1 z1 o1 .1"), 17),
    r("o1 G1 g4 G1 o1"),
    r(".3 y1 Y1 .3"),
    r(".3 y1 Y1 .3"),
    r(".3 y1 Y1 .3"),
    r(".3 y1 Y1 .3"),
    r(".3 y1 Y1 .3"),
    r(".3 g2 .3"),
  ]),
  FIST_R(22, 19),
];

// ---------------------------------------------------------------- мерцающие слои
const FLAME = ["..m..", "..m..", ".mMm.", ".mMm.", "mMmMm", "mMMMm", ".MMM.", "..M.."];
const glyphs = L(24, 9, ["mmm..m.", "m.m.mm.", "m.m..m.", "m.m..m.", "mmm.mmm"]);

export interface SkinSprite {
  palette: Record<string, string>;
  layers: Layer[];
  /** Слои, которые мерцают позади героя (аура). */
  behind?: Layer[];
  /** Слои, которые мерцают поверх героя (глаза, блики, руны). */
  fx?: Layer[];
  /** Цвет свечения и искр вокруг (эпик, легенда). */
  aura?: string;
  embers?: string[];
}

const BASE_PALETTE: Record<string, string> = {
  o: "#1b1530",
  k: "#f6c39b",
  K: "#dd9a70",
  e: "#231a38",
  w: "#ffffff",
  c: "#f19a8a",
  t: "#d9453f",
  T: "#a22b35",
  u: "#f27a62",
  g: "#f7c948",
  G: "#c99421",
  p: "#4a5ea6",
  P: "#34447f",
  b: "#6f4a2a",
  h: "#7b4a24",
  H: "#b0702f",
  a: "#eef2fa",
  A: "#aab5cc",
  z: "#6a7690",
  y: "#9a6a36",
  Y: "#613d1c",
  L: "#3f8a4f",
  l: "#67b36e",
  N: "#265a35",
  m: "#62f2ff",
  M: "#1cb1d1",
  q: "#ffffff",
  r: "#e0443e",
  R: "#a42a30",
  f: "#ee9a45",
  F: "#b8621f",
};

const pal = (o: Record<string, string>) => ({ ...BASE_PALETTE, ...o });

export const SPRITES: Record<string, SkinSprite> = {
  warrior: { palette: pal({}), layers: warrior },
  ranger: {
    palette: pal({ t: "#7b5a36", T: "#54391f", u: "#9b7646", p: "#3d4a40", P: "#2a352d", b: "#4a3320", L: "#3f8a4f", l: "#6bbf72", N: "#265a35", r: "#e0443e", R: "#a42a30", e: "#16301f" }),
    layers: ranger,
  },
  mage: {
    palette: pal({ t: "#6a4ad8", T: "#43308f", u: "#9a7cff", g: "#ffd34d", G: "#c99a1f", h: "#e8eefc", H: "#ffffff", e: "#1a1240" }),
    layers: mage,
    fx: [glyphs],
  },
  archer: {
    palette: pal({ t: "#2f8f83", T: "#1f6259", u: "#55b8a8", p: "#3b4152", P: "#272c3a", b: "#6a4426", f: "#f0a04b", F: "#b8621f", q: "#fff0d6", e: "#3a1d12" }),
    layers: archer,
  },
  batyr: {
    palette: pal({ k: "#e9ac80", K: "#c98a5e", t: "#c23a2f", T: "#8e2024", g: "#ffd24a", G: "#d19a17", p: "#2d3566", P: "#1f244a", b: "#3a2418", h: "#1a1010", L: "#b32a2a", l: "#d64545", N: "#751a1f", R: "#7e1620" }),
    layers: batyr,
    fx: [L(16, 1, ["q"]), L(9, 17, ["q"]), L(22, 17, ["q"])],
    aura: "#ffd24a",
  },
  knight: {
    palette: pal({ o: "#0c0a14", k: "#5d6280", K: "#3a3e55", t: "#40445f", T: "#262944", u: "#6d7396", p: "#2f3249", P: "#1d1f33", b: "#262944", g: "#a14bff", G: "#6a22c9", a: "#b4bad6", A: "#7c82a3", z: "#2a2d45", L: "#2a1b46", N: "#170f2b", l: "#4b2e7a", m: "#c47bff", M: "#7a22c9", r: "#ff3b4a", q: "#ffd9de", y: "#3a2a50", Y: "#231838" }),
    layers: knight,
    behind: [L(1, 12, FLAME), L(25, 21, FLAME), L(3, 23, FLAME)],
    fx: [L(12, 11, ["q"]), L(19, 11, ["q"])],
    aura: "#a14bff",
    embers: ["#c47bff", "#ff3b4a", "#ffffff", "#a14bff"],
  },
};

export interface SkinMeta {
  id: string;
  sprite: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const HEROES: SkinMeta[] = [
  { id: "warrior", sprite: "warrior", name: "Воин", rarity: "common" },
  { id: "ranger", sprite: "ranger", name: "Следопыт", rarity: "common" },
  { id: "mage", sprite: "mage", name: "Маг кода", rarity: "rare" },
  { id: "archer", sprite: "archer", name: "Лучник", rarity: "rare" },
  { id: "batyr", sprite: "batyr", name: "Батыр", rarity: "epic" },
  { id: "knight", sprite: "knight", name: "Тёмный рыцарь", rarity: "legendary" },
];

// ---------------------------------------------------------------- сборка
export interface Px {
  x: number;
  y: number;
  c: string;
}
export interface Built {
  paths: { c: string; d: string }[];
  behind: { c: string; d: string }[];
  fx: { c: string; d: string }[];
  pixels: Px[];
  /** Границы нарисованного (в клетках). */
  box: { x: number; y: number; w: number; h: number };
}

function paint(layers: Layer[], palette: Record<string, string>): Px[] {
  const grid: (string | null)[] = Array.from({ length: GRID * GRID }, () => null);
  for (const l of layers) {
    l.rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        const gx = l.x + i;
        const gy = l.y + j;
        if (ch === "." || gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return;
        grid[gy * GRID + gx] = palette[ch] ?? "#ff00ff";
      });
    });
  }
  const out: Px[] = [];
  grid.forEach((c, i) => {
    if (c) out.push({ x: i % GRID, y: Math.floor(i / GRID), c });
  });
  return out;
}

/** Склейка горизонтальных серий одного цвета в пути: меньше узлов SVG. */
function toPaths(px: Px[]): { c: string; d: string }[] {
  const byColor = new Map<string, Px[]>();
  for (const p of px) (byColor.get(p.c) ?? byColor.set(p.c, []).get(p.c)!).push(p);
  const out: { c: string; d: string }[] = [];
  for (const [c, list] of byColor) {
    list.sort((a, b) => a.y - b.y || a.x - b.x);
    let d = "";
    let i = 0;
    while (i < list.length) {
      let j = i;
      while (j + 1 < list.length && list[j + 1].y === list[i].y && list[j + 1].x === list[j].x + 1) j++;
      d += `M${list[i].x} ${list[i].y}h${j - i + 1}v1h-${j - i + 1}z`;
      i = j + 1;
    }
    out.push({ c, d });
  }
  return out;
}

const cache = new Map<string, Built>();

export function build(id: string): Built {
  const hit = cache.get(id);
  if (hit) return hit;
  const s = SPRITES[id] ?? SPRITES.warrior;
  const pixels = paint(s.layers, s.palette);
  const all = [...pixels, ...paint(s.behind ?? [], s.palette), ...paint(s.fx ?? [], s.palette)];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const built: Built = {
    paths: toPaths(pixels),
    behind: toPaths(paint(s.behind ?? [], s.palette)),
    fx: toPaths(paint(s.fx ?? [], s.palette)),
    pixels,
    box: { x: x0, y: y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1 },
  };
  cache.set(id, built);
  return built;
}

/** Проверка форм слоёв (для тестов/скриптов): возвращает список ошибок. */
export function validate(): string[] {
  const errs: string[] = [];
  for (const [id, s] of Object.entries(SPRITES)) {
    const all = [...s.layers, ...(s.behind ?? []), ...(s.fx ?? [])];
    all.forEach((l, k) => {
      const w = l.rows[0].length;
      l.rows.forEach((row, j) => {
        if (row.length !== w) errs.push(`${id} слой ${k} строка ${j}: ширина ${row.length}, ожидалось ${w}`);
        for (const ch of row) if (ch !== "." && !(ch in s.palette)) errs.push(`${id} слой ${k}: нет цвета для «${ch}»`);
      });
      if (l.x + w > GRID || l.y + l.rows.length > GRID) errs.push(`${id} слой ${k}: выходит за сетку (${l.x + w}×${l.y + l.rows.length})`);
    });
  }
  return errs;
}
