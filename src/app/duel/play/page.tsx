import { redirect } from "next/navigation";
import { DuelPlay } from "@/components/duel/DuelPlay";
import { firstParam } from "@/lib/drill-meta";
import { DUEL_MODES, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";

// Матч дуэли с Битом (этап 16Д, Ф1): /duel/play?mode=<режим>&seed=<uint32>[&topic=<тема>]. Полноэкранный, без нижнего меню
// (как /game). Набор заданий экран берёт с сервера (GET /api/duel/deck): банк в клиентский бандл не попадает.
export default async function DuelPlayPage(props: PageProps<"/duel/play">) {
  const sp = await props.searchParams;
  const mode = firstParam(sp.mode);
  if (!isDuelMode(mode)) redirect("/duel");
  const topic = firstParam(sp.topic);
  if (DUEL_MODES[mode].needsTopic && !isDuelTopic(topic)) redirect("/duel");
  const raw = firstParam(sp.seed);
  const seed = raw && /^\d{1,10}$/.test(raw) && Number(raw) <= 0xffff_ffff ? Number(raw) : null;
  const t = DUEL_MODES[mode].needsTopic ? topic : undefined;
  // Новый seed (реванш) — новый матч: экран собирается заново.
  return <DuelPlay key={`${mode}.${t ?? "-"}.${seed ?? "new"}`} mode={mode} topic={t} seed={seed} />;
}
