"use client";

import clsx from "clsx";
import { Camera, CircleCheck, CircleX, ImagePlus, PenLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SolutionStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { compressImage } from "@/lib/image";
import { DrawingCanvas, type DrawingHandle } from "../DrawingCanvas";
import type { StepProps } from "./types";

type Tab = "draw" | "photo";

/** Развёрнутое решение: рисуем на холсте или фотографируем тетрадь; проверяет ИИ. */
export function SolutionView({ answer, onAnswer, locked, result }: StepProps<SolutionStep>) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("draw");
  const [drawImage, setDrawImage] = useState<string | undefined>();
  const [photo, setPhoto] = useState<string | undefined>();
  const canvas = useRef<DrawingHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typed = answer?.type === "solution" ? answer.typed : "";

  const image = tab === "draw" ? drawImage : photo;

  // Держим ответ в актуальном состоянии: картинка текущей вкладки + введённый ответ.
  const emit = (img: string | undefined, text: string) => onAnswer({ type: "solution", image: img, typed: text });

  // Таймер дебаунса читает актуальные значения через ref.
  const latest = useRef({ tab, typed });
  useEffect(() => {
    latest.current = { tab, typed };
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const onCanvasChange = (empty: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const c = canvas.current?.exportCanvas();
      const img = empty || !c ? undefined : await compressImage(c, 1024);
      setDrawImage(img);
      if (latest.current.tab === "draw") emit(img, latest.current.typed);
    }, 350);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const img = await compressImage(file, 1280);
    setPhoto(img);
    emit(img, typed);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    emit(next === "draw" ? drawImage : photo, typed);
  };

  const details = result?.details;

  return (
    <div className="flex flex-col gap-4">
      {!locked && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
            {(["draw", "photo"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchTab(k)}
                className={clsx(
                  "flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors",
                  tab === k ? "bg-surface text-text shadow-sm" : "text-muted",
                )}
              >
                {k === "draw" ? <PenLine size={16} /> : <Camera size={16} />}
                {k === "draw" ? t("sol.draw") : t("sol.photo")}
              </button>
            ))}
          </div>

          <div className={tab === "draw" ? "" : "hidden"}>
            <DrawingCanvas ref={canvas} onChange={onCanvasChange} />
          </div>

          {tab === "photo" && (
            <div className="flex flex-col items-center gap-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="max-h-80 w-full rounded-2xl border-2 border-border object-contain" />
              ) : null}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary-soft px-4 py-6 font-extrabold text-primary"
              >
                <ImagePlus size={22} />
                {photo ? t("sol.replace") : t("sol.takePhoto")}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          )}

          <label className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-2 focus-within:border-primary">
            <span className="text-sm font-bold text-muted">{t("sol.finalAnswer")}</span>
            <input
              value={typed}
              onChange={(e) => emit(image, e.target.value)}
              inputMode="numeric"
              className="min-w-0 flex-1 bg-transparent py-1 font-mono text-xl font-bold outline-none"
              placeholder="…"
            />
          </label>
          {!image && !typed && <p className="text-center text-sm text-muted">{t("sol.need")}</p>}
        </>
      )}

      {locked && image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="max-h-56 w-full rounded-2xl border-2 border-border bg-white object-contain" />
      )}

      {locked && details && (
        <div
          className={clsx(
            "rounded-2xl border-2 p-4 animate-fade-in",
            details.verdict === "correct"
              ? "border-success bg-success-soft"
              : details.verdict === "partial"
                ? "border-warning bg-warning-soft"
                : "border-danger bg-danger-soft",
          )}
        >
          <div className="mb-2 flex items-center gap-2 font-extrabold text-ai">
            <Sparkles size={18} /> {t("sol.checkAi")}
          </div>
          <p className="font-semibold">{details.feedback}</p>
          {details.steps.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {details.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 font-mono text-sm">
                  {s.ok ? <CircleCheck size={18} className="shrink-0 text-success" /> : <CircleX size={18} className="shrink-0 text-danger" />}
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          )}
          {details.tip && <p className="mt-3 text-sm font-semibold text-muted">💡 {details.tip}</p>}
        </div>
      )}
      {locked && result?.offline && <p className="text-center text-sm font-semibold text-warning-strong">{t("sol.offline")}</p>}
    </div>
  );
}
