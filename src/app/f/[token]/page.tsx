import type { Metadata } from "next";
import { InviteLanding } from "@/components/duel/InviteLanding";
import { dict, type DictKey } from "@/i18n/dict";
import { APP_NAME } from "@/lib/site-meta";

// Приглашение в друзья /f/<token> (этап 16Д, Ф3). Не индексируется; превью — без имени приглашающего (имя видит только тот,
// кто открыл ссылку). Открытие ничего не меняет: добавление — только кнопкой (POST).
const bi = (k: DictKey) => dict[k];
const title = `${bi("social.meta.join").ru} · ${bi("social.meta.join").kk}`;
const description = `${bi("social.meta.join.desc").ru} · ${bi("social.meta.join.desc").kk}`;

export const metadata: Metadata = {
  title: { absolute: `${title} · ${APP_NAME}` },
  description,
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: APP_NAME, title, description },
};

export default async function InvitePage(props: PageProps<"/f/[token]">) {
  const { token } = await props.params;
  return <InviteLanding token={token} />;
}
