"use client";

import { BookmarkPlus, Lightbulb, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
import { dropThread, finishThread, getThread, startThread, streamThread, useAiThreads } from "./ai-threads";
import { useTutor, type TutorTurn } from "./useTutor";

const NO_TURNS: TutorTurn[] = [];

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
  thread,
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
  /**
   * Ключ нити этого шага и режима (ai-threads.ts → threadKey): закрыли шторку и открыли снова — вопросы и ответы на месте;
   * ответ, который ещё идёт (в том числе после закрытия), показывается по мере прихода, второй раз вопрос не уходит.
   * Без ключа — нить живёт, пока открыта шторка.
   */
  thread?: string;
}) {
  const { t } = useT();
  // Закрыли шторку посреди ответа — запрос не обрывается (detach): ответ дойдёт и сохранится в нить через onTurns.
  const { ask, streaming, error } = useTutor({ detach: true });
  // Бесплатный текст: подсказка автора либо разбор неверного варианта + объяснение задания (оно есть всегда).
  const [staticText] = useState(() => staticAiText(mode, task));
  // Нить — в ai-threads (а не в состоянии шторки): её пишет и запрос, начатый в уже закрытой шторке.
  const localId = useId();
  const key = thread ?? `local:${localId}`;
  const saved = useAiThreads((s) => s.threads[key]);
  const base = saved?.turns ?? NO_TURNS;
  // Ответ в пути — этой шторкой или до закрытия прошлой: второй раз не спрашиваем, ждём его.
  const busy = streaming || !!saved?.pending;
  const turns: TutorTurn[] = saved?.pending && base[base.length - 1]?.role !== "assistant" ? [...base, { role: "assistant", content: "" }] : base;
  // Нить восстановлена (или ответ в пути) — вопрос при открытии (autoAsk) второй раз не отправляем.
  const [restored] = useState(() => {
    const th = getThread(key);
    return !!th && (th.pending || th.turns.length > 0);
  });
  // Нить без ключа живёт, пока открыта шторка.
  useEffect(() => (thread ? undefined : () => dropThread(key)), [thread, key]);
  const [draft, setDraft] = useState("");
  // Последний запрос к ИИ, который не удался: «Повторить» шлёт ту же историю заново, не дублируя сообщение ученика.
  const [retry, setRetry] = useState<TutorTurn[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Запрос пишет в нить сразу (вопрос + «ответ в пути»), по ходу ответа и в конце — и когда шторку уже закрыли.
  // Запись устаревшего запуска (был новый запрос, нить очищена) нить не трогает (rev в ai-threads).
  const stream = async (history: TutorTurn[]) => {
    setRetry(history);
    const rev = startThread(key, history);
    const text = await ask({ mode, task, messages: history }, (full) => {
      streamThread(key, rev, [...history, { role: "assistant", content: full }]);
    });
    const mine = finishThread(key, rev, text === null ? history : [...history, { role: "assistant", content: text }]);
    if (mine && text !== null) setRetry(null);
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [saved]);

  // «Спросить Бита / Ещё подсказка / Подробнее от Бита» — запрос к ИИ только по нажатию.
  const askMore = () => {
    if (busy) return;
    void stream([]);
  };

  // «Повторить» после сбоя или оборванного ответа: та же история, сообщение ученика второй раз не добавляется.
  // Нить из памяти кончается вопросом без ответа — повторяем её.
  const orphan = !busy && !error && unansweredTail(base);
  const retryLast = () => {
    const history = retry ?? (orphan ? base : null);
    if (busy || !history) return;
    void stream(history);
  };

  const send = (text?: string) => {
    const q = (text ?? draft).trim();
    if (!q || busy) return;
    if (!text) setDraft("");
    void stream([...base, { role: "user", content: q }]);
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
          <Button variant="ai" block icon={<Sparkles size={18} />} onClick={askMore} disabled={busy}>
            {t(!staticText ? "ai.askBit" : mode === "hint" ? "ai.moreHint" : "ai.moreExplain")}
            <AiCost kind={mode} variant="solid" />
          </Button>
        )}
        {turns.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="self-end rounded-2xl rounded-br-md bg-action-primary px-3.5 py-2 font-semibold text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="rounded-2xl rounded-bl-md border-2 border-ai/25 bg-ai-soft px-4 py-3">
              {m.content ? <Markdown>{m.content}</Markdown> : <span className="animate-pulse font-semibold text-ai">{t("common.loading")}</span>}
              {m.content && !(busy && i === turns.length - 1) && (
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
                <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden />} onClick={retryLast} disabled={busy}>
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
          disabled={!draft.trim() || busy}
          aria-label={t("common.send")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-action-ai text-white disabled:opacity-40"
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
