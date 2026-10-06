import { redirect } from "next/navigation";
import { DuelPlay } from "@/components/duel/DuelPlay";
import { firstParam } from "@/lib/drill-meta";
import { parseDuelSeed } from "@/lib/duel/api";
import { DUEL_MODES, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";

// Матч дуэли с Битом (этап 16Д, Ф1): /duel/play?mode=<режим>&seed=<uint32>[&topic=<тема>][&entry=<uint32>]. Полноэкранный, без нижнего меню
// (как /game). Набор заданий экран берёт с сервера (GET /api/duel/deck): банк в клиентский бандл не попадает.
export default async function DuelPlayPage(props: PageProps<"/duel/play">) {
  const sp = await props.searchParams;
  const mode = firstParam(sp.mode);
  if (!isDuelMode(mode)) redirect("/duel");
  const topic = firstParam(sp.topic);
  if (DUEL_MODES[mode].needsTopic && !isDuelTopic(topic)) redirect("/duel");
  const seed = parseDuelSeed(firstParam(sp.seed));
  // entry — seed прерванного оплаченного матча (бесплатный перезапуск с новым набором).
  const entry = seed === null ? null : parseDuelSeed(firstParam(sp.entry));
  const t = DUEL_MODES[mode].needsTopic ? topic : undefined;
  // Новый seed (реванш) — новый матч: экран собирается заново.
  return <DuelPlay key={`${mode}.${t ?? "-"}.${seed ?? "new"}.${entry ?? "-"}`} mode={mode} topic={t} seed={seed} entry={entry} />;
}
