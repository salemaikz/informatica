import { cn } from "@/lib/cn";

/** Лёгкая SVG-иллюстрация: кейсы выдаются только за новые уровни. */
export function CaseVisual({ size = 140, open = false, className }: { size?: number; open?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 180 150" width={size} height={size * 150 / 180} className={cn("overflow-visible", className)} aria-hidden>
      <ellipse cx="90" cy="133" rx="64" ry="10" fill="var(--border)" />
      {open && <><path d="m90 10 9 22 24 3-18 16 4 24-19-11-20 11 4-24-18-16 25-3Z" fill="var(--gold)" /><path d="m27 30 7-11m114 11-7-11M16 66l-10-3m158 3 10-3" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" /></>}
      <path d="M29 67h122v48c0 10-8 17-17 17H46c-9 0-17-7-17-17Z" fill="var(--primary-strong)" stroke="var(--primary)" strokeWidth="5" />
      <path d="M36 48h108c8 0 13 6 13 13v20H23V61c0-7 5-13 13-13Z" fill="var(--primary)" stroke="var(--primary-strong)" strokeWidth="4" transform={open ? "translate(0 -24) rotate(-7 90 50)" : undefined} />
      <path d="M50 49v82m80-82v82" stroke="var(--gold)" strokeWidth="8" />
      <rect x="74" y="70" width="32" height="30" rx="8" fill="var(--gold)" />
      <path d="m90 77 8 8-8 8-8-8Z" fill="var(--primary-strong)" />
      <path d="M40 102h20m-20 10h12m63-10h20m-12 10h12" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
