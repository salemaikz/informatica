import type { Metadata } from "next";
import { ReportView } from "@/components/report/ReportView";
import { biText } from "@/lib/site-meta";
import { reportDict } from "@/i18n/parts/report";

// Отчёт для родителей (#74): данные целиком во фрагменте адреса, сервер их не видит. Не индексируется,
// адрес дальше не передаётся (no-referrer), заголовок общий — без личных данных. Превью ссылки — общее, как у сайта.
export const metadata: Metadata = {
  title: biText(reportDict["report.title"], " · "),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ReportPage() {
  return <ReportView />;
}
