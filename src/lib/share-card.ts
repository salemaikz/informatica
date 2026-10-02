// Карточка результата для «Поделиться»: PNG 1080 × 1920 (вертикальная история) на canvas.
// Тексты приходят готовыми (язык выбирает вызывающий код), здесь — только рисование.
// Canvas не читает CSS-переменные, поэтому цвета — фиксированные hex, равные токенам СВЕТЛОЙ темы
// из src/app/globals.css (:root): --bg, --surface, --border, --text, --muted, --primary(-strong), --success, --warning, --danger, --gold.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
export const CARD_MIN_TOPICS = 3;
export const CARD_MAX_TOPICS = 5;

export const CARD_COLORS = {
  bg: "#f6f7fb",
  surface: "#ffffff",
  border: "#e3e7ef",
  text: "#1b2333",
  muted: "#6b7487",
  primary: "#1a91d6",
  primaryStrong: "#1277b3",
  success: "#21b26f",
  warning: "#f2a516",
  danger: "#ec4c4c",
  gold: "#f0b400",
} as const;

export interface CardTopic {
  label: string;
  points: number;
  max: number;
}

export interface ShareCardModel {
  points: number;
  max: number;
  /** Вид пробника («Мини-ЕНТ»). */
  kindLabel: string;
  /** Подпись к баллу: «из 19» / «19 ішінен» уже собрана вызывающим кодом. */
  ofLabel: string;
  /** true — подпись перед баллом («19 ішінен 14», казахский порядок), иначе после («14 из 19»). */
  ofFirst?: boolean;
  /** Заголовок над темами («По темам»). */
  topicsTitle: string;
  topics: CardTopic[];
  /** Название сайта и его адрес (домен без протокола). */
  siteName: string;
  siteUrl: string;
}

const ratioOf = (p: number, m: number) => (m > 0 ? p / m : 0);

/** Цвет полоски по доле — те же пороги, что у toneOf в components/exam/logic.ts (0.5 / 0.8): слабая — красный, в процессе — янтарный, освоено — зелёный. */
export function cardToneColor(ratio: number): string {
  if (!(ratio >= 0.5)) return CARD_COLORS.danger;
  return ratio >= 0.8 ? CARD_COLORS.success : CARD_COLORS.warning;
}

/** Темы для полосок: только с заданиями, не больше 5 — те, где больше всего баллов в варианте; порядок — по доле (лучшие сверху). */
export function pickCardTopics(topics: CardTopic[], limit = CARD_MAX_TOPICS): CardTopic[] {
  const valid = topics.filter((t) => Number.isFinite(t.points) && Number.isFinite(t.max) && t.max > 0);
  const top = [...valid].sort((a, b) => b.max - a.max || a.label.localeCompare(b.label)).slice(0, Math.max(0, limit));
  return top.sort((a, b) => ratioOf(b.points, b.max) - ratioOf(a.points, a.max) || b.max - a.max);
}

/** Имя файла: informatica-<вид>-<баллы>-of-<макс>.png. */
export function cardFileName(kind: string, points: number, max: number): string {
  return `informatica-${kind}-${points}-of-${max}.png`;
}

// ---------- Рисование ----------

const FONT = '"Nunito Variable", Nunito, system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = Array.from(text);
  while (s.length > 1 && ctx.measureText(`${s.join("")}…`).width > maxW) s = s.slice(0, -1);
  return `${s.join("").trimEnd()}…`;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = "left", maxW?: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(maxW ? fit(ctx, s, maxW) : s, x, y);
}

/** Рисует карточку на готовом canvas (размер выставляется здесь). Отдельно от toBlob — чтобы проверять рисование без файла. */
export function drawShareCard(canvas: HTMLCanvasElement, m: ShareCardModel): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const C = CARD_COLORS;
  const W = CARD_WIDTH;

  // Фон и верхняя плашка с названием сайта.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, CARD_HEIGHT);
  ctx.fillStyle = C.primary;
  ctx.fillRect(0, 0, W, 300);
  text(ctx, m.siteName, W / 2, 175, 84, 900, "#ffffff", "center", W - 160);
  text(ctx, m.kindLabel, W / 2, 245, 44, 700, "#e4f3fc", "center", W - 160);

  // Карточка с баллом.
  const pad = 70;
  const cardX = pad;
  const cardW = W - pad * 2;
  ctx.fillStyle = C.surface;
  roundRect(ctx, cardX, 380, cardW, 540, 56);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.border;
  ctx.stroke();

  const ratio = ratioOf(m.points, m.max);
  const cx = W / 2;
  const cy = 560;
  const R = 130;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.strokeStyle = C.border;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  if (ratio > 0) {
    ctx.strokeStyle = cardToneColor(ratio);
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
    ctx.stroke();
  }
  text(ctx, `${Math.round(ratio * 100)}%`, cx, cy + 22, 64, 900, C.text, "center");
  // Балл и подпись — одной строкой по центру карточки.
  const gap = 24;
  const ptsText = String(m.points);
  ctx.font = `900 150px ${FONT}`;
  const ptsW = ctx.measureText(ptsText).width;
  ctx.font = `800 56px ${FONT}`;
  const ofText = fit(ctx, m.ofLabel, cardW - ptsW - gap - 80);
  const ofW = ctx.measureText(ofText).width;
  const left = cx - (ptsW + gap + ofW) / 2;
  if (m.ofFirst) {
    text(ctx, ofText, left, 865, 56, 800, C.muted, "left");
    text(ctx, ptsText, left + ofW + gap, 865, 150, 900, C.text, "left");
  } else {
    text(ctx, ptsText, left, 865, 150, 900, C.text, "left");
    text(ctx, ofText, left + ptsW + gap, 865, 56, 800, C.muted, "left");
  }

  // Темы полосками.
  const topics = m.topics.slice(0, CARD_MAX_TOPICS);
  if (topics.length) {
    text(ctx, m.topicsTitle, pad, 1000, 46, 800, C.muted, "left", cardW);
    const rowH = 140;
    topics.forEach((tp, i) => {
      const y = 1040 + i * rowH;
      const r = ratioOf(tp.points, tp.max);
      text(ctx, tp.label, pad, y + 50, 44, 800, C.text, "left", cardW - 230);
      text(ctx, `${Math.round(r * 100)}%`, pad + cardW, y + 50, 44, 900, cardToneColor(r), "right");
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

  // Подвал: адрес сайта.
  ctx.fillStyle = C.primaryStrong;
  roundRect(ctx, pad, 1760, cardW, 96, 48);
  ctx.fill();
  text(ctx, m.siteUrl, W / 2, 1825, 46, 800, "#ffffff", "center", cardW - 80);
}

/** PNG-файл карточки. Ждёт шрифт, чтобы текст не нарисовался запасным. */
export async function renderShareCard(m: ShareCardModel): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`900 64px ${FONT}`), document.fonts.load(`700 44px ${FONT}`)]);
  } catch {
    // нет шрифтов — рисуем запасным
  }
  const canvas = document.createElement("canvas");
  drawShareCard(canvas, m);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob-failed"))), "image/png");
  });
}

/** Отдать карточку: системное окно «Поделиться» с файлом, иначе — скачивание. */
export async function shareOrDownloadCard(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "image/png" });
  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
