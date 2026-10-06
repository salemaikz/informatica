import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChallengePlay } from "@/components/duel/ChallengePlay";
import { firstParam } from "@/lib/drill-meta";
import { isRecNonce, newRecNonce, recHref } from "@/lib/duel/challenge";
import { DUEL_MODES, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";

// Запись вызова другу (этап 16Д, Ф3): /duel/rec?mode=<режим>[&topic=<тема>]&r=<nonce>. Полноэкранная, как /duel/play.
// Подписанный старт выдаёт сервер, ответы проверяет он же; ссылка /duel/c/<id> уходит другу.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DuelRecPage(props: PageProps<"/duel/rec">) {
  const sp = await props.searchParams;
  const mode = firstParam(sp.mode);
  if (!isDuelMode(mode)) redirect("/duel");
  const topic = firstParam(sp.topic);
  if (DUEL_MODES[mode].needsTopic && !isDuelTopic(topic)) redirect("/duel");
  const t = DUEL_MODES[mode].needsTopic ? topic : undefined;
  const nonce = firstParam(sp.r);
  if (!isRecNonce(nonce)) redirect(recHref(mode, t, newRecNonce()));
  return <ChallengePlay key={nonce} kind="solo" mode={mode} topic={t} nonce={nonce} />;
}
