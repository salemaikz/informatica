"use client";

import { Check, ChevronRight, Radio, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { shortDate } from "@/lib/date";
import { ENTRY_COST } from "@/lib/economy";
import { DUEL_MODE_IDS } from "@/lib/duel/modes";
import { duelTopics, isDuelTopic, isEntTopic } from "@/lib/duel/topics";
import { duelPlayHref, newDuelSeed } from "@/lib/duel/api";
import { liveHref, socialStatus } from "@/lib/duel/live";
import type { DuelRecord } from "@/lib/duel/record";
import type { DuelModeId } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { HeartCost } from "@/components/economy/HeartCost";
import { Mascot } from "@/components/mascot/Mascot";
import { useEntVisible } from "@/components/school/useEntVisible";
import { BotChip } from "./BotChip";
import { MODE_ICON, MODE_TITLE, modeDesc, topicTitle } from "./mode-meta";

// Хаб дуэлей /duel (этап 16Д, Ф1; docs/specs/duels.md §9): главная кнопка — «Сыграть с Битом» в выбранном режиме,
// «Найти соперника» (живой «Блиц») и «Играть с другом вживую» (комната по ссылке) — когда соцчасть включена на сервере
// (GET /api/social/home, Ф4), иначе «Скоро»; «Вызвать друга» — Ф3. Сетка режимов, тема для «По теме», последние 3 дуэли.

/** Выбор режима и темы помним на этом устройстве (удобство, не прогресс). */
const PICK_KEY = "informatica-duel-pick";

interface Pick {
  mode: DuelModeId;
  topic?: string;
}

function readPick(): Pick {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PICK_KEY) ?? "null") as Partial<Pick> | null;
    const mode = raw && DUEL_MODE_IDS.includes(raw.mode as DuelModeId) ? (raw.mode as DuelModeId) : "blitz";
    const topic = raw && isDuelTopic(raw.topic) ? raw.topic : undefined;
    return mode === "topic" && !topic ? { mode: "blitz" } : { mode, topic };
  } catch {
    return { mode: "blitz" };
  }
}

function savePick(p: Pick) {
  try {
    window.localStorage.setItem(PICK_KEY, JSON.stringify(p));
  } catch {
    // хранилище недоступно — выбор просто не запомнится
  }
}

export function DuelHub() {
  const { t, l } = useT();
  const router = useRouter();
  const [pick, setPick] = useState<Pick>(readPick);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const history = useApp((s) => s.duels.history);
  // Соцчасть: null — ещё не знаем; on — живые матчи доступны; off — «Скоро»; down — временно недоступны.
  const [social, setSocial] = useState<"on" | "off" | "down" | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    socialStatus(ctl.signal).then((s) => {
      if (!ctl.signal.aborted) setSocial(s);
    });
    return () => ctl.abort();
  }, []);

  const topicName = (topic: string | undefined): string => {
    const title = topic ? topicTitle(topic) : null;
    if (!title) return "";
    return title === "school" ? t("duel.topic.school") : l(title);
  };
  const pickLabel = pick.mode === "topic" && pick.topic ? `${t(MODE_TITLE.topic)}: ${topicName(pick.topic)}` : t(MODE_TITLE[pick.mode]);

  const choose = (p: Pick) => {
    setPick(p);
    savePick(p);
  };

  const start = () => {
    if (pick.mode === "topic" && !pick.topic) {
      setTopicsOpen(true);
      return;
    }
    router.push(duelPlayHref(pick.mode, newDuelSeed(), pick.topic));
  };

  /** Комната для друга в выбранном режиме (живой бой по ссылке). */
  const startRoom = () => {
    if (pick.mode === "topic" && !pick.topic) {
      setTopicsOpen(true);
      return;
    }
    router.push(liveHref({ room: pick.mode, topic: pick.topic }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("duel.title")}</h1>
        <p className="font-semibold text-muted">{t("duel.subtitle")}</p>
      </div>

      {/* Главное действие: матч с Битом. Бит всегда помечен «бот». */}
      <button
        type="button"
        onClick={start}
        data-tour="duel-bot"
        className="flex w-full items-center gap-3 rounded-3xl bg-action-primary p-4 text-left text-white shadow-[0_5px_0_var(--action-primary-edge)] transition-transform active:translate-y-1 active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="shrink-0 rounded-2xl bg-white/15 p-1">
          <Mascot mood="happy" size={56} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-xl font-extrabold leading-tight">
            {t("duel.playBot")}
            <HeartCost n={ENTRY_COST.duel} variant="solid" />
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            {t("duel.playBot.mode", { mode: pickLabel })}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold opacity-90">
            <BotChip className="border-white/30 bg-white/15 text-white" />
            {t("duel.playBot.desc")}
          </span>
        </span>
      </button>

      {/* Живые соперники и комната с другом (Ф4) — когда соцчасть включена; вызов друга — Ф3. */}
      <section data-tour="duel-soon" className="flex flex-col gap-2">
        {social === "on" && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "duel.find" as const, desc: "duel.find.desc" as const, Icon: Users, go: () => router.push(liveHref({ find: true })), id: "duel-find" },
              { key: "duel.live.room" as const, desc: "duel.live.room.desc" as const, Icon: Radio, go: startRoom, id: "duel-room" },
            ].map(({ key, desc, Icon, go, id }) => (
              <button
                key={key}
                type="button"
                onClick={go}
                data-testid={id}
                className="flex min-h-14 flex-col items-start gap-1 rounded-2xl border-2 border-primary/40 bg-surface px-3 py-2.5 text-left shadow-[0_3px_0_var(--border)] transition-transform hover:bg-surface-2 active:translate-y-0.5"
              >
                <span className="flex items-center gap-1.5 text-sm font-extrabold text-ink-primary">
                  <Icon size={18} aria-hidden />
                  {t(key)}
                </span>
                <span className="text-xs font-semibold text-muted">{t(desc)}</span>
              </button>
            ))}
          </div>
        )}
        {social === "down" && <p className="rounded-2xl bg-surface-2 px-3 py-2 text-xs font-bold text-muted">{t("duel.live.unavailable")}</p>}
        <div className={cn("grid gap-2", social === "on" ? "grid-cols-1" : "grid-cols-2")}>
          {[
            ...(social === "on" ? [] : [{ key: "duel.find" as const, Icon: Users }]),
            { key: "duel.invite" as const, Icon: UserPlus },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              disabled
              aria-disabled
              className="flex min-h-14 flex-col items-start gap-1 rounded-2xl border-2 border-dashed border-border bg-surface px-3 py-2.5 text-left text-muted"
            >
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                <Icon size={18} aria-hidden />
                {t(key)}
              </span>
              <Pill>{t("duel.soon")}</Pill>
            </button>
          ))}
        </div>
        {social !== "on" && <p className="text-xs font-semibold text-muted">{t("duel.soon.hint")}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">{t("duel.modes")}</h2>
        <div role="radiogroup" aria-label={t("duel.modes")} className="grid grid-cols-2 gap-3">
          {DUEL_MODE_IDS.map((mode) => {
            const on = pick.mode === mode;
            const Icon = MODE_ICON[mode];
            const isTopic = mode === "topic";
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={on}
                data-mode={mode}
                onClick={() => (isTopic ? setTopicsOpen(true) : choose({ mode }))}
                className={cn(
                  "flex flex-col gap-2 rounded-3xl border-2 p-3.5 text-left transition-colors active:translate-y-0.5",
                  on ? "border-primary bg-primary-soft shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", on ? "bg-action-primary text-white" : "bg-surface-2 text-muted")}>
                    <Icon size={20} strokeWidth={2.4} aria-hidden />
                  </span>
                  {on && <Check size={18} strokeWidth={3} className="text-ink-primary" aria-hidden />}
                </span>
                <span className={cn("font-extrabold leading-tight", on && "text-ink-primary")}>{t(MODE_TITLE[mode])}</span>
                <span className="text-xs font-semibold text-muted">
                  {isTopic && on && pick.topic ? topicName(pick.topic) : modeDesc(t, mode)}
                </span>
                {isTopic && on && <span className="text-xs font-extrabold text-ink-primary">{t("duel.topic.change")}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <RecentDuels history={history} topicName={topicName} />

      <TopicSheet
        open={topicsOpen}
        current={pick.mode === "topic" ? pick.topic : undefined}
        onClose={() => setTopicsOpen(false)}
        onPick={(topic) => {
          choose({ mode: "topic", topic });
          setTopicsOpen(false);
        }}
        topicName={topicName}
      />
    </div>
  );
}

/** Последние 3 дуэли: режим, соперник (у бота — «Бит» и чип «бот»), счёт, исход. */
function RecentDuels({ history, topicName }: { history: readonly DuelRecord[]; topicName: (topic: string | undefined) => string }) {
  const { t, lang } = useT();
  const last = history.slice(0, 3);
  return (
    <section data-testid="duel-recent">
      <h2 className="mb-3 text-lg font-extrabold">{t("duel.recent")}</h2>
      {last.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border px-4 py-5 text-center text-sm font-semibold text-muted">{t("duel.recent.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {last.map((r) => {
            const Icon = MODE_ICON[r.mode];
            const date = shortDate(new Date(r.at), lang);
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-extrabold">
                    {t(MODE_TITLE[r.mode])}
                    {r.mode === "topic" && r.topic ? ` · ${topicName(r.topic)}` : ""}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
                    {r.opp === "bot" ? (
                      <>
                        {t("duel.bot.name")} <BotChip />
                      </>
                    ) : (
                      (r.oppName ?? "")
                    )}
                    <span aria-hidden>·</span>
                    <span>{date}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-base font-extrabold">
                    {r.you.score} : {r.rival.score}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-extrabold",
                      r.result === "win" ? "text-ink-success" : r.result === "draw" ? "text-ink-warning" : "text-muted",
                    )}
                  >
                    {r.result === "win" ? t("duel.result.win") : r.result === "draw" ? t("duel.result.draw") : t("duel.result.lossShort")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Выбор темы для «По теме»: темы ЕНТ (в школьном треке скрыты) и разделы курса. */
function TopicSheet({
  open,
  current,
  onClose,
  onPick,
  topicName,
}: {
  open: boolean;
  current?: string;
  onClose: () => void;
  onPick: (topic: string) => void;
  topicName: (topic: string | undefined) => string;
}) {
  const { t } = useT();
  const ent = useEntVisible();
  const all = useMemo(() => duelTopics().filter((x) => topicTitle(x) !== null), []);
  const groups = [
    { key: "duel.topic.ent" as const, items: ent ? all.filter(isEntTopic) : [] },
    { key: "duel.topic.units" as const, items: all.filter((x) => !isEntTopic(x)) },
  ].filter((g) => g.items.length > 0);
  return (
    <Modal open={open} onClose={onClose} label={t("duel.topic.pick")}>
      <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto pb-[max(8px,env(safe-area-inset-bottom))]">
        <h2 className="text-xl font-extrabold">{t("duel.topic.pick")}</h2>
        <p className="-mt-2 text-sm font-semibold text-muted">{modeDesc(t, "topic")}</p>
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 text-sm font-extrabold text-muted">{t(g.key)}</h3>
            <ul className="flex flex-col gap-2">
              {g.items.map((topic) => {
                const on = topic === current;
                return (
                  <li key={topic}>
                    <button
                      type="button"
                      onClick={() => onPick(topic)}
                      aria-pressed={on}
                      data-topic={topic}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left text-sm font-bold transition-colors",
                        on ? "border-primary bg-primary-soft text-ink-primary" : "border-border bg-surface hover:bg-surface-2",
                      )}
                    >
                      <span className="min-w-0 flex-1">{topicName(topic)}</span>
                      {on ? <Check size={18} strokeWidth={3} aria-hidden /> : <ChevronRight size={18} className="text-muted" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
