"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** QR-код SVG. Цвета фиксированные (чёрное на белом) — иначе в тёмной теме код не читается камерой. */
export function QrCode({ text, label, size = 360 }: { text: string; label: string; size?: number }) {
  const { count, path } = useMemo(() => {
    try {
      const q = qrcode(0, "L");
      q.addData(text);
      q.make();
      const n = q.getModuleCount();
      let d = "";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
      return { count: n, path: d };
    } catch {
      return { count: 0, path: "" };
    }
  }, [text]);
  if (!count) return null;
  const quiet = 4;
  const side = count + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${side} ${side}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ maxWidth: size }}
      className="mx-auto h-auto w-full rounded-2xl bg-white"
    >
      <path d={path} className="fill-black" />
    </svg>
  );
}
