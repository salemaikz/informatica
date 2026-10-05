import type { Metadata } from "next";
import { ResultLanding } from "@/components/share/ResultLanding";
import { metaTexts } from "@/components/share/labels";
import { parseShare } from "@/lib/share-code";
import { APP_NAME, siteDescription, siteTitle } from "@/lib/site-meta";

// Страница результата, которым поделились (#72): /r/<код>. Код разбираем на сервере строго; заголовок и описание превью —
// на языке из кода, берутся из словаря по меткам (строки из адреса не выводятся). Картинку превью подставляет opengraph-image
// этого же сегмента (в openGraph.images не указываем: иначе подхватится общая /og.png). Страницу не индексируем.
export async function generateMetadata(props: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const result = parseShare(code);
  const { title, description } = result ? metaTexts(result) : { title: siteTitle(), description: siteDescription() };
  return {
    title: { absolute: result ? `${title} · ${APP_NAME}` : siteTitle() },
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "website", siteName: APP_NAME, title, description, locale: result?.lang === "kk" ? "kk_KZ" : "ru_KZ" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedResultPage(props: PageProps<"/r/[code]">) {
  const { code } = await props.params;
  return <ResultLanding result={parseShare(code)} />;
}
