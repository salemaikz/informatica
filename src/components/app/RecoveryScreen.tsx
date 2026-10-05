"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Lang } from "@/lib/types";
import { discardSaved, peekSaved } from "@/lib/safe-storage";
import { guessLang } from "@/lib/recovery";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DictKey } from "@/i18n/dict";
import { translate } from "@/i18n/useT";

/**
 * Экран восстановления: сохранённый прогресс не открылся (битые данные) или не открылся за 4 секунды.
 * Ничего не стирается без решения ученика: можно попробовать ещё раз или (после подтверждения) начать заново.
 */
export function RecoveryScreen({ onRetry }: { onRetry: () => void }) {
  const [lang] = useState<Lang>(() => guessLang(peekSaved(), typeof navigator === "undefined" ? undefined : navigator.language));
  const [confirm, setConfirm] = useState(false);
  const t = (key: DictKey) => translate(lang, key);

  const startOver = () => {
    // Сохранение удаляется, страница грузится с нуля.
    discardSaved();
    window.location.reload();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Mascot mood="thinking" size={96} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">{t("storage.recover.title")}</h1>
        <p className="text-sm font-semibold text-muted">{t("storage.recover.text")}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button block size="lg" icon={<RefreshCw size={20} />} onClick={onRetry}>
          {t("storage.recover.retry")}
        </Button>
        <Button block variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
          {t("storage.recover.reset")}
        </Button>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} label={t("storage.recover.reset")} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-lg font-extrabold">{t("storage.recover.confirm")}</p>
          <Button variant="danger" block onClick={startOver}>
            {t("storage.recover.reset")}
          </Button>
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
