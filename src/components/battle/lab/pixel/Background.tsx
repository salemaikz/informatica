// Фон арены: ночная степь, горы Алатау, луна, юрта. Сетка 130×114, рисуется прямоугольниками.

const W = 130;
const H = 114;
const SKY = ["#0a0e2e", "#101650", "#171e66", "#202878", "#2b3189", "#3a3a96", "#5043a0", "#6a4ba4"];
const STARS: [number, number][] = [[8, 6], [20, 14], [34, 5], [47, 18], [58, 9], [72, 4], [84, 16], [96, 8], [112, 5], [122, 15], [14, 28], [40, 30], [66, 26], [90, 31], [118, 33], [27, 20], [78, 22]];

function ridge(seed: number, base: number, amp: number): number[] {
  return Array.from({ length: W }, (_, x) => Math.round(base - amp * (0.5 + 0.28 * Math.sin(x / 9 + seed) + 0.22 * Math.sin(x / 4.3 + seed * 2.1) + 0.16 * Math.sin(x / 19 + seed * 0.7))));
}

const YURT = [
  ".6 o6 .6",
  ".4 o2 Y6 o2 .4",
  ".2 o2 Y10 o2 .2",
  ".1 o1 Y14 o1 .1",
  "o1 Y16 o1",
  "o1 Y3 y2 Y2 d2 Y2 y2 Y3 o1",
  "o1 Y3 y2 Y2 d2 Y2 y2 Y3 o1",
  "o1 Y16 o1",
  ".1 o16 .1",
];
const expand = (spec: string) => [...spec.matchAll(/(\S)(\d+)/g)].map((m) => m[1].repeat(Number(m[2]))).join("");

export function Background() {
  const far = ridge(1, 62, 22);
  const near = ridge(4, 74, 9);
  const rects: React.ReactNode[] = [];
  let k = 0;
  const R = (x: number, y: number, w: number, h: number, fill: string) => rects.push(<rect key={k++} x={x} y={y} width={w} height={h} fill={fill} />);

  SKY.forEach((c, i) => {
    R(0, i * 9, W, 9, c);
    if (i > 0) for (let x = 0; x < W; x += 2) R(x + (i % 2), i * 9 - 1, 1, 1, c);
  });
  STARS.forEach(([x, y], i) => {
    R(x, y, 1, 1, "#ffffff");
    if (i % 3 === 0) {
      R(x - 1, y, 3, 1, "#c9d4ff");
      R(x, y - 1, 1, 3, "#c9d4ff");
    }
  });
  // луна
  for (let j = -7; j <= 7; j++)
    for (let i = -7; i <= 7; i++) {
      const d = Math.hypot(i, j);
      if (d > 7) continue;
      const cut = Math.hypot(i - 3, j + 1) < 6.2;
      if (!cut) R(100 + i, 20 + j, 1, 1, d > 6 ? "#e8d27a" : "#fff3b0");
    }
  // дальние горы со снегом
  far.forEach((top, x) => {
    R(x, top, 1, 72 - top, "#2c3074");
    if (top < 52) R(x, top, 1, Math.min(4, 52 - top), "#d6defa");
    else if (top < 56) R(x, top, 1, 1, "#aab6ee");
  });
  near.forEach((top, x) => {
    R(x, top, 1, 80 - top, "#1d3f5c");
    R(x, top, 1, 1, "#2f6a78");
  });
  // степь
  R(0, 76, W, 38, "#2a6b3f");
  for (let y = 76; y < H; y += 1) {
    const band = Math.floor((y - 76) / 8);
    R(0, y, W, 1, ["#2a6b3f", "#2f7544", "#357f49", "#3a894e", "#3f9253"][Math.min(4, band)]);
    if (y % 8 === 0) for (let x = (y / 8) % 2; x < W; x += 2) R(x, y, 1, 1, "#2a6b3f");
  }
  for (let i = 0; i < 46; i++) {
    const x = (i * 53) % W;
    const y = 80 + ((i * 29) % 32);
    R(x, y, 1, 2, "#5fb86a");
    R(x + 1, y + 1, 1, 1, "#5fb86a");
  }
  // юрта
  const pal: Record<string, string> = { o: "#140f24", Y: "#d8c9a3", y: "#b8a782", d: "#ffbf4a" };
  YURT.map(expand).forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== ".") R(104 + i, 62 + j, 1, 1, pal[ch]);
    }),
  );
  // площадки
  const plat = (cx: number, cy: number, rw: number, rh: number) => {
    for (let j = -rh; j <= rh; j++) {
      const w = Math.round(rw * Math.sqrt(1 - (j / (rh + 0.5)) ** 2));
      R(cx - w, cy + j, w * 2, 1, j < 0 ? "#8fd27a" : j === 0 ? "#6cb85f" : "#3f7f43");
    }
    R(cx - rw, cy + rh + 1, rw * 2, 1, "#14301f");
  };
  plat(65, 77, 36, 4);
  plat(30, 108, 26, 3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" className="absolute inset-0 h-full w-full" aria-hidden>
      {rects}
    </svg>
  );
}
