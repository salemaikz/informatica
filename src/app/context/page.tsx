'use client';

import { useState } from 'react';
import { CONTEXTS, buildContextPractice } from '@/content/contexts';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { useT } from '@/i18n/useT';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ContextPage() {
  const { t, l } = useT();
  const [id, setId] = useState<string | null>(null);
  const context = CONTEXTS.find(context => context.id === id);
  if (context) return <LessonPlayer kind="drill" title={l(context.title)} steps={buildContextPractice(context.id)}/>;
  return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-8"><h1 className="text-3xl font-extrabold">{t('practice.context')}</h1><p className="font-semibold text-muted">{t('practice.contextHint')}</p>{CONTEXTS.map(context => <Card key={context.id}><h2 className="mb-2 text-xl font-extrabold">{l(context.title)}</h2><p className="mb-3 text-sm font-bold text-muted">{t('practice.contextCount', { n: context.questions.length })} · {t('practice.heartCost')}</p><Button onClick={() => setId(context.id)}>{t('common.start')}</Button></Card>)}<ButtonLink href="/practice" variant="ghost">{t('common.back')}</ButtonLink></main>;
}
