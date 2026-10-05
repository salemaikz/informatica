"use client";

import { Check, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** «Показать подсказки снова» (#104): сбрасывает проводник первого входа и карточки страниц. */
export function TipsReset() {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Lightbulb size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">{t("tour.reset")}</p>
          <p className="text-sm font-semibold text-muted">{t("tour.reset.desc")}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        block
        disabled={done}
        icon={done ? <Check size={18} aria-hidden /> : undefined}
        onClick={() => {
          useApp.getState().resetTips();
          setDone(true);
        }}
      >
        {done ? t("tour.reset.done") : t("tour.reset")}
      </Button>
      <span role="status" className="sr-only">
        {done ? t("tour.reset.done") : ""}
      </span>
    </Card>
  );
}
