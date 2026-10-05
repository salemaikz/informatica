"use client";

import { Gift } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LevelCase } from "./LevelCase";

/**
 * Карточка «Кейс за уровень N ждёт»: неоткрытый кейс (ушёл со страницы или нажал «Позже») — на главной и в профиле.
 * Нет неоткрытых кейсов — ничего не рисует. Открывает самый ранний.
 */
export function CaseWaiting({ className }: { className?: string }) {
  const { t } = useT();
  const pending = useApp((s) => s.pendingCases);
  const [opened, setOpened] = useState<number | null>(null);
  const level = pending[0];
  // Открытый кейс остаётся в дереве, пока ученик не закроет окно с призом (после выдачи его уже нет в очереди).
  const shown = opened !== null ? <LevelCase key={opened} level={opened} onClose={() => setOpened(null)} /> : null;
  if (level === undefined) return shown;
  return (
    <>
      <Card className={cn("flex items-center gap-3 border-gold/60 bg-gold-soft", className)} appear>
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-gold bg-surface text-warning-strong">
          <Gift size={26} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">{t("case.waiting.title", { n: level })}</p>
          <p className="text-sm font-semibold text-muted">{pending.length > 1 ? t("case.waiting.more", { n: pending.length - 1 }) : t("case.waiting.text")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpened(level)}>
          {t("case.open")}
        </Button>
      </Card>
      {shown}
    </>
  );
}
