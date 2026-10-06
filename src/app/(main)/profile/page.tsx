"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExplainStyle, Goal, Lang, Theme } from "@/lib/types";
import { useApp } from "@/lib/store";
import { TARGET_MAX, TARGET_MIN, WEEKLY_MAX, WEEKLY_MIN, daysText, daysUntil, isExamDateValid } from "@/lib/goals";
import { cn } from "@/lib/cn";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { AvatarPicker } from "@/components/app/AvatarPicker";
import { LevelCard } from "@/components/app/Widgets";
import { MyCosmetics } from "@/components/cosmetics/MyCosmetics";
import { ProfileCard } from "@/components/cosmetics/ProfileCard";
import { CourseProgressBadge } from "@/components/progress/CourseProgressCard";
import { Row, Segmented } from "@/components/goals/controls";
import { NumberStepper } from "@/components/goals/NumberStepper";
import { ReminderSettings } from "@/components/goals/ReminderSettings";
import { useMinuteClock } from "@/components/goals/useClock";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PlanStatusCard } from "@/components/plans/PlanStatusCard";
import { TrackSettings } from "@/components/school/TrackSettings";
import { useEntVisible } from "@/components/school/useEntVisible";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { AchievementsSection } from "@/components/profile/AchievementsSection";
import { AnalyticsToggle } from "@/components/profile/AnalyticsToggle";
import { TipsReset } from "@/components/profile/TipsReset";
import { CaseWaiting } from "@/components/rewards/CaseWaiting";
import { FeedbackLink } from "@/components/issue/FeedbackLink";
import { ReportEntry } from "@/components/report/ReportShareSheet";
import { MusicRow } from "@/components/music/MusicRow";

const NAME_MAX = 30;
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
  const { t, lang } = useT();
  const ent = useEntVisible();
  const profile = useApp((s) => s.profile);
  const update = useApp((s) => s.updateProfile);
  const reset = useApp((s) => s.resetProgress);
  const now = useMinuteClock();
  const today = todayKey(new Date(now));

  const [confirm, setConfirm] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  /** Дата ЕНТ, введённая вручную, но не принятая (раньше сегодняшнего дня / слишком далеко); null — поле показывает сохранённую дату. */
  const [dateDraft, setDateDraft] = useState<string | null>(null);

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

  /** Дата ЕНТ: пусто — сбросить; верная — сохранить; неверная — показать подсказку и не сохранять. */
  const changeDate = (v: string) => {
    if (v === "" || isExamDateValid(v, today)) {
      setDateDraft(null);
      update({ examDate: v || null });
    } else setDateDraft(v);
  };
  const dateBad = dateDraft !== null && dateDraft !== "";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t("prof.title")}</h1>
      <CaseWaiting />

      {/* Карточка профиля: фон, аватар с рамкой, имя и титул (украшения — из магазина и кейса); уровень — в LevelCard ниже, не дублируем */}
      <ProfileCard
        tour
        showLevel={false}
        onEditAvatar={() => setPickAvatar(true)}
        nameEditor={
          editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
              className="flex w-full flex-col gap-2"
            >
              <label htmlFor="prof-name" className="text-xs font-extrabold uppercase tracking-wide text-muted">
                {t("prof2.name.label")}
              </label>
              <input
                id="prof-name"
                autoFocus
                value={draft}
                maxLength={NAME_MAX}
                placeholder={t("prof2.name.placeholder")}
                onChange={(e) => setDraft(e.target.value.slice(0, NAME_MAX))}
                className="h-11 w-full rounded-xl border-2 border-primary bg-surface px-3 text-lg font-extrabold outline-none"
              />
              {/* Подсказка про 30 символов — только пока имя редактируется, в карточке она не висит. */}
              <p className="text-xs font-semibold text-muted">{t("prof2.name.hint")}</p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-10" disabled={!draft.trim()}>
                  {t("prof2.name.save")}
                </Button>
                <Button size="sm" variant="ghost" className="h-10" onClick={() => setEditingName(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          ) : undefined
        }
      >
        {!editingName && (
          <Button size="sm" variant="secondary" className="h-10" icon={<Pencil size={14} />} onClick={startEditName}>
            {t("prof2.name.edit")}
          </Button>
        )}
      </ProfileCard>

      <LevelCard />
      {/* % курса (у школьника — % класса, #71) */}
      <CourseProgressBadge />

      {/* Украшения: купленное и выпавшее из кейса — надеть / снять */}
      <MyCosmetics />

      {/* Достижения — сразу после украшений: страница длинная, внизу их никто не увидит (этап 16В) */}
      <AchievementsSection />

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
            <div>
              <Row label={t("prof2.goals.examDate")} hint={
                  daysLeft === null ? t("prof2.goals.examDate.hint") : daysLeft > 0 ? t("prof2.goals.daysLeft", { days: daysText(daysLeft, lang) }) : daysLeft === 0 ? t("goals.card.today") : t("goals.card.past")
                }>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <input
                    type="date"
                    value={dateDraft ?? profile.examDate ?? ""}
                    min={today}
                    onChange={(e) => changeDate(e.target.value)}
                    aria-label={t("prof2.goals.examDate")}
                    aria-invalid={dateBad}
                    aria-describedby={dateBad ? "prof-date-bad" : undefined}
                    className={cn(
                      "h-11 min-w-0 rounded-xl border-2 bg-surface px-3 font-extrabold outline-none focus:border-primary",
                      dateBad ? "border-warning" : "border-border",
                    )}
                  />
                  {(profile.examDate || dateBad) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-auto min-h-10"
                      onClick={() => {
                        setDateDraft(null);
                        update({ examDate: null });
                      }}
                    >
                      {t("prof2.goals.examClear")}
                    </Button>
                  )}
                </div>
              </Row>
              {dateBad && (
                <p id="prof-date-bad" role="alert" className="-mt-1 pb-3 text-sm font-bold text-warning-strong">
                  {t("goals15.date.range")}
                </p>
              )}
            </div>
            <div className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <label htmlFor="prof-target" className="font-extrabold">
                  {t("prof2.goals.target")}
                </label>
                <NumberStepper
                  value={profile.targetScore}
                  min={TARGET_MIN}
                  max={TARGET_MAX}
                  onChange={(targetScore) => update({ targetScore, targetScoreSet: true })}
                  decLabel={t("goals15.target.minus")}
                  incLabel={t("goals15.target.plus")}
                  suffix={profile.targetScoreSet ? t("goals15.target.of") : undefined}
                  // Цель ещё не выбрана («Пока не знаю» в онбординге): число — просто значение по умолчанию.
                  dim={!profile.targetScoreSet}
                />
              </div>
              {!profile.targetScoreSet && <p className="mt-1 text-sm font-extrabold text-muted">{t("goals.target.unset")}</p>}
              <input
                id="prof-target"
                type="range"
                min={TARGET_MIN}
                max={TARGET_MAX}
                step={1}
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
        <Row label={t("prof2.goals.weekly")} hint={t("goals15.weekly.hint")}>
          <NumberStepper
            value={profile.weeklyLessons}
            min={WEEKLY_MIN}
            max={WEEKLY_MAX}
            onChange={(weeklyLessons) => update({ weeklyLessons })}
            decLabel={t("goals15.weekly.minus")}
            incLabel={t("goals15.weekly.plus")}
          />
        </Row>
      </Card>

      {/* Напоминания */}
      <Card className="py-1">
        <h2 className="py-3 text-lg font-extrabold">{t("remind.title")}</h2>
        <ReminderSettings />
      </Card>

      <Card className="divide-y-2 divide-border py-1">
        {/* Язык, тема и звук — вместе, вверху карточки: метка проводника на них (компактная цель, вся карточка выше экрана). */}
        <div data-tour="profile-settings" className="divide-y-2 divide-border">
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
        </div>
        <MusicRow />
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
        <Row label={t("prof.vibration")}>
          <OnOff label={t("prof.vibration")} value={profile.vibration} onChange={(vibration) => update({ vibration })} />
        </Row>
        <Row label={t("prof.reduceMotion")} hint={t("prof.reduceMotion.desc")}>
          <OnOff label={t("prof.reduceMotion")} value={profile.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
        </Row>
      </Card>

      {/* Статистика (#69, сама скрыта, пока сбор выключен) и отзывы */}
      <AnalyticsToggle />
      <TipsReset />
      <ReportEntry />
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
