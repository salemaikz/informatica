"use client";

import { Download, Pencil, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ExplainStyle, Goal, Grade, Lang, Theme } from "@/lib/types";
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
import { cleanBackup, downloadBlob } from "@/components/goals/backup";
import { Row, Segmented } from "@/components/goals/controls";
import { ReminderSettings } from "@/components/goals/ReminderSettings";
import { useMinuteClock } from "@/components/goals/useClock";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

const NAME_MAX = 30;
/** Больше этого файл копии не читаем: настоящая копия — десятки килобайт, фото аватара — до ~45 КБ. */
const IMPORT_MAX_BYTES = 8 * 1024 * 1024;
const WEEKLY = [2, 3, 4, 5, 7];

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
  const profile = useApp((s) => s.profile);
  const update = useApp((s) => s.updateProfile);
  const achievements = useApp((s) => s.achievements);
  const reset = useApp((s) => s.resetProgress);
  const importProgress = useApp((s) => s.importProgress);
  const now = useMinuteClock();
  const today = todayKey(new Date(now));

  const [confirm, setConfirm] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<unknown>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Просим браузер не стирать данные при нехватке места (Safari иначе чистит localStorage через 7 дней без визитов).
  useEffect(() => {
    Promise.resolve(navigator.storage?.persist?.()).catch(() => {});
  }, []);

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

  const exportData = () => {
    downloadBlob(new Blob([JSON.stringify({ ...useApp.getState(), version: 2 }, null, 2)], { type: "application/json" }), "informatica-progress.json");
  };

  const pickFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setImportMsg(null);
    if (file.size > IMPORT_MAX_BYTES) {
      setImportMsg({ ok: false, text: t("prof2.import.big") });
      return;
    }
    try {
      const data = cleanBackup(JSON.parse(await file.text()));
      if (!data) throw new Error("not a backup");
      setPending(data);
    } catch {
      setImportMsg({ ok: false, text: t("prof2.import.bad") });
    }
  };

  const confirmImport = () => {
    const ok = importProgress(pending);
    setPending(null);
    setImportMsg(ok ? { ok: true, text: t("prof2.import.ok") } : { ok: false, text: t("prof2.import.bad") });
  };

  const grades: { id: Grade; label: string }[] = (["8", "9", "10", "11"] as const).map((g) => ({ id: g, label: g }));
  grades.push({ id: "other", label: t("onb.grade.other") });

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

      {/* Цели */}
      <Card id="goals" className="scroll-mt-20 divide-y-2 divide-border py-1">
        <h2 className="py-3 text-lg font-extrabold">{t("prof2.goals.title")}</h2>
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
            <span className="shrink-0 whitespace-nowrap text-xl font-extrabold text-primary">{t("prof2.goals.target.value", { n: profile.targetScore })}</span>
          </div>
          <input
            id="prof-target"
            type="range"
            min={5}
            max={50}
            step={5}
            value={profile.targetScore}
            onChange={(e) => update({ targetScore: Number(e.target.value) })}
            className="mt-2 h-8 w-full cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs font-bold text-muted" aria-hidden="true">
            <span>5</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>
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
        <Row label={t("prof.grade")}>
          <Segmented<Grade> label={t("prof.grade")} value={profile.grade} onChange={(grade) => update({ grade })} options={grades} />
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

      {/* Резервная копия */}
      <Card>
        <h2 className="text-lg font-extrabold">{t("prof2.backup.title")}</h2>
        <p className="mb-3 mt-1 text-sm font-semibold text-muted">{t("prof2.backup.desc")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={exportData} icon={<Download size={18} />}>
            {t("prof.export")}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} icon={<Upload size={18} />}>
            {t("prof2.import")}
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
        </div>
        {importMsg && (
          <p role="status" className={cn("mt-3 rounded-xl px-3 py-2 text-sm font-bold", importMsg.ok ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger")}>
            {importMsg.text}
          </p>
        )}
        <Button variant="ghost" onClick={() => setConfirm(true)} icon={<RotateCcw size={18} />} className="mt-3 text-danger">
          {t("prof.reset")}
        </Button>
      </Card>

      <AvatarPicker open={pickAvatar} value={profile.avatar} name={profile.name} onChange={(avatar) => update({ avatar })} onClose={() => setPickAvatar(false)} />

      <Modal open={pending !== null} onClose={() => setPending(null)} label={t("prof2.import")}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-lg font-extrabold">{t("prof2.import.confirm")}</p>
          <Button variant="danger" block onClick={confirmImport}>
            {t("prof2.import.replace")}
          </Button>
          <Button variant="secondary" block onClick={() => setPending(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>

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
