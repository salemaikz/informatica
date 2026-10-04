"use client";

import { ArrowLeft, House } from "lucide-react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useT } from "@/i18n/useT";

/** Адреса нет (или страница вызвала notFound()). Язык — из профиля, как у остального интерфейса. */
export default function NotFound() {
  const { t } = useT();
  const router = useRouter();

  // Открыли ссылку в новой вкладке — назад идти некуда, ведём на главную.
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood="thinking" size={96} />
        <p className="font-mono text-sm font-extrabold text-muted" aria-hidden>
          404
        </p>
        <h1 className="text-2xl font-extrabold">{t("errors.notFound.title")}</h1>
        <p className="text-muted">{t("errors.notFound.text")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/" size="lg" block icon={<House size={20} aria-hidden />}>
          {t("errors.home")}
        </ButtonLink>
        <Button variant="secondary" size="lg" block icon={<ArrowLeft size={20} aria-hidden />} onClick={back}>
          {t("errors.back")}
        </Button>
      </div>
    </main>
  );
}
