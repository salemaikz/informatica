import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalTitle } from "@/lib/site-meta";

export const metadata: Metadata = { title: legalTitle("privacy") };

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
