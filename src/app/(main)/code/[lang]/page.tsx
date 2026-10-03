import { IdeLangPage } from "@/components/ide/IdeLangPage";

export default async function CodeLangPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <IdeLangPage lang={lang} />;
}
