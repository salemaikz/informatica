"use client";

import { Trophy } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { compareWithChallenge, type Challenge } from "@/lib/challenge";

/** Баннер перед стартом: «У Айжан: 14 из 19. Попробуешь больше?» (имя — текст из ссылки, рендерится как текст). */
export function ChallengeBanner({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const params = { name: challenge.n, points: challenge.s, max: challenge.m };
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border-2 border-gold/50 bg-gold-soft p-3.5">
      <Trophy size={24} className="mt-0.5 shrink-0 text-gold" aria-hidden />
      <p className="min-w-0 break-words font-extrabold">{t(challenge.n ? "share.challenge.banner" : "share.challenge.bannerAnon", params)}</p>
    </div>
  );
}

const TONE = {
  more: { box: "border-success/40 bg-success-soft", text: "text-success-strong" },
  same: { box: "border-warning/40 bg-warning-soft", text: "text-warning-strong" },
  less: { box: "border-danger/40 bg-danger-soft", text: "text-danger" },
} as const;

/** После итогов: сравнение своего результата с вызовом. */
export function ChallengeCompare({ challenge, points, max }: { challenge: Challenge; points: number; max: number }) {
  const { t } = useT();
  const cmp = compareWithChallenge(points, max, challenge);
  const tone = TONE[cmp.outcome];
  const theirs = t("share.challenge.score", { points: challenge.s, max: challenge.m });
  const mine = t("share.challenge.score", { points, max });
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border-2 p-3.5", tone.box)} data-testid="challenge-compare">
      <p className="flex items-center gap-2 text-sm font-extrabold text-muted">
        <Trophy size={16} className="text-gold" aria-hidden /> {t("share.challenge.title")}
      </p>
      <p className={cn("text-lg font-black", tone.text)}>{t(`share.challenge.${cmp.outcome}`)}</p>
      <p className="break-words text-sm font-bold">
        {challenge.n ? t("share.challenge.detail", { name: challenge.n, theirs, mine }) : t("share.challenge.detailAnon", { theirs, mine })}
      </p>
      {!cmp.samePaper && <p className="text-xs font-semibold text-muted">{t("share.challenge.otherPaper")}</p>}
    </div>
  );
}
