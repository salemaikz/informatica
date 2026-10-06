"use client";

import { Swords, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ENTRY_COST } from "@/lib/economy";
import { shortDate } from "@/lib/date";
import { absoluteUrl } from "@/lib/share";
import { acceptChallenge, challengePath, getChallenge, recHref, type Accepted, type ChallengeView } from "@/lib/duel/challenge";
import { requestFriend, socialStateOf, type RequestStatus } from "@/lib/social/client";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { HeartCost } from "@/components/economy/HeartCost";
import { Mascot } from "@/components/mascot/Mascot";
import { ShareTargets } from "@/components/share/ShareTargets";
import { NameForm } from "@/components/social/NameForm";
import { PlayerAvatar, PlayerRow, useShowName } from "@/components/social/PlayerCard";
import { ReportPlayerButton } from "@/components/social/ReportPlayerButton";
import { LevelBadge } from "@/components/app/LevelBadge";
import { TitleTag } from "@/components/cosmetics/TitleTag";
import { ChallengePlay } from "./ChallengePlay";
import { MODE_ICON, MODE_TITLE, topicTitle } from "./mode-meta";

// Вызов на дуэль по ссылке /duel/c/<id> (этап 16Д, Ф3; docs/specs/duels.md §6, §9). Получатель видит, кто вызывает (имя после
// фильтра, уровень, рамка, титул), режим и результат; «Принять вызов» (1 сердечко в конце отсчёта) → игра против записи
// в том же экране матча. Автор вызова видит результаты друзей и снова может отправить ссылку.

type State =
  | { s: "loading" }
  | { s: "off" }
  | { s: "error" }
  | { s: "missing" }
  | { s: "view"; v: ChallengeView; note?: DictKey }
  | { s: "name"; v: ChallengeView }
  | { s: "play"; accepted: Accepted };

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const FRIEND_NOTE: Partial<Record<RequestStatus, DictKey>> = {
  sent: "social.add.sent",
  accepted: "social.add.accepted",
  already: "social.add.already",
  limit: "social.add.limit",
  not_found: "social.add.not_found",
};

export function ChallengeLanding({ id }: { id: string }) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const show = useShowName();
  const [state, setState] = useState<State>({ s: "loading" });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [friendNote, setFriendNote] = useState<DictKey | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    void getChallenge(id, ctl.signal).then((r) => {
      if (ctl.signal.aborted) return;
      if (r.ok && r.data) setState({ s: "view", v: r.data });
      else if (r.status === 404) setState({ s: "missing" });
      else setState(socialStateOf(r) === "off" ? { s: "off" } : { s: "error" });
    });
    return () => ctl.abort();
  }, [id, tick]);

  const accept = async (v: ChallengeView) => {
    if (busy) return;
    setBusy(true);
    const r = await acceptChallenge(id);
    setBusy(false);
    if (r.ok && r.data) {
      setState({ s: "play", accepted: r.data });
      return;
    }
    if (r.status === 401) setState({ s: "name", v });
    else if (r.error === "stale") setState({ s: "view", v: { ...v, stale: true } });
    else if (r.error === "already") setState({ s: "view", v: { ...v, played: true } });
    else if (r.status === 404) setState({ s: "missing" });
    else setState({ s: "view", v, note: r.status === 429 ? "social.rate" : "social.error" });
  };

  const addFriend = async (code: string) => {
    const r = await requestFriend(code);
    setFriendNote(r.ok && r.data ? (FRIEND_NOTE[r.data] ?? "social.add.sent") : r.status === 401 ? "social.name.title" : "social.error");
  };

  if (state.s === "play") return <ChallengePlay kind="ghost" id={id} accepted={state.accepted} />;

  const close = () => router.replace("/duel");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4">
        <button type="button" onClick={close} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={24} />
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))]" data-testid="duel-ch-landing">
        {state.s === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Mascot mood="thinking" size={88} />
            <p className="font-bold text-muted" role="status">
              {t("common.loading")}
            </p>
          </div>
        )}
        {(state.s === "missing" || state.s === "off" || state.s === "error") && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Mascot mood="sad" size={88} />
            <p className="max-w-sm font-bold">{t(state.s === "missing" ? "duel.ch.notFound" : state.s === "off" ? "social.off.title" : "social.down")}</p>
            {state.s === "error" && <Button onClick={() => setTick((n) => n + 1)}>{t("duel.retry")}</Button>}
            <Button variant="ghost" onClick={close}>
              {t("duel.toHub")}
            </Button>
          </div>
        )}
        {state.s === "name" && (
          <>
            <NameForm player={null} onDone={() => void accept(state.v)} onCancel={() => setState({ s: "view", v: state.v })} />
            <p className="text-center text-xs font-semibold text-muted">{t("social.device")}</p>
          </>
        )}
        {state.s === "view" && (
          <ChallengeCard
            v={state.v}
            note={state.note}
            busy={busy}
            friendNote={friendNote}
            onAccept={() => void accept(state.v)}
            onAddFriend={() => void addFriend(state.v.by.code)}
            onPlayMode={() => router.push(recHref(state.v.mode, state.v.topic))}
            title={(() => {
              const tt = state.v.topic ? topicTitle(state.v.topic) : null;
              const label = tt === "school" ? t("duel.topic.school") : tt ? l(tt) : null;
              return label ? `${t(MODE_TITLE[state.v.mode])}: ${label}` : t(MODE_TITLE[state.v.mode]);
            })()}
            name={show(state.v.by)}
            lang={lang}
          />
        )}
      </main>
    </div>
  );
}

function ChallengeCard({
  v,
  note,
  busy,
  friendNote,
  onAccept,
  onAddFriend,
  onPlayMode,
  title,
  name,
  lang,
}: {
  v: ChallengeView;
  note?: DictKey;
  busy: boolean;
  friendNote: DictKey | null;
  onAccept: () => void;
  onAddFriend: () => void;
  onPlayMode: () => void;
  title: string;
  name: string;
  lang: "ru" | "kk";
}) {
  const { t } = useT();
  const Icon = MODE_ICON[v.mode];
  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-extrabold uppercase text-muted">{v.mine ? t("duel.ch.mine") : t("duel.ch.title")}</p>
        <div className="relative">
          <PlayerAvatar card={v.by} size={72} />
        </div>
        <h1 className="max-w-full text-2xl font-black [overflow-wrap:anywhere]" data-testid="duel-ch-from">
          {v.mine ? name : t("duel.ch.from", { name })}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <LevelBadge level={v.by.lv} size="sm" />
          <TitleTag title={v.by.title} size="md" />
          {!v.mine && <ReportPlayerButton card={v.by} where="challenge" matchId={v.id} label />}
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
        <p className="flex items-center gap-2 font-extrabold">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-ink-primary">
            <Icon size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">{title}</span>
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { k: "duel.ch.points" as const, v: String(v.res.score) },
            { k: "duel.correct" as const, v: String(v.res.correct) },
            { k: "duel.time" as const, v: fmtTime(v.res.timeMs) },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-surface-2 px-2 py-2">
              <p className="font-mono text-xl font-black tabular-nums" data-testid={x.k === "duel.ch.points" ? "duel-ch-score" : undefined}>
                {x.v}
              </p>
              <p className="text-xs font-extrabold text-muted">{t(x.k)}</p>
            </div>
          ))}
        </div>
        {!v.mine && !v.stale && !v.played && <p className="text-center text-sm font-extrabold text-ink-primary">{t("duel.ch.beat")}</p>}
      </section>

      {note && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-ink-danger">
          {t(note)}
        </p>
      )}

      {v.mine ? (
        <MyChallenge v={v} title={title} lang={lang} />
      ) : v.stale ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-ink-warning">{t("duel.ch.stale")}</p>
          <Button size="lg" block onClick={onPlayMode} icon={<Swords size={20} />}>
            {t("duel.ch.playMode")}
          </Button>
        </div>
      ) : v.played ? (
        <p className="rounded-2xl bg-surface-2 px-3 py-3 text-center text-sm font-extrabold text-muted" data-testid="duel-ch-played">
          {t("duel.ch.played")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={onAccept} disabled={busy} icon={<Swords size={20} />} data-testid="duel-ch-accept">
            {t("duel.ch.accept")}
            <HeartCost n={ENTRY_COST.duel} variant="solid" />
          </Button>
          <p className="text-center text-xs font-semibold text-muted">{t("duel.ch.ghostNote")}</p>
        </div>
      )}

      {!v.mine && (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={onAddFriend} icon={<UserPlus size={18} />}>
            {t("social.join.add")}
          </Button>
          {friendNote && (
            <p role="status" className="text-center text-sm font-bold text-muted">
              {t(friendNote)}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** Свой вызов: результаты друзей и ссылка ещё раз. */
function MyChallenge({ v, title, lang }: { v: ChallengeView; title: string; lang: "ru" | "kk" }) {
  const { t } = useT();
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("duel.ch.results")}</h2>
        {v.results.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-border px-4 py-4 text-center text-sm font-semibold text-muted">{t("duel.ch.results.empty")}</p>
        ) : (
          v.results.map((r) => (
            <PlayerRow
              key={`${r.card.code}.${r.at}`}
              card={r.card}
              testId="duel-ch-result"
              sub={<span className="text-xs font-semibold text-muted">{shortDate(new Date(r.at), lang)}</span>}
              right={
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-base font-extrabold tabular-nums">
                    {v.res.score} : {r.score}
                  </span>
                  <span className={cn("text-xs font-extrabold", r.w === "win" ? "text-ink-success" : r.w === "draw" ? "text-ink-warning" : "text-muted")}>
                    {r.w === "win" ? t("social.inbox.win") : r.w === "draw" ? t("duel.result.draw") : t("social.inbox.loss")}
                  </span>
                </span>
              }
            />
          ))
        )}
      </section>
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-primary/40 bg-primary-soft p-4">
        <h2 className="font-extrabold text-ink-primary">{t("duel.ch.share")}</h2>
        <ShareTargets
          url={absoluteUrl(challengePath(v.id))}
          title={t("duel.ch.title")}
          text={t("duel.ch.shareText", { mode: title, score: v.res.score })}
          what="challenge"
        />
      </section>
    </>
  );
}
