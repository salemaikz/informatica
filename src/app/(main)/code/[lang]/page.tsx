import { notFound } from "next/navigation";
import { IDE_LANGS, type IdeLang } from "@/lib/ide/types";
import { IdeLangPage } from "@/components/ide/IdeLangPage";

export default async function CodeLangPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!IDE_LANGS.includes(lang as IdeLang)) notFound();
  return <IdeLangPage lang={lang} />;
}
