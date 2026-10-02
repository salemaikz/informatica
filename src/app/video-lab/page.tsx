import type { Metadata } from "next";
import Gallery from "./Gallery";

export const metadata: Metadata = {
  title: "Видеолаборатория — Informatica",
  description: "Четыре тестовых стиля учебного ролика по информатике.",
  robots: { index: false, follow: false },
};

export default function VideoLabPage() {
  return <Gallery />;
}
