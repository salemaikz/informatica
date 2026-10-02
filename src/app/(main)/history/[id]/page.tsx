import { HistoryDetail } from "@/components/history/HistoryDetail";

// Один тест из истории: итог, ошибки, исправление.
export default async function HistoryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <HistoryDetail id={id} />;
}
