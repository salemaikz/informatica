"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Ellipsis, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteMessages, loadMessages, saveMessages } from "@/lib/chat-store";
import { autoTitle, MAX_MESSAGES, type ChatMsg, type QuizSummary } from "@/lib/chats";
import { canRetryAiError } from "@/lib/ai-errors";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/image";
import { useApp } from "@/lib/store";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { useTutor } from "@/components/ai/useTutor";
import { Mascot } from "@/components/mascot/Mascot";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChatEmpty } from "./ChatEmpty";
import { ChatManageSheet, nextManageNonce, type ManageTarget } from "./ChatManageSheet";
import { Composer } from "./Composer";
import { LessonChips, LessonIntro } from "./LessonChat";
import { chatHeader, firstUserText, lastPreview, quizInHistory, reviewRequest, toHistory } from "./helpers";
import { BitBubble, PendingBubble, UserBubble } from "./MessageBubble";
import { ModeIcon } from "./ModeIcon";
import { QuizCard } from "./QuizCard";

// «Дай задачи» собирает задания из банка навыков — тяжёлый кусок, грузится только в чате «Дай задачи» (этап 16):
// заранее при открытии такого чата, пока кусок качается — «Загрузка…» на месте задач.
const loadQuiz = () => import("./quiz/ChatQuiz");
const ChatQuiz = dynamic(() => loadQuiz().then((m) => m.ChatQuiz), { ssr: false, loading: () => <QuizLoading /> });

function QuizLoading() {
  const { t } = useT();
  return <p className="px-1 font-semibold text-muted">{t("common.loading")}</p>;
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Состояние «Дай задачи» в ленте: off — скрыто, объект — запущено (key меняется при новом запуске). */
type QuizState = "off" | { key: number };

/**
 * Экран одного чата: шапка, лента, поле ввода. Монтировать с key={id}.
 * embedded — внутри панели Бита (components/guide/BitChatPanel): высота задаёт панель, лента прокручивается сама,
 * поле ввода внизу, без кнопки «назад» и меню «⋯»; actions — кнопки панели справа в шапке.
 */
export function ChatScreen({
  id,
  initialDraft,
  embedded,
  actions,
}: {
  id: string;
  initialDraft?: string;
  embedded?: boolean;
  actions?: ReactNode;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const chat = useApp((s) => s.chats.find((c) => c.id === id));
  const touchChat = useApp((s) => s.touchChat);
  const deleteChat = useApp((s) => s.deleteChat);
  const { ask, stop, streaming, error } = useTutor();

  const [messages, setMessages] = useState<ChatMsg[] | null>(null);
  const msgsRef = useRef<ChatMsg[]>([]);
  const [draft, setDraft] = useState(initialDraft ?? "");
  const [fromVoice, setFromVoice] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<"chat" | "photo">("chat");
  const [voiceError, setVoiceError] = useState<DictKey | null>(null);
  const [quizState, setQuizState] = useState<QuizState>("off");
  const [manage, setManage] = useState<ManageTarget | null>(null);
  const pendingRef = useRef("");
  const stoppedRef = useRef(false);
  // Фото последнего вопроса: «Повторить» после сбоя шлёт его же заново (в ленте хранится только пометка hadImage).
  const lastImageRef = useRef<string | undefined>(undefined);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Загрузка переписки из IndexedDB.
  useEffect(() => {
    let cancelled = false;
    void loadMessages(id).then((m) => {
      if (cancelled) return;
      msgsRef.current = m;
      setMessages(m);
      // «Дай задачи»: в новом пустом чате квиз стартует сам, один раз при загрузке.
      if (m.length === 0 && useApp.getState().chats.find((c) => c.id === id)?.mode === "tasks") setQuizState({ key: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const quizOpen = typeof quizState === "object";
  const quizShown = chat?.mode === "tasks" && messages !== null && quizOpen;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages?.length, pending, quizShown]);

  // Чат «Дай задачи»: кусок с задачами качаем заранее, чтобы «Ещё задачи» открывались сразу.
  useEffect(() => {
    if (chat?.mode === "tasks") void loadQuiz();
  }, [chat?.mode]);

  if (!chat) {
    // В панели Бита исчезнувший чат (удалили) подменяет сама панель — здесь пусто.
    if (embedded) return null;
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-xl font-extrabold">{t("chat2.notFound")}</p>
        <p className="font-semibold text-muted">{t("chat2.notFound.text")}</p>
        <ButtonLink href="/tutor" variant="ai" icon={<ArrowLeft size={18} />}>
          {t("chat2.back")}
        </ButtonLink>
      </div>
    );
  }

  const { title, subtitle } = chatHeader(chat, lang, t);

  /** Новая лента: в память, на диск и в метаданные списка (превью, счётчик, название по первому вопросу). */
  const commit = (next: ChatMsg[]) => {
    const trimmed = next.slice(-MAX_MESSAGES);
    msgsRef.current = trimmed;
    setMessages(trimmed);
    void saveMessages(id, trimmed);
    touchChat(id, { preview: lastPreview(trimmed, t), count: trimmed.length, title: autoTitle(firstUserText(trimmed)) });
  };

  /** Запрос к ИИ по ленте как есть (сообщение ученика уже в ней): ответ дописывается в ленту. */
  const run = async (img?: string) => {
    stoppedRef.current = false;
    pendingRef.current = "";
    setPending("");
    const answer = await ask(
      { mode: "chat", messages: toHistory(msgsRef.current, lang, t), image: img, chatMode: chat.mode, topic: chat.topic, lessonId: chat.lessonId },
      (full) => {
        pendingRef.current = full;
        setPending(full);
      },
    );
    setPending(null);
    // Остановили на полуслове — оставляем уже показанную часть ответа.
    // Сбой или обрыв ответа (answer === null без «Стоп») — ничего не сохраняем: ошибка и «Повторить» под лентой.
    const text2 = answer ?? (stoppedRef.current ? pendingRef.current.trim() : "");
    if (text2) commit([...msgsRef.current, { id: newId(), role: "assistant", content: text2, at: Date.now() }]);
  };

  /** Ядро отправки: фото и голос передаём явно, черновик не трогаем. */
  const send = async ({ text, image: img, voice }: { text: string; image?: string; voice?: boolean }) => {
    const q = text.trim() || (img ? t("tutor.photoQuestion") : "");
    if (!q || streaming || messages === null) return;
    setVoiceError(null);
    setLastKind(img ? "photo" : "chat");
    lastImageRef.current = img;
    commit([...msgsRef.current, { id: newId(), role: "user", content: q, hadImage: img ? true : undefined, voice: voice ? true : undefined, at: Date.now() }]);
    await run(img);
  };

  /** «Повторить»: тот же вопрос ещё раз, без второй копии сообщения ученика в ленте. */
  const retry = () => {
    if (streaming || messages === null) return;
    setVoiceError(null);
    void run(lastImageRef.current);
  };

  /** Отправка из поля ввода: берёт черновик, фото и признак голоса и очищает их. */
  const sendDraft = () => {
    const img = image;
    if ((!draft.trim() && !img) || streaming || messages === null) return;
    const voice = fromVoice && !!draft.trim();
    const text = draft;
    setDraft("");
    setImage(undefined);
    setFromVoice(false);
    void send({ text, image: img, voice });
  };

  const onQuizDone = (summary: QuizSummary) => {
    setQuizState("off");
    commit([
      ...msgsRef.current,
      { id: newId(), role: "assistant", content: t("chat2.quiz.preview", { correct: summary.correct, total: summary.total, grade: summary.grade }), quiz: summary, at: Date.now() },
    ]);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setImage(await compressImage(file, 1280));
    } catch {
      setVoiceError("tutor.error");
    }
  };

  const goBack = () => {
    // Пустой чат (создали и сразу вышли) не копим в списке.
    // Решаем по метаданным: пустой результат чтения IndexedDB не значит, что чат пуст.
    if (chat.count === 0 && msgsRef.current.length === 0 && !streaming) {
      deleteChat(id);
      void deleteMessages(id);
    }
    // Чат по теме урока — назад к уроку теории, из которого пришли.
    router.push(chat.lessonId ? `/theory/${chat.lessonId}` : "/tutor");
  };

  const openManage = (view: ManageTarget["view"]) => setManage({ id, view, nonce: nextManageNonce() });
  const list = messages ?? [];
  const lastQuizId = [...list].reverse().find((m) => m.quiz)?.id;
  const shownError = voiceError ?? error;
  // «Повторить» — когда последний вопрос остался без ответа из-за сбоя ИИ (не голос и не лимиты).
  const canRetry = !voiceError && canRetryAiError(error) && list[list.length - 1]?.role === "user" && !streaming;
  const empty = messages !== null && list.length === 0 && pending === null && !quizShown;

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", embedded ? "h-full min-h-0" : "min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100dvh-5rem)]")}>
      <div className="flex shrink-0 items-center gap-2">
        {!embedded && (
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 lg:hidden"
            aria-label={t("chat2.back")}
          >
            <ArrowLeft size={22} />
          </button>
        )}
        {embedded && (
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft">
            <Mascot size={32} className="pointer-events-none" />
          </span>
        )}
        <button
          type="button"
          onClick={() => openManage("rename")}
          className="min-w-0 flex-1 rounded-xl px-1 py-0.5 text-left hover:bg-surface-2"
          title={t("chat2.renameHint")}
          aria-label={`${title}. ${t("chat2.renameHint")}`}
        >
          <span className="block truncate text-lg font-extrabold">{title}</span>
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-ai">
            <ModeIcon mode={chat.mode} size={14} lesson={!!chat.lessonId} />
            {subtitle && <span className="truncate">{subtitle}</span>}
          </span>
        </button>
        {!embedded && (
          <button
            type="button"
            onClick={() => openManage("actions")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ai"
            aria-label={t("chat2.menu.open")}
          >
            <Ellipsis size={22} />
          </button>
        )}
        {actions}
      </div>

      <div className={cn("flex flex-1 flex-col gap-3", embedded && "min-h-0 overflow-y-auto overscroll-contain")}>
        {messages === null && <p className="py-10 text-center font-bold text-muted">{t("common.loading")}</p>}
        {chat.lessonId && messages !== null && <LessonIntro lessonId={chat.lessonId} />}
        {empty && chat.lessonId && <LessonChips onSend={(text) => void send({ text })} />}
        {empty && !chat.lessonId && (
          <ChatEmpty
            chat={chat}
            onSend={(text) => void send({ text })}
            onPhoto={(source) => (source === "camera" ? cameraRef : galleryRef).current?.click()}
            onStartQuiz={() => setQuizState({ key: Date.now() })}
          />
        )}

        {list.map((m) =>
          m.quiz ? (
            <QuizCard
              key={m.id}
              quiz={m.quiz}
              actions={m.id === lastQuizId && !quizShown}
              busy={streaming}
              onMore={() => setQuizState({ key: Date.now() })}
              onReview={() => void send({ text: reviewRequest(m.quiz!, t, !quizInHistory(msgsRef.current, m.id)) })}
            />
          ) : m.role === "user" ? (
            <UserBubble key={m.id} msg={m} />
          ) : (
            <BitBubble key={m.id} msg={m} />
          ),
        )}

        {quizShown && (
          <ChatQuiz
            key={quizOpen ? quizState.key : 0}
            topic={chat.topic}
            onDone={onQuizDone}
            onCancel={() => setQuizState("off")}
          />
        )}
        {pending !== null && <PendingBubble text={pending} />}
        {shownError === "economy.noChips" ? (
          <NoChipsNotice kind={voiceError ? "voice" : lastKind} />
        ) : (
          shownError && (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-danger-soft px-3 py-2">
              <p className="text-sm font-bold text-danger">{t(shownError)}</p>
              {canRetry && (
                <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden />} onClick={retry} disabled={streaming}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          )
        )}
        <div ref={bottom} />
      </div>

      <Composer
        draft={draft}
        onDraft={setDraft}
        image={image}
        onImage={setImage}
        placeholder={t(chat.mode === "check" ? "chat2.check.placeholder" : "tutor.placeholder")}
        streaming={streaming}
        onSend={sendDraft}
        onStop={() => {
          stoppedRef.current = true;
          stop();
        }}
        onAttach={() => galleryRef.current?.click()}
        onVoiceText={(text) => {
          setVoiceError(null);
          setFromVoice(true);
          setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
        }}
        onVoiceError={setVoiceError}
        className={embedded ? "static shrink-0 shadow-none" : undefined}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />

      <ChatManageSheet
        target={manage}
        onClose={() => setManage(null)}
        onDeleted={() => router.replace("/tutor")}
      />
    </div>
  );
}

