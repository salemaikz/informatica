"use client";

import { ListChecks } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ENT_TOPICS } from "@/content/ent-topics";
import type { QuizSource } from "@/lib/chat-quiz";
import type { Level } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const LEVELS: Level[] = [1, 2, 3];
const LEVEL_KEY = { 1: "chats.quiz.level1", 2: "chats.quiz.level2", 3: "chats.quiz.level3" } as const;

/** Выбор темы (13 тем ЕНТ или пройденные уроки) и уровня A/B/C для «Дай задачи». */
export function QuizPicker({
  open,
  onClose,
  onStart,
  hasLessons,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (source: QuizSource, level: Level) => void;
  hasLessons: boolean;
  /** Сообщение «по теме нет заданий». */
  error?: boolean;
}) {
  const { t, l } = useT();
  const [source, setSource] = useState<QuizSource>(hasLessons ? { kind: "lessons" } : { kind: "topic", topic: "t04" });
  const [level, setLevel] = useState<Level>(1);
  const isSel = (s: QuizSource) => (s.kind === "lessons" ? source.kind === "lessons" : source.kind === "topic" && source.topic === s.topic);

  const chip = (sel: boolean) =>
    cn(
      "min-h-11 rounded-2xl border-2 px-3 py-1.5 text-left text-sm font-bold transition-colors",
      sel ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2",
    );

  return (
    <Modal open={open} onClose={onClose} label={t("chats.quiz.title")}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <ListChecks size={20} className="text-primary" /> {t("chats.quiz.title")}
          </h2>
          <p className="text-sm font-semibold text-muted">{t("chats.quiz.subtitle")}</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("chats.quiz.topic")}</legend>
          <button type="button" disabled={!hasLessons} aria-pressed={isSel({ kind: "lessons" })} onClick={() => setSource({ kind: "lessons" })} className={cn(chip(isSel({ kind: "lessons" })), "disabled:opacity-50")}>
            {t("chats.quiz.lessons")}
            {!hasLessons && <span className="block text-xs font-semibold text-muted">{t("chats.quiz.noLessons")}</span>}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {ENT_TOPICS.map((tp) => {
              const s: QuizSource = { kind: "topic", topic: tp.id };
              return (
                <button key={tp.id} type="button" aria-pressed={isSel(s)} onClick={() => setSource(s)} className={chip(isSel(s))} title={l(tp.title)}>
                  {l(tp.short)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("chats.quiz.level")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lv) => (
              <button key={lv} type="button" aria-pressed={level === lv} onClick={() => setLevel(lv)} className={cn(chip(level === lv), "text-center text-xs")}>
                {t(LEVEL_KEY[lv])}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning">{t("chats.quiz.empty")}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={() => onStart(source, level)}>
            {t("chats.quiz.start")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
