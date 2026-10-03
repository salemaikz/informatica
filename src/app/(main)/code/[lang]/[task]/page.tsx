import { notFound } from "next/navigation";
import { IDE_LANGS, type IdeLang } from "@/lib/ide/types";
import { IdeTaskPage } from "@/components/ide/IdeTaskPage";

export default async function CodeTaskPage({ params }: { params: Promise<{ lang: string; task: string }> }) {
  const { lang, task } = await params;
  if (!IDE_LANGS.includes(lang as IdeLang)) notFound();
  return <IdeTaskPage key={`${lang}/${task}`} lang={lang} taskId={task} />;
}
