"use client";

/** Синхронно сжимает холст в JPEG (для рисунка на экране — без задержки перед проверкой). */
export function canvasToJpeg(source: HTMLCanvasElement, maxSide = 1024, quality = 0.82): string {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Сжимает изображение до maxSide px и JPEG — экономит трафик и токены vision-модели. */
export async function compressImage(source: Blob | HTMLCanvasElement, maxSide = 1280, quality = 0.82): Promise<string> {
  let bitmap: CanvasImageSource;
  let w: number;
  let h: number;
  if (source instanceof HTMLCanvasElement) {
    bitmap = source;
    w = source.width;
    h = source.height;
  } else {
    const b = await createImageBitmap(source);
    bitmap = b;
    w = b.width;
    h = b.height;
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
