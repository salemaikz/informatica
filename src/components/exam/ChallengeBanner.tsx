"use client";

import { Trophy } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { compareWithChallenge, samePool, type Challenge } from "@/lib/challenge";

/**
 * Баннер перед стартом (#73): «У друга: 14 из 19. Сможешь больше?» Без имени.
 * `maxPoints` — максимум собранного варианта, `currentPool` — тег текущего банка (`currentPoolTag`, считает ExamRun:
 * банк там уже загружен — сюда его не тянем, чтобы страница итогов не грузила банк). Другие — сравним по доле.
 * У друга максимум — «Сможешь так же?», а не «больше»: больше максимума не бывает.
 */
export function ChallengeBanner({ challenge, maxPoints, currentPool }: { challenge: Challenge; maxPoints: number; currentPool: string }) {
  const { t } = useT();
  const other = !samePool(challenge.pool, currentPool) || challenge.m !== maxPoints;
  return (
    <div role="note" data-testid="challenge-banner" className="flex items-start gap-3 rounded-2xl border-2 border-gold/50 bg-gold-soft p-3.5">
      <Trophy size={24} className="mt-0.5 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex flex-col gap-1">
        <p className="break-words font-extrabold">{t(challenge.s >= challenge.m ? "challenge.bannerMax" : "challenge.banner", { points: challenge.s, max: challenge.m })}</p>
        {other && <p className="text-sm font-semibold text-muted">{t("challenge.bannerOther")}</p>}
      </div>
    </div>
  );
}

/** После итогов: больше — достижение (gold), столько же и меньше — нейтрально, это не ошибка. */
export function ChallengeCompare({ challenge, points, max, pool }: { challenge: Challenge; points: number; max: number; pool: string | undefined }) {
  const { t } = useT();
  const cmp = compareWithChallenge(points, max, challenge, pool);
  const more = cmp.outcome === "more";
  const diff = cmp.samePaper ? String(Math.abs(cmp.diff)) : `${Math.abs(cmp.diff)}%`;
  return (
    <div
      className={cn("flex flex-col gap-1 rounded-2xl border-2 p-3.5", more ? "border-gold/60 bg-gold-soft" : "border-border bg-surface-2")}
      data-testid="challenge-compare"
      data-outcome={cmp.outcome}
    >
      <p className="flex items-center gap-2 text-sm font-extrabold text-muted">
        <Trophy size={16} className={more ? "text-gold" : "text-muted"} aria-hidden /> {t("challenge.title")}
        {!cmp.samePaper && <span className="font-bold">· {t("challenge.byShare")}</span>}
      </p>
      <p className="break-words text-lg font-black">{t(`challenge.${cmp.outcome}`, { diff })}</p>
      <p className="break-words text-sm font-bold text-muted">
        {t("challenge.detail", {
          theirs: t("challenge.score", { points: challenge.s, max: challenge.m }),
          mine: t("challenge.score", { points, max }),
        })}
      </p>
      {!cmp.samePaper && <p className="text-xs font-semibold text-muted">{t("challenge.otherPaper")}</p>}
    </div>
  );
}
