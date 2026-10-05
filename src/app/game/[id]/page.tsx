import { notFound } from "next/navigation";
import { gameById } from "@/games/registry";
import { GameShell } from "@/components/games/GameShell";
import { firstParam, resolveGameContext } from "@/lib/drill-meta";

// Игра: /game/<id>; «урок игрой» — ?lesson=<урок> или ?skills=a,b (навыки темы, без зачёта урока).
export default async function GamePage(props: PageProps<"/game/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!gameById(id)) notFound();
  const ctx = resolveGameContext({ lesson: firstParam(sp.lesson), skills: firstParam(sp.skills) });
  return <GameShell id={id} lessonId={ctx.lessonId} skills={ctx.skills.length ? ctx.skills : undefined} />;
}
