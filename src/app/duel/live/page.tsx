import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LivePlay, type LiveStart } from "@/components/duel/LivePlay";
import { firstParam } from "@/lib/drill-meta";
import { DUEL_MODES, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";

// Живой матч дуэли (этап 16Д, Ф4): /duel/live?find=blitz — случайный соперник; ?room=<режим>[&topic=] — комната для друга;
// ?m=<id матча> — вернуться в матч после перезагрузки (место — в sessionStorage). Полноэкранный, без нижнего меню.

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DuelLivePage(props: PageProps<"/duel/live">) {
  const sp = await props.searchParams;
  const m = firstParam(sp.m);
  const room = firstParam(sp.room);
  const topic = firstParam(sp.topic);
  let start: LiveStart;
  if (m && /^[A-Za-z0-9_-]{12}$/.test(m)) start = { kind: "match", matchId: m };
  else if (firstParam(sp.find) === "blitz") start = { kind: "find" };
  else if (isDuelMode(room)) {
    if (DUEL_MODES[room].needsTopic && !isDuelTopic(topic)) redirect("/duel");
    start = { kind: "room", mode: room, ...(DUEL_MODES[room].needsTopic ? { topic } : {}) };
  } else redirect("/duel");
  // Ключ — из адреса: переход внутри /duel/live (например, «Создать свою комнату» с экрана ошибки ?m=…) — новый экран
  // со своим стартом, а не тот же смонтированный автомат (сегмент страницы в Next не зависит от query).
  return <LivePlay key={JSON.stringify(start)} start={start} />;
}
