"use client";

import { CheckCircle2, DatabaseBackup, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { cleanBackup } from "@/components/goals/backup";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dataFromHash, previewBackup, unpackData, type BackupPreview } from "@/lib/share-link";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { useHash } from "./useHash";

type Loaded = { key: string; status: "ok"; data: Record<string, unknown>; preview: BackupPreview } | { key: string; status: "bad" };

/** Публичная страница: данные из ссылки (фрагмент «#d=…») → экран подтверждения → importProgress. */
export function RestoreView() {
  const { t } = useT();
  const hash = useHash();
  const packed = dataFromHash(hash);
  const importProgress = useApp((s) => s.importProgress);
  const xp = useApp((s) => s.xp);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (!packed) return;
    let alive = true;
    void unpackData(packed).then((raw) => {
      if (!alive) return;
      const data = cleanBackup(raw);
      setLoaded(data ? { key: packed, status: "ok", data, preview: previewBackup(data) } : { key: packed, status: "bad" });
    });
    return () => {
      alive = false;
    };
  }, [packed]);

  const current = loaded && loaded.key === packed ? loaded : null;
  const hasProgress = () => {
    const s = useApp.getState();
    // Без проверки onboarded: открытые уроки (/lesson) дают XP и до онбординга — его тоже нельзя затереть молча.
    return s.xp > 0 || Object.keys(s.lessons).length > 0 || s.notebook.notes.length > 0 || s.exams.length > 0;
  };

  const restore = () => {
    if (!current || current.status !== "ok") return;
    const ok = importProgress(current.data);
    setConfirm(false);
    setState(ok ? "done" : "failed");
  };
  const start = () => {
    if (hasProgress()) setConfirm(true);
    else restore();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood={state === "done" ? "happy" : "thinking"} size={88} />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <DatabaseBackup size={24} aria-hidden className="text-primary" />
          {t("links.restore.title")}
        </h1>
      </div>

      {!packed && <Message>{t("links.restore.empty")}</Message>}
      {packed && !current && <p className="text-center font-semibold text-muted">{t("links.restore.reading")}</p>}
      {current?.status === "bad" && <Message>{t("links.restore.bad")}</Message>}

      {current?.status === "ok" && state !== "done" && (
        <Card>
          <p className="font-extrabold">{t("links.restore.lead")}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
            <Stat label={t("links.restore.name")} value={current.preview.name || t("links.restore.anon")} wide />
            <Stat label={t("links.restore.xp")} value={String(current.preview.xp)} />
            <Stat label={t("links.restore.lessons")} value={String(current.preview.lessons)} />
            <Stat label={t("links.restore.notes")} value={String(current.preview.notes)} />
          </dl>
          <p className="mt-3 text-sm font-semibold text-muted">{t("links.restore.noImages")}</p>
          {state === "failed" && (
            <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
              {t("links.restore.failed")}
            </p>
          )}
          <Button className="mt-4" block onClick={start}>
            {t("links.restore.do")}
          </Button>
        </Card>
      )}

      {state === "done" && (
        <Card className="flex flex-col gap-3 text-center">
          <p role="status" className="flex items-center justify-center gap-2 text-lg font-extrabold text-success-strong">
            <CheckCircle2 size={22} aria-hidden />
            {t("links.restore.done")}
          </p>
          <ButtonLink href="/" block variant="success">
            {t("links.restore.go")}
          </ButtonLink>
        </Card>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} label={t("links.restore.do")}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-lg font-extrabold">{t("links.restore.replace.q", { xp })}</p>
          <Button variant="danger" block onClick={restore}>
            {t("links.restore.replace")}
          </Button>
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function Message({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 font-bold">
      <TriangleAlert size={20} aria-hidden className="mt-0.5 shrink-0 text-warning-strong" />
      {children}
    </p>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-surface-2 p-3", wide && "col-span-2")}>
      <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-xl font-extrabold">{value}</dd>
    </div>
  );
}
