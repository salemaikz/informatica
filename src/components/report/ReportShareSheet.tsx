"use client";

import { ChevronRight, ExternalLink, Users } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { translate, useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { linkFits, packData, reportLink, selfViewLink } from "@/lib/hash-pack";
import { buildParentReport } from "@/lib/parent-report";
import { entVisible } from "@/lib/school";
import { useApp } from "@/lib/store";
import type { Lang } from "@/lib/types";
import { Segmented, Switch } from "@/components/goals/controls";
import { ShareTargets } from "@/components/share/ShareTargets";
import { Button, buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type LinkState = { kind: "making" } | { kind: "ready"; url: string } | { kind: "failed" };

/**
 * Вход в профиле: строка «Отчёт для родителей» и окно со ссылкой (#74).
 * Имя в отчёт попадает только если включить переключатель (по умолчанию выключен); язык отчёта — язык ученика.
 * Ссылку собираем в обработчиках (открытие, переключатели), а не в эффекте.
 */
export function ReportEntry({ className }: { className?: string }) {
  const { t } = useT();
  const hasName = useApp((s) => s.profile.name.trim().length > 0);
  const studentLang = useApp((s) => s.profile.lang);
  const isEnt = useApp((s) => entVisible(s.profile));
  const [open, setOpen] = useState(false);
  const [withName, setWithName] = useState(false);
  const [lang, setLang] = useState<Lang>(studentLang);
  const [link, setLink] = useState<LinkState>({ kind: "making" });
  const seq = useRef(0);

  const rebuild = (name: boolean, l: Lang) => {
    const id = ++seq.current;
    setLink({ kind: "making" });
    const s = useApp.getState();
    void packData(buildParentReport(s, Date.now(), { withName: name, lang: l }))
      .then((packed) => {
        if (id !== seq.current) return;
        const url = reportLink(window.location.origin, packed);
        setLink(linkFits(url) ? { kind: "ready", url } : { kind: "failed" });
      })
      .catch(() => {
        if (id === seq.current) setLink({ kind: "failed" });
      });
  };

  const show = () => {
    // Каждый раз — с выключенным именем и языком ученика: имя не «залипает» между открытиями.
    const l = useApp.getState().profile.lang;
    setWithName(false);
    setLang(l);
    setOpen(true);
    rebuild(false, l);
  };
  const close = useCallback(() => {
    seq.current++;
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-3xl border-2 border-border bg-surface px-4 py-2 text-left transition-colors hover:bg-surface-2",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Users size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-tight">{t("report.entry.title")}</span>
          <span className="block text-sm font-semibold text-muted">{t("report.entry.hint")}</span>
        </span>
        <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
      </button>

      <Modal open={open} onClose={close} label={t("report.entry.title")}>
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold">{t("report.entry.title")}</h2>
          <p className="font-semibold text-muted">{t(isEnt ? "report.share.lead.ent" : "report.share.lead.school")}</p>

          {hasName && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-extrabold">{t("report.share.name")}</p>
                <p className="text-sm font-semibold text-muted">{t("report.share.name.hint")}</p>
              </div>
              <Switch
                checked={withName}
                label={t("report.share.name")}
                onChange={(v) => {
                  setWithName(v);
                  rebuild(v, lang);
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="font-extrabold">{t("report.share.lang")}</p>
            <Segmented<Lang>
              label={t("report.share.lang")}
              value={lang}
              onChange={(l) => {
                setLang(l);
                rebuild(withName, l);
              }}
              options={[
                { id: "kk", label: "Қазақша" },
                { id: "ru", label: "Русский" },
              ]}
            />
          </div>

          <p className="rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold">{t("report.share.warn")}</p>

          {link.kind === "making" && (
            <p role="status" className="py-2 text-center font-bold text-muted">
              {t("report.share.making")}
            </p>
          )}
          {link.kind === "failed" && (
            <div role="alert" className="flex flex-col gap-2 text-center">
              <p className="font-bold text-danger">{t("report.share.failed")}</p>
              <Button variant="secondary" block onClick={() => rebuild(withName, lang)}>
                {t("report.share.retry")}
              </Button>
            </div>
          )}
          {link.kind === "ready" && (
            <>
              <a href={selfViewLink(link.url)} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "primary", block: true })}>
                <ExternalLink size={18} aria-hidden />
                {t("report.share.view")}
              </a>
              <ShareTargets url={link.url} title={translate(lang, "report.entry.title")} text={translate(lang, "report.share.text")} what="report" />
            </>
          )}

          <Button variant="ghost" block onClick={close}>
            {t("common.close")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
