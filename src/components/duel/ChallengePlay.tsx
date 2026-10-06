"use client";

import { Check, Loader2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { ENTRY_COST } from "@/lib/economy";
import { duelEntryKey } from "@/lib/entry-paid";
import { levelInfo } from "@/lib/gamification";
import { track } from "@/lib/analytics";
import { absoluteUrl } from "@/lib/share";
import { duelPlayId, fetchDuelDeck, type DuelDeckResponse } from "@/lib/duel/api";
import {
  answersOf,
  CLIENT_DECK_TAG,
  recHref,
  recordChallenge,
  sendGhostResult,
  startSolo,
  type Accepted,
  type GhostResult,
  type Recorded,
  type StartView,
} from "@/lib/duel/challenge";
import { sideStat, type RunState } from "@/lib/duel/run";
import type { DuelOutcome } from "@/lib/duel/bot";
import type { DuelSideStat } from "@/lib/duel/record";
import type { OpponentTimeline } from "@/lib/duel/timeline";
import type { DuelEvent, DuelModeId, NotCountedWhy } from "@/lib/duel/types";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/mascot/Mascot";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { ActivityMusic } from "@/components/music/ActivityMusic";
import { ShareTargets } from "@/components/share/ShareTargets";
import { NameForm } from "@/components/social/NameForm";
import { ReportPlayerButton } from "@/components/social/ReportPlayerButton";
import { duelWrongItems } from "./DuelPlay";
import { DuelResult } from "./DuelResult";
import { DuelRun } from "./DuelRun";
import { VsScreen } from "./VsScreen";
import { MODE_TITLE, topicTitle } from "./mode-meta";
import type { Rival } from "./rival";

// Игра вызова (этап 16Д, Ф3; docs/specs/duels.md §6, §9):
// - solo — запись своего вызова другу: подписанный старт → тот же набор (GET /api/duel/deck) → «VS» без соперника →
//   сердечко в конце отсчёта → игра → сервер проверяет ответы и записывает вызов → ссылка «Отправить другу»;
// - ghost — игра против записи друга (после «Принять вызов» на /duel/c/<id>): полоса друга бежит по записи, как у бота;
//   итог проверяет сервер, он же кладёт его во входящие вызвавшего и начисляет очки недели.
// Экран матча, «VS» и итоги — те же, что у матча с Битом (DuelRun, VsScreen, DuelResult) с другим соперником.
// Старт записи помним во вкладке (sessionStorage, ключ — nonce из адреса): перезагрузка продолжает тот же набор
// (вход уже оплачен — повторно сердечко в течение 20 минут не списывается), а записанный вызов сразу показывает ссылку.

type Props = { kind: "solo"; mode: DuelModeId; topic?: string; nonce: string } | { kind: "ghost"; id: string; accepted: Accepted };

type Send =
  | { s: "sending" }
  | { s: "saved"; rec: Recorded }
  | { s: "ghost"; res: GhostResult }
  | { s: "failed"; expired: boolean };

type Phase =
  | { name: "loading" }
  | { name: "name" }
  | { name: "error"; key: DictKey; retry: boolean }
  | { name: "saved"; rec: Recorded }
  | { name: "vs"; start: StartView; deck: DuelDeckResponse }
  | { name: "play"; start: StartView; deck: DuelDeckResponse; tl: OpponentTimeline; playId: string }
  | { name: "result"; start: StartView; deck: DuelDeckResponse; run: RunState; you: DuelSideStat; rival: DuelSideStat; result: DuelOutcome; xp: number; send: Send };

const SESSION_PREFIX = "informatica-duel-rec:";

interface RecSession {
  start: StartView;
  rec?: Recorded;
}

function readSession(nonce: string): RecSession | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_PREFIX + nonce) ?? "null") as RecSession | null;
    return v && typeof v.start?.start === "string" && typeof v.start.seed === "number" ? v : null;
  } catch {
    return null;
  }
}

function writeSession(nonce: string, v: RecSession): void {
  try {
    sessionStorage.setItem(SESSION_PREFIX + nonce, JSON.stringify(v));
  } catch {
    // хранилище недоступно — перезагрузка начнёт новую запись
  }
}

const WHY_KEY: Record<NotCountedWhy, DictKey> = {
  bot: "duel.week.no.bot",
  fast: "duel.week.no.fast",
  short: "duel.week.no.short",
  pair_limit: "duel.week.no.pair_limit",
  daily_limit: "duel.week.no.daily_limit",
};

export function ChallengePlay(props: Props) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [noHearts, setNoHearts] = useState(false);
  const recorded = useRef(false);
  const mode = props.kind === "solo" ? props.mode : props.accepted.start.mode;
  const topic = props.kind === "solo" ? props.topic : props.accepted.start.topic;
  const nonce = props.kind === "solo" ? props.nonce : null;
  const ghostId = props.kind === "ghost" ? props.id : null;
  const accepted = props.kind === "ghost" ? props.accepted : null;

  const rival: Rival = accepted ? { kind: "ghost", card: accepted.by } : { kind: "solo" };

  // Загрузка: старт (свой или из «Принять вызов») и набор по его seed. Запросы — в эффекте, состояние — в ответе.
  useEffect(() => {
    const ctl = new AbortController();
    const load = async (): Promise<Phase> => {
      let start: StartView;
      if (accepted) start = accepted.start;
      else {
        const saved = nonce ? readSession(nonce) : null;
        if (saved?.rec) return { name: "saved", rec: saved.rec };
        if (saved && saved.start.endsAt > Date.now() + 60_000) start = saved.start;
        else {
          const r = await startSolo(mode, topic, levelInfo(useApp.getState().xp).level, CLIENT_DECK_TAG);
          if (!r.ok || !r.data) {
            if (r.status === 401) return { name: "name" };
            if (r.error === "stale") return { name: "error", key: "duel.stale", retry: false };
            if (r.error === "social_disabled") return { name: "error", key: "social.off.title", retry: false };
            return { name: "error", key: r.status === 429 ? "social.rate" : "social.error", retry: true };
          }
          start = r.data;
          if (nonce) writeSession(nonce, { start });
        }
      }
      const deck = await fetchDuelDeck({ mode: start.mode, band: start.band, seed: start.seed, topic: start.topic }, ctl.signal);
      return { name: "vs", start, deck };
    };
    load()
      .then((p) => {
        if (!ctl.signal.aborted) setPhase(p);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setPhase({ name: "error", key: "duel.loadError", retry: true });
      });
    return () => ctl.abort();
  }, [accepted, nonce, mode, topic, attempt]);

  /** id матча для ключа входа: запись — по seed старта, принятый вызов — по id вызова. */
  const matchId = (start: StartView) => (ghostId ? `ch.${ghostId}` : `rec.${start.seed}`);

  const pay = (start: StartView, deck: DuelDeckResponse): boolean => {
    if (!useApp.getState().payEntryOnce(duelEntryKey(matchId(start)), ENTRY_COST.duel).ok) {
      setNoHearts(true);
      track({ e: "hearts_out", where: "duel" });
      return false;
    }
    setNoHearts(false);
    recorded.current = false;
    const tl: OpponentTimeline = { kind: "ghost", events: accepted ? accepted.tl : [], complete: true };
    setPhase({ name: "play", start, deck, tl, playId: duelPlayId(matchId(start), Date.now()) });
    return true;
  };

  const send = async (start: StartView, run: RunState): Promise<Send> => {
    const answers = answersOf(start.mode, run);
    if (ghostId) {
      const r = await sendGhostResult(ghostId, start.start, answers);
      return r.ok && r.data ? { s: "ghost", res: r.data } : { s: "failed", expired: r.error === "expired" };
    }
    const r = await recordChallenge(start.start, answers);
    if (r.ok && r.data) {
      if (nonce) writeSession(nonce, { start, rec: r.data });
      return { s: "saved", rec: r.data };
    }
    return { s: "failed", expired: r.error === "expired" };
  };

  const finish = (start: StartView, deck: DuelDeckResponse, playId: string, run: RunState, opp: DuelEvent[]) => {
    if (recorded.current) return;
    recorded.current = true;
    const you = sideStat(start.mode, run.events);
    // Запись своего вызова — соперника нет: итог «ничья», бонуса за победу нет.
    const rivalStat = accepted ? sideStat(start.mode, opp) : you;
    const res = useApp.getState().recordDuel({
      id: playId,
      matchId: matchId(start),
      mode: start.mode,
      topic: start.topic,
      opp: accepted ? "ghost" : "solo",
      ...(accepted ? { oppName: accepted.by.name ?? undefined, oppLevel: accepted.by.lv, oppCode: accepted.by.code, chId: ghostId ?? undefined } : {}),
      you,
      rival: rivalStat,
      attempts: run.events.map((e) => ({ skill: deck.items[e.i]?.skill ?? "", correct: e.ok })).filter((a) => a.skill),
      wrong: duelWrongItems(deck.items, run, lang),
    });
    const base = { name: "result" as const, start, deck, run, you, rival: rivalStat, result: res.result, xp: res.xp };
    setPhase({ ...base, send: { s: "sending" } });
    void send(start, run).then((s) => setPhase((p) => (p.name === "result" && p.start === start ? { ...p, send: s } : p)));
  };

  const retrySend = () => {
    if (phase.name !== "result") return;
    const { start, run } = phase;
    setPhase({ ...phase, send: { s: "sending" } });
    void send(start, run).then((s) => setPhase((p) => (p.name === "result" && p.start === start ? { ...p, send: s } : p)));
  };

  const toHub = () => router.replace("/duel");
  const recordAgain = () => router.replace(recHref(mode, topic));
  const title = topic ? topicTitle(topic) : null;
  const topicLabel = title === "school" ? t("duel.topic.school") : title ? l(title) : undefined;
  const modeLabel = topicLabel ? `${t(MODE_TITLE[mode])}: ${topicLabel}` : t(MODE_TITLE[mode]);

  return (
    <>
      <ActivityMusic mode="game" active={phase.name === "play"} />
      {phase.name === "loading" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
          <Mascot mood="thinking" size={88} />
          <p className="font-bold text-muted" role="status">
            {t("duel.loading")}
          </p>
        </div>
      )}
      {phase.name === "name" && (
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
          <NameForm player={null} onDone={() => setAttempt((n) => n + 1)} onCancel={toHub} />
          <p className="text-center text-xs font-semibold text-muted">{t("social.device")}</p>
        </div>
      )}
      {phase.name === "error" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center" data-testid="duel-ch-error">
          <Mascot mood="sad" size={88} />
          <p className="max-w-sm font-bold">{t(phase.key)}</p>
          {phase.retry && (
            <Button
              onClick={() => {
                setPhase({ name: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              {t("duel.retry")}
            </Button>
          )}
          {phase.key === "duel.stale" && <Button onClick={() => window.location.reload()}>{t("duel.reload")}</Button>}
          <Button variant="ghost" onClick={toHub}>
            {t("duel.toHub")}
          </Button>
        </div>
      )}
      {phase.name === "saved" && (
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
          <h1 className="text-center text-2xl font-black">{t("duel.rec.saved")}</h1>
          <ShareBlock rec={phase.rec} modeLabel={modeLabel} />
          <Button variant="ghost" block onClick={recordAgain}>
            {t("duel.rec.again")}
          </Button>
          <Button variant="ghost" block onClick={toHub}>
            {t("duel.toHub")}
          </Button>
        </div>
      )}
      {phase.name === "vs" && (
        <VsScreen
          mode={mode}
          topicLabel={topicLabel}
          band={phase.start.band}
          rival={rival}
          running={!noHearts}
          onGo={() => pay(phase.start, phase.deck)}
          onClose={toHub}
        />
      )}
      {phase.name === "play" && (
        <DuelRun
          key={phase.playId}
          items={phase.deck.items}
          mode={mode}
          timeline={phase.tl}
          rival={rival}
          onFinish={(run, opp) => finish(phase.start, phase.deck, phase.playId, run, opp)}
          onQuit={toHub}
        />
      )}
      {phase.name === "result" && (
        <DuelResult
          result={phase.result}
          you={phase.you}
          rival={phase.rival}
          xp={phase.xp}
          items={phase.deck.items}
          events={phase.run.events}
          answers={phase.run.answers}
          opponent={rival}
          onHub={toHub}
          report={accepted ? <ReportPlayerButton card={accepted.by} where="result" matchId={ghostId ?? undefined} /> : undefined}
          onChallenge={accepted ? () => router.replace(recHref(mode, topic)) : phase.send.s === "saved" ? recordAgain : undefined}
          challengeLabel={accepted ? t("duel.challengeBack") : t("duel.rec.again")}
          extra={<SendPanel send={phase.send} modeLabel={modeLabel} onRetry={retrySend} onAgain={recordAgain} />}
        />
      )}
      <OutOfHearts
        open={noHearts && phase.name === "vs"}
        need={ENTRY_COST.duel}
        onClose={toHub}
        onResume={() => {
          if (phase.name === "vs") pay(phase.start, phase.deck);
        }}
        onExit={toHub}
      />
    </>
  );
}

/** Ссылка на записанный вызов: «Отправить другу» через общее меню «Поделиться». */
function ShareBlock({ rec, modeLabel }: { rec: Recorded; modeLabel: string }) {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-primary/40 bg-primary-soft p-4" data-testid="duel-ch-share" data-url={rec.url}>
      <p className="text-sm font-bold text-ink-primary">{t("duel.rec.savedDesc")}</p>
      <ShareTargets
        url={absoluteUrl(rec.url)}
        title={t("duel.ch.title")}
        text={t("duel.ch.shareText", { mode: modeLabel, score: rec.res.score })}
        what="challenge"
      />
    </section>
  );
}

/** Что с отправкой результата на сервер: запись вызова, очки недели, «не попал в топ», ошибка с повтором. */
function SendPanel({ send, modeLabel, onRetry, onAgain }: { send: Send; modeLabel: string; onRetry: () => void; onAgain: () => void }) {
  const { t } = useT();
  if (send.s === "sending")
    return (
      <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        {t("duel.ghost.sending")}
      </p>
    );
  if (send.s === "saved") return <ShareBlock rec={send.rec} modeLabel={modeLabel} />;
  if (send.s === "failed")
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-warning-soft px-3 py-3 text-center" role="alert">
        <p className="text-sm font-bold text-ink-warning">{send.expired ? t("duel.rec.expired") : t("duel.week.sendFailed")}</p>
        {send.expired ? (
          <Button variant="secondary" size="sm" onClick={onAgain}>
            {t("duel.rec.again")}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("duel.retry")}
          </Button>
        )}
      </div>
    );
  const r = send.res;
  if (!r.stored)
    return <p className="rounded-2xl bg-surface-2 px-3 py-2 text-center text-sm font-bold text-muted">{t("duel.week.no.stored")}</p>;
  if (r.counted && r.weekPts > 0)
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-gold-soft px-3 py-2 text-sm font-extrabold text-ink-gold" data-testid="duel-week-pts">
        <Trophy size={16} aria-hidden />
        {t("duel.week.pts", { n: r.weekPts })}
      </p>
    );
  return (
    <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-center text-sm font-bold text-muted">
      <Check size={16} aria-hidden />
      {r.why ? t(WHY_KEY[r.why]) : t("duel.week.no.short")}
    </p>
  );
}
