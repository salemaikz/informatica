import { CodeReviewHub } from "@/components/ide/CodeReviewHub";
import { REVIEW_AREAS } from "@/lib/code-review-areas";
import { reviewCounts } from "@/lib/code-review-drill";

// «Чтение кода» как на ЕНТ (этап 15, #87): выбор области, 10 заданий в тренировке. Статический сегмент важнее /code/[lang].
// Счётчики заданий считаются на сервере при сборке — в клиент уходят только числа, без банка ЕНТ.
export default function CodeReviewPage() {
  const areas = REVIEW_AREAS.map((a) => ({ id: a.id, ...reviewCounts(a.id) }));
  return <CodeReviewHub areas={areas} />;
}
