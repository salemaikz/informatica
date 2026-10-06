import type { Metadata } from "next";
import { ChallengeLanding } from "@/components/duel/ChallengeLanding";
import { dict, type DictKey } from "@/i18n/dict";
import { APP_NAME } from "@/lib/site-meta";

// Вызов на дуэль /duel/c/<id> (этап 16Д, Ф3). Не индексируется; превью — без имени вызывающего (имя видит только тот, кто
// открыл ссылку, решение #72 меняется только для страницы). Новый ученик проходит онбординг — ссылку вернёт pending-link.
const bi = (k: DictKey) => dict[k];
const title = `${bi("duel.ch.title").ru} · ${bi("duel.ch.title").kk}`;
const description = `${bi("duel.ch.meta.desc").ru} · ${bi("duel.ch.meta.desc").kk}`;

export const metadata: Metadata = {
  title: { absolute: `${title} · ${APP_NAME}` },
  description,
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: APP_NAME, title, description },
};

export default async function ChallengePage(props: PageProps<"/duel/c/[id]">) {
  const { id } = await props.params;
  return <ChallengeLanding key={id} id={id} />;
}
