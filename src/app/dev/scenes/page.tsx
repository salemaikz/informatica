import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SceneGallery } from "./SceneGallery";

// Галерея рисунков (этап 16Б, волна 3): все образцы новых и расширенных сцен на одной странице — для скриншотов
// на ширине телефона в обеих темах. Только для разработчика: без SCENES_GALLERY=1 в окружении — 404. Только по-русски.

export const metadata: Metadata = { title: "Сцены", robots: { index: false, follow: false, nocache: true } };

export default async function ScenesPage() {
  // Сначала запрос: иначе при сборке «404» запеклась бы в статику.
  await connection();
  if (process.env.SCENES_GALLERY !== "1") notFound();
  return (
    <Suspense>
      <SceneGallery />
    </Suspense>
  );
}
