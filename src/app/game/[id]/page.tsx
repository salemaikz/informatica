import { notFound } from "next/navigation";
import { gameById } from "@/games/registry";
import { GameShell } from "@/components/games/GameShell";

export default async function GamePage(props: PageProps<"/game/[id]">) {
  const { id } = await props.params;
  if (!gameById(id)) notFound();
  return <GameShell id={id} />;
}
