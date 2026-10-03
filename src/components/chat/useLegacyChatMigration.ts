"use client";

import { useEffect } from "react";
import { deleteMessages, saveMessages } from "@/lib/chat-store";
import { previewOf } from "@/lib/chats";
import { useApp } from "@/lib/store";
import { translate } from "@/i18n/useT";
import { legacyToMsgs } from "./helpers";

// Миграция в работе: все вызовы ждут один и тот же промис (StrictMode, смена activeId).
let inflight: Promise<void> | null = null;

/**
 * При показе списка: один раз переносит старый одиночный чат (store.chat) в первый чат «Мой чат»
 * и убирает пустые чаты (создали и ушли), кроме открытого сейчас.
 */
export function useLegacyChatMigration(activeId?: string) {
  useEffect(() => {
    void (async () => {
      await migrateLegacyChat();
      await pruneEmptyChats(activeId);
    })();
  }, [activeId]);
}

export async function pruneEmptyChats(exceptId?: string): Promise<void> {
  for (const c of useApp.getState().chats) {
    if (c.count !== 0 || c.id === exceptId) continue;
    useApp.getState().deleteChat(c.id);
    await deleteMessages(c.id);
  }
}

export function migrateLegacyChat(): Promise<void> {
  return (inflight ??= doMigrate().finally(() => {
    inflight = null;
  }));
}

async function doMigrate(): Promise<void> {
  const app = useApp.getState();
  if (app.chat.length === 0) return;
  const msgs = legacyToMsgs(app.chat);
  if (msgs.length === 0) {
    app.clearChat();
    return;
  }
  const lang = app.profile.lang;
  const id = app.createChat("free", translate(lang, "chat2.legacyTitle"));
  // Чат сразу не пустой — чтобы чистка пустых его не тронула.
  useApp.getState().touchChat(id, { preview: previewOf(msgs[msgs.length - 1].content), count: msgs.length });
  // Сначала сообщения, потом очистка старого: при сбое ничего не теряется.
  await saveMessages(id, msgs);
  useApp.getState().clearChat();
}
