import type { Metadata } from "next";
import VariantGallery from "./VariantGallery";

export const metadata: Metadata = {
  title: "Варианты визуалов и видео — Informatica",
  robots: { index: false, follow: false },
};

export default function VariantsPage() { return <VariantGallery />; }
