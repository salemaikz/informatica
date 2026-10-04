"use client";

import clsx from "clsx";
import { BookOpen, ChevronLeft, Laptop, Rocket, Lightbulb, ListOrdered, Puzzle, Target, Zap, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExplainStyle, Goal, Grade, Lang } from "@/lib/types";
import { useApp } from "@/lib/store";
import { markLangChosen } from "@/lib/guest-lang";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MascotSays } from "@/components/mascot/Mascot";
import { LegalConsentNote } from "@/components/legal/LegalConsentNote";

const GRADES: Grade[] = ["5", "6", "7", "8", "9", "10", "11", "other"];
const GOALS: { id: Goal; icon: LucideIcon; key: DictKey }[] = [
  { id: "ent", icon: Target, key: "goal.ent" },
  { id: "school", icon: BookOpen, key: "goal.school" },
  { id: "interest", icon: Lightbulb, key: "goal.interest" },
];
/** «С чего начнём?»: с нуля (раздел «Старт» первым) или сразу к темам ЕНТ (profile.skipBasics). */
const BASICS: { skip: boolean; icon: LucideIcon; key: DictKey; desc: DictKey }[] = [
  { skip: false, icon: Laptop, key: "onb.basics.zero", desc: "onb.basics.zero.desc" },
  { skip: true, icon: Rocket, key: "onb.basics.know", desc: "onb.basics.know.desc" },
];
const STYLES: { id: ExplainStyle; icon: LucideIcon; key: DictKey; desc: DictKey }[] = [
  { id: "short", icon: Zap, key: "style.short", desc: "style.short.desc" },
  { id: "examples", icon: Puzzle, key: "style.examples", desc: "style.examples.desc" },
  { id: "steps", icon: ListOrdered, key: "style.steps", desc: "style.steps.desc" },
];

function ChoiceIcon({ icon: Icon, selected }: { icon: LucideIcon; selected: boolean }) {
  return (
    <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", selected ? "bg-primary text-white" : "bg-primary-soft text-primary")}>
      <Icon size={22} strokeWidth={2.4} />
    </span>
  );
}
const DAILY: { xp: number; key: DictKey; min: number }[] = [
  { xp: 20, key: "daily.20", min: 5 },
  { xp: 50, key: "daily.50", min: 10 },
  { xp: 100, key: "daily.100", min: 20 },
];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-bold transition-colors active:translate-y-[2px]",
        selected ? "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useT();
  const updateProfile = useApp((s) => s.updateProfile);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const profile = useApp((s) => s.profile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);

  const total = 7;
  const canNext = step !== 1 || name.trim().length > 0;

  const next = () => {
    if (step === 1) updateProfile({ name: name.trim().slice(0, 30) });
    if (step < total - 1) setStep(step + 1);
    else {
      // Цель «школа» — школьный трек, остальные — подготовка к ЕНТ.
      completeOnboarding({ name: name.trim().slice(0, 30), track: profile.goal === "school" ? "school" : "ent" });
      // Сразу после онбординга — окно тарифов (один показ учитывается в статистике).
      useApp.getState().notePaywallShown();
      router.replace("/plans?from=onboarding");
    }
  };

  const setLang = (lang: Lang) => {
    updateProfile({ lang });
    // Язык выбран вручную: документы из согласия (новая вкладка) не должны подменять его языком браузера.
    try {
      markLangChosen(window.localStorage);
    } catch {
      // хранилище недоступно (доступ к window.localStorage бросает) — выбор остаётся только в профиле
    }
    setStep(1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-6 pt-4">
      <div className="flex h-12 items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          className={clsx("flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2", step === 0 && "invisible")}
          aria-label={t("common.back")}
        >
          <ChevronLeft size={26} />
        </button>
        <ProgressBar value={(step + 1) / total} color="var(--primary)" className="flex-1" />
      </div>

      <div key={step} className="flex flex-1 flex-col gap-6 pt-6 animate-fade-in">
        {step === 0 && (
          <>
            <MascotSays mood="happy" size={88}>
              <span className="block">Привет! Сәлем!</span>
              <span className="text-muted">Выбери язык · Тілді таңда</span>
            </MascotSays>
            <div className="flex flex-col gap-3">
              {(
                [
                  ["kk", "Қазақша", "ҚАЗ"],
                  ["ru", "Русский", "РУС"],
                ] as const
              ).map(([id, label, badge]) => (
                <Choice key={id} selected={profile.lang === id} onClick={() => setLang(id)}>
                  <span className="flex h-10 w-12 items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold text-muted">{badge}</span>
                  <span className="text-lg">{label}</span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <MascotSays mood="happy" size={88}>
              <span className="block">{t("onb.hello")}</span>
              <span className="text-muted">{t("onb.name.title")}</span>
            </MascotSays>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canNext && next()}
              placeholder={t("onb.name.placeholder")}
              maxLength={30}
              className="h-14 rounded-2xl border-2 border-border bg-surface px-4 text-xl font-bold outline-none focus:border-primary"
            />
          </>
        )}

        {step === 2 && (
          <>
            <MascotSays size={88}>{t("onb.grade.title")}</MascotSays>
            <div className="grid grid-cols-2 gap-3">
              {GRADES.map((g) => (
                <Choice key={g} selected={profile.grade === g} onClick={() => updateProfile({ grade: g })}>
                  <span className="w-full text-center text-lg">{g === "other" ? t("onb.grade.other") : t("onb.grade.n", { n: g })}</span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <MascotSays size={88}>{t("onb.goal.title")}</MascotSays>
            <div className="flex flex-col gap-3">
              {GOALS.map((g) => (
                <Choice key={g.id} selected={profile.goal === g.id} onClick={() => updateProfile({ goal: g.id, track: g.id === "school" ? "school" : "ent" })}>
                  <ChoiceIcon icon={g.icon} selected={profile.goal === g.id} />
                  <span className="text-lg">{t(g.key)}</span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <MascotSays mood="thinking" size={88}>
              {t("onb.basics.title")}
            </MascotSays>
            <div className="flex flex-col gap-3">
              {BASICS.map((b) => (
                <Choice key={String(b.skip)} selected={profile.skipBasics === b.skip} onClick={() => updateProfile({ skipBasics: b.skip })}>
                  <ChoiceIcon icon={b.icon} selected={profile.skipBasics === b.skip} />
                  <span>
                    <span className="block text-lg">{t(b.key)}</span>
                    <span className="block text-sm font-semibold text-muted">{t(b.desc)}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <MascotSays mood="thinking" size={88}>
              {t("onb.style.title")}
            </MascotSays>
            <div className="flex flex-col gap-3">
              {STYLES.map((s) => (
                <Choice key={s.id} selected={profile.style === s.id} onClick={() => updateProfile({ style: s.id })}>
                  <ChoiceIcon icon={s.icon} selected={profile.style === s.id} />
                  <span>
                    <span className="block text-lg">{t(s.key)}</span>
                    <span className="block text-sm font-semibold text-muted">{t(s.desc)}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <MascotSays mood="happy" size={88}>
              {t("onb.daily.title")}
            </MascotSays>
            <div className="flex flex-col gap-3">
              {DAILY.map((d) => (
                <Choice key={d.xp} selected={profile.dailyGoalXp === d.xp} onClick={() => updateProfile({ dailyGoalXp: d.xp })}>
                  <span className="flex-1 text-lg">{t(d.key)}</span>
                  <span className="text-sm font-bold text-muted">{t("daily.desc", { xp: d.xp, min: d.min })}</span>
                </Choice>
              ))}
            </div>
          </>
        )}
      </div>

      {step > 0 && (
        <Button size="lg" block disabled={!canNext} onClick={next} className="mt-6">
          {step === total - 1 ? t("onb.finish") : t("common.continue")}
        </Button>
      )}
      {step === total - 1 && <LegalConsentNote className="mt-3" />}
    </div>
  );
}
