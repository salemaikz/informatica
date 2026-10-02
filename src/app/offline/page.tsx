"use client";

import { BookOpen, Calculator, Dumbbell, Gamepad2, NotebookPen, WifiOff } from "lucide-react";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";

const WORKS = [
  { key: "offline.works.lessons", Icon: BookOpen },
  { key: "offline.works.practice", Icon: Dumbbell },
  { key: "offline.works.games", Icon: Gamepad2 },
  { key: "offline.works.notes", Icon: NotebookPen },
  { key: "offline.works.scratch", Icon: Calculator },
] as const;

/** Публичная страница: показывается сервис-воркером, когда страницы нет ни в сети, ни в кэше. */
export default function OfflinePage() {
  const { t } = useT();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood="thinking" size={96} />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <WifiOff size={24} aria-hidden className="text-warning" />
          {t("offline.title")}
        </h1>
        <p className="text-muted">{t("offline.lead")}</p>
      </div>
      <Card>
        <h2 className="mb-3 font-extrabold">{t("offline.works")}</h2>
        <ul className="flex flex-col gap-2.5">
          {WORKS.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-3 font-bold">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                <Icon size={18} aria-hidden />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{t("offline.aiOff")}</p>
      </Card>
      <div className="flex flex-col gap-3">
        <Button size="lg" block onClick={() => window.location.reload()}>
          {t("offline.retry")}
        </Button>
        <ButtonLink href="/learn" variant="secondary" block>
          {t("offline.home")}
        </ButtonLink>
      </div>
    </main>
  );
}
