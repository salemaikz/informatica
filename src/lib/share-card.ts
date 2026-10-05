// Карточка результата для «Поделиться» (#72): PNG 1080 × 1920 (вертикальная история) на canvas. Три вида: пробник, курс, серия.
// Тексты приходят готовыми (язык выбирает компонент, см. components/share/labels.ts), здесь — только рисование.
// Canvas не читает CSS-переменные, поэтому цвета — фиксированные hex, равные токенам СВЕТЛОЙ темы из src/app/globals.css (:root);
// совпадение проверяет tests/share-card-colors.test.ts. Иконки — пути lucide (Path2D), эмодзи нет.
// Чистые функции (выбор тем, цвет по доле, имя файла) — с тестами; рисование (`drawShareCard`) отдельно от файла (`renderShareCard`).

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
/** Сильных тем на карточке пробника — не больше (слабые публично не показываем, #72). */
export const CARD_MAX_TOPICS = 3;
/** Тема считается сильной от этой доли. */
export const CARD_STRONG_FROM = 0.5;

/** Hex-копии токенов `:root` из globals.css (ключ camelCase ↔ `--kebab-case`). */
export const CARD_COLORS = {
  bg: "#f6f7fb",
  surface: "#ffffff",
  border: "#e3e7ef",
  text: "#1b2333",
  muted: "#6b7487",
  primary: "#1a91d6",
  primaryStrong: "#1277b3",
  primarySoft: "#e4f3fc",
  success: "#21b26f",
  warning: "#f2a516",
  danger: "#ec4c4c",
  gold: "#f0b400",
  goldSoft: "#fff6d6",
  streak: "#ff7a1a",
  streakSoft: "#ffeedf",
} as const;

export interface CardTopic {
  label: string;
  points: number;
  max: number;
}

/** Общие поля: названия сайта и хоста, подпись в шапке и призыв в подвале (всё — готовыми строками). */
interface CardBase {
  siteName: string;
  /** Хост сайта без протокола (из `siteUrl()`, не из окна браузера). */
  siteHost: string;
  /** Подпись под названием сайта («Мини-ЕНТ», «Мой прогресс»). */
  kicker: string;
  /** Призыв над адресом («Пройди этот же вариант»). */
  footer: string;
}

export type ShareCardModel =
  | (CardBase & {
      kind: "exam";
      /** Вид пробника для имени файла. */
      examKind: string;
      points: number;
      max: number;
      /** «из 19» / «19 ішінен» — собрано вызывающим кодом. */
      ofLabel: string;
      /** true — подпись перед баллом (казахский порядок «19 ішінен 14»). */
      ofFirst?: boolean;
      /** Заголовок над темами («Сильные темы»). */
      topicsTitle: string;
      /** Уже отобранные сильные темы (`pickStrongTopics`). */
      topics: CardTopic[];
    })
  | (CardBase & {
      kind: "course";
      percent: number;
      done: number;
      total: number;
      /** «Пройдено» над процентом. */
      lead: string;
      /** «12 из 96 уроков». */
      lessonsLabel: string;
      /** «курса подготовки к ЕНТ» / «программы 8 класса». */
      subtitle: string;
    })
  | (CardBase & {
      kind: "streak";
      days: number;
      /** «дней подряд». */
      daysLabel: string;
      /** «Рекорд: 30»; null — не показывать. */
      recordLabel: string | null;
    });

const ratioOf = (p: number, m: number) => (m > 0 ? p / m : 0);

/** Цвет по доле — те же пороги, что у toneOf в components/exam/logic.ts (0.5 / 0.8): слабая — красный, в процессе — янтарный, освоено — зелёный. */
export function cardToneColor(ratio: number): string {
  if (!(ratio >= 0.5)) return CARD_COLORS.danger;
  return ratio >= 0.8 ? CARD_COLORS.success : CARD_COLORS.warning;
}

/** До 3 сильных тем (доля ≥ 0,5) по убыванию доли; при равенстве — где больше заданий, затем по названию. Слабые не попадают никогда. */
export function pickStrongTopics(topics: readonly CardTopic[], limit = CARD_MAX_TOPICS): CardTopic[] {
  return topics
    .filter((t) => Number.isFinite(t.points) && Number.isFinite(t.max) && t.max > 0 && t.points / t.max >= CARD_STRONG_FROM)
    .sort((a, b) => ratioOf(b.points, b.max) - ratioOf(a.points, a.max) || b.max - a.max || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit));
}

/** Имя файла: informatica-<вид>-<баллы>-of-<макс>.png; курс — informatica-course-<%>.png; серия — informatica-streak-<дни>.png. */
export function cardFileName(m: Pick<ShareCardModel, "kind"> & Partial<{ examKind: string; points: number; max: number; percent: number; days: number }>): string {
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "x";
  if (m.kind === "exam") return `informatica-${safe(m.examKind ?? "exam")}-${m.points ?? 0}-of-${m.max ?? 0}.png`;
  if (m.kind === "course") return `informatica-course-${m.percent ?? 0}.png`;
  return `informatica-streak-${m.days ?? 0}.png`;
}

/** Хост из адреса сайта: «https://informatica-chi.vercel.app» → «informatica-chi.vercel.app». */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

// ---------- Рисование ----------

const FONT = '"Nunito Variable", Nunito, system-ui, -apple-system, "Segoe UI", sans-serif';
/** Строка с казахскими буквами: по ней браузер подгружает нужный кусок шрифта (unicode-range). */
const FONT_SAMPLE = "Aa Яя әғқңөұүһі ӘҒҚҢӨҰҮҺІ 0123456789";

/** Путь иконки lucide «flame» (сетка 24 × 24). */
const FLAME_PATH = "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4";

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Обрезает строку с многоточием, чтобы поместилась в ширину. */
function ellipsize(ctx: Ctx, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let a = Array.from(s);
  while (a.length > 1 && ctx.measureText(`${a.join("")}…`).width > maxW) a = a.slice(0, -1);
  return `${a.join("").trimEnd()}…`;
}

/** Текст: если не влезает — сначала уменьшаем кегль (до 70%), потом обрезаем. */
function text(ctx: Ctx, s: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = "left", maxW?: number) {
  let px = size;
  ctx.font = `${weight} ${px}px ${FONT}`;
  if (maxW) {
    while (px > size * 0.7 && ctx.measureText(s).width > maxW) {
      px -= 2;
      ctx.font = `${weight} ${px}px ${FONT}`;
    }
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(maxW ? ellipsize(ctx, s, maxW) : s, x, y);
}

function measure(ctx: Ctx, s: string, size: number, weight: number): number {
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(s).width;
}

/** Маскот «Бит» (как components/mascot/Mascot.tsx, настроение happy), нарисованный примитивами; viewBox исходника 120 × 120. */
function drawMascot(ctx: Ctx, x: number, y: number, size: number) {
  const k = size / 120;
  const px = (v: number) => x + v * k;
  const py = (v: number) => y + v * k;
  const fillRound = (rx: number, ry: number, w: number, h: number, r: number, color: string) => {
    ctx.fillStyle = color;
    roundRect(ctx, px(rx), py(ry), w * k, h * k, r * k);
    ctx.fill();
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = CARD_COLORS.primaryStrong;
  ctx.lineWidth = 4 * k;
  ctx.beginPath();
  ctx.moveTo(px(60), py(14));
  ctx.lineTo(px(60), py(27));
  ctx.stroke();
  ctx.fillStyle = CARD_COLORS.gold;
  ctx.beginPath();
  ctx.arc(px(60), py(11), 6.5 * k, 0, Math.PI * 2);
  ctx.fill();
  fillRound(9, 54, 12, 24, 6, CARD_COLORS.primaryStrong);
  fillRound(99, 54, 12, 24, 6, CARD_COLORS.primaryStrong);
  fillRound(17, 26, 86, 78, 28, CARD_COLORS.primary);
  ctx.globalAlpha = 0.18;
  fillRound(25, 30, 70, 16, 8, "#ffffff");
  ctx.globalAlpha = 1;
  fillRound(28, 42, 64, 50, 17, "#10263d");
  // Глаза и улыбка.
  ctx.fillStyle = "#7fe3ff";
  roundRect(ctx, px(42), py(55), 11 * k, 15 * k, 5 * k);
  ctx.fill();
  roundRect(ctx, px(67), py(55), 11 * k, 15 * k, 5 * k);
  ctx.fill();
  ctx.strokeStyle = "#7fe3ff";
  ctx.lineWidth = 3.5 * k;
  ctx.beginPath();
  ctx.moveTo(px(50), py(75));
  ctx.quadraticCurveTo(px(60), py(84), px(70), py(75));
  ctx.stroke();
  ctx.restore();
}

/** Общая шапка: плашка primary, маскот слева, название сайта и подпись. */
function drawHeader(ctx: Ctx, m: ShareCardModel) {
  const C = CARD_COLORS;
  ctx.fillStyle = C.primary;
  ctx.fillRect(0, 0, CARD_WIDTH, 330);
  drawMascot(ctx, 70, 55, 220);
  text(ctx, m.siteName, 330, 175, 88, 900, "#ffffff", "left", CARD_WIDTH - 330 - 60);
  text(ctx, m.kicker, 330, 250, 46, 800, C.primarySoft, "left", CARD_WIDTH - 330 - 60);
}

/** Подвал: призыв и адрес сайта плашкой. */
function drawFooter(ctx: Ctx, m: ShareCardModel) {
  const C = CARD_COLORS;
  const pad = 70;
  const w = CARD_WIDTH - pad * 2;
  text(ctx, m.footer, CARD_WIDTH / 2, 1668, 56, 900, C.text, "center", w);
  ctx.fillStyle = C.primaryStrong;
  roundRect(ctx, pad, 1716, w, 104, 52);
  ctx.fill();
  text(ctx, m.siteHost, CARD_WIDTH / 2, 1786, 48, 800, "#ffffff", "center", w - 80);
}

function drawPanel(ctx: Ctx, y: number, h: number) {
  const C = CARD_COLORS;
  ctx.fillStyle = C.surface;
  roundRect(ctx, 70, y, CARD_WIDTH - 140, h, 56);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.border;
  ctx.stroke();
}

function drawRing(ctx: Ctx, cx: number, cy: number, R: number, stroke: number, ratio: number, color: string) {
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.strokeStyle = CARD_COLORS.border;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  if (ratio > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
    ctx.stroke();
  }
}

function drawExam(ctx: Ctx, m: Extract<ShareCardModel, { kind: "exam" }>) {
  const C = CARD_COLORS;
  const pad = 70;
  const cardW = CARD_WIDTH - pad * 2;
  const cx = CARD_WIDTH / 2;
  drawPanel(ctx, 410, 560);
  const ratio = ratioOf(m.points, m.max);
  drawRing(ctx, cx, 590, 130, 34, ratio, cardToneColor(ratio));
  text(ctx, `${Math.round(ratio * 100)}%`, cx, 612, 64, 900, C.text, "center");
  // Балл и подпись — одной строкой по центру панели.
  const gap = 24;
  const pts = String(m.points);
  const ptsW = measure(ctx, pts, 150, 900);
  // Шрифт подписи выставляем до обрезки: ellipsize меряет текущим шрифтом контекста.
  ctx.font = `800 56px ${FONT}`;
  const ofText = ellipsize(ctx, m.ofLabel, cardW - ptsW - gap - 80);
  const ofW = measure(ctx, ofText, 56, 800);
  const left = cx - (ptsW + gap + ofW) / 2;
  const base = 895;
  if (m.ofFirst) {
    text(ctx, ofText, left, base, 56, 800, C.muted, "left");
    text(ctx, pts, left + ofW + gap, base, 150, 900, C.text, "left");
  } else {
    text(ctx, pts, left, base, 150, 900, C.text, "left");
    text(ctx, ofText, left + ptsW + gap, base, 56, 800, C.muted, "left");
  }

  // Сильные темы полосками.
  const topics = m.topics.slice(0, CARD_MAX_TOPICS);
  if (topics.length) {
    text(ctx, m.topicsTitle, pad, 1070, 48, 800, C.muted, "left", cardW);
    const rowH = 140;
    topics.forEach((tp, i) => {
      const y = 1110 + i * rowH;
      const r = ratioOf(tp.points, tp.max);
      text(ctx, tp.label, pad, y + 50, 46, 800, C.text, "left", cardW - 160);
      text(ctx, `${Math.round(r * 100)}%`, pad + cardW, y + 50, 46, 900, C.text, "right");
      ctx.fillStyle = C.border;
      roundRect(ctx, pad, y + 72, cardW, 32, 16);
      ctx.fill();
      if (r > 0) {
        ctx.fillStyle = cardToneColor(r);
        roundRect(ctx, pad, y + 72, Math.max(32, cardW * Math.min(1, r)), 32, 16);
        ctx.fill();
      }
    });
  }
}

function drawCourse(ctx: Ctx, m: Extract<ShareCardModel, { kind: "course" }>) {
  const C = CARD_COLORS;
  const cx = CARD_WIDTH / 2;
  const inner = CARD_WIDTH - 260;
  drawPanel(ctx, 410, 1110);
  text(ctx, m.lead, cx, 560, 64, 800, C.muted, "center", inner);
  const ratio = Math.max(0, Math.min(1, m.percent / 100));
  const color = ratio >= 1 ? C.success : C.primary;
  drawRing(ctx, cx, 900, 240, 60, ratio, color);
  text(ctx, `${m.percent}%`, cx, 975, 190, 900, C.text, "center", 360);
  text(ctx, m.lessonsLabel, cx, 1290, 64, 900, C.text, "center", inner);
  text(ctx, m.subtitle, cx, 1375, 52, 800, C.muted, "center", inner);
}

function drawStreak(ctx: Ctx, m: Extract<ShareCardModel, { kind: "streak" }>) {
  const C = CARD_COLORS;
  const cx = CARD_WIDTH / 2;
  const inner = CARD_WIDTH - 260;
  drawPanel(ctx, 410, 1110);
  // Пламя: путь lucide 24 × 24, масштаб 14 → 336 px.
  const k = 14;
  ctx.save();
  ctx.translate(cx - 12 * k, 500);
  ctx.scale(k, k);
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = C.streakSoft;
  ctx.strokeStyle = C.streak;
  const flame = new Path2D(FLAME_PATH);
  ctx.fill(flame);
  ctx.stroke(flame);
  ctx.restore();
  text(ctx, String(m.days), cx, 1130, 280, 900, C.text, "center", inner);
  text(ctx, m.daysLabel, cx, 1235, 68, 800, C.muted, "center", inner);
  if (m.recordLabel) {
    ctx.font = `800 52px ${FONT}`;
    const w = Math.min(inner, ctx.measureText(m.recordLabel).width + 120);
    ctx.fillStyle = C.goldSoft;
    roundRect(ctx, cx - w / 2, 1330, w, 108, 54);
    ctx.fill();
    text(ctx, m.recordLabel, cx, 1402, 52, 800, C.text, "center", w - 60);
  }
}

/** Рисует карточку на готовом canvas (размер выставляется здесь). Отдельно от toBlob — чтобы проверять рисование без файла. */
export function drawShareCard(canvas: HTMLCanvasElement, m: ShareCardModel): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.fillStyle = CARD_COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawHeader(ctx, m);
  if (m.kind === "exam") drawExam(ctx, m);
  else if (m.kind === "course") drawCourse(ctx, m);
  else drawStreak(ctx, m);
  drawFooter(ctx, m);
}

/** PNG-файл карточки. Ждёт шрифт (с казахскими буквами), чтобы текст не нарисовался запасным. */
export async function renderShareCard(m: ShareCardModel): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`900 64px ${FONT}`, FONT_SAMPLE), document.fonts.load(`800 44px ${FONT}`, FONT_SAMPLE)]);
  } catch {
    // нет шрифтов — рисуем запасным
  }
  const canvas = document.createElement("canvas");
  drawShareCard(canvas, m);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob-failed"))), "image/png");
  });
}
