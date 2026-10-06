import { Suspense } from "react";
import { TheoryHome } from "@/components/theory/TheoryHome";

// Раздел из адреса (`?unit=u3`) читает сам TheoryHome через useSearchParams — страница остаётся статической
// (быстрый переход из меню), а useSearchParams требует Suspense: без него статическая сборка страницы падает.
export default function TheoryPage() {
  return (
    <Suspense fallback={null}>
      <TheoryHome />
    </Suspense>
  );
}
