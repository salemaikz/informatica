import { IdeTaskPage } from "@/components/ide/IdeTaskPage";

export default async function CodeTaskPage({ params }: { params: Promise<{ lang: string; task: string }> }) {
  const { lang, task } = await params;
  return <IdeTaskPage key={`${lang}/${task}`} lang={lang} taskId={task} />;
}
