import { Suspense } from "react";
import { PythonPage } from "@/components/python/PythonPage";

// useSearchParams требует Suspense: без него статическая сборка страницы падает.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PythonPage />
    </Suspense>
  );
}
