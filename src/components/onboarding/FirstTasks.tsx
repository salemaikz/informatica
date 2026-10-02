"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { MascotSays } from "@/components/mascot/Mascot";
import { FIRST_TASKS, LAMP_WEIGHTS, expectedText, isCorrect, lampsValue, taskXp, type FirstTask } from "./logic";

type Answer = number | "bin" | "dec";
type Status = "idle" | "wrong" | "right";

const GOOD = ["onboard.good.1", "onboard.good.2", "onboard.good.3"] as const;

/**
 * Три мини-задания «первая победа»: мгновенная реакция маскота и XP за каждое. Ответы считает logic.ts.
 * solved — сколько заданий уже решено (хранит страница): после «Назад» продолжаем с нерешённого, XP не дублируется.
 */
export function FirstTasks({ solved, onSolved, onDone }: { solved: number; onSolved: (n: number) => void; onDone: () => void }) {
  const { t } = useT();
  const recordAnswer = useApp((s) => s.recordAnswer);
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, solved), FIRST_TASKS.length - 1));
  const [lamps, setLamps] = useState([false, false, false, false]);
  const [picked, setPicked] = useState<Answer | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [tries, setTries] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [gained, setGained] = useState(0);

  const task: FirstTask = FIRST_TASKS[idx];
  const answer: Answer | null = task.kind === "lamps" ? lampsValue(lamps) : picked;

  const check = () => {
    if (answer === null) return;
    if (isCorrect(task, answer)) {
      const xp = taskXp(tries === 0);
      recordAnswer(
        {
          stepId: `onboard-${idx}`,
          skill: task.skill,
          correct: true,
          score: tries === 0 ? 1 : 0.5,
          given: String(answer),
          expected: expectedText(task),
          prompt: "onboarding",
          retry: tries > 0,
          timeMs: Date.now() - startedAt,
        },
        xp,
      );
      setGained(xp);
      setStatus("right");
      onSolved(idx + 1);
      feedback("correct");
    } else {
      setTries((n) => n + 1);
      setStatus("wrong");
      feedback("wrong");
    }
  };

  const next = () => {
    if (idx === FIRST_TASKS.length - 1) {
      onDone();
      return;
    }
    setIdx(idx + 1);
    setLamps([false, false, false, false]);
    setPicked(null);
    setStatus("idle");
    setTries(0);
    setGained(0);
    setStartedAt(Date.now());
  };

  const pick = (a: Answer) => {
    if (status === "right") return;
    setPicked(a);
    setStatus("idle");
  };

  const choiceBtn = (key: string, label: string, value: Answer) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(value)}
      aria-pressed={picked === value}
      disabled={status === "right"}
      className={cn(
        "flex h-16 items-center justify-center rounded-2xl border-2 text-2xl font-extrabold transition-colors active:translate-y-[2px]",
        picked === value ? "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
        status === "wrong" && picked === value && "border-danger bg-danger-soft text-danger shadow-[0_3px_0_var(--danger)]",
        status === "right" && picked === value && "border-success bg-success-soft text-success shadow-[0_3px_0_var(--success)]",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-sm font-bold text-muted">{t("onboard.first.n", { n: idx + 1, total: FIRST_TASKS.length })}</p>

        <MascotSays mood={status === "right" ? "celebrate" : status === "wrong" ? "sad" : "thinking"} size={88}>
          <span role="status" aria-live="polite">
            {status === "right" ? t(GOOD[idx]) : status === "wrong" ? t("onboard.bad") : t(idx === 0 ? "onboard.first.intro" : "onboard.first.go")}
          </span>
        </MascotSays>

        <h1 className="text-2xl font-extrabold leading-tight">
          {task.kind === "lamps" && t("onboard.lamps.title", { n: task.target })}
          {task.kind === "choice" && t("onboard.choice.title", { bits: task.bits })}
          {task.kind === "compare" && t("onboard.compare.title")}
        </h1>

        {task.kind === "lamps" && (
          <div className="flex flex-col items-center gap-4">
            <div className="grid w-full grid-cols-4 gap-3">
              {LAMP_WEIGHTS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  disabled={status === "right"}
                  aria-pressed={lamps[i]}
                  aria-label={t(lamps[i] ? "onboard.lamp.on" : "onboard.lamp.off", { w })}
                  onClick={() => {
                    setLamps(lamps.map((v, j) => (j === i ? !v : v)));
                    setStatus("idle");
                  }}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 text-2xl font-extrabold transition-colors active:translate-y-[2px]",
                    lamps[i] ? "border-primary bg-primary text-white shadow-[0_3px_0_var(--primary-strong)]" : "border-border bg-surface shadow-[0_3px_0_var(--border)]",
                  )}
                >
                  <span>{lamps[i] ? 1 : 0}</span>
                  <span className={cn("text-sm font-bold", lamps[i] ? "text-white/80" : "text-muted")}>{w}</span>
                </button>
              ))}
            </div>
            <p className="text-lg font-extrabold" aria-live="polite">
              {t("onboard.lamps.show", { n: lampsValue(lamps) })}
            </p>
            <p className="text-center text-sm font-semibold text-muted">{t("onboard.lamps.hint")}</p>
          </div>
        )}

        {task.kind === "choice" && <div className="grid grid-cols-2 gap-3">{task.options.map((o) => choiceBtn(String(o), String(o), o))}</div>}

        {task.kind === "compare" && (
          <div className="grid grid-cols-2 gap-3">
            {choiceBtn("bin", `${task.bits}₂`, "bin")}
            {choiceBtn("dec", `${task.dec}₁₀`, "dec")}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {status === "right" && (
          <p className="flex items-center justify-center gap-1.5 text-lg font-extrabold text-warning-strong animate-fade-in">
            <Zap size={20} className="text-gold" fill="currentColor" aria-hidden /> {t("onboard.xp", { n: gained })}
          </p>
        )}
        {status === "right" ? (
          <Button size="lg" block variant="success" onClick={next}>
            {t("onboard.next")}
          </Button>
        ) : (
          <Button size="lg" block disabled={answer === null || (task.kind === "lamps" && lampsValue(lamps) === 0)} onClick={check}>
            {t("onboard.check")}
          </Button>
        )}
      </div>
    </>
  );
}
