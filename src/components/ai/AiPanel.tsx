"use client";

import { BookmarkPlus, Lightbulb, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { AiCost } from "@/components/economy/AiCost";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { useTutor, type TutorTurn } from "./useTutor";

const TITLE: Record<Exclude<TutorMode, "chat">, DictKey> = {
  hint: "tutor.hintTitle",
  explain: "tutor.explainTitle",
  ask: "tutor.askTitle",
};

/**
 * Шторка с ИИ внутри урока: подсказка к заданию, разбор ошибки или вопрос по шагу + уточняющие вопросы.
 * Лестница «бесплатно → ИИ»: если у задания есть статическая подсказка (`hint`) или разбор ошибки (`whyWrong`),
 * они показываются сразу, без запроса; ИИ — только по кнопке «Ещё подсказка / Подробнее от Бита».
 * В режиме «вопрос» ИИ молчит, пока ученик не спросит (своими словами или быстрой кнопкой).
 */
export function AiPanel({
  open,
  onClose,
  mode,
  task,
  noteKey,
  suggestions = [],
}: {
  open: boolean;
  onClose: () => void;
  mode: Exclude<TutorMode, "chat">;
  task: TaskContext;
  noteKey: string;
  /** Быстрые вопросы (режим «вопрос»). */
  suggestions?: DictKey[];
}) {
  const { t } = useT();
  const { ask, stop, streaming, error } = useTutor();
  // Бесплатный текст: подсказка автора или разбор неверного варианта (+ объяснение урока).
  const [staticText] = useState(() =>
    mode === "hint" ? task.hint : mode === "explain" && task.whyWrong ? [task.whyWrong, task.explanation].filter(Boolean).join("\n\n") : undefined,
  );
  const autoStart = mode !== "ask" && !staticText;
  const [turns, setTurns] = useState<TutorTurn[]>(autoStart ? [{ role: "assistant", content: "" }] : []);
  const [draft, setDraft] = useState("");
  const runId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  // isCurrent — защита от ответов отменённых запусков (например, при двойном монтировании в dev).
  const stream = async (history: TutorTurn[], isCurrent: () => boolean) => {
    const text = await ask({ mode, task, messages: history }, (full) => {
      if (isCurrent()) setTurns([...history, { role: "assistant", content: full }]);
    });
    if (text === null && isCurrent()) setTurns(history);
  };

  // Первый ответ (подсказка/разбор) запрашиваем сразу при открытии.
  useEffect(() => {
    if (!autoStart) return;
    let alive = true;
    // Запрос к внешнему API при открытии панели; синхронно меняется только статус «загрузка».
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void stream([], () => alive);
    return () => {
      alive = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // «Ещё подсказка / Подробнее от Бита» — единственное, что после статики делает запрос к ИИ.
  const askMore = () => {
    if (streaming) return;
    const id = ++runId.current;
    setTurns([{ role: "assistant", content: "" }]);
    void stream([], () => id === runId.current);
  };

  const send = (text?: string) => {
    const q = (text ?? draft).trim();
    if (!q || streaming) return;
    if (!text) setDraft("");
    const history: TutorTurn[] = [...turns, { role: "user", content: q }];
    const id = ++runId.current;
    setTurns([...history, { role: "assistant", content: "" }]);
    void stream(history, () => id === runId.current);
  };

  return (
    <Modal open={open} onClose={onClose} label={t(TITLE[mode])} className="sm:max-w-lg">
      <div className="mb-3 flex items-center gap-3">
        <Mascot mood="thinking" size={44} />
        <h3 className="flex items-center gap-1.5 text-lg font-extrabold text-ai">
          <Sparkles size={18} /> {t(TITLE[mode])}
        </h3>
      </div>
      <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto pr-1">
        {staticText && (
          <div className="rounded-2xl rounded-bl-md border-2 border-primary/25 bg-primary-soft px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-primary">
              <Lightbulb size={14} /> {t(mode === "hint" ? "ai.staticHint" : "ai.staticWhy")}
            </p>
            <Markdown>{staticText}</Markdown>
          </div>
        )}
        {staticText && turns.length === 0 && (
          <Button variant="ai" block icon={<Sparkles size={18} />} onClick={askMore}>
            {t(mode === "hint" ? "ai.moreHint" : "ai.moreExplain")}
            <AiCost kind={mode} variant="solid" />
          </Button>
        )}
        {turns.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 font-semibold text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="rounded-2xl rounded-bl-md border-2 border-ai/25 bg-ai-soft px-4 py-3">
              {m.content ? <Markdown>{m.content}</Markdown> : <span className="animate-pulse font-semibold text-ai">{t("common.loading")}</span>}
              {m.content && !(streaming && i === turns.length - 1) && (
                <button
                  type="button"
                  // Открываем шторку выбора папки — молча в конспект не сохраняем.
                  onClick={() =>
                    useSaveToNotes.getState().open({ source: "ai", text: m.content, lessonId: noteKey === "general" ? undefined : noteKey })
                  }
                  className="mt-1 flex min-h-10 items-center gap-1 text-xs font-extrabold text-ai"
                >
                  <BookmarkPlus size={14} />
                  {t("tutor.saveNote")}
                </button>
              )}
            </div>
          ),
        )}
        {turns.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => send(t(k))}
                className="rounded-full border-2 border-ai/30 bg-ai-soft px-3 py-1.5 text-sm font-extrabold text-ai hover:brightness-95"
              >
                {t(k)}
              </button>
            ))}
          </div>
        )}
        {error === "economy.noChips" ? (
          <NoChipsNotice kind={mode} />
        ) : (
          error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{t(error)}</p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t(turns.length === 0 ? "tutor.askPlaceholder" : "tutor.followUp")}
          autoFocus={mode === "ask"}
          className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-border bg-surface px-3 font-semibold outline-none focus:border-ai"
        />
        <button
          type="submit"
          disabled={!draft.trim() || streaming}
          aria-label="send"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ai text-white disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
      <p className="mt-1.5 flex items-center justify-end gap-1.5 text-xs font-bold text-muted">
        {t("aicost.perMessage")} <AiCost kind={mode} />
      </p>
    </Modal>
  );
}
