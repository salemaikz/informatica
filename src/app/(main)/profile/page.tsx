"use client";

import clsx from "clsx";
import { Download, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ExplainStyle, Goal, Grade, Lang, Theme } from "@/lib/types";
import { useApp } from "@/lib/store";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LevelCard } from "@/components/app/Widgets";

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={clsx(
            "rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition-colors",
            value === o.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-extrabold">{label}</span>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { t, l } = useT();
  const profile = useApp((s) => s.profile);
  const update = useApp((s) => s.updateProfile);
  const achievements = useApp((s) => s.achievements);
  const reset = useApp((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(useApp.getState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "informatica-progress.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const grades: { id: Grade; label: string }[] = (["8", "9", "10", "11"] as const).map((g) => ({ id: g, label: g }));
  grades.push({ id: "other", label: t("onb.grade.other") });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-extrabold text-primary">
          {(profile.name.trim()[0] ?? "?").toUpperCase()}
        </span>
        <div className="flex-1">
          <input
            value={profile.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 30) })}
            aria-label={t("prof.name")}
            className="w-full rounded-xl bg-transparent text-2xl font-extrabold outline-none focus:bg-surface-2"
          />
          <p className="text-sm font-bold text-muted">{t("prof.local")}</p>
        </div>
      </div>

      <LevelCard />

      <Card>
        <p className="mb-3 text-lg font-extrabold">{t("prof.achievements")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const got = !!achievements[a.id];
            return (
              <div
                key={a.id}
                className={clsx("flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center", got ? "border-gold bg-gold-soft" : "border-border opacity-60 grayscale")}
                title={l(a.description)}
              >
                <span className="text-3xl">{a.icon}</span>
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
            value={profile.lang}
            onChange={(lang) => update({ lang })}
            options={[
              { id: "kk", label: "Қазақша" },
              { id: "ru", label: "Русский" },
            ]}
          />
        </Row>
        <Row label={t("prof.grade")}>
          <Segmented<Grade> value={profile.grade} onChange={(grade) => update({ grade })} options={grades} />
        </Row>
        <Row label={t("prof.goal")}>
          <Segmented<Goal>
            value={profile.goal}
            onChange={(goal) => update({ goal })}
            options={(["ent", "school", "interest"] as const).map((g) => ({ id: g, label: t(`goal.${g}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.style")}>
          <Segmented<ExplainStyle>
            value={profile.style}
            onChange={(style) => update({ style })}
            options={(["short", "examples", "steps"] as const).map((s) => ({ id: s, label: t(`style.${s}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.daily")}>
          <Segmented<number>
            value={profile.dailyGoalXp}
            onChange={(dailyGoalXp) => update({ dailyGoalXp })}
            options={[20, 50, 100].map((x) => ({ id: x, label: `${t(`daily.${x}` as DictKey)} · ${x} XP` }))}
          />
        </Row>
        <Row label={t("prof.theme")}>
          <Segmented<Theme>
            value={profile.theme}
            onChange={(theme) => update({ theme })}
            options={(["system", "light", "dark"] as const).map((th) => ({ id: th, label: t(`theme.${th}` as DictKey) }))}
          />
        </Row>
        <Row label={t("prof.sound")}>
          <Segmented<string>
            value={profile.sound ? "on" : "off"}
            onChange={(v) => update({ sound: v === "on" })}
            options={[
              { id: "on", label: t("common.on") },
              { id: "off", label: t("common.off") },
            ]}
          />
        </Row>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={exportData} icon={<Download size={18} />}>
          {t("prof.export")}
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(true)} icon={<RotateCcw size={18} />} className="text-danger">
          {t("prof.reset")}
        </Button>
      </div>

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
