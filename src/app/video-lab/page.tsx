import type { Metadata } from "next";
import Gallery from "./Gallery";

export const metadata: Metadata = {
  title: "Видеолаборатория — Informatica",
  description: "Черновики анимированных объяснений по информатике для выбора и просмотра.",
  robots: { index: false, follow: false },
};

export default function VideoLabPage() {
  return <Gallery />;
}
