"use client";

import { FileText, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { buildReport } from "@/lib/report";
import { buildBackupData, buildLink, linkFit, notesWithImages, packData, type LinkFit } from "@/lib/share-link";
import { useT } from "@/i18n/useT";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LinkBox } from "./LinkBox";

type Made = { link: string; path: string; fit: LinkFit; images: number } | null;

/** Раздел профиля: «Ссылка для переноса» и «Отчёт для родителей». */
export function LinkTools() {
  const { t } = useT();
  const [transfer, setTransfer] = useState<Made>(null);
  const [report, setReport] = useState<Made>(null);
  const [busy, setBusy] = useState<"transfer" | "report" | null>(null);
  const [error, setError] = useState(false);

  const make = async (kind: "transfer" | "report") => {
    setBusy(kind);
    setError(false);
    try {
      const state = useApp.getState();
      if (kind === "transfer") {
        const link = buildLink(window.location.origin, "/restore", await packData(buildBackupData(state)));
        setTransfer({ link, path: link.slice(window.location.origin.length), fit: linkFit(link), images: notesWithImages(state) });
      } else {
        const link = buildLink(window.location.origin, "/report", await packData(buildReport(state, Date.now())));
        setReport({ link, path: link.slice(window.location.origin.length), fit: linkFit(link), images: 0 });
      }
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card id="transfer-link">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Link2 size={20} aria-hidden className="text-primary" />
          {t("links.transfer.title")}
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted">{t("links.transfer.desc")}</p>
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-text">
          {transfer && transfer.images > 0 ? t("links.transfer.noImages", { n: transfer.images }) : t("links.transfer.noImages.generic")}
        </p>
        <Button className="mt-3" variant="secondary" disabled={busy !== null} onClick={() => void make("transfer")} icon={<Link2 size={18} />}>
          {busy === "transfer" ? t("links.making") : t("links.transfer.make")}
        </Button>
        {transfer?.fit === "toobig" && (
          <p role="status" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
            {t("links.transfer.tooBig", { n: transfer.link.length })}
          </p>
        )}
        {transfer && transfer.fit !== "toobig" && (
          <>
            <p className="mt-3 text-sm font-bold text-muted">{t("links.transfer.warn")}</p>
            <LinkBox key={transfer.link} link={transfer.link} qr={transfer.fit === "ok"} title={t("links.transfer.title")} />
            {transfer.fit === "noqr" && <p className="mt-2 text-sm font-semibold text-muted">{t("links.transfer.noQr")}</p>}
          </>
        )}
      </Card>

      <Card id="parent-report">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <FileText size={20} aria-hidden className="text-primary" />
          {t("links.report.title")}
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted">{t("links.report.desc")}</p>
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-text">{t("links.report.warn")}</p>
        <Button className="mt-3" variant="secondary" disabled={busy !== null} onClick={() => void make("report")} icon={<FileText size={18} />}>
          {busy === "report" ? t("links.making") : t("links.report.make")}
        </Button>
        {report && (
          <>
            <LinkBox key={report.link} link={report.link} title={t("links.report.title")} />
            {/* Обычная ссылка: страница читает фрагмент адреса при загрузке. */}
            <a className={cn(buttonClass({ variant: "ghost", block: true }), "mt-3")} href={report.path}>
              {t("links.report.preview")}
            </a>
          </>
        )}
      </Card>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {t("links.make.failed")}
        </p>
      )}
    </>
  );
}
