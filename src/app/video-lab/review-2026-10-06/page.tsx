import type { Metadata } from "next";
import ReviewGallery from "./ReviewGallery";

export const metadata: Metadata = {
  title: "Новые видеообъяснения — Informatica",
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewGallery />;
}
