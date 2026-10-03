import { ChatPage } from "@/components/chat/ChatPage";

// Один чат с Битом. На компьютере слева — список чатов. ?q= — готовый черновик вопроса (из поиска).
export default async function TutorChatPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { id } = await props.params;
  const { q } = await props.searchParams;
  const draft = (Array.isArray(q) ? q[0] : q)?.slice(0, 500);
  return <ChatPage id={id} initialDraft={draft} />;
}
