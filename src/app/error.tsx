"use client";

import { RotateCcw, House } from "lucide-react";
import { useEffect } from "react";
import { normalizeError, reportClientError } from "@/lib/client-errors";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useT } from "@/i18n/useT";

/** Ошибка при показе страницы. Уходит в сбор ошибок (только production), ученику — «Попробовать ещё раз». */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t, lang } = useT();

  useEffect(() => {
    reportClientError(normalizeError(error), lang);
  }, [error, lang]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood="sad" size={96} />
        <h1 className="text-2xl font-extrabold">{t("errors.crash.title")}</h1>
        <p className="text-muted">{t("errors.crash.text")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Button size="lg" block icon={<RotateCcw size={20} aria-hidden />} onClick={() => retry()}>
          {t("errors.retry")}
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg" block icon={<House size={20} aria-hidden />}>
          {t("errors.home")}
        </ButtonLink>
      </div>
    </main>
  );
}
