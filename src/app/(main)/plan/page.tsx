import { PlanView } from "@/components/plan/PlanView";
import { EntOnly } from "@/components/school/EntOnly";

// План подготовки на недели до ЕНТ: сводка и список недель с делами. В школьном треке — карточка с выходом (#52).
export default function PlanPage() {
  return (
    <EntOnly>
      <PlanView />
    </EntOnly>
  );
}
