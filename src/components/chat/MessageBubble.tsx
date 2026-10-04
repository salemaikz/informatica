"use client";

import { BookmarkPlus, Camera, Mic } from "lucide-react";
import type { ChatMsg } from "@/lib/chats";
import { isCrisisReply } from "@/lib/safety";
import { useT } from "@/i18n/useT";
import { Markdown } from "@/components/Markdown";
import { ReportIssueButton } from "@/components/issue/ReportIssueButton";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { SpeakButton } from "./voice/SpeakButton";

/** Сообщение ученика (справа). */
export function UserBubble({ msg }: { msg: ChatMsg }) {
  const { t } = useT();
  return (
    <div className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 font-semibold text-white">
      {msg.hadImage && <Camera size={16} className="-mt-0.5 mr-1.5 inline" aria-label={t("chat2.msg.photo")} />}
      {msg.voice && <Mic size={16} className="-mt-0.5 mr-1.5 inline" aria-label={t("chat2.msg.voice")} />}
      {msg.content}
    </div>
  );
}

/** Ответ Бита (слева, фиолетовая рамка ИИ): «В конспект», «Озвучить» и «Сообщить об ошибке» (кроме кризисного ответа). */
export function BitBubble({ msg }: { msg: ChatMsg }) {
  const { t } = useT();
  return (
    <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
      <Markdown>{msg.content}</Markdown>
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <button
          type="button"
          // Открываем шторку выбора папки — молча в конспект не сохраняем.
          onClick={() => useSaveToNotes.getState().open({ source: "ai", text: msg.content })}
          className="flex min-h-10 items-center gap-1 text-xs font-extrabold text-ai"
        >
          <BookmarkPlus size={14} />
          {t("tutor.saveNote")}
        </button>
        <SpeakButton text={msg.content} />
        {!isCrisisReply(msg.content) && <ReportIssueButton compact target={{ kind: "ai", where: "chat", snippet: msg.content }} />}
      </div>
    </div>
  );
}

/** Ответ Бита, который ещё приходит потоком. */
export function PendingBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
      {text ? <Markdown>{text}</Markdown> : <span className="animate-pulse font-semibold text-ai">…</span>}
    </div>
  );
}
