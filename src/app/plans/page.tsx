import { Suspense } from "react";
import { PlansScreen } from "@/components/plans/PlansScreen";

// useSearchParams (параметр from) требует Suspense при статической сборке.
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansScreen />
    </Suspense>
  );
}
