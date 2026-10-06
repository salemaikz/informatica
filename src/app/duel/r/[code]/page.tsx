import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LivePlay } from "@/components/duel/LivePlay";
import { normalizeRoomCode } from "@/lib/duel/live";

// Вход в комнату друга по ссылке (этап 16Д, Ф4; docs/specs/duels.md §9): /duel/r/<код из 6 знаков>. Не индексируется.
// Превью мессенджера страницу не «нажимает»: вход в комнату — POST из браузера после загрузки экрана. Новый ученик сначала
// проходит онбординг — ссылку запоминает pending-link и открывает сразу после него.

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DuelRoomPage(props: PageProps<"/duel/r/[code]">) {
  const { code } = await props.params;
  const norm = normalizeRoomCode(code);
  if (!norm) redirect("/duel");
  return <LivePlay key={norm} start={{ kind: "join", code: norm }} />;
}
