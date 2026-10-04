"use client";

import { GraduationCap, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotSays } from "@/components/mascot/Mascot";
import { useEntVisible } from "./useEntVisible";

/**
 * Страж разделов «только для подготовки к ЕНТ» (/exam, /plan, /exam/run). Трек ЕНТ — показывает страницу как есть;
 * школьный трек — карточку с выходом: переключиться на ЕНТ (трек меняет действие стора, страница тут же открывается)
 * или вернуться к школьной программе. Не 404 и не пустой экран.
 * `fullscreen` — для маршрутов вне оболочки приложения (`/exam/run`): карточка в спокойном каркасе на весь экран.
 */
export function EntOnly({ children, fullscreen = false }: { children: ReactNode; fullscreen?: boolean }) {
  const ent = useEntVisible();
  if (ent) return <>{children}</>;
  if (fullscreen) {
    return (
      <div className="min-h-dvh bg-bg">
        <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <EntOnlyNotice />
        </div>
      </div>
    );
  }
  return <EntOnlyNotice />;
}

export function EntOnlyNotice() {
  const { t } = useT();
  const updateProfile = useApp((s) => s.updateProfile);
  return (
    <Card className="flex flex-col gap-4">
      <MascotSays mood="thinking" size={64}>
        <span role="heading" aria-level={1} className="block text-lg font-extrabold leading-tight">
          {t("school.entOnly.title")}
        </span>
        <span className="mt-1 block text-sm font-semibold text-muted">{t("school.entOnly.text")}</span>
      </MascotSays>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" block icon={<Target size={18} aria-hidden />} onClick={() => updateProfile({ track: "ent" })}>
          {t("school.entOnly.switch")}
        </Button>
        <ButtonLink href="/learn" variant="secondary" block icon={<GraduationCap size={18} aria-hidden />}>
          {t("school.entOnly.back")}
        </ButtonLink>
      </div>
    </Card>
  );
}
