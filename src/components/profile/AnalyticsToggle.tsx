"use client";

import { analyticsEnabledOnServer } from "@/lib/analytics-client";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Row, Segmented } from "@/components/goals/controls";
import { Card } from "@/components/ui/Card";

/**
 * Выключатель обезличенной статистики (решение #69): «Помогать улучшать Informatica».
 * Показывается, только если сбор включён на сервере (NEXT_PUBLIC_ANALYTICS=1): иначе включать нечего.
 * Вставляется в «Профиль» карточкой рядом с остальными настройками.
 */
export function AnalyticsToggle() {
  const { t } = useT();
  const on = useApp((s) => s.profile.analytics !== false);
  const update = useApp((s) => s.updateProfile);
  if (!analyticsEnabledOnServer()) return null;
  return (
    <Card className="py-1">
      <Row label={t("privacy.analytics.title")} hint={t("privacy.analytics.hint")}>
        <Segmented<string>
          label={t("privacy.analytics.title")}
          value={on ? "on" : "off"}
          onChange={(v) => update({ analytics: v === "on" })}
          options={[
            { id: "on", label: t("common.on") },
            { id: "off", label: t("common.off") },
          ]}
        />
      </Row>
    </Card>
  );
}
