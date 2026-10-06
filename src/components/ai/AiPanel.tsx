"use client";

import { BookmarkPlus, Lightbulb, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { staticAiText } from "@/lib/ai-static";
import { canRetryAiError } from "@/lib/ai-errors";
import { isCrisisReply } from "@/lib/safety";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { AiCost } from "@/components/economy/AiCost";
import { ReportIssueButton } from "@/components/issue/ReportIssueButton";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { unansweredTail } from "@/components/chat/helpers";
import { cleanTurns } from "./ai-threads";
import { useTutor, type TutorTurn } from "./useTutor";

const TITLE: Record<Exclude<TutorMode, "chat">, DictKey> = {
  hint: "tutor.hintTitle",
  explain: "tutor.explainTitle",
  ask: "tutor.askTitle",
};

/**
 * Шторка с ИИ внутри урока: подсказка к заданию, разбор ошибки или вопрос по шагу + уточняющие вопросы.
 * Лестница «бесплатно → ИИ»: статическая подсказка автора (`hint`) или разбор (`whyWrong` + `explanation`)
 * показываются сразу, одни и те же всем. ИИ запускается ТОЛЬКО по явному нажатию кнопки с ценой
 * («Спросить Бита», «Ещё подсказка», «Подробнее от Бита») — никогда автоматически при открытии шторки.
 * В режиме «вопрос» ИИ молчит, пока ученик не спросит (своими словами или быстрой кнопкой).
 */
export function AiPanel({
  open,
  onClose,
  mode,
  task,
  noteKey,
  suggestions = [],
  autoAsk,
  initialTurns,
  onTurns,
}: {
  open: boolean;
  onClose: () => void;
  mode: Exclude<TutorMode, "chat">;
  task: TaskContext;
  noteKey: string;
  /** Быстрые вопросы (режим «вопрос»). */
  suggestions?: DictKey[];
  /**
   * Вопрос, который шторка задаёт сама сразу после открытия (режим «вопрос»): ученик уже нажал кнопку с ценой
   * («Спросить Бита» на плашке «Нужна помощь?»), вторая кнопка не нужна. Тот же путь, что у быстрого вопроса.
   */
  autoAsk?: string;
  /** Переписка этого шага и режима из нити (ai-threads.ts): закрыли шторку и открыли снова — вопросы и ответы на месте. */
  initialTurns?: readonly TutorTurn[];
  /**
   * Нить после каждого завершённого запроса — и когда шторку уже закрыли (запрос не обрывается, ответ дойдёт).
   * Без пустой заготовки ответа; не пришёл ответ — нить с вопросом без ответа («Ответ не пришёл» и «Повторить»).
   */
  onTurns?: (turns: TutorTurn[]) => void;
}) {
  const { t } = useT();
  // Закрыли шторку посреди ответа — запрос не обрывается (detach): ответ дойдёт и сохранится в нить через onTurns.
  const { ask, streaming, error } = useTutor({ detach: true });
  // Бесплатный текст: подсказка автора либо разбор неверного варианта + объяснение задания (оно есть всегда).
  const [staticText] = useState(() => staticAiText(mode, task));
  const [turns, setTurns] = useState<TutorTurn[]>(() => cleanTurns(initialTurns ?? []));
  // Нить восстановлена — вопрос при открытии (autoAsk) второй раз не отправляем.
  const [restored] = useState(() => turns.length > 0);
  const onTurnsRef = useRef(onTurns);
  useEffect(() => {
    onTurnsRef.current = onTurns;
  });
  const [draft, setDraft] = useState("");
  // Последний запрос к ИИ, который не удался: «Повторить» шлёт ту же историю заново, не дублируя сообщение ученика.
  const [retry, setRetry] = useState<TutorTurn[] | null>(null);
  const runId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  // isCurrent — защита от ответов отменённых запусков (например, при двойном монтировании в dev).
  // После размонтирования (шторку закрыли) runId не меняется — завершённый ответ всё равно уходит в нить.
  const stream = async (history: TutorTurn[], isCurrent: () => boolean) => {
    setRetry(history);
    const text = await ask({ mode, task, messages: history }, (full) => {
      if (isCurrent()) setTurns([...history, { role: "assistant", content: full }]);
    });
    if (!isCurrent()) return;
    if (text === null) setTurns(history);
    else setRetry(null);
    onTurnsRef.current?.(text === null ? history : [...history, { role: "assistant", content: text }]);
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // «Спросить Бита / Ещё подсказка / Подробнее от Бита» — запрос к ИИ только по нажатию.
  const askMore = () => {
    if (streaming) return;
    const id = ++runId.current;
    setTurns([{ role: "assistant", content: "" }]);
    void stream([], () => id === runId.current);
  };

  // «Повторить» после сбоя или оборванного ответа: та же история, сообщение ученика второй раз не добавляется.
  // Нить из памяти кончается вопросом без ответа — повторяем её.
  const orphan = !streaming && !error && unansweredTail(turns);
  const retryLast = () => {
    const history = retry ?? (orphan ? turns : null);
    if (streaming || !history) return;
    const id = ++runId.current;
    setTurns([...history, { role: "assistant", content: "" }]);
    void stream(history, () => id === runId.current);
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

  // Вопрос при открытии — через таймер: двойной монтаж React в разработке (размонтирование → монтирование) не отправит его дважды.
  const autoRef = useRef(send);
  useEffect(() => {
    autoRef.current = send;
  });
  useEffect(() => {
    if (!autoAsk || restored) return;
    const id = window.setTimeout(() => autoRef.current(autoAsk), 0);
    return () => window.clearTimeout(id);
  }, [autoAsk, restored]);

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
        {mode !== "ask" && !staticText && turns.length === 0 && (
          <p className="rounded-2xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-muted">
            {t(mode === "hint" ? "ai.noHint" : "ai.noExplain")}
          </p>
        )}
        {mode !== "ask" && turns.length === 0 && (
          <Button variant="ai" block icon={<Sparkles size={18} />} onClick={askMore} disabled={streaming}>
            {t(!staticText ? "ai.askBit" : mode === "hint" ? "ai.moreHint" : "ai.moreExplain")}
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
                <div className="mt-1 flex flex-wrap items-center gap-x-3">
                  <button
                    type="button"
                    // Открываем шторку выбора папки — молча в конспект не сохраняем.
                    onClick={() =>
                      useSaveToNotes.getState().open({ source: "ai", text: m.content, lessonId: noteKey === "general" ? undefined : noteKey })
                    }
                    className="flex min-h-10 items-center gap-1 text-xs font-extrabold text-ai"
                  >
                    <BookmarkPlus size={14} />
                    {t("tutor.saveNote")}
                  </button>
                  {!isCrisisReply(m.content) && (
                    <ReportIssueButton
                      compact
                      target={{
                        kind: "ai",
                        where: "panel",
                        itemId: task.stepKey || undefined,
                        lessonId: noteKey === "general" ? undefined : noteKey,
                        snippet: m.content,
                      }}
                    />
                  )}
                </div>
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
        {orphan && (
          <div className="flex flex-col items-start gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-sm font-semibold text-muted">{t("ai16d.noAnswer")}</p>
            <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden />} onClick={retryLast}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {error === "economy.noChips" ? (
          <NoChipsNotice kind={mode} />
        ) : (
          error && (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-danger-soft px-3 py-2">
              <p className="text-sm font-semibold text-danger">{t(error)}</p>
              {retry && canRetryAiError(error) && (
                <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden />} onClick={retryLast} disabled={streaming}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          )
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
          aria-label={t("common.send")}
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
