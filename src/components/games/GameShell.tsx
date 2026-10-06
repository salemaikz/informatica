"use client";

import { BookOpen, Check, Feather, Heart, Info, Map as MapIcon, Play, RotateCcw, Timer, Trophy, X, Clock, Cpu, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import type { SkillId } from "@/lib/types";
import type { GameMode, GameResult } from "@/games/types";
import { gameById } from "@/games/registry";
import { GAME_COMPONENTS } from "@/games/components";
import { gameStatKey, type GameReward } from "@/lib/games";
import { track } from "@/lib/analytics";
import { gameFinishEvent } from "@/lib/player-events";
import { useApp } from "@/lib/store";
import { GAME_MIN_TOTAL, GAME_PASS, gameCanCredit, gamePassed, gameSkillsFor, gameSupportsSkills } from "@/lib/drill-meta";
import { entryCost } from "@/lib/economy";
import { lessonMeta } from "@/content/catalog";
import { playSound } from "@/lib/sound";
import { ActivityMusic } from "@/components/music/ActivityMusic";
import { MusicToggle } from "@/components/music/MusicToggle";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { useToolboxLevel } from "@/components/tools/useToolbox";
import { Mascot, MascotSays } from "@/components/mascot/Mascot";
import { HeartCost } from "@/components/economy/HeartCost";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { useHearts } from "@/components/economy/useEconomy";
import { pluralKey } from "@/components/learn/useLearn";
import { XpIcon } from "@/components/economy/XpIcon";
import { chipsKey } from "@/components/economy/xp-chips";
import { StreakIgnite } from "@/components/motion/StreakIgnite";
import { snapshotStreakStart } from "@/components/motion/streak-snapshot";

type Phase =
  | { name: "intro" }
  | { name: "playing"; round: number }
  | { name: "result"; result: GameResult; reward: GameReward; credited: boolean | null; chips: number };

const MODES: { id: GameMode; icon: LucideIcon; title: DictKey; desc: DictKey }[] = [
  { id: "calm", icon: Feather, title: "game.mode.calm", desc: "game.mode.calm.desc" },
  { id: "normal", icon: Clock, title: "game.mode.normal", desc: "game.mode.normal.desc" },
  { id: "blitz", icon: Timer, title: "game.mode.blitz", desc: "game.mode.blitz.desc" },
];

/** Строка про цену запуска во вступлении (#40). Отдельный компонент: часы сердечек не должны перерисовывать оболочку во время игры. */
function CostNote({ cost, forLesson }: { cost: number; forLesson: boolean }) {
  const { t } = useT();
  const hearts = useHearts();
  if (hearts.unlimited || cost <= 0) return null;
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-heart-soft px-3 py-2 text-sm font-bold text-heart-strong">
      <Heart size={16} fill="currentColor" className="mt-0.5 shrink-0" aria-hidden />
      {t(pluralKey(forLesson ? "game.cost.lesson" : "game.cost", cost), { n: cost })}
    </p>
  );
}

/**
 * Оболочка мини-игры: вступление с правилами → игра → итоги (очки, рекорд, XP).
 * lessonId — «урок игрой»: при ≥ 70% верных урок засчитывается. skills — навыки урока/темы для игры.
 * Каждый запуск стоит сердечко (#40; «урок игрой» — как урок): списываем по «Играть» и «Ещё раз», не хватает — окно «Сердечки закончились».
 */
export function GameShell({ id, lessonId, skills }: { id: string; lessonId?: string; skills?: SkillId[] }) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const meta = gameById(id)!;
  const sound = useApp((s) => s.profile.sound);
  const mode = useApp((s) => s.profile.gameMode);
  const updateProfile = useApp((s) => s.updateProfile);
  const statKey = gameStatKey(id, mode);
  const stat = useApp((s) => (statKey ? s.games[statKey] : undefined));
  const recordGame = useApp((s) => s.recordGame);
  const completeLessons = useApp((s) => s.completeLessons);
  const lesson = lessonId ? lessonMeta(lessonId) : undefined;
  const hasContext = !!lesson || (skills?.length ?? 0) > 0;
  // Урок без навыков (или навыки без нужной формы) — игре нечего проверять: зачёт урока «чужими» заданиями нечестен.
  const supported = !hasContext || (!!skills?.length && gameSupportsSkills(meta, skills));
  // Навыки для игры: универсальные берут любые с нужной формой, остальные — только свои (пересечение с темой урока).
  const playSkills = hasContext && skills?.length ? gameSkillsFor(meta, skills) : undefined;
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [round, setRound] = useState(0);
  // Не хватило сердечек на запуск: шторка «Сердечки закончились» (купить, вернуть тренировкой, выйти).
  const [noHearts, setNoHearts] = useState(false);
  const cost = entryCost("game", lesson);
  const Game = GAME_COMPONENTS[id];
  const Icon = meta.icon;
  // Инструменты во время игры: «Спокойно» — все, «Обычный» — как на ЕНТ, «Блиц» — никаких.
  useToolboxLevel(phase.name !== "playing" ? "full" : mode === "calm" ? "full" : mode === "normal" ? "ent" : "off");

  // Запуск — только из обработчика: плата списывается один раз за каждый запуск (в том числе «Ещё раз»).
  const start = () => {
    if (!useApp.getState().payEntry(cost).ok) {
      setNoHearts(true);
      track({ e: "hearts_out", where: "game" });
      return;
    }
    // Статистика (#69): каждый запуск — своё событие, «урок игрой» помечен.
    track({ e: "game_start", game: id, lesson: lesson ? 1 : 0 });
    snapshotStreakStart();
    const next = round + 1;
    setRound(next);
    setPhase({ name: "playing", round: next });
  };

  const finish = (result: GameResult) => {
    const earned0 = useApp.getState().wallet.earned;
    const reward = recordGame(id, result, mode);
    const doneEvent = gameFinishEvent(id, result.correct, result.total);
    if (doneEvent) track(doneEvent);
    if (sound) playSound("complete");
    if (reward.newBest && stat) {
      void import("canvas-confetti").then(({ default: confetti }) =>
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.35 }, colors: ["#f0b400", "#1a91d6", "#21b26f"] }),
      );
    }
    // Урок игрой: ≥ 70% верных засчитывает урок. Повторно в расписание не пишем, пока урок не «остыл».
    let credited: boolean | null = null;
    if (lesson) {
      credited = gamePassed(result.correct, result.total);
      if (credited && gameCanCredit(useApp.getState().lessons[lesson.id])) completeLessons([lesson.id], "game", result.correct / result.total);
    }
    // Чипы — вместе с бонусами за «урок игрой» (достижения) из completeLessons.
    const chips = Math.max(0, useApp.getState().wallet.earned - earned0);
    setPhase({ name: "result", result, reward, credited, chips });
  };

  const exitHref = lesson ? "/learn" : "/practice";

  // Выход крестиком посреди игры (#69): раунд брошен, итогов не будет.
  const close = () => {
    if (phase.name === "playing") track({ e: "game_quit", game: id });
    router.push(exitHref);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Фоновая музыка игры (Bit Arcade): только пока идёт раунд. */}
      <ActivityMusic mode="game" active={phase.name === "playing"} />
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
          >
            <X size={24} />
          </button>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2 text-lg font-extrabold leading-tight">
              <Icon size={20} strokeWidth={2.4} style={{ color: meta.ink }} className="shrink-0" />
              <span className="truncate">{l(meta.title)}</span>
            </span>
            {lesson && (
              <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted">
                <BookOpen size={12} className="shrink-0" />
                <span className="truncate">{t("modes.game.lesson", { title: l(lesson.title) })}</span>
              </span>
            )}
          </span>
          {phase.name === "playing" && <MusicToggle />}
          {phase.name === "playing" && <ToolboxButton variant="icon" />}
          {statKey && (
            <span className="flex items-center gap-1 text-sm font-extrabold text-warning-strong">
              <Trophy size={16} className="text-gold" /> {stat?.best ?? 0}
            </span>
          )}
        </div>
      </header>

      {/* Во время игры поле занимает всю ширину/высоту под шапкой — отступы задаёт сама игра. */}
      <main className={cn("mx-auto flex w-full max-w-2xl flex-1 flex-col", phase.name !== "playing" && "px-4 pb-8")}>
        {phase.name === "intro" && (
          <div className="flex flex-1 flex-col gap-5 pt-4 animate-fade-in">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] shadow-lg" style={{ background: meta.color, color: meta.ink }}>
                <Icon size={40} strokeWidth={2.2} />
              </span>
              <h1 className="text-2xl font-extrabold">{l(meta.title)}</h1>
              <p className="font-semibold text-muted">{l(meta.description)}</p>
            </div>
            {lesson && supported && (
              <p className="flex items-start gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
                <BookOpen size={16} className="mt-0.5 shrink-0" /> {t("modes.game.lessonHint", { need: Math.round(GAME_PASS * 100) })}
              </p>
            )}
            {!supported && (
              <p className="flex items-start gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
                <Info size={16} className="mt-0.5 shrink-0" /> {t("modes.game.unsupported")}
              </p>
            )}
            <div className="rounded-3xl border-2 border-border bg-surface p-4">
              <p className="mb-1 text-sm font-extrabold text-muted">{t("game.rules")}</p>
              <p className="whitespace-pre-line font-semibold leading-relaxed">{l(meta.rules)}</p>
            </div>
            <div role="radiogroup" aria-label={t("game.mode")} className="flex flex-col gap-2">
              <p className="text-sm font-extrabold text-muted">{t("game.mode")}</p>
              {MODES.map((m) => {
                const on = m.id === mode;
                const MIcon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => updateProfile({ gameMode: m.id })}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors active:translate-y-[2px]",
                      on ? "border-primary bg-primary-soft shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
                    )}
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-action-primary text-white" : "bg-surface-2 text-muted")}>
                      <MIcon size={20} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block font-extrabold", on && "text-primary")}>{t(m.title)}</span>
                      <span className="block text-xs font-semibold text-muted">{t(m.desc)}</span>
                      {m.id === "calm" && <span className="mt-0.5 block text-[11px] font-bold text-muted">{t("game.mode.calm.mastery")}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center gap-4 text-sm font-bold text-muted">
              {statKey ? (
                <>
                  <span>{stat ? t("game.best", { n: stat.best }) : t("game.noBest")}</span>
                  {stat && <span>· {t("game.plays", { n: stat.plays })}</span>}
                </>
              ) : (
                <span>{t("game.calmNoRecord")}</span>
              )}
            </div>
            {supported && <CostNote cost={cost} forLesson={!!lesson} />}
            <div className="flex-1" />
            {/* Кнопка всегда видна внизу экрана, даже если правила и выбор темпа не помещаются. */}
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg from-70% to-transparent px-4 pb-4 pt-6">
              <Button size="lg" block onClick={start} disabled={!supported} icon={<Play size={20} fill="currentColor" />} autoFocus>
                {t("game.play")}
                {supported && <HeartCost n={cost} variant="solid" />}
              </Button>
            </div>
          </div>
        )}

        {phase.name === "playing" && (
          <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-surface-2" />}>
            <Game key={phase.round} lang={lang} sound={sound} mode={mode} onFinish={finish} skills={playSkills} />
          </Suspense>
        )}

        {phase.name === "result" && (
          <div className="flex flex-1 flex-col gap-5 pt-6 animate-fade-in">
            <div className="flex flex-col items-center gap-2 text-center">
              <Mascot mood={phase.reward.newBest ? "celebrate" : "happy"} size={100} />
              <p className="text-sm font-extrabold uppercase text-muted">{t("game.over")}</p>
              <p className="text-5xl font-black">{phase.result.score}</p>
              <p className="font-bold text-muted">{t("game.score")}</p>
              {phase.reward.newBest && (
                <span className="flex items-center gap-1.5 rounded-full bg-gold-soft px-4 py-1.5 font-extrabold text-warning-strong animate-pop">
                  <Trophy size={18} className="text-gold" /> {t("game.newBest")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-success bg-surface p-3 text-center">
                <p className="text-xs font-extrabold text-muted">{t("game.correct")}</p>
                <p className="text-2xl font-extrabold text-success-strong">
                  {phase.result.correct}/{phase.result.total}
                </p>
              </div>
              <div className="rounded-2xl border-2 border-gold bg-surface p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-muted">
                  <XpIcon size={14} /> {t("res.xp")}
                </p>
                <p className="text-2xl font-extrabold text-warning-strong">+{phase.reward.xp}</p>
              </div>
            </div>
            {phase.chips > 0 && (
              <div className="rounded-2xl border-2 border-gold bg-surface p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-muted">
                  <Cpu size={14} className="text-gold" aria-hidden /> {t("xp.chips")}
                </p>
                <p className="text-2xl font-extrabold text-warning-strong">{t(chipsKey("xp.chipsPlus", phase.chips), { n: phase.chips })}</p>
              </div>
            )}
            <StreakIgnite />
            {!phase.reward.newBest && stat && statKey && (
              <MascotSays mood="happy" size={56}>
                {t("game.beat", { n: stat.best })}
              </MascotSays>
            )}
            {!statKey && <p className="text-center text-sm font-bold text-muted">{t("game.calmNoRecord")}</p>}
            {phase.credited === true && (
              <p className="flex items-center justify-center gap-2 rounded-2xl border-2 border-success/40 bg-success-soft px-3 py-3 text-center font-extrabold text-success-strong animate-pop">
                <Check size={20} strokeWidth={3} /> {t("modes.game.credited")}
              </p>
            )}
            {phase.credited === false && (
              <p className="rounded-2xl bg-warning-soft px-3 py-2 text-center text-sm font-bold text-warning-strong">
                {phase.result.total < GAME_MIN_TOTAL
                  ? t("modes.game.tooShort", { min: GAME_MIN_TOTAL })
                  : t("modes.game.notCredited", {
                      need: Math.round(GAME_PASS * 100),
                      n: Math.round((phase.result.correct / phase.result.total) * 100),
                    })}
              </p>
            )}
            <div className="flex-1" />
            <div className="flex flex-col gap-3">
              <Button size="lg" block onClick={start} icon={<RotateCcw size={20} />}>
                {t("game.again")}
                <HeartCost n={cost} variant="solid" />
              </Button>
              {lesson ? (
                <ButtonLink href="/learn" variant="secondary" block icon={<MapIcon size={18} />}>
                  {t("modes.game.toMap")}
                </ButtonLink>
              ) : (
                <Button variant="secondary" block onClick={() => router.push("/practice")}>
                  {t("game.toPractice")}
                </Button>
              )}
            </div>
          </div>
        )}
      </main>

      <OutOfHearts
        open={noHearts}
        need={cost}
        onClose={() => setNoHearts(false)}
        onResume={() => {
          // Сердечек хватает (куплены, вернулись или вернула тренировка) — сразу запускаем игру.
          setNoHearts(false);
          start();
        }}
        onExit={() => router.push(exitHref)}
      />
    </div>
  );
}
