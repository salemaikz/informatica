"use client";

import { CircleCheck, CircleX, ArrowRight, ListChecks } from "lucide-react";
import { m } from "motion/react";
import { forwardRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CheckResult } from "@/lib/ide/types";
import { useT } from "@/i18n/useT";
import { messageText } from "./shell-helpers";

export interface ResultState {
  result: CheckResult;
  /** Сколько XP начислено за эту проверку (0 — задача решена раньше). */
  xp: number;
  first: boolean;
}

/** Итог проверки: верно — зелёный и «+N XP», неверно — что не так и пример «вход / ожидалось / получено». */
export const ResultBanner = forwardRef<HTMLDivElement, { state: ResultState; next: { href: string } | null; listHref: string }>(function ResultBanner(
  { state, next, listHref },
  ref,
) {
  const { t, lang } = useT();
  const { result: r, xp, first } = state;
  const message = messageText(r.message, lang);
  const partial = !r.ok && r.passed > 0 && r.total > 1;
  const tone = r.ok ? "success" : partial ? "warning" : "danger";

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "scroll-mb-24 rounded-3xl border-2 p-4",
        tone === "success" && "border-success/50 bg-success-soft",
        tone === "warning" && "border-warning/50 bg-warning-soft",
        tone === "danger" && "border-danger/50 bg-danger-soft",
      )}
    >
      <div className="flex items-start gap-3">
        {r.ok ? <CircleCheck size={28} className="mt-0.5 shrink-0 text-success-strong" aria-hidden /> : <CircleX size={28} className={cn("mt-0.5 shrink-0", partial ? "text-warning-strong" : "text-danger")} aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className={cn("text-lg font-extrabold", r.ok ? "text-success-strong" : partial ? "text-warning-strong" : "text-danger")}>
            {r.ok ? t(first ? "ide.result.ok" : "ide.result.okRepeat") : t("ide.result.fail")}
          </p>
          {!r.ok && r.total > 1 && <p className="text-sm font-bold text-muted">{t("ide.result.partial", { passed: r.passed, total: r.total })}</p>}
          {message && <p className="mt-1 whitespace-pre-wrap break-words font-semibold">{message}</p>}
          {!r.ok && !message && <p className="mt-1 font-semibold">{t("ide.result.tryAgain")}</p>}
        </div>
        {r.ok && xp > 0 && (
          <m.span
            initial={{ scale: 0.4, opacity: 0, y: 8 }}
            animate={{ scale: [0.4, 1.25, 1], opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="shrink-0 rounded-full bg-gold-soft px-3 py-1 text-base font-black tabular-nums text-gold"
          >
            {t("ide.result.xp", { n: xp })}
          </m.span>
        )}
      </div>

      {!r.ok && r.sample && (r.sample.expected !== undefined || r.sample.got !== undefined || r.sample.input) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {(
            [
              ["ide.result.input", r.sample.input],
              ["ide.result.expected", r.sample.expected],
              ["ide.result.got", r.sample.got],
            ] as const
          ).map(([key, val]) =>
            val === undefined ? null : (
              <div key={key} className="min-w-0 rounded-xl bg-surface px-3 py-2">
                <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{t(key)}</dt>
                <dd className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono">{val === "" ? " " : val}</dd>
              </div>
            ),
          )}
        </dl>
      )}

      {r.ok && (
        <div className="mt-3">
          {next ? (
            <ButtonLink href={next.href} variant="success" block icon={<ArrowRight size={20} />}>
              {t("ide.result.next")}
            </ButtonLink>
          ) : (
            <ButtonLink href={listHref} variant="success" block icon={<ListChecks size={20} />}>
              {t("ide.result.toList")}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
});
