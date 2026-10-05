import { Suspense } from "react";
import { DiagnosticScreen } from "@/components/diagnostic/DiagnosticScreen";
import { EntOnly } from "@/components/school/EntOnly";

// Входная диагностика (#70) — полноэкранный маршрут вне (main), как /plans. Только для подготовки к ЕНТ:
// школьному треку диагностика не предлагается — если откроет по ссылке, увидит карточку-страж, а не пустой экран.
// useSearchParams (параметр from) требует Suspense при статической сборке.
export default function DiagnosticPage() {
  return (
    <EntOnly fullscreen>
      <Suspense fallback={null}>
        <DiagnosticScreen />
      </Suspense>
    </EntOnly>
  );
}
