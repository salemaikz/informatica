import clsx from "clsx";

export function ProgressBar({
  value,
  color = "var(--success)",
  className,
  height = 14,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={clsx("w-full overflow-hidden rounded-full bg-surface-2", className)}
      style={{ height }}
    >
      <div
        className="relative h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? height : 0 }}
      >
        <span
          className="absolute left-2 right-2 top-[3px] rounded-full bg-white/30"
          style={{ height: Math.max(2, height / 4) }}
        />
      </div>
    </div>
  );
}

/** Кольцевой прогресс — для дневной цели. */
export function Ring({ value, size = 56, stroke = 7, color = "var(--gold)", children }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
