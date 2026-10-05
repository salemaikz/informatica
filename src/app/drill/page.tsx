import { redirect } from "next/navigation";
import { firstParam, parseDrillMode } from "@/lib/drill-meta";
import { DrillScreen } from "./DrillScreen";

// Тренировка: ?mode=smart | mistakes | review | skill&skill=ns.dec2bin | topic&topic=t05 | history&entry=<id теста>
// Этап 14: practice&node=practice:<урок> | minitest&node=practice:<урок> | recap&unit=u3 | context&item=<id задания ЕНТ>
// Этап 15: codeview&area=py|db|sql|sheet|web|mix — «Чтение кода» как на ЕНТ
// Этап 16Б: «Сдать экстерном» убран — старая ссылка extern&unit=u2 ведёт на «Тест по разделу» (/exam/run?kind=unit&unit=u2).
export default async function DrillPage(props: PageProps<"/drill">) {
  const sp = await props.searchParams;
  const mode = parseDrillMode(firstParam(sp.mode));
  if (mode === "extern") {
    const unit = firstParam(sp.unit);
    redirect(unit && /^[a-z][a-z0-9]{0,15}$/.test(unit) ? `/exam/run?kind=unit&unit=${unit}` : "/learn");
  }
  const key = [mode, firstParam(sp.skill), firstParam(sp.unit), firstParam(sp.topic), firstParam(sp.entry), firstParam(sp.node), firstParam(sp.item), firstParam(sp.area)].join("|");
  return (
    <DrillScreen
      key={key}
      mode={mode}
      skill={firstParam(sp.skill)}
      unit={firstParam(sp.unit)}
      topic={firstParam(sp.topic)}
      entry={firstParam(sp.entry)}
      node={firstParam(sp.node)}
      item={firstParam(sp.item)}
      area={firstParam(sp.area)}
    />
  );
}
