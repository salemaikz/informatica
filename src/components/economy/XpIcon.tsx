import { cn } from "@/lib/cn";

/** Значок опыта: плашка с буквами «XP» (золото). Размер — как у иконок lucide. */
export function XpIcon({ size = 20, className, decorative = false }: { size?: number; className?: string; /** Рядом уже написано «XP» — для диктора значок скрыт. */ decorative?: boolean }) {
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "XP" })}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md border border-gold bg-gold-soft font-black leading-none text-warning-strong", className)}
      style={{ width: size * 1.3, height: size, fontSize: Math.max(8, size * 0.5) }}
    >
      XP
    </span>
  );
}
