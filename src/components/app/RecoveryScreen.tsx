"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { Lang } from "@/lib/types";
import { discardSaved, rawForDownload } from "@/lib/safe-storage";
import { guessLang } from "@/lib/recovery";
import { downloadBlob } from "@/components/goals/backup";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DictKey } from "@/i18n/dict";
import { translate } from "@/i18n/useT";

/**
 * Экран восстановления: сохранённый прогресс не открылся (битые данные) или не открылся за 4 секунды.
 * Ничего не стирается без решения ученика: копию можно скачать, потом начать заново или попробовать ещё раз.
 */
export function RecoveryScreen({ onRetry }: { onRetry: () => void }) {
  const [lang] = useState<Lang>(() => guessLang(rawForDownload(), typeof navigator === "undefined" ? undefined : navigator.language));
  const [noData, setNoData] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Копию в браузере сохранить не удалось (нет места): ничего не стёрто, пока ученик не скачает файл.
  const [copyFailed, setCopyFailed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  // Сохранение не прочиталось совсем (копировать нечего): честно говорим, что копии не будет.
  const [noCopy, setNoCopy] = useState(false);
  const t = (key: DictKey) => translate(lang, key);

  const download = () => {
    const raw = rawForDownload();
    setNoData(raw === null);
    if (raw !== null) {
      downloadBlob(new Blob([raw], { type: "application/json" }), "informatica-broken.json");
      setDownloaded(true);
    }
  };

  const startOver = () => {
    // Копия остаётся в informatica-v1-broken; основное сохранение очищается, страница грузится с нуля.
    // Не вышло положить копию — ничего не стираем и не перезагружаем (скачанный файл — тоже копия, тогда можно).
    if (discardSaved({ downloaded })) {
      window.location.reload();
      return;
    }
    setConfirm(false);
    setCopyFailed(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Mascot mood="sad" size={96} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">{t("storage.recover.title")}</h1>
        <p className="text-sm font-semibold text-muted">{t("storage.recover.text")}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button block size="lg" icon={<Download size={20} />} onClick={download}>
          {t("storage.recover.download")}
        </Button>
        <Button block variant="secondary" icon={<RefreshCw size={18} />} onClick={onRetry}>
          {t("storage.recover.retry")}
        </Button>
        <Button
          block
          variant="ghost"
          className="text-danger"
          onClick={() => {
            setNoCopy(rawForDownload() === null);
            setConfirm(true);
          }}
        >
          {t("storage.recover.reset")}
        </Button>
      </div>
      {noData && (
        <p role="status" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
          {t("storage.recover.noData")}
        </p>
      )}
      {copyFailed && (
        <div role="alert" className="flex w-full flex-col gap-3 rounded-2xl bg-danger-soft p-4">
          <p className="text-sm font-bold text-danger">{t("storage.recover.copyFailed")}</p>
          <Button block variant="secondary" icon={<Download size={18} />} onClick={download}>
            {t("storage.recover.download")}
          </Button>
        </div>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} label={t("storage.recover.reset")} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-lg font-extrabold">{t(noCopy || copyFailed ? "storage.recover.confirmNoCopy" : "storage.recover.confirm")}</p>
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
