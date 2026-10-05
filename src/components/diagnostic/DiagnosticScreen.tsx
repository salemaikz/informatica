"use client";

import { CircleHelp, ListChecks, Target } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { track, pct } from "@/lib/analytics";
import { BASICS_MIN_ITEMS, buildDiagnostic, scoreDiagnostic, type DiagnosticResult } from "@/lib/diagnostic";
import { isAnswered, type ExamAnswers, type ExamPaper } from "@/lib/exam";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MascotSays } from "@/components/mascot/Mascot";
import { QuestionView } from "@/components/exam/QuestionView";
import { DiagnosticResultView } from "./DiagnosticResultView";
import { useDiagnosticData } from "./data";

/** Нижняя панель с кнопками: прижата к низу экрана, с учётом безопасной зоны. */
function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto flex max-w-lg flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Что диагностика меняет в профиле про раздел «Старт»: только включает пропуск (по основам было достаточно заданий
 * и они знакомы) и никогда не выключает — выбор ученика в профиле повторное прохождение не отменяет (C32).
 */
export function basicsPatch(res: Pick<DiagnosticResult, "basicsItems" | "skipBasics">): { skipBasics: true } | undefined {
  return res.basicsItems >= BASICS_MIN_ITEMS && res.skipBasics ? { skipBasics: true } : undefined;
}

/**
 * Входная диагностика (#70), полноэкранный маршрут /diagnostic (вне оболочки приложения, как /plans и /onboarding).
 * 10 заданий ЕНТ «один верный», ответ не раскрывается, без сердечек, XP и подсказок. Итог — предварительный прогноз
 * диапазоном и слабые темы. Не пробник: `recordDiagnostic`, а не `recordExam` — ни истории, ни серии, ни XP.
 * `?from=onboarding` — после итога (или пропуска) окно тарифов; без параметра (повтор из «Целей») — возврат на «Учиться».
 */
export function DiagnosticScreen() {
  const { t } = useT();
  const router = useRouter();
  const fromOnboarding = useSearchParams().get("from") === "onboarding";
  const { data, failed } = useDiagnosticData();
  const recordDiagnostic = useApp((s) => s.recordDiagnostic);

  const [phase, setPhase] = useState<"intro" | "run" | "result">("intro");
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  /** Защита от двойного нажатия на последнем вопросе: итог записываем один раз. */
  const finished = useRef(false);
  /** Защита от двойного нажатия «Дальше»: уход (и показ тарифов) — один раз. Отдельно от `finished`: на экране итога он уже true. */
  const left = useRef(false);

  /** Дальше по маршруту: после онбординга — окно тарифов, иначе — на «Учиться». */
  const leave = () => {
    if (left.current) return;
    left.current = true;
    if (fromOnboarding) {
      useApp.getState().notePaywallShown();
      router.replace("/plans?from=onboarding");
    } else router.replace("/learn");
  };

  const skip = () => {
    if (finished.current) return;
    finished.current = true;
    track({ e: "diag", done: 0, pct: 0 });
    leave();
  };

  const start = () => {
    if (!data) return;
    const p = buildDiagnostic(data.pool, Math.floor(Math.random() * 0x7fffffff));
    // Банк пуст (сбой данных) — проверять нечего: как пропуск.
    if (!p.items.length) {
      skip();
      return;
    }
    setPaper(p);
    setAnswers({});
    setIndex(0);
    setPhase("run");
  };

  const advance = (next: ExamAnswers) => {
    if (!paper || finished.current) return;
    setAnswers(next);
    if (index + 1 < paper.items.length) {
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    finished.current = true;
    const res = scoreDiagnostic(paper, next, Date.now());
    recordDiagnostic(res.summary, res.skillAnswers, basicsPatch(res));
    track({ e: "diag", done: 1, pct: pct(res.summary.max > 0 ? res.summary.points / res.summary.max : 0) });
    setResult(res);
    setPhase("result");
    window.scrollTo({ top: 0 });
  };

  const q = paper?.items[index];
  const total = paper?.items.length ?? 0;
  const lastQ = index + 1 >= total;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-40 pt-4">
      {phase === "intro" && (
        <div className="flex flex-1 flex-col gap-6 pt-4 animate-fade-in">
          <MascotSays mood="happy" size={88}>
            <span role="heading" aria-level={1} className="block text-lg font-extrabold">
              {t("diag.intro.title")}
            </span>
            <span className="text-muted">{t("diag.intro.lead")}</span>
          </MascotSays>
          <ul className="flex flex-col gap-3">
            {(
              [
                [ListChecks, "diag.intro.p1"],
                [CircleHelp, "diag.intro.p2"],
                [Target, "diag.intro.p3"],
              ] as const
            ).map(([Icon, key]) => (
              <li key={key} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="text-sm font-bold">{t(key)}</span>
              </li>
            ))}
          </ul>
          {failed && <p className="rounded-2xl bg-warning-soft p-3 text-sm font-bold text-warning-strong">{t("diag.loadFailed")}</p>}
        </div>
      )}

      {phase === "run" && q && (
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="sr-only">{t("diag.intro.title")}</h1>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-muted">{t("diag.progress", { n: index + 1, total })}</span>
              <Button variant="ghost" size="sm" className="h-11 px-2" onClick={skip}>
                {t("diag.skipRun")}
              </Button>
            </div>
            <ProgressBar value={index / total} color="var(--primary)" label={t("diag.progress.label", { n: index + 1, total })} />
          </div>
          <div key={q.key} className="animate-fade-in">
            <QuestionView q={q} number={index + 1} answers={answers} onChange={setAnswers} />
          </div>
        </div>
      )}

      {phase === "result" && result && data && (
        <div className="flex flex-1 flex-col pt-4">
          <h1 className="sr-only">{t("diag.result.title")}</h1>
          <DiagnosticResultView result={result} ready={data.ready} fromOnboarding={fromOnboarding} />
        </div>
      )}

      {phase === "intro" && (
        <BottomBar>
          <Button size="lg" block disabled={!data} onClick={start}>
            {data || failed ? t("common.start") : t("common.loading")}
          </Button>
          <Button size="lg" variant="ghost" block onClick={skip}>
            {t("common.skip")}
          </Button>
        </BottomBar>
      )}

      {phase === "run" && q && (
        <BottomBar>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" variant="secondary" onClick={() => advance(withoutAnswer(answers, q.key))}>
              {t("diag.dontKnow")}
            </Button>
            <Button size="lg" disabled={!isAnswered(q, answers[q.key])} onClick={() => advance(answers)}>
              {lastQ ? t("diag.finish") : t("diag.next")}
            </Button>
          </div>
        </BottomBar>
      )}

      {phase === "result" && result && (
        <BottomBar>
          <Button size="lg" block onClick={leave}>
            {t("diag.next")}
          </Button>
        </BottomBar>
      )}
    </div>
  );
}

/** Ответы без ответа на вопрос key («Не знаю»: выбранное снимается). */
function withoutAnswer(answers: ExamAnswers, key: string): ExamAnswers {
  const next = { ...answers };
  delete next[key];
  return next;
}
