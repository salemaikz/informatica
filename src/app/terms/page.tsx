import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalTitle } from "@/lib/site-meta";

export const metadata: Metadata = { title: legalTitle("terms") };

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
