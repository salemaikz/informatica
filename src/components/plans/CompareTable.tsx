"use client";

import { Check, Crown, Minus } from "lucide-react";
import { AI_DAILY_CAP, AI_UNITS, type PlanTier } from "@/lib/economy";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { compareRows, type CellValue } from "./plans-helpers";

const COLS: PlanTier[] = ["free", "lite", "unlimited"];

function Cell({ value, tier }: { value: CellValue; tier: PlanTier }) {
  const { t } = useT();
  if (value.kind === "check") {
    return (
      <span className="inline-flex" role="img" aria-label={t("plans.cmp.yes")}>
        <Check size={20} strokeWidth={3.2} className="text-success" />
      </span>
    );
  }
  if (value.kind === "dash") {
    return (
      <span className="inline-flex" role="img" aria-label={t("plans.cmp.no")}>
        <Minus size={18} strokeWidth={3} className="text-muted" />
      </span>
    );
  }
  const unlimited = value.text === "∞";
  return (
    <span
      className={cn("font-extrabold leading-none", unlimited ? "text-2xl" : "text-[15px]", tier === "unlimited" ? "text-warning-strong" : tier === "lite" ? "text-text" : "text-muted")}
    >
      <span aria-hidden={unlimited || undefined}>{value.text}</span>
      {unlimited && <span className="sr-only">{t("plans.cmp.unlimited")}</span>}
    </span>
  );
}

/** Таблица «Бесплатно / Лайт / Безлимит». Колонка «Безлимит» подсвечена золотом. */
export function CompareTable() {
  const { t, lang } = useT();
  const rows = compareRows(lang);
  const head = (tier: PlanTier) => (tier === "free" ? t("plans.cmp.free") : t(tier === "lite" ? "plans.tier.lite" : "plans.tier.unlimited"));

  return (
    <section className="flex flex-col gap-3" aria-labelledby="plans-compare">
      <h2 id="plans-compare" className="text-xl font-extrabold">
        {t("plans.cmp.title")}
      </h2>
      <div className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-[4.6rem]" />
            <col className="w-[4.6rem]" />
            <col className="w-[4.6rem]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                {t("plans.cmp.title")}
              </th>
              {COLS.map((tier) => (
                <th
                  key={tier}
                  scope="col"
                  className={cn(
                    "px-0.5 pb-2.5 pt-3 text-center text-[11px] font-extrabold uppercase leading-tight tracking-wide",
                    tier === "unlimited" ? "bg-gold-soft text-warning-strong" : tier === "lite" ? "text-text" : "text-muted",
                  )}
                >
                  {tier === "unlimited" && <Crown size={14} fill="currentColor" className="mx-auto mb-0.5 text-gold" />}
                  {head(tier)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <th scope="row" className="py-3 pl-3.5 pr-2 text-left text-[13px] font-bold leading-snug">
                  {t(row.label)}
                </th>
                {COLS.map((tier) => (
                  <td key={tier} className={cn("px-0.5 py-3 text-center align-middle", tier === "unlimited" && "bg-gold-soft")}>
                    <Cell value={row.cells[tier]} tier={tier} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-sm font-semibold text-muted">{t("plans.cmp.note", { free: AI_DAILY_CAP.free, lite: AI_DAILY_CAP.lite, photo: AI_UNITS.photo, voice: AI_UNITS.voice })}</p>
    </section>
  );
}
