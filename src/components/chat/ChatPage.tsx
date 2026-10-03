"use client";

import { ChatList } from "./ChatList";
import { ChatScreen } from "./ChatScreen";

/** /tutor/[id]: на компьютере слева список чатов, справа сам чат; на телефоне — только чат. */
export function ChatPage({ id, initialDraft }: { id: string; initialDraft?: string }) {
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-5">
      <aside className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto">
        <ChatList activeId={id} compact />
      </aside>
      <ChatScreen key={id} id={id} initialDraft={initialDraft} />
    </div>
  );
}
