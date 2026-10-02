import { Suspense } from "react";
import { SearchScreen } from "@/components/theory/SearchScreen";

// useSearchParams требует Suspense: без него статическая сборка страницы падает.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}
