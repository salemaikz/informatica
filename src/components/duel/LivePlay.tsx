"use client";

import { Bot, Copy, Info, LogOut, Search, Users, WifiOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { ENTRY_COST } from "@/lib/economy";
import { duelEntryKey } from "@/lib/entry-paid";
import { levelInfo } from "@/lib/gamification";
import { absoluteUrl } from "@/lib/share";
import { duelPlayHref, duelPlayed, duelPlayId, fetchDuelDeck, markDuelStarted, newDuelSeed, type DuelDeckResponse } from "@/lib/duel/api";
import { DUEL_MODES } from "@/lib/duel/modes";
import { IDLE_NOTICE_MS } from "@/lib/duel/score";
import type { DuelOutcome } from "@/lib/duel/bot";
import type { DuelSideStat } from "@/lib/duel/record";
import type { RunState } from "@/lib/duel/run";
import {
  CLIENT_DECK_TAG,
  SEARCH,
  duelFetch,
  ensurePlayer,
  isMatchJoin,
  liveHref,
  loadJoin,
  playerLabel,
  resumeRun,
  roomPath,
  roomUrl,
  saveJoin,
} from "@/lib/duel/live";
import type { DuelEvent, DuelModeId, MatchJoin, MatchView } from "@/lib/duel/types";
import { translate, useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/app/Avatar";
import { Mascot } from "@/components/mascot/Mascot";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { useHearts } from "@/components/economy/useEconomy";
import { ActivityMusic } from "@/components/music/ActivityMusic";
import { ShareTargets } from "@/components/share/ShareTargets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { BotChip } from "./BotChip";
import { duelWrongItems } from "./DuelPlay";
import { DuelResult } from "./DuelResult";
import { DuelRun } from "./DuelRun";
import { MODE_TITLE } from "./mode-meta";
import { OppAvatar } from "./OpponentCard";
import { ReportPlayerButton } from "./ReportPlayerButton";
import { useDuel, useDuelSearch, type DuelPhase } from "./useDuel";
import { VsScreen } from "./VsScreen";

// Живые матчи (этап 16Д, Ф4; docs/specs/duels.md §2, §5, §9, §10): один экран-автомат для случайного соперника
// в «Блице» и комнаты с другом. Поиск (кнопка Бита с 3 с, предложение на 12-й, до 30 с, бот сам не запускается) → набор →
// VS (готовность; не подтвердил за 6 с — отмена без сердечка) → сердечко в конце отсчёта по ключу матча → матч (ответы
// пачками, соперник — по серверу) → ожидание итогов → итоги с сервера (техническая победа, очки недели, жалоба) → реванш.
// Место в матче — в sessionStorage, адрес — /duel/live?m=<id>: перезагрузка возвращает в тот же матч.

export type LiveStart =
  | { kind: "find" }
  | { kind: "room"; mode: DuelModeId; topic?: string }
  | { kind: "join"; code: string }
  | { kind: "match"; matchId: string };

type LiveError = "expired" | "full" | "update_needed" | "unavailable" | "lost" | "rate_limited";

type Phase =
  | { name: "prep" }
  | { name: "search" }
  | { name: "lobby"; code: string; matchId: string; mode: DuelModeId }
  | { name: "loading"; join: MatchJoin }
  | { name: "vs"; join: MatchJoin; deck: DuelDeckResponse }
  | { name: "play"; join: MatchJoin; deck: DuelDeckResponse; initial?: RunState }
  | { name: "wait"; join: MatchJoin; deck: DuelDeckResponse; run: RunState | null }
  | { name: "result"; join: MatchJoin; deck: DuelDeckResponse; run: RunState | null; result: DuelOutcome; xp: number }
  | { name: "cancelled"; why: NonNullable<MatchView["cancelled"]>; mode: DuelModeId; topic?: string }
  | { name: "error"; error: LiveError };

const ROOM_KEY = "informatica-duel-room:";
const saveRoom = (matchId: string, code: string, mode: DuelModeId) => {
  try {
    sessionStorage.setItem(ROOM_KEY + matchId, JSON.stringify({ code, mode }));
  } catch {
    // нет хранилища — после перезагрузки лобби не восстановится
  }
};
const loadRoom = (matchId: string): { code: string; mode: DuelModeId } | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY + matchId) ?? "null") as { code?: unknown; mode?: unknown } | null;
    return v && typeof v.code === "string" && typeof v.mode === "string" && v.mode in DUEL_MODES ? { code: v.code, mode: v.mode as DuelModeId } : null;
  } catch {
    return null;
  }
};

/** Адрес без перезагрузки страницы (экран остаётся смонтированным): перезагрузка вернёт в тот же матч. */
const setAddress = (href: string) => {
  try {
    window.history.replaceState(window.history.state, "", href);
  } catch {
    // ничего
  }
};

const lastT = (events: readonly DuelEvent[]) => events[events.length - 1]?.t ?? 0;

const pollOf = (p: Phase, canPay: boolean): DuelPhase => {
  switch (p.name) {
    case "lobby":
      return "lobby";
    case "vs":
      return canPay ? "ready" : "lobby";
    case "play":
      return "play";
    case "wait":
      return "wait";
    case "result":
      return "result";
    default:
      return "off";
  }
};

export function LivePlay({ start }: { start: LiveStart }) {
  const router = useRouter();
  const { t, lang } = useT();
  const hearts = useHearts();
  const [phase, setPhase] = useState<Phase>({ name: "prep" });
  const [note, setNote] = useState<"caught" | null>(null);
  const [noHearts, setNoHearts] = useState(false);
  /** Сервер завершил матч, пока ученик ещё отвечал (соперник вышел или пропал): ход заканчивается. */
  const [ended, setEnded] = useState<string | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });
  const recorded = useRef<string | null>(null);
  const [lv] = useState(() => levelInfo(useApp.getState().xp).level);

  const canPay = hearts.unlimited || hearts.count >= ENTRY_COST.duel;
  const join = "join" in phase ? phase.join : null;
  const matchId = join?.matchId ?? (phase.name === "lobby" ? phase.matchId : null);

  const toHub = () => router.replace("/duel");

  /** Итоги пришли: записать матч (опыт, освоение, «Ошибки») один раз и показать итоги. */
  const finishWith = (v: MatchView, p: { join: MatchJoin; deck: DuelDeckResponse; run: RunState | null }) => {
    if (!v.result) return;
    const result: DuelOutcome = v.result.winner === "you" ? "win" : v.result.winner === "opp" ? "loss" : "draw";
    const s = useApp.getState();
    let xp = 0;
    if (recorded.current !== p.join.matchId && !duelPlayed(s.duels.history, p.join.matchId)) {
      recorded.current = p.join.matchId;
      const you: DuelSideStat = { score: v.you.score, correct: v.you.correct, answered: v.you.answered, timeMs: p.run ? lastT(p.run.events) : 0 };
      const rival: DuelSideStat = { score: v.opp?.score ?? 0, correct: v.opp?.correct ?? 0, answered: v.opp?.answered ?? 0, timeMs: lastT(v.oppTl) };
      const card = v.opp?.card;
      const res = s.recordDuel({
        id: duelPlayId(p.join.matchId, p.join.startAt),
        matchId: p.join.matchId,
        mode: p.join.mode,
        topic: p.join.topic,
        opp: "human",
        oppName: card ? playerLabel(card, (n) => translate(lang, "duel.player.anon", { n })) : undefined,
        oppLevel: card?.lv,
        you,
        rival,
        attempts: p.run ? p.run.events.map((e) => ({ skill: p.deck.items[e.i]?.skill ?? "", correct: e.ok })).filter((a) => a.skill) : [],
        wrong: p.run ? duelWrongItems(p.deck.items, p.run, lang) : [],
        result,
      });
      xp = res.xp;
    }
    setPhase({ name: "result", join: p.join, deck: p.deck, run: p.run, result, xp });
  };

  /** Каждый свежий вид с сервера: переходы фаз (из обработчика ответа, не из эффекта). */
  const onView = (v: MatchView) => {
    const p = phaseRef.current;
    if (p.name === "lobby") {
      if (v.state === "cancelled") return setPhase({ name: "cancelled", why: v.cancelled ?? "expired", mode: p.mode });
      if (v.join) void enterMatch(v.join);
      return;
    }
    if (p.name === "vs") {
      if (v.state === "cancelled") setPhase({ name: "cancelled", why: v.cancelled ?? "no_ready", mode: p.join.mode, topic: p.join.topic });
      return;
    }
    if ((p.name === "wait" || p.name === "play") && v.state === "finished" && v.result) {
      if (p.name === "wait") finishWith(v, p);
      else setEnded(p.join.matchId);
      return;
    }
    if (p.name === "result" && v.rematch?.next && v.rematch.next.matchId !== p.join.matchId) void enterMatch(v.rematch.next);
  };

  const conn = useDuel(matchId, join, pollOf(phase, canPay), onView);

  const search = useDuelSearch(lv, (j, late) => {
    if (late) setNote("caught");
    void enterMatch(j);
  });

  /** Место получено: адрес матча, набор заданий → VS (или продолжение после перезагрузки). */
  async function enterMatch(j: MatchJoin, resume?: MatchView) {
    if (!isMatchJoin(j)) return;
    saveJoin(j);
    setAddress(liveHref({ match: j.matchId }));
    setNoHearts(false);
    setPhase({ name: "loading", join: j });
    let deck: DuelDeckResponse;
    try {
      deck = await fetchDuelDeck({ mode: j.mode, band: j.band, seed: j.seed, topic: j.topic });
    } catch {
      return setPhase({ name: "error", error: "lost" });
    }
    if (deck.deckTag !== j.deckTag) return setPhase({ name: "error", error: "update_needed" });
    if (resume?.state === "finished") return finishWith(resume, { join: j, deck, run: null });
    if (resume?.state === "playing") {
      // Перезагрузка посреди матча: вход уже оплачен (повтор бесплатен 20 минут), ход — по принятым сервером ответам.
      const paid = useApp.getState().payEntryOnce(duelEntryKey(j.matchId), ENTRY_COST.duel);
      if (paid.ok) return setPhase({ name: "play", join: j, deck, initial: resumeRun(j.mode, resume.youTl ?? [], deck.items.length) });
    }
    if (resume?.state === "cancelled") return setPhase({ name: "cancelled", why: resume.cancelled ?? "no_ready", mode: j.mode, topic: j.topic });
    setPhase({ name: "vs", join: j, deck });
  }

  /** Конец отсчёта: свежая проверка (соперник не ушёл?) → сердечко → матч. */
  const go = async () => {
    const p = phaseRef.current;
    if (p.name !== "vs") return;
    const v = (await conn.refresh()) ?? conn.view;
    if (phaseRef.current !== p) return;
    if (v?.state === "cancelled") return setPhase({ name: "cancelled", why: v.cancelled ?? "no_ready", mode: p.join.mode, topic: p.join.topic });
    if (!useApp.getState().payEntryOnce(duelEntryKey(p.join.matchId), ENTRY_COST.duel).ok) {
      setNoHearts(true);
      return;
    }
    setNoHearts(false);
    markDuelStarted(p.join.matchId);
    setPhase({ name: "play", join: p.join, deck: p.deck });
  };

  // Старт экрана: профиль игрока на сервере, затем поиск / комната / вход / возврат в матч. Состояние меняется только
  // после ответов сети (не синхронно в эффекте).
  useEffect(() => {
    let alive = true;
    const begin = async () => {
      const s = useApp.getState();
      const ok = await ensurePlayer({
        name: s.profile.name ?? "",
        lang: s.profile.lang === "kk" ? "kk" : "ru",
        lv,
        frame: s.cosmetics.equipped.frame ?? null,
        title: s.cosmetics.equipped.title ?? null,
      });
      if (!alive) return;
      if (!ok) return setPhase({ name: "error", error: "unavailable" });
      if (start.kind === "find") {
        setPhase({ name: "search" });
        return void search.start();
      }
      if (start.kind === "room") {
        const res = await duelFetch<{ code: string; matchId: string }>("POST", roomUrl(), { body: { mode: start.mode, topic: start.topic, lv, deckTag: CLIENT_DECK_TAG } });
        if (!alive) return;
        if (res.status !== 200 || !res.data) return setPhase({ name: "error", error: res.status === 409 ? "update_needed" : res.status === 429 ? "rate_limited" : "unavailable" });
        saveRoom(res.data.matchId, res.data.code, start.mode);
        setAddress(liveHref({ match: res.data.matchId }));
        return setPhase({ name: "lobby", code: res.data.code, matchId: res.data.matchId, mode: start.mode });
      }
      if (start.kind === "join") {
        const res = await duelFetch<{ join: unknown }>("POST", roomUrl(start.code), { body: { lv, deckTag: CLIENT_DECK_TAG } });
        if (!alive) return;
        if (res.status === 200 && res.data && isMatchJoin(res.data.join)) return void enterMatch(res.data.join);
        if (res.status === 409 && res.error === "self") {
          // Своя ссылка: хозяин возвращается в своё лобби (код и режим — в sessionStorage этой вкладки).
          const own = typeof (res.raw as { matchId?: unknown } | null)?.matchId === "string" ? (res.raw as { matchId: string }).matchId : null;
          const room = own ? loadRoom(own) : null;
          if (own && room) {
            setAddress(liveHref({ match: own }));
            return setPhase({ name: "lobby", code: room.code, matchId: own, mode: room.mode });
          }
        }
        const error: LiveError =
          res.error === "full" ? "full" : res.error === "update_needed" ? "update_needed" : res.status === 404 || res.error === "self" ? "expired" : res.status === 429 ? "rate_limited" : "unavailable";
        return setPhase({ name: "error", error });
      }
      // Возврат в матч после перезагрузки.
      const saved = loadJoin(start.matchId);
      if (saved) {
        const v = await duelFetch<unknown>("GET", `/api/duel/m/${encodeURIComponent(saved.matchId)}?me=1`, { seat: saved.seat });
        if (!alive) return;
        if (v.status === 200 && v.data) return void enterMatch(saved, v.data as MatchView);
        return setPhase({ name: "error", error: v.status === 404 ? "expired" : "lost" });
      }
      const room = loadRoom(start.matchId);
      if (room) return setPhase({ name: "lobby", code: room.code, matchId: start.matchId, mode: room.mode });
      setPhase({ name: "error", error: "expired" });
    };
    void begin();
    return () => {
      alive = false;
    };
    // Один раз на экран: start приходит из адреса страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playBot = async (mode: DuelModeId = "blitz", topic?: string) => {
    if (phaseRef.current.name === "search") {
      const j = await search.stop();
      if (j) {
        setNote("caught");
        return void enterMatch(j);
      }
    }
    router.replace(duelPlayHref(mode, newDuelSeed(), topic));
  };

  const searchAgain = () => {
    setNote(null);
    setAddress(liveHref({ find: true }));
    setPhase({ name: "search" });
    void search.start();
  };

  const leaveMatch = async () => {
    await conn.leave();
    toHub();
  };

  const view = conn.view && conn.view.id === matchId ? conn.view : null;
  const opp = view?.opp?.card ?? null;
  // Матч пропал (истёк) или сборка устарела — экран ошибки поверх любой фазы матча.
  const fatal: LiveError | null =
    phase.name === "error" || phase.name === "search" || phase.name === "prep" ? null : conn.error === "update_needed" ? "update_needed" : conn.error === "not_found" ? "expired" : null;
  if (fatal) return <ErrorScreen error={fatal} onBot={() => void playBot()} onHub={toHub} />;

  return (
    <>
      <ActivityMusic mode="game" active={phase.name === "play"} />
      {phase.name === "prep" || phase.name === "loading" ? (
        <Centered testId="duel-live-prep">
          <Mascot mood="thinking" size={88} />
          <p className="font-bold text-muted" role="status">
            {start.kind === "room" ? t("duel.room.creating") : start.kind === "join" ? t("duel.room.joining") : t("duel.live.preparing")}
          </p>
        </Centered>
      ) : null}

      {phase.name === "search" && (
        <SearchScreen
          state={search.state}
          onBot={() => void playBot()}
          onCancel={async () => {
            await search.stop();
            toHub();
          }}
          onAgain={searchAgain}
        />
      )}

      {phase.name === "lobby" && (
        <LobbyScreen
          code={phase.code}
          mode={phase.mode}
          onClose={async () => {
            await conn.leave();
            toHub();
          }}
        />
      )}

      {phase.name === "vs" && (
        <>
          {note === "caught" && <NoteBar>{t("duel.search.caught")}</NoteBar>}
          <VsScreen
            mode={phase.join.mode}
            band={phase.join.band}
            running={canPay && (view?.state === "countdown" || view?.state === "playing")}
            opponent={opp}
            goAt={conn.toLocal(phase.join.startAt)}
            waitText={t("duel.live.waitReady")}
            onGo={() => void go()}
            onClose={() => void leaveMatch()}
          />
        </>
      )}

      {phase.name === "play" && (
        <DuelRun
          key={phase.join.matchId}
          items={phase.deck.items}
          mode={phase.join.mode}
          timeline={{ kind: "human", events: view?.oppTl ?? [], complete: !!view?.opp?.done }}
          opponent={opp}
          initial={phase.initial}
          stop={ended === phase.join.matchId}
          live={{ now: () => conn.serverNow() - phase.join.startAt, onAnswer: conn.send }}
          banner={
            view?.opp && !view.opp.done && view.opp.idleMs >= IDLE_NOTICE_MS ? (
              <NoteBar inline>
                <WifiOff size={16} aria-hidden /> {t("duel.live.idle")}
              </NoteBar>
            ) : conn.net !== "ok" ? (
              <NoteBar inline>
                <WifiOff size={16} aria-hidden /> {t("duel.live.retrying")}
              </NoteBar>
            ) : null
          }
          onFinish={(run) => {
            setPhase({ name: "wait", join: phase.join, deck: phase.deck, run });
            void conn.done();
          }}
          onQuit={() => void leaveMatch()}
        />
      )}

      {phase.name === "wait" && <WaitScreen view={view} n={phase.deck.items.length} mode={phase.join.mode} lost={conn.net === "lost"} onHub={toHub} />}

      {phase.name === "result" && (
        <DuelResult
          result={phase.result}
          you={{ score: view?.you.score ?? 0, correct: view?.you.correct ?? 0, answered: view?.you.answered ?? 0, timeMs: phase.run ? lastT(phase.run.events) : 0 }}
          rival={{ score: view?.opp?.score ?? 0, correct: view?.opp?.correct ?? 0, answered: view?.opp?.answered ?? 0, timeMs: lastT(view?.oppTl ?? []) }}
          xp={phase.xp}
          items={phase.deck.items}
          events={phase.run?.events ?? []}
          answers={phase.run?.answers ?? []}
          opponent={opp}
          rematchState={view?.rematch?.you ? "waiting" : view?.rematch?.opp ? "offered" : "idle"}
          onRematch={() => void conn.rematch()}
          onHub={toHub}
        >
          <ResultExtras view={view} matchId={phase.join.matchId} />
        </DuelResult>
      )}

      {phase.name === "cancelled" && (
        <Centered testId="duel-live-cancelled">
          <Mascot mood="thinking" size={88} />
          <h1 className="text-2xl font-extrabold">{t(`duel.cancel.${phase.why}`)}</h1>
          <p className="max-w-sm font-semibold text-muted">{t("duel.cancel.desc")}</p>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button size="lg" block icon={<Bot size={20} />} onClick={() => void playBot(phase.mode, phase.topic)}>
              {t("duel.playBot")}
            </Button>
            {start.kind === "find" && (
              <Button variant="secondary" block icon={<Search size={18} />} onClick={searchAgain}>
                {t("duel.search.again")}
              </Button>
            )}
            <Button variant="ghost" block onClick={toHub}>
              {t("duel.toHub")}
            </Button>
          </div>
        </Centered>
      )}

      {phase.name === "error" && <ErrorScreen error={phase.error} onBot={() => void playBot()} onHub={toHub} />}

      <OutOfHearts
        open={phase.name === "vs" && (noHearts || !canPay)}
        need={ENTRY_COST.duel}
        onClose={() => void leaveMatch()}
        onResume={() => {
          if (phaseRef.current.name === "vs" && noHearts) void go();
        }}
        onExit={() => void leaveMatch()}
      />
    </>
  );
}

function Centered({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] text-center" data-testid={testId}>
      {children}
    </div>
  );
}

function NoteBar({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-center text-sm font-extrabold text-ink-warning",
        !inline && "mx-4 mt-3",
      )}
      data-testid="duel-live-note"
    >
      {children}
    </p>
  );
}

const fmtSec = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Поиск: я против «?», таймер, кнопка Бита с 3 с, предложение на 12-й, «никого нет» после 30 с. */
function SearchScreen({
  state,
  onBot,
  onCancel,
  onAgain,
}: {
  state: ReturnType<typeof useDuelSearch>["state"];
  onBot: () => void;
  onCancel: () => void;
  onAgain: () => void;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const [now, setNow] = useState(() => Date.now());
  const [stay, setStay] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const since = state.name === "searching" ? state.startedAt : now;
  const elapsed = Math.max(0, now - since);
  const searching = state.name === "searching";
  const offer = searching && elapsed >= SEARCH.offerMs && !stay;
  const none = state.name === "none";
  const error = state.name === "error";

  return (
    <div className="flex min-h-dvh flex-col" data-testid="duel-search">
      <header className="mx-auto flex h-14 w-full max-w-2xl items-center px-4">
        <button type="button" onClick={onCancel} aria-label={t("common.cancel")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={24} />
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-5 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 text-center">
        <h1 className="text-2xl font-extrabold">{t("duel.search.title")}</h1>
        <p className="-mt-3 text-sm font-semibold text-muted">{t("duel.search.desc")}</p>
        <div className="flex items-center gap-4">
          <span className="rounded-full border-2 border-primary/40 p-1">
            <Avatar config={avatar} name={name} size={64} />
          </span>
          <span className="text-sm font-black uppercase text-muted">{t("duel.vs")}</span>
          <span className={cn("rounded-full border-2 border-dashed border-border p-1", searching && !reduce && "animate-pulse")}>
            <OppAvatar card={null} size={64} />
          </span>
        </div>
        {searching && (
          <p className="font-mono text-3xl font-extrabold tabular-nums" role="timer" data-testid="duel-search-timer">
            {fmtSec(elapsed)}
          </p>
        )}
        <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-xs font-bold text-muted">
          <Info size={14} aria-hidden /> {t("duel.search.free")}
        </p>

        {offer && (
          <section className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4 text-left" data-testid="duel-bot-offer">
            <div className="flex items-center gap-3">
              <Mascot mood="happy" size={48} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-extrabold">{t("duel.search.offer.title")}</p>
                <BotChip />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted">{t("duel.search.offer.desc")}</p>
            <Button block icon={<Bot size={18} />} onClick={onBot}>
              {t("duel.playBot")}
            </Button>
            <Button variant="secondary" block onClick={() => setStay(true)}>
              {t("duel.search.more")}
            </Button>
          </section>
        )}

        {(none || error) && (
          <section className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4" data-testid="duel-search-none">
            <p className="font-extrabold">{error ? t("duel.live.unavailable") : t("duel.search.none")}</p>
            {!error && <p className="text-sm font-semibold text-muted">{t("duel.search.none.desc")}</p>}
            <Button block icon={<Bot size={18} />} onClick={onBot}>
              {t("duel.playBot")}
            </Button>
            {!error && (
              <Button variant="secondary" block icon={<Search size={18} />} onClick={onAgain}>
                {t("duel.search.again")}
              </Button>
            )}
          </section>
        )}

        <div className="flex-1" />
        <div className="flex w-full max-w-sm flex-col gap-2">
          {searching && !offer && elapsed >= SEARCH.botButtonMs && (
            <Button variant="secondary" block icon={<Bot size={18} />} onClick={onBot} data-testid="duel-search-bot">
              {t("duel.playBot")}
              <BotChip />
            </Button>
          )}
          <Button variant="ghost" block onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </main>
    </div>
  );
}

/** Лобби комнаты: код крупно, «Поделиться» ссылкой, ждём друга. */
function LobbyScreen({ code, mode, onClose }: { code: string; mode: DuelModeId; onClose: () => void }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const url = absoluteUrl(roomPath(code));
  const modeName = t(MODE_TITLE[mode]);
  return (
    <div className="flex min-h-dvh flex-col" data-testid="duel-lobby">
      <header className="mx-auto flex h-14 w-full max-w-2xl items-center px-4">
        <button type="button" onClick={onClose} aria-label={t("duel.room.close")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={24} />
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-ink-primary">
            <Users size={28} aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold">{t("duel.room.title")}</h1>
          <p className="max-w-sm font-semibold text-muted">{t("duel.room.desc")}</p>
          <p className="rounded-full bg-primary-soft px-3 py-1 text-sm font-extrabold text-ink-primary">{modeName}</p>
        </div>
        <section className="flex flex-col items-center gap-1 rounded-3xl border-2 border-border bg-surface p-4">
          <span className="text-xs font-extrabold uppercase text-muted">{t("duel.room.code")}</span>
          <span className="font-mono text-4xl font-black tracking-[0.2em]" data-testid="duel-room-code">
            {code}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-muted">
            <Copy size={12} aria-hidden /> {t("duel.room.expires")}
          </span>
        </section>
        <ShareTargets url={url} title={t("duel.room.share.title", { mode: modeName })} text={t("duel.room.share.text", { mode: modeName })} what="challenge" />
        <p className={cn("text-center font-bold text-muted", !reduce && "animate-pulse")} role="status">
          {t("duel.room.wait")}
        </p>
        <div className="flex-1" />
        <Button variant="ghost" block icon={<LogOut size={18} />} onClick={onClose}>
          {t("duel.room.close")}
        </Button>
      </main>
    </div>
  );
}

/** Доиграл, соперник ещё отвечает: его прогресс по серверу; итоги подведёт сервер (самое позднее — конец матча + 3 с). */
function WaitScreen({ view, n, mode, lost, onHub }: { view: MatchView | null; n: number; mode: DuelModeId; lost: boolean; onHub: () => void }) {
  const { t } = useT();
  const clocked = DUEL_MODES[mode].clockMs != null;
  const answered = view?.opp?.answered ?? 0;
  const oppDone = !!view?.opp?.done;
  return (
    <Centered testId="duel-live-wait">
      <Mascot mood="thinking" size={88} />
      <p className="font-extrabold" role="status">
        {oppDone ? t("duel.live.finishing") : clocked ? t("duel.live.wait.clock", { n: answered }) : t("duel.live.wait", { n: answered, total: n })}
      </p>
      {view?.opp && !oppDone && view.opp.idleMs >= IDLE_NOTICE_MS && <p className="text-sm font-bold text-ink-warning">{t("duel.live.idle")}</p>}
      {lost && (
        <>
          <p className="text-sm font-bold text-muted">{t("duel.live.lost")}</p>
          <Button variant="ghost" onClick={onHub}>
            {t("duel.toHub")}
          </Button>
        </>
      )}
    </Centered>
  );
}

/** Под счётом на итогах с живым: причина технического итога, очки недели или «не попал в топ», жалоба. */
function ResultExtras({ view, matchId }: { view: MatchView | null; matchId: string }) {
  const { t } = useT();
  const r = view?.result;
  if (!r) return null;
  const tech =
    r.reason === "left" ? (r.winner === "you" ? t("duel.tech.left") : r.winner === "opp" ? t("duel.tech.youLeft") : null) : r.reason === "idle" ? (r.winner === "you" ? t("duel.tech.idle") : t("duel.tech.youIdle")) : null;
  return (
    <div className="flex flex-col gap-2" data-testid="duel-live-extras">
      {tech && <p className="rounded-2xl bg-surface-2 px-3 py-2 text-center text-sm font-bold">{tech}</p>}
      {r.counted && r.weekPts > 0 ? (
        <p className="text-center text-sm font-extrabold text-ink-gold" data-testid="duel-week-pts">
          {t("duel.week.pts", { n: r.weekPts })}
        </p>
      ) : !r.counted && r.why ? (
        <p className="rounded-2xl bg-warning-soft px-3 py-2 text-center text-sm font-bold text-ink-warning" data-testid="duel-not-counted">
          {t("duel.notCounted", { why: t(`duel.why.${r.why}`) })}
        </p>
      ) : null}
      {view?.opp?.card.code ? <ReportPlayerButton code={view.opp.card.code} matchId={matchId} /> : null}
    </div>
  );
}

function ErrorScreen({ error, onBot, onHub }: { error: LiveError; onBot: () => void; onHub: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const text =
    error === "update_needed"
      ? t("duel.update")
      : error === "expired"
        ? t("duel.room.expired")
        : error === "full"
          ? t("duel.room.full")
          : error === "lost"
            ? t("duel.live.lost")
            : t("duel.live.unavailable");
  return (
    <Centered testId="duel-live-error">
      <Mascot mood="sad" size={88} />
      <p className="max-w-sm font-bold">{text}</p>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {error === "update_needed" ? (
          <Button size="lg" block onClick={() => window.location.reload()}>
            {t("duel.update.btn")}
          </Button>
        ) : error === "expired" || error === "full" ? (
          <Button size="lg" block icon={<Users size={20} />} onClick={() => router.replace(liveHref({ room: "blitz" }))}>
            {t("duel.room.own")}
          </Button>
        ) : (
          <Button size="lg" block icon={<Bot size={20} />} onClick={onBot}>
            {t("duel.playBot")}
          </Button>
        )}
        <Button variant="ghost" block onClick={onHub}>
          {t("duel.toHub")}
        </Button>
      </div>
    </Centered>
  );
}
