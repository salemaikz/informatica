import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalTitle } from "@/lib/site-meta";

export const metadata: Metadata = { title: legalTitle("about") };

export default function AboutPage() {
  return <LegalPage doc="about" />;
}
