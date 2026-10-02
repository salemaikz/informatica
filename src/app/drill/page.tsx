import { firstParam, parseDrillMode } from "@/lib/drill";
import { DrillScreen } from "./DrillScreen";

// Тренировка: ?mode=smart | mistakes | review | skill&skill=ns.dec2bin | extern&unit=u2 | topic&topic=t05 | history&entry=<id теста>
export default async function DrillPage(props: PageProps<"/drill">) {
  const sp = await props.searchParams;
  const mode = parseDrillMode(firstParam(sp.mode));
  const key = [mode, firstParam(sp.skill), firstParam(sp.unit), firstParam(sp.topic), firstParam(sp.entry)].join("|");
  return <DrillScreen key={key} mode={mode} skill={firstParam(sp.skill)} unit={firstParam(sp.unit)} topic={firstParam(sp.topic)} entry={firstParam(sp.entry)} />;
}
