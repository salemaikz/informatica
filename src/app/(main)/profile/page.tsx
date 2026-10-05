"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExplainStyle, Goal, Lang, Theme } from "@/lib/types";
import { useApp } from "@/lib/store";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { daysText, daysUntil } from "@/lib/goals";
import { cn } from "@/lib/cn";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { AchievementBadge } from "@/components/app/AchievementBadge";
import { Avatar } from "@/components/app/Avatar";
import { AvatarPicker } from "@/components/app/AvatarPicker";
import { LevelCard } from "@/components/app/Widgets";
import { CourseProgressBadge } from "@/components/progress/CourseProgressCard";
import { Row, Segmented } from "@/components/goals/controls";
import { ReminderSettings } from "@/components/goals/ReminderSettings";
import { useMinuteClock } from "@/components/goals/useClock";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PlanStatusCard } from "@/components/plans/PlanStatusCard";
import { TrackSettings } from "@/components/school/TrackSettings";
import { useEntVisible } from "@/components/school/useEntVisible";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { AnalyticsToggle } from "@/components/profile/AnalyticsToggle";
import { FeedbackLink } from "@/components/issue/FeedbackLink";

const NAME_MAX = 30;
const WEEKLY = [2, 3, 4, 5, 7];
/** Клавиши, которыми двигают ползунок: только они подтверждают цель (Tab на ползунок — нет). */
const CONFIRM_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

function OnOff({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useT();
  return (
    <Segmented<string>
      label={label}
      value={value ? "on" : "off"}
      onChange={(v) => onChange(v === "on")}
      options={[
        { id: "on", label: t("common.on") },
        { id: "off", label: t("common.off") },
      ]}
    />
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { t, l, lang } = useT();
  const ent = useEntVisible();
  const profile = useApp((s) => s.profile);
  const update = useApp((s) => s.updateProfile);
  const achievements = useApp((s) => s.achievements);
  const reset = useApp((s) => s.resetProgress);
  const now = useMinuteClock();
  const today = todayKey(new Date(now));

  const [confirm, setConfirm] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");

  /** Цель «пока не выбрана»: любое касание ползунка подтверждает текущее значение. */
  const confirmTarget = () => {
    if (!useApp.getState().profile.targetScoreSet) update({ targetScoreSet: true });
  };

  const startEditName = () => {
    setDraft(profile.name);
    setEditingName(true);
  };
  const saveName = () => {
    const name = draft.trim().slice(0, NAME_MAX);
    if (!name) return;
    update({ name });
    setEditingName(false);
  };

  const daysLeft = daysUntil(profile.examDate, today);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t("prof.title")}</h1>

      {/* Аватар и имя */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar config={profile.avatar} name={profile.name} size={76} />
            <button
              type="button"
              onClick={() => setPickAvatar(true)}
              aria-label={t("prof2.avatar.edit")}
              className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow transition-transform active:scale-95"
            >
              <Pencil size={16} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <label htmlFor="prof-name" className="text-xs font-extrabold uppercase tracking-wide text-muted">
                {t("prof2.name.label")}
              </label>
            ) : (
              <p id="prof-name-label" className="text-xs font-extrabold uppercase tracking-wide text-muted">
                {t("prof2.name.label")}
              </p>
            )}
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
                className="mt-1 flex flex-col gap-2"
              >
                <input
                  id="prof-name"
                  autoFocus
                  value={draft}
                  maxLength={NAME_MAX}
                  placeholder={t("prof2.name.placeholder")}
                  onChange={(e) => setDraft(e.target.value.slice(0, NAME_MAX))}
                  className="h-11 w-full rounded-xl border-2 border-primary bg-surface px-3 text-lg font-extrabold outline-none"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="h-10" disabled={!draft.trim()}>
                    {t("prof2.name.save")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-10" onClick={() => setEditingName(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-0.5 flex flex-col items-start gap-2">
                <p aria-labelledby="prof-name-label" className="max-w-full break-words text-2xl font-extrabold leading-tight">
                  {profile.name || "—"}
                </p>
                <Button size="sm" variant="secondary" className="h-10" icon={<Pencil size={14} />} onClick={startEditName}>
                  {t("prof2.name.edit")}
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-muted">{t("prof2.name.hint")}</p>
          </div>
        </div>
      </Card>

      <LevelCard />
      {/* % курса (у школьника — % класса, #71) */}
      <CourseProgressBadge />

      {/* Цели */}
      {/* Тариф: бесплатный / Лайт / Безлимит (пробный) */}
      <PlanStatusCard />

      {/* Программа: ЕНТ или школа, класс */}
      <TrackSettings />

      <Card id="goals" className="scroll-mt-20 divide-y-2 divide-border py-1">
        <h2 className="py-3 text-lg font-extrabold">{t("prof2.goals.title")}</h2>
        {/* Дата и целевой балл — только для подготовки к ЕНТ (#52). */}
        {ent && (
          <>
            <Row label={t("prof2.goals.examDate")} hint={
                daysLeft === null ? t("prof2.goals.examDate.hint") : daysLeft > 0 ? t("prof2.goals.daysLeft", { days: daysText(daysLeft, lang) }) : daysLeft === 0 ? t("goals.card.today") : t("goals.card.past")
              }>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={profile.examDate ?? ""}
                  min={today}
                  onChange={(e) => update({ examDate: e.target.value || null })}
                  aria-label={t("prof2.goals.examDate")}
                  className="h-11 rounded-xl border-2 border-border bg-surface px-3 font-extrabold outline-none focus:border-primary"
                />
                {profile.examDate && (
                  <Button size="sm" variant="ghost" className="h-auto min-h-10" onClick={() => update({ examDate: null })}>
                    {t("prof2.goals.examClear")}
                  </Button>
                )}
              </div>
            </Row>
            <div className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="prof-target" className="font-extrabold">
                  {t("prof2.goals.target")}
                </label>
                {profile.targetScoreSet ? (
                  <span className="shrink-0 whitespace-nowrap text-xl font-extrabold text-primary">{t("prof2.goals.target.value", { n: profile.targetScore })}</span>
                ) : (
                  // Цель ещё не выбрана («Пока не знаю» в онбординге): число на ползунке — просто положение по умолчанию.
                  <span className="min-w-0 text-right text-sm font-extrabold text-muted">{t("goals.target.unset")}</span>
                )}
              </div>
              <input
                id="prof-target"
                type="range"
                min={5}
                max={50}
                step={5}
                value={profile.targetScore}
                onChange={(e) => update({ targetScore: Number(e.target.value), targetScoreSet: true })}
                // Любое касание ползунка подтверждает цель, даже если значение не изменилось (onChange в этом случае не сработает).
                onPointerUp={confirmTarget}
                onKeyUp={(e) => {
                  if (CONFIRM_KEYS.has(e.key)) confirmTarget();
                }}
                className={cn("mt-2 h-8 w-full cursor-pointer accent-primary", !profile.targetScoreSet && "opacity-60")}
              />
              <div className="flex justify-between text-xs font-bold text-muted" aria-hidden="true">
                <span>5</span>
                <span>25</span>
                <span>50</span>
              </div>
            </div>
          </>
        )}
        <Row label={t("prof2.goals.weekly")}>
          <Segmented<number> label={t("prof2.goals.weekly")} value={profile.weeklyLessons} onChange={(weeklyLessons) => update({ weeklyLessons })} options={WEEKLY.map((n) => ({ id: n, label: String(n) }))} />
        </Row>
      </Card>

      {/* Напоминания */}
      <Card className="py-1">
        <h2 className="py-3 text-lg font-extrabold">{t("remind.title")}</h2>
        <ReminderSettings />
      </Card>

      <Card>
        <p className="mb-3 text-lg font-extrabold">{t("prof.achievements")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const got = !!achievements[a.id];
            return (
              <div
                key={a.id}
                className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center", got ? "border-gold bg-gold-soft" : "border-border opacity-70")}
                title={l(a.description)}
              >
                <AchievementBadge icon={a.icon} got={got} size={44} />
                <span className="text-sm font-extrabold">{l(a.title)}</span>
                <span className="text-xs font-semibold text-muted">{l(a.description)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="divide-y-2 divide-border py-1">
        <Row label={t("prof.lang")}>
          <Segmented<Lang>
            label={t("prof.lang")}
            value={profile.lang}
            onChange={(lang) => update({ lang })}
            options={[
              { id: "kk", label: "Қазақша" },
              { id: "ru", label: "Русский" },
            ]}
          />
        </Row>
        <Row label={t("prof.goal")}>
          <Segmented<Goal>
            label={t("prof.goal")}
            value={profile.goal}
            onChange={(goal) => update({ goal })}
            options={(["ent", "school", "interest"] as const).map((g) => ({ id: g, label: t(`goal.${g}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.style")}>
          <Segmented<ExplainStyle>
            label={t("prof.style")}
            value={profile.style}
            onChange={(style) => update({ style })}
            options={(["short", "examples", "steps"] as const).map((s) => ({ id: s, label: t(`style.${s}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.daily")}>
          <Segmented<number>
            label={t("prof.daily")}
            value={profile.dailyGoalXp}
            onChange={(dailyGoalXp) => update({ dailyGoalXp })}
            options={[20, 50, 100].map((x) => ({ id: x, label: `${t(`daily.${x}` as DictKey)} · ${x} XP` }))}
          />
        </Row>
        <Row label={t("prof.theme")}>
          <Segmented<Theme>
            label={t("prof.theme")}
            value={profile.theme}
            onChange={(theme) => update({ theme })}
            options={(["system", "light", "dark"] as const).map((th) => ({ id: th, label: t(`theme.${th}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.sound")}>
          <OnOff label={t("prof.sound")} value={profile.sound} onChange={(sound) => update({ sound })} />
        </Row>
        <Row label={t("prof.vibration")}>
          <OnOff label={t("prof.vibration")} value={profile.vibration} onChange={(vibration) => update({ vibration })} />
        </Row>
        <Row label={t("prof.reduceMotion")} hint={t("prof.reduceMotion.desc")}>
          <OnOff label={t("prof.reduceMotion")} value={profile.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
        </Row>
      </Card>

      {/* Статистика (#69, сама скрыта, пока сбор выключен) и отзывы */}
      <AnalyticsToggle />
      <FeedbackLink />

      {/* Документы: политика и условия */}
      <Card>
        <h2 className="text-lg font-extrabold">{t("legal.docs.title")}</h2>
        <LegalLinks className="mt-1" />
      </Card>

      {/* Сброс прогресса — небольшой карточкой внизу */}
      <Card className="flex justify-center p-2 sm:p-2">
        <Button variant="ghost" onClick={() => setConfirm(true)} icon={<RotateCcw size={18} />} className="text-danger">
          {t("prof.reset")}
        </Button>
      </Card>

      <AvatarPicker open={pickAvatar} value={profile.avatar} name={profile.name} onChange={(avatar) => update({ avatar })} onClose={() => setPickAvatar(false)} />

      <Modal open={confirm} onClose={() => setConfirm(false)} label={t("prof.reset")}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-lg font-extrabold">{t("prof.resetConfirm")}</p>
          <Button
            variant="danger"
            block
            onClick={() => {
              reset();
              router.replace("/onboarding");
            }}
          >
            {t("prof.reset")}
          </Button>
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
