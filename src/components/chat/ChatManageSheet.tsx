"use client";

import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteMessages } from "@/lib/chat-store";
import { useApp } from "@/lib/store";
import { TITLE_LEN } from "@/lib/chats";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { displayTitle } from "./helpers";

export type ManageView = "actions" | "rename" | "delete";
/** Что открыто: чат, начальный вид и счётчик открытий (чтобы сбрасывать внутренний вид). */
export interface ManageTarget {
  id: string;
  view: ManageView;
  nonce: number;
}

let manageSeq = 0;
/** Всегда растущий счётчик открытий — сбрасывает внутренний вид шторки при каждом новом открытии. */
export const nextManageNonce = () => ++manageSeq;

function RenameForm({ initial, onSave }: { initial: string; onSave: (title: string) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <h2 className="text-lg font-extrabold">{t("chat2.rename.title")}</h2>
      <input
        autoFocus
        value={draft}
        maxLength={TITLE_LEN}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("chat2.rename.placeholder")}
        className="h-12 rounded-2xl border-2 border-border bg-surface px-4 font-bold outline-none focus:border-ai"
      />
      <Button type="submit" variant="ai" block disabled={!draft.trim()}>
        {t("common.save")}
      </Button>
    </form>
  );
}

/** Действия над чатом одной шторкой: меню (закрепить, переименовать, удалить) → поле названия / подтверждение удаления. */
export function ChatManageSheet({
  target,
  onClose,
  onDeleted,
}: {
  target: ManageTarget | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const { t, lang } = useT();
  const chats = useApp((s) => s.chats);
  const renameChat = useApp((s) => s.renameChat);
  const pinChat = useApp((s) => s.pinChat);
  const deleteChat = useApp((s) => s.deleteChat);
  const [override, setOverride] = useState<{ nonce: number; view: ManageView } | null>(null);

  const chat = target ? chats.find((c) => c.id === target.id) : undefined;
  const view: ManageView = target ? (override && override.nonce === target.nonce ? override.view : target.view) : "actions";
  const go = (v: ManageView) => target && setOverride({ nonce: target.nonce, view: v });

  const row =
    "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-extrabold hover:bg-surface-2";

  return (
    <Modal open={!!target && !!chat} onClose={onClose} label={t("chat2.menu.open")}>
      {target && chat && view === "actions" && (
        <div className="flex flex-col gap-1">
          <h2 className="mb-1 truncate px-1 text-lg font-extrabold">{displayTitle(chat, lang, t)}</h2>
          <button type="button" className={row} onClick={() => go("rename")}>
            <Pencil size={20} className="text-ai" aria-hidden /> {t("chat2.menu.rename")}
          </button>
          <button
            type="button"
            className={row}
            onClick={() => {
              pinChat(chat.id, !chat.pinned);
              onClose();
            }}
          >
            {chat.pinned ? <PinOff size={20} className="text-ai" aria-hidden /> : <Pin size={20} className="text-ai" aria-hidden />}
            {chat.pinned ? t("chat2.menu.unpin") : t("chat2.menu.pin")}
          </button>
          <button type="button" className={`${row} text-danger`} onClick={() => go("delete")}>
            <Trash2 size={20} aria-hidden /> {t("chat2.menu.delete")}
          </button>
        </div>
      )}
      {target && chat && view === "rename" && (
        <RenameForm
          initial={chat.title}
          onSave={(title) => {
            renameChat(chat.id, title);
            onClose();
          }}
        />
      )}
      {target && chat && view === "delete" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{t("chat2.delete.title")}</h2>
          <p className="font-semibold text-muted">{t("chat2.delete.text")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteChat(chat.id);
                void deleteMessages(chat.id);
                onClose();
                onDeleted?.(chat.id);
              }}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
