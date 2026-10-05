"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { track, type BreakReason } from "@/lib/analytics";
import { analyticsEnabledOnServer, BREAK_ASKED_KEY, lastStudyDay, shouldAskBreak } from "@/lib/analytics-client";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/components/economy/useEconomy";

// ---------- «Спросили за этот перерыв»: последний день занятий, при котором уже спрашивали (localStorage) ----------

const listeners = new Set<() => void>();
let askedCache: string | null | undefined;

function readAsked(): string | null {
  if (askedCache !== undefined) return askedCache;
  try {
    askedCache = window.localStorage.getItem(BREAK_ASKED_KEY);
  } catch {
    askedCache = null;
  }
  return askedCache;
}

function markAsked(lastDay: string) {
  askedCache = lastDay;
  try {
    window.localStorage.setItem(BREAK_ASKED_KEY, lastDay);
  } catch {
    // без хранилища отметка живёт, пока открыта страница
  }
  for (const l of listeners) l();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const REASONS: { code: BreakReason; key: DictKey }[] = [
  { code: "time", key: "break.time" },
  { code: "hard", key: "break.hard" },
  { code: "boring", key: "break.boring" },
  { code: "forgot", key: "break.forgot" },
  { code: "other_prep", key: "break.other_prep" },
  { code: "other", key: "break.other" },
];

/**
 * «С возвращением! Что помешало заниматься?» — после перерыва от 3 дней, один раз за перерыв (решение #69).
 * Ответ — событие break_reason (только код причины). Сбор статистики выключен (на сервере или в профиле) — карточки нет:
 * ответ некуда отправить. Монтируется оболочкой на «Учиться»; состояние «спасибо» сбрасывается вместе с размонтированием.
 */
export function BreakReasonCard() {
  const { t } = useT();
  const allowed = useApp((s) => s.profile.analytics !== false);
  const streakLast = useApp((s) => s.streak.lastDay);
  const days = useApp((s) => s.days);
  const now = useNow();
  const asked = useSyncExternalStore(subscribe, readAsked, () => "");
  const [thanks, setThanks] = useState(false);

  const last = useMemo(() => lastStudyDay(streakLast, Object.keys(days)), [streakLast, days]);

  if (!analyticsEnabledOnServer() || !allowed || !now) return null;
  const ask = shouldAskBreak(last, todayKey(new Date(now)), asked);
  if (!ask && !thanks) return null;

  if (thanks) {
    return (
      <p role="status" className="mb-4 rounded-2xl border-2 border-success/40 bg-success-soft px-4 py-3 text-sm font-extrabold text-success-strong animate-fade-in">
        {t("break.thanks")}
      </p>
    );
  }

  const answer = (code: BreakReason) => {
    if (!last) return;
    track({ e: "break_reason", code });
    markAsked(last);
    setThanks(true);
    window.setTimeout(() => setThanks(false), 3000);
  };
  const skip = () => {
    if (last) markAsked(last);
  };

  return (
    <section aria-labelledby="break-title" className="mb-4 rounded-3xl border-2 border-border bg-surface p-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Mascot mood="happy" size={44} className="shrink-0" />
        <div className="min-w-0">
          <h2 id="break-title" className="text-lg font-extrabold leading-tight">
            {t("break.title")}
          </h2>
          <p className="text-sm font-semibold text-muted">{t("break.ask")}</p>
        </div>
      </div>
      <div role="group" aria-label={t("break.group")} className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => answer(r.code)}
            className="min-h-11 rounded-full border-2 border-border bg-surface px-4 text-sm font-extrabold text-text transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t(r.key)}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={skip}>
        {t("break.skip")}
      </Button>
    </section>
  );
}
