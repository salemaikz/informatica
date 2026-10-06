"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { ENTRY_COST } from "@/lib/economy";
import { duelEntryKey, entryPaidActive } from "@/lib/entry-paid";
import { levelInfo } from "@/lib/gamification";
import { decayedMastery } from "@/lib/mastery";
import { plainText } from "@/lib/text";
import { track } from "@/lib/analytics";
import { botMatchId, duelPlayed, duelPlayHref, duelPlayId, duelStartedHere, fetchDuelDeck, markDuelStarted, newDuelSeed, type DuelDeckResponse } from "@/lib/duel/api";
import { botProfile, botTimeline } from "@/lib/duel/bot";
import { correctAnswer } from "@/lib/duel/check";
import { bandOf } from "@/lib/duel/modes";
import { sideStat, type RunState } from "@/lib/duel/run";
import type { DuelOutcome } from "@/lib/duel/bot";
import type { DuelSideStat } from "@/lib/duel/record";
import type { OpponentTimeline } from "@/lib/duel/timeline";
import type { DuelAnswer, DuelBand, DuelEvent, DuelItem, DuelModeId } from "@/lib/duel/types";
import type { WrongItem } from "@/lib/history";
import type { Lang, SkillId } from "@/lib/types";
import { translate, useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/mascot/Mascot";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { ActivityMusic } from "@/components/music/ActivityMusic";
import { DuelResult } from "./DuelResult";
import { DuelRun } from "./DuelRun";
import { VsScreen } from "./VsScreen";
import { topicTitle } from "./mode-meta";

// Матч с Битом (этап 16Д, Ф1): набор с сервера → «VS» и отсчёт → сердечко в конце отсчёта (payEntryOnce по ключу матча,
// из таймера, не из эффекта; не хватает — окно «Сердечки закончились») → матч → итоги (recordDuel). Реванш — новый seed,
// новый матч, новое сердечко. Бот считается целиком на устройстве: ни одного запроса, кроме набора заданий.
// Перезагрузка: сыгранный матч (есть в истории) не начинается снова — «Матч уже сыгран»; начатый и брошенный — «Матч прерван»
// без повтора того же набора: пока вход оплачен (20 минут), один раз можно сыграть новый набор бесплатно (?entry=<seed>).

type Phase =
  | { name: "loading" }
  | { name: "error" }
  | { name: "played" }
  /** replay — вход ещё оплачен: новый набор бесплатно (один раз). */
  | { name: "cut"; replay: boolean }
  | { name: "vs"; deck: DuelDeckResponse }
  | { name: "play"; deck: DuelDeckResponse; tl: OpponentTimeline; playId: string }
  | {
      name: "result";
      deck: DuelDeckResponse;
      run: RunState;
      opp: DuelEvent[];
      you: DuelSideStat;
      rival: DuelSideStat;
      result: DuelOutcome;
      xp: number;
    };

/** Ответ ученика словами — для «Ошибок» (как у пробного ЕНТ: текст на языке ученика в момент ответа). */
function answerText(item: DuelItem, a: DuelAnswer | null | undefined, lang: Lang): string {
  if (a === null || a === undefined) return translate(lang, "duel.review.timeout");
  if (item.shape === "statement") return translate(lang, a === true ? "duel.true" : "duel.false");
  const opt = typeof a === "number" ? item.step.options[a] : undefined;
  if (opt === undefined) return "—";
  return plainText(typeof opt === "string" ? opt : opt[lang]);
}

/** Неверные ответы матча → записи «Ошибок» (id задания банка: работа над ошибками даст свежее задание того же навыка). */
export function duelWrongItems(items: readonly DuelItem[], run: RunState, lang: Lang): WrongItem[] {
  return run.events
    .filter((e) => !e.ok && items[e.i])
    .map((e) => {
      const item = items[e.i];
      const prompt = item.shape === "choice" ? item.step.prompt[lang] : item.statement.text[lang];
      return {
        stepId: item.shape === "choice" ? item.step.id : item.statement.id,
        skill: item.skill,
        prompt: plainText(prompt).slice(0, 300),
        given: answerText(item, run.answers[e.i], lang),
        expected: answerText(item, correctAnswer(item), lang),
      };
    });
}

/**
 * Набор пришёл: обычный вход — «VS»; уже сыгран — «Матч уже сыгран»; начат и брошен — «Матч прерван» (тот же набор
 * не повторяем). entry — seed прерванного матча, по оплате которого идёт этот.
 */
/** Отметка «перезапуск по оплате прерванного матча entry уже был». */
const replayMark = (mode: DuelModeId, band: DuelBand, topic: string | undefined, entry: number) => `replay:${botMatchId(mode, entry, band, topic)}`;

function entryPhase(deck: DuelDeckResponse, mode: DuelModeId, band: DuelBand, topic: string | undefined, entry: number | null): Phase {
  const s = useApp.getState();
  const id = botMatchId(mode, deck.seed, band, topic);
  if (duelPlayed(s.duels.history, id)) return { name: "played" };
  // Свой оплаченный вход ещё действует — матч уже начинался (платим в конце отсчёта и сразу начинаем).
  const paidOwn = entry === null && entryPaidActive(s.entryPaid, duelEntryKey(id), Date.now());
  // Бесплатный перезапуск по оплате прерванного матча — один: второй адрес с тем же entry уже не бесплатен.
  const replayUsed = entry !== null && duelStartedHere(replayMark(mode, band, topic, entry));
  if (duelStartedHere(id) || paidOwn || replayUsed) return { name: "cut", replay: paidOwn };
  return { name: "vs", deck };
}

export function DuelPlay({ mode, topic, seed, entry = null }: { mode: DuelModeId; topic?: string; seed: number | null; entry?: number | null }) {
  const router = useRouter();
  const { t, l, lang } = useT();
  // Полоса — по уровню ученика при входе: от неё зависят набор и бот.
  const [band] = useState<DuelBand>(() => bandOf(levelInfo(useApp.getState().xp).level));
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [noHearts, setNoHearts] = useState(false);
  const recorded = useRef(false);

  // Без seed в адресе — новый матч: дописываем seed (перезагрузка не меняет набор и не платит второй раз).
  useEffect(() => {
    if (seed === null) router.replace(duelPlayHref(mode, newDuelSeed(), topic));
  }, [seed, mode, topic, router]);

  useEffect(() => {
    if (seed === null) return;
    const ctl = new AbortController();
    fetchDuelDeck({ mode, band, seed, topic }, ctl.signal)
      .then((deck) => setPhase(entryPhase(deck, mode, band, topic, entry)))
      .catch(() => {
        if (!ctl.signal.aborted) setPhase({ name: "error" });
      });
    return () => ctl.abort();
  }, [mode, band, seed, topic, entry, attempt]);

  const matchId = (deck: DuelDeckResponse) => botMatchId(mode, deck.seed, band, topic);
  /** Матч, чьей оплатой идёт вход: свой или прерванный (entry). */
  const entryKey = (deck: DuelDeckResponse) => duelEntryKey(botMatchId(mode, entry ?? deck.seed, band, topic));


  /** Матч начинается: таймлайн бота по набору, освоению ученика и «резинке». */
  const startPlay = (deck: DuelDeckResponse) => {
    const s = useApp.getState();
    const now = Date.now();
    const mastery: Record<SkillId, number> = {};
    for (const it of deck.items) if (s.skills[it.skill] && !(it.skill in mastery)) mastery[it.skill] = decayedMastery(s.skills[it.skill], now);
    const profile = botProfile(band, { mastery, adj: s.duels.botAdj });
    const tl: OpponentTimeline = { kind: "bot", events: botTimeline(deck.items, profile, matchId(deck)), complete: true };
    recorded.current = false;
    markDuelStarted(matchId(deck));
    if (entry !== null) markDuelStarted(replayMark(mode, band, topic, entry));
    setPhase({ name: "play", deck, tl, playId: duelPlayId(matchId(deck), now) });
  };

  /** Конец отсчёта: одно сердечко за матч (повторный вход в тот же матч 20 минут бесплатен). */
  const pay = (deck: DuelDeckResponse): boolean => {
    if (!useApp.getState().payEntryOnce(entryKey(deck), ENTRY_COST.duel).ok) {
      setNoHearts(true);
      track({ e: "hearts_out", where: "duel" });
      return false;
    }
    setNoHearts(false);
    startPlay(deck);
    return true;
  };

  const finish = (deck: DuelDeckResponse, playId: string, run: RunState, opp: DuelEvent[]) => {
    if (recorded.current) return;
    recorded.current = true;
    const you = sideStat(mode, run.events);
    const rival = sideStat(mode, opp);
    const res = useApp.getState().recordDuel({
      id: playId,
      // Снимаем оплату того входа, по которому шёл матч (свой или прерванный).
      matchId: botMatchId(mode, entry ?? deck.seed, band, topic),
      mode,
      topic,
      opp: "bot",
      you,
      rival,
      attempts: run.events.map((e) => ({ skill: deck.items[e.i]?.skill ?? "", correct: e.ok })).filter((a) => a.skill),
      wrong: duelWrongItems(deck.items, run, lang),
    });
    setPhase({ name: "result", deck, run, opp, you, rival, result: res.result, xp: res.xp });
  };

  const toHub = () => router.replace("/duel");
  const rematch = () => router.replace(duelPlayHref(mode, newDuelSeed(), topic));
  /** Прерванный оплаченный матч: новый набор по той же оплате. */
  const replay = () => {
    if (seed !== null) router.replace(duelPlayHref(mode, newDuelSeed(), topic, seed));
  };
  const title = topic ? topicTitle(topic) : null;
  const topicLabel = title === "school" ? t("duel.topic.school") : title ? l(title) : undefined;

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
      {phase.name === "error" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
          <Mascot mood="sad" size={88} />
          <p className="max-w-sm font-bold">{t("duel.loadError")}</p>
          <Button
            onClick={() => {
              setPhase({ name: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t("duel.retry")}
          </Button>
          <Button variant="ghost" onClick={toHub}>
            {t("duel.toHub")}
          </Button>
        </div>
      )}
      {(phase.name === "played" || phase.name === "cut") && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] text-center" data-testid="duel-stale">
          <Mascot mood={phase.name === "played" ? "happy" : "thinking"} size={88} />
          <h1 className="text-2xl font-extrabold">{phase.name === "played" ? t("duel.played.title") : t("duel.cut.title")}</h1>
          <p className="max-w-sm font-semibold text-muted">
            {phase.name === "played" ? t("duel.played.desc") : phase.replay ? t("duel.cut.replay") : t("duel.cut.desc")}
          </p>
          <div className="flex w-full max-w-sm flex-col gap-2">
            {phase.name === "cut" && phase.replay ? (
              <Button size="lg" block onClick={replay}>
                {t("duel.cut.again")}
              </Button>
            ) : (
              <Button size="lg" block onClick={rematch}>
                {phase.name === "played" ? t("duel.rematch") : t("duel.newMatch")}
              </Button>
            )}
            <Button variant="ghost" block onClick={toHub}>
              {t("duel.toHub")}
            </Button>
          </div>
        </div>
      )}
      {phase.name === "vs" && (
        <VsScreen mode={mode} topicLabel={topicLabel} band={band} running={!noHearts} onGo={() => pay(phase.deck)} onClose={toHub} />
      )}
      {phase.name === "play" && (
        <DuelRun
          key={phase.playId}
          items={phase.deck.items}
          mode={mode}
          timeline={phase.tl}
          onFinish={(run, opp) => finish(phase.deck, phase.playId, run, opp)}
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
          onRematch={rematch}
          onHub={toHub}
        />
      )}
      <OutOfHearts
        open={noHearts && phase.name === "vs"}
        need={ENTRY_COST.duel}
        onClose={toHub}
        onResume={() => {
          if (phase.name === "vs") pay(phase.deck);
        }}
        onExit={toHub}
      />
    </>
  );
}
