import { ExamHub } from "@/components/exam/ExamHub";
import { EntOnly } from "@/components/school/EntOnly";

// Пробный ЕНТ: хаб (три вида, прогноз, история). В школьном треке — карточка «Этот раздел — для подготовки к ҰБТ» (#52).
export default function ExamPage() {
  return (
    <EntOnly>
      <ExamHub />
    </EntOnly>
  );
}
