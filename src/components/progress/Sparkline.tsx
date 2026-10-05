import { cn } from "@/lib/cn";
import type { TrendPoint } from "@/lib/progress";
import { sparkGeometry } from "./format";

const W = 72;
const H = 24;

/**
 * Мини-график точности по дням (SVG). Это картинка: у неё `role="img"` и `aria-label`, а для экранного диктора рядом
 * лежит скрытая таблица «день — заданий — точность» (только дни, в которые были задания). Цвет линии — по смыслу изменения.
 */
export function Sparkline({
  points,
  label,
  caption,
  headers,
  tone = "primary",
  className,
}: {
  points: TrendPoint[];
  /** aria-label картинки. */
  label: string;
  /** Подпись скрытой таблицы (название темы). */
  caption: string;
  headers: [string, string, string];
  tone?: "primary" | "success" | "danger";
  className?: string;
}) {
  const g = sparkGeometry(points, W, H);
  const rows = points.filter((p) => p.n > 0);
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-primary";
  return (
    <>
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={cn("shrink-0", color, className)}>
        {/* Пунктир на 50% — глазу проще понять, выше линия или ниже */}
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
        {g.d && <path d={g.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {g.dots.map((d) => (
          <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="2.5" fill="currentColor" />
        ))}
      </svg>
      {rows.length > 0 && (
        <div className="sr-only">
          <table>
            <caption>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">{headers[0]}</th>
                <th scope="col">{headers[1]}</th>
                <th scope="col">{headers[2]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.day}>
                  <th scope="row">{p.day}</th>
                  <td>{p.n}</td>
                  <td>{p.acc === null ? "—" : `${Math.round(p.acc * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
