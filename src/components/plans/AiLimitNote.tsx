"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { aiLimitParams } from "./plans-helpers";

/**
 * Небольшая неброская кнопка внизу окна тарифов: по нажатию раскрывает короткий текст про суточный потолок ИИ
 * (одинаковый на любом тарифе). Число и веса фото/голоса/«Разбора от Бита» — из lib/economy.ts, в словаре их нет.
 */
export function AiLimitNote({ className }: { className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Info size={16} strokeWidth={2.6} aria-hidden />
        {t("plans.limit.btn")}
      </button>
      <p id={id} hidden={!open} className="mt-1 max-w-sm animate-fade-in text-balance text-center text-sm font-semibold leading-snug text-muted">
        {t("plans.limit.text", aiLimitParams())}
      </p>
    </div>
  );
}
