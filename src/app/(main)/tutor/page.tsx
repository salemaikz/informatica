"use client";

import { Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { clip } from "@/components/chat/helpers";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ChatList } from "@/components/chat/ChatList";
import { Button } from "@/components/ui/Button";
import { PageTip } from "@/components/tour/PageTip";

/** Пришли из поиска (?q=): кнопка создаёт свободный чат с готовым черновиком (сообщение не отправляется само). */
function AskFromSearch() {
  const { t } = useT();
  const router = useRouter();
  const createChat = useApp((s) => s.createChat);
  const q = useSearchParams().get("q")?.trim().slice(0, 500);
  if (!q) return null;
  return (
    <Button
      variant="ai"
      block
      icon={<Sparkles size={20} />}
      onClick={() => {
        const id = createChat("free", "");
        router.push(`/tutor/${id}?q=${encodeURIComponent(q)}`);
      }}
    >
      {t("chat2.askFromSearch", { q: clip(q, 60) })}
    </Button>
  );
}

// Список чатов с Битом: поиск, закреплённые, новый чат по режиму.
export default function TutorPage() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4">
      <PageTip id="page-tutor" />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ai">
          <Sparkles size={24} /> {t("chat2.list.title")}
        </h1>
        <p className="font-semibold text-muted">{t("chat2.list.subtitle")}</p>
      </div>
      <Suspense fallback={null}>
        <AskFromSearch />
      </Suspense>
      <ChatList />
    </div>
  );
}
