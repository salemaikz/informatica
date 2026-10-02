"use client";

import { Image as ImageIcon, Swords } from "lucide-react";
import { useState } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cleanName } from "@/lib/challenge";
import { cardFileName, pickCardTopics, renderShareCard, shareOrDownloadCard, type CardTopic } from "@/lib/share-card";
import type { ExamKind } from "@/lib/exam";
import { useApp } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { examLink } from "./logic";

type Status = "idle" | "busy" | "shared" | "downloaded" | "failed";
type LinkState = { url: string; how: "shared" | "copied" | "manual" } | null;

/** Итоги пробника: «Поделиться результатом» (картинка) и «Вызвать друга» (ссылка на тот же вариант с моим результатом). */
export function ShareActions({
  kind,
  seed,
  topics,
  points,
  max,
  topicRows,
}: {
  kind: ExamKind;
  seed: number;
  topics: EntTopicId[];
  points: number;
  max: number;
  topicRows: CardTopic[];
}) {
  const { t, lang } = useT();
  const name = useApp((s) => s.profile.name);
  const [status, setStatus] = useState<Status>("idle");
  const [link, setLink] = useState<LinkState>(null);

  const shareImage = async () => {
    if (status === "busy") return;
    setStatus("busy");
    try {
      const blob = await renderShareCard({
        points,
        max,
        kindLabel: t(`exam.mode.${kind}` as DictKey),
        ofLabel: t("exam.of", { max }),
        // По-казахски «19 ішінен 14»: подпись идёт перед баллом.
        ofFirst: lang === "kk",
        topicsTitle: t("share.card.topics"),
        topics: pickCardTopics(topicRows),
        siteName: t("share.card.siteName"),
        siteUrl: window.location.host,
      });
      const res = await shareOrDownloadCard(blob, cardFileName(kind, points, max), t(`exam.mode.${kind}` as DictKey));
      setStatus(res === "cancelled" ? "idle" : res);
    } catch {
      setStatus("failed");
    }
  };

  const challenge = async () => {
    // Без имени в профиле — анонимный вызов: у друга будет «У друга: 14 из 19».
    const who = cleanName(name);
    const url = `${window.location.origin}${examLink(kind, seed, topics, { n: who, s: points, m: max })}`;
    const text = t(who ? "share.challenge.banner" : "share.challenge.bannerAnon", { name: who, points, max });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t(`exam.mode.${kind}` as DictKey), text, url });
        setLink({ url, how: "shared" });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setLink({ url, how: "copied" });
    } catch {
      setLink({ url, how: "manual" });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" block disabled={status === "busy"} icon={<ImageIcon size={18} aria-hidden />} onClick={shareImage}>
          {status === "busy" ? t("share.result.preparing") : t("share.result.share")}
        </Button>
        <Button variant="secondary" block icon={<Swords size={18} aria-hidden />} onClick={challenge}>
          {t("share.challenge.button")}
        </Button>
      </div>
      <div role="status" className="flex flex-col gap-1.5">
        {status === "shared" && <p className="text-sm font-extrabold text-success-strong">{t("share.result.shared")}</p>}
        {status === "downloaded" && <p className="text-sm font-extrabold text-success-strong">{t("share.result.downloaded")}</p>}
        {status === "failed" && <p className="text-sm font-extrabold text-danger">{t("share.result.failed")}</p>}
        {link && (
          <>
            <p className="text-sm font-extrabold text-success-strong">{t(`exam.share.${link.how}` as DictKey)}</p>
            <input
              readOnly
              value={link.url}
              aria-label={t("share.challenge.button")}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 w-full rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-xs"
            />
          </>
        )}
        {!link && <p className="text-xs font-semibold text-muted">{t("share.challenge.hint")}</p>}
      </div>
    </div>
  );
}
