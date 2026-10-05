"use client";

import { BookOpen, ChevronLeft, Target, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Lang, Track } from "@/lib/types";
import { track } from "@/lib/analytics";
import { TARGET_CHOICES, isExamDateValid } from "@/lib/goals";
import { toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";
import { markLangChosen } from "@/lib/guest-lang";
import { requestPersistentStorage } from "@/lib/safe-storage";
import { takePendingLink } from "@/lib/pending-link";
import { cn } from "@/lib/cn";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MascotSays } from "@/components/mascot/Mascot";
import { LegalConsentNote } from "@/components/legal/LegalConsentNote";
import { useNow } from "@/components/economy/useEconomy";
import { GradePicker } from "@/components/school/GradePicker";

// Короткий онбординг (#70): язык → имя → ЕНТ или школа → (ЕНТ) дата → (ЕНТ) цель | (школа) класс. Остальное — по умолчанию, меняется в профиле.
// Экранов: у ЕНТ — 5, у школы — 4. «Поехали» — кнопка последнего экрана (под ней — согласие с условиями).
// Дальше: ЕНТ → диагностика → «Учиться»; школа → «Учиться»; на «Учиться» ученика встречает проводник (#104).

// Имена шагов уходят в статистику (onb_step); сервер принимает только эти шесть (server/analytics-ids.ts → ONBOARDING_STEPS): новый шаг — добавить и туда.
type StepId = "lang" | "name" | "track" | "date" | "target" | "grade";
const STEPS: Record<Track, StepId[]> = {
  ent: ["lang", "name", "track", "date", "target"],
  school: ["lang", "name", "track", "grade"],
};

const TRACKS: { id: Track; icon: LucideIcon; key: DictKey; desc: DictKey }[] = [
  { id: "ent", icon: Target, key: "onb.track.ent", desc: "onb.track.ent.desc" },
  { id: "school", icon: BookOpen, key: "onb.track.school", desc: "onb.track.school.desc" },
];

function ChoiceIcon({ icon: Icon, selected }: { icon: LucideIcon; selected: boolean }) {
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", selected ? "bg-primary text-white" : "bg-primary-soft text-primary")}>
      <Icon size={22} strokeWidth={2.4} />
    </span>
  );
}

function Choice({ selected, onClick, className, children }: { selected: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-bold transition-colors active:translate-y-[2px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
        className,
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
  const now = useNow();
  const today = now > 0 ? todayKey(new Date(now)) : "";

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  /** Трек выбран на этом экране (до выбора ничего не подсвечено, хотя в профиле по умолчанию «ЕНТ»). */
  const [trackPicked, setTrackPicked] = useState<Track | null>(null);
  const [examDate, setExamDate] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [targetUnknown, setTargetUnknown] = useState(false);

  const trackNow: Track = profile.track === "school" ? "school" : "ent";
  const steps = STEPS[trackNow];
  const stepId = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const dateOk = isExamDateValid(examDate, today);

  const canNext =
    stepId === "name"
      ? name.trim().length > 0
      : stepId === "date"
        ? dateUnknown || dateOk
        : stepId === "target"
          ? target !== null || targetUnknown
          : stepId === "grade"
            ? toSchoolGrade(profile.grade) !== null
            : true;

  // Аналитика считает «дошедших»: шаг учитывается один раз за онбординг, сколько бы ни нажимали «Назад», трек или язык заново.
  const reported = useRef(new Set<StepId>());
  // Двойное нажатие «Поехали» до перехода на другой экран не должно завершать онбординг дважды.
  const done = useRef(false);

  /** Аналитика (#69): шаг пройден (первый раз). Имя шага — обезличенное, без введённых данных. */
  const passed = (id: StepId) => {
    if (reported.current.has(id)) return;
    reported.current.add(id);
    track({ e: "onb_step", step: id });
  };

  const finish = () => {
    if (done.current) return;
    done.current = true;
    const ent = trackNow === "ent";
    const cleanName = name.trim().slice(0, 30);
    if (ent) {
      completeOnboarding({
        name: cleanName,
        track: "ent",
        goal: "ent",
        grade: "11",
        examDate: !dateUnknown && dateOk ? examDate : null,
        // «Пока не знаю» — targetScore остаётся значением по умолчанию, но цель не считается выбранной.
        ...(target !== null ? { targetScore: target } : {}),
        targetScoreSet: target !== null,
      });
    } else {
      completeOnboarding({ name: cleanName, track: "school", goal: "school", examDate: null, targetScoreSet: false });
    }
    track({ e: "onb_done", track: trackNow });
    // Просим браузер не стирать данные сайта — из нажатия кнопки, иначе Firefox на компьютере покажет окно «из ниоткуда».
    requestPersistentStorage();
    // Пришли по вызову друга (#73): сразу на его вариант — диагностику и тарифы можно пройти позже.
    // Для школьного трека тоже: /exam/run сам покажет карточку «для ЕНТ» с переключением.
    const pending = takePendingLink(new Date().getTime());
    if (pending) {
      router.replace(pending);
      return;
    }
    // Окно тарифов сразу после онбординга больше не показываем (#104): ученика ведёт проводник (components/tour).
    // Но отметку показа оставляем — автопоказ тарифов будет не раньше чем через 3 дня.
    useApp.getState().notePaywallShown();
    // ЕНТ: входная диагностика, потом «Учиться»; школа — сразу «Учиться», где проводник подведёт к первому уроку.
    router.replace(ent ? "/diagnostic?from=onboarding" : "/learn");
  };

  const next = () => {
    if (!canNext) return;
    if (isLast) {
      finish();
      return;
    }
    if (stepId === "name") updateProfile({ name: name.trim().slice(0, 30) });
    passed(stepId);
    setStep(step + 1);
  };

  const setLang = (lang: Lang) => {
    updateProfile({ lang });
    // Язык выбран вручную: документы из согласия (новая вкладка) не должны подменять его языком браузера.
    try {
      markLangChosen(window.localStorage);
    } catch {
      // хранилище недоступно (доступ к window.localStorage бросает) — выбор остаётся только в профиле
    }
    passed("lang");
    setStep(1);
  };

  const pickTrack = (tr: Track) => {
    // ЕНТ — 11 класс по умолчанию; школа — класс выбирается на следующем экране (при смене трека сбрасываем).
    if (tr === "ent") updateProfile({ goal: "ent", track: "ent", grade: "11" });
    else updateProfile({ goal: "school", track: "school", ...(profile.track !== "school" ? { grade: "other" as const } : {}) });
    setTrackPicked(tr);
    passed("track");
    setStep(step + 1);
  };

  const skipDate = () => {
    setDateUnknown(true);
    setExamDate("");
    passed("date");
    setStep(step + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-6 pt-4">
      <div className="flex h-12 items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2", step === 0 && "invisible")}
          aria-label={t("common.back")}
        >
          <ChevronLeft size={26} />
        </button>
        <ProgressBar value={(step + 1) / steps.length} color="var(--primary)" className="flex-1" label={t("onb.step", { n: step + 1, total: steps.length })} />
      </div>

      <div key={stepId} className="flex flex-1 flex-col gap-6 pt-6 animate-fade-in">
        {stepId === "lang" && (
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

        {stepId === "name" && (
          <>
            <MascotSays mood="happy" size={88}>
              <span className="block">{t("onb.hello")}</span>
              <span className="text-muted">{t("onb.name.title")}</span>
            </MascotSays>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder={t("onb.name.placeholder")}
              aria-label={t("onb.name.title")}
              maxLength={30}
              className="h-14 rounded-2xl border-2 border-border bg-surface px-4 text-xl font-bold outline-none focus:border-primary"
            />
          </>
        )}

        {stepId === "track" && (
          <>
            <MascotSays size={88}>{t("onb.track.title")}</MascotSays>
            <div className="flex flex-col gap-3">
              {TRACKS.map((tr) => (
                <Choice key={tr.id} selected={trackPicked === tr.id} onClick={() => pickTrack(tr.id)}>
                  <ChoiceIcon icon={tr.icon} selected={trackPicked === tr.id} />
                  <span>
                    <span className="block text-lg">{t(tr.key)}</span>
                    <span className="block text-sm font-semibold text-muted">{t(tr.desc)}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </>
        )}

        {stepId === "grade" && (
          <>
            <MascotSays size={88}>{t("onb.grade.title")}</MascotSays>
            <GradePicker />
            <p className="text-center text-sm font-semibold text-muted">{t("onb.grade.hint")}</p>
          </>
        )}

        {stepId === "date" && (
          <>
            <MascotSays mood="thinking" size={88}>
              {t("onb.date.title")}
            </MascotSays>
            <div className="flex flex-col gap-3">
              <input
                type="date"
                value={examDate}
                min={today || undefined}
                onChange={(e) => {
                  setExamDate(e.target.value);
                  setDateUnknown(false);
                }}
                aria-label={t("onb.date.label")}
                aria-invalid={examDate !== "" && !dateOk}
                className="h-14 w-full rounded-2xl border-2 border-border bg-surface px-4 text-xl font-bold outline-none focus:border-primary"
              />
              {examDate !== "" && !dateOk && today !== "" && <p className="text-sm font-bold text-warning-strong">{t("onb.date.past")}</p>}
              <Choice selected={dateUnknown} onClick={skipDate} className="justify-center text-center">
                <span className="text-lg">{t("onb.unknown")}</span>
              </Choice>
              <p className="text-center text-sm font-semibold text-muted">{t("onb.date.hint")}</p>
            </div>
          </>
        )}

        {stepId === "target" && (
          <>
            <MascotSays mood="happy" size={88}>
              {t("onb.target.title")}
            </MascotSays>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-5 gap-2" role="group" aria-label={t("onb.target.title")}>
                {TARGET_CHOICES.map((n) => (
                  <Choice
                    key={n}
                    selected={target === n}
                    onClick={() => {
                      setTarget(n);
                      setTargetUnknown(false);
                    }}
                    className="h-16 justify-center gap-0 px-0 py-0 text-center"
                  >
                    <span className="text-2xl">{n}</span>
                  </Choice>
                ))}
              </div>
              <p className="text-center text-sm font-bold text-muted">{t("onb.target.of")}</p>
              <Choice
                selected={targetUnknown}
                onClick={() => {
                  setTargetUnknown(true);
                  setTarget(null);
                }}
                className="justify-center text-center"
              >
                <span className="text-lg">{t("onb.unknown")}</span>
              </Choice>
              <p className="text-balance text-center text-sm font-semibold text-muted">{t("goals15.onb.target.exact")}</p>
            </div>
          </>
        )}
      </div>

      {stepId !== "lang" && stepId !== "track" && (
        <Button size="lg" block disabled={!canNext} onClick={next} className="mt-6">
          {isLast ? t("onb.finish") : t("common.continue")}
        </Button>
      )}
      {isLast && <LegalConsentNote className="mt-3" />}
    </div>
  );
}
